"""
API endpoints for crew executions.
"""

import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Any

from src.executors.protocol import ExecutionContext
from src.executors.crewai_executor import CrewAIExecutor

logger = logging.getLogger(__name__)
router = APIRouter()


class ExecuteCrewRequest(BaseModel):
    """Request to execute a crew."""

    execution_id: str = Field(..., description="Unique execution ID from web app")
    tenant_id: str = Field(..., description="Tenant ID for isolation")
    crew_template_id: str = Field(..., description="Crew template to execute")
    context_data: dict[str, Any] = Field(..., description="Assembled context data")
    crew_config: dict[str, Any] | None = Field(
        None, description="Optional crew configuration overrides"
    )
    max_tokens: int = Field(50000, description="Maximum tokens allowed")
    max_execution_time_seconds: int = Field(300, description="Maximum execution time")


class ExecuteCrewResponse(BaseModel):
    """Response from crew execution."""

    execution_id: str
    status: str
    result: dict[str, Any] | None = None
    raw_output: str | None = None
    token_usage: dict[str, int] | None = None
    credits_consumed: int = 0
    execution_time_seconds: int = 0
    model_name: str | None = None
    error_message: str | None = None
    error_details: dict[str, Any] | None = None


@router.post("/execute", response_model=ExecuteCrewResponse)
async def execute_crew(request: ExecuteCrewRequest) -> ExecuteCrewResponse:
    """
    Execute an AI crew and return the results.

    This endpoint is called by the worker service after a job
    has been dequeued. It runs the crew execution synchronously
    and returns the complete results.
    """
    logger.info(
        f"Executing crew {request.crew_template_id} for execution {request.execution_id}"
    )

    # Create execution context
    context = ExecutionContext(
        execution_id=request.execution_id,
        tenant_id=request.tenant_id,
        crew_template_id=request.crew_template_id,
        context_data=request.context_data,
        crew_config=request.crew_config or {},
        max_tokens=request.max_tokens,
        max_execution_time_seconds=request.max_execution_time_seconds,
    )

    # Execute the crew
    executor = CrewAIExecutor()

    try:
        # Validate context first
        is_valid, validation_error = await executor.validate_context(context)
        if not is_valid:
            logger.error(f"Context validation failed: {validation_error}")
            return ExecuteCrewResponse(
                execution_id=request.execution_id,
                status="failed",
                error_message=validation_error or "Context validation failed",
                error_details={"validation_error": validation_error},
            )

        # Execute the crew
        result = await executor.execute(context)

        logger.info(
            f"Crew execution {request.execution_id} completed: {result.status}"
        )

        return ExecuteCrewResponse(
            execution_id=result.execution_id,
            status=result.status,
            result=result.result,
            raw_output=result.raw_output,
            token_usage={
                "prompt_tokens": result.token_usage.prompt_tokens,
                "completion_tokens": result.token_usage.completion_tokens,
                "total_tokens": result.token_usage.total_tokens,
            }
            if result.token_usage
            else None,
            credits_consumed=result.credits_consumed,
            execution_time_seconds=result.execution_time_seconds,
            model_name=result.model_name,
            error_message=result.error_message,
            error_details=result.error_details,
        )

    except Exception as e:
        logger.error(f"Crew execution {request.execution_id} failed: {str(e)}")
        return ExecuteCrewResponse(
            execution_id=request.execution_id,
            status="failed",
            error_message=str(e),
            error_details={"exception": str(type(e).__name__)},
        )
