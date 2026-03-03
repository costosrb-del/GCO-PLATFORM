from fastapi import APIRouter, Depends, Query, HTTPException, Body
from typing import Optional, List, Dict
from pydantic import BaseModel
from app.routers.auth_router import verify_token
from app.services.conciliacion import get_conciliacion_data
from app.services.email_service import send_conciliacion_email

router = APIRouter(prefix="/conciliacion", tags=["conciliacion"])

class SendEmailRequest(BaseModel):
    start_date: str
    end_date: str
    stats: Dict[str, int]
    discrepancies: List[dict]
    emails: List[str]

@router.get("/")
def reconcile(
    token: str = Depends(verify_token),
    url: str = Query(..., description="URL of the Google Sheet (CSV/XLSX link)"),
    start_date: str = Query(..., description="YYYY-MM-DD"),
    end_date: str = Query(..., description="YYYY-MM-DD"),
    exclude_almaverde: bool = Query(False, description="Exclude Almaverde beauty company")
):
    try:
        data = get_conciliacion_data(url, start_date, end_date, exclude_almaverde)
        if "error" in data:
            raise HTTPException(status_code=400, detail=data["error"])
        return data
    except Exception as e:
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/email")
def send_email_endpoint(
    request: SendEmailRequest,
    token: str = Depends(verify_token)
):
    try:
        success, msg = send_conciliacion_email(
            start_date=request.start_date,
            end_date=request.end_date,
            stats=request.stats,
            discrepancies=request.discrepancies,
            recipients=request.emails
        )
        if not success:
            raise HTTPException(status_code=400, detail=msg)
        return {"message": "Email enviado exitosamente."}
    except Exception as e:
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
