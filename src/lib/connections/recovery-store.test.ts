import { beforeEach, describe, expect, it, vi } from "vitest";
import * as SecureStore from "expo-secure-store";
import { ProblemDetailsError } from "../api/errors";
import { getConnection } from "./api";
import { CONNECTION_ID, connectionView } from "./fixtures";
import {
  clearConnectionPointer,
  loadConnectionPointer,
  restoreConnectionPointer,
  saveConnectionPointer,
  subjectFromToken,
} from "./recovery-store";

const values = new Map<string, string>();

vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn(async (key: string) => values.get(key) ?? null),
  setItemAsync: vi.fn(async (key: string, value: string) => { values.set(key, value); }),
  deleteItemAsync: vi.fn(async (key: string) => { values.delete(key); }),
}));
vi.mock("./api", () => ({ getConnection: vi.fn() }));

const token = (sub: string) =>
  `header.${btoa(JSON.stringify({ sub })).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_")}.signature`;

beforeEach(() => {
  values.clear();
  vi.mocked(getConnection).mockReset();
});

describe("ponteiro mobile de conexão", () => {
  it("associa o registro separado ao usuário autenticado", async () => {
    expect(subjectFromToken(token("usuario-a"))).toBe("usuario-a");
    expect(subjectFromToken("token-opaco")).toBeNull();
    await saveConnectionPointer("usuario-a", CONNECTION_ID);
    expect(await loadConnectionPointer("usuario-a")).toBe(CONNECTION_ID);
    expect([...values.keys()]).toEqual(["coinciente.connection"]);
  });

  it("recupera a conexão pelo GET depois de reiniciar a tela", async () => {
    await saveConnectionPointer("usuario-a", CONNECTION_ID);
    vi.mocked(getConnection).mockResolvedValue(connectionView() as Awaited<ReturnType<typeof getConnection>>);
    expect(await restoreConnectionPointer("usuario-a")).toMatchObject({ kind: "found", connection: { id: CONNECTION_ID } });
    expect(getConnection).toHaveBeenCalledWith(CONNECTION_ID);
  });

  it("invalida o registro de outro usuário sem chamar a API", async () => {
    await saveConnectionPointer("usuario-a", CONNECTION_ID);
    expect(await restoreConnectionPointer("usuario-b")).toEqual({ kind: "none" });
    expect(values.size).toBe(0);
    expect(getConnection).not.toHaveBeenCalled();
  });

  it("apaga UUID inválido antes de consultar", async () => {
    values.set("coinciente.connection", JSON.stringify({ owner: "usuario-a", connectionId: "../x" }));
    expect(await restoreConnectionPointer("usuario-a")).toEqual({ kind: "none" });
    expect(getConnection).not.toHaveBeenCalled();
  });

  it("apaga conexão negada pelo backend", async () => {
    await saveConnectionPointer("usuario-a", CONNECTION_ID);
    vi.mocked(getConnection).mockRejectedValue(new ProblemDetailsError({
      type: "about:blank", title: "não encontrada", status: 404, code: "CONNECTION_NOT_FOUND", detail: "",
    }));
    expect(await restoreConnectionPointer("usuario-a")).toEqual({ kind: "denied" });
    expect(values.size).toBe(0);
  });

  it("conserva o ponteiro se a rede falhar e permite outra tentativa", async () => {
    await saveConnectionPointer("usuario-a", CONNECTION_ID);
    vi.mocked(getConnection).mockRejectedValue(new TypeError("rede indisponível"));
    expect(await restoreConnectionPointer("usuario-a")).toMatchObject({ kind: "error" });
    expect(await loadConnectionPointer("usuario-a")).toBe(CONNECTION_ID);
  });

  it("remove o registro no logout", async () => {
    await saveConnectionPointer("usuario-a", CONNECTION_ID);
    await clearConnectionPointer();
    expect(await loadConnectionPointer("usuario-a")).toBeNull();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("coinciente.connection");
  });
});
