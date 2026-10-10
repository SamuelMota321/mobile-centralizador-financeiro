# Consumo do contrato OpenAPI

O contrato e propriedade do backend (`backend-centralizador-financeiro`), servido em
`GET /api/v1/openapi.json` e `GET /api/v1/docs`, e versionado em `openapi/openapi.json`
naquele repositorio.

`openapi.snapshot.json` (nesta pasta) e uma copia de referencia do contrato
em `backend @ 2c416cd`. Os tipos em `src/lib/accounts/types.ts` e os schemas em
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
`CATEGORY_RULE_CONFLICT` (409) na desativacao indica que a conta ainda e condicao de uma regra
ativa: a mensagem orienta desativar ou remover a regra antes.

## Transactions (Sprint 2)

Baseline registrado na fase 1 da Sprint 2 do Dev 2, verificado no codigo do backend em
`fa9b62a` e atualizado para `e95d2af` (ver "Mudancas em e95d2af").
Normativo: `especificacao-transactions.html` (docs); em divergencia, o cliente
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
  nome repetido gera 409 `CATEGORY_ALREADY_EXISTS`; renomear arquivada gera 400. Regra: comparacao de descricao ignora
  caixa e espacos extras, mas nao acentos; `type` e `accountId` so aceitam `equals`.

### Erros

| Status | Codigo | Quando |
|---|---|---|
| 400 | `INVALID_REQUEST` | formato (com `errors[].path`) ou regra de dominio (sem `errors[]`) |
| 400 | `TRANSFER_ACCOUNTS_MUST_DIFFER` | origem igual ao destino |
| 401 / 403 | `AUTHENTICATION_REQUIRED` / `IDENTITY_CONTEXT_UNAVAILABLE` | sessao ou contexto de identidade |
| 404 | `ACCOUNT_NOT_FOUND`, `TRANSACTION_NOT_FOUND`, `CATEGORY_NOT_FOUND`, `CATEGORY_RULE_NOT_FOUND` | inexistente ou de outro tenant |
| 409 | `ACCOUNT_ARCHIVED`, `CATEGORY_ARCHIVED` | recurso arquivado |
| 409 | `CATEGORY_RULE_CONFLICT` | operacao sobre regra removida; ou desativar conta que e condicao de regra ativa |
| 409 | `CATEGORY_ALREADY_EXISTS` | nome de categoria repetido (exato, inclusive arquivada) |
| 409 | `IDEMPOTENCY_KEY_REUSED`, `IDEMPOTENCY_KEY_EXPIRED` | chave recusada: gerar nova |
| 409 | `TRANSACTION_CATEGORIZATION_NOT_ALLOWED` | categorizar transferencia ou estornada |
| 500 | `INTERNAL_ERROR` | inclui reenvio concorrente da mesma chave em processamento: permitir nova tentativa |

Mensagens pt-BR em `src/lib/transactions/messages.ts`; inexistente e arquivado compartilham
a mesma mensagem.

### Mudancas em e95d2af

Correcoes do Dev 1 apos a auditoria da Sprint 2 (`auditorias/auditoria-sprint-2-dev-1.md`):

- `priority` das regras ganhou `maximum: 2147483647`, o mesmo limite ja aplicado pelo cliente
  (`MAX_RULE_PRIORITY`); `contract.test.ts` confere que os dois continuam iguais.
- `POST /accounts/{id}/deactivate` recusa com 409 `CATEGORY_RULE_CONFLICT` quando uma regra
  ativa usa a conta como condicao.
- Nome de categoria repetido deixou de gerar 500 e passou a 409 `CATEGORY_ALREADY_EXISTS`,
  exibido como erro do campo nome.

Com isso, tres divergencias reportadas antes ficaram resolvidas: prioridade sem limite, regra
aceitando conta arquivada e 500 no nome repetido.

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

## Sprint 3

Baseline da Fase 1 do Dev 2 (2026-10-07), atualizado com o contrato backend S3-01 do Dev 1
(`docs/planejamento/sprint-03/contrato-backend-s3-01.html`) e, em 2026-10-09, com o OpenAPI do
backend em `2c416cd`, que publica as rotas de OFX, e depois em `605cb07`, que publica as rotas de
conexao Pluggy. Em divergencia, o cliente segue o OpenAPI.
O plano da S3-08 (docs @ `1f68771`) registra a reconciliacao em curso.

Consolidacao da Fase 5 do Dev 2 (2026-10-10): `openapi.snapshot.json` e identico ao
`openapi/openapi.json` do backend em **`605cb07`** (HEAD de `origin/main`). Nenhuma funcao segue
como Proposed; o que falta no contrato esta em "Divergencias e pendencias com o Dev 1".

### Operacoes

| Operacao | Cliente | Status |
|---|---|---|
| `POST /api/v1/ingestions/ofx/previews` (multipart: `file` e `destinationAccountId`) + `Idempotency-Key` | `createOfxPreview()` | Approved — OpenAPI @ 2c416cd |
| `POST /api/v1/ingestions/{importRunId}/confirmations` (JSON: `destinationAccountId`) + `Idempotency-Key` | `confirmImport()` | Approved — OpenAPI @ 2c416cd |
| `GET /api/v1/ingestions/{importRunId}` | `getImportRun()` | Approved — OpenAPI @ 2c416cd |
| `POST /api/v1/connections/pluggy/sessions` (sem corpo) | `startPluggySession()` | Approved — OpenAPI @ 605cb07 |
| `POST /api/v1/connections/pluggy/completions` (JSON: `itemId`) | `completePluggyConnection()` | Approved — OpenAPI @ 605cb07 |
| `GET /api/v1/connections/{connectionId}` | `getConnection()` | Approved — OpenAPI @ 605cb07 |
| `POST /api/v1/connections/{connectionId}/disconnect` (sem corpo) | `disconnectConnection()` | Approved — OpenAPI @ 605cb07 |
| `PUT /api/v1/connections/{connectionId}/accounts/{providerAccountId}/mapping` | — | contrato S3-01; fora do OpenAPI (S3-08) |

Modulos: `src/lib/ingestions/` e `src/lib/connections/`. Os schemas de ingestao sao inline no OpenAPI (fora de
`components.schemas`) e transcritos a mao. `contract.test.ts` cobre as tres operacoes: bearer,
`Idempotency-Key` obrigatoria na previa e na confirmacao, campos do multipart e da confirmacao,
campos exatos do ImportRun e do item, enums e dados ficticios validados contra o snapshot. O bloco
de Connections cobre as quatro operacoes de conexao: bearer, nenhuma `Idempotency-Key`, corpos,
campos exatos da conexao e do consentimento, enums e dados ficticios.
Na Fase 5 entraram fixtures para os estados que faltavam (ImportRun `expired` e `failed`;
conexao `partially_available`, `revoked` e `disconnected`) e a paridade do `provider`.

### Comportamento verificado no backend (@ 2c416cd)

- A conta de destino vai junto com o arquivo; a previa ja traz `isDuplicate` por item, calculado
  para essa conta. A confirmacao repete `destinationAccountId`.
- Previa responde 201 e confirmacao 200 (fluxo sincrono; nenhum 202 publicado ainda).
- Estados do ImportRun: `preview_ready`, `queued`, `processing`, `completed`,
  `completed_with_errors`, `failed`, `expired`. Item: `previewed`, `imported`, `ignored_duplicate`,
  `failed`. `warnings` e uma lista de texto aberta; o aviso conhecido e `external_id_missing`.
- OFX 1.x SGML e 2.x XML, em ASCII ou UTF-8; PDF recusado; limite do backend 10 MiB.
- `retentionExpiresAt` e o fim da retencao dos metadados (90 dias), nao a validade da previa.
- Erros: arquivo e estado saem como `INVALID_REQUEST`, distinguidos pelo status (400, 404, 409,
  413, 415, 422); `ACCOUNT_NOT_FOUND` (404), `ACCOUNT_ARCHIVED` (409), `IDEMPOTENCY_KEY_REUSED` e
  `IDEMPOTENCY_KEY_EXPIRED` (409); armazenamento indisponivel e 503 `INTERNAL_ERROR`.
- Sem as variaveis `R2_*` no backend, a previa responde 503: o teste local de ponta a ponta
  depende de um bucket de desenvolvimento.

### Comportamento verificado no backend (@ 605cb07) — conexoes

- A sessao cria uma conexao `pending_authorization` e devolve o `connectToken` limitado (30 min).
  O cliente usa o token so para abrir o widget e nao o guarda.
- A conclusao recebe o `itemId` do widget; o backend busca o item no Pluggy, confere que ele e
  desta pessoa e deste tenant e reaplica o estado. Reenviar o mesmo `itemId` e seguro, embora
  a rota nao peca `Idempotency-Key` (diferente do S3-01). Responde 200, sem importacao inicial.
- Estados da conexao: `pending_authorization`, `connected`, `partially_available`, `expired`,
  `revoked`, `disconnected`. Consentimento: `granted`, `expired`, `revoked`, ou nulo antes da
  autorizacao; `products` e uma lista aberta de produtos do Pluggy.
- Erros: `CONNECTION_NOT_FOUND` (404), `CONNECTION_CONFLICT` (409), `INTEGRATION_UNAVAILABLE`
  (503), alem de `INVALID_REQUEST` e dos erros de sessao.
- O backend cria o token sem `oauthRedirectUri`: o retorno do OAuth por deep link nao e
  configuravel pelo cliente.

### Divergencias e pendencias com o Dev 1 (S3-08)

1. Validade de 24 horas da previa: decidida na S3-08, mas `expiresAt` nao esta no OpenAPI; a
   expiracao so aparece como 404/409 ou status `expired`.
2. `awaiting_account_mapping` e a operacao de mapeamento de contas (S3-08 e D12) nao existem no
   backend. Se o fluxo OFX passar a "arquivo primeiro, conta depois", `createOfxPreview()` muda.
3. Nao ha motivo de duplicidade: o item traz so `isDuplicate`, sem enum de motivos.
4. Nao ha `GET /connections`: a tela mostra so a conexao do fluxo atual.
5. Importacao inicial da conexao Pluggy nao existe; a conclusao responde sem importar nada.
6. Conclusao sem `Idempotency-Key` (o S3-01 pedia uma); o reenvio do mesmo `itemId` e seguro
   pelo codigo do backend.
7. Cada sessao aberta e cancelada deixa uma conexao `pending_authorization` no backend.
8. O connect token e criado sem `oauthRedirectUri`; o retorno do OAuth pelo scheme `coinciente`
   nao e possivel.
9. A confirmacao nao devolve os ids das transacoes criadas, e `errorCode` dos itens nao tem lista
   publicada.

Bloqueios de ambiente: sem `R2_*` no backend local a previa responde 503; sem `PLUGGY_CLIENT_ID` e
`PLUGGY_CLIENT_SECRET` o Sandbox nao e chamado. Regra de conta "correspondente" (D12) e decisao D3
dependem do Dev 3. Perguntas registradas na secao 11 de
`docs/planejamento/sprint-03/s3-01-necessidades-dos-clientes.md`.

### Decisoes do cliente

- O app envia o arquivo direto ao backend com o token, sem servidor intermediario; vale o limite
  do backend, 10 MiB.
- `apiRequest()` repassa `FormData` sem `JSON.stringify` e sem `content-type` (o React Native
  define o boundary); corpos JSON nao mudam. O arquivo entra no `FormData` como
  `{ uri, name, type }`, o formato que o React Native aceita; `type` e omitido quando o seletor
  nao informa.
- Validacao local do arquivo (`checkOfxFile()`): vazio, PDF e acima de 10 MiB. E so ajuda de uso;
  quem decide e o backend.
- Erros: `ingestionErrorMessage()` traduz primeiro os codigos especificos (conta, idempotencia,
  sessao) e depois o status HTTP. O `detail` nunca e exibido.
- Importacao e conexao abrem como `FormScreen` a partir de `AccountsScreen` (fases 3 e 4), sem
  aba nova em `Section` (`src/ui/screens.tsx`).
- `expo-document-picker@57.0.3` instalado na fase 3 (`OfxImportScreen`).
- Fase 4: `react-native-pluggy-connect@1.6.0` e o peer `react-native-webview@13.16.1` (versao do
  Expo SDK 57, incluida no Expo Go) instalados. O OAuth abre em WebView dentro do app
  (`forceOauthInBrowser={false}`), sem depender do retorno pelo scheme `coinciente`, que exigiria
  `oauthRedirectUri` no backend e development build. O peer opcional `pluggy-js` nao e instalado:
  o payload do widget e tratado como `unknown` e so `item.id` e lido.
- `ConnectScreen` guarda token, item e conexao so no estado da tela; nada vai para SecureStore
  ou AsyncStorage.

### Isolamento (Fase 5)

- Ao sair, `Root` (`App.tsx`) troca para `SignInScreen` e desmonta todas as telas: previa,
  confirmacao, arquivo escolhido e estado do widget somem. `SessionEpoch` impede que um 401
  atrasado encerre a sessao seguinte.
- Nada de importacao ou conexao vai para SecureStore ou AsyncStorage (o SecureStore guarda so a
  sessao Auth0); nao ha `console.*` no codigo de producao. O `detail` do backend nunca e exibido.
- Importacao ou conexao de outro tenant responde 404, com o mesmo texto de uma inexistente.
- Fora do controle do app: as WebViews de `react-native-pluggy-connect@1.6.0` mantem cookies de
  proposito (o OAuth das instituicoes retoma a sessao aberta no widget). Num aparelho
  compartilhado, cookies da instituicao podem passar ao proximo usuario; limpar exige dependencia
  nativa nova, fora do Expo Go (decisao pendente). O SDK tambem faz `console.error` com
  `error.message` quando falha ao abrir a URL de OAuth.
