import * as SecureStore from "expo-secure-store";
import { Appearance } from "react-native";

const THEME_KEY = "coinciente.theme";
export type ThemeChoice = "light" | "dark";
export const DEFAULT_THEME: ThemeChoice = "dark";

export function applyTheme(choice: ThemeChoice): void {
  Appearance.setColorScheme(choice);
}

export async function restoreTheme(): Promise<void> {
  try {
    const saved = await SecureStore.getItemAsync(THEME_KEY);
    applyTheme(saved === "light" || saved === "dark" ? saved : DEFAULT_THEME);
  } catch {
    applyTheme(DEFAULT_THEME);
  }
}

export async function selectTheme(choice: ThemeChoice): Promise<void> {
  applyTheme(choice);
  await SecureStore.setItemAsync(THEME_KEY, choice);
}
