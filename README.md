# Centralizador Financeiro — Mobile

Cliente mobile (React Native + Expo, TypeScript) do MVP acadêmico. Aplicação independente
da web: não compartilha componentes, navegação nem código-fonte. Consome o contrato
OpenAPI do backend sob `/api/v1`.

Esta fase (S1-04 + S1-05) cobre login Auth0, área protegida, logout e as telas de criar
e listar contas.

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
3. A lista de contas aparece (vazia no primeiro acesso) e **Criar conta** funciona.
4. **Sair** limpa a sessão e volta à tela de entrada.

## Checagens de qualidade

```bash
pnpm typecheck     # tsc --noEmit
npx expo-doctor    # 21 verificações de compatibilidade do SDK
```

## Solução de problemas

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| `pnpm: command not found` | corepack não habilitado | `corepack enable` (passo 1) |
| `Error: EXPO_PUBLIC_API_BASE_URL nao definido` | falta o `.env` | passo 4 |
| app abre mas a API falha | URL errada para a plataforma | reveja a tabela do passo 4 |
| QR code não conecta (WSL / redes diferentes) | Metro no IP da VM | `pnpm start --tunnel` |
| `10.0.2.2` não responde | backend não está no ar | passo 3 |
| mudou o `.env` e não surtiu efeito | Metro faz cache de env | reinicie com `pnpm start -c` |

## Estrutura relevante

| Caminho | Responsabilidade |
|---|---|
| `App.tsx` | raiz: alterna entre área pública e protegida pelo estado de autenticação |
| `src/auth/` | configuração Auth0, sessão no SecureStore e o contexto de autenticação |
| `src/screens/` | telas de entrada, listagem e criação de conta |
| `src/theme.ts` | paleta Coinciente |
| `src/lib/api/config.ts` | base URL da API a partir do ambiente |
| `src/lib/api/http-client.ts` | wrapper `fetch` (JSON, injeção de token, erros normalizados) |
| `src/lib/api/CONTRACT.md` | estado do contrato OpenAPI e opções de gerador |
| `src/lib/accounts/` | tipos e Zod de borda para contas |

## Ambiente

Todas as variáveis do `.env.example` são obrigatórias. Variáveis com prefixo
`EXPO_PUBLIC_` são embutidas no bundle — **não são segredo**, e por isso a aplicação
Auth0 é do tipo Native: domínio, client ID e audience são identificadores públicos, e não
existe client secret no dispositivo.

O access token fica só no `expo-secure-store` (Keychain no iOS, Keystore no Android),
nunca em log nem em armazenamento comum. `.env` é ignorado pelo git.
