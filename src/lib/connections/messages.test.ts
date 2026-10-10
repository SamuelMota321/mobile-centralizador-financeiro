import { describe, expect, it } from "vitest";
import { ProblemDetailsError } from "../api/errors";
import { ApiRequestError } from "../api/http-client";
import { connectionErrorMessage } from "./messages";

const FALLBACK = "Não foi possível conectar.";

function problem(status: number, code: string) {
  return new ProblemDetailsError({ type: "about:blank", title: "t", status, code, detail: "detalhe técnico" });
}

describe("connectionErrorMessage", () => {
  it("traduz os códigos de conexão", () => {
    expect(connectionErrorMessage(problem(404, "CONNECTION_NOT_FOUND"), FALLBACK)).toMatch(/não foi encontrada/);
    expect(connectionErrorMessage(problem(409, "CONNECTION_CONFLICT"), FALLBACK)).toMatch(/mudou de estado/);
    expect(connectionErrorMessage(problem(503, "INTEGRATION_UNAVAILABLE"), FALLBACK)).toMatch(/indisponível/);
  });

  it("usa o status quando o corpo não é Problem Details", () => {
    const error = new ApiRequestError({ status: 503, code: "http_503", message: "x" });
    expect(connectionErrorMessage(error, FALLBACK)).toMatch(/indisponível/);
  });

  it("nunca exibe o detail do backend e cai no texto padrão", () => {
    expect(connectionErrorMessage(problem(500, "INTERNAL_ERROR"), FALLBACK)).toBe(FALLBACK);
    expect(connectionErrorMessage(new Error("detalhe técnico"), FALLBACK)).toBe(FALLBACK);
  });
});
