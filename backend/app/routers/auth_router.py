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

def verify_token(token: str = Depends(oauth2_scheme)):
    # TEMPORARY FIX: Accept the Firebase JWT issued by the frontend.
    # The frontend uses real Firebase Auth, but we haven't set up the Admin SDK backend-side yet.
    # For now, we trust that if the frontend sends a token, the user is logged in.
    if not token:
        raise HTTPException(status_code=401, detail="Missing token")
    
    # In production: verify_firebase_token(token)
    return token

@router.post("/login")
def login(request: LoginRequest):
    # Hardcoded Master User
    if request.username == "costos@origenbotanico.com" and request.password == "admin123":
        return {
            "access_token": "master-token-123", # Fixed token for dev
            "token_type": "bearer"
        }
    else:
        raise HTTPException(status_code=401, detail="Invalid credentials")
