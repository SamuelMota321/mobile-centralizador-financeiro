import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProblemDetailsError } from "../api/errors";
import { setTokenProvider } from "../api/http-client";
import { createPatrimony, getPatrimony, getPatrimonyHistory, listPatrimony, updatePatrimony } from "./api";
import { ASSET_ID, assetView, FINANCING_ID, financingView, liabilityView, pageView } from "./fixtures";

beforeEach(() => setTokenProvider(() => "token-ficticio"));

const BASE = "http://api.test.local/api/v1";

function stubFetch(status: number, body?: unknown) {
  const fetchMock = vi.fn(async () => new Response(body === undefined ? "" : JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function lastCall(fetchMock: ReturnType<typeof stubFetch>) {
  const [url, init] = fetchMock.mock.calls.at(-1) as unknown as [string, RequestInit];
  return { url, init, headers: new Headers(init.headers), body: init.body ? JSON.parse(String(init.body)) : undefined };
}

afterEach(() => vi.unstubAllGlobals());

describe("listPatrimony", () => {
  it("lista a coleção pedida, paginada e com bearer", async () => {
    const fetchMock = stubFetch(200, pageView([assetView()]));
    const result = await listPatrimony("assets", { page: 2, pageSize: 20 });
    const call = lastCall(fetchMock);
    expect(call.url).toBe(`${BASE}/patrimony/assets?page=2&pageSize=20`);
    expect(call.headers.get("authorization")).toBe("Bearer token-ficticio");
    expect(result.items[0]).toMatchObject({ kind: "asset", estimatedValue: "350000.00" });
  });

  it("recusa item de outro tipo na coleção", async () => {
    stubFetch(200, pageView([liabilityView()]));
    await expect(listPatrimony("assets", {})).rejects.toThrow();
  });

  it("recusa coleção fora do contrato antes de chamar a API", async () => {
    const fetchMock = stubFetch(200, pageView([]));
    await expect(listPatrimony("imoveis" as "assets", {})).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("aceita financiamento sem bem associado", async () => {
    stubFetch(200, pageView([financingView({ assetId: null })]));
    expect((await listPatrimony("financings", {})).items[0].assetId).toBeNull();
  });
});

describe("createPatrimony e updatePatrimony", () => {
  it("cria com o corpo exato do contrato, sem Idempotency-Key", async () => {
    const fetchMock = stubFetch(201, liabilityView());
    await createPatrimony("liabilities", { description: "Empréstimo de exemplo", outstandingBalance: "5000.00" });
    const call = lastCall(fetchMock);
    expect(call.url).toBe(`${BASE}/patrimony/liabilities`);
    expect(call.init.method).toBe("POST");
    expect(call.body).toEqual({ description: "Empréstimo de exemplo", outstandingBalance: "5000.00" });
    expect(call.headers.has("idempotency-key")).toBe(false);
  });

  it("altera só os campos enviados", async () => {
    const fetchMock = stubFetch(200, financingView({ assetId: null, version: 2 }));
    const updated = await updatePatrimony("financings", FINANCING_ID, { assetId: null });
    const call = lastCall(fetchMock);
    expect(call.init.method).toBe("PATCH");
    expect(call.body).toEqual({ assetId: null });
    expect(updated.version).toBe(2);
  });

  it("não envia PATCH vazio", async () => {
    const fetchMock = stubFetch(200, assetView());
    await expect(updatePatrimony("assets", ASSET_ID, {})).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("converte 400 com erros de campo em ProblemDetailsError", async () => {
    stubFetch(400, {
      type: "about:blank",
      title: "t",
      status: 400,
      code: "INVALID_REQUEST",
      detail: "d",
      errors: [{ path: "estimatedValue", code: "pattern", message: "m" }],
    });
    const error = await createPatrimony(
      "assets",
      { type: "Imóvel", description: "x", estimatedValue: "1.00", valuationDate: "2026-10-01", source: "x" },
    ).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ProblemDetailsError);
  });
});

describe("getPatrimony e getPatrimonyHistory", () => {
  it("lê o item e converte 404", async () => {
    stubFetch(200, assetView());
    expect((await getPatrimony("assets", ASSET_ID)).id).toBe(ASSET_ID);
    stubFetch(404, { type: "about:blank", title: "t", status: 404, code: "X", detail: "d" });
    await expect(getPatrimony("assets", ASSET_ID)).rejects.toMatchObject({ status: 404 });
  });

  it("lê as versões com o estado de cada uma", async () => {
    const fetchMock = stubFetch(200, [
      {
        version: 1,
        actorUserId: "9f7c8b0a-b3c4-45d6-a0f1-6c7d8e9fa0b1",
        requestId: "a08d9c1b-c4d5-46e7-b102-7d8e9fa0b1c2",
        createdAt: "2026-11-20T15:00:00.000Z",
        state: { description: "Empréstimo", outstandingBalance: "5000.00" },
      },
    ]);
    const history = await getPatrimonyHistory("liabilities", ASSET_ID);
    expect(lastCall(fetchMock).url).toBe(`${BASE}/patrimony/liabilities/${ASSET_ID}/history`);
    expect(history[0].state.outstandingBalance).toBe("5000.00");
  });
});
