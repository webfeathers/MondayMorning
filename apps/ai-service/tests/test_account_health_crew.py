"""Tests for account health crew configuration."""

from unittest.mock import MagicMock, patch

import pytest

from src.crews import get_account_health_crew_config
from src.executors import CrewAIExecutor, ExecutionContext


def test_get_account_health_crew_config():
    """Test that account health crew config is properly structured."""
    config = get_account_health_crew_config()

    # Check required top-level keys
    assert "agents" in config
    assert "tasks" in config
    assert "verbose" in config

    # Check agents structure
    assert len(config["agents"]) == 3
    assert config["agents"][0]["role"] == "CRM Data Analyst"
    assert config["agents"][1]["role"] == "Account Risk Assessor"
    assert config["agents"][2]["role"] == "Strategic Account Advisor"

    for agent in config["agents"]:
        assert "role" in agent
        assert "goal" in agent
        assert "backstory" in agent
        assert "verbose" in agent
        assert "allow_delegation" in agent

    # Check tasks structure
    assert len(config["tasks"]) == 3

    for task in config["tasks"]:
        assert "description" in task
        assert "expected_output" in task
        assert "agent_index" in task


def test_account_health_crew_agent_assignments():
    """Test that tasks are properly assigned to agents."""
    config = get_account_health_crew_config()

    # Task 1: Engagement analysis -> CRM Data Analyst (agent 0)
    assert config["tasks"][0]["agent_index"] == 0

    # Task 2: Risk assessment -> Account Risk Assessor (agent 1)
    assert config["tasks"][1]["agent_index"] == 1

    # Task 3: Strategic recommendations -> Strategic Account Advisor (agent 2)
    assert config["tasks"][2]["agent_index"] == 2


@patch("src.executors.crewai_executor.Crew")
@patch("src.executors.crewai_executor.Task")
@patch("src.executors.crewai_executor.Agent")
def test_account_health_crew_builds_successfully(mock_agent, mock_task, mock_crew):
    """Test that account health crew config builds successfully with CrewAIExecutor."""
    # Setup mocks
    mock_agent_instances = [MagicMock(), MagicMock(), MagicMock()]
    mock_agent.side_effect = mock_agent_instances

    mock_task_instances = [MagicMock(), MagicMock(), MagicMock()]
    mock_task.side_effect = mock_task_instances

    mock_crew_instance = MagicMock()
    mock_crew.return_value = mock_crew_instance

    # Create context with account health crew config
    context = ExecutionContext(
        execution_id="test_123",
        tenant_id="tenant_456",
        crew_template_id="account_health",
        user_id="user_789",
        crew_config=get_account_health_crew_config(),
        context_data={
            "accounts": [
                {
                    "id": "acc_1",
                    "name": "Acme Corp",
                    "industry": "Technology",
                    "status": "active",
                    "created_at": "2023-01-15",
                }
            ],
            "contacts": [
                {
                    "id": "contact_1",
                    "account_id": "acc_1",
                    "name": "John Doe",
                    "title": "CTO",
                    "email": "john@acme.com",
                }
            ],
            "deals": [
                {
                    "id": "deal_1",
                    "account_id": "acc_1",
                    "name": "Q1 Expansion",
                    "stage": "negotiation",
                    "amount": 50000,
                    "probability": 75,
                }
            ],
            "tickets": [
                {
                    "id": "ticket_1",
                    "account_id": "acc_1",
                    "title": "Integration Issue",
                    "status": "open",
                    "priority": "high",
                }
            ],
            "activities": [
                {
                    "id": "activity_1",
                    "account_id": "acc_1",
                    "type": "meeting",
                    "date": "2024-02-01",
                    "notes": "Quarterly business review",
                }
            ],
        },
    )

    # Build crew using executor
    executor = CrewAIExecutor()
    crew = executor._build_crew(context)

    # Verify crew was built
    assert crew is not None
    assert mock_agent.call_count == 3  # 3 agents created
    assert mock_task.call_count == 3  # 3 tasks created
    assert mock_crew.called

    # Verify agent configurations were used
    agent_calls = mock_agent.call_args_list
    assert agent_calls[0][1]["role"] == "CRM Data Analyst"
    assert agent_calls[1][1]["role"] == "Account Risk Assessor"
    assert agent_calls[2][1]["role"] == "Strategic Account Advisor"


def test_account_health_crew_task_descriptions():
    """Test that task descriptions are comprehensive and well-structured."""
    config = get_account_health_crew_config()

    # Task 1: Engagement analysis
    task1_desc = config["tasks"][0]["description"]
    assert "engagement" in task1_desc.lower()
    assert "accounts" in task1_desc.lower()
    assert "contacts" in task1_desc.lower()
    assert "deals" in task1_desc.lower()
    assert "tickets" in task1_desc.lower()

    # Task 2: Risk assessment
    task2_desc = config["tasks"][1]["description"]
    assert "risk" in task2_desc.lower()
    assert "churn" in task2_desc.lower()

    # Task 3: Recommendations
    task3_desc = config["tasks"][2]["description"]
    assert "recommendations" in task3_desc.lower()
    assert "health score" in task3_desc.lower()
    assert "json" in task3_desc.lower()


def test_account_health_crew_expected_outputs():
    """Test that expected outputs are well-defined."""
    config = get_account_health_crew_config()

    # All tasks should have expected output
    for i, task in enumerate(config["tasks"]):
        assert len(task["expected_output"]) > 50, f"Task {i} expected output too short"

    # Task 3 should specify JSON structure
    task3_output = config["tasks"][2]["expected_output"]
    assert "health_score" in task3_output
    assert "recommendations" in task3_output
    assert "risk_factors" in task3_output
