from fastapi import Depends, Header, HTTPException
from supabase import Client
from app.database import get_authenticated_client


def require_facility_id(client: Client = Depends(get_authenticated_client), authorization: str | None = Header(default=None)) -> str:
    """Require a verified facility claim; never trust a facility ID supplied by a client."""
    try:
        token = authorization.split(" ", 1)[1].strip() if authorization and authorization.lower().startswith("bearer ") else ""
        if not token:
            raise HTTPException(status_code=401, detail="Bearer token required")
        user = client.auth.get_user(token)
        claims = getattr(user, "user", None)
        app_metadata = getattr(claims, "app_metadata", {}) or {}
        facility_id = app_metadata.get("facility_id")
        if not facility_id:
            raise HTTPException(status_code=403, detail="User has no facility assignment")
        return str(facility_id)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Unable to verify user identity") from exc
