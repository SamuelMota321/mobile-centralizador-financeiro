// Cor fixa por categoria (Style Guide 2.2): a posição na ordem de criação das categorias da
// pessoa (arquivadas incluídas) escolhe o tom. A mesma categoria tem a mesma cor em toda tela e
// arquivar uma não repinta as outras. Da 13ª em diante a cor é neutra; o nome escrito ao lado
// é o que identifica.

export function categoryColors(
  orderedIds: readonly string[],
  palette: readonly string[],
  other: string,
): Map<string, string> {
  return new Map(orderedIds.map((id, index) => [id, index < palette.length ? palette[index] : other]));
}

/** Ordem de criação, a que escolhe a cor. */
export function idsByCreation(categories: readonly { id: string; createdAt: string }[]): string[] {
  return [...categories].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map((category) => category.id);
}
