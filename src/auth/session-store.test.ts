import { beforeEach, describe, expect, it, vi } from "vitest";
import * as SecureStore from "expo-secure-store";
import { clearSession, isExpired, loadSession, saveSession } from "./session-store";

const store = new Map<string, string>();

vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn(async (key: string) => store.get(key) ?? null),
  setItemAsync: vi.fn(async (key: string, value: string) => {
    store.set(key, value);
  }),
  deleteItemAsync: vi.fn(async (key: string) => {
    store.delete(key);
  }),
}));

const SESSION_KEY = "coinciente.session";

beforeEach(() => {
  store.clear();
});

describe("session-store", () => {
  it("salva e recupera a sessao", async () => {
    const session = { accessToken: "token-ficticio", expiresAt: 1_900_000_000_000 };
    await saveSession(session);
    expect(await loadSession()).toEqual(session);
  });

  it("retorna null quando nao ha sessao", async () => {
    expect(await loadSession()).toBeNull();
  });

  it("apaga conteudo corrompido e trata como ausencia de sessao", async () => {
    store.set(SESSION_KEY, "{nao-e-json");
    expect(await loadSession()).toBeNull();
    expect(store.has(SESSION_KEY)).toBe(false);
  });

  it("apaga sessao com formato inesperado", async () => {
    store.set(SESSION_KEY, JSON.stringify({ accessToken: 123, expiresAt: "amanha" }));
    expect(await loadSession()).toBeNull();
    expect(store.has(SESSION_KEY)).toBe(false);
  });

  it("clearSession remove o token do armazenamento seguro", async () => {
    await saveSession({ accessToken: "token-ficticio", expiresAt: 1 });
    await clearSession();
    expect(store.size).toBe(0);
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(SESSION_KEY);
  });
});

describe("isExpired", () => {
  it("considera expirada a sessao no instante exato de expiracao", () => {
    vi.spyOn(Date, "now").mockReturnValue(1_000);
    expect(isExpired({ accessToken: "t", expiresAt: 1_000 })).toBe(true);
    expect(isExpired({ accessToken: "t", expiresAt: 999 })).toBe(true);
    expect(isExpired({ accessToken: "t", expiresAt: 1_001 })).toBe(false);
  });
});
