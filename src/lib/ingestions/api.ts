import { z } from "zod";
import { apiRequest } from "../api/http-client";
import { toProblemError } from "../api/problem-error";
import { idempotencyKeySchema } from "../transactions/schema";
import { confirmImportInputSchema, importRunSchema } from "./schema";
import type { ConfirmImportInput, ImportRun } from "./types";

// Rotas do OpenAPI do backend (@ 2c416cd). Previa e confirmacao exigem Idempotency-Key.

/** Operacoes que criam ou iniciam uma importacao exigem Idempotency-Key. */
export interface IngestionWriteOptions {
  idempotencyKey: string;
}

/** Arquivo escolhido no aparelho: o React Native le o conteudo a partir do `uri`. */
export interface OfxFileAsset {
  uri: string;
  name: string;
  mimeType?: string | null;
}

/** A conta vai junto com o arquivo: a previa ja calcula os duplicados para ela. */
export interface OfxPreviewInput {
  file: OfxFileAsset;
  destinationAccountId: string;
}

const uuidSchema = z.uuid();

/** POST /api/v1/ingestions/ofx/previews — 201 com a previa pronta. */
export async function createOfxPreview(
  input: OfxPreviewInput,
  options: IngestionWriteOptions,
): Promise<ImportRun> {
  const destinationAccountId = uuidSchema.parse(input.destinationAccountId);
  const idempotencyKey = idempotencyKeySchema.parse(options.idempotencyKey);
  const { file } = input;
  const body = new FormData();
  // `{ uri, name, type }` e o formato de arquivo que o FormData do React Native aceita.
  const part = { uri: file.uri, name: file.name, ...(file.mimeType ? { type: file.mimeType } : {}) };
  body.append("file", part as unknown as Blob);
  body.append("destinationAccountId", destinationAccountId);
  try {
    const raw = await apiRequest<unknown>("/ingestions/ofx/previews", {
      method: "POST",
      body,
      idempotencyKey,
    });
    return importRunSchema.parse(raw);
  } catch (error) {
    throw toProblemError(error);
  }
}

/** POST /api/v1/ingestions/{importRunId}/confirmations — 200 com o resultado. */
export async function confirmImport(
  importRunId: string,
  input: ConfirmImportInput,
  options: IngestionWriteOptions,
): Promise<ImportRun> {
  const id = uuidSchema.parse(importRunId);
  const body = confirmImportInputSchema.parse(input);
  const idempotencyKey = idempotencyKeySchema.parse(options.idempotencyKey);
  try {
    const raw = await apiRequest<unknown>(`/ingestions/${id}/confirmations`, {
      method: "POST",
      body,
      idempotencyKey,
    });
    return importRunSchema.parse(raw);
  } catch (error) {
    throw toProblemError(error);
  }
}

/** GET /api/v1/ingestions/{importRunId} — estado atual, com a previa ou o resultado. */
export async function getImportRun(importRunId: string): Promise<ImportRun> {
  const id = uuidSchema.parse(importRunId);
  try {
    const raw = await apiRequest<unknown>(`/ingestions/${id}`, { method: "GET" });
    return importRunSchema.parse(raw);
  } catch (error) {
    throw toProblemError(error);
  }
}
