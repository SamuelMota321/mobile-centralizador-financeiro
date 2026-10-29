import { describe, expect, it } from "vitest";
import { checkOfxFile, MAX_OFX_BYTES } from "./file-validation";

const ofx = { name: "extrato.ofx", mimeType: "application/x-ofx", size: 2048 };

describe("checkOfxFile", () => {
  it("aceita um OFX dentro do limite, inclusive sem tipo ou tamanho informado", () => {
    expect(checkOfxFile(ofx)).toBeNull();
    expect(checkOfxFile({ name: "extrato.ofx" })).toBeNull();
    expect(checkOfxFile({ ...ofx, size: MAX_OFX_BYTES })).toBeNull();
  });

  it("recusa arquivo vazio", () => {
    expect(checkOfxFile({ ...ofx, size: 0 })).toBe("empty");
  });

  it("recusa PDF pelo tipo ou pela extensão", () => {
    expect(checkOfxFile({ ...ofx, mimeType: "application/pdf" })).toBe("pdf");
    expect(checkOfxFile({ name: "EXTRATO.PDF" })).toBe("pdf");
  });

  it("recusa acima de 10 MiB, o limite do backend", () => {
    expect(MAX_OFX_BYTES).toBe(10 * 1024 * 1024);
    expect(checkOfxFile({ ...ofx, size: MAX_OFX_BYTES + 1 })).toBe("too_large");
  });
});
