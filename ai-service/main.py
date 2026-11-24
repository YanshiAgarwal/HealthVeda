"""
main.py  -  HealthVeda AI SERVICE (internal)
--------------------------------------------
The Python "brain": lab-report reading (PDF + OCR), report analysis and the
Ayurvedic RAG chatbot. It is NOT called by browsers - only by the Node.js
server, which sends a secret `X-Service-Key` header (see security.py).

Run it from the ai-service folder:
    uvicorn main:app --host 127.0.0.1 --port 8000

API docs (development only):  http://127.0.0.1:8000/docs
"""

import logging
import threading
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI

from config import APP_ENV, APP_NAME, APP_VERSION
from routes import chat_routes, remedy_routes, report_routes, system_routes
from security import require_service_key
from services.ayurveda_rag import assistant

logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(name)s | %(message)s")
IS_PRODUCTION = APP_ENV == "production"


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load the (slow) RAG models in the background so the service starts at once.
    threading.Thread(target=assistant.load, daemon=True).start()
    yield


app = FastAPI(
    title=f"{APP_NAME} AI Service",
    version=APP_VERSION,
    lifespan=lifespan,
    # Hide the interactive docs in production
    docs_url=None if IS_PRODUCTION else "/docs",
    redoc_url=None,
    openapi_url=None if IS_PRODUCTION else "/openapi.json",
)

# Every feature route requires the service key
protected = [Depends(require_service_key)]
app.include_router(system_routes.router, dependencies=protected)
app.include_router(chat_routes.router, dependencies=protected)
app.include_router(report_routes.router, dependencies=protected)
app.include_router(remedy_routes.router, dependencies=protected)


@app.get("/health", include_in_schema=False)
def health():
    """Public liveness check for Docker / load balancers (reveals nothing)."""
    return {"status": "ok"}
