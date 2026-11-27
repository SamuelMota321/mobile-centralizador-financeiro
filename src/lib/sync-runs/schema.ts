import { z } from "zod";
import { SYNC_REASON_CODES, SYNC_REASON_DATA_TYPES, SYNC_RUN_STATUSES, SYNC_TRIGGERS } from "./types";

// Validacao de borda espelhando o OpenAPI publicado (additionalProperties: false no backend,
// mas o cliente tolera campos novos para nao quebrar com evolucao aditiva).

const timestampSchema = z.iso.datetime({ offset: true });

export const syncReasonSchema = z.object({
  dataType: z.enum(SYNC_REASON_DATA_TYPES),
  code: z.enum(SYNC_REASON_CODES),
});

export const syncRunSchema = z.object({
  runId: z.uuid(),
  connectionId: z.uuid(),
  status: z.enum(SYNC_RUN_STATUSES),
  trigger: z.enum(SYNC_TRIGGERS),
  acceptedAt: timestampSchema,
  statusUrl: z.string().min(1),
  startedAt: timestampSchema.nullable(),
  completedAt: timestampSchema.nullable(),
  referenceDate: timestampSchema.nullable(),
  reasons: z.array(syncReasonSchema),
});

export const latestSyncRunsSchema = z.object({
  latest: syncRunSchema.nullable(),
  lastReconciled: syncRunSchema.nullable(),
});

export const updateSessionSchema = z.object({
  connectToken: z.string().min(1),
  expiresAt: timestampSchema,
});
