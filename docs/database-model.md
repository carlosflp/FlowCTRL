# Modelo de Dados Inicial

## Entidades principais

### User

Representa usuarios internos do sistema.

Campos principais:

- `id`
- `email`
- `full_name`
- `hashed_password`
- `role`
- `is_active`
- `is_superuser`
- `created_at`
- `updated_at`

### Portfolio

Representa carteira, fundo ou estrategia gerida.

Campos principais:

- `id`
- `name`
- `description`
- `base_currency`
- `benchmark`
- `is_active`
- `created_at`
- `updated_at`

### Asset

Cadastro mestre de ativos negociaveis ou controlados.

Campos principais:

- `id`
- `ticker`
- `name`
- `asset_type`
- `issuer`
- `indexer`
- `maturity_date`
- `is_active`
- `created_at`
- `updated_at`

### Operation

Evento operacional que afeta uma carteira e um ativo.

Campos principais:

- `id`
- `portfolio_id`
- `asset_id`
- `operation_type`
- `trade_date`
- `settlement_date`
- `quantity`
- `unit_price`
- `gross_value`
- `net_value`
- `fees`
- `taxes`
- `status`
- `notes`
- `created_at`
- `updated_at`

### CashflowEntry

Movimento de caixa ligado ou nao a uma operacao.

Campos principais:

- `id`
- `portfolio_id`
- `operation_id`
- `entry_date`
- `settlement_date`
- `description`
- `entry_type`
- `amount`
- `status`
- `created_at`
- `updated_at`

### AssetPrice

Preco historico de um ativo em determinada data e fonte.

Campos principais:

- `id`
- `asset_id`
- `price_date`
- `price`
- `source`
- `is_validated`
- `created_at`
- `updated_at`

### ReportTemplate

Modelo parametrizavel para geracao de relatorios.

Campos principais:

- `id`
- `name`
- `description`
- `template_type`
- `config_json`
- `is_active`
- `created_at`
- `updated_at`

### ReportExecution

Execucao concreta de um relatorio, potencialmente vinculada a uma carteira.

Campos principais:

- `id`
- `template_id`
- `portfolio_id`
- `status`
- `parameters_json`
- `file_path`
- `file_type`
- `created_at`
- `finished_at`

Observacao pratica:

- `file_path` guarda a chave do objeto no bucket do MinIO
- `file_type` guarda a extensao logica do artefato (`csv`, `xlsx`, `pdf`)

### AuditLog

Registro generico de alteracoes relevantes.

Campos principais:

- `id`
- `user_id`
- `entity_type`
- `entity_id`
- `action`
- `old_value_json`
- `new_value_json`
- `created_at`

## Relacionamentos iniciais

- `Portfolio 1:N Operation`
- `Asset 1:N Operation`
- `Portfolio 1:N CashflowEntry`
- `Operation 1:N CashflowEntry`
- `Asset 1:N AssetPrice`
- `ReportTemplate 1:N ReportExecution`
- `Portfolio 1:N ReportExecution`
- `User 1:N AuditLog`

## Decisoes de modelagem

### UUID como chave primaria

As entidades principais usam UUID para facilitar:

- integracao futura
- reducao de colisoes em importacoes
- distribuicao sem dependencia de sequencias globais

### Decimal para valores financeiros

Valores monetarios e quantidades foram modelados com precisao decimal via SQLAlchemy `Numeric`, evitando erros de arredondamento tipicos de `float`.

### JSON para estruturas flexiveis

`config_json`, `parameters_json`, `old_value_json` e `new_value_json` usam JSON para preservar flexibilidade sem antecipar um modelo excessivamente rigido.

### Tabelas de suporte ja ativas

`cashflow`, `pricing`, `reports` e `audit` ja fazem parte do modelo principal. Nesta etapa, `cashflow`, `pricing` e `reports` deixaram de ser apenas preparacao estrutural e passaram a ter fluxo operacional utilizavel.

### Restricoes importantes

- `asset_prices` possui unicidade por `asset_id + price_date + source`
- `cashflow_entries.operation_id` e opcional
- `audit_logs.user_id` continua opcional nesta fase para nao travar o bootstrap inicial

### Enumeracoes explicitas

Tipos de ativo, tipos de operacao, tipos de caixa, status e perfis de usuario foram definidos como enums desde o inicio. Isso melhora consistencia, validacao e clareza sem impedir expansao controlada futura.
