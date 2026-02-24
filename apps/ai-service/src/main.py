"""Main FastAPI application for AI crew execution service."""

import logging
import logging.config
import os
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import structlog
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration

from src.api.health import router as health_router
from src.api.executions import router as executions_router
from src.core.config import settings

# Initialize Sentry
if os.getenv("SENTRY_DSN") and os.getenv("SENTRY_ENABLED") == "true":
    sentry_sdk.init(
        dsn=os.getenv("SENTRY_DSN"),
        environment=os.getenv("SENTRY_ENVIRONMENT", settings.environment),
        release=os.getenv("SENTRY_RELEASE"),
        traces_sample_rate=float(os.getenv("SENTRY_TRACES_SAMPLE_RATE", "0.1")),
        profiles_sample_rate=float(os.getenv("SENTRY_PROFILES_SAMPLE_RATE", "0.1")),
        integrations=[
            FastApiIntegration(transaction_style="endpoint"),
            StarletteIntegration(transaction_style="endpoint"),
        ],
    )

# Configure structured logging with structlog
logging.config.dictConfig({
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "json": {
            "()": structlog.stdlib.ProcessorFormatter,
            "processor": structlog.processors.JSONRenderer(),
        },
    },
    "handlers": {
        "default": {
            "class": "logging.StreamHandler",
            "formatter": "json",
        },
    },
    "root": {
        "handlers": ["default"],
        "level": settings.log_level,
    },
})

structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
    ],
    logger_factory=structlog.stdlib.LoggerFactory(),
    wrapper_class=structlog.stdlib.BoundLogger,
    context_class=dict,
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Lifespan context manager for startup and shutdown events."""
    logger.info(
        "Starting AI service",
        service_name=settings.service_name,
        version=settings.service_version,
        environment=settings.environment,
        api_prefix=settings.api_prefix,
    )

    # Startup
    yield

    # Shutdown
    logger.info("Shutting down AI service")


# Create FastAPI app
app = FastAPI(
    title="WF AI Service",
    description="AI crew execution service for multi-tenant SaaS platform",
    version=settings.service_version,
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # TODO: Configure based on environment
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Logging middleware for trace IDs and tenant context
@app.middleware("http")
async def logging_middleware(request: Request, call_next):
    """Add trace ID and tenant context to all logs and Sentry."""
    # Extract context from headers
    trace_id = request.headers.get("x-trace-id")
    tenant_id = request.headers.get("x-tenant-id")
    user_id = request.headers.get("x-user-id")

    # Bind context to structlog for this request
    structlog.contextvars.clear_contextvars()
    if trace_id:
        structlog.contextvars.bind_contextvars(trace_id=trace_id)
        sentry_sdk.set_tag("trace_id", trace_id)
    if tenant_id:
        structlog.contextvars.bind_contextvars(tenant_id=tenant_id)
        sentry_sdk.set_tag("tenant_id", tenant_id)
        sentry_sdk.set_context("tenant", {"id": tenant_id})
    if user_id:
        structlog.contextvars.bind_contextvars(user_id=user_id)
        sentry_sdk.set_user({"id": user_id})

    # Log request
    logger.info(
        "HTTP request",
        method=request.method,
        path=request.url.path,
        client_host=request.client.host if request.client else None,
    )

    # Process request
    response = await call_next(request)

    # Log response
    logger.info(
        "HTTP response",
        method=request.method,
        path=request.url.path,
        status_code=response.status_code,
    )

    return response


# Include routers
app.include_router(health_router, prefix=settings.api_prefix, tags=["health"])
app.include_router(executions_router, prefix=f"{settings.api_prefix}/crews", tags=["executions"])


@app.get("/")
async def root() -> dict[str, str]:
    """Root endpoint."""
    return {
        "service": settings.service_name,
        "version": settings.service_version,
        "status": "running",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "src.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.environment == "development",
        log_level=settings.log_level.lower(),
    )
