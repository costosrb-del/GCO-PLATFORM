from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import movements_router, auth_router, inventory_router, export_router, config_router

app = FastAPI(title="GCO Siigo API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "GCO Platform V2 API is running", "status": "online"}

app.include_router(auth_router.router)
app.include_router(movements_router.router)
app.include_router(inventory_router.router)
app.include_router(export_router.router)
app.include_router(config_router.router)

