# Modelo de Dados Inicial

## Entidades principais

### User

Representa usuários internos do sistema.

Campos principais:

- `id`
- `email`
- `full_name`
- `hashed_password`
- `is_active`
- `is_superuser`
- `created_at`
- `updated_at`

### Portfolio

Representa carteira, fundo ou estratégia gerida.

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

Cadastro mestre de ativos negociáveis ou controlados.

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

Movimento de caixa ligado ou não a uma operação.

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

Preço histórico de um ativo em determinada data e fonte.

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

Modelo parametrizável para geração de relatórios.

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

Execução concreta de um relatório, potencialmente vinculada a uma carteira.

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

### AuditLog

Registro genérico de alterações relevantes.

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

## Decisões de modelagem

### UUID como chave primária

As entidades principais usam UUID para facilitar:

- integração futura;
- redução de colisões em importações;
- distribuição sem dependência de sequências globais.

### Decimal para valores financeiros

Valores monetários e quantidades foram modelados com precisão decimal via SQLAlchemy `Numeric`, evitando erros de arredondamento típicos de `float`.

### JSON para estruturas flexíveis

`config_json`, `parameters_json`, `old_value_json` e `new_value_json` usam JSON para preservar flexibilidade sem antecipar um modelo excessivamente rígido.

### Tabelas de suporte já previstas

Mesmo sem CRUD completo ainda, `cashflow`, `pricing`, `reports` e `audit` já fazem parte do modelo para evitar retrabalho estrutural depois.

### Enumerações explícitas

Tipos de ativo, tipos de operação e status foram definidos como enums desde o início. Isso melhora consistência, validação e clareza sem impedir expansão controlada futura.

