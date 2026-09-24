import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { ProblemDetailsError, type ProblemDetails } from "../lib/api/errors";
import { ApiRequestError } from "../lib/api/http-client";
import { classifySubmitError, parseMovementFields, parseTransferFields } from "./movement-input";

// expo-crypto e modulo nativo; no Node o teste usa o gerador equivalente.
vi.mock("expo-crypto", () => ({ randomUUID: () => randomUUID() }));

const ACCOUNT_A = "3f1c2b4e-8a6d-4c1e-9b2a-7d5e6f8a9b0c";
const ACCOUNT_B = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";

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

const movement = {
  accountId: ACCOUNT_A,
  type: "expense",
  amount: "1.234,56",
  date: "20/09/2026",
  description: "  Mercado  ",
};

describe("parseMovementFields", () => {
  it("normaliza valor, data e descrição para o contrato", () => {
    expect(parseMovementFields(movement)).toEqual({
      ok: true,
      input: {
        accountId: ACCOUNT_A,
        type: "expense",
        amount: "1234.56",
        occurredOn: "2026-09-20",
        description: "Mercado",
      },
    });
  });

  it.each(["0,00", "0,001", "-10", "abc", ""])("recusa o valor %j", (amount) => {
    expect(parseMovementFields({ ...movement, amount })).toEqual({
      ok: false,
      fieldErrors: { amount: expect.stringContaining("maior que zero") },
    });
  });

  it("aceita 1.000.000,00", () => {
    expect(parseMovementFields({ ...movement, amount: "1.000.000,00" })).toMatchObject({
      ok: true,
      input: { amount: "1000000.00" },
    });
  });

  it.each(["29/02/2026", "2026-09-20", "31/04/2026", ""])("recusa a data %j", (date) => {
    expect(parseMovementFields({ ...movement, date })).toEqual({
      ok: false,
      fieldErrors: { occurredOn: expect.stringContaining("DD/MM/AAAA") },
    });
  });

  it("aceita 29/02 em ano bissexto", () => {
    expect(parseMovementFields({ ...movement, date: "29/02/2028" })).toMatchObject({ ok: true });
  });

  it("usa mensagens em pt-BR para conta e tipo", () => {
    expect(parseMovementFields({ ...movement, accountId: "", type: "transfer" })).toEqual({
      ok: false,
      fieldErrors: { accountId: "Escolha uma conta.", type: "Escolha receita ou despesa." },
    });
  });
});

describe("parseTransferFields", () => {
  const transfer = {
    fromAccountId: ACCOUNT_A,
    toAccountId: ACCOUNT_B,
    amount: "50",
    date: "20/09/2026",
    description: "",
  };

  it("aceita contas distintas e descrição vazia", () => {
    expect(parseTransferFields(transfer)).toMatchObject({
      ok: true,
      input: { amount: "50.00", description: null },
    });
  });

  it("recusa origem igual ao destino", () => {
    expect(parseTransferFields({ ...transfer, toAccountId: ACCOUNT_A.toUpperCase() })).toEqual({
      ok: false,
      fieldErrors: { toAccountId: "Escolha contas de origem e destino diferentes." },
    });
  });
});

describe("classifySubmitError", () => {
  const fallback = "Não foi possível registrar.";

  it("401 com ou sem Problem Details descarta a sessão", () => {
    expect(classifySubmitError(problem(401, "AUTHENTICATION_REQUIRED"), fallback)).toEqual({
      kind: "unauthorized",
    });
    expect(classifySubmitError(new ApiRequestError({ status: 401, code: "HTTP_401", message: "x" }), fallback)).toEqual({
      kind: "unauthorized",
    });
  });

  it.each(["IDEMPOTENCY_KEY_REUSED", "IDEMPOTENCY_KEY_EXPIRED"])("%s troca a chave", (code) => {
    expect(classifySubmitError(problem(409, code), fallback)).toMatchObject({
      kind: "message",
      rotateKey: true,
    });
  });

  it.each([
    [404, "ACCOUNT_NOT_FOUND"],
    [409, "ACCOUNT_ARCHIVED"],
  ])("%i %s pede recarga das contas", (status, code) => {
    expect(classifySubmitError(problem(status, code), fallback)).toMatchObject({
      kind: "accountUnavailable",
    });
  });

  it("TRANSFER_ACCOUNTS_MUST_DIFFER vira erro no destino", () => {
    expect(classifySubmitError(problem(400, "TRANSFER_ACCOUNTS_MUST_DIFFER"), fallback)).toEqual({
      kind: "fields",
      fieldErrors: { toAccountId: expect.stringContaining("diferentes") },
    });
  });

  it("mapeia errors[].path do 400 para o campo", () => {
    const error = problem(400, "INVALID_REQUEST", {
      errors: [{ path: "amount", code: "INVALID_VALUE", message: "Invalid value." }],
    });
    expect(classifySubmitError(error, fallback)).toEqual({
      kind: "fields",
      fieldErrors: { amount: expect.stringContaining("maior que zero") },
    });
  });

  it.each([
    ["500", problem(500, "INTERNAL_ERROR")],
    ["403", problem(403, "IDENTITY_CONTEXT_UNAVAILABLE")],
    ["rede", new TypeError("Network request failed")],
  ])("%s mantém a chave e não expoe detalhe tecnico", (_, error) => {
    const result = classifySubmitError(error, fallback);
    expect(result).toMatchObject({ kind: "message", rotateKey: false });
    expect(result.kind === "message" && result.message).not.toContain("English");
  });
});
