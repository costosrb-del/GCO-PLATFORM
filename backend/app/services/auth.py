import requests
import time
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception

AUTH_URL = "https://api.siigo.com/auth"

def should_retry(e):
    if isinstance(e, requests.exceptions.HTTPError):
        return e.response.status_code in (429, 500, 502, 503, 504)
    return isinstance(e, requests.exceptions.RequestException)

@retry(
    retry=retry_if_exception(should_retry),
    wait=wait_exponential(multiplier=0.5, min=0.5, max=60),
    stop=stop_after_attempt(5)
)
def _do_auth_request(data, headers):
    response = requests.post(AUTH_URL, json=data, headers=headers, timeout=15)
    response.raise_for_status()
    return response.json().get("access_token")

def get_auth_token(username, access_key, partner_id="SiigoApi"):
    """
    Obtains an access token from Siigo API.
    """
    headers = {
        "Content-Type": "application/json",
        "Partner-Id": partner_id
    }
    data = {
        "username": username,
        "access_key": access_key
    }
    
    try:
        return _do_auth_request(data, headers)
    except Exception as e:
        print(f"Error authenticating: {e}")
        return None
