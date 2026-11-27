// Dados ficticios no formato do OpenAPI publicado. Somente para testes: nunca representam
// uma carteira real nem um payload da Pluggy.

export const POSITION_ID = "3f1c2b4a-5d6e-4f70-8a9b-0c1d2e3f4a5b";
export const POSITION_ID_2 = "4a2d3c5b-6e7f-4081-9bac-1d2e3f4a5b6c";
export const INVEST_CONNECTION_ID = "b2a7e0c4-1f3d-4a5b-8c9d-0e1f2a3b4c5d";
export const REFERENCE = "2026-11-22T13:00:00.000Z";

export function positionView(overrides: Record<string, unknown> = {}) {
  return {
    id: POSITION_ID,
    connectionId: INVEST_CONNECTION_ID,
    source: "pluggy",
    externalId: "ext-001",
    name: "CDB Exemplo 110% CDI",
    assetType: "FIXED_INCOME",
    subtype: "CDB",
    providerStatus: "ACTIVE",
    currencyCode: "BRL",
    balance: "1000.00",
    quantity: null,
    investedAmount: "900.00",
    resultAmount: "100.00",
    institutionName: "Banco Exemplo",
    referenceDate: REFERENCE,
    rate: "110",
    rateType: "CDI",
    fixedAnnualRate: null,
    maturityDate: "2029-05-10",
    dataQuality: { availability: "complete", freshness: "current" },
    missingFields: ["quantity", "fixedAnnualRate"],
    ...overrides,
  };
}

const member = { id: POSITION_ID, source: "pluggy", referenceDate: REFERENCE };

export function allocationView(overrides: Record<string, unknown> = {}) {
  return {
    basis: "active_current_complete_positive_balance",
    availability: "complete",
    knownPositionCount: 2,
    includedPositionCount: 2,
    excludedKnownPositionCount: 0,
    excludedByReason: { incomplete_or_stale: 0, non_active: 0, non_positive_balance: 0, unknown_currency: 0 },
    currencies: [
      {
        currencyCode: "BRL",
        denominatorAmount: "1500.00",
        byClass: [
          { assetClass: "FIXED_INCOME", amount: "1000.00", percentage: "66.7", positions: [member] },
          { assetClass: "UNCLASSIFIED", amount: "500.00", percentage: "33.3", positions: [member] },
        ],
        byInstitution: [
          { institutionName: "Banco Exemplo", amount: "1000.00", percentage: "66.7", positions: [member] },
          { institutionName: null, amount: "500.00", percentage: "33.3", positions: [member] },
        ],
      },
    ],
    ...overrides,
  };
}

export function portfolioPageView(overrides: Record<string, unknown> = {}) {
  return {
    portfolio: {
      availability: "complete",
      total: { currencyCode: "BRL", amount: "1500.00" },
      totalsByCurrency: [{ currencyCode: "BRL", amount: "1500.00" }],
      referenceDate: REFERENCE,
      connections: [{ connectionId: INVEST_CONNECTION_ID, availability: "complete" }],
      allocation: allocationView(),
    },
    positions: [positionView(), positionView({ id: POSITION_ID_2, name: "Fundo Exemplo", assetType: "OTHER", balance: "500.00" })],
    page: 1,
    pageSize: 20,
    total: 2,
    ...overrides,
  };
}

export function movementPageView(overrides: Record<string, unknown> = {}) {
  return {
    positionId: POSITION_ID,
    availability: "complete",
    movements: [
      {
        id: "5b3e4d6c-7f80-4192-8cbd-2e3f4a5b6c7d",
        source: "pluggy",
        externalId: "mov-001",
        type: "BUY",
        amount: "250.00",
        currencyCode: null,
        occurredAt: "2026-11-10T12:00:00.000Z",
        missingFields: ["currencyCode"],
      },
    ],
    page: 1,
    pageSize: 20,
    total: 1,
    ...overrides,
  };
}
