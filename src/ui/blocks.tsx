import { type ReactNode, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { makeStyles, radius, type, useTheme } from "../theme";
import { IconChevronDown, IconChevronLeft, IconChevronRight } from "./icons";

/** Bloco de seção: ícone, título, contagem e apoio no topo, conteúdo logo abaixo. */
export function SectionCard({
  icon,
  title,
  count,
  hint,
  children,
}: {
  icon: (color: string) => ReactNode;
  title: string;
  count?: number;
  hint?: string;
  children: ReactNode;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.headIcon}>{icon(colors.primary)}</View>
        <View style={styles.headText}>
          <Text style={styles.title} accessibilityRole="header">
            {title}
            {count !== undefined ? <Text style={styles.count}>{`  ${count}`}</Text> : null}
          </Text>
          {hint ? <Text style={styles.hint}>{hint}</Text> : null}
        </View>
      </View>
      {children}
    </View>
  );
}

/** Bloco que abre e fecha: o cabeçalho inteiro é o botão, e o estado é dito em texto. */
export function CollapsibleCard({
  icon,
  title,
  count,
  hint,
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange,
  children,
}: {
  icon?: (color: string) => ReactNode;
  title: string;
  count?: number;
  hint?: string;
  defaultOpen?: boolean;
  /** Controlado pela tela (ex.: um atalho do resumo abre o bloco); sem isso, o bloco cuida do próprio estado. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [innerOpen, setInnerOpen] = useState(defaultOpen);
  const open = controlledOpen ?? innerOpen;
  const setOpen = (next: boolean) => {
    setInnerOpen(next);
    onOpenChange?.(next);
  };
  return (
    <View style={styles.card}>
      <Pressable
        onPress={() => setOpen(!open)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${title}${count !== undefined ? `, ${count}` : ""}. ${open ? "Recolher" : "Ver"}`}
        style={({ pressed }) => [styles.head, pressed && styles.pressed]}
      >
        {icon ? <View style={styles.headIcon}>{icon(colors.primary)}</View> : null}
        <View style={styles.headText}>
          <Text style={styles.title}>
            {title}
            {count !== undefined ? <Text style={styles.count}>{`  ${count}`}</Text> : null}
          </Text>
          {hint ? <Text style={styles.hint}>{hint}</Text> : null}
        </View>
        <View style={[styles.toggle, open && styles.toggleOpen]}>
          <IconChevronDown size={20} color={colors.bodyText} />
        </View>
      </Pressable>
      {open ? children : null}
    </View>
  );
}

/** Faixa de destaque: ícone, título, texto e uma ação. Sem gradiente: só borda e ícone no verde. */
export function Banner({
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
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.banner} accessible={false}>
      <View style={styles.bannerTop}>
        <View style={styles.bannerIcon}>{icon(colors.primary)}</View>
        <View style={styles.headText}>
          <Text style={styles.bannerTitle} accessibilityRole="header">
            {title}
          </Text>
          <Text style={styles.hint}>{text}</Text>
        </View>
      </View>
      {action}
    </View>
  );
}

/** Paginação: Anterior, "página X de Y" e Próxima. Some com uma página só. */
export function Pager({ page, pages, onChange, label }: { page: number; pages: number; onChange: (page: number) => void; label: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  if (pages <= 1) return null;
  const prev = page > 1;
  const next = page < pages;
  return (
    <View style={styles.pager} accessibilityLabel={label}>
      <Pressable
        onPress={() => onChange(page - 1)}
        disabled={!prev}
        accessibilityRole="button"
        accessibilityLabel="Página anterior"
        accessibilityState={{ disabled: !prev }}
        style={({ pressed }) => [styles.pagerButton, !prev && styles.disabled, pressed && styles.pressed]}
      >
        <IconChevronLeft size={18} color={colors.bodyText} />
        <Text style={styles.pagerLabel}>Anterior</Text>
      </Pressable>
      <Text style={styles.pagerStatus}>
        {page} de {pages}
      </Text>
      <Pressable
        onPress={() => onChange(page + 1)}
        disabled={!next}
        accessibilityRole="button"
        accessibilityLabel="Próxima página"
        accessibilityState={{ disabled: !next }}
        style={({ pressed }) => [styles.pagerButton, !next && styles.disabled, pressed && styles.pressed]}
      >
        <Text style={styles.pagerLabel}>Próxima</Text>
        <IconChevronRight size={18} color={colors.bodyText} />
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  card: { borderWidth: 1, borderColor: c.line, borderRadius: radius.panel, backgroundColor: c.surface, overflow: "hidden" },
  head: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56, paddingHorizontal: 16, paddingVertical: 12 },
  headIcon: { width: 28, alignItems: "center" },
  headText: { flex: 1, gap: 2 },
  title: { ...type.sectionTitle, color: c.foreground },
  count: { ...type.label, color: c.muted },
  hint: { ...type.bodySmall, color: c.muted },
  toggle: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: c.line, borderRadius: radius.pill },
  toggleOpen: { transform: [{ rotate: "180deg" }] },
  banner: {
    gap: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: `${c.primary}44`,
    borderRadius: radius.panel,
    backgroundColor: c.surface,
  },
  bannerTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  bannerIcon: { width: 44, height: 44, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: c.primaryTint },
  bannerTitle: { ...type.sectionTitle, color: c.foreground },
  pager: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: c.line },
  pagerButton: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 44, paddingHorizontal: 8 },
  pagerLabel: { ...type.label, color: c.bodyText },
  pagerStatus: { ...type.label, color: c.muted, fontVariant: ["tabular-nums"] },
  disabled: { opacity: 0.35 },
  pressed: { opacity: 0.7 },
}));
