import { useMemo } from "react";
import { StyleSheet, type TextStyle, useColorScheme } from "react-native";

/** Paleta Coinciente (style guide 1.0). Tokens e papéis documentados em DESIGN.md. */
export const brand = {
  confianca: "#10251F",
  consciencia: "#087A55",
  clareza: "#55D6A4",
  respiro: "#F2F6F4",
  symbol: "#3DC795",
} as const;

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceSoft: string;
  foreground: string;
  bodyText: string;
  muted: string;
  line: string;
  inputBorder: string;
  primary: string;
  primaryPressed: string;
  primaryTint: string;
  onPrimary: string;
  positive: string;
  negative: string;
  warning: string;
  info: string;
}

const light: ThemeColors = {
  background: "#F2F6F4",
  surface: "#FFFFFF",
  surfaceSoft: "#F7FAF8",
  foreground: "#14231E",
  bodyText: "#354A42",
  muted: "#60736B",
  line: "#DBE5E0",
  inputBorder: "#7A8F86",
  primary: "#087A55",
  primaryPressed: "#056746",
  primaryTint: "#E6F1EC",
  onPrimary: "#FFFFFF",
  positive: "#087A55",
  negative: "#B5473F",
  warning: "#A86512",
  info: "#2B6F89",
};

// O tema escuro preserva temperatura e hierarquia do claro; nunca preto puro.
const dark: ThemeColors = {
  background: "#0C1714",
  surface: "#13231E",
  surfaceSoft: "#192C26",
  foreground: "#EDF6F2",
  bodyText: "#D0DFD8",
  muted: "#A6B9B0",
  line: "#284038",
  inputBorder: "#5F7A70",
  primary: "#55D6A4",
  primaryPressed: "#7CE8BD",
  primaryTint: "#1B3A30",
  onPrimary: "#07140F",
  positive: "#55D6A4",
  negative: "#FF9188",
  warning: "#F3B866",
  info: "#75C4DF",
};

/** Um arquivo de fonte por peso: no Android, fontWeight nao combina com fonte customizada. */
export const fonts = {
  medium: "Manrope_500Medium",
  semibold: "Manrope_600SemiBold",
  bold: "Manrope_700Bold",
  extrabold: "Manrope_800ExtraBold",
  display: "Newsreader_400Regular",
} as const;

export const radius = { control: 10, panel: 14, frame: 20, pill: 999 } as const;

export const type = {
  pageTitle: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 30, letterSpacing: -0.4 },
  sectionTitle: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 22 },
  body: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 22 },
  bodySmall: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20 },
  label: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18 },
  micro: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 16 },
  amount: {
    fontFamily: fonts.extrabold,
    fontSize: 15,
    lineHeight: 20,
    fontVariant: ["tabular-nums"],
  },
  display: { fontFamily: fonts.display, fontSize: 40, lineHeight: 44, letterSpacing: -1 },
} satisfies Record<string, TextStyle>;

export interface Theme {
  scheme: "light" | "dark";
  colors: ThemeColors;
}

export function useTheme(): Theme {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  return useMemo(() => ({ scheme, colors: scheme === "dark" ? dark : light }), [scheme]);
}

/**
 * Estilos que dependem do tema, criados uma vez por esquema de cor.
 * Uso: `const useStyles = makeStyles((c) => ({ ... }))` fora do componente.
 */
export function makeStyles<T extends StyleSheet.NamedStyles<T>>(
  factory: (colors: ThemeColors) => T,
): () => T {
  const cache: Partial<Record<Theme["scheme"], T>> = {};
  return function useStyles(): T {
    const { scheme, colors } = useTheme();
    cache[scheme] ??= StyleSheet.create(factory(colors));
    return cache[scheme];
  };
}
