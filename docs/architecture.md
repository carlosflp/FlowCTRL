# Arquitetura Geral

## Visão geral

O projeto foi estruturado como um monolito modular com separação explícita entre:

- `apps/backend`: API, domínio, persistência, worker e testes.
- `apps/frontend`: interface operacional em Next.js.
- `infra`: orquestração local com Docker Compose.
- `docs`: documentação de arquitetura, modelo e regras.

O repositório raiz já funciona como o diretório principal do produto. Não foi criada uma pasta adicional `asset-platform/` para evitar profundidade artificial.

## Por que monolito modular

Nesta fase, a prioridade é:

- reduzir complexidade operacional;
- manter deploy local simples;
- preservar coesão entre regras de negócio;
- permitir evolução por domínio sem acoplamento caótico.

O backend foi organizado por módulos de negócio, cada um com responsabilidades próprias. Isso entrega uma base próxima de bounded contexts sem introduzir custo de microsserviços cedo demais.

## Estrutura do backend

O backend foi dividido em:

- `app/api`: composição de rotas públicas da API.
- `app/core`: configuração, enums e utilitários centrais.
- `app/db`: base ORM, sessão, metadata e helpers de persistência.
- `app/modules`: domínios de negócio.
- `app/workers`: Celery e tarefas assíncronas.
- `app/tests`: testes automatizados iniciais.

Cada módulo principal segue o padrão:

- `models.py`: entidades SQLAlchemy
- `schemas.py`: contratos Pydantic
- `service.py`: regras e casos de uso
- `router.py`: endpoints FastAPI

## Módulos iniciais

- `users`: usuários internos e base para autenticação futura.
- `auth`: scaffolding de autenticação sem fluxo completo ainda.
- `portfolios`: carteiras e fundos sob gestão.
- `assets`: catálogo de ativos e seus atributos principais.
- `operations`: lançamentos operacionais com auditoria básica.
- `cashflow`: eventos de caixa ligados ou não a operações.
- `pricing`: preços históricos e validação.
- `reports`: templates e execuções de relatórios.
- `audit`: trilha de alterações relevantes.

## Fluxo backend, frontend e worker

1. O frontend consome a API FastAPI via `NEXT_PUBLIC_API_URL`.
2. O backend persiste dados no PostgreSQL.
3. O Redis funciona como broker/backend do Celery.
4. O worker executa tarefas assíncronas, com foco futuro em relatórios e rotinas operacionais.
5. O MinIO armazena artefatos grandes, como CSV, XLSX e PDF.

## Papel de PostgreSQL, Redis e MinIO

### PostgreSQL

É o banco transacional principal. Concentra entidades operacionais, relacionamentos, rastreabilidade e estado da aplicação.

### Redis

Foi introduzido desde a base para suportar:

- filas assíncronas;
- orquestração com Celery;
- futuras estratégias de cache ou locking.

### MinIO

Simula um S3 local sem custo e permite:

- armazenar relatórios grandes fora do banco;
- preparar exportações futuras;
- manter paridade arquitetural com um storage orientado a objetos.

## Evolução esperada

Essa fundação permite avançar para:

- autenticação real e autorização por perfis;
- cálculo de posição consolidada;
- geração assíncrona de relatórios;
- trilha de auditoria mais rica;
- reconciliação de caixa;
- precificação e vencimentos;
- camadas de risco e liquidez.

