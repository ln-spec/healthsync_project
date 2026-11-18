from fastapi import APIRouter, Depends, HTTPException
from supabase import Client

from app.database import get_authenticated_client
from app.dependencies import require_facility_id

router = APIRouter(prefix="/facility", tags=["facility"])


@router.get("")
def get_current_facility(
    client: Client = Depends(get_authenticated_client),
    facility_id: str = Depends(require_facility_id),
) -> dict[str, str]:
    """Return the signed-in worker's active barangay assignment."""
    rows = (
        client.table("barangays")
        .select("facility_id, barangay_name")
        .eq("facility_id", facility_id)
        .eq("is_active", True)
        .limit(1)
        .execute()
        .data
    )
    if not rows:
        raise HTTPException(
            status_code=404,
            detail="No active barangay name is mapped to this facility account",
        )
    return {
        "facility_id": str(rows[0]["facility_id"]),
        "barangay_name": rows[0]["barangay_name"],
    }
