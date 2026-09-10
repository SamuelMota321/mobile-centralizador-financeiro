// PROVISORIO — reflete o Modelo de Dados Identity e Accounts 1.0 e o schema inbound
// do backend (src/modules/accounts/adapters/inbound/account-input.schema.ts @ backend b154f14).
//
// O contrato OpenAPI do backend ainda expoe apenas /api/v1/health/*. Nao ha endpoints
// nem schemas de contas publicados. Substituir por tipos gerados do contrato quando o
// backend publicar /api/v1/accounts (fase 3 do Dev 1 / S1-05).

export const ACCOUNT_TYPES = [
  "checking",
  "savings",
  "payment",
  "cash",
  "credit_card",
  "investment",
  "other",
] as const;

export type AccountType = (typeof ACCOUNT_TYPES)[number];

export type AccountOrigin = "manual" | "connected";

/** Entrada de criacao de conta manual (borda de apresentacao). */
export interface ManualAccountInput {
  name: string;
  type: AccountType;
  institutionName: string | null;
  /** String decimal com no maximo duas casas, assinada. */
  initialBalance: string;
  /** Data civil ISO (AAAA-MM-DD), nao futura no momento da criacao. */
  initialBalanceAsOf: string;
}

/** Forma provisoria da conta retornada pela API. Confirmar contra o OpenAPI. */
export interface Account {
  id: string;
  type: AccountType;
  origin: AccountOrigin;
  name: string;
  institutionName: string | null;
  initialBalance: string;
  initialBalanceAsOf: string;
  currencyCode: "BRL";
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
