# Centralizador Financeiro — Mobile

Cliente mobile (React Native + Expo, TypeScript) do MVP academico. Aplicacao independente
da web: nao compartilha componentes, navegacao nem codigo-fonte. Consome o contrato
OpenAPI do backend sob `/api/v1`.

Esta fase (S1-02 + parcial S1-03) cobre a fundacao: bootstrap, configuracao de ambiente,
wrapper HTTP e camada de dados provisoria alinhada ao contrato. Autenticacao Auth0 e as
telas de contas pertencem a fases posteriores.

## Requisitos

- Node.js na faixa de `package.json` (`>=22.12 <27`); use `.nvmrc`.
- pnpm via corepack: `corepack enable`.
- App Expo Go ou emulador Android / simulador iOS.
- Backend acessivel (por padrao `http://localhost:3000/api/v1`).

## Execucao local

```bash
corepack enable
pnpm install
cp .env.example .env   # ajuste EXPO_PUBLIC_API_BASE_URL conforme o ambiente
pnpm start
```

`localhost` aponta para o proprio aparelho. Em emulador Android use `http://10.0.2.2:3000/api/v1`;
em dispositivo fisico use o IP da maquina na LAN. Detalhes no `.env.example`.

## Checagens

```bash
pnpm typecheck
npx expo-doctor
```

## Estrutura relevante

| Caminho | Responsabilidade |
|---|---|
| `src/lib/api/config.ts` | Base URL da API a partir do ambiente |
| `src/lib/api/http-client.ts` | Wrapper `fetch` (JSON, injecao de token, erros) |
| `src/lib/api/CONTRACT.md` | Estado do contrato e decisao de gerador |
| `src/lib/accounts/` | Tipos e Zod de borda provisorios para contas |

## Ambiente

`EXPO_PUBLIC_API_BASE_URL` e obrigatoria. Segredos do Auth0 entram na fase 3 e nunca
sao versionados. `.env.example` nao contem credenciais.
