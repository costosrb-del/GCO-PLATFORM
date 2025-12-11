import requests
import time

PRODUCTS_URL = "https://api.siigo.com/v1/products"

def get_products(token, partner_id="SiigoApi", page=1, page_size=25):
    """
    Fetches a list of products from Siigo API.
    """
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}",
        "Partner-Id": partner_id
    }
    params = {
        "page": page,
        "page_size": page_size
    }
    
    max_retries = 5
    retry_delay = 2

    for attempt in range(max_retries):
        try:
            response = requests.get(PRODUCTS_URL, headers=headers, params=params)
            
            # Handle rate limiting
            if response.status_code == 429:
                print(f"Rate limit exceeded (429) fetching page {page}. Retrying in {retry_delay} seconds...")
                time.sleep(retry_delay)
                retry_delay *= 2
                continue
            
            # Handle temporary server errors (502 Bad Gateway, 503 Service Unavailable)
            if response.status_code in [502, 503]:
                print(f"Server error ({response.status_code}) fetching page {page}. Attempt {attempt+1}/{max_retries}.")
                if attempt < max_retries - 1:
                    print(f"Retrying in {retry_delay} seconds...")
                    time.sleep(retry_delay)
                    retry_delay *= 2
                    continue
                else:
                    print(f"Max retries reached for page {page}. Skipping.")
                    return None
                
            response.raise_for_status()
            return response.json()
            
        except requests.exceptions.RequestException as e:
            print(f"Error fetching products (attempt {attempt+1}/{max_retries}): {e}")
            if hasattr(e, 'response') and e.response is not None:
                print(f"Response status: {e.response.status_code}")
                print(f"Response content: {e.response.text[:200]}")
            
            if attempt < max_retries - 1:
                print(f"Retrying in {retry_delay} seconds...")
                time.sleep(retry_delay)
                retry_delay *= 2
            else:
                print(f"Max retries reached. Returning None.")
                return None
            
    return None

def get_all_products(token, partner_id="SiigoApi", progress_callback=None):
    """
    Fetches ALL products by handling pagination in PARALLEL.
    """
    import math
    import concurrent.futures
    
    all_products = []
    
    # Fetch page 1 to get metadata
    if progress_callback:
        progress_callback("Iniciando carga de inventario...")
        
    data = get_products(token, partner_id, page=1, page_size=100) # Increased page_size
    
    if not data or "results" not in data:
        return []
        
    results = data["results"]
    all_products.extend(results)
    
    pagination = data.get("pagination", {})
    total_results = pagination.get("total_results", 0)
    # Using 100 as page_size for optimization
    page_size = 100 
    
    if total_results > len(results):
        total_pages = math.ceil(total_results / page_size)
        
        def fetch_page(p):
            # if progress_callback: progress_callback(f"Cargando página {p}/{total_pages}...")
            p_data = get_products(token, partner_id, page=p, page_size=page_size)
            return p_data["results"] if p_data and "results" in p_data else []

        # Fetch remaining pages in parallel
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            pages_to_fetch = range(2, total_pages + 1)
            future_to_page = {executor.submit(fetch_page, p): p for p in pages_to_fetch}
            
            completed_pages = 0
            for future in concurrent.futures.as_completed(future_to_page):
                page_res = future.result()
                all_products.extend(page_res)
                completed_pages += 1
                if progress_callback:
                    progress_callback(f"Cargando inventario: {len(all_products)}/{total_results} productos...")
                    
    return all_products
