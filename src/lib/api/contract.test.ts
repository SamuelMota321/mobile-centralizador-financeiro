import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { z } from "zod";
import { accountSchema } from "../accounts/schema";
import { categoryPageSchema, categorySchema } from "../categories/schema";
import {
  categoryRulePageSchema,
  categoryRuleSchema,
  MAX_RULE_PRIORITY,
} from "../category-rules/schema";
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
import { previewRun, resultRun } from "../ingestions/fixtures";
import { confirmImportInputSchema, importRunSchema, ingestionItemSchema } from "../ingestions/schema";
import { IMPORT_RUN_STATUSES, INGESTION_ITEM_STATUSES, OFX_VARIANTS } from "../ingestions/types";
import {
  completionAcceptedView,
  connectionView,
  initialImportView,
  pendingConnectionView,
  sessionView,
} from "../connections/fixtures";
import {
  completeConnectionInputSchema,
  completionAcceptedSchema,
  connectionDetailSchema,
  connectionSchema,
  consentSchema,
  initialImportSchema,
  pluggySessionSchema,
} from "../connections/schema";
import { CONNECTION_STATUSES, CONSENT_STATUSES } from "../connections/types";
import { itemSchemas, stateSchemas } from "../patrimony/schema";
import { LIMITS as PATRIMONY_LIMITS, PATRIMONY_COLLECTIONS } from "../patrimony/types";
import { allocationSchema, movementPageSchema, movementSchema, positionPageSchema, positionSchema } from "../investments/schema";
import { ASSET_CLASSES, AVAILABILITIES, EXCLUSION_REASONS, FRESHNESS } from "../investments/types";
import { syncReasonSchema, syncRunSchema } from "../sync-runs/schema";
import { SYNC_REASON_CODES, SYNC_REASON_DATA_TYPES, SYNC_RUN_STATUSES, SYNC_TRIGGERS } from "../sync-runs/types";

// Verifica o cliente contra o snapshot versionado do OpenAPI do backend: ao atualizar o
// snapshot, qualquer mudanca incompativel nas operacoes consumidas quebra este teste.

interface JsonSchema {
  allOf?: JsonSchema[];
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
    ["/api/v1/category-rules/{ruleId}/applications", "post"],
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

  it.each(["CreateCategoryRule", "UpdateCategoryRule", "CategoryRuleView"])(
    "%s.priority tem o mesmo limite do cliente",
    (component) => {
      const priority = contractComponent(component).properties?.priority as
        | (ContractSchema & { maximum?: number })
        | undefined;
      expect(priority?.maximum).toBe(MAX_RULE_PRIORITY);
    },
  );

  it("desativar conta declara o 409 de conta usada por regra ativa", () => {
    const responses = snapshot.paths["/api/v1/accounts/{accountId}/deactivate"].post.responses;
    expect(Object.keys(responses)).toContain("409");
  });

  it("type e accountId só aceitam é igual a, como no domínio do backend", () => {
    expect(OPERATORS_BY_FIELD.type).toEqual(["equals"]);
    expect(OPERATORS_BY_FIELD.accountId).toEqual(["equals"]);
  });
});

// ---------------------------------------------------------------------------
// Ingestions (OFX): schemas inline no OpenAPI (@ backend 2c416cd).

describe("contrato OpenAPI de Ingestions", () => {
  const preview = operation("/api/v1/ingestions/ofx/previews", "post");
  const confirm = operation("/api/v1/ingestions/{importRunId}/confirmations", "post");
  const status = operation("/api/v1/ingestions/{importRunId}", "get");
  const sorted = (values?: unknown[]) => [...(values ?? [])].sort();
  const requiresIdempotencyKey = (op: Operation) =>
    op.parameters?.some((p) => p.in === "header" && p.name === "Idempotency-Key" && p.required) ?? false;

  it("as três operações exigem bearer Auth0", () => {
    for (const op of [preview, confirm, status]) expect(op.security).toEqual([{ auth0: [] }]);
  });

  it("prévia e confirmação exigem Idempotency-Key; a consulta não", () => {
    expect(requiresIdempotencyKey(preview)).toBe(true);
    expect(requiresIdempotencyKey(confirm)).toBe(true);
    expect(requiresIdempotencyKey(status)).toBe(false);
  });

  it("a prévia recebe multipart com exatamente file e destinationAccountId", () => {
    const body = preview.requestBody?.content["multipart/form-data"]?.schema;
    expect(sorted(body?.required)).toEqual(["destinationAccountId", "file"]);
    expect(Object.keys(body?.properties ?? {}).sort()).toEqual(["destinationAccountId", "file"]);
  });

  it("a confirmação recebe os campos de confirmImportInputSchema", () => {
    const body = confirm.requestBody?.content["application/json"]?.schema;
    expect(Object.keys(body?.properties ?? {}).sort()).toEqual(Object.keys(confirmImportInputSchema.shape).sort());
    expect(body?.required).toEqual(["destinationAccountId"]);
  });

  it.each([
    ["prévia", preview, "201"],
    ["confirmação", confirm, "200"],
    ["consulta", status, "200"],
  ] as [string, Operation, string][])("a resposta da %s tem exatamente os campos do cliente", (_name, op, code) => {
    const run = jsonSchema(op, code);
    expect(sorted(run.required)).toEqual(Object.keys(importRunSchema.shape).sort());
    expect(sorted(run.properties?.items?.items?.required)).toEqual(Object.keys(ingestionItemSchema.shape).sort());
  });

  it.each([
    ["prévia", previewRun()],
    ["resultado parcial", resultRun()],
    ["prévia expirada", previewRun({ status: "expired", terminalAt: "2026-10-10T12:00:00.000Z" })],
    [
      "falha",
      resultRun({ status: "failed", totalItems: 0, importedItems: 0, ignoredItems: 0, failedItems: 0, items: [] }),
    ],
  ])("o ImportRun de %s é válido no contrato e no cliente", (_name, fixture) => {
    expect(violations(jsonSchema(status, "200") as ContractSchema, fixture)).toEqual([]);
    expect(importRunSchema.safeParse(fixture).success).toBe(true);
  });

  it("os enums do ImportRun e do item são os mesmos do cliente", () => {
    const run = jsonSchema(status, "200") as ContractSchema;
    const item = run.properties?.items?.items;
    expect(sorted(run.properties?.status?.enum)).toEqual([...IMPORT_RUN_STATUSES].sort());
    expect(sorted(run.properties?.variant?.enum)).toEqual([...OFX_VARIANTS].sort());
    expect(sorted(item?.properties?.status?.enum)).toEqual([...INGESTION_ITEM_STATUSES].sort());
    expect(sorted(item?.properties?.type?.enum)).toEqual([...MOVEMENT_TYPES].sort());
  });
});

// Connections (Pluggy): schemas inline no OpenAPI atual do backend.

describe("contrato OpenAPI de Connections", () => {
  const session = operation("/api/v1/connections/pluggy/sessions", "post");
  const completion = operation("/api/v1/connections/pluggy/completions", "post");
  const detail = operation("/api/v1/connections/{connectionId}", "get");
  const disconnect = operation("/api/v1/connections/{connectionId}/disconnect", "post");
  const sorted = (values?: unknown[]) => [...(values ?? [])].sort();
  const hasIdempotencyKey = (op: Operation) =>
    op.parameters?.some((p) => p.in === "header" && p.name === "Idempotency-Key") ?? false;

  it("a conclusão exige Idempotency-Key e todas as operações exigem bearer Auth0", () => {
    for (const op of [session, completion, detail, disconnect]) {
      expect(op.security).toEqual([{ auth0: [] }]);
    }
    expect(completion.parameters?.find((p) => p.name === "Idempotency-Key")).toMatchObject({ in: "header", required: true });
    for (const op of [session, detail, disconnect]) expect(hasIdempotencyKey(op)).toBe(false);
  });

  it("a sessão e a desconexão não têm corpo; a conclusão recebe só itemId", () => {
    expect(session.requestBody).toBeUndefined();
    expect(disconnect.requestBody).toBeUndefined();
    const body = completion.requestBody?.content["application/json"]?.schema;
    expect(Object.keys(body?.properties ?? {}).sort()).toEqual(Object.keys(completeConnectionInputSchema.shape).sort());
    expect(body?.required).toEqual(["itemId"]);
  });

  it("a sessão devolve exatamente connection, connectToken e expiresAt", () => {
    const body = jsonSchema(session, "201");
    expect(sorted(body.required)).toEqual(Object.keys(pluggySessionSchema.shape).sort());
  });

  it.each([
    ["sessão", session, "201"],
    ["desconexão", disconnect, "200"],
  ] as [string, Operation, string][])("a conexão na resposta da %s tem exatamente os campos do cliente", (name, op, code) => {
    const body = jsonSchema(op, code);
    const connection = name === "sessão" ? body.properties?.connection : body;
    expect(sorted(connection?.required)).toEqual(Object.keys(connectionSchema.shape).sort());
    expect(sorted(connection?.properties?.consent?.required)).toEqual(Object.keys(consentSchema.shape).sort());
  });

  it.each([
    ["conectada", connectionView()],
    ["pendente", pendingConnectionView()],
    ["parcialmente disponível", connectionView({ status: "partially_available" })],
    [
      "com consentimento revogado",
      connectionView({
        status: "revoked",
        consent: { ...connectionView().consent, status: "revoked", revokedAt: "2026-10-10T09:00:00.000Z" },
      }),
    ],
    ["desconectada", connectionView({ status: "disconnected" })],
  ])("a conexão %s é válida no contrato e no cliente", (_name, fixture) => {
    expect(violations(jsonSchema(detail, "200").allOf?.[0] as ContractSchema, fixture)).toEqual([]);
    expect(connectionSchema.safeParse(fixture).success).toBe(true);
  });

  it("a sessão fictícia é válida no contrato e no cliente", () => {
    expect(violations(jsonSchema(session, "201") as ContractSchema, sessionView())).toEqual([]);
    expect(pluggySessionSchema.safeParse(sessionView()).success).toBe(true);
  });

  it("o provedor e os enums da conexão e do consentimento são os mesmos do cliente", () => {
    const connection = jsonSchema(detail, "200").allOf?.[0] as ContractSchema;
    expect(connection.properties?.provider?.enum).toEqual(["pluggy"]);
    expect(connectionSchema.shape.provider.value).toBe("pluggy");
    expect(sorted(connection.properties?.status?.enum)).toEqual([...CONNECTION_STATUSES].sort());
    expect(sorted(connection.properties?.consent?.properties?.status?.enum)).toEqual([...CONSENT_STATUSES].sort());
  });

  it("a conclusão devolve 202 com conexão e importação inicial aceita", () => {
    const body = jsonSchema(completion, "202");
    expect(sorted(body.required)).toEqual(Object.keys(completionAcceptedSchema.shape).sort());
    expect(sorted(body.properties?.connection?.required)).toEqual(Object.keys(connectionSchema.shape).sort());
    expect(sorted(body.properties?.initialImport?.required)).toEqual(Object.keys(initialImportSchema.shape).sort());
    expect(completionAcceptedSchema.safeParse(completionAcceptedView()).success).toBe(true);
    expect(violations(body.properties?.initialImport as ContractSchema, initialImportView())).toEqual([]);
    expect(completion.responses["200"]).toBeUndefined();
  });

  it("a consulta publica initialImport anulável para acompanhar o processamento", () => {
    const body = jsonSchema(detail, "200");
    expect(body.allOf?.[1]?.required).toContain("initialImport");
    expect(body.allOf?.[1]?.properties?.initialImport).toMatchObject({ nullable: true });
    for (const initialImport of [initialImportView("processing"), null]) {
      expect(connectionDetailSchema.parse(connectionView({ initialImport })).initialImport).toEqual(initialImport);
    }
    expect(connectionDetailSchema.safeParse(connectionView()).success).toBe(false);
  });
});

describe("contrato OpenAPI de bens, financiamentos e passivos (HU-012)", () => {
  const LIST = "/api/v1/patrimony/{collection}";
  const ITEM = "/api/v1/patrimony/{collection}/{id}";
  type Node = JsonSchema & {
    oneOf?: Node[];
    anyOf?: Node[];
    enum?: string[];
    maxLength?: number;
    properties?: Record<string, Node>;
    items?: Node;
  };
  const KINDS = { assets: "asset", financings: "financing", liabilities: "liability" } as const;

  it.each([
    [LIST, "get"],
    [LIST, "post"],
    [ITEM, "get"],
    [ITEM, "patch"],
    [`${ITEM}/history`, "get"],
  ])("%s %s existe e exige bearer Auth0", (path, method) => {
    expect(operation(path, method).security).toEqual([{ auth0: [] }]);
  });

  it("as coleções são as do cliente e não há DELETE", () => {
    const param = operation(LIST, "get").parameters?.find((p) => p.name === "collection") as { schema?: { enum?: string[] } };
    expect(param.schema?.enum).toEqual([...PATRIMONY_COLLECTIONS]);
    expect(snapshot.paths[ITEM]?.delete).toBeUndefined();
  });

  it("cada tipo de item tem exatamente os campos do esquema do cliente", () => {
    const variants = (jsonSchema(operation(ITEM, "get"), "200") as Node).oneOf ?? [];
    for (const collection of PATRIMONY_COLLECTIONS) {
      const variant = variants.find((v) => v.properties?.kind?.enum?.[0] === KINDS[collection]);
      expect(variant, collection).toBeDefined();
      expect(Object.keys(variant?.properties ?? {}).sort()).toEqual(Object.keys(itemSchemas[collection].shape).sort());
    }
  });

  it("o corpo de criação aceita só os campos editáveis, com os limites do cliente", () => {
    const op = operation(LIST, "post");
    const body = op.requestBody?.content["application/json"].schema as Node;
    const editable = PATRIMONY_COLLECTIONS.map((c) => Object.keys(stateSchemas[c].shape).sort());
    const published = (body.anyOf ?? []).map((v) => Object.keys(v.properties ?? {}).sort());
    expect(published).toEqual(editable);
    const asset = body.anyOf?.[0].properties ?? {};
    expect(asset.type.maxLength).toBe(PATRIMONY_LIMITS.type);
    expect(asset.description.maxLength).toBe(PATRIMONY_LIMITS.description);
    expect(asset.source.maxLength).toBe(PATRIMONY_LIMITS.source);
  });

  it("criar não pede Idempotency-Key", () => {
    const headers = (operation(LIST, "post").parameters ?? []).filter((p) => p.in === "header");
    expect(headers).toEqual([]);
  });
});

describe("contrato OpenAPI de sincronização (pedido de execução)", () => {
  const RUNS = "/api/v1/connections/{connectionId}/sync-runs";

  it("POST existe e exige bearer Auth0; não pede Idempotency-Key", () => {
    const op = operation(RUNS, "post");
    expect(op.security).toEqual([{ auth0: [] }]);
    expect((op.parameters ?? []).filter((p) => p.in === "header")).toEqual([]);
  });

  it("a execução aceita (202) tem exatamente os campos do syncRunSchema e os enums do cliente", () => {
    const run = jsonSchema(operation(RUNS, "post"), "202") as JsonSchema & { properties: Record<string, JsonSchema & { enum?: string[] }> };
    expect(Object.keys(run.properties ?? {}).sort()).toEqual(Object.keys(syncRunSchema.shape).sort());
    expect([...(run.required ?? [])].sort()).toEqual(Object.keys(syncRunSchema.shape).sort());
    expect(run.properties.status.enum).toEqual([...SYNC_RUN_STATUSES]);
    expect(run.properties.trigger.enum).toEqual([...SYNC_TRIGGERS]);
    const reason = run.properties.reasons.items as JsonSchema & { properties: Record<string, { enum: string[] }> };
    expect(reason.properties.dataType.enum).toEqual([...SYNC_REASON_DATA_TYPES]);
    expect(reason.properties.code.enum).toEqual([...SYNC_REASON_CODES]);
  });
});

describe("contrato OpenAPI de investimentos e alocação (HU-009, HU-011)", () => {
  const LIST = "/api/v1/investments";
  const MOVEMENTS = "/api/v1/investments/{id}/movements";
  type Enumerated = JsonSchema & { enum?: string[]; properties?: Record<string, Enumerated>; items?: Enumerated };

  it.each([
    [LIST, "get"],
    [MOVEMENTS, "get"],
  ])("%s %s existe e exige bearer Auth0", (path, method) => {
    expect(operation(path, method).security).toEqual([{ auth0: [] }]);
  });

  it("a página tem os campos do positionPageSchema e a posição os do positionSchema", () => {
    const page = jsonSchema(operation(LIST, "get"), "200") as Enumerated;
    expect(Object.keys(page.properties ?? {}).sort()).toEqual(Object.keys(positionPageSchema.shape).sort());
    const position = page.properties?.positions.items as Enumerated;
    expect(Object.keys(position.properties ?? {}).sort()).toEqual(Object.keys(positionSchema.shape).sort());
    expect([...(position.required ?? [])].sort()).toEqual(Object.keys(positionSchema.shape).sort());
    const quality = position.properties?.dataQuality as Enumerated;
    expect(quality.properties?.availability.enum).toEqual([...AVAILABILITIES]);
    expect(quality.properties?.freshness.enum).toEqual([...FRESHNESS]);
  });

  it("a alocação tem os campos, as classes e os motivos de exclusão do cliente", () => {
    const page = jsonSchema(operation(LIST, "get"), "200") as Enumerated;
    const allocation = (page.properties?.portfolio as Enumerated).properties?.allocation as Enumerated;
    expect(Object.keys(allocation.properties ?? {}).sort()).toEqual(Object.keys(allocationSchema.shape).sort());
    const reasons = allocation.properties?.excludedByReason as Enumerated;
    expect(Object.keys(reasons.properties ?? {}).sort()).toEqual([...EXCLUSION_REASONS].sort());
    const currency = allocation.properties?.currencies.items as Enumerated;
    const byClass = currency.properties?.byClass.items as Enumerated;
    expect(byClass.properties?.assetClass.enum).toEqual([...ASSET_CLASSES]);
  });

  it("os movimentos têm os campos do movementSchema e do movementPageSchema", () => {
    const page = jsonSchema(operation(MOVEMENTS, "get"), "200") as Enumerated;
    expect(Object.keys(page.properties ?? {}).sort()).toEqual(Object.keys(movementPageSchema.shape).sort());
    const movement = page.properties?.movements.items as Enumerated;
    expect(Object.keys(movement.properties ?? {}).sort()).toEqual(Object.keys(movementSchema.shape).sort());
  });
});
