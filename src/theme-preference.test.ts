import { beforeEach, describe, expect, it, vi } from "vitest";
import * as SecureStore from "expo-secure-store";
import { Appearance } from "react-native";
import { DEFAULT_THEME, restoreTheme, selectTheme } from "./theme-preference";

const store = new Map<string, string>();

vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn(async (key: string) => store.get(key) ?? null),
  setItemAsync: vi.fn(async (key: string, value: string) => { store.set(key, value); }),
}));
vi.mock("react-native", () => ({ Appearance: { setColorScheme: vi.fn() } }));

beforeEach(() => {
  store.clear();
  vi.clearAllMocks();
});

describe("preferência de tema", () => {
  it("usa escuro sem escolha salva, independentemente do sistema", async () => {
    await restoreTheme();
    expect(Appearance.setColorScheme).toHaveBeenCalledWith(DEFAULT_THEME);
  });

  it.each(["light", "dark"] as const)("recupera %s após reabrir", async (choice) => {
    await selectTheme(choice);
    vi.clearAllMocks();
    await restoreTheme();
    expect(Appearance.setColorScheme).toHaveBeenCalledWith(choice);
  });

  it("ignora valor inválido", async () => {
    store.set("coinciente.theme", "system");
    await restoreTheme();
    expect(Appearance.setColorScheme).toHaveBeenCalledWith(DEFAULT_THEME);
  });

  it("usa escuro quando a leitura local falha", async () => {
    vi.mocked(SecureStore.getItemAsync).mockRejectedValueOnce(new Error("storage"));
    await restoreTheme();
    expect(Appearance.setColorScheme).toHaveBeenCalledWith(DEFAULT_THEME);
  });

  it("permite trocar nos dois sentidos e salva a última escolha", async () => {
    await selectTheme("light");
    await selectTheme("dark");
    expect(store.get("coinciente.theme")).toBe("dark");
    expect(Appearance.setColorScheme).toHaveBeenLastCalledWith("dark");
  });

  it("mantém o tema de sessão e sinaliza falha ao salvar", async () => {
    vi.mocked(SecureStore.setItemAsync).mockRejectedValueOnce(new Error("storage"));
    await expect(selectTheme("light")).rejects.toThrow("storage");
    expect(Appearance.setColorScheme).toHaveBeenCalledWith("light");
  });
});
