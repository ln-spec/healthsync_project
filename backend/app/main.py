from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from app.routers import inventory, media, patients

settings = get_settings()
app = FastAPI(title="HealthSync API", version="0.1.0", description="Barangay health records and inventory API")
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_credentials=True, allow_methods=["GET", "POST", "PATCH", "OPTIONS"], allow_headers=["Authorization", "Content-Type"])
app.include_router(patients.router, prefix="/api/v1")
app.include_router(inventory.router, prefix="/api/v1")
app.include_router(media.router, prefix="/api/v1")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
