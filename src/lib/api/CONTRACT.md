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

`PATCH` e `deactivate` foram introduzidos no backend em `7623c92`. O snapshot tambem contem
as rotas de Transactions da Sprint 2, ainda nao consumidas por este cliente.

`contract.test.ts` verifica que as quatro operacoes de contas existem no snapshot, exigem
bearer Auth0 e usam os mesmos campos de `accountSchema`. Ao atualizar o snapshot, rode
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
