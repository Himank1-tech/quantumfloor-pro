"""
Security Engine: JWT Management, Bcrypt Password Hashing, and Fernet Vault Encryption.
"""

from typing import Optional, Dict, Any
from datetime import datetime, timedelta, timezone
import base64
import hashlib
import os
import bcrypt
import jwt
from cryptography.fernet import Fernet
from .models import TokenData, UserRole

# Secret configurations
JWT_SECRET_KEY = (
    os.environ.get("JWT_SECRET")
    or os.environ.get("JWT_SECRET_KEY")
    or "quantum_floor_institutional_secret_key_2026_x89f_secure"
)
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours

# Fernet Vault Encryption Key (accept explicit FERNET_KEY or derive from JWT secret)
_custom_fernet = os.environ.get("FERNET_KEY")
if _custom_fernet:
    try:
        _cipher_suite = Fernet(_custom_fernet.strip().encode("utf-8") if isinstance(_custom_fernet, str) else _custom_fernet)
    except Exception:
        _master_vault_key = hashlib.sha256(JWT_SECRET_KEY.encode()).digest()
        _fernet_key = base64.urlsafe_b64encode(_master_vault_key)
        _cipher_suite = Fernet(_fernet_key)
else:
    _master_vault_key = hashlib.sha256(JWT_SECRET_KEY.encode()).digest()
    _fernet_key = base64.urlsafe_b64encode(_master_vault_key)
    _cipher_suite = Fernet(_fernet_key)


def hash_password(password: str) -> str:
    """Hash plaintext password with bcrypt salt."""
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against bcrypt hash."""
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False


def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Create signed HS256 JWT access token."""
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({"exp": expire, "iat": now})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    return encoded_jwt


def verify_access_token(token: str) -> Optional[TokenData]:
    """Decode and validate JWT access token."""
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        user_id: str = payload.get("sub")
        username: str = payload.get("username")
        role: str = payload.get("role")
        if user_id is None or username is None:
            return None
        return TokenData(user_id=user_id, username=username, role=role)
    except jwt.PyJWTError:
        return None


def encrypt_secret(plain_text: str) -> str:
    """Encrypt sensitive broker keys using AES-128-CBC Fernet symmetric encryption."""
    if not plain_text:
        return ""
    encrypted_bytes = _cipher_suite.encrypt(plain_text.encode("utf-8"))
    return encrypted_bytes.decode("utf-8")


def decrypt_secret(cipher_text: str) -> str:
    """Decrypt encrypted broker key."""
    if not cipher_text:
        return ""
    decrypted_bytes = _cipher_suite.decrypt(cipher_text.encode("utf-8"))
    return decrypted_bytes.decode("utf-8")


def mask_secret(secret: str) -> str:
    """Mask key showing only first 4 and last 3 chars."""
    if not secret:
        return "••••••••"
    if len(secret) <= 8:
        return "••••••••"
    return f"{secret[:4]}••••••••{secret[-3:]}"
