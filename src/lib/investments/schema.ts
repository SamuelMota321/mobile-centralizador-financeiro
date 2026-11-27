import { z } from "zod";
import { ASSET_CLASSES, AVAILABILITIES, EXCLUSION_REASONS, FRESHNESS } from "./types";

const timestamp = z.iso.datetime({ offset: true });
const decimal = z.string().regex(/^-?\d+(?:\.\d+)?$/);
const percentage = z.string().regex(/^\d+\.\d$/);
const source = z.literal("pluggy");
const availability = z.enum(AVAILABILITIES);

export const moneySchema = z.object({ currencyCode: z.string().min(1), amount: decimal });

export const positionSchema = z.object({
  id: z.uuid(),
  connectionId: z.uuid(),
  source,
  externalId: z.string(),
  name: z.string(),
  assetType: z.string(),
  subtype: z.string().nullable(),
  providerStatus: z.string().nullable(),
  currencyCode: z.string().nullable(),
  balance: decimal,
  quantity: decimal.nullable(),
  investedAmount: decimal.nullable(),
  resultAmount: decimal.nullable(),
  institutionName: z.string().nullable(),
  referenceDate: timestamp.nullable(),
  rate: z.string().nullable(),
  rateType: z.string().nullable(),
  fixedAnnualRate: z.string().nullable(),
  maturityDate: z.string().nullable(),
  dataQuality: z.object({ availability, freshness: z.enum(FRESHNESS) }),
  missingFields: z.array(z.string()),
});

const memberSchema = z.object({ id: z.uuid(), source, referenceDate: timestamp.nullable() });

const classGroupSchema = z.object({
  assetClass: z.enum(ASSET_CLASSES),
  amount: decimal,
  percentage,
  positions: z.array(memberSchema),
});

const institutionGroupSchema = z.object({
  institutionName: z.string().nullable(),
  amount: decimal,
  percentage,
  positions: z.array(memberSchema),
});

export const allocationSchema = z.object({
  basis: z.literal("active_current_complete_positive_balance"),
  availability,
  knownPositionCount: z.number().int().min(0),
  includedPositionCount: z.number().int().min(0),
  excludedKnownPositionCount: z.number().int().min(0),
  excludedByReason: z.object(
    Object.fromEntries(EXCLUSION_REASONS.map((reason) => [reason, z.number().int().min(0)])) as Record<
      (typeof EXCLUSION_REASONS)[number],
      z.ZodNumber
    >,
  ),
  currencies: z.array(
    z.object({
      currencyCode: z.string().min(1),
      denominatorAmount: decimal,
      byClass: z.array(classGroupSchema),
      byInstitution: z.array(institutionGroupSchema),
    }),
  ),
});

export const positionPageSchema = z.object({
  portfolio: z.object({
    availability,
    total: moneySchema.nullable(),
    totalsByCurrency: z.array(moneySchema),
    referenceDate: timestamp.nullable(),
    connections: z.array(z.object({ connectionId: z.uuid(), availability })),
    allocation: allocationSchema,
  }),
  positions: z.array(positionSchema),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  total: z.number().int().min(0),
});

export const movementSchema = z.object({
  id: z.uuid(),
  source,
  externalId: z.string(),
  type: z.string(),
  amount: decimal.nullable(),
  currencyCode: z.string().nullable(),
  occurredAt: timestamp,
  missingFields: z.array(z.string()),
});

export const movementPageSchema = z.object({
  positionId: z.uuid(),
  availability: z.enum(["complete", "unavailable"]),
  movements: z.array(movementSchema),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  total: z.number().int().min(0),
});
