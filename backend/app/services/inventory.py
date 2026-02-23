import requests
import time
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception

PRODUCTS_URL = "https://api.siigo.com/v1/products"

def should_retry(e):
    if isinstance(e, requests.exceptions.HTTPError):
        return e.response.status_code in (429, 500, 502, 503, 504)
    return isinstance(e, requests.exceptions.RequestException)

@retry(
    retry=retry_if_exception(should_retry),
    wait=wait_exponential(multiplier=0.5, min=0.5, max=30),
    stop=stop_after_attempt(5)
)
def _do_get_products(headers, params):
    response = requests.get(PRODUCTS_URL, headers=headers, params=params, timeout=20)
    response.raise_for_status()
    return response.json()

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
    
    try:
        return _do_get_products(headers, params)
    except Exception as e:
        print(f"Error fetching products page {page}: {e}")
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
    
    if data is None:
        raise Exception("Error crítico: Falló la conexión inicial con Siigo al obtener productos.")
        
    if "results" not in data:
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
            if not p_data or "results" not in p_data:
                raise Exception(f"Failed to fetch page {p}")
            return p_data["results"]

        # Fetch remaining pages in parallel
        # Balanced: 4 workers gives speed without overwhelming API
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
            pages_to_fetch = range(2, total_pages + 1)
            future_to_page = {executor.submit(fetch_page, p): p for p in pages_to_fetch}
            
            completed_pages = 0
            for future in concurrent.futures.as_completed(future_to_page):
                try:
                    page_res = future.result()
                    all_products.extend(page_res)
                    completed_pages += 1
                except Exception as e:
                    print(f"Detailed fetch error in page: {e}")
                    raise e # Propagate to fail the whole company fetch
                if progress_callback:
                    progress_callback(f"Cargando inventario: {len(all_products)}/{total_results} productos...")
                    
    return all_products
