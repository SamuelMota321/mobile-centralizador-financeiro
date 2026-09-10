# Consumo do contrato OpenAPI

O contrato e propriedade do backend (`backend-centralizador-financeiro`), servido em
`GET /api/v1/openapi.json` e `GET /api/v1/docs`, e versionado em `openapi/openapi.json`
naquele repositorio.

## Estado atual (bloqueio de S1-03)

O contrato publicado hoje expoe **apenas** `/api/v1/health/live` e `/api/v1/health/ready`
e nao tem schemas em `components`. Nao ha endpoints nem modelos de `users`, `tenants`
ou `accounts`.

Por isso, nesta fase:

- `src/lib/accounts/types.ts` e `src/lib/accounts/schema.ts` sao **provisorios**,
  alinhados ao Modelo de Dados Identity e Accounts 1.0 e ao schema inbound do backend.
- Nenhum cliente tipado foi gerado.
- Testes de contrato (Dev 3) dependem do contrato completo.

Desbloqueio: fase 3 do Dev 1 (S1-05) publica `/api/v1/accounts` e os schemas no OpenAPI.

## Geracao do cliente tipado — decisao pendente

Nenhuma biblioteca geradora esta aprovada (arquitetura, "Visao da API e validacao").
Este cliente nao compartilha fonte nem pacote com o cliente web: quando o contrato
estiver completo, a geracao roda de forma independente aqui.

| Opcao | Gera | Observacao |
|---|---|---|
| `openapi-typescript` | apenas tipos (`.d.ts`) + `openapi-fetch` runtime | leve; combina com o wrapper atual |
| `@hey-api/openapi-ts` | tipos + SDK de funcoes | ativo, plugin de zod opcional |
| `orval` | hooks + zod | mais opinativo |
| `openapi-generator` (typescript-fetch) | cliente completo | JVM; mais pesado |

Ate a decisao, o acesso a API usa `src/lib/api/http-client.ts` com tipos escritos a mao.
