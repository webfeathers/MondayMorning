"""Configuration settings for the AI service."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Service
    service_name: str = "wf-ai-service"
    service_version: str = "0.0.1"
    api_prefix: str = "/api/v1"
    port: int = 8000
    host: str = "0.0.0.0"
    environment: str = "development"

    # OpenAI (for CrewAI)
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"

    # Security
    api_key: str = ""  # Optional API key for service-to-service auth

    # Observability
    log_level: str = "INFO"
    sentry_dsn: str = ""

    # Execution limits
    max_execution_time_seconds: int = 300
    max_context_tokens: int = 100000


settings = Settings()
