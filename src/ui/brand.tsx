import { Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { brand, fonts, useTheme } from "../theme";

/** Simbolo Coinciente: dois "C" concentricos e o ponto do usuario. Cor fixa da marca. */
export function BrandSymbol({ size = 28 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path d="M48.5 14.5A24 24 0 1 0 48.5 49.5" stroke={brand.symbol} strokeWidth={6} strokeLinecap="round" fill="none" />
      <Path d="M42 22.5A14.5 14.5 0 1 0 42 41.5" stroke={brand.symbol} strokeWidth={6} strokeLinecap="round" fill="none" />
      <Circle cx="43" cy="32" r="4" fill={brand.symbol} />
    </Svg>
  );
}

/** Assinatura: simbolo + "Coin" + "ciente" em destaque, como no guia. */
export function BrandLockup({ size = 26 }: { size?: number }) {
  const { colors } = useTheme();
  return (
    <View
      style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
      accessible
      accessibilityRole="header"
      accessibilityLabel="Coinciente"
    >
      <BrandSymbol size={size} />
      <Text style={{ fontFamily: fonts.extrabold, fontSize: 17, letterSpacing: -0.5, color: colors.foreground }}>
        Coin<Text style={{ color: colors.primary }}>ciente</Text>
      </Text>
    </View>
  );
}
