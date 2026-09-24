import { describe, expect, it } from "vitest";
import { ProblemDetailsError } from "../api/errors";
import { isResourceUnavailable, transactionsErrorMessage } from "./messages";

function problem(status: number, code: string) {
  return new ProblemDetailsError({ type: "about:blank", title: "t", status, code, detail: "Technical detail in English." });
}

describe("transactionsErrorMessage", () => {
  it.each([
    [400, "INVALID_REQUEST"],
    [400, "TRANSFER_ACCOUNTS_MUST_DIFFER"],
    [401, "AUTHENTICATION_REQUIRED"],
    [403, "IDENTITY_CONTEXT_UNAVAILABLE"],
    [404, "ACCOUNT_NOT_FOUND"],
    [404, "TRANSACTION_NOT_FOUND"],
    [404, "CATEGORY_NOT_FOUND"],
    [404, "CATEGORY_RULE_NOT_FOUND"],
    [409, "ACCOUNT_ARCHIVED"],
    [409, "CATEGORY_ARCHIVED"],
    [409, "CATEGORY_RULE_CONFLICT"],
    [409, "IDEMPOTENCY_KEY_REUSED"],
    [409, "IDEMPOTENCY_KEY_EXPIRED"],
    [409, "TRANSACTION_CATEGORIZATION_NOT_ALLOWED"],
  ])("tem mensagem própria em pt-BR para %i %s", (status, code) => {
    const message = transactionsErrorMessage(problem(status, code), "FALLBACK");
    expect(message).not.toBe("FALLBACK");
    expect(message).not.toContain("English");
  });

  it("usa a mesma mensagem para conta inexistente e arquivada", () => {
    expect(transactionsErrorMessage(problem(404, "ACCOUNT_NOT_FOUND"), "x")).toBe(
      transactionsErrorMessage(problem(409, "ACCOUNT_ARCHIVED"), "x"),
    );
    expect(transactionsErrorMessage(problem(404, "CATEGORY_NOT_FOUND"), "x")).toBe(
      transactionsErrorMessage(problem(409, "CATEGORY_ARCHIVED"), "x"),
    );
  });

  it("usa o fallback para erro interno e desconhecido", () => {
    expect(transactionsErrorMessage(problem(500, "INTERNAL_ERROR"), "Falha.")).toBe("Falha.");
    expect(transactionsErrorMessage(new Error("rede"), "Falha.")).toBe("Falha.");
  });
});

describe("isResourceUnavailable", () => {
  it("reconhece 404 e recursos arquivados", () => {
    expect(isResourceUnavailable(problem(404, "TRANSACTION_NOT_FOUND"))).toBe(true);
    expect(isResourceUnavailable(problem(409, "ACCOUNT_ARCHIVED"))).toBe(true);
    expect(isResourceUnavailable(problem(409, "CATEGORY_ARCHIVED"))).toBe(true);
    expect(isResourceUnavailable(problem(409, "IDEMPOTENCY_KEY_REUSED"))).toBe(false);
    expect(isResourceUnavailable(new Error("x"))).toBe(false);
  });
});
