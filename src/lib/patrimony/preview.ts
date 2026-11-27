import type { PatrimonyCollection, PatrimonyPage } from "./types";
import { pageSchema } from "./schema";

/**
 * Prévia de Bens e dívidas com dados de exemplo. Desligada por padrão: sem EXPO_PUBLIC_PATRIMONY_PREVIEW, a tela lê a
 * API de verdade. Em prévia nada é gravado: a tela esconde criar, editar e histórico.
 */
export function patrimonyPreviewEnabled(): boolean {
  return process.env.EXPO_PUBLIC_PATRIMONY_PREVIEW === "true";
}

const ID = {
  apartamento: "a1111111-1111-4111-8111-111111111111",
  carro: "a2222222-2222-4222-8222-222222222222",
  joias: "a3333333-3333-4333-8333-333333333333",
  finApartamento: "b1111111-1111-4111-8111-111111111111",
  finCarro: "b2222222-2222-4222-8222-222222222222",
  emprestimo: "c1111111-1111-4111-8111-111111111111",
  parcelamento: "c2222222-2222-4222-8222-222222222222",
};

/** Data civil AAAA-MM-DD, `days` dias antes de `now`. */
function civilDaysAgo(now: Date, days: number): string {
  const date = new Date(now);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

/**
 * Fictício: nada aqui representa patrimônio real. Datas relativas a `now`, para a prévia não
 * envelhecer. Os itens seguem o schema publicado (mesma validação da leitura real).
 */
export function patrimonyPreviewPage<C extends PatrimonyCollection>(
  collection: C,
  now: Date = new Date(),
): PatrimonyPage<C> {
  const stamp = now.toISOString();
  const base = {
    currencyCode: "BRL",
    version: 1,
    createdAt: stamp,
    updatedAt: stamp,
  };
  const items =
    collection === "assets"
      ? [
          {
            ...base,
            id: ID.apartamento,
            kind: "asset",
            type: "Imóvel",
            description: "Apartamento (exemplo)",
            estimatedValue: "480000.00",
            valuationDate: civilDaysAgo(now, 60),
            source: "Avaliação de corretor",
          },
          {
            ...base,
            id: ID.carro,
            kind: "asset",
            type: "Veículo",
            description: "Carro (exemplo)",
            estimatedValue: "62000.00",
            valuationDate: civilDaysAgo(now, 20),
            source: "Tabela de preços",
          },
          {
            ...base,
            id: ID.joias,
            kind: "asset",
            type: "Outro",
            description: "Joias (exemplo)",
            estimatedValue: "9500.00",
            valuationDate: civilDaysAgo(now, 400),
            source: "Estimativa própria",
          },
        ]
      : collection === "financings"
        ? [
            {
              ...base,
              id: ID.finApartamento,
              kind: "financing",
              description: "Financiamento do apartamento (exemplo)",
              outstandingBalance: "210000.00",
              assetId: ID.apartamento,
            },
            {
              ...base,
              id: ID.finCarro,
              kind: "financing",
              description: "Financiamento do carro (exemplo)",
              outstandingBalance: "18400.00",
              assetId: ID.carro,
            },
          ]
        : [
            {
              ...base,
              id: ID.emprestimo,
              kind: "liability",
              description: "Empréstimo pessoal (exemplo)",
              outstandingBalance: "7500.00",
            },
            {
              ...base,
              id: ID.parcelamento,
              kind: "liability",
              description: "Parcelamento de eletrodomésticos (exemplo)",
              outstandingBalance: "1280.00",
            },
          ];
  return pageSchema(collection).parse({
    items,
    page: 1,
    pageSize: 20,
    total: items.length,
  }) as PatrimonyPage<C>;
}
