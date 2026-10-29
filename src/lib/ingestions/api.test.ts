import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProblemDetailsError } from "../api/errors";
import { setTokenProvider } from "../api/http-client";
import { confirmImport, createOfxPreview, getImportRun } from "./api";
import { DESTINATION_ACCOUNT_ID, IMPORT_RUN_ID, previewRun, resultRun } from "./fixtures";

const KEY = "5d0f6a52-8c1e-4e2b-9f3a-0b1c2d3e4f5a";
const BASE = "http://api.test.local/api/v1";
const asset = { uri: "file:///cache/extrato.ofx", name: "extrato.ofx", mimeType: "application/x-ofx" };

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

describe("createOfxPreview", () => {
  const input = { file: asset, destinationAccountId: DESTINATION_ACCOUNT_ID };

  it("envia arquivo no formato do React Native e conta no multipart, com Idempotency-Key", async () => {
    const append = vi.spyOn(FormData.prototype, "append");
    const fetchMock = stubFetch(201, previewRun());
    const run = await createOfxPreview(input, { idempotencyKey: KEY });

    expect(append).toHaveBeenCalledWith("file", {
      uri: "file:///cache/extrato.ofx",
      name: "extrato.ofx",
      type: "application/x-ofx",
    });
    expect(append).toHaveBeenCalledWith("destinationAccountId", DESTINATION_ACCOUNT_ID);
    const call = lastCall(fetchMock);
    expect(call.url).toBe(`${BASE}/ingestions/ofx/previews`);
    expect(call.init.method).toBe("POST");
    expect(call.init.body).toBeInstanceOf(FormData);
    expect(call.headers.get("authorization")).toBe("Bearer token-ficticio");
    expect(call.headers.get("idempotency-key")).toBe(KEY);
    expect(call.headers.has("content-type")).toBe(false);
    expect(run.items.some((item) => item.isDuplicate)).toBe(true);
  });

  it("omite o tipo quando o seletor não informa", async () => {
    const append = vi.spyOn(FormData.prototype, "append");
    stubFetch(201, previewRun());
    await createOfxPreview(
      { file: { uri: asset.uri, name: asset.name }, destinationAccountId: DESTINATION_ACCOUNT_ID },
      { idempotencyKey: KEY },
    );
    expect(append).toHaveBeenCalledWith("file", { uri: asset.uri, name: asset.name });
  });

  it("recusa conta ou chave inválidas antes de chamar o backend", async () => {
    const fetchMock = stubFetch(201, previewRun());
    await expect(
      createOfxPreview({ file: asset, destinationAccountId: "conta" }, { idempotencyKey: KEY }),
    ).rejects.toThrow();
    await expect(createOfxPreview(input, { idempotencyKey: "x" })).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("converte o erro em ProblemDetailsError", async () => {
    stubFetch(422, problemBody(422, "INVALID_REQUEST"));
    const error = await createOfxPreview(input, { idempotencyKey: KEY }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ProblemDetailsError);
    expect(error).toMatchObject({ status: 422, code: "INVALID_REQUEST" });
  });
});

describe("confirmImport", () => {
  it("envia a conta de destino em JSON com Idempotency-Key", async () => {
    const fetchMock = stubFetch(200, resultRun());
    const run = await confirmImport(
      IMPORT_RUN_ID,
      { destinationAccountId: DESTINATION_ACCOUNT_ID },
      { idempotencyKey: KEY },
    );

    const call = lastCall(fetchMock);
    expect(call.url).toBe(`${BASE}/ingestions/${IMPORT_RUN_ID}/confirmations`);
    expect(call.init.method).toBe("POST");
    expect(call.headers.get("idempotency-key")).toBe(KEY);
    expect(call.headers.get("content-type")).toBe("application/json");
    expect(JSON.parse(String(call.init.body))).toEqual({ destinationAccountId: DESTINATION_ACCOUNT_ID });
    expect(run.importedItems).toBe(1);
  });

  it("recusa id da importação que não é UUID", async () => {
    const fetchMock = stubFetch(200, resultRun());
    await expect(
      confirmImport("../x", { destinationAccountId: DESTINATION_ACCOUNT_ID }, { idempotencyKey: KEY }),
    ).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("preserva o código de idempotência para a tela decidir se troca a chave", async () => {
    stubFetch(409, problemBody(409, "IDEMPOTENCY_KEY_EXPIRED"));
    const error = await confirmImport(
      IMPORT_RUN_ID,
      { destinationAccountId: DESTINATION_ACCOUNT_ID },
      { idempotencyKey: KEY },
    ).catch((e: unknown) => e);
    expect(error).toMatchObject({ code: "IDEMPOTENCY_KEY_EXPIRED" });
  });
});

describe("getImportRun", () => {
  it("consulta o estado pelo id, sem corpo nem chave", async () => {
    const fetchMock = stubFetch(200, resultRun());
    await getImportRun(IMPORT_RUN_ID);

    const call = lastCall(fetchMock);
    expect(call.url).toBe(`${BASE}/ingestions/${IMPORT_RUN_ID}`);
    expect(call.init.method).toBe("GET");
    expect(call.init.body).toBeUndefined();
    expect(call.headers.has("idempotency-key")).toBe(false);
  });
});
