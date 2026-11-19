from datetime import date, datetime, timedelta, timezone

from supabase import Client

AGE_GROUPS = ("Infant", "Toddler", "Child", "Teen", "Adult", "Senior")
MANILA = timezone(timedelta(hours=8), name="Asia/Manila")
PAGE_SIZE = 1000


def _age_group(dob_value: str | date, today: date) -> str | None:
    dob = dob_value if isinstance(dob_value, date) else date.fromisoformat(dob_value[:10])
    age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
    if age < 0:
        return None
    if age < 2:
        return "Infant"
    if age <= 3:
        return "Toddler"
    if age <= 12:
        return "Child"
    if age <= 17:
        return "Teen"
    if age <= 59:
        return "Adult"
    return "Senior"


def get_municipal_patient_counts(client: Client, municipality_id: str) -> dict[str, object]:
    """Aggregate patient counts for active barangays in one verified municipality.

    The service-role client is used only after the request's MHO identity is checked.
    Patient DOBs stay in the backend and are never returned by this function.
    """
    try:
        barangays = (
            client.table("barangays")
            .select("facility_id,barangay_name")
            .eq("municipality_id", municipality_id)
            .eq("is_active", True)
            .execute()
            .data
        ) or []
        barangay_names = {str(row["facility_id"]): row["barangay_name"] for row in barangays}
        facility_ids = list(barangay_names)
        counts = {group: 0 for group in AGE_GROUPS}
        barangay_counts = {facility_id: 0 for facility_id in facility_ids}
        if not facility_ids:
            return {
                "total": 0,
                "by_age_group": [{"type": group, "count": 0} for group in AGE_GROUPS],
                "by_barangay": [],
            }

        today = datetime.now(MANILA).date()
        offset = 0
        total = 0
        while True:
            patients = (
                client.table("patients")
                .select("barangay_id,dob")
                .in_("barangay_id", facility_ids)
                .range(offset, offset + PAGE_SIZE - 1)
                .execute()
                .data
            ) or []
            for patient in patients:
                total += 1
                barangay_id = str(patient["barangay_id"])
                barangay_counts[barangay_id] = barangay_counts.get(barangay_id, 0) + 1
                group = _age_group(patient["dob"], today)
                if group is not None:
                    counts[group] += 1
            if len(patients) < PAGE_SIZE:
                break
            offset += PAGE_SIZE

        return {
            "total": total,
            "by_age_group": [{"type": group, "count": counts[group]} for group in AGE_GROUPS],
            "by_barangay": [
                {
                    "facility_id": facility_id,
                    "barangay_name": barangay_names[facility_id],
                    "count": barangay_counts[facility_id],
                }
                for facility_id in sorted(facility_ids, key=lambda key: barangay_names[key].casefold())
            ],
        }
    except Exception as exc:
        raise RuntimeError("Could not calculate municipality age groups") from exc
