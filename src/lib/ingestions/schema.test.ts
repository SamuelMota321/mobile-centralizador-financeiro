import { describe, expect, it } from "vitest";
import { confirmImportInputSchema, importRunSchema } from "./schema";
import { DESTINATION_ACCOUNT_ID, previewItem, previewRun, resultRun } from "./fixtures";
import { EXTERNAL_ID_MISSING } from "./types";

describe("importRunSchema", () => {
  it("aceita a prévia pronta com duplicado na conta e aviso de linha sem FITID", () => {
    const run = importRunSchema.parse(previewRun());
    expect(run.status).toBe("preview_ready");
    expect(run.destinationAccountId).toBe(DESTINATION_ACCOUNT_ID);
    expect(run.items.map((item) => item.isDuplicate)).toEqual([false, true, false]);
    expect(run.items[2]?.warnings).toEqual([EXTERNAL_ID_MISSING]);
    expect(run.items[2]?.amount).toBe("1500.00");
  });

  it("aceita o resultado com importado, duplicado ignorado e erro", () => {
    const run = importRunSchema.parse(resultRun());
    expect(run.items.map((item) => item.status)).toEqual(["imported", "ignored_duplicate", "failed"]);
    expect(run.items[2]?.errorCode).toBe("codigo_ficticio");
    expect(run.terminalAt).toBe("2026-10-09T12:01:00.000Z");
  });

  it("aceita aviso desconhecido, porque o contrato não fecha a lista", () => {
    const run = previewRun({ items: [previewItem({ warnings: ["aviso_novo"] })] });
    expect(importRunSchema.safeParse(run).success).toBe(true);
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

  it("recusa estado ou variante fora do contrato", () => {
    expect(importRunSchema.safeParse(previewRun({ status: "awaiting_account_mapping" })).success).toBe(false);
    expect(importRunSchema.safeParse(previewRun({ variant: "ofx_3" })).success).toBe(false);
  });

  it("exige isDuplicate e a conta de destino", () => {
    const withoutFlag: Record<string, unknown> = previewItem();
    delete withoutFlag.isDuplicate;
    expect(importRunSchema.safeParse(previewRun({ items: [withoutFlag] })).success).toBe(false);
    expect(importRunSchema.safeParse(previewRun({ destinationAccountId: null })).success).toBe(false);
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
