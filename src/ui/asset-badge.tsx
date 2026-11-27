import type { ComponentType } from "react";
import { View } from "react-native";
import { type AssetIconKey, assetIconKey } from "../lib/patrimony/asset-icon";
import { makeStyles, useTheme } from "../theme";
import { IconBriefcase, IconCar, IconHome } from "./icons";

const ICONS: Record<AssetIconKey, ComponentType<{ size?: number; color: string }>> = {
  home: IconHome,
  vehicle: IconCar,
  generic: IconBriefcase,
};

/**
 * Círculo com o ícone do bem, escolhido pelo tipo (texto livre). Neutro: a cor de categoria só
 * identifica categoria. Decorativo: o nome do bem sempre vem escrito ao lado.
 */
export function AssetBadge({ type, size = 36 }: { type: string | null | undefined; size?: number }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const Icon = ICONS[assetIconKey(type)];
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.badge, { width: size, height: size, borderRadius: size / 2 }]}
    >
      <Icon size={Math.round(size * 0.5)} color={colors.bodyText} />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  badge: { alignItems: "center", justifyContent: "center", backgroundColor: c.surfaceSoft, borderWidth: 1, borderColor: c.line },
}));
