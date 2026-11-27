import { Pressable, Text, View } from "react-native";
import { makeStyles, radius, type, useTheme } from "../theme";
import { CategoryBadge } from "./category-badge";
import { IconCheck, IconPause, IconPlus } from "./icons";

export type TileState = "on" | "missing" | "off";

/**
 * Um item da fileira de sugeridas: círculo da categoria, nome e um detalhe curto. O estado vai no
 * círculo (cheio, tracejado ou apagado), num selo e no texto do detalhe, nunca só na cor. Com
 * `onPress` vira botão; sem, é só leitura.
 */
export function CategoryTile({
  name,
  color,
  state,
  detail,
  mark,
  selected,
  disabled,
  onPress,
  accessibilityLabel,
}: {
  name: string;
  color: string | null;
  state: TileState;
  detail: string;
  mark?: "check" | "plus" | "pause";
  selected?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const body = (
    <>
      <View>
        <CategoryBadge name={name} color={state === "missing" ? null : color} size="large" state={state} />
        {mark ? (
          <View style={[styles.mark, mark === "check" ? styles.markOn : styles.markNeutral]}>
            {mark === "check" ? <IconCheck size={11} color={colors.onPrimary} /> : mark === "plus" ? <IconPlus size={11} color={colors.surface} /> : <IconPause size={10} color={colors.surface} />}
          </View>
        ) : null}
      </View>
      <Text style={styles.label} numberOfLines={2}>
        {name}
      </Text>
      <Text style={styles.detail} numberOfLines={1}>
        {detail}
      </Text>
    </>
  );
  if (!onPress) {
    return (
      <View style={styles.tile} accessible accessibilityLabel={accessibilityLabel ?? `${name}, ${detail.toLowerCase()}`}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? `${name}, ${detail.toLowerCase()}`}
      accessibilityState={{ selected: selected ?? false, disabled: disabled ?? false }}
      style={({ pressed }) => [styles.tile, selected && styles.selected, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  tile: { width: "25%", alignItems: "center", gap: 4, paddingVertical: 10, paddingHorizontal: 2, minHeight: 112, borderRadius: radius.control, borderWidth: 1, borderColor: "transparent" },
  selected: { borderColor: c.inputBorder, backgroundColor: c.surfaceSoft },
  label: { ...type.micro, color: c.foreground, textAlign: "center" },
  detail: { ...type.micro, fontFamily: "Manrope_500Medium", color: c.muted, textAlign: "center" },
  mark: { position: "absolute", right: -4, top: -4, width: 18, height: 18, borderRadius: radius.pill, borderWidth: 2, borderColor: c.surface, alignItems: "center", justifyContent: "center" },
  markOn: { backgroundColor: c.positive },
  markNeutral: { backgroundColor: c.foreground },
  pressed: { opacity: 0.88 },
}));
