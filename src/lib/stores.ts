export const STORES = ["Nicolini", "Peruzzo"] as const;
export type StoreName = (typeof STORES)[number];

/** Nome automatico da lista: data e hora de criacao (horario de Brasilia). */
export function autoListName(date = new Date()): string {
  return date.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).replace(",", "");
}
