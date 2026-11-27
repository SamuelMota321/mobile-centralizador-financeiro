import { describe, expect, it } from "vitest";
import {
  applicationQueue,
  compareRules,
  conditionMatches,
  type EvaluableRule,
  matchRange,
  simulate,
  type SimulatedTransaction,
} from "./evaluation";

const ACCOUNT = "3f2b8c1e-5d4a-4b6c-8e9f-0a1b2c3d4e5f";
const ACTIVE = new Set(["c-transp", "c-mercado", "c-viagem", "c-salario"]);

let sequence = 0;
function rule(overrides: Partial<EvaluableRule>): EvaluableRule {
  sequence += 1;
  return {
    id: `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`,
    categoryId: "c-transp",
    conditionField: "description",
    conditionOperator: "contains",
    conditionValue: "uber",
    priority: 0,
    status: "active",
    createdAt: new Date(Date.UTC(2026, 8, 1) + sequence * 60_000).toISOString(),
    ...overrides,
  };
}
const expense = (description: string | null, extra: Partial<SimulatedTransaction> = {}): SimulatedTransaction => ({
  description,
  type: "expense",
  accountId: null,
  ...extra,
});

describe("conditionMatches (mesmos casos do category-rule.spec.ts do backend)", () => {
  it("descrição normalizada e sem caixa: '  mercado   central ' combina com 'Compra no MERCADO CENTRAL'", () => {
    expect(conditionMatches(rule({ conditionValue: "  mercado   central " }), expense("Compra no MERCADO CENTRAL"))).toBe(true);
  });

  it("tipo e conta só com 'é igual a', sem caixa", () => {
    const income: SimulatedTransaction = { description: null, type: "income", accountId: ACCOUNT };
    expect(conditionMatches(rule({ conditionField: "type", conditionOperator: "equals", conditionValue: "INCOME" }), income)).toBe(true);
    expect(
      conditionMatches(rule({ conditionField: "accountId", conditionOperator: "equals", conditionValue: ACCOUNT.toUpperCase() }), income),
    ).toBe(true);
  });

  it("acento diferencia: 'farmacia' não combina com 'Farmácia'", () => {
    expect(conditionMatches(rule({ conditionValue: "farmacia" }), expense("Farmácia São João"))).toBe(false);
    expect(conditionMatches(rule({ conditionValue: "farmácia" }), expense("FARMÁCIA São João"))).toBe(true);
  });

  it("operadores: igual, começa e termina", () => {
    const tx = expense("  Uber   Trip  ");
    expect(conditionMatches(rule({ conditionOperator: "equals", conditionValue: "uber trip" }), tx)).toBe(true);
    expect(conditionMatches(rule({ conditionOperator: "starts_with", conditionValue: "uber" }), tx)).toBe(true);
    expect(conditionMatches(rule({ conditionOperator: "ends_with", conditionValue: "trip" }), tx)).toBe(true);
    expect(conditionMatches(rule({ conditionOperator: "ends_with", conditionValue: "uber" }), tx)).toBe(false);
  });

  it("sem descrição (ou só espaços) nenhuma regra de descrição combina; sem conta, nenhuma de conta", () => {
    expect(conditionMatches(rule({}), expense("   "))).toBe(false);
    expect(conditionMatches(rule({ conditionField: "accountId", conditionOperator: "equals", conditionValue: ACCOUNT }), expense("x"))).toBe(false);
  });
});

describe("ordem de aplicação", () => {
  it("maior prioridade primeiro; empate fica com a mais antiga", () => {
    const older = rule({ priority: 10, createdAt: "2026-01-01T00:00:00.000Z" });
    const newer = rule({ priority: 10, createdAt: "2026-02-01T00:00:00.000Z" });
    const top = rule({ priority: 20, createdAt: "2026-03-01T00:00:00.000Z" });
    expect([newer, older, top].sort(compareRules)).toEqual([top, older, newer]);
  });

  it("a fila só tem ativas de categorias ativas e marca os empates", () => {
    const a = rule({ priority: 20 });
    const b = rule({ priority: 10 });
    const c = rule({ priority: 10 });
    const paused = rule({ priority: 99, status: "inactive" });
    const archived = rule({ priority: 99, categoryId: "c-arquivada" });
    const removed = rule({ priority: 99, status: "removed" });
    const queue = applicationQueue([c, paused, a, archived, b, removed], ACTIVE);
    expect([queue.position.get(a.id), queue.position.get(b.id), queue.position.get(c.id)]).toEqual([1, 2, 3]);
    expect(queue.position.has(paused.id) || queue.position.has(archived.id) || queue.position.has(removed.id)).toBe(false);
    expect(queue.tiedWith.get(c.id)).toBe(2);
    expect(queue.tiedWith.has(b.id)).toBe(false);
    expect(queue.size).toBe(3);
  });

  it("compara ids sem caixa, como o uuid do banco", () => {
    const at = "2026-01-01T00:00:00.000Z";
    const upper = rule({ id: "B0000000-0000-4000-8000-000000000000", createdAt: at });
    const lower = rule({ id: "a0000000-0000-4000-8000-000000000000", createdAt: at });
    expect([upper, lower].sort(compareRules)[0]).toBe(lower);
  });
});

describe("simulate", () => {
  const uber = rule({ conditionValue: "uber", priority: 20 });
  const aeroporto = rule({ conditionValue: "aeroporto", categoryId: "c-viagem", priority: 5 });
  const pausada = rule({ conditionValue: "uber", categoryId: "c-mercado", priority: 50, status: "inactive" });
  const arquivada = rule({ conditionValue: "aero", categoryId: "c-arquivada", priority: 40 });
  const removida = rule({ conditionValue: "uber", priority: 99, status: "removed" });
  const rules = [aeroporto, pausada, uber, arquivada, removida];

  it("vence a primeira da fila; as outras aparecem com o motivo, removidas não", () => {
    const { winner, matches } = simulate(rules, ACTIVE, expense("Uber aeroporto"));
    expect(winner).toBe(uber);
    expect(matches.map((match) => [match.rule, match.outcome])).toEqual([
      [pausada, "inativa"],
      [arquivada, "categoria-arquivada"],
      [uber, "aplica"],
      [aeroporto, "perde"],
    ]);
  });

  it("nada combina: sem categoria", () => {
    expect(simulate(rules, ACTIVE, expense("Padaria"))).toEqual({ winner: null, matches: [] });
  });

  it("regra de tipo pega qualquer receita", () => {
    const salario = rule({ conditionField: "type", conditionOperator: "equals", conditionValue: "income", categoryId: "c-salario" });
    expect(simulate([salario], ACTIVE, { description: "Pix recebido", type: "income", accountId: null }).winner).toBe(salario);
    expect(simulate([salario], ACTIVE, expense("Pix recebido")).winner).toBeNull();
  });
});

describe("matchRange", () => {
  it("destaca o trecho na descrição normalizada", () => {
    expect(matchRange("Corrida  UBER   centro", { conditionField: "description", conditionOperator: "contains", conditionValue: "uber" })).toEqual([8, 12]);
    expect(matchRange("Uber trip", { conditionField: "description", conditionOperator: "ends_with", conditionValue: "TRIP" })).toEqual([5, 9]);
    expect(matchRange("x", { conditionField: "type", conditionOperator: "equals", conditionValue: "income" })).toBeNull();
  });
});
