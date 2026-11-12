import logging

from fastapi import APIRouter, Depends, HTTPException
from supabase import Client

from app.database import get_authenticated_client
from app.services.options_service import DiagnosisOptionsError, get_active_diagnosis_options

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/options", tags=["options"])


@router.get("/diagnoses")
def list_diagnosis_options(client: Client = Depends(get_authenticated_client)) -> list[dict]:
    try:
        return get_active_diagnosis_options(client)
    except DiagnosisOptionsError as exc:
        logger.error("Diagnosis options request failed")
        raise HTTPException(status_code=503, detail="Diagnosis options are temporarily unavailable") from exc
