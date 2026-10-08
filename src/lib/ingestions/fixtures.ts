// Dados ficticios no formato Proposed do ImportRun (ver types.ts). Somente para testes.

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
    warnings: [],
    errorCode: null,
    ...overrides,
  };
}

/** Previa pronta: uma linha com FITID e uma sem, que recebe o aviso de fallback. */
export function previewRun(overrides: Record<string, unknown> = {}) {
  return {
    id: IMPORT_RUN_ID,
    status: "preview_ready",
    destinationAccountId: null,
    totalItems: 2,
    importedItems: 0,
    ignoredItems: 0,
    failedItems: 0,
    items: [
      previewItem(),
      previewItem({
        ordinal: 2,
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
    id: IMPORT_RUN_ID,
    status: "completed_with_errors",
    destinationAccountId: DESTINATION_ACCOUNT_ID,
    totalItems: 3,
    importedItems: 1,
    ignoredItems: 1,
    failedItems: 1,
    items: [
      previewItem({ status: "imported" }),
      previewItem({ ordinal: 2, externalId: "FITID-0002", status: "ignored_duplicate" }),
      previewItem({ ordinal: 3, externalId: "FITID-0003", status: "failed", errorCode: "codigo_ficticio" }),
    ],
    ...overrides,
  };
}
