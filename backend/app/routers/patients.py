from datetime import date, timedelta
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from supabase import Client
from app.database import get_authenticated_client
from app.dependencies import require_facility_id
from app.schemas import PatientCreate, PatientRead, PatientUpdate
from app.services.cloudinary_service import create_private_image_url

router = APIRouter(prefix="/patients", tags=["patients"])


@router.get("/vaccinations/upcoming")
def list_upcoming_vaccinations(days: int = Query(default=30, ge=1, le=180), client: Client = Depends(get_authenticated_client), facility_id: str = Depends(require_facility_id)) -> list[dict]:
    due_before = (date.today() + timedelta(days=days)).isoformat()
    return client.table("vaccination_logs").select("id,patient_id,vaccine_name,dose_number,date_administered,next_due_date,facility_id,patients(full_name)").eq("facility_id", facility_id).gte("next_due_date", date.today().isoformat()).lte("next_due_date", due_before).order("next_due_date").execute().data


@router.get("", response_model=list[PatientRead])
def list_patients(q: str | None = Query(default=None, max_length=100), limit: int = Query(default=50, ge=1, le=100), client: Client = Depends(get_authenticated_client), facility_id: str = Depends(require_facility_id)) -> list[PatientRead]:
    query = client.table("patients").select("*").eq("barangay_id", facility_id).order("created_at", desc=True).limit(limit)
    if q:
        query = query.ilike("full_name", f"%{q}%")
    return [PatientRead.model_validate(row) for row in query.execute().data]


@router.post("", response_model=PatientRead, status_code=status.HTTP_201_CREATED)
def create_patient(payload: PatientCreate, client: Client = Depends(get_authenticated_client), facility_id: str = Depends(require_facility_id)) -> PatientRead:
    row = client.table("patients").insert({**payload.model_dump(mode="json"), "barangay_id": facility_id}).execute().data
    if not row:
        raise HTTPException(status_code=500, detail="Patient could not be created")
    return PatientRead.model_validate(row[0])


@router.get("/{patient_id}", response_model=PatientRead)
def get_patient(patient_id: UUID, client: Client = Depends(get_authenticated_client)) -> PatientRead:
    rows = client.table("patients").select("*").eq("id", str(patient_id)).limit(1).execute().data
    if not rows:
        raise HTTPException(status_code=404, detail="Patient not found or access denied")
    return PatientRead.model_validate(rows[0])


@router.get("/{patient_id}/medical-records")
def list_medical_records(patient_id: UUID, client: Client = Depends(get_authenticated_client)) -> list[dict]:
    """Database RLS grants origin-facility access or a valid dual-consent share."""
    return client.table("medical_records").select("id,patient_id,visit_date,diagnosis,treatment,notes,originating_facility_id,created_at").eq("patient_id", str(patient_id)).order("visit_date", desc=True).execute().data


@router.get("/{patient_id}/vaccinations")
def list_vaccinations(patient_id: UUID, client: Client = Depends(get_authenticated_client)) -> list[dict]:
    return client.table("vaccination_logs").select("id,patient_id,vaccine_name,dose_number,date_administered,next_due_date,facility_id").eq("patient_id", str(patient_id)).order("date_administered", desc=True).execute().data


@router.get("/{patient_id}/diagnostic-images")
def list_diagnostic_images(patient_id: UUID, client: Client = Depends(get_authenticated_client)) -> list[dict]:
    rows = client.table("diagnostic_images").select("id,cloudinary_public_id,image_format,uploaded_at,facility_id").eq("patient_id", str(patient_id)).order("uploaded_at", desc=True).execute().data
    return [{"id": row["id"], "image_url": create_private_image_url(row["cloudinary_public_id"], row["image_format"]), "uploaded_at": row["uploaded_at"], "facility_id": row["facility_id"]} for row in rows]


@router.patch("/{patient_id}", response_model=PatientRead)
def update_patient(patient_id: UUID, payload: PatientUpdate, client: Client = Depends(get_authenticated_client), facility_id: str = Depends(require_facility_id)) -> PatientRead:
    changes = payload.model_dump(exclude_unset=True, mode="json")
    if not changes:
        raise HTTPException(status_code=400, detail="At least one field must be provided")
    rows = client.table("patients").update(changes).eq("id", str(patient_id)).eq("barangay_id", facility_id).execute().data
    if not rows:
        raise HTTPException(status_code=404, detail="Patient not found or access denied")
    return PatientRead.model_validate(rows[0])
