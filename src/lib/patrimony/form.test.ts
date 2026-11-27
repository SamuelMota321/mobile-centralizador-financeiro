import { describe, expect, it } from "vitest";
import { changedFields, parseAmountInput, parsePatrimonyForm } from "./form";
import { ASSET_ID } from "./fixtures";

describe("parseAmountInput", () => {
  it("aceita pt-BR e zero, recusa negativo e texto", () => {
    expect(parseAmountInput("1.250,00")).toBe("1250.00");
    expect(parseAmountInput("R$ 10,5")).toBe("10.50");
    expect(parseAmountInput("0")).toBe("0.00");
    expect(parseAmountInput("0,00")).toBe("0.00");
    expect(parseAmountInput("-10")).toBeNull();
    expect(parseAmountInput("dez")).toBeNull();
  });
});

describe("parsePatrimonyForm", () => {
  const asset = {
    type: "Imóvel",
    description: "Apartamento",
    estimatedValue: "350.000,00",
    valuationDate: "01/10/2026",
    source: "Avaliação de corretor",
  };

  it("monta o bem com data civil e valor do contrato", () => {
    expect(parsePatrimonyForm("assets", asset)).toEqual({
      ok: true,
      input: { ...asset, estimatedValue: "350000.00", valuationDate: "2026-10-01" },
    });
  });

  it("aponta cada campo inválido do bem", () => {
    const result = parsePatrimonyForm("assets", { ...asset, type: " ", valuationDate: "31/02/2026", source: "x".repeat(121) });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.errors).sort()).toEqual(["source", "type", "valuationDate"]);
  });

  it("financiamento sem bem envia assetId nulo; com bem, o id", () => {
    const base = { description: "Financiamento", outstandingBalance: "1.000,00" };
    expect(parsePatrimonyForm("financings", { ...base, assetId: "" })).toMatchObject({ ok: true, input: { assetId: null } });
    expect(parsePatrimonyForm("financings", { ...base, assetId: ASSET_ID })).toMatchObject({ ok: true, input: { assetId: ASSET_ID } });
    expect(parsePatrimonyForm("financings", { ...base, assetId: "../x" }).ok).toBe(false);
  });

  it("passivo pede descrição e saldo", () => {
    const result = parsePatrimonyForm("liabilities", { description: "", outstandingBalance: "abc" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.errors).sort()).toEqual(["description", "outstandingBalance"]);
  });

  it("descrição acima de 500 caracteres é recusada", () => {
    expect(parsePatrimonyForm("liabilities", { description: "x".repeat(501), outstandingBalance: "1" }).ok).toBe(false);
  });
});

describe("changedFields", () => {
  it("devolve só o que mudou", () => {
    const current = { description: "A", outstandingBalance: "10.00", assetId: ASSET_ID };
    expect(changedFields<"financings">(current, { ...current, assetId: null })).toEqual({ assetId: null });
    expect(changedFields<"financings">(current, current)).toEqual({});
  });
});
