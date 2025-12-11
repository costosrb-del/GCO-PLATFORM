import requests
import time
from datetime import datetime

BASE_URL = "https://api.siigo.com/v1"

def get_documents(token, endpoint, start_date, end_date, page=1, page_size=50, date_param_name="date_start"):
    """
    Generic function to fetch documents (invoices, credit-notes, etc.)
    """
    url = f"{BASE_URL}/{endpoint}"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}",
        "Partner-Id": "SiigoApi"
    }
    
    # FIXED: Send ONLY date_start (accounting date).
    # Sending created_start restricts valid invoices created after the period (e.g. next day).
    # We rely on Python-side strict filtering to discard any old/irrelevant data.
    params = {
        "page": page,
        "page_size": page_size,
        "date_start": start_date,
        "date_end": end_date,
    }
    
    max_retries = 3
    retry_delay = 2

    for attempt in range(max_retries):
        try:
            print(f"DEBUG: Fetching {endpoint} page {page} with params {params}")
            response = requests.get(url, headers=headers, params=params)
            
            if response.status_code == 429:
                print(f"Rate limit exceeded (429) fetching {endpoint} page {page}. Retrying...")
                time.sleep(retry_delay)
                retry_delay *= 2
                continue
                
            response.raise_for_status()
            return response.json()
            
        except requests.exceptions.RequestException as e:
            print(f"Error fetching {endpoint}: {e}")
            if hasattr(e, 'response') and e.response is not None:
                print(f"Response content: {e.response.text}")
            return None
            
    return None

def get_all_documents(token, endpoint, start_date, end_date, progress_callback=None):
    """
    Fetch all pages of documents - OPTIMIZED PARALLEL VERSION
    """
    import math
    import concurrent.futures

    all_docs = []
    
    # Determine date param
    date_param = "created_start" if endpoint == "journals" else "date_start"
    
    # 1. Fetch First Page to metadata
    PAGE_SIZE = 100 # Maximize page size to reduce requests
    first_page_data = get_documents(token, endpoint, start_date, end_date, page=1, page_size=PAGE_SIZE, date_param_name=date_param)
    
    if not first_page_data or "results" not in first_page_data:
        return []

    results = first_page_data["results"]
    all_docs.extend(results)
    
    pagination = first_page_data.get("pagination", {})
    total_results = pagination.get("total_results", 0)
    
    if total_results == 0:
        return []
        
    total_pages = math.ceil(total_results / PAGE_SIZE)
    print(f"DEBUG: {endpoint} has {total_results} results across {total_pages} pages.")

    if total_pages > 1:
        # Define worker for subsequent pages
        def fetch_page(p_num):
            if progress_callback and p_num % 5 == 0: # Throttle UI updates
                progress_callback(f"{endpoint}: Pag {p_num}/{total_pages}...")
            
            p_data = get_documents(token, endpoint, start_date, end_date, page=p_num, page_size=PAGE_SIZE, date_param_name=date_param)
            return p_data.get("results", []) if p_data else []

        # 2. Fetch pages 2 to N in parallel
        # We limit max_workers to avoid hitting rate limits too hard (Siigo likely has limits)
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            future_to_page = {executor.submit(fetch_page, p): p for p in range(2, total_pages + 1)}
            
            for future in concurrent.futures.as_completed(future_to_page):
                try:
                    page_results = future.result()
                    all_docs.extend(page_results)
                except Exception as e:
                    print(f"Error fetching page parallel: {e}")

    return all_docs

def extract_movements_from_doc(doc, doc_type):
    """
    Extract product items from a document and format as movements
    """
    movements = []
    doc_date = doc.get("date")
    doc_id = doc.get("id")
    doc_number = doc.get("name") or str(doc.get("number", ""))
    
    # Map endpoint to User-Friendly Document Type Code
    type_map = {
        "invoices": "FV",
        "credit-notes": "NC",
        "debit-notes": "ND",
        "purchases": "FC",
        "journals": "CC"
    }
    friendly_type = type_map.get(doc_type, doc_type)
    
    # Determine movement type based on document (using original endpoint name)
    mov_type = "SALIDA" # Default for invoices
    
    if doc_type == "credit-notes":
        mov_type = "ENTRADA" # Devolución en ventas
    elif doc_type == "debit-notes":
        mov_type = "SALIDA" # Ajuste de valor o salida
    elif doc_type == "purchases":
        mov_type = "ENTRADA" # Compra de mercancía
    elif doc_type == "journals":
        mov_type = "AJUSTE" # Movimiento manual / Contable
    
    # Extract Third Party info (Customer/Vendor)
    # Siigo API varies 'customer', 'provider', 'company', or sometimes 'contact'
    # Prioritize specific keys based on document type if known, otherwise try all
    third_party = doc.get("customer") or doc.get("provider") or doc.get("company") or doc.get("contact") or doc.get("cost_center") or {}
    
    # Sometimes it's a list (rare but possible), take first
    if isinstance(third_party, list) and len(third_party) > 0:
        third_party = third_party[0]
    
    # Ensure it's a dictionary
    if not isinstance(third_party, dict):
        third_party = {}

    client_name = third_party.get("name") or third_party.get("full_name") or third_party.get("business_name")
    
    # Robust NIT Search: Check multiple common keys used by Siigo API
    client_nit = (third_party.get("identification") or 
                  third_party.get("identification_number") or 
                  third_party.get("nit") or 
                  third_party.get("id") or 
                  "N/A")
    
    # Fallback: If name is missing (common in light API responses), show NIT as Name
    if not client_name:
        client_name = client_nit if client_nit != "N/A" else "Sin Tercero"
    
    # Extract Observation
    observation = doc.get("observations", "")
    
    items = doc.get("items", [])
    print(f"DEBUG: Processing document {doc_number} with {len(items)} items")
    
    for item in items:
        # In Siigo API, items might have code directly or nested in product
        code = item.get("code")
        if not code:
             # Try nested product object
             product = item.get("product")
             if isinstance(product, dict):
                 code = product.get("code")
        
        # STRICT FILTER: Only items with a valid code are considered "Products"
        # Financial lines (services without SKU) usually lack a code in Siigo API responses.
        if not code:
            # print(f"DEBUG: Skipping non-product item: {item.get('description', 'N/A')}")
            continue
            
        qty = float(item.get("quantity", 0))
        
        # Skip if quantity is effectively zero (no inventory movement)
        if abs(qty) < 0.0001:
             continue
        price = item.get("price", 0)
        description = item.get("description", "")
        
        # Reverted Strict Filter: Allow items without warehouse (Financial/Services).
        # User requested to fetch ALL and filter in UI.
        warehouse = item.get("warehouse", {})
        warehouse_name = warehouse.get("name", "Sin Bodega")
        
        movements.append({
            "date": doc_date,
            "doc_type": friendly_type,
            "doc_number": doc_number,
            "client": client_name,
            "nit": client_nit,
            "code": code,
            "name": description,
            "warehouse": warehouse_name,
            "quantity": qty,
            "price": price,
            "total": qty * price,
            "type": mov_type,
            "observations": observation
        })
        
    print(f"DEBUG: Extracted {len(movements)} movements from document {doc_number}")
    return movements

def get_consolidated_movements(token, start_date, end_date, progress_callback=None, selected_types=None):
    """
    Main function to get all movements with strict date filtering
    """
    from datetime import datetime, timedelta
    all_movements = []
    
    # Parse dates for validation
    start_dt = datetime.strptime(start_date, "%Y-%m-%d")
    end_dt = datetime.strptime(end_date, "%Y-%m-%d")
    
    # DATE FIX: Siigo API date_end appears to be exclusive or 00:00 cutoff.
    # To ensure we get the full 'end_date', we extend the API query window by 1 day.
    # We will still filter strictly by the user's selected 'end_date' in Python.
    api_end_dt = end_dt + timedelta(days=1)
    api_end_str = api_end_dt.strftime("%Y-%m-%d")
    
    # Master list of document types
    # Format: (endpoint, description, unique_key)
    # unique_key matches the UI selection values roughly or we map them.
    master_types = [
        ("invoices", "Facturas de Venta (FV)", "FV"),
        ("credit-notes", "Notas Crédito (NC)", "NC"),
        ("debit-notes", "Notas Débito (ND)", "ND"),
        ("purchases", "Facturas de Compra (FC)", "FC"),
        ("journals", "Comprobantes Contables (CC)", "CC")
    ]
    
    # Filter types to process
    types_to_process = []
    if selected_types and len(selected_types) > 0:
        # User selected specific types. Map them.
        # Check against the 3rd element (key) or defaults
        for t in master_types:
             endpoint, desc, key = t
             # Allow matching by endpoint or key (e.g. "FV", "FC")
             if key in selected_types or endpoint in selected_types:
                types_to_process.append(t)
    else:
        # Default: Process ALL if nothing specific selected
        types_to_process = master_types
        
    # Optimized: Fetch all document types in PARALLEL
    import concurrent.futures
    
    def fetch_doc_type_movements(type_info):
        endpoint, description, key = type_info
        type_movs = []
        
        try:
            # Query API with EXTENDED range to cover full end day
            docs = get_all_documents(token, endpoint, start_date, api_end_str)
            
            for doc in docs:
                # Strict date filtering using USER'S original range
                doc_date_str = doc.get("date")
                if doc_date_str:
                    try:
                        doc_date = datetime.strptime(doc_date_str, "%Y-%m-%d")
                        if start_dt <= doc_date <= end_dt:
                            movements = extract_movements_from_doc(doc, endpoint)
                            type_movs.extend(movements)
                    except ValueError:
                        continue
        except Exception as e:
            print(f"ERROR: Failed to fetch {endpoint}: {str(e)}")
            
        return type_movs

    # Run in parallel to speed up
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        future_to_type = {executor.submit(fetch_doc_type_movements, t): t for t in types_to_process}
        
        for future in concurrent.futures.as_completed(future_to_type):
            type_info = future_to_type[future]
            try:
                result_movs = future.result()
                all_movements.extend(result_movs)
                if progress_callback:
                    endpoint, desc, key = type_info
                    progress_callback(f"Completado {desc} - {len(result_movs)} regs")
            except Exception as e:
                print(f"Exception processing {type_info}: {e}")

    print(f"DEBUG: Total movements extracted: {len(all_movements)}")
    return all_movements

