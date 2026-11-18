from functools import lru_cache
from fastapi import Depends, Header, HTTPException, status
from supabase import Client, create_client
from app.config import Settings, get_settings


@lru_cache
def get_supabase_client() -> Client:
    settings = get_settings()
    return create_client(settings.supabase_url, settings.supabase_anon_key)


@lru_cache
def get_service_role_client() -> Client:
    """Server-only client for tightly scoped MHO aggregate calculations."""
    settings = get_settings()
    if not settings.supabase_service_role_key:
        raise HTTPException(
            status_code=503,
            detail="MHO age counts require SUPABASE_SERVICE_ROLE_KEY in backend/.env",
        )
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


def get_authenticated_client(authorization: str | None = Header(default=None), settings: Settings = Depends(get_settings)) -> Client:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Bearer token required")
    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Bearer token required")
    client = create_client(settings.supabase_url, settings.supabase_anon_key)
    try:
        client.auth.get_user(token)
        client.postgrest.auth(token)
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired access token") from exc
    return client


AuthenticatedClient = Depends(get_authenticated_client)
