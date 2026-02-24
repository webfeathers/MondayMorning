"""Protocol definition for crew executors.

This module defines the abstract interface that all crew executors must implement.
Different execution engines (CrewAI, LangChain, etc.) can implement this protocol.
"""

from datetime import datetime
from enum import Enum
from typing import Any, Protocol, runtime_checkable

from pydantic import BaseModel, Field


class ExecutionStatus(str, Enum):
    """Status of crew execution."""

    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class ExecutionContext(BaseModel):
    """Context data passed to crew execution.

    This contains all the normalized CRM data and configuration
    needed for the crew to perform its analysis.
    """

    # Execution metadata
    execution_id: str = Field(description="Unique identifier for this execution")
    tenant_id: str = Field(description="Tenant this execution belongs to")
    crew_template_id: str = Field(description="Template used for this crew")
    user_id: str = Field(description="User who initiated this execution")

    # Crew configuration
    crew_config: dict[str, Any] = Field(
        description="Crew-specific configuration (prompts, agents, etc.)"
    )

    # Input data (normalized CRM data)
    context_data: dict[str, Any] = Field(
        description="Normalized CRM data for analysis (accounts, contacts, deals, etc.)"
    )

    # Resource limits
    max_tokens: int = Field(default=100000, description="Maximum context tokens allowed")
    max_execution_time_seconds: int = Field(
        default=300, description="Maximum execution time in seconds"
    )
    credit_budget: int = Field(default=100, description="Credit budget for this execution")

    # Optional metadata
    metadata: dict[str, Any] = Field(default_factory=dict, description="Additional metadata")


class TokenUsage(BaseModel):
    """Token usage metrics for an execution."""

    prompt_tokens: int = Field(description="Tokens used in prompt")
    completion_tokens: int = Field(description="Tokens used in completion")
    total_tokens: int = Field(description="Total tokens used")


class ExecutionResult(BaseModel):
    """Result of crew execution."""

    # Execution metadata
    execution_id: str = Field(description="Unique identifier for this execution")
    status: ExecutionStatus = Field(description="Final status of execution")
    started_at: datetime = Field(description="When execution started")
    completed_at: datetime | None = Field(None, description="When execution completed")

    # Output data
    result: dict[str, Any] = Field(
        default_factory=dict, description="Structured analysis results"
    )
    raw_output: str = Field(default="", description="Raw text output from crew")

    # Usage metrics
    token_usage: TokenUsage | None = Field(None, description="Token usage metrics")
    credits_consumed: int = Field(default=0, description="Credits consumed")
    execution_time_seconds: float = Field(default=0.0, description="Execution time in seconds")

    # Error information (if failed)
    error_message: str | None = Field(None, description="Error message if execution failed")
    error_details: dict[str, Any] = Field(
        default_factory=dict, description="Additional error details"
    )

    # Model information
    model_name: str | None = Field(None, description="Model used for execution")
    model_version: str | None = Field(None, description="Model version")

    # Additional metadata
    metadata: dict[str, Any] = Field(default_factory=dict, description="Additional metadata")


@runtime_checkable
class CrewExecutor(Protocol):
    """Protocol for crew execution engines.

    This defines the interface that all crew executors must implement,
    regardless of the underlying AI framework (CrewAI, LangChain, etc.).
    """

    async def execute(self, context: ExecutionContext) -> ExecutionResult:
        """Execute a crew with the given context.

        Args:
            context: Execution context containing crew configuration and input data

        Returns:
            ExecutionResult containing the analysis results and metrics

        Raises:
            ExecutionError: If execution fails
            TimeoutError: If execution exceeds time limit
            ResourceExceededError: If token or credit limits are exceeded
        """
        ...

    async def validate_context(self, context: ExecutionContext) -> tuple[bool, str | None]:
        """Validate execution context before running.

        Performs pre-execution checks:
        - Token estimation vs limits
        - Required data availability
        - Crew configuration validity

        Args:
            context: Execution context to validate

        Returns:
            Tuple of (is_valid, error_message)
            - is_valid: True if context is valid
            - error_message: None if valid, error description if invalid
        """
        ...

    async def estimate_cost(self, context: ExecutionContext) -> dict[str, Any]:
        """Estimate execution cost before running.

        Args:
            context: Execution context to estimate cost for

        Returns:
            Dictionary containing:
            - estimated_tokens: Estimated token usage
            - estimated_credits: Estimated credit consumption
            - estimated_time_seconds: Estimated execution time
            - confidence: Confidence level of estimates (0.0-1.0)
        """
        ...

    async def cancel_execution(self, execution_id: str) -> bool:
        """Attempt to cancel a running execution.

        Args:
            execution_id: ID of the execution to cancel

        Returns:
            True if cancellation was successful or execution was already complete,
            False if cancellation failed
        """
        ...

    def get_supported_crews(self) -> list[str]:
        """Get list of crew types this executor supports.

        Returns:
            List of crew type identifiers (e.g., ['account_health', 'deal_analysis'])
        """
        ...
