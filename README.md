# FlowCTRL

FlowCTRL is the initial foundation of an internal platform for asset managers, focused on operational control of portfolios, assets, operations, cash events, audit trails and future reporting workflows.

## Current stage

The repository now includes:

- a modular FastAPI backend with JWT authentication
- seeded local admin bootstrap
- role-based authorization (`admin`, `manager`, `analyst`, `viewer`)
- a Next.js frontend with login flow and protected routes
- PostgreSQL, Redis, MinIO and Celery wired through Docker Compose

## Technical adjustments adopted

Three structural choices were kept from the first stage because they give the project room to grow without making it heavy too early:

- the repository root is already the product root, so there is no extra `asset-platform/` wrapper folder
- the backend has an explicit `app/db/` layer for ORM base, session and metadata bootstrap
- each domain module follows `models`, `schemas`, `service` and `router`

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

## Authentication stage

This stage added:

- JWT access token login
- password hashing with PBKDF2-SHA256
- role-based authorization for protected endpoints
- default admin bootstrap from environment variables
- frontend login page and session provider

### Roles

- `admin`: full access
- `manager`: read, create, update and delete domain records
- `analyst`: read, create and update domain records
- `viewer`: read-only access

### Seeded admin

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

Backend tests:

```powershell
pytest
```

Or through Docker:

```powershell
docker compose --env-file .env -f infra/compose.yaml exec backend pytest
```

## Folder structure

```text
.
├── apps
│   ├── backend
│   │   ├── app
│   │   │   ├── api
│   │   │   ├── core
│   │   │   ├── db
│   │   │   ├── modules
│   │   │   ├── tests
│   │   │   └── workers
│   │   ├── alembic
│   │   ├── Dockerfile
│   │   └── pyproject.toml
│   └── frontend
│       ├── src
│       │   ├── app
│       │   ├── components
│       │   ├── features
│       │   ├── lib
│       │   └── types
│       └── Dockerfile
├── docs
├── infra
│   ├── compose.yaml
│   └── docker
├── .env.example
└── README.md
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

## Validation performed

What was validated in this stage:

- backend test suite: `8 passed`
- frontend production build: passed

I also attempted a fresh Docker Compose smoke test, but at that moment the local Docker daemon was unavailable on this machine, so I could not complete that final runtime check from here.

## Recommended next steps

1. Add user management endpoints and an admin screen for role assignment.
2. Extend authorization to cashflow, pricing and reports as those modules gain CRUD flows.
3. Introduce refresh tokens or an http-only cookie session model.
4. Build cashflow and pricing modules next.
5. Start the asynchronous report generation pipeline with Celery and MinIO.
