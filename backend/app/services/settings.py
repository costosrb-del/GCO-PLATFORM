from app.services.cache import cache

CACHE_KEY_SETTINGS = "app_settings_v1.json"

DEFAULT_SETTINGS = {
    # Default URL para saldos / distribución inteligente / mrp (antes hardcodeado en config.py)
    "inventory_sheet_url": "https://docs.google.com/spreadsheets/d/e/2PACX-1vRDYM7-zJ4c5B1VftH2EGmL5buLTWt24mHN0oHOgYNK2zi37QNIEavPwnwpV06IKJMoPUJqea_tzOir/pub?output=xlsx",
    # Default URL para conciliador (antes estado inicial en React)
    "conciliacion_sheet_url": "https://docs.google.com/spreadsheets/d/e/2PACX-1vQX-cGiE9Da8QvYsYBpCAiPwvm4QL2frVBckyh7O0wusUkKPJLoSGH9ygsnv_-3e92ZjV_noh-a8a97/pub?output=csv"
}

def get_all_settings():
    data = cache.load(CACHE_KEY_SETTINGS)
    if not data:
        cache.save(CACHE_KEY_SETTINGS, DEFAULT_SETTINGS)
        return DEFAULT_SETTINGS
    
    # Merge with defaults to ensure keys exist
    for k, v in DEFAULT_SETTINGS.items():
        if k not in data:
            data[k] = v
            
    return data

def set_setting(key: str, value: str):
    settings = get_all_settings()
    settings[key] = value
    return cache.save(CACHE_KEY_SETTINGS, settings)

def set_all_settings(new_settings: dict):
    settings = get_all_settings()
    settings.update(new_settings)
    return cache.save(CACHE_KEY_SETTINGS, settings)
