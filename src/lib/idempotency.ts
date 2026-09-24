import { randomUUID } from "expo-crypto";
import { PROBLEM_CODES, ProblemDetailsError } from "./api/errors";

// Contrato do backend: a chave so e registrada quando a movimentacao e criada, entao
// qualquer erro permite reenviar com a mesma chave. Ela so muda apos sucesso ou quando
// o backend a recusa (dados diferentes ou janela de 24h expirada).

/** Hermes nao expoe crypto.randomUUID; expo-crypto gera o UUID v4 nativamente. */
export function newIdempotencyKey(): string {
  return randomUUID();
}

export function mustRotateIdempotencyKey(error: unknown): boolean {
  return (
    error instanceof ProblemDetailsError &&
    (error.code === PROBLEM_CODES.idempotencyKeyReused ||
      error.code === PROBLEM_CODES.idempotencyKeyExpired)
  );
}
