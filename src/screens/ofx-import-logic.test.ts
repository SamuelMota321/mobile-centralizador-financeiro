import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { ProblemDetailsError } from "../lib/api/errors";
import { ApiRequestError } from "../lib/api/http-client";
import { previewItem, previewRun, resultRun } from "../lib/ingestions/fixtures";
import { importRunSchema } from "../lib/ingestions/schema";
import { IMPORT_RUN_STATUSES } from "../lib/ingestions/types";
import {
  classifyImportError,
  confirmKeyAfterFailure,
  countLabel,
  itemAmount,
  itemSituation,
  previewSummary,
  resultSummary,
  stepForStatus,
} from "./ofx-import-logic";

vi.mock("expo-crypto", () => ({ randomUUID: () => randomUUID() }));

function problem(status: number, code: string) {
  return new ProblemDetailsError({ type: "about:blank", title: "t", status, code, detail: "detalhe técnico" });
}

describe("stepForStatus", () => {
  it("leva cada estado do contrato a um passo da tela", () => {
    const steps = Object.fromEntries(IMPORT_RUN_STATUSES.map((status) => [status, stepForStatus(status)]));
    expect(steps).toEqual({
      preview_ready: "preview",
      queued: "processing",
      processing: "processing",
      expired: "expired",
      completed: "result",
      completed_with_errors: "result",
      failed: "result",
    });
  });
});

describe("previewSummary", () => {
  it("conta novas, já registradas e linhas sem FITID, com o período", () => {
    const run = importRunSchema.parse(
      previewRun({
        items: [
          previewItem({ occurredOn: "2026-09-20" }),
          previewItem({ ordinal: 2, occurredOn: "2026-08-02", isDuplicate: true }),
          previewItem({ ordinal: 3, occurredOn: "2026-09-30", warnings: ["external_id_missing"] }),
        ],
      }),
    );
    expect(previewSummary(run.items)).toEqual({
      total: 3,
      fresh: 2,
      duplicates: 1,
      withoutBankId: 1,
      period: { from: "2026-08-02", to: "2026-09-30" },
    });
  });

  it("arquivo sem linhas não tem período nem novas", () => {
    expect(previewSummary([])).toEqual({ total: 0, fresh: 0, duplicates: 0, withoutBankId: 0, period: null });
  });
});

describe("itemSituation e itemAmount", () => {
  it("rotula a situação em texto, para não depender da cor", () => {
    expect(itemSituation({ status: "previewed", isDuplicate: false }).label).toBe("Nova");
    expect(itemSituation({ status: "previewed", isDuplicate: true }).label).toBe("Já registrada — será ignorada");
    expect(itemSituation({ status: "imported", isDuplicate: false }).label).toBe("Importada");
    expect(itemSituation({ status: "ignored_duplicate", isDuplicate: true }).label).toBe("Já registrada — ignorada");
    expect(itemSituation({ status: "failed", isDuplicate: false }).label).toBe("Não importada");
  });

  it("valor com sinal pela direção, sem converter para número", () => {
    expect(itemAmount({ type: "income", amount: "1500.00" })).toEqual({ text: "+ R$ 1.500,00", direction: "in" });
    expect(itemAmount({ type: "expense", amount: "42.50" })).toEqual({ text: "− R$ 42,50", direction: "out" });
  });
});

describe("resultSummary", () => {
  it("resultado parcial avisa as ignoradas e as com erro", () => {
    expect(resultSummary(importRunSchema.parse(resultRun()))).toEqual({
      tone: "warning",
      text: "1 movimentação importada, 1 ignorada por já estar registrada, 1 com erro.",
    });
  });

  it("resultado completo é sucesso; falha diz que não foi concluída", () => {
    const counts = { importedItems: 2, ignoredItems: 0, failedItems: 0 };
    expect(resultSummary({ status: "completed", ...counts })).toEqual({
      tone: "success",
      text: "2 movimentações importadas.",
    });
    expect(resultSummary({ status: "failed", ...counts, importedItems: 0 }).tone).toBe("error");
  });

  it("countLabel concorda o plural", () => {
    expect(countLabel(1, "linha", "linhas")).toBe("1 linha");
    expect(countLabel(0, "linha", "linhas")).toBe("0 linhas");
  });
});

describe("classifyImportError", () => {
  it("sessão expirada pede novo login", () => {
    expect(classifyImportError(problem(401, "AUTHENTICATION_REQUIRED"), "x")).toEqual({ kind: "unauthorized" });
    expect(classifyImportError(new ApiRequestError({ status: 401, code: "http_401", message: "x" }), "x")).toEqual({
      kind: "unauthorized",
    });
  });

  it("troca a chave só quando o backend a recusa", () => {
    expect(classifyImportError(problem(409, "IDEMPOTENCY_KEY_REUSED"), "x")).toMatchObject({
      rotateKey: true,
      restart: false,
    });
    expect(classifyImportError(new TypeError("Network request failed"), "Falhou.")).toEqual({
      kind: "message",
      message: "Falhou. Tente de novo.",
      rotateKey: false,
      restart: false,
    });
  });

  it.each([404, 409])("prévia expirada ou já confirmada (%i) pede outro arquivo", (status) => {
    expect(classifyImportError(problem(status, "INVALID_REQUEST"), "x")).toMatchObject({
      restart: true,
      rotateKey: false,
    });
  });

  it("traduz pelo status e nunca expõe o detail", () => {
    const failure = classifyImportError(problem(415, "INVALID_REQUEST"), "x");
    expect(failure).toMatchObject({ message: expect.stringMatching(/PDF não é aceito/) });
    expect(JSON.stringify(failure)).not.toContain("detalhe técnico");
    expect(classifyImportError(problem(409, "ACCOUNT_ARCHIVED"), "x")).toMatchObject({ restart: false });
  });
});

describe("confirmKeyAfterFailure", () => {
  const KEY = "5b0c6f3e-2d4a-4e8b-9c1f-7a6b5c4d3e2f";

  it("reenvio após falha de rede ou prévia expirada mantém a chave: o backend não duplica", () => {
    expect(confirmKeyAfterFailure(KEY, classifyImportError(new TypeError("Network request failed"), "x"))).toBe(KEY);
    expect(confirmKeyAfterFailure(KEY, classifyImportError(problem(409, "INVALID_REQUEST"), "x"))).toBe(KEY);
    expect(confirmKeyAfterFailure(KEY, { kind: "unauthorized" })).toBe(KEY);
  });

  it.each(["IDEMPOTENCY_KEY_REUSED", "IDEMPOTENCY_KEY_EXPIRED"])("troca a chave quando o backend a recusa (%s)", (code) => {
    const next = confirmKeyAfterFailure(KEY, classifyImportError(problem(409, code), "x"));
    expect(next).not.toBe(KEY);
    expect(next).toMatch(/^[0-9a-f-]{36}$/);
  });
});
