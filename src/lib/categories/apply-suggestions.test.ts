import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProblemDetailsError } from "../api/errors";
import { activateCategoryRule, createCategoryRule, deactivateCategoryRule, listCategoryRules } from "../category-rules/api";
import { createCategory, listCategories } from "./api";
import { addPackGroup, applyRulePack, createOneSuggestedCategory, createSuggestedCategories, setSuggestedGroupStatus } from "./apply-suggestions";
import { SUGGESTED_CATEGORIES } from "./suggestions";

vi.mock("./api", () => ({ listCategories: vi.fn(), createCategory: vi.fn() }));
vi.mock("../category-rules/api", () => ({
  listCategoryRules: vi.fn(),
  createCategoryRule: vi.fn(),
  activateCategoryRule: vi.fn(),
  deactivateCategoryRule: vi.fn(),
}));

const CATEGORY_ID = "7c6b5a49-3827-4165-9a8b-7c6d5e4f3a2b";
const base = { source: "user" as const, archivedAt: null, createdAt: "2026-09-20T12:00:00.000Z", updatedAt: "2026-09-20T12:00:00.000Z" };
const page = <T,>(items: T[]) => ({ items, page: 1, pageSize: 100, total: items.length });

beforeEach(() => {
  vi.mocked(createCategory).mockReset().mockResolvedValue({ ...base, id: CATEGORY_ID, name: "x", status: "active" });
  vi.mocked(createCategoryRule).mockReset();
  vi.mocked(activateCategoryRule).mockReset();
  vi.mocked(deactivateCategoryRule).mockReset();
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

describe("createOneSuggestedCategory", () => {
  it("cria só aquela; nome existente (até arquivada) é pulado; nome fora da lista é recusado", async () => {
    vi.mocked(listCategories).mockResolvedValue(page([{ ...base, id: CATEGORY_ID, name: "Lazer", status: "archived" as const }]));
    expect(await createOneSuggestedCategory("Lazer")).toEqual({ ok: true, created: 0, skipped: 1 });
    expect(await createOneSuggestedCategory("Saúde")).toEqual({ ok: true, created: 1, skipped: 0 });
    expect(createCategory).toHaveBeenCalledTimes(1);
    expect(createCategory).toHaveBeenCalledWith({ name: "Saúde" });
    expect(await createOneSuggestedCategory("Viagens")).toMatchObject({ ok: false });
  });

  it("409 vira pulado", async () => {
    vi.mocked(listCategories).mockResolvedValue(page([]));
    vi.mocked(createCategory).mockRejectedValue(
      new ProblemDetailsError({ type: "about:blank", title: "t", status: 409, code: "CATEGORY_ALREADY_EXISTS", detail: "x" }),
    );
    expect(await createOneSuggestedCategory("Saúde")).toEqual({ ok: true, created: 0, skipped: 1 });
  });
});

describe("addPackGroup", () => {
  it("cria a categoria que falta e só as regras daquele grupo", async () => {
    vi.mocked(listCategories).mockResolvedValue(page([]));
    vi.mocked(createCategory).mockResolvedValue({ ...base, id: CATEGORY_ID, name: "Saúde", status: "active" });
    const result = await addPackGroup("Saúde");
    expect(result).toMatchObject({ ok: true, createdCategory: true });
    const values = vi.mocked(createCategoryRule).mock.calls.map(([input]) => input.conditionValue);
    expect(values).toContain("drogaria");
    expect(values).not.toContain("uber");
  });

  it("usa a categoria ativa existente e não recria regra igual", async () => {
    vi.mocked(listCategories).mockResolvedValue(page([{ ...base, id: CATEGORY_ID, name: "Saude", status: "active" as const }]));
    vi.mocked(listCategoryRules).mockResolvedValue(
      page([{ id: "r1", categoryId: CATEGORY_ID, conditionField: "description" as const, conditionOperator: "contains" as const, conditionValue: "drogaria", priority: 10, status: "active" as const, removedAt: null, createdAt: base.createdAt, updatedAt: base.updatedAt }]),
    );
    await addPackGroup("Saúde");
    expect(createCategory).not.toHaveBeenCalled();
    expect(createCategoryRule).not.toHaveBeenCalledWith(expect.objectContaining({ conditionValue: "drogaria" }));
  });
});

describe("setSuggestedGroupStatus", () => {
  const rule = (id: string, conditionValue: string, status: "active" | "inactive" | "removed") => ({
    id,
    categoryId: CATEGORY_ID,
    conditionField: "description" as const,
    conditionOperator: "contains" as const,
    conditionValue,
    priority: 10,
    status,
    removedAt: status === "removed" ? base.updatedAt : null,
    createdAt: base.createdAt,
    updatedAt: base.updatedAt,
  });

  beforeEach(() => {
    vi.mocked(listCategories).mockResolvedValue(page([{ ...base, id: CATEGORY_ID, name: "Transporte", status: "active" as const }]));
    vi.mocked(listCategoryRules).mockResolvedValue(
      page([rule("r-uber", "uber", "active"), rule("r-99", "99app", "inactive"), rule("r-ped", "pedágio", "removed"), rule("r-minha", "uber centro", "active")]),
    );
  });

  it("desativa só as sugeridas do grupo que estão ativas", async () => {
    expect(await setSuggestedGroupStatus("Transporte", "inactive")).toEqual({ ok: true, created: 1 });
    expect(deactivateCategoryRule).toHaveBeenCalledTimes(1);
    expect(deactivateCategoryRule).toHaveBeenCalledWith("r-uber");
  });

  it("ativa as inativas e recusa grupo desconhecido", async () => {
    expect(await setSuggestedGroupStatus("Transporte", "active")).toEqual({ ok: true, created: 1 });
    expect(activateCategoryRule).toHaveBeenCalledWith("r-99");
    expect(await setSuggestedGroupStatus("Qualquer", "active")).toMatchObject({ ok: false });
  });
});
