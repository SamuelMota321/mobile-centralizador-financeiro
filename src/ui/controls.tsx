import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { makeStyles, radius, type, useTheme, type ThemeColors } from "../theme";
import { IconAlert, IconCheck, IconInfo } from "./icons";

// ---------- Botao ----------

type ButtonVariant = "primary" | "secondary" | "danger" | "text" | "textDanger";

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  /** Texto para leitores de tela quando o rotulo visivel precisa de contexto. */
  accessibilityLabel?: string;
  icon?: (color: string) => ReactNode;
  compact?: boolean;
}

export function Button({
  label,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
  accessibilityLabel,
  icon,
  compact = false,
}: ButtonProps) {
  const styles = useButtonStyles();
  const { colors } = useTheme();
  const foreground = buttonForeground(variant, colors);
  const inactive = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      hitSlop={variant === "text" || variant === "textDanger" ? 10 : undefined}
      style={({ pressed }) => [
        styles.base,
        compact && styles.compact,
        styles[variant],
        pressed && !inactive && styles.pressed,
        pressed && !inactive && variant === "primary" && styles.primaryPressed,
        inactive && styles.inactive,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={foreground} />
      ) : (
        <View style={styles.content}>
          {icon ? icon(foreground) : null}
          <Text style={[styles.label, { color: foreground }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

function buttonForeground(variant: ButtonVariant, colors: ThemeColors): string {
  switch (variant) {
    case "primary":
    case "danger":
      return colors.onPrimary;
    case "secondary":
      return colors.foreground;
    case "text":
      return colors.primary;
    case "textDanger":
      return colors.negative;
  }
}

const useButtonStyles = makeStyles((c) => ({
  base: {
    minHeight: 48,
    paddingHorizontal: 18,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  compact: { minHeight: 40, paddingHorizontal: 14 },
  content: { flexDirection: "row", alignItems: "center", gap: 8 },
  label: { ...type.label, fontSize: 15, lineHeight: 20, fontFamily: "Manrope_700Bold" },
  primary: { backgroundColor: c.primary },
  primaryPressed: { backgroundColor: c.primaryPressed },
  secondary: { backgroundColor: c.surface, borderColor: c.line },
  danger: { backgroundColor: c.negative },
  text: { minHeight: 44, paddingHorizontal: 4, backgroundColor: "transparent" },
  textDanger: { minHeight: 44, paddingHorizontal: 4, backgroundColor: "transparent" },
  pressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },
  inactive: { opacity: 0.55 },
}));

// ---------- Aviso ----------

export type NoticeTone = "success" | "info" | "warning" | "error";

export function Notice({
  tone,
  text,
  action,
}: {
  tone: NoticeTone;
  text: string;
  action?: { label: string; onPress: () => void };
}) {
  const styles = useNoticeStyles();
  const { colors } = useTheme();
  const accent = {
    success: colors.positive,
    info: colors.info,
    warning: colors.warning,
    error: colors.negative,
  }[tone];
  const Icon = tone === "success" ? IconCheck : tone === "info" ? IconInfo : IconAlert;

  return (
    <View
      style={[styles.notice, { borderColor: tone === "info" ? colors.line : accent }]}
      accessibilityLiveRegion={tone === "error" ? "assertive" : "polite"}
      accessibilityRole={tone === "error" ? "alert" : undefined}
    >
      <Icon size={20} color={accent} />
      <View style={styles.body}>
        <Text style={styles.text}>{text}</Text>
        {action ? (
          <Pressable onPress={action.onPress} accessibilityRole="button" hitSlop={10}>
            <Text style={styles.action}>{action.label}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const useNoticeStyles = makeStyles((c) => ({
  notice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 14,
    borderWidth: 1,
    borderRadius: radius.control,
    backgroundColor: c.surface,
  },
  body: { flex: 1, gap: 6 },
  text: { ...type.bodySmall, color: c.foreground },
  action: { ...type.label, color: c.primary, textDecorationLine: "underline" },
}));

// ---------- Etiqueta de status ----------

export type ChipTone = "positive" | "warning" | "info" | "neutral";

/** Ponto colorido + texto: a cor nunca aparece sozinha. */
export function StatusChip({ tone, label }: { tone: ChipTone; label: string }) {
  const styles = useChipStyles();
  const { colors } = useTheme();
  const dot = {
    positive: colors.positive,
    warning: colors.warning,
    info: colors.info,
    neutral: colors.muted,
  }[tone];

  return (
    <View style={styles.chip}>
      <View style={[styles.dot, { backgroundColor: dot }]} />
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const useChipStyles = makeStyles((c) => ({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    maxWidth: "100%",
    gap: 6,
    paddingVertical: 3,
    paddingLeft: 8,
    paddingRight: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  label: { ...type.micro, color: c.bodyText, flexShrink: 1 },
}));

// ---------- Estado vazio ----------

export function EmptyState({
  icon,
  title,
  text,
  action,
}: {
  icon: (color: string) => ReactNode;
  title: string;
  text: string;
  action?: ReactNode;
}) {
  const styles = useEmptyStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.empty}>
      <View style={styles.icon}>{icon(colors.primary)}</View>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      <Text style={styles.text}>{text}</Text>
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const useEmptyStyles = makeStyles((c) => ({
  empty: {
    alignItems: "center",
    gap: 10,
    paddingVertical: 36,
    paddingHorizontal: 20,
    borderRadius: radius.panel,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: c.inputBorder,
    backgroundColor: c.surface,
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: radius.panel,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.primaryTint,
  },
  title: { ...type.sectionTitle, color: c.foreground, textAlign: "center" },
  text: { ...type.bodySmall, color: c.muted, textAlign: "center", maxWidth: 320 },
  action: { marginTop: 6, alignSelf: "stretch" },
}));

// ---------- Esqueleto ----------

/** Linhas com a forma da lista durante o carregamento; nunca um spinner no meio da tela. */
export function SkeletonList({ rows = 5 }: { rows?: number }) {
  const styles = useSkeletonStyles();
  return (
    <View style={styles.group} accessibilityLabel="Carregando" accessible>
      {Array.from({ length: rows }, (_, index) => (
        <View key={index} style={[styles.row, index > 0 && styles.divider]}>
          <View style={styles.square} />
          <View style={styles.lines}>
            <View style={[styles.line, { width: `${70 - index * 6}%` }]} />
            <View style={[styles.line, styles.lineShort]} />
          </View>
          <View style={[styles.line, styles.amount]} />
        </View>
      ))}
    </View>
  );
}

const useSkeletonStyles = makeStyles((c) => ({
  group: {
    borderRadius: radius.panel,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  divider: { borderTopWidth: 1, borderTopColor: c.line },
  square: { width: 32, height: 32, borderRadius: radius.control, backgroundColor: c.surfaceSoft },
  lines: { flex: 1, gap: 8 },
  line: { height: 11, borderRadius: 6, backgroundColor: c.line },
  lineShort: { width: "40%", height: 9 },
  amount: { width: 64 },
}));
