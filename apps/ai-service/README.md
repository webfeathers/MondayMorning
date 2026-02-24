# WF AI Service

Python FastAPI service for executing AI crews using CrewAI.

## Features

- FastAPI with async support
- Health check endpoints (`/health`, `/health/ready`, `/health/live`)
- CrewAI integration for multi-agent workflows
- Structured logging
- Type-safe with Pydantic models

## Setup

### Prerequisites

- Python 3.11+
- UV or pip for package management

### Installation

Using UV (recommended):
```bash
uv venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
uv pip install -e ".[dev]"
```

Or using pip:
```bash
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -e ".[dev]"
```

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Required variables:
- `OPENAI_API_KEY`: Your OpenAI API key for CrewAI

## Development

### Run the server

```bash
python src/main.py
```

Or with uvicorn directly:
```bash
uvicorn src.main:app --reload --port 8000
```

The service will be available at `http://localhost:8000`

### API Documentation

Once running, visit:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

### Testing

```bash
pytest
```

With coverage:
```bash
pytest --cov=src tests/
```

### Linting and Formatting

```bash
# Run ruff for linting
ruff check .

# Run ruff for formatting
ruff format .

# Run mypy for type checking
mypy src/
```

## Project Structure

```
apps/ai-service/
├── src/
│   ├── api/           # API routes and endpoints
│   ├── core/          # Core configuration and utilities
│   ├── executors/     # CrewExecutor implementations
│   ├── crews/         # Crew definitions
│   └── main.py        # FastAPI application
├── tests/             # Test files
├── pyproject.toml     # Project configuration and dependencies
└── README.md
```

## API Endpoints

### Health Checks

- `GET /api/v1/health` - General health check
- `GET /api/v1/health/ready` - Readiness probe
- `GET /api/v1/health/live` - Liveness probe

### Crew Execution (Coming Soon)

- `POST /api/v1/crews/execute` - Execute a crew
- `GET /api/v1/crews/{execution_id}` - Get execution status
- `GET /api/v1/crews/{execution_id}/results` - Get execution results
