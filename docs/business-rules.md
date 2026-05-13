# Regras de Negocio Iniciais

## Operacoes

As operacoes sao o nucleo do controle operacional inicial.

Regras ja aplicadas:

- toda operacao deve estar vinculada a uma `Portfolio`
- toda operacao deve estar vinculada a um `Asset`
- `settlement_date` nao pode ser anterior a `trade_date`
- `quantity` deve ser maior que zero
- `unit_price`, `fees` e `taxes` nao podem ser negativos
- `gross_value` pode ser calculado automaticamente como `quantity * unit_price`
- `net_value` pode ser calculado automaticamente como `gross_value - fees - taxes`

## Status de operacao

Estados modelados:

- `draft`
- `pending_approval`
- `approved`
- `settled`
- `cancelled`
- `rejected`

Intencao de uso:

- `draft`: lancamento ainda em edicao
- `pending_approval`: aguardando validacao interna
- `approved`: validado para processamento
- `settled`: liquidado financeiramente
- `cancelled`: operacao cancelada
- `rejected`: recusada por regra ou conferencia

## Regras de caixa

O modulo de caixa ja possui CRUD inicial e segue estas regras:

- caixa pode existir sem operacao associada
- caixa pode representar `inflow`, `outflow`, `transfer` e `adjustment`
- `settlement_date` nao pode ser anterior a `entry_date`
- `amount` deve ser maior que zero
- se `operation_id` for informado, a operacao deve pertencer a mesma carteira do evento de caixa
- os status iniciais suportados sao `pending`, `settled` e `cancelled`

## Regras de precificacao

O modulo de pricing ja possui CRUD inicial e segue estas regras:

- todo preco deve estar vinculado a um `Asset`
- `price` nao pode ser negativo
- `source` e obrigatoria
- nao pode existir mais de um preco para a mesma combinacao de `asset`, `price_date` e `source`
- `is_validated` prepara a futura separacao entre preco importado e preco homologado internamente

## Regras de auditoria

Ja foi implementado registro basico de auditoria para:

- `operations`
- `cashflow_entries`
- `asset_prices`
- `report_templates`
- `report_executions`

Em cada um desses dominios:

- criacao gera `AuditLog`
- atualizacao gera `AuditLog`
- exclusao gera `AuditLog`
- os payloads anterior e posterior sao guardados em JSON

Essa trilha ainda e intencionalmente simples, mas ja cria base para governanca, revisao interna e compliance operacional.

## Regras iniciais de usuarios e perfis

O modulo administrativo de usuarios entrou com foco em governanca operacional basica.

Regras aplicadas:

- apenas usuarios com perfil `admin` podem acessar a administracao de usuarios
- criacao e edicao de usuarios ja podem ser feitas pela interface
- o ambiente local pode bootstrapar um usuario nao-admin opcional para validacao da experiencia restrita
- email deve ser unico
- `role=admin` implica privilegio administrativo efetivo
- a plataforma impede a remocao do ultimo admin ativo
- a tela administrativa protege o usuario autenticado contra perda acidental do proprio acesso

## Regras iniciais de posicao

O modulo de posicao entrou como consolidacao read-only, sem tabela dedicada nesta fase.

Regras aplicadas:

- a posicao considera apenas operacoes com status `approved` e `settled`
- o corte temporal usa `trade_date` como data economica inicial
- apenas `buy` e `contribution` aumentam quantidade na consolidacao inicial
- apenas `sell`, `redemption` e `amortization` reduzem quantidade na consolidacao inicial
- `dividend`, `interest`, `coupon`, `fee`, `tax`, `adjustment` e `transfer` nao alteram a quantidade nesta primeira versao
- o custo e consolidado por media ponderada
- a marcacao a mercado usa o ultimo preco disponivel ate a data de referencia
- quando houver preco na mesma data, o fluxo prioriza o registro validado

Observacao importante:

- eventos corporativos mais sofisticados, aluguel, short e transferencia entre carteiras ainda nao receberam tratamento dedicado

## Ideias futuras para risco, posicao, liquidez e relatorios

### Risco

- limites por emissor
- limites por classe de ativo
- exposicao por indexador
- duration e concentracao

### Posicao

- calculo de posicao por carteira e ativo
- posicao por data de referencia
- custo medio e marcacao a mercado
- eventos corporativos e amortizacoes

### Liquidez

- controle de vencimentos
- buckets de liquidez
- projecao de caixa
- agenda de liquidacao

### Relatorios

Nesta etapa, os relatorios passaram a operar com as seguintes regras:

- todo `ReportExecution` deve apontar para um `ReportTemplate` valido
- templates inativos nao podem ser executados
- o worker atualiza o ciclo `queued -> running -> completed | failed`
- artefatos gerados sao gravados no MinIO e nao no banco
- downloads sao autenticados pela API
- o `file_path` persistido representa a chave do objeto no bucket

Proximas expansoes naturais:

- posicoes consolidadas
- extrato operacional por carteira
- relatorio de movimentacao de caixa
- relatorio gerencial por periodo
- filtros por periodo, carteira e dataset
