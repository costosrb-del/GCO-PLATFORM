
from fastapi import APIRouter, HTTPException, UploadFile, File, Response
from typing import Optional
from app.services.transport_service import get_all_requests, create_request, update_request, delete_request, bulk_import_from_excel, get_transport_config, add_carrier, add_location, get_db_status
from app.services.transport_pdf import generate_transport_pdf_bytes

router = APIRouter(
    prefix="/transport",
    tags=["transport"],
    responses={404: {"description": "Not found"}},
)

@router.get("/status")
async def check_db_connection_status():
    """Check if connected to Firebase or Local DB."""
    return get_db_status()

@router.delete("/{req_id}")
async def delete_transport_request_endpoint(req_id: str):
    """
    Delete a transport request.
    """
    try:
        success = delete_request(req_id)
        if not success:
             raise HTTPException(status_code=404, detail="Request not found or not deleted")
        return {"status": "success", "message": "Deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/")
async def list_transport_requests():
    return get_all_requests()

@router.post("/")
async def create_transport_request(data: dict):
    try:
        return create_request(data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{req_id}")
async def update_transport_request_endpoint(req_id: str, data: dict):
    try:
        return update_request(req_id, data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{req_id}/pdf")
async def get_transport_pdf(req_id: str):
    try:
        # Fetch data robustly (using get_all for efficiency in local mode)
        all_reqs = get_all_requests()
        req = next((r for r in all_reqs if r["id"] == req_id), None)
        
        if not req:
             raise HTTPException(status_code=404, detail="Request not found")

        pdf_bytes = generate_transport_pdf_bytes(req)
        
        filename = f"Solicitud_Transporte_{req.get('legacy_id', req_id)}.pdf"
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/upload")
async def upload_transport_excel(file: UploadFile = File(...)):
    if not file.filename.endswith(('.xls', '.xlsx')):
        raise HTTPException(status_code=400, detail="Invalid file format. Please upload an Excel file.")
    
    try:
        content = await file.read()
        result = bulk_import_from_excel(content)
        
        if "error" in result:
             raise HTTPException(status_code=500, detail=result["error"])
             
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- CONFIG ENDPOINTS ---
@router.get("/config")
async def get_config_endpoint():
    """Get master data (carriers, locations)."""
    return get_transport_config()

@router.post("/config/carriers")
async def add_carrier_endpoint(data: dict):
    return add_carrier(data)

@router.post("/config/locations")
async def add_location_endpoint(data: dict):
    return add_location(data)
