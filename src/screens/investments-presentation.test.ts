import { describe, expect, it } from "vitest";
import {
  ABSENT,
  assetClassLabel,
  coverageText,
  exclusionLabel,
  formatAmount,
  formatMaturity,
  formatReference,
  freshnessLabel,
  metaLine,
  optionalAmount,
  optionalText,
  percentageText,
  groupMeta,
  rateText,
  totalNote,
} from "./investments-presentation";

describe("formatAmount", () => {
  it("formata BRL e preserva as casas da fonte", () => {
    expect(formatAmount("1234567.5", "BRL")).toBe("R$ 1.234.567,5");
    expect(formatAmount("1000.00", "BRL")).toBe("R$ 1.000,00");
  });

  it("usa o código de outra moeda sem converter", () => {
    expect(formatAmount("12.34", "USD")).toBe("USD 12,34");
  });

  it("sem moeda não assume BRL", () => {
    expect(formatAmount("12.34", null)).toBe("12,34 (moeda não informada)");
  });

  it("usa o sinal tipográfico e devolve texto inválido intacto", () => {
    expect(formatAmount("-5.00", "BRL")).toBe("−R$ 5,00");
    expect(formatAmount("abc", "BRL")).toBe("abc");
  });
});

describe("campos ausentes", () => {
  it("escreve como ausente, nunca como zero", () => {
    expect(optionalAmount(null, "BRL")).toBe(ABSENT);
    expect(optionalText(null)).toBe(ABSENT);
    expect(optionalText("")).toBe(ABSENT);
    expect(formatMaturity(null)).toBe(ABSENT);
    expect(rateText({ rate: null, rateType: null, fixedAnnualRate: null })).toBe(ABSENT);
  });

  it("mantém zero legítimo como valor", () => {
    expect(optionalAmount("0.00", "BRL")).toBe("R$ 0,00");
  });
});

describe("referência e metadados", () => {
  it("converte para o horário de Brasília", () => {
    expect(formatReference("2026-11-22T13:00:00.000Z")).toBe("22/11 10:00");
  });

  it("referência ausente ou inválida é dita explicitamente", () => {
    expect(formatReference(null)).toBe("Referência não informada");
    expect(formatReference("ontem")).toBe("Referência não informada");
    expect(metaLine("pluggy", null)).toBe("Pluggy · referência não informada");
  });

  it("monta a linha Origem · ref.", () => {
    expect(metaLine("pluggy", "2026-11-22T13:00:00.000Z")).toBe("Pluggy · ref. 22/11 10:00");
  });
});

describe("rótulos", () => {
  it("nomeia a classe não classificada e os estados de frescor", () => {
    expect(assetClassLabel("UNCLASSIFIED")).toBe("Não classificado");
    expect(freshnessLabel("stale")).toBe("Desatualizado");
    expect(freshnessLabel("unknown")).toBe("Referência desconhecida");
    expect(exclusionLabel("unknown_currency")).toBe("moeda não informada");
  });

  it("vencimento aceita data ou data e hora", () => {
    expect(formatMaturity("2029-05-10")).toBe("10/05/2029");
    expect(formatMaturity("2029-05-10T00:00:00.000Z")).toBe("10/05/2029");
  });

  it("taxa junta o que a fonte enviou, sem calcular", () => {
    expect(rateText({ rate: "110", rateType: "CDI", fixedAnnualRate: null })).toBe("Taxa 110 (CDI)");
    expect(rateText({ rate: null, rateType: null, fixedAnnualRate: "12.5" })).toBe("Prefixada 12.5% ao ano");
  });

  it("cobertura usa só as contagens declaradas", () => {
    expect(coverageText(2, 3)).toBe("2 de 3 posições conhecidas entram no cálculo.");
    expect(coverageText(1, 1)).toBe("1 de 1 posição conhecida entra no cálculo.");
  });
});

describe("totalNote", () => {
  const base = { availability: "complete" as const, totalsByCurrency: [] };

  it("sem nota quando há total", () => {
    expect(totalNote({ ...base, total: { currencyCode: "BRL", amount: "1.00" } })).toBeNull();
  });

  it("explica moedas diferentes, cobertura incompleta e ausência de posições", () => {
    const two = [{ currencyCode: "BRL", amount: "1.00" }, { currencyCode: "USD", amount: "1.00" }];
    expect(totalNote({ ...base, total: null, totalsByCurrency: two })).toMatch(/mais de uma moeda/);
    expect(totalNote({ ...base, total: null, availability: "partial" })).toMatch(/incompleta/);
    expect(totalNote({ ...base, total: null })).toMatch(/Sem posição ativa/);
  });
});

describe("composição", () => {
  it("troca só o separador do percentual", () => {
    expect(percentageText("66.7")).toBe("66,7%");
    expect(percentageText("0.0")).toBe("0,0%");
  });

  it("origem e referência do grupo usam a referência mais antiga", () => {
    expect(
      groupMeta([
        { source: "pluggy", referenceDate: "2026-11-22T13:00:00.000Z" },
        { source: "pluggy", referenceDate: "2026-11-20T13:00:00.000Z" },
      ]),
    ).toBe("Pluggy · 2 posições · ref. mais antiga 20/11 10:00");
  });

  it("referência ausente em alguma posição é declarada", () => {
    expect(groupMeta([{ source: "pluggy", referenceDate: null }])).toBe("Pluggy · 1 posição · referência ausente em parte");
  });
});
