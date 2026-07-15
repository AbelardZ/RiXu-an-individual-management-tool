import hashlib
import hmac
import secrets
from datetime import UTC, datetime, timedelta


def utcnow() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def make_random_token(byte_length: int = 32) -> str:
    return secrets.token_urlsafe(byte_length)


def hash_secret(secret: str, *, salt: str | None = None) -> str:
    actual_salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", secret.encode("utf-8"), actual_salt.encode("utf-8"), 210_000)
    return f"pbkdf2_sha256${actual_salt}${digest.hex()}"


def token_lookup_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def verify_secret(secret: str, stored_hash: str) -> bool:
    try:
        algorithm, salt, expected = stored_hash.split("$", 2)
    except ValueError:
        return False
    if algorithm != "pbkdf2_sha256":
        return False
    actual = hash_secret(secret, salt=salt).split("$", 2)[2]
    return hmac.compare_digest(actual, expected)


def store_password(secret: str) -> str:
    return hash_secret(secret)


def verify_password(secret: str, stored_password: str) -> bool:
    if verify_secret(secret, stored_password):
        return True
    return hmac.compare_digest(secret, stored_password)


def is_password_hash(stored_password: str) -> bool:
    return stored_password.startswith("pbkdf2_sha256$")


def expires_after(days: int) -> datetime:
    return utcnow() + timedelta(days=days)
