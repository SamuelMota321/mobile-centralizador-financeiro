import type { ComponentType } from "react";
import { Text, View } from "react-native";
import { type CategoryIconKey, categoryIconKey } from "../lib/categories/category-icon";
import { makeStyles, useTheme } from "../theme";
import {
  IconBriefcase,
  IconCar,
  IconCart,
  IconCategories,
  IconFlower,
  IconGraduation,
  IconHeartPulse,
  IconHome,
  IconReceipt,
  IconShoppingBag,
  IconStar,
  IconTicket,
  IconUtensils,
} from "./icons";

type IconComponent = ComponentType<{ size?: number; color: string }>;

const ICONS: Record<CategoryIconKey, IconComponent> = {
  home: IconHome,
  groceries: IconCart,
  food: IconUtensils,
  transport: IconCar,
  care: IconFlower,
  health: IconHeartPulse,
  leisure: IconTicket,
  education: IconGraduation,
  shopping: IconShoppingBag,
  bills: IconReceipt,
  salary: IconBriefcase,
  income: IconStar,
  generic: IconCategories,
};

export type BadgeSize = "small" | "regular" | "large";
const BOX: Record<BadgeSize, number> = { small: 24, regular: 36, large: 44 };
const GLYPH: Record<BadgeSize, number> = { small: 14, regular: 18, large: 22 };

/**
 * Círculo da categoria na cor fixa dela (ícone claro sobre fundo cheio). `missing` desenha o
 * círculo tracejado, sem cor, para a sugerida que ainda não existe; `off` o apaga. Decorativo:
 * o nome da categoria sempre aparece escrito ao lado.
 */
export function CategoryBadge({
  name,
  color,
  size = "regular",
  state = "on",
}: {
  name: string | null;
  color: string | null;
  size?: BadgeSize;
  state?: "on" | "missing" | "off";
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const Icon = ICONS[categoryIconKey(name)];
  const box = BOX[size];
  const fill = color ?? colors.categoryOther;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.badge,
        { width: box, height: box, borderRadius: box / 2 },
        state === "missing" ? styles.missing : { backgroundColor: fill },
        state === "off" && styles.off,
      ]}
    >
      <Icon size={GLYPH[size]} color={state === "missing" ? colors.muted : colors.onCategory} />
    </View>
  );
}

/** Fallback de texto para leitores de tela quando só o círculo mostra o estado. */
export function BadgeText({ children }: { children: string }) {
  const styles = useStyles();
  return <Text style={styles.hidden}>{children}</Text>;
}

const useStyles = makeStyles((c) => ({
  badge: { alignItems: "center", justifyContent: "center" },
  missing: { borderWidth: 1.5, borderStyle: "dashed", borderColor: c.inputBorder, backgroundColor: "transparent" },
  off: { opacity: 0.45 },
  hidden: { position: "absolute", width: 1, height: 1, opacity: 0 },
}));
