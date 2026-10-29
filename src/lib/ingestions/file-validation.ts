// Ajuda de uso antes do envio; quem decide e o backend. HU-004: PDF nao e aceito.
// O app envia direto ao backend, entao vale o limite dele: 10 MiB (contrato S3-01, D2).
export const MAX_OFX_BYTES = 10 * 1024 * 1024;

/** Campos que o seletor de documentos informa; tipo e tamanho podem faltar. */
export interface OfxFileCandidate {
  name: string;
  mimeType?: string | null;
  size?: number | null;
}

export type OfxFileProblem = "empty" | "pdf" | "too_large";

export function checkOfxFile(file: OfxFileCandidate): OfxFileProblem | null {
  if (file.size === 0) return "empty";
  if (file.mimeType === "application/pdf" || /\.pdf$/i.test(file.name)) return "pdf";
  if (file.size != null && file.size > MAX_OFX_BYTES) return "too_large";
  return null;
}

export const OFX_FILE_MESSAGES: Record<OfxFileProblem, string> = {
  empty: "O arquivo está vazio. Escolha o extrato OFX exportado pelo banco.",
  pdf: "Arquivos PDF não são aceitos. Exporte o extrato do banco no formato OFX.",
  too_large: "O arquivo passa de 10 MB. Exporte um período menor no banco.",
};
