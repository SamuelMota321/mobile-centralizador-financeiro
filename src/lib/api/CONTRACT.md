# Consumo do contrato OpenAPI

O contrato e propriedade do backend (`backend-centralizador-financeiro`), servido em
`GET /api/v1/openapi.json` e `GET /api/v1/docs`, e versionado em `openapi/openapi.json`
naquele repositorio.

`openapi.snapshot.json` (nesta pasta) e uma copia de referencia do contrato
em `backend @ 17ca76d`. Os tipos em `src/lib/accounts/types.ts` e os schemas em
`src/lib/accounts/schema.ts` sao transcritos a mao e devem acompanhar esse snapshot.
Este cliente nao compartilha fonte nem pacote com o cliente web.

## Cobertura atual

| Rota | Auth | Cliente |
|---|---|---|
| `GET /api/v1/health/live` `/ready` | publico | — |
| `POST /api/v1/accounts` | Bearer JWT (access token Auth0) | `createAccount()` |
| `GET /api/v1/accounts` | Bearer JWT (access token Auth0) | `listAccounts()` |

Erros seguem Problem Details (RFC 7807) — ver `src/lib/api/errors.ts`.
Codigo `POSSIBLE_CONNECTED_ACCOUNT_DUPLICATE` (409) traz `candidates` e e mapeado
para `PossibleDuplicateAccountError`.

## Limitacoes do contrato

- `components.schemas` esta vazio: os schemas de request/response estao inline em
  cada rota. Por isso os tipos sao mantidos a mao em vez de gerados.
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
