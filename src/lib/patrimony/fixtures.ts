// Dados ficticios no formato do OpenAPI publicado. Somente para testes.

export const ASSET_ID = "6c4f5e7d-8091-42a3-9dce-3f4a5b6c7d8e";
export const FINANCING_ID = "7d5a6f8e-91a2-43b4-8edf-4a5b6c7d8e9f";
export const LIABILITY_ID = "8e6b7a9f-a2b3-44c5-9fe0-5b6c7d8e9fa0";
const STAMP = "2026-11-20T15:00:00.000Z";

export function assetView(overrides: Record<string, unknown> = {}) {
  return {
    id: ASSET_ID,
    kind: "asset",
    currencyCode: "BRL",
    version: 1,
    createdAt: STAMP,
    updatedAt: STAMP,
    type: "Imóvel",
    description: "Apartamento de exemplo",
    estimatedValue: "350000.00",
    valuationDate: "2026-10-01",
    source: "Avaliação de corretor",
    ...overrides,
  };
}

export function financingView(overrides: Record<string, unknown> = {}) {
  return {
    id: FINANCING_ID,
    kind: "financing",
    currencyCode: "BRL",
    version: 1,
    createdAt: STAMP,
    updatedAt: STAMP,
    description: "Financiamento de exemplo",
    outstandingBalance: "210000.00",
    assetId: ASSET_ID,
    ...overrides,
  };
}

export function liabilityView(overrides: Record<string, unknown> = {}) {
  return {
    id: LIABILITY_ID,
    kind: "liability",
    currencyCode: "BRL",
    version: 1,
    createdAt: STAMP,
    updatedAt: STAMP,
    description: "Empréstimo de exemplo",
    outstandingBalance: "5000.00",
    ...overrides,
  };
}

export function pageView(items: unknown[], overrides: Record<string, unknown> = {}) {
  return { items, page: 1, pageSize: 20, total: items.length, ...overrides };
}
