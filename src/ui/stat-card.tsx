import type { ReactNode } from "react";
import { Text, useWindowDimensions, View } from "react-native";
import { makeStyles, radius, type, useTheme } from "../theme";

/**
 * Card de resumo do topo das telas. Só recebe contagens da própria lista ou valores
 * calculados de dados completos: nunca número parcial. A barra e o minigráfico são reforço
 * visual; o texto diz o mesmo. Nada anima.
 */
export function StatCard({
  icon,
  label,
  value,
  meta,
  share,
  trend,
  tone,
}: {
  icon?: (color: string) => ReactNode;
  label: string;
  value: string;
  meta?: string;
  /** Parte do total, de 0 a 1. */
  share?: number;
  /** Minigráfico decorativo; some em telas estreitas para não cortar o valor. */
  trend?: (color: string) => ReactNode;
  tone?: "positive" | "negative";
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const accent = tone === "positive" ? colors.positive : tone === "negative" ? colors.negative : colors.primary;
  return (
    <View
      style={styles.card}
      accessible
      accessibilityLabel={[label, value, meta].filter(Boolean).join(", ")}
    >
      <View style={styles.top}>
        {icon ? <View style={[styles.icon, { backgroundColor: colors.primaryTint }]}>{icon(accent)}</View> : null}
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <View style={styles.valueRow}>
        <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </Text>
        {trend && width >= 360 ? <View style={styles.trend}>{trend(accent)}</View> : null}
      </View>
      {meta ? <Text style={styles.meta}>{meta}</Text> : null}
      {share !== undefined ? (
        <View style={styles.meter}>
          <View style={[styles.meterFill, { width: `${Math.min(Math.max(share, 0), 1) * 100}%` }]} />
        </View>
      ) : null}
    </View>
  );
}

/** Cards em linhas de dois; o último ocupa a linha inteira quando sobra sozinho. */
export function StatGrid({ children }: { children: ReactNode }) {
  const styles = useStyles();
  return <View style={styles.grid}>{children}</View>;
}

const useStyles = makeStyles((c) => ({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  card: {
    flexGrow: 1,
    flexBasis: "45%",
    minWidth: 150,
    gap: 6,
    padding: 14,
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: radius.panel,
    backgroundColor: c.surface,
  },
  top: { flexDirection: "row", alignItems: "center", gap: 8 },
  icon: { width: 30, height: 30, borderRadius: radius.control, alignItems: "center", justifyContent: "center" },
  label: { ...type.micro, color: c.muted, flexShrink: 1 },
  valueRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 8 },
  value: { ...type.amount, fontSize: 20, lineHeight: 26, color: c.foreground, flexShrink: 1 },
  trend: { flexShrink: 0 },
  meta: { ...type.micro, color: c.muted },
  meter: { height: 4, borderRadius: radius.pill, backgroundColor: c.surfaceSoft, overflow: "hidden" },
  meterFill: { height: "100%", borderRadius: radius.pill, backgroundColor: c.primary },
}));
