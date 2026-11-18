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


def get_municipal_age_groups(client: Client, municipality_id: str) -> list[dict[str, int | str]]:
    """Aggregate ages for active barangays assigned to one verified municipality.

    The service-role client is used only after the request's MHO identity is checked.
    Patient DOBs stay in the backend and are never returned by this function.
    """
    try:
        barangays = (
            client.table("barangays")
            .select("facility_id")
            .eq("municipality_id", municipality_id)
            .eq("is_active", True)
            .execute()
            .data
        ) or []
        facility_ids = list(dict.fromkeys(row["facility_id"] for row in barangays))
        counts = {group: 0 for group in AGE_GROUPS}
        if not facility_ids:
            return [{"type": group, "count": 0} for group in AGE_GROUPS]

        today = datetime.now(MANILA).date()
        offset = 0
        while True:
            patients = (
                client.table("patients")
                .select("dob")
                .in_("barangay_id", facility_ids)
                .range(offset, offset + PAGE_SIZE - 1)
                .execute()
                .data
            ) or []
            for patient in patients:
                group = _age_group(patient["dob"], today)
                if group is not None:
                    counts[group] += 1
            if len(patients) < PAGE_SIZE:
                break
            offset += PAGE_SIZE

        return [{"type": group, "count": counts[group]} for group in AGE_GROUPS]
    except Exception as exc:
        raise RuntimeError("Could not calculate municipality age groups") from exc
