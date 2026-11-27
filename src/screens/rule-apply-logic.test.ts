import { describe, expect, it } from "vitest";
import { ProblemDetailsError } from "../lib/api/errors";
import { applicationMessage, classifyApplyError, presetPeriod } from "./rule-apply-logic";

function problem(status: number, code: string) {
  return new ProblemDetailsError({ type: "about:blank", title: "t", status, code, detail: "detalhe técnico" });
}

describe("presetPeriod", () => {
  it("vai do primeiro dia do mês mais antigo ao último dia do mês atual", () => {
    expect(presetPeriod(3, new Date(2026, 10, 27))).toEqual({ from: "2026-09-01", to: "2026-11-30" });
    expect(presetPeriod(1, new Date(2026, 1, 10))).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(presetPeriod(1, new Date(2024, 1, 10))).toEqual({ from: "2024-02-01", to: "2024-02-29" });
  });

  it("atravessa a virada do ano", () => {
    expect(presetPeriod(3, new Date(2026, 1, 10))).toEqual({ from: "2025-12-01", to: "2026-02-28" });
    expect(presetPeriod(24, new Date(2026, 10, 27))).toEqual({ from: "2024-12-01", to: "2026-11-30" });
  });
});

describe("applicationMessage", () => {
  it("diz o que aconteceu em cada caso", () => {
    expect(applicationMessage({ examined: 0, categorized: 0, truncated: false })).toContain("Não há movimentações");
    expect(applicationMessage({ examined: 5, categorized: 0, truncated: false })).toContain("Nenhuma");
    expect(applicationMessage({ examined: 5, categorized: 1, truncated: false })).toBe("1 movimentação foi categorizada.");
    expect(applicationMessage({ examined: 5, categorized: 2, truncated: true })).toContain("aplique de novo");
  });
});

describe("classifyApplyError", () => {
  it("separa regra indisponível de falha comum, sem mostrar o detail", () => {
    expect(classifyApplyError(problem(404, "CATEGORY_RULE_NOT_FOUND"))).toMatchObject({ kind: "stale" });
    expect(classifyApplyError(problem(409, "CATEGORY_ARCHIVED"))).toMatchObject({ kind: "stale" });
    const generic = classifyApplyError(new Error("rede"));
    expect(generic).toMatchObject({ kind: "message" });
    expect(JSON.stringify(generic)).not.toContain("detalhe técnico");
  });
});
