from uuid import UUID
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from supabase import Client
from app.database import get_authenticated_client
from app.dependencies import require_facility_id
from app.config import get_settings
from app.services.cloudinary_service import create_private_image_url, upload_diagnostic_image

router = APIRouter(prefix="/media", tags=["media"])
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}


@router.post("/diagnostic")
async def upload_diagnostic(patient_id: UUID = Form(...), file: UploadFile = File(...), client: Client = Depends(get_authenticated_client), facility_id: str = Depends(require_facility_id)) -> dict[str, str]:
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=415, detail="Only JPEG, PNG, and WebP images are supported")
    content = await file.read(get_settings().max_upload_bytes + 1)
    if not content:
        raise HTTPException(status_code=400, detail="Empty upload")
    try:
        patient = client.table("patients").select("id").eq("id", str(patient_id)).limit(1).execute().data
        if not patient:
            raise HTTPException(status_code=404, detail="Patient not found or access denied")
        uploaded = upload_diagnostic_image(content, file.filename or "diagnostic-image")
        saved = client.table("diagnostic_images").insert({"patient_id": str(patient_id), "facility_id": facility_id, "cloudinary_public_id": uploaded["public_id"], "image_url": uploaded["url"], "image_format": uploaded["format"]}).execute().data
        if not saved:
            raise HTTPException(status_code=500, detail="Image uploaded but metadata could not be saved")
        return {"url": create_private_image_url(uploaded["public_id"], uploaded["format"]), "id": str(saved[0]["id"])}
    except ValueError as exc:
        raise HTTPException(status_code=413, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail="Image storage is not configured") from exc
