"""Executor interfaces and implementations for AI crews."""

from src.executors.crewai_executor import CrewAIExecutor
from src.executors.exceptions import (
    ContextDataError,
    CrewConfigurationError,
    ExecutionError,
    ResourceExceededError,
    TimeoutError,
    ValidationError,
)
from src.executors.protocol import (
    CrewExecutor,
    ExecutionContext,
    ExecutionResult,
    ExecutionStatus,
    TokenUsage,
)

__all__ = [
    # Protocol and models
    "CrewExecutor",
    "ExecutionContext",
    "ExecutionResult",
    "ExecutionStatus",
    "TokenUsage",
    # Implementations
    "CrewAIExecutor",
    # Exceptions
    "ExecutionError",
    "ValidationError",
    "ResourceExceededError",
    "TimeoutError",
    "CrewConfigurationError",
    "ContextDataError",
]
