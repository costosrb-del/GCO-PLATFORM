from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel

router = APIRouter(prefix="/auth", tags=["auth"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

class LoginRequest(BaseModel):
    username: str
    password: str

# In-memory session store (replace with Redis/DB in prod)
# For now, we trust the token IS the username (simple master key logic)
# Ideally, integrate JWT.

# Simple In-Memory User DB (In prod, use a database)
USERS_DB = {
    "costos@origenbotanico.com": {"password": "admin123", "role": "admin", "token": "token-admin-secret"},
    "visualizador@origenbotanico.com": {"password": "view123", "role": "viewer", "token": "token-viewer-secret"}
}

def verify_token(token: str = Depends(oauth2_scheme)):
    # Simple token lookup
    for email, data in USERS_DB.items():
        if data["token"] == token:
            return {"email": email, "role": data["role"]}
    
    # Fallback for old tokens or direct firebase tokens (if any)
    if token == "master-token-123":
         return {"email": "costos@origenbotanico.com", "role": "admin"}

    raise HTTPException(status_code=401, detail="Invalid token")

@router.post("/login")
def login(request: LoginRequest):
    user = USERS_DB.get(request.username)
    if user and user["password"] == request.password:
        return {
            "access_token": user["token"],
            "token_type": "bearer",
            "role": user["role"]
        }
    else:
        raise HTTPException(status_code=401, detail="Invalid credentials")
