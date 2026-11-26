import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCategoryRule, listCategoryRules } from "../category-rules/api";
import { createCategory, listCategories } from "./api";
import { applyRulePack, createSuggestedCategories } from "./apply-suggestions";
import { SUGGESTED_CATEGORIES } from "./suggestions";

vi.mock("./api", () => ({ listCategories: vi.fn(), createCategory: vi.fn() }));
vi.mock("../category-rules/api", () => ({ listCategoryRules: vi.fn(), createCategoryRule: vi.fn() }));

const CATEGORY_ID = "7c6b5a49-3827-4165-9a8b-7c6d5e4f3a2b";
const base = { source: "user" as const, archivedAt: null, createdAt: "2026-09-20T12:00:00.000Z", updatedAt: "2026-09-20T12:00:00.000Z" };
const page = <T,>(items: T[]) => ({ items, page: 1, pageSize: 100, total: items.length });

beforeEach(() => {
  vi.mocked(createCategory).mockReset().mockResolvedValue({ ...base, id: CATEGORY_ID, name: "x", status: "active" });
  vi.mocked(createCategoryRule).mockReset();
  vi.mocked(listCategories).mockReset();
  vi.mocked(listCategoryRules).mockReset().mockResolvedValue(page([]));
});

describe("createSuggestedCategories", () => {
  it("cria só as que faltam", async () => {
    vi.mocked(listCategories).mockResolvedValue(page([{ ...base, id: CATEGORY_ID, name: "Lazer", status: "active" as const }]));
    expect(await createSuggestedCategories()).toEqual({ ok: true, created: SUGGESTED_CATEGORIES.length - 1, skipped: 1 });
    expect(createCategory).not.toHaveBeenCalledWith({ name: "Lazer" });
  });

  it("para na primeira falha e informa quantas entraram", async () => {
    vi.mocked(listCategories).mockResolvedValue(page([]));
    vi.mocked(createCategory).mockResolvedValueOnce({ ...base, id: CATEGORY_ID, name: "x", status: "active" }).mockRejectedValueOnce(new Error("falha"));
    expect(await createSuggestedCategories()).toMatchObject({ ok: false, created: 1 });
  });
});

describe("applyRulePack", () => {
  it("cria regras para categorias ativas e aponta as ausentes", async () => {
    vi.mocked(listCategories).mockResolvedValue(page([{ ...base, id: CATEGORY_ID, name: "Transporte", status: "active" as const }]));
    const result = await applyRulePack();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.missingCategories).toContain("Saúde");
    expect(createCategoryRule).toHaveBeenCalledWith({
      categoryId: CATEGORY_ID,
      conditionField: "description",
      conditionOperator: "contains",
      conditionValue: "uber",
      priority: 10,
    });
    expect(result.created).toBe(vi.mocked(createCategoryRule).mock.calls.length);
  });
});
