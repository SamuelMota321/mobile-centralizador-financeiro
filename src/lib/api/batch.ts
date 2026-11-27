/** Quantas chamadas ao backend vão juntas: o suficiente para encurtar, pouco para não pesar no Render. */
export const BATCH_SIZE = 5;

/**
 * Roda `task` para cada item em lotes paralelos. Um lote que falha termina por inteiro (as que
 * deram certo contam) e a execução para: nenhum lote novo começa. A ordem de conclusão dentro do
 * lote não é garantida; só o quanto entrou e o primeiro erro.
 */
export async function runInBatches<T>(
  items: readonly T[],
  task: (item: T) => Promise<unknown>,
  size: number = BATCH_SIZE,
): Promise<{ done: number; failed: boolean; error: unknown }> {
  let done = 0;
  for (let start = 0; start < items.length; start += size) {
    const results = await Promise.allSettled(items.slice(start, start + size).map(task));
    let failed = false;
    let error: unknown;
    for (const result of results) {
      if (result.status === "fulfilled") done += 1;
      else if (!failed) {
        failed = true;
        error = result.reason;
      }
    }
    if (failed) return { done, failed, error };
  }
  return { done, failed: false, error: undefined };
}
