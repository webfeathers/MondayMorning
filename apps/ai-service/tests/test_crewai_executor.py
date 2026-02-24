"""Tests for CrewAI executor implementation."""

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.executors import (
    CrewAIExecutor,
    ExecutionContext,
    ExecutionStatus,
    ValidationError,
)


@pytest.fixture
def executor():
    """Create a CrewAI executor instance."""
    return CrewAIExecutor()


@pytest.fixture
def valid_context():
    """Create a valid execution context."""
    return ExecutionContext(
        execution_id="test_exec_123",
        tenant_id="tenant_456",
        crew_template_id="account_health",
        user_id="user_789",
        crew_config={
            "agents": [
                {
                    "role": "Account Analyst",
                    "goal": "Analyze account health",
                    "backstory": "Expert in CRM analysis",
                    "verbose": False,
                    "allow_delegation": False,
                }
            ],
            "tasks": [
                {
                    "description": "Analyze the account data and provide insights",
                    "expected_output": "Account health score and recommendations",
                    "agent_index": 0,
                }
            ],
            "verbose": False,
        },
        context_data={
            "accounts": [
                {"id": "1", "name": "Acme Corp", "status": "active"}
            ],
            "contacts": [
                {"id": "1", "name": "John Doe", "account_id": "1"}
            ],
        },
        max_tokens=50000,
        max_execution_time_seconds=60,
        credit_budget=100,
    )


def test_get_supported_crews(executor):
    """Test getting supported crew types."""
    crews = executor.get_supported_crews()
    assert isinstance(crews, list)
    assert "account_health" in crews
    assert "deal_analysis" in crews
    assert "ticket_analysis" in crews


@pytest.mark.asyncio
async def test_validate_context_success(executor, valid_context):
    """Test context validation with valid context."""
    is_valid, error_msg = await executor.validate_context(valid_context)
    assert is_valid is True
    assert error_msg is None


@pytest.mark.asyncio
async def test_validate_context_unsupported_crew(executor, valid_context):
    """Test context validation with unsupported crew type."""
    valid_context.crew_template_id = "unknown_crew"
    is_valid, error_msg = await executor.validate_context(valid_context)
    assert is_valid is False
    assert "Unsupported crew template" in error_msg


@pytest.mark.asyncio
async def test_validate_context_missing_config(executor, valid_context):
    """Test context validation with missing crew config."""
    valid_context.crew_config = {}
    is_valid, error_msg = await executor.validate_context(valid_context)
    assert is_valid is False
    assert "Crew configuration is required" in error_msg


@pytest.mark.asyncio
async def test_validate_context_missing_data(executor, valid_context):
    """Test context validation with missing context data."""
    valid_context.context_data = {}
    is_valid, error_msg = await executor.validate_context(valid_context)
    assert is_valid is False
    assert "Context data is required" in error_msg


@pytest.mark.asyncio
async def test_estimate_cost(executor, valid_context):
    """Test cost estimation."""
    estimate = await executor.estimate_cost(valid_context)

    assert "estimated_tokens" in estimate
    assert "estimated_credits" in estimate
    assert "estimated_time_seconds" in estimate
    assert "confidence" in estimate

    assert estimate["estimated_tokens"] > 0
    assert estimate["estimated_credits"] > 0
    assert estimate["estimated_time_seconds"] > 0
    assert 0 <= estimate["confidence"] <= 1


@pytest.mark.asyncio
async def test_cancel_execution(executor):
    """Test cancelling an execution."""
    execution_id = "test_exec_123"

    # Mock a running task
    mock_task = AsyncMock()
    executor._running_executions[execution_id] = mock_task

    # Cancel it
    result = await executor.cancel_execution(execution_id)

    assert result is True
    assert execution_id not in executor._running_executions
    mock_task.cancel.assert_called_once()


@pytest.mark.asyncio
async def test_cancel_nonexistent_execution(executor):
    """Test cancelling a nonexistent execution."""
    result = await executor.cancel_execution("nonexistent")
    assert result is False


@patch("src.executors.crewai_executor.Crew")
@patch("src.executors.crewai_executor.Task")
@patch("src.executors.crewai_executor.Agent")
def test_build_crew_success(mock_agent, mock_task, mock_crew, executor, valid_context):
    """Test building a crew from valid configuration."""
    # Setup mocks
    mock_agent_instance = MagicMock()
    mock_agent_instance.role = "Account Analyst"
    mock_agent.return_value = mock_agent_instance

    mock_task_instance = MagicMock()
    mock_task.return_value = mock_task_instance

    mock_crew_instance = MagicMock()
    mock_crew_instance.agents = [mock_agent_instance]
    mock_crew_instance.tasks = [mock_task_instance]
    mock_crew.return_value = mock_crew_instance

    crew = executor._build_crew(valid_context)

    assert crew is not None
    assert mock_agent.called
    assert mock_task.called
    assert mock_crew.called


def test_build_crew_missing_agents(executor, valid_context):
    """Test building a crew with missing agents."""
    valid_context.crew_config["agents"] = []

    from src.executors.exceptions import CrewConfigurationError

    with pytest.raises(CrewConfigurationError) as exc_info:
        executor._build_crew(valid_context)

    assert "No agents defined" in str(exc_info.value)


@patch("src.executors.crewai_executor.Agent")
def test_build_crew_missing_tasks(mock_agent, executor, valid_context):
    """Test building a crew with missing tasks."""
    # Mock agent to avoid OPENAI_API_KEY requirement
    mock_agent.return_value = MagicMock()

    valid_context.crew_config["tasks"] = []

    from src.executors.exceptions import CrewConfigurationError

    with pytest.raises(CrewConfigurationError) as exc_info:
        executor._build_crew(valid_context)

    assert "No tasks defined" in str(exc_info.value)


@pytest.mark.asyncio
async def test_execute_success(executor, valid_context):
    """Test successful crew execution."""
    # Mock the crew execution
    mock_result = MagicMock()
    mock_result.raw = "Account health: 85/100. Recommendations: Follow up on open deals."
    mock_result.json_dict = {
        "health_score": 85,
        "recommendations": ["Follow up on open deals"],
    }
    mock_result.tasks_output = []

    with patch.object(executor, "_build_crew") as mock_build:
        mock_crew = MagicMock()
        mock_crew.kickoff.return_value = mock_result
        mock_build.return_value = mock_crew

        result = await executor.execute(valid_context)

        assert result.status == ExecutionStatus.COMPLETED
        assert result.execution_id == "test_exec_123"
        assert result.result["health_score"] == 85
        assert result.credits_consumed > 0
        assert result.execution_time_seconds > 0
        assert result.error_message is None


@pytest.mark.asyncio
async def test_execute_validation_failure(executor, valid_context):
    """Test execution with invalid context."""
    valid_context.crew_template_id = "unsupported_crew"

    with pytest.raises(ValidationError) as exc_info:
        await executor.execute(valid_context)

    assert "Unsupported crew template" in str(exc_info.value)


@pytest.mark.asyncio
async def test_execute_with_exception(executor, valid_context):
    """Test execution that raises an exception."""
    with patch.object(executor, "_build_crew") as mock_build:
        mock_build.side_effect = Exception("Test error")

        result = await executor.execute(valid_context)

        assert result.status == ExecutionStatus.FAILED
        assert result.error_message == "Test error"
        assert result.completed_at is not None


def test_parse_output_with_json_dict(executor):
    """Test parsing output with json_dict attribute."""
    mock_result = MagicMock()
    mock_result.json_dict = {"key": "value"}

    parsed = executor._parse_output(mock_result)
    assert parsed == {"key": "value"}


def test_parse_output_with_pydantic(executor):
    """Test parsing output with pydantic model."""
    mock_model = MagicMock()
    mock_model.model_dump.return_value = {"field": "data"}

    mock_result = MagicMock()
    mock_result.json_dict = None
    mock_result.pydantic = mock_model

    parsed = executor._parse_output(mock_result)
    assert parsed == {"field": "data"}


def test_parse_output_fallback(executor):
    """Test parsing output with fallback to string."""
    mock_result = MagicMock()
    mock_result.json_dict = None
    mock_result.pydantic = None
    mock_result.__str__ = lambda self: "Raw output text"

    parsed = executor._parse_output(mock_result)
    assert parsed == {"output": "Raw output text"}
