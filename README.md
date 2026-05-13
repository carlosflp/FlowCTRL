# FlowCTRL

FlowCTRL is the foundation of an internal operating platform for an asset manager. The current base covers portfolio and asset master data, operations, cashflow events, asset prices, consolidated positions, authentication, audit trail and the first protected frontend workflows.

## Current stage

The repository now includes:

- a modular FastAPI backend organized by domain
- JWT authentication with local admin bootstrap
- role-based authorization (`admin`, `manager`, `analyst`, `viewer`)
- CRUD APIs for portfolios, assets, operations, cashflow and pricing
- consolidated position endpoints by portfolio and asset
- async reporting with Celery and MinIO
- audit logging for operations, cashflow and pricing changes
- a Next.js frontend with login, protected routes, dashboard, operational list views and report execution
- PostgreSQL, Redis, MinIO and Celery wired through Docker Compose

## Technical adjustments adopted

Some small structural adjustments were kept from the original proposal because they improve clarity without changing the spirit of the architecture:

- the repository root is already the product root, so there is no extra `asset-platform/` wrapper folder
- the backend has an explicit `app/db/` layer for ORM base, session and metadata bootstrap
- each domain module follows `models`, `schemas`, `service` and `router`
- the platform starts as a modular monolith, ready to grow without introducing microservices early

## Stack

### Frontend

- Next.js
- TypeScript
- Tailwind CSS
- TanStack Query
- TanStack Table
- React Hook Form
- Zod

### Backend

- Python 3.11
- FastAPI
- SQLAlchemy 2.x
- Alembic
- Pydantic
- PostgreSQL
- Celery
- Redis
- MinIO
- Pytest
- Ruff
- MyPy

### Local infra

- Docker
- Docker Compose
- PostgreSQL
- Redis
- MinIO

## Implemented stages

### Stage 1: platform foundation

- modular FastAPI application
- SQLAlchemy models and Alembic setup
- Docker Compose local stack
- initial frontend shell and pages
- base documentation and tests

### Stage 2: authentication and authorization

- JWT access token login
- password hashing with PBKDF2-SHA256
- role-based authorization for protected endpoints
- default admin bootstrap from environment variables
- frontend login page and session provider

### Stage 3: cashflow and pricing

- CRUD endpoints for `cashflow_entries`
- CRUD endpoints for `asset_prices`
- dashboard visibility for cashflow and pricing counts
- list screens for cashflow and pricing
- business validation for operation-to-portfolio cashflow links
- uniqueness validation for asset price by asset, date and source

### Stage 4: asynchronous reports

- default report templates seeded during bootstrap
- report template read/create/update endpoints
- report execution endpoints with Celery queueing
- CSV, XLSX and PDF generation in the worker
- artifact storage in MinIO
- authenticated download endpoint
- report execution screen with queue status polling and download

### Stage 5: consolidated positions

- read-only consolidated position service by portfolio and asset
- position overview endpoint for dashboard consumption
- as-of-date and portfolio filtering
- weighted-average cost basis with latest-price mark-to-market
- frontend position screen with operational filters

## Roles

- `admin`: full access
- `manager`: read, create, update and delete domain records
- `analyst`: read, create and update domain records
- `viewer`: read-only access

## Seeded admin

The backend bootstraps a default admin during container startup after migrations.

Environment variables used for that:

- `APP_ADMIN_EMAIL`
- `APP_ADMIN_PASSWORD`
- `APP_ADMIN_NAME`
- `JWT_SECRET_KEY`
- `ACCESS_TOKEN_EXPIRE_MINUTES`

## Running locally

1. Copy the environment file:

```powershell
Copy-Item .env.example .env
```

2. Start the stack:

```powershell
docker compose --env-file .env -f infra/compose.yaml up --build
```

3. Open:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8000`
- Swagger: `http://localhost:8000/docs`
- MinIO Console: `http://localhost:9001`

## Migrations

With Docker:

```powershell
docker compose --env-file .env -f infra/compose.yaml exec backend alembic -c alembic.ini upgrade head
```

Locally inside `apps/backend`:

```powershell
alembic -c alembic.ini upgrade head
```

## Tests

Backend tests locally inside `apps/backend`:

```powershell
pytest
```

Or through Docker:

```powershell
docker compose --env-file .env -f infra/compose.yaml exec backend pytest
```

Frontend production build inside `apps/frontend`:

```powershell
npm run build
```

## Folder structure

```text
.
|-- apps
|   |-- backend
|   |   |-- app
|   |   |   |-- api
|   |   |   |-- core
|   |   |   |-- db
|   |   |   |-- modules
|   |   |   |-- tests
|   |   |   `-- workers
|   |   |-- alembic
|   |   |-- Dockerfile
|   |   `-- pyproject.toml
|   `-- frontend
|       |-- src
|       |   |-- app
|       |   |-- components
|       |   |-- features
|       |   |-- lib
|       |   `-- types
|       `-- Dockerfile
|-- docs
|-- infra
|   |-- compose.yaml
|   `-- docker
|-- .env.example
`-- README.md
```

## Available endpoints

### Infra

- `GET /health`

### Auth

- `GET /api/v1/auth/status`
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`

### Portfolios

- `GET /api/v1/portfolios`
- `POST /api/v1/portfolios`
- `GET /api/v1/portfolios/{portfolio_id}`
- `PUT /api/v1/portfolios/{portfolio_id}`
- `DELETE /api/v1/portfolios/{portfolio_id}`

### Assets

- `GET /api/v1/assets`
- `POST /api/v1/assets`
- `GET /api/v1/assets/{asset_id}`
- `PUT /api/v1/assets/{asset_id}`
- `DELETE /api/v1/assets/{asset_id}`

### Operations

- `GET /api/v1/operations`
- `POST /api/v1/operations`
- `GET /api/v1/operations/{operation_id}`
- `PUT /api/v1/operations/{operation_id}`
- `DELETE /api/v1/operations/{operation_id}`

### Cashflow

- `GET /api/v1/cashflow`
- `POST /api/v1/cashflow`
- `GET /api/v1/cashflow/{entry_id}`
- `PUT /api/v1/cashflow/{entry_id}`
- `DELETE /api/v1/cashflow/{entry_id}`

### Pricing

- `GET /api/v1/pricing`
- `POST /api/v1/pricing`
- `GET /api/v1/pricing/{price_id}`
- `PUT /api/v1/pricing/{price_id}`
- `DELETE /api/v1/pricing/{price_id}`

### Positions

- `GET /api/v1/positions`
- `GET /api/v1/positions/overview`

### Reports

- `GET /api/v1/reports/templates`
- `POST /api/v1/reports/templates`
- `GET /api/v1/reports/templates/{template_id}`
- `PUT /api/v1/reports/templates/{template_id}`
- `GET /api/v1/reports/executions`
- `POST /api/v1/reports/executions`
- `GET /api/v1/reports/executions/{execution_id}`
- `GET /api/v1/reports/executions/{execution_id}/download`

## Validation performed

Validated in the current stage:

- Docker Compose stack running locally
- backend health endpoint responding `200`
- backend test suite passing with `18` tests
- frontend production build passing
- frontend routes for `/login`, `/cashflow`, `/pricing`, `/positions` and `/reports` compiling successfully
- worker task `reports.generate_execution` loaded and executed successfully
- real report execution completed locally with artifact download returning `200`

## Recommended next steps

1. Add user management endpoints and an admin screen for role assignment.
2. Expand position handling for corporate actions, transfers and richer valuation rules.
3. Expand report filters by date range, portfolio scope and custom columns.
4. Expand audit context with authenticated user attribution.
5. Add CI for backend tests, frontend build and linting.
