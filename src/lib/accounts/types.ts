// Alinhado ao contrato OpenAPI do backend em /api/v1/accounts (@ backend fa9b62a).
// As rotas de contas descrevem seus schemas inline (fora de components.schemas), entao
// os tipos abaixo sao transcritos a mao e devem acompanhar openapi.snapshot.json.
// Sem pacote compartilhado: web e mobile mantem copias independentes.

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

/** Corpo de POST /api/v1/accounts. */
export interface ManualAccountInput {
  name: string;
  type: AccountType;
  institutionName?: string | null;
  /** String decimal, ate duas casas, assinada. Ex.: "1500.00", "-42.5". */
  initialBalance: string;
  /** Data civil ISO (AAAA-MM-DD), nao futura. */
  initialBalanceAsOf: string;
  /** Reenviar como true para confirmar criacao apesar de duplicidade possivel (409). */
  confirmPossibleDuplicate?: boolean;
}

/** Corpo de PATCH /api/v1/accounts/{accountId}: parcial, ao menos um campo de negocio. */
export interface AccountUpdateInput {
  name?: string;
  type?: AccountType;
  /** null remove a instituicao; omitido mantem o valor atual. */
  institutionName?: string | null;
  /** Enviado sempre junto com `initialBalanceAsOf`. */
  initialBalance?: string;
  initialBalanceAsOf?: string;
  confirmPossibleDuplicate?: boolean;
}

/** Conta retornada por POST (201), GET (itens), PATCH e deactivate (200). */
export interface Account {
  id: string;
  name: string;
  type: AccountType;
  origin: AccountOrigin;
  institutionName: string | null;
  /** String decimal com exatamente duas casas. */
  initialBalance: string;
  initialBalanceAsOf: string;
  currencyCode: "BRL";
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Resposta de GET /api/v1/accounts. */
export interface AccountPage {
  items: Account[];
  page: number;
  pageSize: number;
  total: number;
}

/** Parametros de consulta de GET /api/v1/accounts. */
export interface AccountListQuery {
  page?: number;
  /** 1 a 100. Default do backend: 20. */
  pageSize?: number;
}

/** Item de `candidates` no erro 409 POSSIBLE_CONNECTED_ACCOUNT_DUPLICATE. */
export interface DuplicateCandidate {
  id: string;
  name: string;
  type: AccountType;
  origin: "connected";
  institutionName: string | null;
}
