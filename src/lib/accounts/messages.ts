import { ProblemDetailsError, PROBLEM_CODES } from "../api/errors";
import { ApiRequestError } from "../api/http-client";

/** 401 com ou sem corpo Problem Details: a sessao local deve ser descartada. */
export function isUnauthorized(error: unknown): boolean {
  return (
    (error instanceof ProblemDetailsError || error instanceof ApiRequestError) &&
    error.status === 401
  );
}

// O `detail` do backend e tecnico e em ingles; o usuario ve somente estes textos.
// 404 e conta arquivada compartilham a mesma mensagem para nao revelar existencia.
export const ACCOUNT_UNAVAILABLE_MESSAGE =
  "Esta conta não foi encontrada ou não está mais disponível.";

const MESSAGES_BY_CODE: Record<string, string> = {
  [PROBLEM_CODES.accountNotFound]: ACCOUNT_UNAVAILABLE_MESSAGE,
  [PROBLEM_CODES.accountArchived]: ACCOUNT_UNAVAILABLE_MESSAGE,
  [PROBLEM_CODES.connectedAccountReadOnly]:
    "Contas conectadas não podem ser editadas aqui. Você ainda pode desativá-las.",
  [PROBLEM_CODES.invalidRequest]: "Revise os campos destacados.",
  [PROBLEM_CODES.authenticationRequired]: "Sua sessão expirou. Entre novamente.",
  [PROBLEM_CODES.identityContextUnavailable]:
    "Não foi possível confirmar seu acesso. Entre novamente.",
};

const FIELD_MESSAGES_BY_CODE: Record<string, string> = {
  BALANCE_REFERENCE_PAIR_REQUIRED: "Informe saldo inicial e data de referência juntos.",
  OUT_OF_RANGE: "Valor fora do limite permitido.",
  IMMUTABLE_FIELD: "Este campo não pode ser alterado.",
};

export function accountErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ProblemDetailsError) {
    return MESSAGES_BY_CODE[error.code] ?? fallback;
  }
  return fallback;
}

/** 404 ou conta arquivada: a lista deve ser recarregada. */
export function isAccountUnavailable(error: unknown): boolean {
  return (
    error instanceof ProblemDetailsError &&
    (error.code === PROBLEM_CODES.accountNotFound ||
      error.code === PROBLEM_CODES.accountArchived)
  );
}

/** Converte `errors[]` de Problem Details em mensagens por campo do formulario. */
export function fieldErrorsFromProblem(error: unknown): Record<string, string> {
  if (!(error instanceof ProblemDetailsError)) return {};
  const fieldErrors: Record<string, string> = {};
  for (const item of error.problem.errors ?? []) {
    if (!fieldErrors[item.path]) {
      fieldErrors[item.path] = FIELD_MESSAGES_BY_CODE[item.code] ?? "Valor inválido.";
    }
  }
  return fieldErrors;
}
