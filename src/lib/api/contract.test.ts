import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { z } from "zod";
import { accountSchema } from "../accounts/schema";
import { categoryPageSchema, categorySchema } from "../categories/schema";
import { categoryRulePageSchema, categoryRuleSchema } from "../category-rules/schema";
import {
  OPERATORS_BY_FIELD,
  RULE_CONDITION_FIELDS,
  RULE_OPERATORS,
} from "../category-rules/types";
import {
  transactionPageSchema,
  transactionSchema,
  transferSchema,
} from "../transactions/schema";
import { CATEGORIZATION_STATUSES, MOVEMENT_TYPES, UNCERTAIN_STATUSES } from "../transactions/types";

// Verifica o cliente contra o snapshot versionado do OpenAPI do backend: ao atualizar o
// snapshot, qualquer mudanca incompativel nas operacoes consumidas quebra este teste.

interface JsonSchema {
  required?: string[];
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  additionalProperties?: boolean;
}

interface Operation {
  parameters?: { name: string; in: string; required?: boolean }[];
  requestBody?: { content: Record<string, { schema: JsonSchema }> };
  responses: Record<string, { content?: Record<string, { schema: JsonSchema }> }>;
  security?: Record<string, string[]>[];
}

const snapshot = JSON.parse(
  readFileSync(new URL("./openapi.snapshot.json", import.meta.url), "utf8"),
) as {
  paths: Record<string, Record<string, Operation>>;
  components: { schemas: Record<string, JsonSchema> };
};

function operation(path: string, method: string): Operation {
  const op = snapshot.paths[path]?.[method];
  if (!op) throw new Error(`Operação ausente no contrato: ${method.toUpperCase()} ${path}`);
  return op;
}

function jsonSchema(op: Operation, status: string): JsonSchema {
  const schema = op.responses[status]?.content?.["application/json"]?.schema;
  if (!schema) throw new Error(`Resposta ${status} sem application/json`);
  return schema;
}

const accountKeys = Object.keys(accountSchema.shape).sort();

describe("contrato OpenAPI de contas", () => {
  it.each([
    ["/api/v1/accounts", "get"],
    ["/api/v1/accounts", "post"],
    ["/api/v1/accounts/{accountId}", "patch"],
    ["/api/v1/accounts/{accountId}/deactivate", "post"],
  ])("%s %s existe e exige bearer Auth0", (path, method) => {
    expect(operation(path, method).security).toEqual([{ auth0: [] }]);
  });

  it("a conta da listagem tem exatamente os campos do accountSchema", () => {
    const page = jsonSchema(operation("/api/v1/accounts", "get"), "200");
    expect(page.required).toEqual(expect.arrayContaining(["items", "page", "pageSize", "total"]));
    expect([...(page.properties?.items.items?.required ?? [])].sort()).toEqual(accountKeys);
  });

  it.each([
    ["/api/v1/accounts", "post", "201"],
    ["/api/v1/accounts/{accountId}", "patch", "200"],
    ["/api/v1/accounts/{accountId}/deactivate", "post", "200"],
  ])("%s %s responde %s com a conta completa", (path, method, status) => {
    expect([...(jsonSchema(operation(path, method), status).required ?? [])].sort()).toEqual(
      accountKeys,
    );
  });

  it("o PATCH aceita somente os campos enviados pelo cliente", () => {
    const body = operation("/api/v1/accounts/{accountId}", "patch").requestBody?.content[
      "application/json"
    ].schema;
    expect(body?.additionalProperties).toBe(false);
    expect(Object.keys(body?.properties ?? {}).sort()).toEqual(
      [
        "confirmPossibleDuplicate",
        "initialBalance",
        "initialBalanceAsOf",
        "institutionName",
        "name",
        "type",
      ].sort(),
    );
  });

  it("a desativação não recebe corpo", () => {
    expect(operation("/api/v1/accounts/{accountId}/deactivate", "post").requestBody).toBeUndefined();
  });
});

function component(name: string): JsonSchema {
  const schema = snapshot.components.schemas[name];
  if (!schema) throw new Error(`Schema ausente no contrato: ${name}`);
  return schema;
}

const sorted = (values: string[] | undefined) => [...(values ?? [])].sort();

describe("contrato OpenAPI de Transactions", () => {
  it.each([
    ["/api/v1/transactions", "get"],
    ["/api/v1/transactions", "post"],
    ["/api/v1/transfers", "post"],
    ["/api/v1/transactions/{transactionId}/category", "patch"],
    ["/api/v1/categories", "get"],
    ["/api/v1/categories", "post"],
    ["/api/v1/categories/{categoryId}", "patch"],
    ["/api/v1/categories/{categoryId}/deactivate", "post"],
    ["/api/v1/category-rules", "get"],
    ["/api/v1/category-rules", "post"],
    ["/api/v1/category-rules/{ruleId}", "patch"],
    ["/api/v1/category-rules/{ruleId}", "delete"],
    ["/api/v1/category-rules/{ruleId}/activate", "post"],
    ["/api/v1/category-rules/{ruleId}/deactivate", "post"],
  ])("%s %s existe e exige bearer Auth0", (path, method) => {
    expect(operation(path, method).security).toEqual([{ auth0: [] }]);
  });

  it.each([
    ["/api/v1/transactions", "post"],
    ["/api/v1/transfers", "post"],
  ])("%s %s exige Idempotency-Key", (path, method) => {
    const header = operation(path, method).parameters?.find((p) => p.name === "Idempotency-Key");
    expect(header).toMatchObject({ in: "header", required: true });
  });

  it.each([
    ["TransactionView", transactionSchema],
    ["CategoryView", categorySchema],
    ["CategoryRuleView", categoryRuleSchema],
  ] as const)("%s tem exatamente os campos do schema do cliente", (name, schema) => {
    expect(sorted(component(name).required)).toEqual(Object.keys(schema.shape).sort());
  });

  it("os corpos de criacao usam os campos enviados pelo cliente", () => {
    expect(sorted(Object.keys(component("CreateTransaction").properties ?? {}))).toEqual(
      ["accountId", "amount", "description", "occurredOn", "type"],
    );
    expect(sorted(Object.keys(component("CreateTransfer").properties ?? {}))).toEqual(
      ["amount", "description", "fromAccountId", "occurredOn", "toAccountId"],
    );
    expect(sorted(Object.keys(component("CreateCategoryRule").properties ?? {}))).toEqual(
      ["categoryId", "conditionField", "conditionOperator", "conditionValue", "priority"],
    );
  });

  it("a transferência responde com duas entradas", () => {
    const transfer = component("TransferView").properties?.entries as JsonSchema & {
      minItems?: number;
      maxItems?: number;
    };
    expect(transfer).toMatchObject({ minItems: 2, maxItems: 2 });
  });

  it("remover regra responde 200 com a regra (divergencia registrada: especificacao cita 200/204)", () => {
    const op = operation("/api/v1/category-rules/{ruleId}", "delete");
    expect(op.responses["200"]?.content?.["application/json"]).toBeDefined();
    expect(op.responses["204"]).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Fixtures de resposta validadas contra o snapshot e contra o Zod do cliente: se o
// backend mudar tipo, enum, nulabilidade ou campo obrigatório, este bloco falha.

interface ContractSchema {
  type?: string;
  enum?: unknown[];
  nullable?: boolean;
  required?: string[];
  properties?: Record<string, ContractSchema>;
  items?: ContractSchema;
  additionalProperties?: boolean;
  pattern?: string;
  format?: string;
  minItems?: number;
  maxItems?: number;
  minimum?: number;
  minLength?: number;
}

const FORMATS: Record<string, (value: string) => boolean> = {
  uuid: (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value),
  date: (value) => /^\d{4}-\d{2}-\d{2}$/.test(value),
  "date-time": (value) => !Number.isNaN(Date.parse(value)) && value.includes("T"),
};

/** Subconjunto de JSON Schema usado pelo snapshot; devolve as violações encontradas. */
function violations(schema: ContractSchema, value: unknown, path = "$"): string[] {
  if (value === null) return schema.nullable ? [] : [`${path}: null não permitido`];
  const errors: string[] = [];
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${path}: fora do enum`);

  switch (schema.type) {
    case "object": {
      if (typeof value !== "object" || Array.isArray(value)) return [`${path}: esperado objeto`];
      const record = value as Record<string, unknown>;
      for (const key of schema.required ?? []) {
        if (!(key in record)) errors.push(`${path}.${key}: obrigatório ausente`);
      }
      for (const [key, item] of Object.entries(record)) {
        const child = schema.properties?.[key];
        if (child) errors.push(...violations(child, item, `${path}.${key}`));
        else if (schema.additionalProperties === false) errors.push(`${path}.${key}: não previsto`);
      }
      break;
    }
    case "array": {
      if (!Array.isArray(value)) return [`${path}: esperado array`];
      if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(`${path}: poucos itens`);
      if (schema.maxItems !== undefined && value.length > schema.maxItems) errors.push(`${path}: itens demais`);
      value.forEach((item, index) => {
        if (schema.items) errors.push(...violations(schema.items, item, `${path}[${index}]`));
      });
      break;
    }
    case "string": {
      if (typeof value !== "string") return [`${path}: esperado texto`];
      if (schema.pattern && !new RegExp(schema.pattern).test(value)) errors.push(`${path}: fora do padrão`);
      if (schema.minLength !== undefined && value.length < schema.minLength) errors.push(`${path}: curto demais`);
      const check = schema.format ? FORMATS[schema.format] : undefined;
      if (check && !check(value)) errors.push(`${path}: formato ${schema.format} inválido`);
      break;
    }
    case "integer":
      if (!Number.isInteger(value)) return [`${path}: esperado inteiro`];
      if (schema.minimum !== undefined && (value as number) < schema.minimum) errors.push(`${path}: abaixo do mínimo`);
      break;
    case "boolean":
      if (typeof value !== "boolean") return [`${path}: esperado booleano`];
      break;
  }
  return errors;
}

const contractComponent = (name: string) => snapshot.components.schemas[name] as ContractSchema;

const IDS = {
  account: "3f1c2b4e-8a6d-4c1e-9b2a-7d5e6f8a9b0c",
  otherAccount: "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d",
  transaction: "5d4c3b2a-1f0e-4d9c-8b7a-6f5e4d3c2b1a",
  transfer: "6e5d4c3b-2a1f-4e0d-9c8b-7a6f5e4d3c2b",
  category: "7c6b5a49-3827-4165-9a8b-7c6d5e4f3a2b",
  rule: "9f8e7d6c-5b4a-4938-8271-6a5b4c3d2e1f",
};
const STAMP = "2026-09-20T12:00:00.000Z";

const incomeView = {
  id: IDS.transaction,
  accountId: IDS.account,
  type: "income",
  amount: "6800.00",
  occurredOn: "2026-09-05",
  description: "Salário (fictício)",
  status: "posted",
  transferId: null,
  transferSide: null,
  categoryId: IDS.category,
  categorizationStatus: "categorized",
  categorizationSource: "rule",
  createdAt: STAMP,
  updatedAt: STAMP,
};

const transferLeg = (side: "outgoing" | "incoming", accountId: string) => ({
  ...incomeView,
  id: side === "outgoing" ? IDS.transaction : IDS.rule,
  accountId,
  type: "transfer",
  amount: "250.00",
  description: null,
  transferId: IDS.transfer,
  transferSide: side,
  categoryId: null,
  categorizationStatus: "not_applicable",
  categorizationSource: null,
});

const categoryView = {
  id: IDS.category,
  name: "Alimentação",
  source: "user",
  status: "archived",
  archivedAt: STAMP,
  createdAt: STAMP,
  updatedAt: STAMP,
};

const ruleView = {
  id: IDS.rule,
  categoryId: IDS.category,
  conditionField: "description",
  conditionOperator: "starts_with",
  conditionValue: "mercado bairro",
  priority: 20,
  status: "removed",
  removedAt: STAMP,
  createdAt: STAMP,
  updatedAt: STAMP,
};

const page = <T>(items: T[]) => ({ items, page: 1, pageSize: 20, total: items.length });

describe("fixtures de resposta contra o snapshot e o cliente", () => {
  it.each([
    ["TransactionView", incomeView, transactionSchema],
    ["TransactionPage", page([incomeView, transferLeg("outgoing", IDS.account)]), transactionPageSchema],
    [
      "TransferView",
      { entries: [transferLeg("outgoing", IDS.account), transferLeg("incoming", IDS.otherAccount)] },
      transferSchema,
    ],
    ["CategoryView", categoryView, categorySchema],
    ["CategoryPage", page([categoryView]), categoryPageSchema],
    ["CategoryRuleView", ruleView, categoryRuleSchema],
    ["CategoryRulePage", page([ruleView]), categoryRulePageSchema],
  ] as [string, unknown, z.ZodType][])("%s é válida no contrato e no cliente", (name, fixture, schema) => {
    expect(violations(contractComponent(name), fixture)).toEqual([]);
    expect(schema.safeParse(fixture).success).toBe(true);
  });

  it("o validador acusa desvios reais do contrato", () => {
    expect(violations(contractComponent("TransactionView"), { ...incomeView, type: "refund" })).toContain(
      "$.type: fora do enum",
    );
    expect(violations(contractComponent("TransferView"), { entries: [transferLeg("outgoing", IDS.account)] })).toContain(
      "$.entries: poucos itens",
    );
    expect(violations(contractComponent("CategoryRuleView"), { ...ruleView, priority: 1.5 })).toContain(
      "$.priority: esperado inteiro",
    );
  });
});

describe("paridade de enums entre o snapshot e o cliente", () => {
  const enumOf = (component: string, property: string) =>
    [...(contractComponent(component).properties?.[property]?.enum ?? [])].sort();

  it.each([
    ["TransactionView", "type", [...MOVEMENT_TYPES, "transfer"]],
    ["TransactionView", "status", ["posted", "voided"]],
    ["TransactionView", "transferSide", ["outgoing", "incoming"]],
    ["TransactionView", "categorizationStatus", [...CATEGORIZATION_STATUSES]],
    ["TransactionView", "categorizationSource", ["manual", "rule"]],
    ["CategoryView", "status", ["active", "archived"]],
    ["CategoryRuleView", "conditionField", [...RULE_CONDITION_FIELDS]],
    ["CategoryRuleView", "conditionOperator", [...RULE_OPERATORS]],
    ["CategoryRuleView", "status", ["active", "inactive", "removed"]],
  ])("%s.%s", (component, property, clientValues) => {
    expect(enumOf(component, property)).toEqual([...clientValues].sort());
  });

  it("marcar como incerta aceita exatamente os estados do contrato", () => {
    const update = contractComponent("UpdateTransactionCategory") as ContractSchema & {
      oneOf?: ContractSchema[];
    };
    const statuses = (update.oneOf ?? [])
      .flatMap((variant) => variant.properties?.categorizationStatus?.enum ?? [])
      .sort();
    expect(statuses).toEqual([...UNCERTAIN_STATUSES].sort());
  });

  it("type e accountId só aceitam é igual a, como no domínio do backend", () => {
    expect(OPERATORS_BY_FIELD.type).toEqual(["equals"]);
    expect(OPERATORS_BY_FIELD.accountId).toEqual(["equals"]);
  });
});
