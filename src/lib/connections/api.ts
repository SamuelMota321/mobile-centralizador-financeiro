import { z } from "zod";
import { apiRequest } from "../api/http-client";
import { toProblemError } from "../api/problem-error";
import {
  completeConnectionInputSchema,
  completionAcceptedSchema,
  connectionDetailSchema,
  connectionSchema,
  pluggySessionSchema,
} from "./schema";
import type { CompletionAccepted, Connection, PluggySession } from "./types";

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

/** POST /api/v1/connections/pluggy/completions — aceita a importação inicial com 202. */
export async function completePluggyConnection(itemId: string, idempotencyKey: string): Promise<CompletionAccepted> {
  const body = completeConnectionInputSchema.parse({ itemId });
  const key = uuidSchema.parse(idempotencyKey);
  try {
    const raw = await apiRequest<unknown>("/connections/pluggy/completions", {
      method: "POST",
      body,
      idempotencyKey: key,
    });
    return completionAcceptedSchema.parse(raw);
  } catch (error) {
    throw toProblemError(error);
  }
}

/** GET /api/v1/connections/{connectionId} — estado da conexao e do consentimento. */
export async function getConnection(connectionId: string): Promise<Connection> {
  const id = uuidSchema.parse(connectionId);
  try {
    const raw = await apiRequest<unknown>(`/connections/${id}`, { method: "GET" });
    return connectionDetailSchema.parse(raw);
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
