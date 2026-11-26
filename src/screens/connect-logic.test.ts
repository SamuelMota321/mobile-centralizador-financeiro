import { describe, expect, it } from "vitest";
import { ProblemDetailsError } from "../lib/api/errors";
import { CONNECTION_STATUSES } from "../lib/connections/types";
import { awaitingMappingImportView, connectionView, initialImportView, ITEM_ID } from "../lib/connections/fixtures";
import { connectionSchema, initialImportSchema } from "../lib/connections/schema";
import {
  canCreateFromProvider,
  mappingStatusText,
  needsAccountMapping,
  providerAccountTypeLabel,
  canCheckAgain,
  canDisconnect,
  canRefreshInitialImport,
  classifyConnectionError,
  consentSummary,
  formatTimestamp,
  initialImportStatus,
  needsReconnect,
  productLabel,
  itemIdFromSuccess,
  statusView,
} from "./connect-logic";

describe("statusView", () => {
  it("tem rótulo e explicação em texto para todo estado do contrato", () => {
    for (const status of CONNECTION_STATUSES) {
      const view = statusView(status);
      expect(view.label).not.toBe("");
      expect(view.explanation).not.toBe("");
    }
  });

  it("deixa explícita a disponibilidade parcial", () => {
    expect(statusView("partially_available")).toMatchObject({ label: "Parcialmente disponível", tone: "warning" });
    expect(statusView("partially_available").explanation).toMatch(/só parte dos dados/);
  });

  it("diz que a coleta parou nos estados finais", () => {
    expect(statusView("disconnected").explanation).toMatch(/coleta de novos dados parou/);
    expect(statusView("expired").explanation).toMatch(/nenhum dado novo/);
    expect(statusView("revoked").explanation).toMatch(/nenhum dado novo/);
  });
});

describe("ações disponíveis por estado", () => {
  it("só oferece verificar de novo enquanto a autorização está pendente", () => {
    expect(CONNECTION_STATUSES.filter(canCheckAgain)).toEqual(["pending_authorization"]);
  });

  it("não oferece remover uma conexão já desconectada", () => {
    expect(canDisconnect("disconnected")).toBe(false);
    expect(canDisconnect("connected")).toBe(true);
    expect(canDisconnect("expired")).toBe(true);
  });

  it("oferece conectar de novo quando a coleta parou", () => {
    expect(CONNECTION_STATUSES.filter(needsReconnect)).toEqual(["expired", "revoked", "disconnected"]);
  });
});

describe("estados da importação inicial", () => {
  it.each(["queued", "processing", "awaiting_account_mapping"] as const)(
    "permite verificar de novo quando está em %s",
    (status) => {
      expect(canRefreshInitialImport(status)).toBe(true);
      expect(initialImportStatus(status).message).toBeTruthy();
    },
  );

  it.each(["completed", "completed_with_errors", "failed", undefined] as const)(
    "encerra a atualização da importação em %s",
    (status) => expect(canRefreshInitialImport(status)).toBe(false),
  );

  it("explica a espera pelo mapeamento e os resultados ao usuário", () => {
    expect(initialImportStatus("awaiting_account_mapping")).toMatchObject({
      tone: "warning",
      message: expect.stringContaining("mapeamento"),
    });
    expect(initialImportStatus("completed").tone).toBe("success");
    expect(initialImportStatus("completed_with_errors").tone).toBe("warning");
    expect(initialImportStatus("failed").tone).toBe("error");
  });
});

describe("consentSummary", () => {
  it("traduz os produtos conhecidos e mantém o código dos desconhecidos", () => {
    expect(productLabel("TRANSACTIONS")).toBe("Movimentações");
    expect(productLabel("NOVO_PRODUTO")).toBe("NOVO_PRODUTO");
  });

  it("resume o consentimento com datas no horário de Brasília", () => {
    const summary = consentSummary(connectionSchema.parse(connectionView()));
    expect(summary.products).toEqual(["Contas e saldos", "Movimentações"]);
    expect(summary.grantedAt).toBe(formatTimestamp("2026-10-09T12:00:00.000Z"));
    expect(formatTimestamp("2026-10-09T12:00:00.000Z")).toBe("09/10/2026, 09:00");
    expect(formatTimestamp("2026-01-01T02:30:00.000Z")).toBe("31/12/2025, 23:30");
  });

  it("aceita consentimento ainda vazio", () => {
    const pending = connectionSchema.parse(
      connectionView({
        status: "pending_authorization",
        consent: {
          id: null,
          status: null,
          products: [],
          openFinancePermissionsGranted: [],
          grantedAt: null,
          expiresAt: null,
          revokedAt: null,
        },
      }),
    );
    expect(consentSummary(pending)).toEqual({ products: [], permissionCount: 0, grantedAt: null, expiresAt: null });
  });
});

describe("itemIdFromSuccess", () => {
  it("lê só o id do item do payload do widget", () => {
    expect(itemIdFromSuccess({ item: { id: ITEM_ID, status: "UPDATED" } })).toBe(ITEM_ID);
  });

  it("devolve null para payload inesperado", () => {
    expect(itemIdFromSuccess(undefined)).toBeNull();
    expect(itemIdFromSuccess({ item: { id: "não-uuid" } })).toBeNull();
    expect(itemIdFromSuccess({})).toBeNull();
  });
});

describe("classifyConnectionError", () => {
  const problem = (status: number, code: string) =>
    new ProblemDetailsError({ type: "about:blank", title: "t", status, code, detail: "detalhe técnico" });

  it("separa a sessão expirada para o app descartar a sessão local", () => {
    expect(classifyConnectionError(problem(401, "AUTHENTICATION_REQUIRED"), "Falhou.")).toEqual({ kind: "unauthorized" });
  });

  it("traduz o erro sem expor o detail", () => {
    const failure = classifyConnectionError(problem(503, "INTEGRATION_UNAVAILABLE"), "Falhou.");
    expect(failure).toMatchObject({ kind: "message" });
    expect(JSON.stringify(failure)).toMatch(/indisponível/);
    expect(classifyConnectionError(new Error("detalhe técnico"), "Falhou.")).toEqual({
      kind: "message",
      message: "Falhou. Tente de novo.",
    });
  });
});

describe("mapeamento de contas", () => {
  const awaiting = initialImportSchema.parse(awaitingMappingImportView());
  const [pending, mapped, unsupported] = awaiting.accountMapping.accounts;

  it("só pede a escolha enquanto a importação aguarda o mapeamento", () => {
    expect(needsAccountMapping(awaiting)).toBe(true);
    expect(needsAccountMapping(initialImportSchema.parse(initialImportView("processing")))).toBe(false);
    expect(needsAccountMapping(null)).toBe(false);
  });

  it("permite criar só contas com tipo reconhecido em reais", () => {
    expect(canCreateFromProvider(pending)).toBe(true);
    expect(canCreateFromProvider(unsupported)).toBe(false);
    expect(canCreateFromProvider({ ...pending, currencyCode: "USD" })).toBe(false);
  });

  it("descreve tipo e estado em texto", () => {
    expect(providerAccountTypeLabel("checking")).toBe("Conta corrente");
    expect(providerAccountTypeLabel(null)).toBe("Tipo não suportado");
    expect(mappingStatusText(pending)).toMatch(/escolha/);
    expect(mappingStatusText(mapped)).toBe("Vinculada");
    expect(mappingStatusText(unsupported)).toMatch(/não será importada/);
  });
});
