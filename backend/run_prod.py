
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
    try:
        port_env = os.environ.get("PORT", "8080")
        port = int(port_env)
        logger.info(f"Starting application on port {port}...")
        
        # Disable reload in production for better performance
        uvicorn.run("app.main:app", host="0.0.0.0", port=port, log_level="info")
        
    except Exception as e:
        logger.critical(f"Failed to start application: {e}")
        sys.exit(1)
