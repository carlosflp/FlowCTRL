import io

from minio import Minio

from app.core.config import get_settings

settings = get_settings()

MEDIA_TYPES = {
    "csv": "text/csv",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "pdf": "application/pdf",
}


def get_report_media_type(file_type: str) -> str:
    return MEDIA_TYPES.get(file_type, "application/octet-stream")


def get_minio_client() -> Minio:
    return Minio(
        settings.minio_endpoint,
        access_key=settings.minio_access_key,
        secret_key=settings.minio_secret_key,
        secure=False,
    )


def ensure_report_bucket() -> None:
    client = get_minio_client()
    if not client.bucket_exists(settings.minio_bucket):
        client.make_bucket(settings.minio_bucket)


def upload_report_content(*, object_name: str, content: bytes, file_type: str) -> str:
    ensure_report_bucket()
    client = get_minio_client()
    client.put_object(
        settings.minio_bucket,
        object_name,
        io.BytesIO(content),
        length=len(content),
        content_type=get_report_media_type(file_type),
    )
    return object_name


def download_report_content(object_name: str) -> bytes:
    client = get_minio_client()
    response = client.get_object(settings.minio_bucket, object_name)
    try:
        return response.read()
    finally:
        response.close()
        response.release_conn()
