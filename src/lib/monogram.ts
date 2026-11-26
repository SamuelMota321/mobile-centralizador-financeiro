// Palavras de ligação não entram nas iniciais: "Banco do Brasil" vira "BB", não "BD".
const CONNECTORS = new Set(["de", "da", "do", "das", "dos", "e"]);

/**
 * Iniciais (até duas letras) para o monograma de uma instituição ou conta. Substitui logos:
 * o app não tem as marcas e não deve imitá-las.
 */
export function monogramInitials(text: string): string {
  const words = text
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0 && !CONNECTORS.has(word.toLowerCase()));
  if (words.length === 0) return "?";
  const letters = words.length === 1 ? Array.from(words[0]).slice(0, 2) : [words[0], words[1]].map((word) => Array.from(word)[0]);
  return letters.join("").toUpperCase();
}
