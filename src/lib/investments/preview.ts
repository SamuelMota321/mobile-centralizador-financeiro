import { positionPageSchema } from "./schema";
import type { PositionPage } from "./types";

/**
 * Prévia de Investimentos com dados de exemplo. Desligada por padrão: sem EXPO_PUBLIC_INVESTMENTS_PREVIEW, a
 * tela lê a API de verdade. Serve para validar o desenho enquanto o ambiente de teste não traz posições.
 */
export function investmentsPreviewEnabled(): boolean {
  return process.env.EXPO_PUBLIC_INVESTMENTS_PREVIEW === "true";
}

const CONNECTIONS = [
  "b2a7e0c4-1f3d-4a5b-8c9d-0e1f2a3b4c5d",
  "c3b8f1d5-2a4e-4b6c-9dae-1f2a3b4c5d6e",
  "d4c9a2e6-3b5f-4c7d-8ebf-2a3b4c5d6e7f",
  "e5dab3f7-4c60-4d8e-9fc0-3b4c5d6e7f80",
];
const P = {
  tesouro: "11111111-1111-4111-8111-111111111111",
  acoes: "22222222-2222-4222-8222-222222222222",
  fundo: "33333333-3333-4333-8333-333333333333",
  etf: "44444444-4444-4444-8444-444444444444",
  cdb: "55555555-5555-4555-8555-555555555555",
};

/** Um instante há `days` dias, às 13:00 UTC (10:00 em Brasília). */
function daysAgo(now: Date, days: number): string {
  const date = new Date(now);
  date.setUTCDate(date.getUTCDate() - days);
  date.setUTCHours(13, 0, 0, 0);
  return date.toISOString();
}

/**
 * Duas moedas (BRL e USD), cinco posições, uma desatualizada, uma indisponível e quatro conexões
 * em estados diferentes. Fictício: nada aqui representa uma carteira real. As datas são relativas
 * a `now`, para a prévia não envelhecer.
 */
export function investmentsPreviewPage(now: Date = new Date()): PositionPage {
  const ref = (days: number) => daysAgo(now, days);
  const member = (id: string, days: number) => ({ id, source: "pluggy" as const, referenceDate: ref(days) });
  const position = (id: string, connectionIndex: number, over: Record<string, unknown>) => ({
    id,
    connectionId: CONNECTIONS[connectionIndex],
    source: "pluggy",
    externalId: `preview-${id.slice(0, 4)}`,
    subtype: null,
    providerStatus: "ACTIVE",
    quantity: null,
    investedAmount: null,
    resultAmount: null,
    rate: null,
    rateType: null,
    fixedAnnualRate: null,
    maturityDate: null,
    missingFields: [],
    ...over,
  });

  const page = {
    portfolio: {
      availability: "partial",
      total: null,
      totalsByCurrency: [
        { currencyCode: "BRL", amount: "1950.00" },
        { currencyCode: "USD", amount: "1500.00" },
      ],
      referenceDate: ref(2),
      connections: [
        { connectionId: CONNECTIONS[0], availability: "complete" },
        { connectionId: CONNECTIONS[1], availability: "complete" },
        { connectionId: CONNECTIONS[2], availability: "partial" },
        { connectionId: CONNECTIONS[3], availability: "unavailable" },
      ],
      allocation: {
        basis: "active_current_complete_positive_balance",
        availability: "partial",
        knownPositionCount: 5,
        includedPositionCount: 3,
        excludedKnownPositionCount: 2,
        excludedByReason: { incomplete_or_stale: 2, non_active: 0, non_positive_balance: 0, unknown_currency: 0 },
        currencies: [
          {
            currencyCode: "BRL",
            denominatorAmount: "1250.00",
            byClass: [
              { assetClass: "FIXED_INCOME", amount: "800.00", percentage: "64.0", positions: [member(P.tesouro, 2)] },
              { assetClass: "MUTUAL_FUND", amount: "450.00", percentage: "36.0", positions: [member(P.fundo, 2)] },
            ],
            byInstitution: [{ institutionName: "Banco Alfa", amount: "1250.00", percentage: "100.0", positions: [member(P.tesouro, 2), member(P.fundo, 2)] }],
          },
          {
            currencyCode: "USD",
            denominatorAmount: "300.00",
            byClass: [{ assetClass: "ETF", amount: "300.00", percentage: "100.0", positions: [member(P.etf, 2)] }],
            byInstitution: [{ institutionName: "Corretora Beta", amount: "300.00", percentage: "100.0", positions: [member(P.etf, 2)] }],
          },
        ],
      },
    },
    positions: [
      position(P.tesouro, 0, { name: "Tesouro Selic 2028", assetType: "FIXED_INCOME", currencyCode: "BRL", balance: "800.00", institutionName: "Banco Alfa", referenceDate: ref(2), rate: "12.5", rateType: "CDI", maturityDate: "2028-03-01", dataQuality: { availability: "complete", freshness: "current" } }),
      position(P.acoes, 1, { name: "Ações XYZ", assetType: "EQUITY", currencyCode: "USD", balance: "1200.00", institutionName: "Corretora Beta", referenceDate: ref(12), dataQuality: { availability: "complete", freshness: "stale" } }),
      position(P.fundo, 0, { name: "Fundo Moderado", assetType: "MUTUAL_FUND", currencyCode: "BRL", balance: "450.00", institutionName: "Banco Alfa", referenceDate: ref(2), dataQuality: { availability: "partial", freshness: "current" }, missingFields: ["quantity"] }),
      position(P.etf, 1, { name: "ETF Global", assetType: "ETF", currencyCode: "USD", balance: "300.00", institutionName: "Corretora Beta", referenceDate: ref(2), fixedAnnualRate: "11", resultAmount: "20.00", dataQuality: { availability: "complete", freshness: "current" } }),
      position(P.cdb, 3, { name: "CDB Flexível", assetType: "FIXED_INCOME", currencyCode: "BRL", balance: "700.00", institutionName: "Banco Alfa", referenceDate: null, dataQuality: { availability: "unavailable", freshness: "unknown" } }),
    ],
    page: 1,
    pageSize: 20,
    total: 5,
  };
  return positionPageSchema.parse(page);
}
