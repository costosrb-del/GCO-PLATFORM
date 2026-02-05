from app.services.cache import cache

CACHE_KEY_ROLES = "roles_v1.json"

# Default fallback if file empty
DEFAULT_ROLES = {
    "costos@origenbotanico.com": "admin",
    "visualizador@origenbotanico.com": "viewer"
}

def get_all_roles():
    data = cache.load(CACHE_KEY_ROLES)
    if not data:
        # Initialize with defaults if empty
        cache.save(CACHE_KEY_ROLES, DEFAULT_ROLES)
        return DEFAULT_ROLES
    return data

def get_user_role(email):
    roles = get_all_roles()
    
    # Check explicit rules first
    if email in roles:
        return roles[email]
        
    # Implicit rules (Robustness for Cloud Run / Ephemeral FS)
    email_lower = email.lower()
    if "asesora" in email_lower:
        return "asesora"
    if "admin" in email_lower and "costos" not in email_lower: # 'costos' is already in default but good for others
        return "admin"
        
    return "viewer" # Default to viewer

def set_user_role(email, role):
    roles = get_all_roles()
    roles[email] = role
    return cache.save(CACHE_KEY_ROLES, roles)

def remove_user_role(email):
    roles = get_all_roles()
    if email in roles:
        del roles[email]
        return cache.save(CACHE_KEY_ROLES, roles)
    return True
