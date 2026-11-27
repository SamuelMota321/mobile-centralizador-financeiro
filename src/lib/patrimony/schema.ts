import { z } from "zod";
import { LIMITS, type PatrimonyCollection } from "./types";

const timestamp = z.iso.datetime({ offset: true });
const storedAmount = z.string().regex(/^(?:0|[1-9]\d*)\.\d{2}$/);
const civilDate = z.iso.date();

const base = {
  id: z.uuid(),
  currencyCode: z.literal("BRL"),
  version: z.number().int().min(1),
  createdAt: timestamp,
  updatedAt: timestamp,
  description: z.string().max(LIMITS.description),
};

const assetState = {
  type: z.string().max(LIMITS.type),
  description: z.string().max(LIMITS.description),
  estimatedValue: storedAmount,
  valuationDate: civilDate,
  source: z.string().max(LIMITS.source),
};
const financingState = {
  description: z.string().max(LIMITS.description),
  outstandingBalance: storedAmount,
  assetId: z.uuid().nullable(),
};
const liabilityState = {
  description: z.string().max(LIMITS.description),
  outstandingBalance: storedAmount,
};

export const assetSchema = z.object({ ...base, ...assetState, kind: z.literal("asset") });
export const financingSchema = z.object({ ...base, ...financingState, kind: z.literal("financing") });
export const liabilitySchema = z.object({ ...base, ...liabilityState, kind: z.literal("liability") });

export const itemSchemas = {
  assets: assetSchema,
  financings: financingSchema,
  liabilities: liabilitySchema,
} as const satisfies Record<PatrimonyCollection, z.ZodType>;

export const stateSchemas = {
  assets: z.object(assetState),
  financings: z.object(financingState),
  liabilities: z.object(liabilityState),
} as const satisfies Record<PatrimonyCollection, z.ZodType>;

export function pageSchema<C extends PatrimonyCollection>(collection: C) {
  return z.object({
    items: z.array(itemSchemas[collection]),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
    total: z.number().int().min(0),
  });
}

export function historySchema<C extends PatrimonyCollection>(collection: C) {
  return z.array(
    z.object({
      version: z.number().int().min(1),
      actorUserId: z.uuid(),
      requestId: z.uuid(),
      createdAt: timestamp,
      state: stateSchemas[collection],
    }),
  );
}

/** Valor enviado: o backend aceita "0", "12", "12.3" ou "12.34", sem sinal. */
export const inputAmountSchema = z.string().regex(/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/);
