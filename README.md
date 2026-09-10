# Centralizador Financeiro — Mobile

Cliente mobile (React Native + Expo, TypeScript) do MVP acadêmico. Aplicação independente
da web: não compartilha componentes, navegação nem código-fonte. Consome o contrato
OpenAPI do backend sob `/api/v1`.

Esta fase (S1-02 + parcial S1-03) cobre a fundação: bootstrap, configuração de ambiente,
wrapper HTTP e camada de dados provisória alinhada ao contrato. Autenticação Auth0 e as
telas de contas pertencem a fases posteriores — hoje o app sobe com a tela padrão do
template.

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

Com o app aberto, você vê a tela padrão "Open up App.tsx to start working on your
app!". Isso confirma que o bundler compila e o app renderiza.

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
| `App.tsx` | tela raiz (template) |
| `src/lib/api/config.ts` | base URL da API a partir do ambiente |
| `src/lib/api/http-client.ts` | wrapper `fetch` (JSON, injeção de token, erros normalizados) |
| `src/lib/api/CONTRACT.md` | estado do contrato OpenAPI e opções de gerador |
| `src/lib/accounts/` | tipos e Zod de borda **provisórios** para contas |

## Ambiente

`EXPO_PUBLIC_API_BASE_URL` é obrigatória. Variáveis com prefixo `EXPO_PUBLIC_` são
embutidas no bundle — não são segredo. Credenciais do Auth0 entram na fase 3 e nunca
são versionadas. `.env.example` não contém credenciais.
