import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { accountSchema } from "../accounts/schema";

// Verifica o cliente contra o snapshot versionado do OpenAPI do backend: ao atualizar o
// snapshot, qualquer mudanca incompativel nas operacoes de contas quebra este teste.

interface JsonSchema {
  required?: string[];
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  additionalProperties?: boolean;
}

interface Operation {
  requestBody?: { content: Record<string, { schema: JsonSchema }> };
  responses: Record<string, { content?: Record<string, { schema: JsonSchema }> }>;
  security?: Record<string, string[]>[];
}

const snapshot = JSON.parse(
  readFileSync(new URL("./openapi.snapshot.json", import.meta.url), "utf8"),
) as { paths: Record<string, Record<string, Operation>> };

function operation(path: string, method: string): Operation {
  const op = snapshot.paths[path]?.[method];
  if (!op) throw new Error(`Operacao ausente no contrato: ${method.toUpperCase()} ${path}`);
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

  it("a desativacao nao recebe corpo", () => {
    expect(operation("/api/v1/accounts/{accountId}/deactivate", "post").requestBody).toBeUndefined();
  });
});
