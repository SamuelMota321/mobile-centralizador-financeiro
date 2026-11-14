import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProblemDetailsError } from "../api/errors";
import { setTokenProvider } from "../api/http-client";
import { completePluggyConnection, disconnectConnection, getConnection, startPluggySession } from "./api";
import { COMPLETION_KEY, CONNECT_TOKEN, CONNECTION_ID, completionAcceptedView, connectionView, initialImportView, ITEM_ID, sessionView } from "./fixtures";

const BASE = "http://api.test.local/api/v1";

function stubFetch(status: number, body?: unknown) {
  const fetchMock = vi.fn(async () =>
    new Response(body === undefined ? "" : JSON.stringify(body), { status }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function lastCall(fetchMock: ReturnType<typeof stubFetch>) {
  const [url, init] = fetchMock.mock.calls.at(-1) as unknown as [string, RequestInit];
  return { url, init, headers: new Headers(init.headers) };
}

const problemBody = (status: number, code: string) => ({
  type: "about:blank",
  title: "t",
  status,
  code,
  detail: "d",
});

beforeEach(() => {
  setTokenProvider(() => "token-ficticio");
});

describe("startPluggySession", () => {
  it("pede a sessão sem corpo e devolve o token limitado e a conexão pendente", async () => {
    const fetchMock = stubFetch(201, sessionView());
    const session = await startPluggySession();

    const call = lastCall(fetchMock);
    expect(call.url).toBe(`${BASE}/connections/pluggy/sessions`);
    expect(call.init.method).toBe("POST");
    expect(call.init.body).toBeUndefined();
    expect(call.headers.get("authorization")).toBe("Bearer token-ficticio");
    expect(call.headers.has("idempotency-key")).toBe(false);
    expect(session.connectToken).toBe(CONNECT_TOKEN);
    expect(session.connection.status).toBe("pending_authorization");
  });

  it("converte a indisponibilidade do provedor em ProblemDetailsError", async () => {
    stubFetch(503, problemBody(503, "INTEGRATION_UNAVAILABLE"));
    const error = await startPluggySession().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ProblemDetailsError);
    expect(error).toMatchObject({ status: 503, code: "INTEGRATION_UNAVAILABLE" });
  });

  it("recusa resposta sem token", async () => {
    stubFetch(201, { ...sessionView(), connectToken: "" });
    await expect(startPluggySession()).rejects.toThrow();
  });
});

describe("completePluggyConnection", () => {
  it("envia itemId e chave estável e lê a aceitação da importação", async () => {
    const fetchMock = stubFetch(202, completionAcceptedView());
    const accepted = await completePluggyConnection(ITEM_ID, COMPLETION_KEY);

    const call = lastCall(fetchMock);
    expect(call.url).toBe(`${BASE}/connections/pluggy/completions`);
    expect(call.init.method).toBe("POST");
    expect(call.headers.get("content-type")).toBe("application/json");
    expect(call.headers.get("idempotency-key")).toBe(COMPLETION_KEY);
    expect(JSON.parse(String(call.init.body))).toEqual({ itemId: ITEM_ID });
    expect(accepted.connection.status).toBe("connected");
    expect(accepted.initialImport.status).toBe("queued");
  });

  it("recusa itemId que não é UUID antes de chamar o backend", async () => {
    const fetchMock = stubFetch(202, completionAcceptedView());
    await expect(completePluggyConnection("item", COMPLETION_KEY)).rejects.toThrow();
    await expect(completePluggyConnection(ITEM_ID, "chave")).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("repete a mesma tentativa com a mesma chave e item", async () => {
    const fetchMock = stubFetch(202, completionAcceptedView());
    await completePluggyConnection(ITEM_ID, COMPLETION_KEY);
    await completePluggyConnection(ITEM_ID, COMPLETION_KEY);
    expect((fetchMock.mock.calls as unknown as [string, RequestInit][]).map(([, init]) => [new Headers(init.headers).get("idempotency-key"), JSON.parse(String(init.body)).itemId]))
      .toEqual([[COMPLETION_KEY, ITEM_ID], [COMPLETION_KEY, ITEM_ID]]);
  });

  it("recusa o corpo antigo sem initialImport", async () => {
    stubFetch(202, connectionView());
    await expect(completePluggyConnection(ITEM_ID, COMPLETION_KEY)).rejects.toThrow();
  });

  it("preserva CONNECTION_NOT_FOUND para a tela", async () => {
    stubFetch(404, problemBody(404, "CONNECTION_NOT_FOUND"));
    const error = await completePluggyConnection(ITEM_ID, COMPLETION_KEY).catch((e: unknown) => e);
    expect(error).toMatchObject({ code: "CONNECTION_NOT_FOUND" });
  });
});

describe("getConnection e disconnectConnection", () => {
  it("consulta pelo id, sem corpo", async () => {
    const fetchMock = stubFetch(200, connectionView({ initialImport: initialImportView("processing") }));
    const connection = await getConnection(CONNECTION_ID);

    const call = lastCall(fetchMock);
    expect(call.url).toBe(`${BASE}/connections/${CONNECTION_ID}`);
    expect(call.init.method).toBe("GET");
    expect(call.init.body).toBeUndefined();
    expect(connection.initialImport?.status).toBe("processing");
  });

  it("desconecta com POST sem corpo e devolve a conexão revogada", async () => {
    const fetchMock = stubFetch(200, connectionView({ status: "disconnected" }));
    const connection = await disconnectConnection(CONNECTION_ID);

    const call = lastCall(fetchMock);
    expect(call.url).toBe(`${BASE}/connections/${CONNECTION_ID}/disconnect`);
    expect(call.init.method).toBe("POST");
    expect(call.init.body).toBeUndefined();
    expect(connection.status).toBe("disconnected");
  });

  it("aceita consulta sem importação inicial", async () => {
    stubFetch(200, connectionView({ initialImport: null }));
    expect((await getConnection(CONNECTION_ID)).initialImport).toBeNull();
  });

  it("recusa id que não é UUID", async () => {
    const fetchMock = stubFetch(200, connectionView());
    await expect(getConnection("../x")).rejects.toThrow();
    await expect(disconnectConnection("../x")).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
