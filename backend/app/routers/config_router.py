from fastapi import APIRouter, Depends
from app.services.config import get_config
from app.routers.auth_router import verify_token

router = APIRouter(prefix="/config", tags=["config"])

@router.get("/companies")
def get_available_companies(user: dict = Depends(verify_token)):
    """
    Returns a list of configured company names.
    """
    companies = get_config()
    # Only return names, not credentials
    return [c["name"] for c in companies if c.get("name")]

import requests
from app.services.auth import get_auth_token
from app.services.inventory import get_all_products

@router.get("/debug-api")
def diagnose_api_status(user: dict = Depends(verify_token)):
    """
    Checks API status for each company.
    """
    if user.get("role") != "admin": # Basic protection
        return {"error": "Only admins can run diagnostics"}

    companies = get_config()
    report = {}

    for c in companies:
        c_name = c["name"]
        
        # 1. Check Config
        if not c.get("valid"):
            report[c_name] = {
                "config": "INVALID",
                "username_len": len(c.get("username", "")),
                "key_len": len(c.get("access_key", ""))
            }
            continue
            
        # 2. Check Auth
        try:
            token = get_auth_token(c["username"], c["access_key"])
            if not token:
                report[c_name] = {"auth": "FAILED (Token None)"}
                continue
                
            report[c_name] = {"auth": "OK"}
            
            # 3. Check Data Fetch (1 product)
            # We use get_all_products with 'page_size=1' if possible, but get_all_products lacks params.
            # So we use manual request to be lightweight.
            url = "https://api.siigo.com/v1/products?page=1&page_size=1"
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {token}",
                "Partner-Id": "GCOPlatform"
            }
            res = requests.get(url, headers=headers, timeout=5)
            if res.status_code == 200:
                data = res.json()
                total = data.get("pagination", {}).get("total_results", "?")
                report[c_name]["api_products"] = f"OK (Total: {total})"
            else:
                 report[c_name]["api_products"] = f"ERROR {res.status_code}"
                 
            # 4. Check Sales (1 Invoice)
            last_month = "2025-01-01" # Safe past date
            url_fv = f"https://api.siigo.com/v1/invoices?page=1&page_size=1&date_start={last_month}"
            res_fv = requests.get(url_fv, headers=headers, timeout=5)
            if res_fv.status_code == 200:
                data_fv = res_fv.json()
                total_fv = data_fv.get("pagination", {}).get("total_results", "?")
                report[c_name]["api_invoices"] = f"OK (Total: {total_fv})"
            else:
                report[c_name]["api_invoices"] = f"ERROR {res_fv.status_code}"

        except Exception as e:
            report[c_name]["error"] = str(e)
            
    return report
