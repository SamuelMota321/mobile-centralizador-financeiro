import { afterEach, describe, expect, it, vi } from "vitest";
import { patrimonyPreviewEnabled, patrimonyPreviewPage } from "./preview";
import { PATRIMONY_COLLECTIONS } from "./types";

afterEach(() => vi.unstubAllEnvs());

describe("prévia de Bens e dívidas", () => {
  it("fica desligada por padrão e liga só com true", () => {
    expect(patrimonyPreviewEnabled()).toBe(false);
    vi.stubEnv("EXPO_PUBLIC_PATRIMONY_PREVIEW", "true");
    expect(patrimonyPreviewEnabled()).toBe(true);
    vi.stubEnv("EXPO_PUBLIC_PATRIMONY_PREVIEW", "1");
    expect(patrimonyPreviewEnabled()).toBe(false);
  });

  it.each(PATRIMONY_COLLECTIONS)(
    "%s passa no schema publicado",
    (collection) => {
      const page = patrimonyPreviewPage(
        collection,
        new Date("2026-11-27T12:00:00Z"),
      );
      expect(page.total).toBe(page.items.length);
      expect(page.items.length).toBeGreaterThan(0);
    },
  );

  it("financiamentos apontam para bens existentes", () => {
    const now = new Date("2026-11-27T12:00:00Z");
    const ids = new Set(
      patrimonyPreviewPage("assets", now).items.map((item) => item.id),
    );
    for (const item of patrimonyPreviewPage("financings", now).items)
      expect(ids.has(item.assetId ?? "")).toBe(true);
  });
});
