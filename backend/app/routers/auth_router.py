from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
# from app.services.auth import get_auth_token

router = APIRouter(prefix="/auth", tags=["auth"])

class LoginRequest(BaseModel):
    username: str
    password: str

@router.post("/login")
def login(credentials: LoginRequest):
    # Hardcoded Master User
    if credentials.username == "costos@origenbotanico.com" and credentials.password == "admin123":
        return {
            "access_token": "master_session_token",
            "token_type": "bearer",
            "user": credentials.username
        }
    
    raise HTTPException(status_code=401, detail="Credenciales incorrectas")

