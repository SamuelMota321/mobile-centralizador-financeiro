import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProblemDetailsError } from "../api/errors";
import { setTokenProvider } from "../api/http-client";
import { completePluggyConnection, disconnectConnection, getConnection, mapPluggyAccount, startPluggySession } from "./api";
import {
  accountMappingResultView,
  LOCAL_ACCOUNT_ID,
  PROVIDER_ACCOUNT_ID,
  COMPLETION_KEY,
  CONNECT_TOKEN,
  CONNECTION_ID,
  ITEM_ID,
  completionAcceptedView,
  connectionView,
  initialImportView,
  sessionView,
} from "./fixtures";

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
  it("envia itemId e Idempotency-Key e interpreta o envelope 202", async () => {
    const fetchMock = stubFetch(202, completionAcceptedView());
    const result = await completePluggyConnection(ITEM_ID, COMPLETION_KEY);

    const call = lastCall(fetchMock);
    expect(call.url).toBe(`${BASE}/connections/pluggy/completions`);
    expect(call.init.method).toBe("POST");
    expect(call.headers.get("content-type")).toBe("application/json");
    expect(call.headers.get("idempotency-key")).toBe(COMPLETION_KEY);
    expect(JSON.parse(String(call.init.body))).toEqual({ itemId: ITEM_ID });
    expect(result).toEqual(completionAcceptedView());
  });

  it("reenvia o mesmo item e a mesma chave após perder a primeira resposta", async () => {
    const fetchMock = stubFetch(202, completionAcceptedView());
    fetchMock.mockRejectedValueOnce(new TypeError("network request failed"));
    await expect(completePluggyConnection(ITEM_ID, COMPLETION_KEY)).rejects.toThrow();
    const first = lastCall(fetchMock);

    await expect(completePluggyConnection(ITEM_ID, COMPLETION_KEY)).resolves.toEqual(completionAcceptedView());
    const retry = lastCall(fetchMock);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(retry.init.body).toBe(first.init.body);
    expect(retry.headers.get("idempotency-key")).toBe(first.headers.get("idempotency-key"));
  });

  it("recusa a resposta legada com apenas a conexão", async () => {
    stubFetch(200, connectionView());
    await expect(completePluggyConnection(ITEM_ID, COMPLETION_KEY)).rejects.toThrow();
  });

  it("recusa itemId ou chave que não sejam UUID antes de chamar o backend", async () => {
    const fetchMock = stubFetch(202, completionAcceptedView());
    await expect(completePluggyConnection("item", COMPLETION_KEY)).rejects.toThrow();
    await expect(completePluggyConnection(ITEM_ID, "chave")).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("preserva CONNECTION_NOT_FOUND para a tela", async () => {
    stubFetch(404, problemBody(404, "CONNECTION_NOT_FOUND"));
    const error = await completePluggyConnection(ITEM_ID, COMPLETION_KEY).catch((e: unknown) => e);
    expect(error).toMatchObject({ code: "CONNECTION_NOT_FOUND" });
  });
});

describe("getConnection e disconnectConnection", () => {
  it("consulta pelo id, sem corpo, e preserva a importação inicial", async () => {
    const initialImport = initialImportView("processing");
    const fetchMock = stubFetch(200, connectionView({ initialImport }));
    await expect(getConnection(CONNECTION_ID)).resolves.toMatchObject({ initialImport });

    const call = lastCall(fetchMock);
    expect(call.url).toBe(`${BASE}/connections/${CONNECTION_ID}`);
    expect(call.init.method).toBe("GET");
    expect(call.init.body).toBeUndefined();
  });

  it("consulta uma conexão que ainda não tem importação inicial", async () => {
    stubFetch(200, connectionView({ initialImport: null }));
    await expect(getConnection(CONNECTION_ID)).resolves.toMatchObject({ initialImport: null });
  });

  it("recusa detalhe sem o campo initialImport", async () => {
    stubFetch(200, connectionView());
    await expect(getConnection(CONNECTION_ID)).rejects.toThrow();
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

  it("recusa id que não é UUID", async () => {
    const fetchMock = stubFetch(200, connectionView());
    await expect(getConnection("../x")).rejects.toThrow();
    await expect(disconnectConnection("../x")).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("mapPluggyAccount", () => {
  it("vincula a conta do banco a uma conta existente com PUT", async () => {
    const fetchMock = stubFetch(200, accountMappingResultView());
    const result = await mapPluggyAccount(CONNECTION_ID, PROVIDER_ACCOUNT_ID, { action: "link", accountId: LOCAL_ACCOUNT_ID });

    const call = lastCall(fetchMock);
    expect(call.url).toBe(`${BASE}/connections/${CONNECTION_ID}/accounts/${PROVIDER_ACCOUNT_ID}/mapping`);
    expect(call.init.method).toBe("PUT");
    expect(JSON.parse(String(call.init.body))).toEqual({ action: "link", accountId: LOCAL_ACCOUNT_ID });
    expect(result.initialImport.status).toBe("processing");
  });

  it("pede a criação só com a ação", async () => {
    const fetchMock = stubFetch(200, accountMappingResultView());
    await mapPluggyAccount(CONNECTION_ID, PROVIDER_ACCOUNT_ID, { action: "create" });
    expect(JSON.parse(String(lastCall(fetchMock).init.body))).toEqual({ action: "create" });
  });

  it("recusa ids e escolhas inválidos antes de chamar o backend", async () => {
    const fetchMock = stubFetch(200, accountMappingResultView());
    await expect(mapPluggyAccount("../x", PROVIDER_ACCOUNT_ID, { action: "create" })).rejects.toThrow();
    await expect(mapPluggyAccount(CONNECTION_ID, PROVIDER_ACCOUNT_ID, { action: "link", accountId: "x" })).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("converte o conflito em ProblemDetailsError", async () => {
    stubFetch(409, problemBody(409, "CONNECTION_CONFLICT"));
    const error = await mapPluggyAccount(CONNECTION_ID, PROVIDER_ACCOUNT_ID, { action: "create" }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ProblemDetailsError);
  });
});
