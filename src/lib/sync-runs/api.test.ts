import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProblemDetailsError } from "../api/errors";
import { setTokenProvider } from "../api/http-client";
import { requestSyncRun } from "./api";

const CONNECTION_ID = "b2a7e0c4-1f3d-4a5b-8c9d-0e1f2a3b4c5d";
const run = {
  runId: "9f7c8b0a-b3c4-45d6-a0f1-6c7d8e9fa0b1",
  connectionId: CONNECTION_ID,
  status: "queued",
  trigger: "manual",
  acceptedAt: "2026-11-27T12:00:00.000Z",
  statusUrl: "/api/v1/connections/b2a7e0c4-1f3d-4a5b-8c9d-0e1f2a3b4c5d/sync-runs/9f7c8b0a-b3c4-45d6-a0f1-6c7d8e9fa0b1",
  startedAt: null,
  completedAt: null,
  referenceDate: null,
  reasons: [],
};

function stubFetch(status: number, body?: unknown) {
  const fetchMock = vi.fn(async () => new Response(body === undefined ? "" : JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => setTokenProvider(() => "token-ficticio"));
afterEach(() => vi.unstubAllGlobals());

describe("requestSyncRun", () => {
  it("POST da conexão, com bearer e sem Idempotency-Key; devolve a execução aceita", async () => {
    const fetchMock = stubFetch(202, run);
    const result = await requestSyncRun(CONNECTION_ID);
    const [url, init] = fetchMock.mock.calls.at(-1) as unknown as [string, RequestInit];
    expect(url).toBe(`http://api.test.local/api/v1/connections/${CONNECTION_ID}/sync-runs`);
    expect(init.method).toBe("POST");
    const headers = new Headers(init.headers);
    expect(headers.get("authorization")).toBe("Bearer token-ficticio");
    expect(headers.has("idempotency-key")).toBe(false);
    expect(result.status).toBe("queued");
  });

  it("recusa id inválido antes de chamar a API", async () => {
    const fetchMock = stubFetch(202, run);
    await expect(requestSyncRun("nao-e-uuid")).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("409 (já em andamento) chega como ProblemDetailsError para a tela tratar", async () => {
    stubFetch(409, { type: "about:blank", title: "t", status: 409, code: "CONNECTION_CONFLICT", detail: "d" });
    const error = await requestSyncRun(CONNECTION_ID).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ProblemDetailsError);
    expect(error).toMatchObject({ status: 409 });
  });
});
