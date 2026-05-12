# Regras de Negócio Iniciais

## Operações

As operações são o núcleo do controle operacional inicial.

Regras já aplicadas ou preparadas:

- toda operação deve estar vinculada a uma `Portfolio`;
- toda operação deve estar vinculada a um `Asset`;
- `settlement_date` não pode ser anterior a `trade_date`;
- `quantity` deve ser maior que zero;
- `unit_price`, `fees` e `taxes` não podem ser negativos;
- `gross_value` pode ser calculado automaticamente como `quantity * unit_price`;
- `net_value` pode ser calculado automaticamente como `gross_value - fees - taxes`.

## Status de operação

Estados modelados:

- `draft`
- `pending_approval`
- `approved`
- `settled`
- `cancelled`
- `rejected`

Intenção de uso:

- `draft`: lançamento ainda em edição;
- `pending_approval`: aguardando validação interna;
- `approved`: validado para processamento;
- `settled`: liquidado financeiramente;
- `cancelled`: operação cancelada;
- `rejected`: recusada por regra ou conferência.

## Regras de caixa

Nesta primeira etapa, o módulo de caixa já existe no modelo, mas ainda não expõe fluxo completo.

Direção adotada:

- caixa deve poder existir sem operação associada;
- caixa deve permitir entradas, saídas, transferências e ajustes;
- liquidação financeira futura poderá ser reconciliada com operações e eventos externos.

## Regras de auditoria

Já foi implementado registro básico de auditoria para operações:

- criação de operação gera `AuditLog`;
- atualização de operação gera `AuditLog`;
- exclusão de operação também fica preparada para rastreabilidade;
- os payloads anterior e posterior são guardados em JSON.

Essa trilha ainda é intencionalmente simples, mas já cria base para governança, revisão interna e compliance operacional.

## Ideias futuras para risco, posição, liquidez e relatórios

### Risco

- limites por emissor;
- limites por classe de ativo;
- exposição por indexador;
- duration e concentração.

### Posição

- cálculo de posição por carteira e ativo;
- posição por data de referência;
- custo médio e marcação a mercado;
- eventos corporativos e amortizações.

### Liquidez

- controle de vencimentos;
- buckets de liquidez;
- projeção de caixa;
- agenda de liquidação.

### Relatórios

- posições consolidadas;
- extrato operacional por carteira;
- relatório de movimentação de caixa;
- relatório gerencial por período;
- exportação assíncrona com arquivos armazenados no MinIO.

