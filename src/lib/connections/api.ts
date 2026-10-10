import { z } from "zod";
import { apiRequest } from "../api/http-client";
import { toProblemError } from "../api/problem-error";
import { completeConnectionInputSchema, connectionSchema, pluggySessionSchema } from "./schema";
import type { Connection, PluggySession } from "./types";

// Rotas do OpenAPI do backend (@ 605cb07). Nenhuma exige Idempotency-Key: a conclusao
// reaplica o estado do item no backend, entao reenviar o mesmo itemId e seguro.

const uuidSchema = z.uuid();

/** POST /api/v1/connections/pluggy/sessions — 201 com a conexao pendente e o token limitado. */
export async function startPluggySession(): Promise<PluggySession> {
  try {
    const raw = await apiRequest<unknown>("/connections/pluggy/sessions", { method: "POST" });
    return pluggySessionSchema.parse(raw);
  } catch (error) {
    throw toProblemError(error);
  }
}

/** POST /api/v1/connections/pluggy/completions — o backend confere o item e o liga ao tenant. */
export async function completePluggyConnection(itemId: string): Promise<Connection> {
  const body = completeConnectionInputSchema.parse({ itemId });
  try {
    const raw = await apiRequest<unknown>("/connections/pluggy/completions", { method: "POST", body });
    return connectionSchema.parse(raw);
  } catch (error) {
    throw toProblemError(error);
  }
}

/** GET /api/v1/connections/{connectionId} — estado da conexao e do consentimento. */
export async function getConnection(connectionId: string): Promise<Connection> {
  const id = uuidSchema.parse(connectionId);
  try {
    const raw = await apiRequest<unknown>(`/connections/${id}`, { method: "GET" });
    return connectionSchema.parse(raw);
  } catch (error) {
    throw toProblemError(error);
  }
}

/** POST /api/v1/connections/{connectionId}/disconnect — revoga o consentimento. */
export async function disconnectConnection(connectionId: string): Promise<Connection> {
  const id = uuidSchema.parse(connectionId);
  try {
    const raw = await apiRequest<unknown>(`/connections/${id}/disconnect`, { method: "POST" });
    return connectionSchema.parse(raw);
  } catch (error) {
    throw toProblemError(error);
  }
}
