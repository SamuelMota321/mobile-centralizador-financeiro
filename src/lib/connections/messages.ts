import { PROBLEM_CODES, ProblemDetailsError } from "../api/errors";
import { ApiRequestError } from "../api/http-client";

// Primeiro os codigos de conexao do backend (@ 605cb07), depois o status. O `detail` nunca
// e exibido: pode trazer dado do provedor.

const UNAVAILABLE = "O serviço de conexão com o banco está indisponível no momento. Tente novamente em alguns minutos.";

const MESSAGES_BY_CODE: Record<string, string> = {
  [PROBLEM_CODES.connectionNotFound]:
    "Esta conexão não foi encontrada. Ela pode ter sido feita por outra pessoa ou removida.",
  [PROBLEM_CODES.connectionConflict]:
    "Esta conexão mudou de estado enquanto você usava a tela. Atualize e tente de novo.",
  [PROBLEM_CODES.integrationUnavailable]: UNAVAILABLE,
  [PROBLEM_CODES.authenticationRequired]: "Sua sessão expirou. Entre novamente.",
  [PROBLEM_CODES.identityContextUnavailable]:
    "Não foi possível confirmar seu acesso. Entre novamente.",
};

const MESSAGES_BY_STATUS: Record<number, string> = {
  404: MESSAGES_BY_CODE[PROBLEM_CODES.connectionNotFound],
  409: MESSAGES_BY_CODE[PROBLEM_CODES.connectionConflict],
  503: UNAVAILABLE,
};

export function connectionErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ProblemDetailsError) {
    return MESSAGES_BY_CODE[error.code] ?? MESSAGES_BY_STATUS[error.status] ?? fallback;
  }
  if (error instanceof ApiRequestError) {
    return MESSAGES_BY_STATUS[error.status] ?? fallback;
  }
  return fallback;
}
