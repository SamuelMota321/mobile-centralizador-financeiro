import { PROBLEM_CODES, ProblemDetailsError } from "../api/errors";
import { ApiRequestError } from "../api/http-client";

// O contrato S3-01 lista so os status HTTP de ingestions; os `code` ainda nao foram publicados.
// Ate la: primeiro os codigos ja conhecidos, depois o status. O `detail` nunca e exibido.

const ACCOUNT_UNAVAILABLE = "A conta escolhida não foi encontrada ou não está mais disponível.";

const MESSAGES_BY_CODE: Record<string, string> = {
  [PROBLEM_CODES.accountNotFound]: ACCOUNT_UNAVAILABLE,
  [PROBLEM_CODES.accountArchived]: ACCOUNT_UNAVAILABLE,
  [PROBLEM_CODES.idempotencyKeyReused]:
    "Os dados mudaram desde o envio anterior. Revise e envie novamente.",
  [PROBLEM_CODES.idempotencyKeyExpired]:
    "Este envio expirou. Revise os dados e envie novamente.",
  [PROBLEM_CODES.authenticationRequired]: "Sua sessão expirou. Entre novamente.",
  [PROBLEM_CODES.identityContextUnavailable]:
    "Não foi possível confirmar seu acesso. Entre novamente.",
};

const MESSAGES_BY_STATUS: Record<number, string> = {
  404: "Esta importação não foi encontrada ou expirou. Envie o arquivo de novo.",
  409: "Esta importação já foi confirmada ou expirou. Envie o arquivo de novo.",
  413: "O arquivo passa do limite de tamanho. Exporte um período menor no banco.",
  415: "Formato não aceito. Envie o extrato no formato OFX (PDF não é aceito).",
  422: "Não foi possível ler este OFX. Confira se é o extrato exportado pelo banco.",
};

export function ingestionErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ProblemDetailsError) {
    return MESSAGES_BY_CODE[error.code] ?? MESSAGES_BY_STATUS[error.status] ?? fallback;
  }
  if (error instanceof ApiRequestError) {
    return MESSAGES_BY_STATUS[error.status] ?? fallback;
  }
  return fallback;
}
