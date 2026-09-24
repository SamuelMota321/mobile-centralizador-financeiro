import { ProblemDetailsError, PROBLEM_CODES } from "../api/errors";

// Mensagens em pt-BR para Transactions, Categories e Category-rules. O `detail` do
// backend e tecnico e em ingles e nunca e exibido. Recursos inexistentes, de outro
// tenant ou arquivados compartilham a mesma mensagem para nao revelar existencia.

const ACCOUNT_UNAVAILABLE = "A conta escolhida nao foi encontrada ou nao esta mais disponivel.";
const CATEGORY_UNAVAILABLE = "Esta categoria nao foi encontrada ou nao esta mais disponivel.";

const MESSAGES_BY_CODE: Record<string, string> = {
  [PROBLEM_CODES.accountNotFound]: ACCOUNT_UNAVAILABLE,
  [PROBLEM_CODES.accountArchived]: ACCOUNT_UNAVAILABLE,
  [PROBLEM_CODES.transactionNotFound]:
    "Esta movimentacao nao foi encontrada ou nao esta mais disponivel.",
  [PROBLEM_CODES.categoryNotFound]: CATEGORY_UNAVAILABLE,
  [PROBLEM_CODES.categoryArchived]: CATEGORY_UNAVAILABLE,
  [PROBLEM_CODES.categoryRuleNotFound]:
    "Esta regra nao foi encontrada ou nao esta mais disponivel.",
  [PROBLEM_CODES.categoryRuleConflict]:
    "Esta regra foi removida e nao pode mais ser alterada.",
  [PROBLEM_CODES.transferAccountsMustDiffer]:
    "Escolha contas de origem e destino diferentes.",
  [PROBLEM_CODES.transactionCategorizationNotAllowed]:
    "Transferencias e movimentacoes estornadas nao recebem categoria.",
  [PROBLEM_CODES.idempotencyKeyReused]:
    "Os dados mudaram desde o envio anterior. Revise e envie novamente.",
  [PROBLEM_CODES.idempotencyKeyExpired]:
    "Este envio expirou. Revise os dados e envie novamente.",
  [PROBLEM_CODES.invalidRequest]: "Revise os dados informados.",
  [PROBLEM_CODES.authenticationRequired]: "Sua sessao expirou. Entre novamente.",
  [PROBLEM_CODES.identityContextUnavailable]:
    "Nao foi possivel confirmar seu acesso. Entre novamente.",
};

export function transactionsErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ProblemDetailsError) {
    return MESSAGES_BY_CODE[error.code] ?? fallback;
  }
  return fallback;
}

/** Recurso indisponivel (404 ou arquivado): a tela deve recarregar a lista. */
export function isResourceUnavailable(error: unknown): boolean {
  if (!(error instanceof ProblemDetailsError)) return false;
  return (
    error.status === 404 ||
    error.code === PROBLEM_CODES.accountArchived ||
    error.code === PROBLEM_CODES.categoryArchived
  );
}
