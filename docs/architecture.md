# Arquitetura Geral

## Visao geral

O projeto foi estruturado como um monolito modular com separacao explicita entre:

- `apps/backend`: API, dominio, persistencia, worker e testes
- `apps/frontend`: interface operacional em Next.js
- `infra`: orquestracao local com Docker Compose
- `docs`: documentacao de arquitetura, dados e regras

O repositorio raiz ja funciona como o diretorio principal do produto. Nao foi criada uma pasta adicional `asset-platform/` para evitar profundidade artificial.

## Por que monolito modular

Nesta fase, a prioridade e:

- reduzir complexidade operacional
- manter deploy local simples
- preservar coesao entre regras de negocio
- permitir evolucao por dominio sem acoplamento caotico

O backend foi organizado por modulos de negocio, cada um com responsabilidades proprias. Isso entrega uma base proxima de bounded contexts sem introduzir o custo de microsservicos cedo demais.

## Estrutura do backend

O backend foi dividido em:

- `app/api`: composicao de rotas publicas da API
- `app/core`: configuracao, enums e utilitarios centrais
- `app/db`: base ORM, sessao, metadata e helpers de persistencia
- `app/modules`: dominios de negocio
- `app/workers`: Celery e tarefas assincronas
- `app/tests`: testes automatizados

Cada modulo principal segue o padrao:

- `models.py`: entidades SQLAlchemy
- `schemas.py`: contratos Pydantic
- `service.py`: regras e casos de uso
- `router.py`: endpoints FastAPI

## Modulos atuais

- `users`: usuarios internos, perfis e bootstrap de administrador
- `auth`: autenticacao JWT e autorizacao por papel
- `portfolios`: carteiras e fundos sob gestao
- `assets`: cadastro mestre de ativos
- `operations`: lancamentos operacionais com auditoria
- `cashflow`: eventos de caixa ligados ou nao a operacoes
- `pricing`: precos historicos e validacao por fonte
- `positions`: consolidacao read-only por carteira e ativo
- `reports`: templates, execucoes assincronas e artefatos em storage
- `audit`: trilha de alteracoes relevantes

## Fluxo backend, frontend e worker

1. O frontend consome a API FastAPI via `NEXT_PUBLIC_API_URL`
2. O backend valida autenticacao e regras de negocio
3. O backend persiste dados no PostgreSQL
4. O Redis funciona como broker e backend do Celery
5. O worker executa tarefas assincronas, com foco atual em relatorios e com espaco para futuras rotinas operacionais
6. O MinIO armazena artefatos grandes, como CSV, XLSX e PDF

## Papel de PostgreSQL, Redis e MinIO

### PostgreSQL

E o banco transacional principal. Concentra entidades operacionais, relacionamentos, rastreabilidade e estado da aplicacao.

### Redis

Foi introduzido desde a base para suportar:

- filas assincronas
- orquestracao com Celery
- futuras estrategias de cache ou locking

### MinIO

Simula um S3 local sem custo e permite:

- armazenar relatorios grandes fora do banco
- preparar exportacoes futuras
- manter paridade arquitetural com um storage orientado a objetos

## Estado atual da aplicacao

Hoje a plataforma ja oferece:

- login JWT com usuario admin bootstrapado por ambiente
- autorizacao por papeis (`admin`, `manager`, `analyst`, `viewer`)
- CRUD inicial para portfolios, assets, operations, cashflow e pricing
- consolidacao inicial de posicao por carteira e ativo
- templates e execucoes de relatorios com enfileiramento Celery
- geracao de CSV, XLSX e PDF com persistencia no MinIO
- dashboard inicial com contagens operacionais
- telas protegidas para carteiras, ativos, operacoes, caixa, precos, posicoes e relatorios
- worker Celery ativo para geracao assincrona de relatorios

## Evolucao esperada

Essa fundacao permite avancar para:

- gestao de usuarios e perfis pela interface
- calculo de posicao consolidada
- consolidacao de caixa por carteira
- filtros mais ricos e catalogo ampliado de relatorios
- trilha de auditoria com usuario autenticado
- conciliacao operacional
- camadas de risco, liquidez e vencimentos
