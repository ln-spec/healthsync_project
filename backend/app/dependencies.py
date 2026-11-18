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
        if app_metadata.get("facility_role") == "municipal_admin":
            raise HTTPException(status_code=403, detail="Municipal accounts cannot access facility records")
        facility_id = app_metadata.get("facility_id")
        if not facility_id:
            raise HTTPException(status_code=403, detail="User has no facility assignment")
        return str(facility_id)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Unable to verify user identity") from exc


def require_municipality_id(client: Client = Depends(get_authenticated_client), authorization: str | None = Header(default=None)) -> str:
    """Allow the MHO API only for a verified municipal account."""
    try:
        token = authorization.split(" ", 1)[1].strip() if authorization and authorization.lower().startswith("bearer ") else ""
        if not token:
            raise HTTPException(status_code=401, detail="Bearer token required")
        user = client.auth.get_user(token)
        claims = getattr(user, "user", None)
        app_metadata = getattr(claims, "app_metadata", {}) or {}
        municipality_id = app_metadata.get("municipality_id")
        if app_metadata.get("facility_role") != "municipal_admin" or not municipality_id:
            raise HTTPException(status_code=403, detail="Municipal health office access is required")
        return str(municipality_id)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Unable to verify user identity") from exc
