from collections import Counter
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from supabase import Client

from app.database import get_authenticated_client
from app.dependencies import require_facility_id

router = APIRouter(prefix="/analytics", tags=["analytics"])


def _visit_datetime(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


@router.get("/visits/today")
def count_visits_today(
    client: Client = Depends(get_authenticated_client),
    facility_id: str = Depends(require_facility_id),
) -> dict:
    """Count visit records dated today in Manila for the current facility."""
    local_zone = timezone(timedelta(hours=8), name="Asia/Manila")
    today = datetime.now(local_zone).date()
    start = datetime.combine(today, datetime.min.time(), tzinfo=local_zone)
    end = start + timedelta(days=1)
    result = (
        client.table("medical_records")
        .select("id", count="exact")
        .eq("originating_facility_id", facility_id)
        .gte("visit_date", start.isoformat())
        .lt("visit_date", end.isoformat())
        .execute()
    )
    return {"date": today.isoformat(), "count": result.count if result.count is not None else len(result.data)}


@router.get("/public-health")
def public_health_analytics(
    days: int = Query(default=30, ge=7, le=90),
    client: Client = Depends(get_authenticated_client),
    facility_id: str = Depends(require_facility_id),
) -> dict:
    """Return facility-scoped visit trends for review, not automated outbreak diagnosis."""
    # Manila uses UTC+8 year-round. A fixed offset avoids requiring an OS
    # timezone database, which is often absent in Windows Python installs.
    local_zone = timezone(timedelta(hours=8), name="Asia/Manila")
    now = datetime.now(local_zone)
    current_start = now - timedelta(days=days)
    previous_start = now - timedelta(days=days * 2)
    rows = (
        client.table("medical_records")
        .select("id,patient_id,visit_date,diagnosis,patients(full_name)")
        .eq("originating_facility_id", facility_id)
        .gte("visit_date", previous_start.isoformat())
        .lt("visit_date", now.isoformat())
        .order("visit_date", desc=True)
        .limit(5000)
        .execute()
        .data
    )

    current_rows: list[dict] = []
    previous_rows: list[dict] = []
    current_diagnoses: Counter[str] = Counter()
    previous_diagnoses: Counter[str] = Counter()
    current_patients: set[str] = set()
    previous_patients: set[str] = set()
    weekly_counts: Counter[str] = Counter()
    recent_visits: list[dict] = []
    visits_today = 0

    for row in rows:
        visit_at = _visit_datetime(row["visit_date"])
        diagnosis = (row.get("diagnosis") or "").strip() or "Unspecified"
        patient_id = str(row["patient_id"])
        patient = row.get("patients")
        if isinstance(patient, list):
            patient = patient[0] if patient else None
        patient_name = patient.get("full_name") if isinstance(patient, dict) else "Patient"
        if visit_at >= current_start:
            current_rows.append(row)
            current_diagnoses[diagnosis] += 1
            current_patients.add(patient_id)
            if visit_at.astimezone(local_zone).date() == now.date():
                visits_today += 1
            local_visit_at = visit_at.astimezone(local_zone)
            week_start = local_visit_at.date() - timedelta(days=local_visit_at.weekday())
            weekly_counts[week_start.isoformat()] += 1
            if len(recent_visits) < 10:
                recent_visits.append({
                    "id": row["id"],
                    "patient_id": patient_id,
                    "patient_name": patient_name,
                    "visit_date": row["visit_date"],
                    "diagnosis": diagnosis,
                })
        else:
            previous_rows.append(row)
            previous_diagnoses[diagnosis] += 1
            previous_patients.add(patient_id)

    all_diagnoses = []
    for name, count in current_diagnoses.most_common(10):
        prior = previous_diagnoses[name]
        change_percent = round(((count - prior) / prior) * 100) if prior else None
        all_diagnoses.append({"name": name, "count": count, "previous_count": prior, "change_percent": change_percent})

    increased_reports = []
    for name, count in current_diagnoses.items():
        prior = previous_diagnoses[name]
        if count >= 3 and count >= max(2 * prior, prior + 3):
            increased_reports.append({
                "name": name,
                "count": count,
                "previous_count": prior,
                "change_percent": round(((count - prior) / prior) * 100) if prior else None,
            })
    diagnoses = all_diagnoses[:10]
    first_week = current_start.date() - timedelta(days=current_start.weekday())
    final_week = now.date() - timedelta(days=now.weekday())
    weeks = []
    week_date = first_week
    while week_date <= final_week:
        week_key = week_date.isoformat()
        weeks.append({"week_start": week_key, "count": weekly_counts[week_key]})
        week_date += timedelta(days=7)

    return {
        "period_days": days,
        "current_visits": len(current_rows),
        "visits_today": visits_today,
        "previous_visits": len(previous_rows),
        "unique_patients": len(current_patients),
        "previous_unique_patients": len(previous_patients),
        "diagnosis_categories": len(current_diagnoses),
        "diagnoses": diagnoses,
        "increased_reports": increased_reports,
        "weekly_visits": weeks,
        "recent_visits": recent_visits,
        "record_limit_reached": len(rows) == 5000,
    }
