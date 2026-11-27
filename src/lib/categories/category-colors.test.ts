import { describe, expect, it } from "vitest";
import { categoryColors, idsByCreation } from "./category-colors";

describe("categoryColors", () => {
  const palette = Array.from({ length: 12 }, (_, i) => `#c${i}`);
  const ids = Array.from({ length: 13 }, (_, i) => `id${i}`);

  it("cor pela ordem, neutra da 13ª em diante", () => {
    const colors = categoryColors(ids, palette, "#other");
    expect(colors.get("id0")).toBe("#c0");
    expect(colors.get("id11")).toBe("#c11");
    expect(colors.get("id12")).toBe("#other");
  });

  it("ordem de criação, arquivadas incluídas", () => {
    expect(idsByCreation([{ id: "b", createdAt: "2026-02-01" }, { id: "a", createdAt: "2026-01-01" }])).toEqual(["a", "b"]);
  });
});
