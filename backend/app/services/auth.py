import requests

AUTH_URL = "https://api.siigo.com/auth"

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
    
    import time

    max_retries = 3
    retry_delay = 2

    for attempt in range(max_retries):
        try:
            response = requests.post(AUTH_URL, json=data, headers=headers)
            
            if response.status_code == 429:
                print(f"Rate limit exceeded (429). Retrying in {retry_delay} seconds...")
                time.sleep(retry_delay)
                retry_delay *= 2  # Exponential backoff
                continue
                
            response.raise_for_status()
            return response.json().get("access_token")
            
        except requests.exceptions.RequestException as e:
            print(f"Error authenticating: {e}")
            if response is not None:
                 print(f"Response content: {response.text}")
            return None
    
    print("Max retries exceeded for authentication.")
    return None
