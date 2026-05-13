from __future__ import annotations

import base64
from datetime import UTC, datetime, timedelta
import hashlib
import hmac
import secrets

import jwt
from jwt import InvalidTokenError

from app.core.config import get_settings

PBKDF2_NAME = "pbkdf2_sha256"
PBKDF2_ITERATIONS = 600_000
SALT_BYTES = 16


def get_password_hash(password: str) -> str:
    salt = secrets.token_bytes(SALT_BYTES)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        PBKDF2_ITERATIONS,
    )
    encoded_salt = base64.b64encode(salt).decode("utf-8")
    encoded_digest = base64.b64encode(digest).decode("utf-8")
    return f"{PBKDF2_NAME}${PBKDF2_ITERATIONS}${encoded_salt}${encoded_digest}"


def verify_password(password: str, hashed_password: str | None) -> bool:
    if not hashed_password:
        return False

    try:
        algorithm, iteration_text, encoded_salt, encoded_digest = hashed_password.split("$", maxsplit=3)
    except ValueError:
        return False

    if algorithm != PBKDF2_NAME:
        return False

    iterations = int(iteration_text)
    salt = base64.b64decode(encoded_salt.encode("utf-8"))
    expected_digest = base64.b64decode(encoded_digest.encode("utf-8"))
    candidate_digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        iterations,
    )
    return hmac.compare_digest(candidate_digest, expected_digest)


def create_access_token(*, subject: str, email: str, role: str) -> str:
    settings = get_settings()
    expires_at = datetime.now(UTC) + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {
        "sub": subject,
        "email": email,
        "role": role,
        "type": "access",
        "exp": expires_at,
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict:
    settings = get_settings()
    return jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])


def is_token_invalid(token: str) -> bool:
    try:
        decode_access_token(token)
    except InvalidTokenError:
        return True
    return False
