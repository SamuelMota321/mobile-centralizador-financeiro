import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { accountSchema } from "../accounts/schema";
import { categorySchema } from "../categories/schema";
import { categoryRuleSchema } from "../category-rules/schema";
import { transactionSchema } from "../transactions/schema";

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
