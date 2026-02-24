"""CrewAI implementation of the CrewExecutor protocol."""

import asyncio
import logging
import time
from datetime import datetime, timezone
from typing import Any

from crewai import Agent, Crew, Process, Task

from src.core.config import settings
from src.executors.exceptions import (
    ContextDataError,
    CrewConfigurationError,
    ExecutionError,
    ResourceExceededError,
    TimeoutError as CustomTimeoutError,
    ValidationError,
)
from src.executors.protocol import (
    ExecutionContext,
    ExecutionResult,
    ExecutionStatus,
    TokenUsage,
)

logger = logging.getLogger(__name__)


class CrewAIExecutor:
    """CrewAI implementation of the CrewExecutor protocol.

    This executor wraps the CrewAI library and implements the standard
    CrewExecutor interface for consistent execution across the platform.
    """

    def __init__(self) -> None:
        """Initialize the CrewAI executor."""
        self._running_executions: dict[str, asyncio.Task[Any]] = {}
        self._supported_crews = ["account_health", "deal_analysis", "ticket_analysis"]

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
        execution_id = context.execution_id
        started_at = datetime.now(timezone.utc)

        logger.info(f"Starting crew execution: {execution_id}")

        try:
            # Validate context before execution
            is_valid, error_msg = await self.validate_context(context)
            if not is_valid:
                raise ValidationError(
                    error_msg or "Context validation failed",
                    execution_id=execution_id,
                )

            # Build crew from configuration
            crew = self._build_crew(context)

            # Execute with timeout
            try:
                result_data = await asyncio.wait_for(
                    self._execute_crew(crew, context),
                    timeout=context.max_execution_time_seconds,
                )
            except asyncio.TimeoutError:
                elapsed = (datetime.now(timezone.utc) - started_at).total_seconds()
                raise CustomTimeoutError(
                    f"Execution exceeded time limit of {context.max_execution_time_seconds}s",
                    timeout_seconds=context.max_execution_time_seconds,
                    elapsed_seconds=elapsed,
                    execution_id=execution_id,
                )

            completed_at = datetime.now(timezone.utc)
            execution_time = (completed_at - started_at).total_seconds()

            # Extract token usage from result
            token_usage = self._extract_token_usage(result_data)

            # Calculate credits consumed (simplified: 1 credit per 1000 tokens)
            credits_consumed = 0
            if token_usage:
                credits_consumed = max(1, token_usage.total_tokens // 1000)

            # Check if credits exceeded budget
            if credits_consumed > context.credit_budget:
                raise ResourceExceededError(
                    f"Execution consumed {credits_consumed} credits, "
                    f"exceeding budget of {context.credit_budget}",
                    resource_type="credits",
                    limit=context.credit_budget,
                    actual=credits_consumed,
                    execution_id=execution_id,
                )

            logger.info(
                f"Crew execution completed: {execution_id} "
                f"(time: {execution_time:.2f}s, credits: {credits_consumed})"
            )

            return ExecutionResult(
                execution_id=execution_id,
                status=ExecutionStatus.COMPLETED,
                started_at=started_at,
                completed_at=completed_at,
                result=result_data.get("structured_output", {}),
                raw_output=result_data.get("raw_output", ""),
                token_usage=token_usage,
                credits_consumed=credits_consumed,
                execution_time_seconds=execution_time,
                model_name=settings.openai_model,
                metadata={
                    "crew_template_id": context.crew_template_id,
                    "tenant_id": context.tenant_id,
                },
            )

        except (ValidationError, CustomTimeoutError, ResourceExceededError):
            # Re-raise custom exceptions
            raise
        except Exception as e:
            logger.exception(f"Crew execution failed: {execution_id}")
            completed_at = datetime.now(timezone.utc)
            execution_time = (completed_at - started_at).total_seconds()

            return ExecutionResult(
                execution_id=execution_id,
                status=ExecutionStatus.FAILED,
                started_at=started_at,
                completed_at=completed_at,
                error_message=str(e),
                error_details={"error_type": type(e).__name__},
                execution_time_seconds=execution_time,
            )

    async def validate_context(self, context: ExecutionContext) -> tuple[bool, str | None]:
        """Validate execution context before running.

        Args:
            context: Execution context to validate

        Returns:
            Tuple of (is_valid, error_message)
        """
        # Check crew template is supported
        if context.crew_template_id not in self._supported_crews:
            return False, f"Unsupported crew template: {context.crew_template_id}"

        # Check required crew config fields
        if not context.crew_config:
            return False, "Crew configuration is required"

        # Check context data is present
        if not context.context_data:
            return False, "Context data is required"

        # Estimate tokens and check against limit
        estimated_tokens = await self._estimate_tokens(context)
        if estimated_tokens > context.max_tokens:
            return False, (
                f"Estimated tokens ({estimated_tokens}) "
                f"exceeds limit ({context.max_tokens})"
            )

        return True, None

    async def estimate_cost(self, context: ExecutionContext) -> dict[str, Any]:
        """Estimate execution cost before running.

        Args:
            context: Execution context to estimate cost for

        Returns:
            Dictionary containing cost estimates
        """
        estimated_tokens = await self._estimate_tokens(context)
        estimated_credits = max(1, estimated_tokens // 1000)

        # Rough time estimate based on token count
        # Assume ~500 tokens/second for generation
        estimated_time = max(5.0, estimated_tokens / 500.0)

        return {
            "estimated_tokens": estimated_tokens,
            "estimated_credits": estimated_credits,
            "estimated_time_seconds": estimated_time,
            "confidence": 0.7,  # Medium confidence on estimates
        }

    async def cancel_execution(self, execution_id: str) -> bool:
        """Attempt to cancel a running execution.

        Args:
            execution_id: ID of the execution to cancel

        Returns:
            True if cancellation was successful
        """
        if execution_id in self._running_executions:
            task = self._running_executions[execution_id]
            task.cancel()
            del self._running_executions[execution_id]
            logger.info(f"Cancelled execution: {execution_id}")
            return True
        return False

    def get_supported_crews(self) -> list[str]:
        """Get list of crew types this executor supports.

        Returns:
            List of supported crew type identifiers
        """
        return self._supported_crews.copy()

    def _build_crew(self, context: ExecutionContext) -> Crew:
        """Build a CrewAI Crew from the execution context.

        Args:
            context: Execution context

        Returns:
            Configured Crew instance

        Raises:
            CrewConfigurationError: If crew configuration is invalid
        """
        try:
            crew_config = context.crew_config

            # Extract agents configuration
            agents_config = crew_config.get("agents", [])
            if not agents_config:
                raise CrewConfigurationError(
                    "No agents defined in crew configuration",
                    execution_id=context.execution_id,
                )

            # Build agents
            agents = []
            for agent_config in agents_config:
                agent = Agent(
                    role=agent_config.get("role", "Analyst"),
                    goal=agent_config.get("goal", "Analyze data"),
                    backstory=agent_config.get("backstory", ""),
                    verbose=agent_config.get("verbose", False),
                    allow_delegation=agent_config.get("allow_delegation", False),
                )
                agents.append(agent)

            # Extract tasks configuration
            tasks_config = crew_config.get("tasks", [])
            if not tasks_config:
                raise CrewConfigurationError(
                    "No tasks defined in crew configuration",
                    execution_id=context.execution_id,
                )

            # Build tasks
            tasks = []
            for i, task_config in enumerate(tasks_config):
                # Get assigned agent (default to first agent if not specified)
                agent_index = task_config.get("agent_index", 0)
                if agent_index >= len(agents):
                    agent_index = 0

                task = Task(
                    description=task_config.get("description", ""),
                    expected_output=task_config.get("expected_output", "Analysis results"),
                    agent=agents[agent_index],
                )
                tasks.append(task)

            # Build crew
            crew = Crew(
                agents=agents,
                tasks=tasks,
                process=Process.sequential,
                verbose=crew_config.get("verbose", False),
            )

            return crew

        except KeyError as e:
            raise CrewConfigurationError(
                f"Missing required configuration key: {e}",
                execution_id=context.execution_id,
            )
        except Exception as e:
            raise CrewConfigurationError(
                f"Failed to build crew: {e}",
                execution_id=context.execution_id,
            )

    async def _execute_crew(self, crew: Crew, context: ExecutionContext) -> dict[str, Any]:
        """Execute the crew in a thread pool to avoid blocking.

        Args:
            crew: Configured Crew instance
            context: Execution context

        Returns:
            Dictionary containing execution results
        """
        loop = asyncio.get_event_loop()

        # Prepare inputs from context data
        inputs = context.context_data.copy()

        # Run crew execution in thread pool (CrewAI is synchronous)
        result = await loop.run_in_executor(
            None,
            crew.kickoff,
            inputs,
        )

        # Convert CrewOutput to dict
        return {
            "raw_output": str(result.raw) if hasattr(result, "raw") else str(result),
            "structured_output": self._parse_output(result),
            "tasks_output": [str(task.output) if hasattr(task, "output") else str(task)
                           for task in (result.tasks_output if hasattr(result, "tasks_output") else [])],
        }

    def _parse_output(self, result: Any) -> dict[str, Any]:
        """Parse crew output into structured format.

        Args:
            result: Raw crew output

        Returns:
            Structured output dictionary
        """
        # Try to extract JSON output if available
        if hasattr(result, "json_dict") and result.json_dict:
            return result.json_dict

        if hasattr(result, "pydantic") and result.pydantic:
            return result.pydantic.model_dump()

        # Fallback: return raw output as text
        return {"output": str(result)}

    async def _estimate_tokens(self, context: ExecutionContext) -> int:
        """Estimate token count for execution.

        Args:
            context: Execution context

        Returns:
            Estimated token count
        """
        # Rough estimation: ~4 characters per token
        # Count characters in context data and crew config
        import json

        context_str = json.dumps(context.context_data)
        config_str = json.dumps(context.crew_config)

        total_chars = len(context_str) + len(config_str)
        estimated_tokens = total_chars // 4

        # Add overhead for system messages, output, etc.
        estimated_tokens = int(estimated_tokens * 1.5)

        return estimated_tokens

    def _extract_token_usage(self, result_data: dict[str, Any]) -> TokenUsage | None:
        """Extract token usage from crew execution result.

        Args:
            result_data: Result data from crew execution

        Returns:
            TokenUsage if available, None otherwise
        """
        # CrewAI doesn't always expose token usage
        # This is a placeholder for when it becomes available
        # For now, estimate based on output length
        raw_output = result_data.get("raw_output", "")
        estimated_completion_tokens = len(raw_output) // 4

        # Rough estimate for prompt tokens
        estimated_prompt_tokens = estimated_completion_tokens * 2

        return TokenUsage(
            prompt_tokens=estimated_prompt_tokens,
            completion_tokens=estimated_completion_tokens,
            total_tokens=estimated_prompt_tokens + estimated_completion_tokens,
        )
