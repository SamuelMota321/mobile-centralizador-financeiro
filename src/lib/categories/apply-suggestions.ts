import { runInBatches } from "../api/batch";
import { PROBLEM_CODES, ProblemDetailsError } from "../api/errors";
import { listAllPages } from "../api/pagination";
import { activateCategoryRule, createCategoryRule, deactivateCategoryRule, listCategoryRules } from "../category-rules/api";
import { createCategory, listCategories } from "./api";
import { categoriesToCreate, RULE_PACK, rulesToCreate, splitSuggestedRules, SUGGESTED_CATEGORIES } from "./suggestions";

/** Resultado parcial: em falha, diz quantos entraram e devolve o erro para a tela classificar. */
export type ApplyResult<T> = { ok: true; created: number } & T | { ok: false; created: number; error: unknown };

/** Cria as categorias sugeridas que faltam, uma por vez. Repetir é seguro. */
export async function createSuggestedCategories(): Promise<ApplyResult<{ skipped: number }>> {
  let created = 0;
  try {
    const { items } = await listAllPages((query) => listCategories(query));
    const names = categoriesToCreate(items);
    // Em lotes paralelos: 12 idas e voltas em série passavam de 5 s no Render.
    const batch = await runInBatches(names, (name) => createCategory({ name }));
    created += batch.done;
    if (batch.failed) throw batch.error;
    return { ok: true, created, skipped: SUGGESTED_CATEGORIES.length - names.length };
  } catch (error) {
    return { ok: false, created, error };
  }
}

/** Cria as regras do pacote que faltam ("descrição contém"), só para categorias ativas. */
export async function applyRulePack(): Promise<ApplyResult<{ missingCategories: string[] }>> {
  let created = 0;
  try {
    const [categories, rules] = await Promise.all([
      listAllPages((query) => listCategories(query)),
      listAllPages((query) => listCategoryRules(query)),
    ]);
    const { toCreate, missingCategories } = rulesToCreate(categories.items, rules.items);
    // Em lotes paralelos: até 60 idas e voltas em série levavam uns 25 s no Render.
    const batch = await runInBatches(toCreate, (rule) =>
      createCategoryRule({
        categoryId: rule.categoryId,
        conditionField: "description",
        conditionOperator: "contains",
        conditionValue: rule.conditionValue,
        priority: rule.priority,
      }),
    );
    created += batch.done;
    if (batch.failed) throw batch.error;
    return { ok: true, created, missingCategories };
  } catch (error) {
    return { ok: false, created, error };
  }
}

/**
 * Cria uma única sugerida. Só aceita nomes da lista; nome que já existe (inclusive arquivada) é
 * pulado, como o 409 do banco.
 */
export async function createOneSuggestedCategory(name: string): Promise<ApplyResult<{ skipped: number }>> {
  if (!(SUGGESTED_CATEGORIES as readonly string[]).includes(name)) {
    return { ok: false, created: 0, error: new Error("Sugestão desconhecida.") };
  }
  try {
    // Cria direto: o banco recusa nome repetido (409, tratado abaixo), sem ler a lista antes.
    await createCategory({ name });
    return { ok: true, created: 1, skipped: 0 };
  } catch (error) {
    if (error instanceof ProblemDetailsError && error.code === PROBLEM_CODES.categoryAlreadyExists) {
      return { ok: true, created: 0, skipped: 1 };
    }
    return { ok: false, created: 0, error };
  }
}

/**
 * Adiciona um grupo do pacote: cria a categoria sugerida se não houver uma ativa com esse nome e,
 * em seguida, as regras do grupo que faltam.
 */
export async function addPackGroup(category: string): Promise<ApplyResult<{ createdCategory: boolean }>> {
  const group = RULE_PACK.find((item) => item.category === category);
  if (!group) return { ok: false, created: 0, error: new Error("Grupo desconhecido.") };
  let created = 0;
  let createdCategory = false;
  try {
    const [categories, rules] = await Promise.all([
      listAllPages((query) => listCategories(query)),
      listAllPages((query) => listCategoryRules(query)),
    ]);
    let pool = categories.items;
    if (rulesToCreate(pool, [], [group]).missingCategories.length > 0) {
      pool = [...pool, await createCategory({ name: group.category })];
      createdCategory = true;
    }
    const batch = await runInBatches(rulesToCreate(pool, rules.items, [group]).toCreate, (rule) =>
      createCategoryRule({
        categoryId: rule.categoryId,
        conditionField: "description",
        conditionOperator: "contains",
        conditionValue: rule.conditionValue,
        priority: rule.priority,
      }),
    );
    created += batch.done;
    if (batch.failed) throw batch.error;
    return { ok: true, created, createdCategory };
  } catch (error) {
    return { ok: false, created, error };
  }
}

/**
 * Ativa ou desativa, uma por vez, as regras sugeridas de uma categoria do pacote. As regras são
 * relidas e reagrupadas aqui; removidas e as que já estão no estado pedido ficam como estão.
 */
export async function setSuggestedGroupStatus(category: string, target: "active" | "inactive"): Promise<ApplyResult<Record<never, never>>> {
  if (!(SUGGESTED_CATEGORIES as readonly string[]).includes(category)) {
    return { ok: false, created: 0, error: new Error("Grupo desconhecido.") };
  }
  let changed = 0;
  try {
    const [categories, rules] = await Promise.all([
      listAllPages((query) => listCategories(query)),
      listAllPages((query) => listCategoryRules(query)),
    ]);
    const group = splitSuggestedRules(rules.items, categories.items).suggested.find((item) => item.category === category);
    const pending = (group?.rules ?? []).filter((rule) => rule.status !== "removed" && rule.status !== target);
    const operation = target === "active" ? activateCategoryRule : deactivateCategoryRule;
    const batch = await runInBatches(pending, (rule) => operation(rule.id));
    changed += batch.done;
    if (batch.failed) throw batch.error;
    return { ok: true, created: changed };
  } catch (error) {
    return { ok: false, created: changed, error };
  }
}
