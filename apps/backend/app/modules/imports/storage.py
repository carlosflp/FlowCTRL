import io

from app.core.config import get_settings
from app.modules.reports.storage import get_minio_client

settings = get_settings()

IMPORT_MEDIA_TYPES = {
    "csv": "text/csv",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}


def ensure_import_bucket() -> None:
    client = get_minio_client()
    if not client.bucket_exists(settings.minio_imports_bucket):
        client.make_bucket(settings.minio_imports_bucket)


def upload_import_content(*, object_name: str, content: bytes, file_type: str) -> str:
    ensure_import_bucket()
    client = get_minio_client()
    client.put_object(
        settings.minio_imports_bucket,
        object_name,
        io.BytesIO(content),
        length=len(content),
        content_type=IMPORT_MEDIA_TYPES.get(file_type, "application/octet-stream"),
    )
    return object_name


def download_import_content(object_name: str) -> bytes:
    client = get_minio_client()
    response = client.get_object(settings.minio_imports_bucket, object_name)
    try:
        return response.read()
    finally:
        response.close()
        response.release_conn()
