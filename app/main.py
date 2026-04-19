import os
import uvicorn
from fastapi import FastAPI, UploadFile, File, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
import shutil
import logging
from logging.handlers import TimedRotatingFileHandler

# Define Centralized Logging Bounds (Rotating by Days)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - [%(levelname)s] - Ahordian Core - %(message)s',
    handlers=[
        TimedRotatingFileHandler("ahordian_app.log", when="midnight", interval=1, backupCount=30),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("Ahordian")

try:
    from app.engine import AudioEngine
except ImportError:
    from engine import AudioEngine

app = FastAPI(title="Ahordian API")
engine = AudioEngine()

# Disable browser caching for development
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response as StarletteResponse

class NoCacheMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        return response

app.add_middleware(NoCacheMiddleware)

# Mount static files
static_path = os.path.join(os.path.dirname(__file__), "static")
app.mount("/static", StaticFiles(directory=static_path), name="static")

@app.get("/", response_class=HTMLResponse)
async def get_index():
    with open(os.path.join(static_path, "index.html"), "r", encoding="utf-8") as f:
        return f.read()

@app.post("/analyze")
async def analyze_file(request: Request, file: UploadFile = File(...)):
    """Analyze an uploaded audio file and return detected notes"""
    client_ip = request.client.host
    user_agent = request.headers.get("user-agent", "Unknown")
    content_length = request.headers.get("content-length", "Unknown Size")
    
    logger.info(f"--- INCOMING NETWORK REQUEST ---")
    logger.info(f"Target Module: /analyze | Network Node: {client_ip} | Browser: {user_agent}")
    logger.info(f"Payload ID: {file.filename} | Target Format: {file.content_type} | Size Bounds: {content_length} bytes")
    
    if not file.content_type.startswith("audio/"):
        logger.warning(f"SECURITY: Rejected non-audio payload: {file.content_type} from {client_ip}")
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload an audio file.")
    
    # Save temporary file
    temp_path = f"temp_{file.filename}"
    try:
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        logger.info(f"Binary buffered locally to {temp_path}. Executing native engine...")
        # Analyze
        results = engine.analyze_file(temp_path)
        
        if "error" in results:
            logger.error(f"Engine rejected payload: {results['error']}")
            raise HTTPException(status_code=500, detail=results["error"])
            
        logger.info(f"Transcription engine returned nominal payload smoothly.")
        return results
    except Exception as e:
        logger.error(f"Catastrophic failure processing transcriptor matrix: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)
            logger.info("Temporary binary destroyed securely.")

if __name__ == "__main__":
    print("Starting Ahordian on http://localhost:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000)
