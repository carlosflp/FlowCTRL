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
- a interface agora permite registrar eventos de caixa diretamente dentro da carteira ativa
- o vinculo opcional com operacao na UI usa apenas operacoes visiveis dentro do mesmo escopo de carteira

## Regras de precificacao

O modulo de pricing ja possui CRUD inicial e segue estas regras:

- todo preco deve estar vinculado a um `Asset`
- `price` nao pode ser negativo
- `source` e obrigatoria
- nao pode existir mais de um preco para a mesma combinacao de `asset`, `price_date` e `source`
- `is_validated` prepara a futura separacao entre preco importado e preco homologado internamente
- a interface agora permite registrar novos precos a partir da carteira ativa, usando os ativos atualmente relevantes nesse escopo

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
- quando a acao parte de um usuario autenticado, o `user_id` do ator e persistido no log

Cobertura atual de atribuicao do ator autenticado:

- `operations`
- `cashflow_entries`
- `asset_prices`
- `report_templates`
- `report_executions`
- `users`

Essa trilha ainda e intencionalmente simples, mas ja cria base para governanca, revisao interna e compliance operacional.

Expansao aplicada nesta etapa:

- administradores agora podem consultar a trilha por tela dedicada e endpoint read-only
- a exploracao pode ser filtrada por `entity_type`, `action`, `user_id`, periodo e busca textual
- a resposta da API agora inclui resumo do ator autenticado para facilitar leitura operacional no frontend

## Regras iniciais de usuarios e perfis

O modulo administrativo de usuarios entrou com foco em governanca operacional basica.

Regras aplicadas:

- apenas usuarios com perfil `admin` podem acessar a administracao de usuarios
- criacao e edicao de usuarios ja podem ser feitas pela interface
- o ambiente local pode bootstrapar um usuario nao-admin opcional para validacao da experiencia restrita
- email deve ser unico
- `role=admin` implica privilegio administrativo efetivo
- usuarios nao-admin passam a operar apenas dentro das carteiras explicitamente atribuidas
- administradores continuam com acesso global a todas as carteiras
- a atribuicao de carteiras agora faz parte do fluxo de criacao e edicao de usuarios
- a plataforma impede a remocao do ultimo admin ativo
- a tela administrativa protege o usuario autenticado contra perda acidental do proprio acesso

## Regras iniciais de autosservico da conta

Foi adicionada uma trilha de manutencao do proprio cadastro para usuarios autenticados.

Regras aplicadas:

- qualquer usuario autenticado pode consultar seus proprios dados por `/auth/me`
- qualquer usuario autenticado pode atualizar apenas `full_name` e `email` no proprio cadastro
- alteracao de perfil, ativacao da conta e privilegios administrativos continuam restritos a tela de usuarios
- troca de senha exige confirmacao da senha atual
- a nova senha nao pode ser igual a senha atual
- alteracoes feitas pelo proprio usuario continuam gerando trilha de auditoria no dominio `user`

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
- o formato do artefato passou a ser escolha da execucao, e nao identidade fixa do template
- templates padrao agora representam datasets reaproveitaveis, nao variacoes por tipo de arquivo
- filtros de periodo usam apenas datasets com base temporal explicita
- filtro por carteira so pode ser aplicado a datasets que realmente possuem escopo por carteira
- selecao de colunas deve respeitar o conjunto permitido de cada dataset
- quando nenhuma coluna customizada e enviada, a exportacao usa o conjunto padrao completo do dataset
- o template especial de `Relatorio Personalizado` pode sobrescrever o dataset na execucao
- sobrescrita de dataset nao e permitida em templates comuns

## Escopo ativo por carteira

Foi introduzido um escopo global de carteira para a navegacao autenticada.

Regras aplicadas:

- depois do login, o usuario entra primeiro na tela de selecao de carteiras acessiveis
- a carteira escolhida passa a ser a carteira ativa da sessao
- `dashboard`, `assets`, `operations`, `cashflow`, `pricing`, `positions` e `reports` passam a ler dados dentro desse escopo
- a troca de carteira pode ser feita a qualquer momento pela entrada `Carteiras` no menu lateral
- se o usuario perder acesso a carteira ativa, a selecao local e descartada e ele volta ao fluxo de escolha

## Lancamentos operacionais no frontend

Foi adicionada uma primeira camada de escrita operacional diretamente pela interface protegida.

Regras aplicadas:

- usuarios `admin`, `manager` e `analyst` podem registrar operacoes, eventos de caixa e precos
- usuarios `viewer` continuam em leitura apenas
- o formulario de operacoes sempre usa a carteira ativa e um catalogo de ativos de referencia do backend
- o formulario de caixa sempre usa a carteira ativa e pode se vincular a uma operacao visivel nesse mesmo escopo
- o formulario de precos atualiza a base de precificacao dos ativos relevantes para a carteira ativa
- apos cada lancamento, a interface invalida consultas relacionadas para refletir o novo estado em dashboard, listas, posicoes e relatorios

## Manutencao operacional no frontend

As telas operacionais agora tambem cobrem o ciclo de manutencao dos registros criados.

Regras aplicadas:

- `operations`, `cashflow` e `pricing` agora possuem acao de edicao diretamente na tabela
- a edicao sempre acontece dentro da carteira ativa, sem reabrir o escopo por fora da sessao atual
- `operations` e `cashflow` agora permitem cancelamento rapido pela propria listagem
- registros ja cancelados continuam editaveis, mas a acao rapida de cancelamento fica desabilitada
- exclusao continua restrita a perfis `admin` e `manager`, refletindo a mesma regra do backend
- apos editar, cancelar ou excluir, a interface invalida as consultas dependentes para manter `dashboard`, `posicoes`, `pricing`, `cashflow`, `operations` e `reports` consistentes

Proximas expansoes naturais:

- posicoes consolidadas
- extrato operacional por carteira
- relatorio de movimentacao de caixa
- relatorio gerencial por periodo
- filtros por periodo, carteira e dataset
