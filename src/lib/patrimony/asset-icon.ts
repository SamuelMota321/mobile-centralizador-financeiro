// Ícone do bem escolhido pelo tipo, que é texto livre digitado pela pessoa: o backend não guarda
// ícone. Compara palavras inteiras, sem acento e sem caixa; sem regra, ícone genérico. Só
// decoração: o tipo e o nome do bem sempre aparecem escritos ao lado.

export type AssetIconKey = "home" | "vehicle" | "generic";

const RULES: readonly (readonly [AssetIconKey, readonly string[]])[] = [
  ["home", ["imovel", "imoveis", "casa", "apartamento", "apto", "terreno", "lote", "sala", "galpao", "sitio", "fazenda"]],
  ["vehicle", ["veiculo", "veiculos", "carro", "moto", "motocicleta", "automovel", "caminhao", "bicicleta", "barco", "lancha"]],
];

function words(text: string): Set<string> {
  return new Set(
    text
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean),
  );
}

export function assetIconKey(type: string | null | undefined): AssetIconKey {
  if (!type) return "generic";
  const tokens = words(type);
  return RULES.find(([, keywords]) => keywords.some((word) => tokens.has(word)))?.[0] ?? "generic";
}
