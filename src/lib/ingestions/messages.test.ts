import { describe, expect, it } from "vitest";
import { ProblemDetailsError } from "../api/errors";
import { ApiRequestError } from "../api/http-client";
import { ingestionErrorMessage } from "./messages";

const FALLBACK = "Não foi possível importar o arquivo.";

function problem(status: number, code: string) {
  return new ProblemDetailsError({ type: "about:blank", title: "t", status, code, detail: "detalhe técnico" });
}

describe("ingestionErrorMessage", () => {
  it("traduz INVALID_REQUEST pelo status, como o backend distingue os casos", () => {
    expect(ingestionErrorMessage(problem(413, "INVALID_REQUEST"), FALLBACK)).toMatch(/limite de tamanho/);
    expect(ingestionErrorMessage(problem(415, "INVALID_REQUEST"), FALLBACK)).toMatch(/PDF não é aceito/);
    expect(ingestionErrorMessage(problem(422, "INVALID_REQUEST"), FALLBACK)).toMatch(/Não foi possível ler/);
    expect(ingestionErrorMessage(problem(404, "INVALID_REQUEST"), FALLBACK)).toMatch(/não foi encontrada/);
    expect(ingestionErrorMessage(problem(409, "INVALID_REQUEST"), FALLBACK)).toMatch(/já foi confirmada/);
    expect(ingestionErrorMessage(problem(503, "INTERNAL_ERROR"), FALLBACK)).toMatch(/indisponível no momento/);
  });

  it("dá prioridade aos códigos específicos sobre o status", () => {
    expect(ingestionErrorMessage(problem(409, "IDEMPOTENCY_KEY_REUSED"), FALLBACK)).toMatch(/dados mudaram/);
    expect(ingestionErrorMessage(problem(409, "ACCOUNT_ARCHIVED"), FALLBACK)).toMatch(/conta escolhida/);
    expect(ingestionErrorMessage(problem(404, "ACCOUNT_NOT_FOUND"), FALLBACK)).toMatch(/conta escolhida/);
  });

  it("usa o status também quando o corpo não é Problem Details", () => {
    const error = new ApiRequestError({ status: 413, code: "http_413", message: "x" });
    expect(ingestionErrorMessage(error, FALLBACK)).toMatch(/limite de tamanho/);
  });

  it("nunca exibe o detail do backend e cai no texto padrão", () => {
    expect(ingestionErrorMessage(problem(500, "INTERNAL_ERROR"), FALLBACK)).toBe(FALLBACK);
    expect(ingestionErrorMessage(new Error("detalhe técnico"), FALLBACK)).toBe(FALLBACK);
  });
});
