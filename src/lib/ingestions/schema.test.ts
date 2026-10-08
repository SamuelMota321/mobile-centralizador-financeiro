import { describe, expect, it } from "vitest";
import { confirmImportInputSchema, importRunSchema } from "./schema";
import { DESTINATION_ACCOUNT_ID, previewItem, previewRun, resultRun } from "./fixtures";

describe("importRunSchema (Proposed)", () => {
  it("aceita a prévia pronta com o aviso de linha sem FITID", () => {
    const run = importRunSchema.parse(previewRun());
    expect(run.status).toBe("preview_ready");
    expect(run.items[1]?.warnings).toEqual(["external_id_missing"]);
    expect(run.items[1]?.amount).toBe("1500.00");
  });

  it("aceita o resultado com importado, duplicado ignorado e erro", () => {
    const run = importRunSchema.parse(resultRun());
    expect(run.items.map((item) => item.status)).toEqual(["imported", "ignored_duplicate", "failed"]);
    expect(run.items[2]?.errorCode).toBe("codigo_ficticio");
  });

  it("recusa valor fora do formato decimal com duas casas", () => {
    for (const amount of ["42.5", "-42.50", "0.00", "1,50"]) {
      const run = previewRun({ items: [previewItem({ amount })] });
      expect(importRunSchema.safeParse(run).success, amount).toBe(false);
    }
  });

  it("recusa data civil inexistente", () => {
    const run = previewRun({ items: [previewItem({ occurredOn: "2026-02-30" })] });
    expect(importRunSchema.safeParse(run).success).toBe(false);
  });

  it("recusa estado ou aviso fora do contrato", () => {
    expect(importRunSchema.safeParse(previewRun({ status: "pending" })).success).toBe(false);
    const run = previewRun({ items: [previewItem({ warnings: ["unknown_warning"] })] });
    expect(importRunSchema.safeParse(run).success).toBe(false);
  });
});

describe("confirmImportInputSchema", () => {
  it("exige a conta de destino como UUID e mais nada", () => {
    expect(confirmImportInputSchema.parse({ destinationAccountId: DESTINATION_ACCOUNT_ID })).toEqual({
      destinationAccountId: DESTINATION_ACCOUNT_ID,
    });
    expect(confirmImportInputSchema.safeParse({ destinationAccountId: "conta" }).success).toBe(false);
    expect(
      confirmImportInputSchema.safeParse({ destinationAccountId: DESTINATION_ACCOUNT_ID, extra: 1 }).success,
    ).toBe(false);
  });
});
