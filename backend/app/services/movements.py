import requests
import time
from datetime import datetime
import logging

BASE_URL = "https://api.siigo.com/v1"

def get_documents(token, endpoint, start_date, end_date, page=1, page_size=50, date_param_name="date_start"):
    """
    Generic function to fetch documents (invoices, credit-notes, etc.)
    """
    url = f"{BASE_URL}/{endpoint}"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}",
        "Partner-Id": "GCOPlatform"
    }
    
    start_key = date_param_name
    end_key = date_param_name.replace("_start", "_end")
    
    params = {
        "page": page,
        "page_size": 100, # Force 100 to maximize throughput
        start_key: start_date,
        end_key: end_date,
    }
    
    max_retries = 3
    retry_delay = 2

    for attempt in range(max_retries):
        try:
            # print(f"DEBUG: Fetching {endpoint} page {page} with params {params}")
            logging.info(f"Fetching {endpoint} page {page}. Params: {params}")
            response = requests.get(url, headers=headers, params=params, timeout=30)
            
            if response.status_code == 429:
                logging.warning(f"Rate limit 429 for {endpoint}")
                print(f"Rate limit exceeded (429) fetching {endpoint} page {page}. Retrying...")
                time.sleep(retry_delay)
                retry_delay *= 2
                continue
                
            response.raise_for_status()
            data = response.json()
            logging.info(f"Page {page} {endpoint}: Got {len(data.get('results', []))} results. Total: {data.get('pagination', {}).get('total_results')}")
            return data
            
        except requests.exceptions.RequestException as e:
            print(f"Error fetching {endpoint}: {e}")
            if hasattr(e, 'response') and e.response is not None:
                # print(f"Response content: {e.response.text}")
                pass
            
            if attempt < max_retries - 1:
                time.sleep(retry_delay)
                continue
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
    # print(f"DEBUG: {endpoint} has {total_results} results across {total_pages} pages.")

    if total_pages > 1:
        # Define worker for subsequent pages
        def fetch_page(p_num):
            if progress_callback and p_num % 5 == 0: # Throttle UI updates
                progress_callback(f"{endpoint}: Pag {p_num}/{total_pages}...")
            
            p_data = get_documents(token, endpoint, start_date, end_date, page=p_num, page_size=PAGE_SIZE, date_param_name=date_param)
            return p_data.get("results", []) if p_data else None

        # 2. Fetch pages 2 to N in parallel (with localized verification)
        failed_pages = []
        
        # Reduced max_workers to 2 to improve stability
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
            future_to_page = {executor.submit(fetch_page, p): p for p in range(2, total_pages + 1)}
            
            for future in concurrent.futures.as_completed(future_to_page):
                p_num = future_to_page[future]
                try:
                    page_results = future.result()
                    if page_results is not None:
                        all_docs.extend(page_results)
                    else:
                        print(f"WARNING: Page {p_num} failed to fetch. Adding to retry queue.")
                        failed_pages.append(p_num)
                except Exception as e:
                    logging.error(f"Error fetching page {p_num}: {e}")
                    failed_pages.append(p_num)

        # 3. Retry Logic for Failed Pages (Sequential "Rescue")
        if failed_pages:
            print(f"Attempting to rescue {len(failed_pages)} failed pages...")
            for p_num in failed_pages:
                try:
                    import time
                    time.sleep(1.0) # Grace period
                    p_data = get_documents(token, endpoint, start_date, end_date, page=p_num, page_size=PAGE_SIZE, date_param_name=date_param)
                    if p_data and "results" in p_data:
                        all_docs.extend(p_data["results"])
                        print(f"SUCCESS: Rescued page {p_num}.")
                    else:
                        print(f"CRITICAL: Failed to rescue page {p_num} after retry.")
                except Exception as e:
                    print(f"CRITICAL: Exception rescuing page {p_num}: {e}")

    # 4. Final Integrity Check
    if len(all_docs) != total_results:
        print(f"INTEGRITY WARNING: Expected {total_results} documents for {endpoint}, but got {len(all_docs)}. Some data may be missing.")
    else:
        print(f"Integrity Check Passed: {len(all_docs)}/{total_results} documents verified.")

    logging.info(f"Total docs fetched for {endpoint}: {len(all_docs)}")
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
        "journals": "CC",
        "delivery-notes": "RM" # Updated from REM
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
        # Check for ENSAMBLE in observations, document name, or *Document Type Name*
        obs_lower = (doc.get("observations") or "").lower()
        doc_name_upper = (doc.get("name") or "").upper() # e.g. CC-123
        doc_type_info_name = (doc.get("document", {}).get("name") or "").upper() # e.g. Nota de Ensamble
        
        is_ensamble = (
            "ENSAMBLE" in obs_lower or 
            "TRANSFORMACION" in obs_lower or 
            "NE-" in doc_name_upper or 
            doc_name_upper.startswith("NE") or
            "ENSAMBLE" in doc_type_info_name
        )
        
        if is_ensamble:
             friendly_type = "NE"
             mov_type = "TRANSFORMACION"
        else:
             mov_type = "AJUSTE" # Movimiento manual / Contable
             
    elif doc_type == "delivery-notes":
        mov_type = "SALIDA" # Remisión (Salida de inventario)
    
    # Extract Third Party info (Customer/Vendor)
    # Siigo API varies 'customer', 'provider', 'company', or sometimes 'contact'
    # For Purchases (FC), the third party is often in 'seller'
    third_party = {}
    if doc_type == "purchases":
        third_party = doc.get("seller") or doc.get("provider") or {}
    else:
        third_party = doc.get("customer") or doc.get("provider") or doc.get("company") or doc.get("contact") or doc.get("cost_center") or {}
    
    # Sometimes it's a list (rare but possible), take first
    if isinstance(third_party, list) and len(third_party) > 0:
        third_party = third_party[0]
    
    # Ensure it's a dictionary
    if not isinstance(third_party, dict):
        third_party = {}

    client_name = third_party.get("name") or third_party.get("full_name") or third_party.get("business_name")
    
    # Robust NIT Search: Check multiple common keys used by Siigo API
    # Added .get("id") as last resort as it sometimes contains the identification in simplified objects
    client_nit = (third_party.get("identification") or 
                  third_party.get("identification_number") or 
                  third_party.get("nit") or 
                  str(third_party.get("id", "")) if third_party.get("id") else None)
    
    if not client_nit or client_nit == "" or client_nit == "None":
        client_nit = "N/A"
    
    # Fallback: If name is missing (common in light API responses), show NIT as Name
    if not client_name:
        client_name = client_nit if client_nit != "N/A" else "Sin Tercero"
    
    # Extract Observation
    observation = doc.get("observations", "")
    
    # --- AUDIT FIELDS EXTRACTION (Requested for FC/FV) ---
    
    # 1. Cost Center
    cost_center = doc.get("cost_center")
    cc_name = "N/A"
    if isinstance(cost_center, dict):
        cc_name = cost_center.get("name") or str(cost_center.get("code", ""))
    elif cost_center:
        cc_name = str(cost_center)
        
    # 2. Seller (Vendedor/Asesor)
    # SPECIAL: For purchases, 'seller' was the provider. We don't want to show the provider as the salesperson.
    seller_name = "N/A"
    if doc_type != "purchases":
        seller = doc.get("seller")
        if isinstance(seller, dict):
            # Try full name composition
            parts = [seller.get("first_name", ""), seller.get("last_name", "")]
            seller_name = " ".join([p for p in parts if p]).strip()
            if not seller_name:
                seller_name = seller.get("username") or str(seller.get("id", "")) or "N/A"
        elif seller:
            seller_name = str(seller)
        
    # 3. Payment Forms (Formas de Pago)
    payments = doc.get("payments", [])
    payment_list = []
    if isinstance(payments, list):
        for p in payments:
            # Structure varies: might be direct 'name' or nested in 'payment_method'
            p_name = p.get("name")
            if not p_name:
                pm = p.get("payment_method")
                if isinstance(pm, dict):
                    p_name = pm.get("name")
            if p_name:
                payment_list.append(p_name)
    payment_str = ", ".join(payment_list) if payment_list else "Credito/Otro"
    
    # 4. Metadata (Created By/At)
    metadata = doc.get("metadata", {})
    created_at = metadata.get("created")
    created_by = metadata.get("created_by") if isinstance(metadata.get("created_by"), (str, int)) else "System"
    if isinstance(metadata.get("created_by"), dict):
        created_by = metadata.get("created_by", {}).get("email", "System")

    # 5. Currency
    currency = doc.get("currency")
    currency_code = "COP"
    exchange_rate = 1.0
    if isinstance(currency, dict):
        currency_code = currency.get("code", "COP")
        exchange_rate = currency.get("exchange_rate", 1.0)
        
    # 6. Global Values (Document Level)
    # These will be repeated per line, which is acceptable for flat audit tables
    doc_total = doc.get("total", 0)
    
    items = doc.get("items", [])
    # print(f"DEBUG: Processing document {doc_number} with {len(items)} items")
    
    for item in items:
        # In Siigo API, items might have code directly or nested in product
        code = item.get("code")
        if not code:
            # Try nested product object
            product = item.get("product")
            if isinstance(product, dict):
                code = product.get("code")
        
        # STRICT FILTER: Only items with a valid code are considered "Products", UNLESS it is an Ensamble
        # Financial lines (services without SKU) usually lack a code in Siigo API responses.
        if not code:
            if friendly_type == "NE":
                 # NE items might be raw materials without standard product codes in the API response view
                 code = "NE-ITEM"
            else:
                 # print(f"DEBUG: Skipping non-product item: {item.get('description', 'N/A')}")
                 # logging.info(f"Skipping non-product item: {description} (No Code)")
                 continue
            
        qty = float(item.get("quantity", 0))
        
        # Skip if quantity is effectively zero (no inventory movement)
        if abs(qty) < 0.0001:
             continue
        price = item.get("price", 0)
        description = item.get("description", "")
        
        # Discounts & Taxes (Line Level)
        discount = item.get("discount", 0)
        taxes = item.get("taxes", [])
        tax_str = "0%"
        if taxes and isinstance(taxes, list):
            # Summarize taxes ex: "IVA 19%"
            t_names = []
            for t in taxes:
                t_name = t.get("name") or t.get("type", "Tax")
                t_percent = t.get("percentage", 0)
                t_names.append(f"{t_name} {t_percent}%")
            tax_str = ", ".join(t_names)
        
        # Reverted Strict Filter: Allow items without warehouse (Financial/Services).
        # User requested to fetch ALL and filter in UI.
        warehouse = item.get("warehouse", {})
        warehouse_name = "Sin Bodega"
        if isinstance(warehouse, dict):
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
            "observations": observation,
            # Audit Fields
            "cost_center": cc_name,
            "seller": seller_name,
            "payment_forms": payment_str,
            "taxes": tax_str,
            "currency": currency_code,
            "exchange_rate": exchange_rate,
            "created_at": created_at,
            "created_by": created_by,
            "doc_total_value": doc_total # Total of the whole document
        })
        
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
        ("journals", "Comprobantes Contables (CC)", "CC"),
        ("delivery-notes", "Remisiones (RM)", "RM")
    ]
    
    # Filter types to process
    types_to_process = []
    if selected_types and len(selected_types) > 0:
        # User selected specific types. Map them.
        # Check against the 3rd element (key) or defaults
        processed_endpoints = set()
        
        for t in master_types:
             endpoint, desc, key = t
             
             # Logic:
             # 1. Direct Match: User asked for "FV", match "FV"
             # 2. Indirect Match: User asked for "NE" (Ensamble), implies we MUST fetch "journals" (CC)
             
             should_include = False
             
             if key in selected_types or endpoint in selected_types:
                 should_include = True
                 
             # Special Case: NE (Ensamble) lives inside Journals (CC)
             if "NE" in selected_types and endpoint == "journals":
                 should_include = True
                 
             # Special Case: ENSAMBLE (Old Key) lives inside Journals (CC)
             if "ENSAMBLE" in selected_types and endpoint == "journals":
                 should_include = True

             if should_include:
                 if endpoint not in processed_endpoints:
                    types_to_process.append(t)
                    processed_endpoints.add(endpoint)
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

    # Run in parallel to speed up - Reduced to 3 to prevent API congestion
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
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

