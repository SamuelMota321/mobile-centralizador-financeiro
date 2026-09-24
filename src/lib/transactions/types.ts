// Alinhado a TransactionView, CreateTransaction, CreateTransfer, TransferView e
// UpdateTransactionCategory do OpenAPI do backend (@ backend fa9b62a). Transcrito a mao.

export const MOVEMENT_TYPES = ["income", "expense"] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];
export type TransactionType = MovementType | "transfer";

export type TransactionStatus = "posted" | "voided";
export type TransferSide = "outgoing" | "incoming";

export const CATEGORIZATION_STATUSES = [
  "unclassified",
  "categorized",
  "uncertain",
  "unrecognized",
  "not_applicable",
] as const;
export type CategorizationStatus = (typeof CATEGORIZATION_STATUSES)[number];
export type CategorizationSource = "manual" | "rule";

export const UNCERTAIN_STATUSES = ["uncertain", "unrecognized"] as const;
export type UncertainStatus = (typeof UNCERTAIN_STATUSES)[number];

/** Lancamento retornado pela API. `amount` e sempre positivo; o tipo define a natureza. */
export interface Transaction {
  id: string;
  accountId: string;
  type: TransactionType;
  /** String decimal com duas casas, > 0. */
  amount: string;
  /** Data civil AAAA-MM-DD. */
  occurredOn: string;
  description: string | null;
  status: TransactionStatus;
  transferId: string | null;
  transferSide: TransferSide | null;
  categoryId: string | null;
  categorizationStatus: CategorizationStatus;
  categorizationSource: CategorizationSource | null;
  createdAt: string;
  updatedAt: string;
}

export interface TransactionPage {
  items: Transaction[];
  page: number;
  pageSize: number;
  total: number;
}

/** Corpo de POST /api/v1/transactions (receita ou despesa). */
export interface CreateTransactionInput {
  accountId: string;
  type: MovementType;
  amount: string;
  occurredOn: string;
  description?: string | null;
}

/** Corpo de POST /api/v1/transfers: registro contabil, nunca movimenta dinheiro. */
export interface CreateTransferInput {
  fromAccountId: string;
  toAccountId: string;
  amount: string;
  occurredOn: string;
  description?: string | null;
}

/** Resposta de POST /api/v1/transfers: saida e entrada com o mesmo transferId. */
export interface Transfer {
  entries: [Transaction, Transaction];
}

/** Corpo de PATCH /api/v1/transactions/{id}/category: exatamente uma das formas. */
export type TransactionCategoryUpdate =
  | { categoryId: string }
  | { categorizationStatus: UncertainStatus };
