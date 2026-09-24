# Consumo do contrato OpenAPI

O contrato e propriedade do backend (`backend-centralizador-financeiro`), servido em
`GET /api/v1/openapi.json` e `GET /api/v1/docs`, e versionado em `openapi/openapi.json`
naquele repositorio.

`openapi.snapshot.json` (nesta pasta) e uma copia de referencia do contrato
em `backend @ fa9b62a`. Os tipos em `src/lib/accounts/types.ts` e os schemas em
`src/lib/accounts/schema.ts` sao transcritos a mao e devem acompanhar esse snapshot.
Este cliente nao compartilha fonte nem pacote com o cliente web.

## Cobertura atual

| Rota | Auth | Cliente |
|---|---|---|
| `GET /api/v1/health/live` `/ready` | publico | — |
| `POST /api/v1/accounts` | Bearer JWT (access token Auth0) | `createAccount()` |
| `GET /api/v1/accounts` | Bearer JWT (access token Auth0) | `listAccounts()` |
| `PATCH /api/v1/accounts/{accountId}` | Bearer JWT (access token Auth0) | `updateAccount()` |
| `POST /api/v1/accounts/{accountId}/deactivate` | Bearer JWT (access token Auth0) | `deactivateAccount()` |

`PATCH` e `deactivate` foram introduzidos no backend em `7623c92`. As rotas de Transactions
estao descritas na secao "Transactions (Sprint 2)".

`contract.test.ts` verifica que as operacoes consumidas existem no snapshot, exigem
bearer Auth0 e usam os mesmos campos dos schemas do cliente. Ao atualizar o snapshot, rode
`pnpm test`: mudanca incompativel no contrato quebra esse teste.
Regras em `especificacao-manutencao-isolamento-contas.html` (docs): PATCH parcial e estrito,
saldo inicial e data de referencia somente juntos, conta conectada somente leitura,
desativacao logica e idempotente, sem DELETE e sem reativacao.

Erros seguem Problem Details (RFC 7807) — ver `src/lib/api/errors.ts`.
Codigo `POSSIBLE_CONNECTED_ACCOUNT_DUPLICATE` (409) traz `candidates` e e mapeado
para `PossibleDuplicateAccountError`.

Manutencao de contas: `ACCOUNT_NOT_FOUND` (404) e `ACCOUNT_ARCHIVED` (409) exibem a mesma
mensagem, sem revelar se a conta existe em outro tenant; `CONNECTED_ACCOUNT_READ_ONLY` (409)
bloqueia PATCH de conta conectada. O `detail` do backend (ingles) nunca e exibido: as mensagens
por codigo e por campo (`errors[].path`) ficam em `src/lib/accounts/messages.ts`.

## Transactions (Sprint 2)

Baseline registrado na fase 1 da Sprint 2 do Dev 2, verificado no codigo do backend em
`fa9b62a`. Normativo: `especificacao-transactions.html` (docs); em divergencia, o cliente
segue o OpenAPI e a divergencia fica registrada abaixo.

### Cobertura

| Rota | Cliente | Uso (fase) |
|---|---|---|
| `GET /api/v1/transactions` | `listTransactions()` | lista de movimentacoes (3) |
| `POST /api/v1/transactions` + `Idempotency-Key` | `createTransaction()` | receita e despesa (3) |
| `POST /api/v1/transfers` + `Idempotency-Key` | `createTransfer()` | transferencia contabil (3) |
| `PATCH /api/v1/transactions/{id}/category` | `updateTransactionCategory()` | categorizar, marcar incerta ou nao reconhecida (4) |
| `GET /api/v1/categories` | `listCategories()` | gestao e seletores (4) |
| `POST /api/v1/categories` | `createCategory()` | gestao (4) |
| `PATCH /api/v1/categories/{id}` | `renameCategory()` | gestao; somente ativas (4) |
| `POST /api/v1/categories/{id}/deactivate` | `deactivateCategory()` | arquivar (4) |
| `GET /api/v1/category-rules` | `listCategoryRules()` | regras pessoais (5) |
| `POST /api/v1/category-rules` | `createCategoryRule()` | regras pessoais (5) |
| `PATCH /api/v1/category-rules/{id}` | `updateCategoryRule()` | regras pessoais (5) |
| `POST .../{id}/activate` e `.../{id}/deactivate` | `activateCategoryRule()`, `deactivateCategoryRule()` | regras pessoais (5) |
| `DELETE /api/v1/category-rules/{id}` | `removeCategoryRule()` | remocao sem reativacao (5) |

Modulos: `src/lib/transactions/`, `src/lib/categories/`, `src/lib/category-rules/`;
utilitarios em `src/lib/money.ts`, `src/lib/civil-date.ts`, `src/lib/idempotency.ts` e
`src/lib/api/pagination.ts`. `contract.test.ts` cobre as 14 operacoes.

### Comportamento verificado no backend

- `GET /accounts` retorna somente contas ativas: o historico mostra "Conta indisponivel"
  para conta arquivada.
- `GET /categories` retorna ativas e arquivadas, mais recentes primeiro.
- `GET /category-rules` retorna todas, inclusive removidas: prioridade desc, createdAt asc, id asc.
- `GET /transactions` so aceita `page`/`pageSize` (sem filtros): ordem occurredOn desc, id desc.
  Transferencia aparece como duas linhas (`outgoing` e `incoming`).
- Regras ativas (com categoria ativa) sao aplicadas no `POST /transactions`: o 201 pode trazer
  `categorizationSource: "rule"`. Alterar regra nao reprocessa movimentacoes existentes.
- Nao existe GET por id, void nem retorno a `unclassified`.
- `Idempotency-Key`: nenhum erro consome a chave (ela e gravada na mesma transacao que cria a
  movimentacao). Replay devolve 201 com o recurso original; mesma chave com dados diferentes
  gera 409 `IDEMPOTENCY_KEY_REUSED`; apos 24h, 409 `IDEMPOTENCY_KEY_EXPIRED`.
- Valor: positivo, ate 17 digitos inteiros. Descricao: espacos colapsados, vazia vira `null`,
  sem limite de tamanho. Data: civil real, futuras aceitas. Categoria: 1 a 100 caracteres,
  nomes repetidos aceitos; renomear arquivada gera 400. Regra: comparacao de descricao ignora
  caixa e espacos extras, mas nao acentos; `type` e `accountId` so aceitam `equals`.

### Erros

| Status | Codigo | Quando |
|---|---|---|
| 400 | `INVALID_REQUEST` | formato (com `errors[].path`) ou regra de dominio (sem `errors[]`) |
| 400 | `TRANSFER_ACCOUNTS_MUST_DIFFER` | origem igual ao destino |
| 401 / 403 | `AUTHENTICATION_REQUIRED` / `IDENTITY_CONTEXT_UNAVAILABLE` | sessao ou contexto de identidade |
| 404 | `ACCOUNT_NOT_FOUND`, `TRANSACTION_NOT_FOUND`, `CATEGORY_NOT_FOUND`, `CATEGORY_RULE_NOT_FOUND` | inexistente ou de outro tenant |
| 409 | `ACCOUNT_ARCHIVED`, `CATEGORY_ARCHIVED` | recurso arquivado |
| 409 | `CATEGORY_RULE_CONFLICT` | operacao sobre regra removida |
| 409 | `IDEMPOTENCY_KEY_REUSED`, `IDEMPOTENCY_KEY_EXPIRED` | chave recusada: gerar nova |
| 409 | `TRANSACTION_CATEGORIZATION_NOT_ALLOWED` | categorizar transferencia ou estornada |
| 500 | `INTERNAL_ERROR` | inclui reenvio concorrente da mesma chave em processamento: permitir nova tentativa |

Mensagens pt-BR em `src/lib/transactions/messages.ts`; inexistente e arquivado compartilham
a mesma mensagem.

### Divergencias reportadas ao Dev 1

1. `DELETE /category-rules/{id}` responde 200 com corpo; a especificacao §15 cita "200/204".
2. `CATEGORY_RULE_CONFLICT` significa regra removida, nao conflito de precedencia.
3. `TRANSFER_ACCOUNTS_MUST_DIFFER` e 400; a especificacao nao fixava o status.
4. Criar regra com conta inexistente gera `CATEGORY_NOT_FOUND`; editar gera `ACCOUNT_NOT_FOUND`.
5. Ordem de `GET /categories` (mais recentes primeiro) nao consta da especificacao.

### Decisoes do cliente

- `Idempotency-Key`: `newIdempotencyKey()` usa `randomUUID()` do `expo-crypto` (o Hermes nao
  expoe `crypto.randomUUID`); a chave fica no estado do formulario. Mesma chave em todas as
  tentativas do formulario; nova somente apos sucesso ou `mustRotateIdempotencyKey()`
  (REUSED/EXPIRED), no logout ou na troca de usuario. Nunca compartilhada entre movimentacao e
  transferencia.
- Valor: `parseMoneyInput()` aceita `1.234,56`, `1234,56`, `1234.56` e `1234`, sem `Number`;
  `formatMoney()` exibe `R$ 1.234,56` sem depender de `Intl`. Direcao por texto ou sinal.
- Data: campo de texto `DD/MM/AAAA` convertido por `parseBrazilianDate()`; sem seletor nativo
  (evita dependencia nova). Hoje via `todayCivilDate()`, nunca `toISOString()`.
- Navegacao: troca de telas por estado, sem biblioteca, com barra superior Contas,
  Movimentacoes, Categorias e Regras.
- Transferencia: "Transferencia entre suas contas" com "saida" e "entrada" e o aviso
  "Registro contabil: nao movimenta dinheiro". Nunca "enviar", "Pix" ou "pagar".
- Testes: Vitest para toda a logica; telas pelos roteiros manuais.

## Limitacoes do contrato

- As rotas de contas descrevem request/response inline (fora de `components.schemas`,
  que hoje so contem os schemas de Transactions). Por isso os tipos de contas sao mantidos
  a mao em vez de gerados.
- `servers` esta vazio: a base URL vem do ambiente (`EXPO_PUBLIC_API_BASE_URL`).

## Geracao do cliente tipado — decisao pendente

Nenhuma biblioteca geradora esta aprovada (arquitetura, "Visao da API e validacao").
Enquanto nao houver decisao, o acesso usa `src/lib/api/http-client.ts` + tipos a mao.

| Opcao | Gera | Observacao |
|---|---|---|
| `openapi-typescript` | tipos (`.d.ts`) + `openapi-fetch` | leve; schemas inline geram tipos verbosos porem corretos |
| `@hey-api/openapi-ts` | tipos + SDK de funcoes | plugin de zod opcional |
| `orval` | hooks + zod | util se adotarmos react-query |
| `openapi-generator` (typescript-fetch) | cliente completo | JVM; mais pesado |
