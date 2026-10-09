// Dados ficticios no formato do OpenAPI (@ backend 2c416cd). Somente para testes.

export const IMPORT_RUN_ID = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
export const DESTINATION_ACCOUNT_ID = "3f1c2b4e-8a6d-4c1e-9b2a-7d5e6f8a9b0c";

export function previewItem(overrides: Record<string, unknown> = {}) {
  return {
    ordinal: 1,
    externalId: "FITID-0001",
    type: "expense",
    amount: "42.50",
    occurredOn: "2026-09-20",
    description: "Mercado ficticio",
    status: "previewed",
    isDuplicate: false,
    warnings: [],
    errorCode: null,
    ...overrides,
  };
}

const runBase = {
  id: IMPORT_RUN_ID,
  destinationAccountId: DESTINATION_ACCOUNT_ID,
  variant: "ofx_1_sgml",
  fileSizeBytes: 2048,
  terminalAt: null,
  retentionExpiresAt: null,
  createdAt: "2026-10-09T12:00:00.000Z",
  updatedAt: "2026-10-09T12:00:00.000Z",
};

/** Previa pronta: uma linha nova, uma duplicada na conta e uma sem FITID. */
export function previewRun(overrides: Record<string, unknown> = {}) {
  return {
    ...runBase,
    status: "preview_ready",
    totalItems: 3,
    importedItems: 0,
    ignoredItems: 0,
    failedItems: 0,
    items: [
      previewItem(),
      previewItem({ ordinal: 2, externalId: "FITID-0002", isDuplicate: true }),
      previewItem({
        ordinal: 3,
        externalId: null,
        type: "income",
        amount: "1500.00",
        description: "Salario ficticio",
        warnings: ["external_id_missing"],
      }),
    ],
    ...overrides,
  };
}

/** Resultado com um importado, um duplicado ignorado e um com erro. */
export function resultRun(overrides: Record<string, unknown> = {}) {
  return {
    ...runBase,
    status: "completed_with_errors",
    totalItems: 3,
    importedItems: 1,
    ignoredItems: 1,
    failedItems: 1,
    terminalAt: "2026-10-09T12:01:00.000Z",
    retentionExpiresAt: "2027-01-07T12:01:00.000Z",
    updatedAt: "2026-10-09T12:01:00.000Z",
    items: [
      previewItem({ status: "imported" }),
      previewItem({ ordinal: 2, externalId: "FITID-0002", status: "ignored_duplicate", isDuplicate: true }),
      previewItem({ ordinal: 3, externalId: "FITID-0003", status: "failed", errorCode: "codigo_ficticio" }),
    ],
    ...overrides,
  };
}
