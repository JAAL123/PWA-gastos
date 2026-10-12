import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

security = HTTPBearer()
security_dependency = Security(security)

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

API_SECRET_KEY = os.getenv("API_SECRET_KEY")
if not API_SECRET_KEY:
    raise RuntimeError("Falta configurar la variable de entorno API_SECRET_KEY.")


def verify_token(credentials: HTTPAuthorizationCredentials = security_dependency):
    token = credentials.credentials
    if token != API_SECRET_KEY:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso denegado: Token inválido o ausente."
        )
    return token