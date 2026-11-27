import { describe, expect, it } from "vitest";
import { allocationView } from "../lib/investments/fixtures";
import { allocationSchema } from "../lib/investments/schema";
import {
  availabilityShare,
  civilDateInSaoPaulo,
  formatReference,
  refreshMessage,
  classByPosition,
  positionDataText,
  rateCell,
  referenceAge,
  referenceDay,
  resultCell,
  selectedCurrency,
} from "./investments-presentation";

const USD_ID = "6c1d2e3f-4a5b-4c6d-8e7f-0a1b2c3d4e5f";
const BRL_ID = "7d2e3f4a-5b6c-4d7e-9f80-1b2c3d4e5f60";
const NOW = new Date("2025-11-27T15:00:00.000Z"); // 12:00 em Brasília

describe("data e idade da referência (calendário de Brasília)", () => {
  it("usa o dia de Brasília, não o do servidor em UTC", () => {
    // 02:30 UTC de 28/11 ainda é 27/11 em Brasília.
    expect(civilDateInSaoPaulo(new Date("2025-11-28T02:30:00.000Z"))).toBe("2025-11-27");
    expect(referenceDay("2025-11-28T02:30:00.000Z")).toBe("27/11/2025");
  });

  it("hoje, dias e meses; ausente, inválida ou futura não têm texto", () => {
    expect(referenceAge("2025-11-27T13:00:00.000Z", NOW)).toBe("hoje");
    expect(referenceAge("2025-11-25T13:00:00.000Z", NOW)).toBe("há 2 dias");
    expect(referenceAge("2025-09-27T13:00:00.000Z", NOW)).toBe("há 2 meses");
    expect(referenceAge(null, NOW)).toBeNull();
    expect(referenceAge("lixo", NOW)).toBeNull();
    expect(referenceAge("2025-12-05T13:00:00.000Z", NOW)).toBeNull();
    expect(referenceDay(null)).toBe("Referência não informada");
  });
});

describe("availabilityShare (por conexão)", () => {
  const connections = [
    { availability: "complete" as const },
    { availability: "complete" as const },
    { availability: "partial" as const },
    { availability: "unavailable" as const },
  ];

  it("conta e arredonda por conexão", () => {
    expect(availabilityShare(connections)).toEqual({ total: 4, complete: 2, partial: 1, unavailable: 1, percent: { complete: 50, partial: 25, unavailable: 25 } });
  });

  it("sem conexões não divide por zero", () => {
    expect(availabilityShare([])).toEqual({ total: 0, complete: 0, partial: 0, unavailable: 0, percent: { complete: 0, partial: 0, unavailable: 0 } });
  });
});

describe("positionDataText", () => {
  const base = { referenceDate: "2025-11-27T13:00:00.000Z" };

  it("completo e atual diz a data; completo e desatualizado diz a idade", () => {
    expect(positionDataText({ ...base, dataQuality: { availability: "complete", freshness: "current" } }, NOW)).toEqual({ label: "Atualizado em 27/11/2025", tone: "positive", detail: null });
    expect(positionDataText({ referenceDate: "2025-11-19T13:00:00.000Z", dataQuality: { availability: "complete", freshness: "stale" } }, NOW)).toEqual({ label: "Desatualizado · há 8 dias", tone: "warning", detail: null });
    expect(positionDataText({ referenceDate: null, dataQuality: { availability: "complete", freshness: "unknown" } }, NOW).label).toBe("Referência desconhecida");
  });

  it("parcial leva a atualização numa segunda linha; indisponível vence tudo", () => {
    expect(positionDataText({ ...base, dataQuality: { availability: "partial", freshness: "current" } }, NOW)).toEqual({ label: "Dados parciais", tone: "warning", detail: "Atualizado em 27/11/2025" });
    expect(positionDataText({ ...base, dataQuality: { availability: "unavailable", freshness: "current" } }, NOW)).toEqual({ label: "Dados indisponíveis", tone: "neutral", detail: null });
  });
});

describe("colunas de taxa e resultado", () => {
  it("traço quando a fonte não enviou; taxa como a fonte enviou", () => {
    expect(rateCell({ rate: null, rateType: null, fixedAnnualRate: null })).toBe("—");
    expect(rateCell({ rate: "12.5", rateType: "CDI", fixedAnnualRate: null })).toBe("Taxa 12.5 (CDI)");
    expect(resultCell({ resultAmount: null, currencyCode: "BRL" })).toBe("—");
    expect(resultCell({ resultAmount: "100.00", currencyCode: "BRL" })).toBe("R$ 100,00");
  });
});

describe("composição por moeda", () => {
  const allocation = allocationSchema.parse(
    allocationView({
      currencies: [
        { currencyCode: "USD", denominatorAmount: "10.00", byClass: [{ assetClass: "EQUITY", amount: "10.00", percentage: "100.0", positions: [{ id: USD_ID, source: "pluggy", referenceDate: null }] }], byInstitution: [] },
        { currencyCode: "BRL", denominatorAmount: "20.00", byClass: [{ assetClass: "FIXED_INCOME", amount: "20.00", percentage: "100.0", positions: [{ id: BRL_ID, source: "pluggy", referenceDate: null }] }], byInstitution: [] },
      ],
    }),
  );

  it("escolhe a moeda da URL; sem ela, BRL; senão a primeira", () => {
    expect(selectedCurrency(allocation, "USD")?.currencyCode).toBe("USD");
    expect(selectedCurrency(allocation, null)?.currencyCode).toBe("BRL");
    expect(selectedCurrency(allocation, "EUR")?.currencyCode).toBe("BRL");
    expect(selectedCurrency({ ...allocation, currencies: [allocation.currencies[0]] }, null)?.currencyCode).toBe("USD");
    expect(selectedCurrency({ ...allocation, currencies: [] }, "BRL")).toBeNull();
  });

  it("acha a classe de cada posição que entrou no cálculo", () => {
    const classes = classByPosition(allocation);
    expect(classes.get(BRL_ID)).toBe("FIXED_INCOME");
    expect(classes.get(USD_ID)).toBe("EQUITY");
    expect(classes.get("fora")).toBeUndefined();
  });
});

describe("hora de Brasília calculada em UTC-3, sem Intl com fuso", () => {
  it("formata a referência no horário de Brasília, com virada de dia", () => {
    expect(formatReference("2026-11-22T13:00:00.000Z")).toBe("22/11 10:00");
    expect(formatReference("2026-11-22T02:30:00.000Z")).toBe("21/11 23:30");
    expect(formatReference(null)).toBe("Referência não informada");
    expect(formatReference("lixo")).toBe("Referência não informada");
  });
});

describe("refreshMessage", () => {
  it("diz o que foi pedido, o que já andava e o que falhou", () => {
    expect(refreshMessage({ total: 4, requested: 4, running: 0, failed: 0 })).toEqual({
      tone: "success",
      text: "Atualização das conexões: 4 pedidas. Os dados novos podem levar alguns minutos.",
    });
    const mixed = refreshMessage({ total: 4, requested: 2, running: 1, failed: 1 });
    expect(mixed.tone).toBe("warning");
    expect(mixed.text).toContain("1 já estava em andamento");
    expect(refreshMessage({ total: 0, requested: 0, running: 0, failed: 0 }).tone).toBe("info");
  });
});
