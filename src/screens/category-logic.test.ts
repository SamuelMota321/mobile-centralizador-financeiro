import { describe, expect, it } from "vitest";
import { ProblemDetailsError, type ProblemDetails } from "../lib/api/errors";
import { ApiRequestError } from "../lib/api/http-client";
import {
  classifyCategorizeError,
  classifyCategoryError,
  DUPLICATE_NAME_MESSAGE,
  hasNameConflict,
  parseCategoryName,
} from "./category-logic";

function problem(status: number, code: string, extra: Partial<ProblemDetails> = {}) {
  return new ProblemDetailsError({
    type: "about:blank",
    title: "t",
    status,
    code,
    detail: "Technical detail in English.",
    ...extra,
  });
}

const categories = [
  { id: "a", name: "Mercado" },
  { id: "b", name: "Transporte" },
];

describe("hasNameConflict", () => {
  it("compara exato, diferenciando maiusculas, e ignora a propria categoria", () => {
    expect(hasNameConflict("Mercado", categories)).toBe(true);
    expect(hasNameConflict("mercado", categories)).toBe(false);
    expect(hasNameConflict("Mercado", categories, "a")).toBe(false);
  });
});

describe("parseCategoryName", () => {
  it("normaliza espacos e aceita acentos", () => {
    expect(parseCategoryName("  Alimentação   fora ", categories)).toEqual({
      ok: true,
      name: "Alimentação fora",
    });
  });

  it.each(["", "   ", "a".repeat(101)])("recusa %j", (raw) => {
    expect(parseCategoryName(raw, categories)).toMatchObject({ ok: false });
  });

  it("aceita exatamente 100 caracteres", () => {
    expect(parseCategoryName("a".repeat(100), categories)).toMatchObject({ ok: true });
  });

  it("recusa nome repetido com mensagem clara", () => {
    expect(parseCategoryName(" Mercado ", categories)).toEqual({
      ok: false,
      message: DUPLICATE_NAME_MESSAGE,
    });
  });
});

describe("classifyCategoryError", () => {
  const fallback = "Nao foi possivel criar a categoria.";

  it("401 com ou sem Problem Details descarta a sessao", () => {
    expect(classifyCategoryError(problem(401, "AUTHENTICATION_REQUIRED"), fallback)).toEqual({
      kind: "unauthorized",
    });
    expect(
      classifyCategoryError(new ApiRequestError({ status: 401, code: "HTTP_401", message: "x" }), fallback),
    ).toEqual({ kind: "unauthorized" });
  });

  it("404 e neutro e pede recarga", () => {
    expect(classifyCategoryError(problem(404, "CATEGORY_NOT_FOUND"), fallback)).toMatchObject({
      kind: "unavailable",
    });
  });

  it("400 com erro no nome fica no campo; sem erros indica categoria arquivada", () => {
    expect(
      classifyCategoryError(
        problem(400, "INVALID_REQUEST", {
          errors: [{ path: "name", code: "OUT_OF_RANGE", message: "x" }],
        }),
        fallback,
      ),
    ).toMatchObject({ kind: "field" });
    expect(classifyCategoryError(problem(400, "INVALID_REQUEST"), fallback)).toMatchObject({
      kind: "unavailable",
      message: expect.stringContaining("arquivada"),
    });
  });

  it("500 vira mensagem segura que cita nome repetido", () => {
    const result = classifyCategoryError(problem(500, "INTERNAL_ERROR"), fallback);
    expect(result).toMatchObject({ kind: "message", message: expect.stringContaining("use outro") });
    expect(result.kind === "message" && result.message).not.toContain("English");
  });
});

describe("classifyCategorizeError", () => {
  it.each([
    [409, "CATEGORY_ARCHIVED", "arquivada"],
    [404, "CATEGORY_NOT_FOUND", "nao esta mais disponivel"],
    [404, "TRANSACTION_NOT_FOUND", "nao esta mais disponivel"],
    [409, "TRANSACTION_CATEGORIZATION_NOT_ALLOWED", "Transferencias"],
  ])("%i %s pede recarga com mensagem propria", (status, code, text) => {
    expect(classifyCategorizeError(problem(status, code))).toEqual({
      kind: "refresh",
      message: expect.stringContaining(text),
    });
  });

  it("401 descarta a sessao", () => {
    expect(classifyCategorizeError(problem(401, "AUTHENTICATION_REQUIRED"))).toEqual({
      kind: "unauthorized",
    });
  });

  it.each([
    ["500", problem(500, "INTERNAL_ERROR")],
    ["rede", new TypeError("Network request failed")],
  ])("%s vira mensagem segura", (_, error) => {
    expect(classifyCategorizeError(error)).toEqual({
      kind: "message",
      message: "Nao foi possivel atualizar a categoria. Tente de novo.",
    });
  });
});
