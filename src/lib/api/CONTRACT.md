# Consumo do contrato OpenAPI

O contrato e propriedade do backend (`backend-centralizador-financeiro`), servido em
`GET /api/v1/openapi.json` e `GET /api/v1/docs`, e versionado em `openapi/openapi.json`
naquele repositorio.

O [snapshot local](openapi.snapshot.json) registra as operações incorporadas a
este cliente. As revisões de origem e a comparação com o backend estão abaixo.
Este cliente nao compartilha fonte nem pacote com o cliente web.

## Contrato vigente conferido em 24/11/2026

Referência da comparação estática `backend b9f6a7a`. Os tipos e schemas do
cliente são mantidos localmente à mão. Os testes em
[contract.test.ts](contract.test.ts) usam o snapshot local. A correspondência
com o backend depende da revisão e da operação comparadas.

### Pluggy

O [snapshot mobile](openapi.snapshot.json) entrou em `3440ca6` e corresponde
integralmente ao OpenAPI de `605cb07`. O backend vigente tem 40 operações.
Das 28 presentes no snapshot, 26 mantêm a mesma definição. As duas alterações
são a conclusão e o detalhe da conexão.

| Operação em `/api/v1` | Resposta publicada no backend vigente | Consumo mobile |
|---|---|---|
| `POST /connections/pluggy/sessions` | `201` com conexão, Connect Token e vencimento | Compatível no recorte verificado. |
| `POST /connections/pluggy/completions` | `202` com `connection` e `initialImport`. `Idempotency-Key` obrigatória. | Bloqueado. O mobile envia só `itemId`. O controller rejeita a falta da chave com `400`. O parser espera uma conexão no corpo e o teste local fixa `200` sem chave. |
| `GET /connections/{connectionId}` | `200` com detalhe e `initialImport` anulável | O schema antigo lê a conexão e descarta `initialImport`. A tela não acompanha o run inicial. |
| `POST /connections/{connectionId}/disconnect` | `200` com conexão | Compatível no recorte verificado. |
| `PUT /connections/{connectionId}/accounts/{providerAccountId}/mapping` | `200` com `accountId` e `initialImport` atualizado. Corpo `link` com `accountId` ou `create`. | Bloqueado no mobile. Snapshot, API e tela ainda não oferecem mapeamento. |

**Encaminhamento ao Dev 2.** Gerar uma `Idempotency-Key` por conclusão Pluggy
e reaproveitar a mesma chave com o mesmo `itemId` em retries. Alinhar schema,
tratamento do `202` e consulta de `initialImport`. Cobrir em tarefa própria o
mapeamento explícito e o acompanhamento de `queued`, `processing`,
`awaiting_account_mapping`, `completed`, `completed_with_errors` e `failed`,
além da disponibilidade separada de contas e transações. A evidência estática
fica na auditoria atual do Dev 3, achados B01 e P02-01.

Para uma movimentação manual, `MovementFormScreen` já cria um UUID com
`expo-crypto` e o envia no `POST /transactions`. As movimentações coletadas pelo
Pluggy são gravadas e deduplicadas no backend por identidade da movimentação
na conexão e conta externas.

### OFX

O upload da prévia recebe `file` e `destinationAccountId` e retorna `201`. A
confirmação recebe o mesmo destino em JSON, processa de forma síncrona e retorna
`200`. As duas escritas exigem `Idempotency-Key`. A consulta por `importRunId`
retorna `200` sem chave. Os três caminhos têm a mesma definição no snapshot e
no OpenAPI vigente. O schema do cliente representa `preview_ready`, `queued`,
`processing`, `completed`, `completed_with_errors`, `failed` e `expired`.

A S3-08 prevê seleção da conta após a leitura do arquivo, antes da prévia final,
e vencimento em 24 horas. A API atual exige conta manual ativa do tenant já no
upload. O seletor do cliente lista contas ativas, incluindo as conectadas, que
o backend recusa como destino OFX com `409`. O estado `awaiting_account_mapping`
e o campo `expiresAt` da prévia estão ausentes do contrato OFX. O enum `expired`
representa um estado previsto, sem validação de idade localizada na confirmação.
O `retentionExpiresAt` registra o prazo de metadados/resultados, calculado em 90
dias após um estado terminal. O código tenta excluir a origem do R2 no caminho
de confirmação terminal. A limpeza de prévias abandonadas e o expurgo dos
resultados seguem sem evidência nesta revisão.

Os erros publicados seguem Problem Details. Na prévia, `413` indica arquivo
acima do limite da API, `415` mídia não suportada e `422` OFX inválido.
`409` também abrange conflitos de conta, execução e idempotência. A API limita
o arquivo a 10 MiB. O mobile aplica o mesmo limite de 10 MiB.

### HU-008 — sincronização recorrente

O backend publica `POST /api/v1/connections/{connectionId}/sync-runs`
(`202`), `GET` por `runId` (`200`), `GET .../sync-runs/latest` (`200`) e
`POST .../update-session` (`200`). A solicitação `POST .../sync-runs` não pede
`Idempotency-Key`. Durante uma execução ativa, a API reaproveita essa execução
para a conexão. A publicação e o consumo desses caminhos estão registrados na
auditoria atual do Dev 3, P02-04. As quatro rotas estão ausentes do snapshot.

O checkout mobile ainda não tem chamadas nem schemas para as rotas HU-008.
O consumo e a experiência de retomada são encaminhados ao Dev 2. A execução
real e o aceite são pendentes.

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
bearer Auth0 e usam os campos verificados nos schemas do cliente. Ao atualizar o snapshot, rode
`pnpm test` e confira o diff contra o OpenAPI da revisão de origem.
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

> **Registro histórico.** A seção abaixo descreve os contratos usados na entrega
> de outubro de 2026, com as limitações e hipóteses daquele momento. Para o
> comportamento vigente e os bloqueios, consulte a comparação acima.

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

## Sprint 4 HU-008 — baseline de conexao e execucao

### Levantamento historico do checkout local

Este registro descreve exclusivamente o checkout local em 2026-10-26, antes da integracao de origin/main (87716de). O texto foi preservado como evidencia historica e nao descreve o estado apos este merge.

Levantamento do cliente mobile em 2026-10-26. O codigo atual nao possui fluxo Pluggy nem chamadas para rotas de conexao ou `sync-runs`; buscas por `connectionId`, `runId` e `statusUrl` em `src` e `App.tsx` nao encontraram usos.

- `connectionId`: o cliente nao tem origem/recebimento, persistencia ou recuperacao desse identificador. A tela de contas e a API `/accounts` tratam de contas financeiras, nao de conexoes Pluggy.
- `runId` e `statusUrl`: nao ha chamada para iniciar ou consultar uma execucao, nem estado persistido para retomar seu acompanhamento ao sair e voltar ao fluxo.
- `src/auth/session-store.ts` salva no SecureStore somente `accessToken` e `expiresAt`; esse armazenamento nao contem estado de conexao ou execucao. A secao inicial em `App.tsx` e estado em memoria e nao recupera um alvo de conexao.
- O contrato deste cliente nao inclui listagem de conexoes. Nenhuma listagem deve ser presumida para recuperar `connectionId`.

Evidencias: cobertura atual deste arquivo; `src/auth/session-store.ts`; `src/auth/AuthContext.tsx`; `App.tsx`; `src/lib/api/openapi.snapshot.json` (snapshot de referencia do cliente).

Status: dependencia do cliente pendente. Quando o fluxo for integrado, a origem e a recuperacao de `connectionId`, bem como a manutencao de `runId`/`statusUrl`, devem seguir o OpenAPI vigente do backend. Este levantamento nao define rota, armazenamento ou polling.

### Situacao apos a integracao (2026-10-28)

- Os fluxos OFX e Pluggy da Sprint 3 agora estao presentes neste checkout, incluindo src/lib/ingestions/ e src/lib/connections/. A secao Sprint 3 acima preserva as referencias e limitacoes do contrato usado naquela entrega.
- O fluxo em src/screens/ConnectScreen.tsx recebe a conexao do backend e a mantem no estado da tela. Isso nao implementa persistencia de connectionId para retomada apos fechar a tela ou reiniciar o app.
- HU-008 continua pendente: nao foram encontradas chamadas sync-runs, nem acompanhamento por runId/statusUrl. Nao presumir listagem de conexoes para implementar a retomada.
- Este merge nao atualiza o snapshot cliente para o backend atual. A compatibilidade da conclusao Pluggy e do mapeamento de contas precisa ser revalidada; os testes contra o snapshot local nao comprovam essa integracao.
