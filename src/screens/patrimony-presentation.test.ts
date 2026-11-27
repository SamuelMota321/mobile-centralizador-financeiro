import { describe, expect, it } from "vitest";
import type { Asset, Financing } from "../lib/patrimony/types";
import { ASSET_UNAVAILABLE, assetLabel, editableState, formatStamp, formValuesFromItem, NO_ASSET, stateFacts, valuationAge } from "./patrimony-presentation";

describe("valuationAge", () => {
  const today = "2025-11-27";

  it("hoje, dias, meses e anos (meses inteiros; anos só a partir de 24 meses)", () => {
    expect(valuationAge("2025-11-27", today)).toBe("hoje");
    expect(valuationAge("2025-11-26", today)).toBe("há 1 dia");
    expect(valuationAge("2025-11-10", today)).toBe("há 17 dias");
    expect(valuationAge("2025-10-27", today)).toBe("há 1 mês");
    expect(valuationAge("2024-06-15", today)).toBe("há 17 meses");
    expect(valuationAge("2024-11-27", today)).toBe("há 12 meses");
    expect(valuationAge("2023-11-27", today)).toBe("há 2 anos");
    expect(valuationAge("2023-01-10", today)).toBe("há 2 anos");
  });

  it("o dia do mês decide o mês incompleto; data futura não tem texto", () => {
    expect(valuationAge("2025-10-28", today)).toBe("há 30 dias");
    expect(valuationAge("2024-11-28", today)).toBe("há 11 meses");
    expect(valuationAge("2025-12-01", today)).toBeNull();
  });
});

describe("assetLabel", () => {
  it("nomeia o bem do financiamento sem expor o UUID", () => {
    const assets = [{ id: "a", description: "Apartamento" }];
    expect(assetLabel("a", assets)).toBe("Apartamento");
    expect(assetLabel("b", assets)).toBe(ASSET_UNAVAILABLE);
    expect(assetLabel("a", null)).toBe(ASSET_UNAVAILABLE);
    expect(assetLabel(null, assets)).toBe(NO_ASSET);
  });
});

describe("formatStamp", () => {
  it("horário de Brasília (UTC-3), com virada de dia", () => {
    expect(formatStamp("2026-11-20T15:00:00.000Z")).toBe("20/11/2026 12:00");
    expect(formatStamp("2026-11-20T02:30:00.000Z")).toBe("19/11/2026 23:30");
    expect(formatStamp("2027-01-01T02:59:00.000Z")).toBe("31/12/2026 23:59");
  });
});

describe("valores do formulário e fatos da versão", () => {
  const base = { id: "i", currencyCode: "BRL" as const, version: 2, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" };
  const asset: Asset = { ...base, kind: "asset", description: "Apartamento", type: "Imóvel", estimatedValue: "450000.00", valuationDate: "2024-06-15", source: "Corretor" };
  const financing: Financing = { ...base, kind: "financing", description: "Financiamento", outstandingBalance: "180000.50", assetId: null };

  it("bem: valor com vírgula e data DD/MM/AAAA; financiamento sem bem vira texto vazio", () => {
    expect(formValuesFromItem(asset)).toEqual({ description: "Apartamento", type: "Imóvel", estimatedValue: "450000,00", valuationDate: "15/06/2024", source: "Corretor" });
    expect(formValuesFromItem(financing)).toEqual({ description: "Financiamento", outstandingBalance: "180000,50", assetId: "" });
    expect(formValuesFromItem()).toEqual({});
  });

  it("estado editável tem só os campos que a API aceita", () => {
    expect(Object.keys(editableState(asset)).sort()).toEqual(["description", "estimatedValue", "source", "type", "valuationDate"]);
    expect(Object.keys(editableState(financing)).sort()).toEqual(["assetId", "description", "outstandingBalance"]);
  });

  it("fatos de uma versão, com o bem associado pelo nome", () => {
    const facts = stateFacts("financings", { description: "Financiamento", outstandingBalance: "180000.50", assetId: "a" }, [{ id: "a", description: "Apartamento" }]);
    expect(facts).toEqual([["Descrição", "Financiamento"], ["Saldo devedor", "R$ 180.000,50"], ["Bem associado", "Apartamento"]]);
    expect(stateFacts("assets", editableState(asset) as never, null)[3]).toEqual(["Data da avaliação", "15/06/2024"]);
  });
});
