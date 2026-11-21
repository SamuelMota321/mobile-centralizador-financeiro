import * as SecureStore from "expo-secure-store";
import { z } from "zod";
import { ApiRequestError } from "../api/http-client";
import { ProblemDetailsError } from "../api/errors";
import { getConnection } from "./api";
import type { Connection } from "./types";

const KEY = "coinciente.connection";
const pointerSchema = z.object({ owner: z.string().min(1), connectionId: z.uuid() });

/** Somente uma chave de associação local; a autorização é conferida pelo backend. */
export function subjectFromToken(token: string): string | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const parsed: unknown = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")));
    if (typeof parsed !== "object" || parsed === null || !("sub" in parsed)) return null;
    return typeof parsed.sub === "string" && parsed.sub.length > 0 ? parsed.sub : null;
  } catch {
    return null;
  }
}

export async function saveConnectionPointer(owner: string, connectionId: string): Promise<void> {
  const pointer = pointerSchema.parse({ owner, connectionId });
  await SecureStore.setItemAsync(KEY, JSON.stringify(pointer));
}

export async function loadConnectionPointer(owner: string): Promise<string | null> {
  const raw = await SecureStore.getItemAsync(KEY);
  if (!raw) return null;
  try {
    const pointer = pointerSchema.parse(JSON.parse(raw) as unknown);
    if (pointer.owner === owner) return pointer.connectionId;
  } catch {
    // Conteúdo corrompido ou inválido: apagar antes de abrir qualquer conexão.
  }
  await clearConnectionPointer();
  return null;
}

export async function clearConnectionPointer(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY);
}

export type RecoveryResult =
  | { kind: "none" }
  | { kind: "found"; connection: Connection }
  | { kind: "denied" }
  | { kind: "error"; error: unknown };

export function isConnectionDenied(error: unknown): boolean {
  return (
    (error instanceof ProblemDetailsError || error instanceof ApiRequestError) &&
    (error.status === 403 || error.status === 404)
  );
}

export async function restoreConnectionPointer(owner: string): Promise<RecoveryResult> {
  try {
    const connectionId = await loadConnectionPointer(owner);
    if (!connectionId) return { kind: "none" };
    try {
      return { kind: "found", connection: await getConnection(connectionId) };
    } catch (error) {
      if (isConnectionDenied(error)) {
        await clearConnectionPointer();
        return { kind: "denied" };
      }
      return { kind: "error", error };
    }
  } catch (error) {
    return { kind: "error", error };
  }
}
