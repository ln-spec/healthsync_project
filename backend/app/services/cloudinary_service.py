from io import BytesIO
from time import time
from typing import Any
import cloudinary
import cloudinary.uploader
import cloudinary.utils
from app.config import get_settings


def upload_diagnostic_image(content: bytes, filename: str) -> dict[str, str]:
    settings = get_settings()
    if not all((settings.cloudinary_cloud_name, settings.cloudinary_api_key, settings.cloudinary_api_secret)):
        raise RuntimeError("Cloudinary is not configured")
    if len(content) > settings.max_upload_bytes:
        raise ValueError(f"Image exceeds maximum size of {settings.max_upload_bytes} bytes")
    cloudinary.config(cloud_name=settings.cloudinary_cloud_name, api_key=settings.cloudinary_api_key, api_secret=settings.cloudinary_api_secret, secure=True)
    result: dict[str, Any] = cloudinary.uploader.upload(BytesIO(content), resource_type="image", type="private", folder="healthsync/diagnostics", public_id=None, overwrite=False, filename_override=filename)
    return {"url": str(result["secure_url"]), "public_id": str(result["public_id"]), "format": str(result["format"])}


def create_private_image_url(public_id: str, image_format: str) -> str:
    """Generate a time-limited URL; call only after database RLS authorized the image row."""
    settings = get_settings()
    if not all((settings.cloudinary_cloud_name, settings.cloudinary_api_key, settings.cloudinary_api_secret)):
        raise RuntimeError("Cloudinary is not configured")
    cloudinary.config(cloud_name=settings.cloudinary_cloud_name, api_key=settings.cloudinary_api_key, api_secret=settings.cloudinary_api_secret, secure=True)
    return str(cloudinary.utils.private_download_url(public_id, image_format, expires_at=int(time()) + 300, attachment=False))
