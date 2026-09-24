// Datas civis (AAAA-MM-DD) sem fuso: nunca derivar de toISOString(), que usa UTC e
// pode trocar o dia perto da meia-noite.

const ISO_CIVIL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function pad(value: number, length = 2): string {
  return String(value).padStart(length, "0");
}

/** Data de hoje no calendario local do usuario. */
export function todayCivilDate(now: Date = new Date()): string {
  return `${pad(now.getFullYear(), 4)}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** true somente para datas que existem no calendario (recusa 2026-02-30). */
export function isRealCivilDate(value: string): boolean {
  const match = ISO_CIVIL_DATE.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(2000, month - 1, day));
  date.setUTCFullYear(year);
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/** "2026-09-20" -> "20/09/2026". Valores fora do formato voltam intactos. */
export function formatCivilDate(value: string): string {
  const match = ISO_CIVIL_DATE.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

/**
 * "20/09/2026" -> "2026-09-20". O mobile usa entrada de texto (sem seletor nativo);
 * retorna null para formato invalido ou data inexistente.
 */
export function parseBrazilianDate(raw: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw.trim());
  if (!match) return null;
  const value = `${match[3]}-${match[2]}-${match[1]}`;
  return isRealCivilDate(value) ? value : null;
}
