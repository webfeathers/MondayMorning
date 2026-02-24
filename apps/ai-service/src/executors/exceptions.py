"""Custom exceptions for crew execution."""


class ExecutionError(Exception):
    """Base exception for crew execution errors."""

    def __init__(self, message: str, execution_id: str | None = None, details: dict | None = None):
        """Initialize execution error.

        Args:
            message: Error message
            execution_id: ID of the execution that failed
            details: Additional error details
        """
        super().__init__(message)
        self.message = message
        self.execution_id = execution_id
        self.details = details or {}


class ValidationError(ExecutionError):
    """Exception raised when execution context validation fails."""

    pass


class ResourceExceededError(ExecutionError):
    """Exception raised when resource limits are exceeded."""

    def __init__(
        self,
        message: str,
        resource_type: str,
        limit: int | float,
        actual: int | float,
        execution_id: str | None = None,
    ):
        """Initialize resource exceeded error.

        Args:
            message: Error message
            resource_type: Type of resource exceeded (e.g., 'tokens', 'credits', 'time')
            limit: The limit that was exceeded
            actual: The actual value that exceeded the limit
            execution_id: ID of the execution
        """
        super().__init__(
            message,
            execution_id=execution_id,
            details={
                "resource_type": resource_type,
                "limit": limit,
                "actual": actual,
            },
        )
        self.resource_type = resource_type
        self.limit = limit
        self.actual = actual


class TimeoutError(ExecutionError):
    """Exception raised when execution exceeds time limit."""

    def __init__(
        self,
        message: str,
        timeout_seconds: int,
        elapsed_seconds: float,
        execution_id: str | None = None,
    ):
        """Initialize timeout error.

        Args:
            message: Error message
            timeout_seconds: The timeout limit in seconds
            elapsed_seconds: How long the execution ran
            execution_id: ID of the execution
        """
        super().__init__(
            message,
            execution_id=execution_id,
            details={
                "timeout_seconds": timeout_seconds,
                "elapsed_seconds": elapsed_seconds,
            },
        )
        self.timeout_seconds = timeout_seconds
        self.elapsed_seconds = elapsed_seconds


class CrewConfigurationError(ExecutionError):
    """Exception raised when crew configuration is invalid."""

    pass


class ContextDataError(ExecutionError):
    """Exception raised when context data is invalid or missing."""

    pass
