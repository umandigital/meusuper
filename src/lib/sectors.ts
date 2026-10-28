export const SECTORS = [
  { value: "hortifruti", label: "Hortifruti", emoji: "🥬" },
  { value: "acougue", label: "Açougue / Carnes", emoji: "🥩" },
  { value: "frios", label: "Frios / Laticínios", emoji: "🧀" },
  { value: "padaria", label: "Padaria", emoji: "🍞" },
  { value: "mercearia", label: "Mercearia / Secos", emoji: "🫘" },
  { value: "doces", label: "Doces e Chocolates", emoji: "🍫" },
  { value: "bebidas", label: "Bebidas", emoji: "🥤" },
  { value: "congelados", label: "Congelados", emoji: "🧊" },
  { value: "limpeza", label: "Limpeza", emoji: "🧹" },
  { value: "higiene", label: "Higiene Pessoal", emoji: "🧴" },
  { value: "utilidades", label: "Utilidades Domésticas", emoji: "🏠" },
  { value: "pet", label: "Pet / Animais", emoji: "🐾" },
  { value: "outros", label: "Bazar / Outros", emoji: "📦" },
] as const;

export type SectorValue = (typeof SECTORS)[number]["value"];
