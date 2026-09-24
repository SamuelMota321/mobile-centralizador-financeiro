# Centralizador Financeiro — Mobile

Cliente mobile (React Native + Expo, TypeScript) do MVP acadêmico. Aplicação independente
da web: não compartilha componentes, navegação nem código-fonte. Consome o contrato
OpenAPI do backend sob `/api/v1`.

A Sprint 1 (S1-04 a S1-07) cobre login Auth0, área protegida, logout e a manutenção de
contas manuais: criar, listar, editar e desativar (com confirmação), além do isolamento de
dados entre sessões.

A Sprint 2 (S2-04 a S2-07) acrescenta movimentações (receita, despesa e transferência
contábil entre contas próprias, com Idempotency-Key), categorias pessoais, categorização
manual com estados incerto e não reconhecido, regras pessoais de categorização com
precedência explicada e o isolamento de estado entre sessões. A interface segue o Style
Guide 1.0 (`PRODUCT.md`, `DESIGN.md`): fontes Manrope e Newsreader, tema claro e escuro,
abas embaixo e áreas seguras respeitadas.

O login usa Authorization Code com PKCE (aplicação Auth0 do tipo **Native**, sem client
secret) e o token fica no Keychain/Keystore via `expo-secure-store`.

## Requisitos

| Ferramenta | Versão | Observação |
|---|---|---|
| Node.js | `>=22.12 <27` | veja `.nvmrc` (`22`). Com `nvm`: `nvm install && nvm use` |
| pnpm | 12.x | vem pelo corepack (passo 1) |
| Onde visualizar | — | escolha um: **Expo Go** (celular físico), **emulador Android**, **simulador iOS** (só macOS) ou **navegador** |
| Backend | — | precisa estar no ar para as chamadas à API |

## Passo a passo para rodar

### 1. Habilitar o pnpm

```bash
corepack enable
pnpm -v          # deve imprimir 12.3.4 (ou compatível)
```

Se falhar: `corepack prepare pnpm@12.3.4 --activate`.

### 2. Instalar as dependências

```bash
pnpm install
```

### 3. Subir o backend (pré-requisito para usar a API)

Em outro terminal:

```bash
cd ../backend-centralizador-financeiro
cp .env.example .env          # troque cada replace_me por uma senha local
docker compose up -d --wait   # requer Docker Desktop rodando
curl http://localhost:3000/api/v1/health/ready   # esperado: {"status":"ok"}
```

> O backend usa **npm**, não pnpm. Fora do Docker, use `npm ci` e `npm run start:dev` na
> pasta dele. Um `pnpm install` no backend falha com `ERR_PNPM_IGNORED_BUILDS`.

> **Portas ocupadas?** Se `3000`/`5432` já estiverem em uso, crie
> `backend-centralizador-financeiro/compose.override.yaml`:
>
> ```yaml
> services:
>   api:
>     ports: ["3100:3000"]
>   postgres:
>     ports: ["55432:5432"]
> ```
>
> A API passa a responder em `http://localhost:3100/api/v1`.

### 4. Configurar o ambiente

```bash
cp .env.example .env
```

Ajuste `EXPO_PUBLIC_API_BASE_URL` **de acordo com onde o app vai rodar** — o
significado de `localhost` muda conforme a plataforma:

| Onde você abre o app | Valor de `EXPO_PUBLIC_API_BASE_URL` |
|---|---|
| Navegador (`w`) na mesma máquina | `http://localhost:3000/api/v1` |
| Emulador Android (Android Studio) | `http://10.0.2.2:3000/api/v1` |
| Simulador iOS (macOS) | `http://localhost:3000/api/v1` |
| Celular físico com Expo Go | `http://<IP-da-sua-maquina-na-LAN>:3000/api/v1` |

Troque `3000` por `3100` se você remapeou as portas no passo 3.
Descubra o IP da LAN com `ip addr` (Linux/macOS) ou `ipconfig` (Windows).

O `.env` é ignorado pelo git. Nunca coloque credenciais reais.

### 4.1. Configurar o Auth0

No painel do Auth0, registre uma aplicação do tipo **Native** (PKCE, sem client secret) e
adicione tanto em *Allowed Callback URLs* quanto em *Allowed Logout URLs*:

- `coinciente://*`
- no Expo Go, também a URL `exp://...` que o `pnpm start` imprime no terminal

Preencha no `.env`:

```bash
EXPO_PUBLIC_AUTH0_DOMAIN=seu-tenant.us.auth0.com
EXPO_PUBLIC_AUTH0_CLIENT_ID=...
EXPO_PUBLIC_AUTH0_AUDIENCE=...   # idêntico ao AUTH0_AUDIENCE do backend
```

`EXPO_PUBLIC_AUTH0_AUDIENCE` precisa ser exatamente o mesmo do backend — se divergir, o
backend recusa o token com 401.

A aplicação Native precisa estar **no mesmo tenant Auth0 do backend**: `EXPO_PUBLIC_AUTH0_DOMAIN`
deve ser o host de `AUTH0_ISSUER_BASE_URL` do backend. Um tenant diferente emite tokens com
outro `issuer`, e o backend os recusa com 401 mesmo com audience correta.

### 5. Iniciar o Metro (servidor de desenvolvimento do Expo)

```bash
pnpm start
```

Abre um menu no terminal com um QR code e atalhos. Escolha **uma** forma de abrir:

#### Opção A — Navegador (mais rápido, sem instalar nada)

Tecle `w`. O Expo pergunta se pode instalar `react-native-web` e `react-dom` — aceite
(são o suporte web oficial dele). Abre em `http://localhost:8081`.
Bom para conferir layout; não é um dispositivo real.

#### Opção B — Celular Android físico

1. Instale o app **Expo Go** pela Play Store.
2. Celular e PC na mesma rede Wi-Fi.
3. Escaneie o QR code do terminal com o Expo Go.

No WSL o Metro escuta no IP da VM, que o celular não alcança. Nesse caso use túnel:

```bash
pnpm start --tunnel    # aceite instalar @expo/ngrok se pedir
```

#### Opção C — Emulador Android

Requer **Android Studio** instalado (no Windows, se você usa WSL). Crie um AVD no
Device Manager, inicie o emulador e então:

```bash
pnpm start
# tecle "a"
```

No WSL o `adb` fica no Windows e o Metro no WSL; o caminho simples é rodar
`pnpm start --tunnel` e abrir o **Expo Go dentro do emulador** com a URL do túnel.

#### Opção D — Simulador iOS

Só em macOS com Xcode. `pnpm start`, tecle `i`.

Parar o Metro: `Ctrl+C`.

### 6. Verificar

1. O app abre na tela **Entrar**.
2. Tocar em **Entrar** abre o Auth0 no navegador do sistema e volta ao app autenticado.
3. O app abre em **Movimentações**; as abas embaixo levam a Contas, Categorias e Regras.
   Formulários abrem em tela cheia e o Voltar do Android os fecha. Datas em DD/MM/AAAA.
4. **Sair** limpa a sessão e volta à tela de entrada; nenhum dado da sessão anterior aparece.

## Checagens de qualidade

```bash
pnpm typecheck     # tsc --noEmit
pnpm test          # Vitest
npx expo-doctor    # 21 verificações de compatibilidade do SDK
```

### Testes automatizados

Vitest em ambiente Node: `fetch` e `expo-secure-store` são simulados, sem aparelho nem
credenciais. Os arquivos `*.test.ts` ficam ao lado do código testado.

| Arquivo | O que garante |
|---|---|
| `src/lib/money.test.ts` | entrada pt-BR normalizada e formatação em BRL sem `Number` (sem erro de ponto flutuante) |
| `src/lib/civil-date.test.ts` | data civil sem fuso, anos bissextos, datas inexistentes e DD/MM/AAAA |
| `src/lib/idempotency.test.ts` | chave UUID nova (`expo-crypto`) e quando trocá-la (`REUSED`/`EXPIRED`) |
| `src/lib/api/pagination.test.ts` | leitura de todas as páginas para seletores, com aviso de truncamento |
| `src/lib/api/contract.test.ts` | operações existem no `openapi.snapshot.json`; fixtures de cada resposta validadas contra o snapshot e contra o Zod; enums iguais aos do contrato |
| `src/lib/accounts/*.test.ts` | contas: schema, PATCH só com alterações, mensagens, bearer ausente após logout |
| `src/lib/transactions/*.test.ts` | movimentações: schemas de entrada, chamadas com Idempotency-Key, mensagens |
| `src/lib/categories/api.test.ts`, `src/lib/category-rules/*.test.ts` | categorias e regras: chamadas, gramática da condição e limites de prioridade |
| `src/screens/movement-input.test.ts` | formulários de movimentação: valor, data DD/MM/AAAA, transferência e classificação de erros (quando trocar a chave) |
| `src/screens/movement-presentation.test.ts` | rótulos, sinais, estados de categorização e paginação sem itens repetidos |
| `src/screens/category-logic.test.ts` | nome de categoria repetido e erros de categorias e de categorização |
| `src/screens/rule-logic.test.ts` | frase da regra, gramática, PATCH só com o que mudou e erros de regras |
| `src/auth/session-store.test.ts` | sessão salva e lida do SecureStore; conteúdo corrompido é apagado; expiração no limite exato |
| `src/auth/session-epoch.test.ts` | resposta de sessão anterior (ex.: 401 atrasado) não afeta a sessão atual |

Telas e o fluxo real do Auth0 não têm teste automatizado (exigiriam biblioteca de teste de
componentes ainda não decidida); são verificados pelo roteiro de demonstração abaixo.

## Solução de problemas

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| `pnpm: command not found` | corepack não habilitado | `corepack enable` (passo 1) |
| `Error: EXPO_PUBLIC_API_BASE_URL nao definido` | falta o `.env` | passo 4 |
| app abre mas a API falha | URL errada para a plataforma | reveja a tabela do passo 4 |
| QR code não conecta (WSL / redes diferentes) | Metro no IP da VM | `pnpm start --tunnel` |
| `10.0.2.2` não responde | backend não está no ar | passo 3 |
| mudou o `.env` e não surtiu efeito | Metro faz cache de env | reinicie com `pnpm start -c` |
| login conclui mas a lista dá erro 401 | app Native em outro tenant Auth0 ou audience diferente | confira o passo 4.1: mesmo tenant e audience do backend |
| `Cannot connect to the Docker daemon` no WSL | integração do Docker Desktop com a distro desligada ou travada | Docker Desktop → Settings → Resources → WSL Integration: ative a distro. Se persistir: feche o Docker Desktop, rode `wsl --shutdown` no PowerShell e abra o Docker Desktop de novo |

## Estrutura relevante

| Caminho | Responsabilidade |
|---|---|
| `PRODUCT.md`, `DESIGN.md` | produto e sistema visual derivados do Style Guide |
| `App.tsx` | raiz: carrega as fontes, provê áreas seguras e alterna entre entrada e seções do app |
| `src/auth/` | configuração Auth0, sessão no SecureStore, contexto de autenticação e numeração de sessões |
| `src/screens/` | telas de Movimentações, Contas, Categorias e Regras, formulários e a lógica testável de cada uma |
| `src/ui/` | símbolo, ícones, botões, avisos, etiquetas, campos e as molduras `AppScreen`/`FormScreen` |
| `src/theme.ts` | tokens claro e escuro, pesos da fonte e escala tipográfica |
| `src/lib/api/config.ts` | base URL da API a partir do ambiente |
| `src/lib/api/http-client.ts` | wrapper `fetch` (JSON, injeção de token, erros normalizados) |
| `src/lib/api/CONTRACT.md` | estado do contrato OpenAPI e opções de gerador |
| `src/lib/accounts/` | tipos, Zod de borda, funções da API, diff do PATCH e mensagens por código |
| `src/lib/transactions/`, `categories/`, `category-rules/` | clientes tipados de Transactions, com Zod de borda e mensagens |
| `vitest.config.mts` | configuração dos testes (variáveis fictícias) |

## Demonstração da Sprint 1

Roteiro da parte mobile para a demonstração acadêmica. Use somente dados fictícios e dois
usuários de teste (A e B) do mesmo tenant Auth0 do backend. Não mostre `.env` nem tokens.

| # | Ação | Resultado esperado |
|---|---|---|
| 1 | Abrir o app | tela **Entrar** |
| 2 | Entrar como A | Auth0 no navegador do sistema e retorno à lista (vazia com orientação) |
| 3 | **Criar conta** duas vezes | contas na lista e aviso "Conta criada." |
| 4 | Criar conta com saldo `abc` | erro abaixo do campo, nada é criado |
| 5 | **Editar** uma conta, mudar o nome | volta à lista com "Conta atualizada." |
| 6 | **Editar** e salvar sem mudar nada | "Nenhuma alteração para salvar." |
| 7 | **Desativar** → **Cancelar** no alerta | nada muda |
| 8 | **Desativar** → **Desativar** no alerta | conta some com aviso de desativação |
| 9 | Desativar uma conta pelo web e editá-la no app | "Esta conta não foi encontrada ou não está mais disponível." e lista recarregada |
| 10 | **Sair** e entrar como B | nenhuma conta de A aparece |

## Demonstração da Sprint 2

O roteiro completo (web e mobile, usuários A e B, precedência de regras, reenvio sem
duplicar e isolamento) está em
`documentacao-centralizador-financeiro/prompts/sprint2/dev2/roteiro-demonstracao-sprint-2.md`.
A parte mobile exige a aplicação Auth0 do tipo Native configurada (passo 4.1).

## Ambiente

Todas as variáveis do `.env.example` são obrigatórias. Variáveis com prefixo
`EXPO_PUBLIC_` são embutidas no bundle — **não são segredo**, e por isso a aplicação
Auth0 é do tipo Native: domínio, client ID e audience são identificadores públicos, e não
existe client secret no dispositivo.

O access token fica só no `expo-secure-store` (Keychain no iOS, Keystore no Android),
nunca em log nem em armazenamento comum. `.env` é ignorado pelo git.
