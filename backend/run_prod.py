
import os
import uvicorn
import logging
import sys

# Configure logging to show up in Cloud Run logs
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("gco_prod_runner")

if __name__ == "__main__":
    # 1. Pre-flight check: Verify app can be imported
    try:
        print("Diagnostic: Attempting to import app.main...", flush=True)
        from app.main import app
        print("Diagnostic: Import successful.", flush=True)
    except Exception as ie:
        print(f"CRITICAL ERROR: Failed to import application: {ie}", file=sys.stderr, flush=True)
        import traceback
        traceback.print_exc()
        sys.exit(1)

    try:
        port_env = os.environ.get("PORT", "8080")
        port = int(port_env)
        logger.info(f"Starting application on port {port}...")
        
        # Disable reload in production for better performance
        uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
        
    except Exception as e:
        logger.critical(f"Failed to start application: {e}")
        sys.exit(1)
