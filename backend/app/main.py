from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import movements_router, auth_router, inventory_router, export_router, config_router

app = FastAPI(title="GCO Siigo API", version="2.0.0")

# Setup Logging
import logging
import sys
import os

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)

logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup_event():
    logger.info("Application starting up...")
    logger.info(f"Port config: {os.getenv('PORT', 'Not Set')}")
    
    # Log all registered routes
    logger.info("Registered Routes:")
    for route in app.routes:
        logger.info(f" - {route.path} [{route.name}]")

    logger.info("Ready to accept connections.")

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

