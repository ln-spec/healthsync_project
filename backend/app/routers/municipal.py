import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from supabase import Client

from app.database import get_authenticated_client, get_service_role_client
from app.dependencies import require_municipality_id
from app.services.municipal_service import get_municipal_patient_counts

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/municipal", tags=["municipal"])


@router.get("/dashboard")
def municipal_dashboard(
    days: int = Query(default=30, ge=7, le=90),
    client: Client = Depends(get_authenticated_client),
    municipality_id: str = Depends(require_municipality_id),
) -> dict:
    """Return municipality-scoped aggregates, never patient-level data."""
    try:
        response = client.rpc(
            "get_municipal_dashboard",
            {"p_days": days},
        ).execute()
        if not isinstance(response.data, dict):
            raise ValueError("Municipal dashboard returned an unexpected response")
        if str(response.data.get("municipality_id", "")).lower() != municipality_id.lower():
            raise ValueError("Municipal dashboard scope did not match the authenticated user")
        response.data["patient_counts"] = get_municipal_patient_counts(
            get_service_role_client(), municipality_id
        )
        return response.data
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Municipal dashboard request failed")
        error_code = getattr(exc, "code", None)
        if error_code == "PGRST202":
            detail = "A municipal dashboard database function is missing from the Supabase API schema. Apply the latest MHO migrations and refresh the Supabase schema cache."
        elif error_code in {"42P01", "42703"}:
            detail = "Municipal dashboard database schema does not match the application. Check that all HealthSync migrations were applied to this Supabase project."
        elif error_code == "42501":
            detail = "Municipal account is not authorized for this municipality. Check its app_metadata role and municipality_id assignment."
        else:
            detail = "Municipal dashboard data is temporarily unavailable. Check the backend log for the database error."
        raise HTTPException(
            status_code=503,
            detail=detail,
        ) from exc
