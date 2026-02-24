"""Tests for CrewExecutor protocol and models."""

from datetime import datetime, timezone

import pytest

from src.executors import (
    ExecutionContext,
    ExecutionResult,
    ExecutionStatus,
    TokenUsage,
)


def test_execution_context_creation():
    """Test creating an execution context."""
    context = ExecutionContext(
        execution_id="exec_123",
        tenant_id="tenant_456",
        crew_template_id="account_health",
        user_id="user_789",
        crew_config={"prompt": "Analyze this account"},
        context_data={"accounts": [{"id": "1", "name": "Acme Corp"}]},
    )

    assert context.execution_id == "exec_123"
    assert context.tenant_id == "tenant_456"
    assert context.crew_template_id == "account_health"
    assert context.max_tokens == 100000  # default
    assert context.credit_budget == 100  # default


def test_execution_context_with_limits():
    """Test creating execution context with custom limits."""
    context = ExecutionContext(
        execution_id="exec_123",
        tenant_id="tenant_456",
        crew_template_id="deal_analysis",
        user_id="user_789",
        crew_config={},
        context_data={},
        max_tokens=50000,
        max_execution_time_seconds=180,
        credit_budget=50,
    )

    assert context.max_tokens == 50000
    assert context.max_execution_time_seconds == 180
    assert context.credit_budget == 50


def test_token_usage_creation():
    """Test creating token usage metrics."""
    usage = TokenUsage(
        prompt_tokens=1000,
        completion_tokens=500,
        total_tokens=1500,
    )

    assert usage.prompt_tokens == 1000
    assert usage.completion_tokens == 500
    assert usage.total_tokens == 1500


def test_execution_result_success():
    """Test creating a successful execution result."""
    started = datetime.now(timezone.utc)
    completed = datetime.now(timezone.utc)

    result = ExecutionResult(
        execution_id="exec_123",
        status=ExecutionStatus.COMPLETED,
        started_at=started,
        completed_at=completed,
        result={"health_score": 85, "recommendations": ["foo", "bar"]},
        raw_output="Account health analysis complete",
        token_usage=TokenUsage(
            prompt_tokens=1000,
            completion_tokens=500,
            total_tokens=1500,
        ),
        credits_consumed=10,
        execution_time_seconds=45.2,
        model_name="gpt-4o-mini",
    )

    assert result.status == ExecutionStatus.COMPLETED
    assert result.result["health_score"] == 85
    assert result.token_usage.total_tokens == 1500
    assert result.credits_consumed == 10
    assert result.error_message is None


def test_execution_result_failure():
    """Test creating a failed execution result."""
    started = datetime.now(timezone.utc)
    completed = datetime.now(timezone.utc)

    result = ExecutionResult(
        execution_id="exec_123",
        status=ExecutionStatus.FAILED,
        started_at=started,
        completed_at=completed,
        error_message="Timeout exceeded",
        error_details={"timeout_seconds": 300, "elapsed_seconds": 305},
    )

    assert result.status == ExecutionStatus.FAILED
    assert result.error_message == "Timeout exceeded"
    assert result.error_details["timeout_seconds"] == 300


def test_execution_status_enum():
    """Test execution status enum values."""
    assert ExecutionStatus.PENDING == "pending"
    assert ExecutionStatus.RUNNING == "running"
    assert ExecutionStatus.COMPLETED == "completed"
    assert ExecutionStatus.FAILED == "failed"
    assert ExecutionStatus.CANCELLED == "cancelled"
