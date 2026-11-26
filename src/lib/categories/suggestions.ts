// Categorias e pacote de regras sugeridos. Opcionais: só são criados quando a pessoa pede,
// pela mesma API da tela, e depois pertencem a ela (renomear, arquivar, remover).
// Mesma lista do web (sem código compartilhado entre os clientes).

export const SUGGESTED_CATEGORIES = [
  "Alimentação",
  "Mercado",
  "Moradia",
  "Transporte",
  "Saúde",
  "Cuidados pessoais",
  "Lazer",
  "Educação",
  "Compras",
  "Contas fixas",
  "Salário",
  "Outras receitas",
] as const;

export type SuggestedCategory = (typeof SUGGESTED_CATEGORIES)[number];

export interface RulePackGroup {
  category: SuggestedCategory;
  /** "Descrição contém". O backend ignora maiúsculas, mas não acentos: há variantes com e sem. */
  values: readonly string[];
  /** Maior vence. Termos específicos (ex.: "mercado livre") ficam acima dos genéricos ("mercado"). */
  priority: number;
}

export const RULE_PACK: readonly RulePackGroup[] = [
  { category: "Alimentação", priority: 10, values: ["ifood", "rappi", "restaurante", "lanchonete", "padaria", "pizzaria"] },
  { category: "Mercado", priority: 10, values: ["supermercado", "mercado", "atacadao", "atacadão", "hortifruti"] },
  { category: "Transporte", priority: 10, values: ["uber", "99app", "combustivel", "combustível", "estacionamento", "pedagio", "pedágio"] },
  { category: "Saúde", priority: 10, values: ["farmacia", "farmácia", "drogaria", "drogasil", "hospital", "laboratorio", "laboratório"] },
  { category: "Cuidados pessoais", priority: 10, values: ["salao", "salão", "barbearia", "cabeleireiro", "manicure", "perfumaria"] },
  { category: "Lazer", priority: 10, values: ["netflix", "spotify", "cinema", "ingresso", "disney"] },
  { category: "Educação", priority: 10, values: ["curso", "escola", "faculdade", "udemy", "livraria"] },
  { category: "Compras", priority: 20, values: ["mercado livre", "amazon", "shopee", "magazine luiza"] },
  { category: "Moradia", priority: 10, values: ["aluguel", "condominio", "condomínio", "iptu"] },
  { category: "Contas fixas", priority: 10, values: ["conta de luz", "energia", "internet", "conta de agua", "conta de água"] },
  { category: "Salário", priority: 10, values: ["salario", "salário", "folha de pagamento"] },
  { category: "Outras receitas", priority: 10, values: ["rendimento", "cashback", "reembolso"] },
];

export function rulePackSize(pack: readonly RulePackGroup[] = RULE_PACK): number {
  return pack.reduce((total, group) => total + group.values.length, 0);
}

/**
 * Nomes sugeridos que ainda não existem. A comparação é exata, como o índice único do
 * banco (inclui arquivadas): um nome repetido seria recusado com 409.
 */
export function categoriesToCreate(existing: readonly { name: string }[]): SuggestedCategory[] {
  const names = new Set(existing.map((category) => category.name));
  return SUGGESTED_CATEGORIES.filter((name) => !names.has(name));
}

function normalize(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

export interface RuleToCreate {
  categoryId: string;
  category: string;
  conditionValue: string;
  priority: number;
}

/**
 * Regras do pacote que faltam. Só usa categorias ativas encontradas pelo nome (sem acento e
 * sem caixa, para aceitar "Alimentacao"); pula a regra igual que já existe e não foi removida.
 */
export function rulesToCreate(
  categories: readonly { id: string; name: string; status: "active" | "archived" }[],
  rules: readonly {
    categoryId: string;
    conditionField: string;
    conditionOperator: string;
    conditionValue: string;
    status: string;
  }[],
  pack: readonly RulePackGroup[] = RULE_PACK,
): { toCreate: RuleToCreate[]; missingCategories: string[] } {
  const active = categories.filter((category) => category.status === "active");
  const existing = new Set(
    rules
      .filter((rule) => rule.status !== "removed" && rule.conditionField === "description" && rule.conditionOperator === "contains")
      .map((rule) => `${rule.categoryId}|${rule.conditionValue.toLowerCase()}`),
  );
  const toCreate: RuleToCreate[] = [];
  const missingCategories: string[] = [];
  for (const group of pack) {
    const category =
      active.find((item) => item.name === group.category) ?? active.find((item) => normalize(item.name) === normalize(group.category));
    if (!category) {
      missingCategories.push(group.category);
      continue;
    }
    for (const value of group.values) {
      if (existing.has(`${category.id}|${value.toLowerCase()}`)) continue;
      toCreate.push({ categoryId: category.id, category: category.name, conditionValue: value, priority: group.priority });
    }
  }
  return { toCreate, missingCategories };
}
