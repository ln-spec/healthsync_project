import logging
from typing import Any

from supabase import Client

logger = logging.getLogger(__name__)


class DiagnosisOptionsError(RuntimeError):
    """Raised when diagnosis options cannot be read from Supabase."""


def get_active_diagnosis_options(client: Client) -> list[dict[str, Any]]:
    """Return active diagnosis labels ordered for the checkup dropdown."""
    try:
        response = (
            client.table("diagnosis_options")
            .select("id,diagnosis_name")
            .eq("is_active", True)
            .order("sort_order")
            .execute()
        )
        return response.data
    except Exception as exc:
        logger.exception("Unable to retrieve active diagnosis options from Supabase")
        raise DiagnosisOptionsError("Diagnosis options could not be retrieved") from exc
