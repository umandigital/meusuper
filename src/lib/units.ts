import type { Unit } from "../types/db";

export const UNITS: { value: Unit; label: string }[] = [
  { value: "un", label: "Unidade" },
  { value: "pct", label: "Pacote / embalagem" },
  { value: "kg", label: "Quilo (kg)" },
  { value: "l", label: "Litro (L)" },
];

export const unitSuffix = (u: Unit) => (u === "kg" ? "/kg" : u === "l" ? "/L" : "");
