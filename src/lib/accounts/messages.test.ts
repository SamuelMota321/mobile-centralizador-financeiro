import { describe, expect, it } from "vitest";
import { ProblemDetailsError, type ProblemDetails } from "../api/errors";
import { ApiRequestError } from "../api/http-client";
import {
  ACCOUNT_UNAVAILABLE_MESSAGE,
  accountErrorMessage,
  fieldErrorsFromProblem,
  isAccountUnavailable,
  isUnauthorized,
} from "./messages";

function problem(overrides: Partial<ProblemDetails>): ProblemDetailsError {
  return new ProblemDetailsError({
    type: "about:blank",
    title: "Error",
    status: 400,
    code: "INVALID_REQUEST",
    detail: "Technical detail in English.",
    ...overrides,
  });
}

describe("accountErrorMessage", () => {
  it("usa a mesma mensagem para conta inexistente e arquivada", () => {
    const notFound = problem({ status: 404, code: "ACCOUNT_NOT_FOUND" });
    const archived = problem({ status: 409, code: "ACCOUNT_ARCHIVED" });
    expect(accountErrorMessage(notFound, "x")).toBe(ACCOUNT_UNAVAILABLE_MESSAGE);
    expect(accountErrorMessage(archived, "x")).toBe(ACCOUNT_UNAVAILABLE_MESSAGE);
  });

  it("nunca devolve o detail do backend", () => {
    for (const code of ["ACCOUNT_NOT_FOUND", "CONNECTED_ACCOUNT_READ_ONLY", "INTERNAL_ERROR", "UNMAPPED"]) {
      expect(accountErrorMessage(problem({ code }), "Falha.")).not.toContain("English");
    }
  });

  it("usa o fallback para codigos e erros desconhecidos", () => {
    expect(accountErrorMessage(problem({ code: "UNMAPPED" }), "Falha.")).toBe("Falha.");
    expect(accountErrorMessage(new Error("boom"), "Falha.")).toBe("Falha.");
  });
});

describe("isAccountUnavailable", () => {
  it("reconhece somente 404 e conta arquivada", () => {
    expect(isAccountUnavailable(problem({ code: "ACCOUNT_NOT_FOUND" }))).toBe(true);
    expect(isAccountUnavailable(problem({ code: "ACCOUNT_ARCHIVED" }))).toBe(true);
    expect(isAccountUnavailable(problem({ code: "CONNECTED_ACCOUNT_READ_ONLY" }))).toBe(false);
    expect(isAccountUnavailable(new Error("x"))).toBe(false);
  });
});

describe("fieldErrorsFromProblem", () => {
  it("mapeia errors[] para mensagens em pt-BR por campo", () => {
    const error = problem({
      errors: [
        { path: "initialBalance", code: "BALANCE_REFERENCE_PAIR_REQUIRED", message: "Both required." },
        { path: "name", code: "OUT_OF_RANGE", message: "Invalid value." },
        { path: "origin", code: "IMMUTABLE_FIELD", message: "Field cannot be changed." },
        { path: "type", code: "INVALID_VALUE", message: "Invalid value." },
      ],
    });
    expect(fieldErrorsFromProblem(error)).toEqual({
      initialBalance: "Informe saldo inicial e data de referencia juntos.",
      name: "Valor fora do limite permitido.",
      origin: "Este campo nao pode ser alterado.",
      type: "Valor invalido.",
    });
  });

  it("mantem o primeiro erro de cada campo", () => {
    const error = problem({
      errors: [
        { path: "name", code: "OUT_OF_RANGE", message: "a" },
        { path: "name", code: "INVALID_VALUE", message: "b" },
      ],
    });
    expect(fieldErrorsFromProblem(error)).toEqual({ name: "Valor fora do limite permitido." });
  });

  it("retorna vazio quando nao ha erros de campo", () => {
    expect(fieldErrorsFromProblem(problem({}))).toEqual({});
    expect(fieldErrorsFromProblem(new Error("x"))).toEqual({});
  });
});

describe("isUnauthorized", () => {
  it("reconhece 401 com e sem corpo Problem Details", () => {
    expect(isUnauthorized(problem({ status: 401, code: "AUTHENTICATION_REQUIRED" }))).toBe(true);
    expect(isUnauthorized(new ApiRequestError({ status: 401, code: "http_401", message: "x" }))).toBe(true);
  });

  it("nao trata 403 nem erros comuns como sessao expirada", () => {
    expect(isUnauthorized(problem({ status: 403, code: "IDENTITY_CONTEXT_UNAVAILABLE" }))).toBe(false);
    expect(isUnauthorized(new Error("x"))).toBe(false);
  });
});
