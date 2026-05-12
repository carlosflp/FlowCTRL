# FlowCTRL

Base inicial de uma plataforma operacional para gestão interna de uma asset financeira, com foco em controle de carteiras, ativos, operações, caixa, auditoria e geração futura de relatórios.

## Ajustes técnicos adotados

Antes da implementação, foram aplicados três ajustes pequenos para melhorar a escalabilidade sem aumentar a complexidade:

- o repositório raiz já funciona como diretório principal do produto, então não foi criada uma pasta extra `asset-platform/`;
- o backend ganhou uma camada `app/db/` para concentrar sessão, base ORM e metadata;
- cada módulo de domínio foi separado em `models`, `schemas`, `service` e `router`, mantendo o monolito simples, mas realmente modular.

## Stack utilizada

### Frontend

- Next.js
- TypeScript
- Tailwind CSS
- TanStack Query
- TanStack Table
- React Hook Form
- Zod
- Lucide React

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

### Infra local

- Docker
- Docker Compose
- PostgreSQL
- Redis
- MinIO

## Como rodar localmente

1. Copie o arquivo de ambiente:

```powershell
Copy-Item .env.example .env
```

2. Suba os serviços:

```powershell
docker compose --env-file .env -f infra/compose.yaml up --build
```

3. Acesse:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8000`
- Swagger: `http://localhost:8000/docs`
- MinIO Console: `http://localhost:9001`

## Como rodar migrations

Com Docker:

```powershell
docker compose --env-file .env -f infra/compose.yaml exec backend alembic -c alembic.ini upgrade head
```

Localmente dentro de `apps/backend`:

```powershell
alembic -c alembic.ini upgrade head
```

## Como rodar testes

Com o ambiente Python preparado em `apps/backend`:

```powershell
pytest
```

Ou via container:

```powershell
docker compose --env-file .env -f infra/compose.yaml exec backend pytest
```

## Estrutura de pastas

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

## Endpoints já disponíveis

### Infra e apoio

- `GET /health`
- `GET /api/v1/auth/status`

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

## Próximos passos recomendados

1. Implementar autenticação real e autorização por perfis.
2. Criar geração assíncrona de relatórios com Celery e MinIO.
3. Introduzir cálculo de posição e visão consolidada por carteira.
4. Expor CRUDs adicionais para preços, caixa, templates e execuções de relatório.
5. Evoluir auditoria para cobrir mais entidades e contexto do usuário.
6. Adicionar seeds, factories e testes mais amplos de integração.
