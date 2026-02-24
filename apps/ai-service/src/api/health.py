"""Health check endpoints."""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter
from pydantic import BaseModel

from src.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()


class HealthResponse(BaseModel):
    """Health check response model."""

    status: str
    service: str
    version: str
    timestamp: str
    environment: str


@router.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """
    Health check endpoint.

    Returns service status and metadata.
    """
    return HealthResponse(
        status="healthy",
        service=settings.service_name,
        version=settings.service_version,
        timestamp=datetime.now(timezone.utc).isoformat(),
        environment=settings.environment,
    )


@router.get("/health/ready", response_model=HealthResponse)
async def readiness_check() -> HealthResponse:
    """
    Readiness check endpoint.

    Used by orchestrators to determine if the service is ready to accept traffic.
    """
    # TODO: Add checks for:
    # - OpenAI API connectivity
    # - Required environment variables
    # - Any other dependencies

    return HealthResponse(
        status="ready",
        service=settings.service_name,
        version=settings.service_version,
        timestamp=datetime.now(timezone.utc).isoformat(),
        environment=settings.environment,
    )


@router.get("/health/live", response_model=HealthResponse)
async def liveness_check() -> HealthResponse:
    """
    Liveness check endpoint.

    Used by orchestrators to determine if the service is alive.
    """
    return HealthResponse(
        status="alive",
        service=settings.service_name,
        version=settings.service_version,
        timestamp=datetime.now(timezone.utc).isoformat(),
        environment=settings.environment,
    )
