from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
import firebase_admin
from firebase_admin import auth, credentials
import base64
import json
import os
from app.services import roles as role_service

router = APIRouter(prefix="/auth", tags=["auth"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

# Initialize Firebase Admin
try:
    firebase_admin.get_app()
except ValueError:
    try:
        # Check if credential file path is set
        cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
        if cred_path and os.path.exists(cred_path):
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred)
        else:
            firebase_admin.initialize_app()
    except Exception as e:
        print(f"Warning: Firebase Admin init failed: {e}")

def verify_token(token: str = Depends(oauth2_scheme)):
    user_email = None
    
    # 1. Try validating with Firebase Admin SDK (Secure)
    try:
        decoded_token = auth.verify_id_token(token)
        user_email = decoded_token.get("email")
    except Exception as e:
        pass

    # 2. Fallback: Decode JWT locally (Insecure - Development only)
    if not user_email:
        try:
            parts = token.split(".")
            if len(parts) == 3:
                payload = parts[1]
                padded = payload + '=' * (-len(payload) % 4)
                data = json.loads(base64.urlsafe_b64decode(padded))
                user_email = data.get("email")
        except Exception:
            pass
            
    # 3. Last resort: REMOVED Legacy Dev tokens for security
    # if not user_email:
    #    ...

    if not user_email:
        raise HTTPException(status_code=401, detail="Invalid Authentication Token")

    # Determine Role Dynamic Lookup
    role = role_service.get_user_role(user_email)
    
    return {"email": user_email, "role": role}

@router.get("/me")
def get_current_user(user: dict = Depends(verify_token)):
    return user

# --- User Management Endpoints ---

class CreateUserRequest(BaseModel):
    email: str
    password: str
    role: str

@router.get("/users")
def list_users(user: dict = Depends(verify_token)):
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Return persisted list of users/roles
    all_roles = role_service.get_all_roles()
    # Format as list
    user_list = [{"email": k, "role": v} for k, v in all_roles.items()]
    return user_list

@router.post("/users")
def create_user(req: CreateUserRequest, user: dict = Depends(verify_token)):
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Access denied")
    
    # 1. Create in Firebase Auth
    try:
        auth.create_user(email=req.email, password=req.password)
    except Exception as e:
        # Check specific error codes implies user might exist
        err_msg = str(e)
        if "EMAIL_EXISTS" in err_msg or "email already exists" in err_msg.lower():
            # If user exists, we just update the role map logic below
            print(f"User {req.email} already exists in Firebase. Updating role.")
        else:
            # Real error (e.g. no permission)
            print(f"Error creating firebase user: {e}")
            raise HTTPException(status_code=500, detail=f"Firebase Error: {str(e)}")

    # 2. Persist Role
    success = role_service.set_user_role(req.email, req.role)
    if not success:
         raise HTTPException(status_code=500, detail="Failed to save role")
         
    return {"status": "success", "email": req.email, "role": req.role}

@router.delete("/users/{email}")
def delete_user(email: str, user: dict = Depends(verify_token)):
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Access denied")

    # 1. Delete from Firebase Auth
    try:
        user_record = auth.get_user_by_email(email)
        auth.delete_user(user_record.uid)
    except Exception as e:
        print(f"Error deleting firebase user {email}: {e}")
        # We continue even if firebase delete fails (maybe user inconsistent state), 
        # but for robustness we might want to handle user not found specifically.
        # However, for this tool, primary goal is removing access.

    # 2. Remove Role
    role_service.remove_user_role(email)
    
    return {"status": "success", "message": f"User {email} deleted"}
