import { type ReactNode, useEffect } from "react";
import {
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../auth/AuthContext";
import { makeStyles, radius, type, useTheme } from "../theme";
import { BrandLockup } from "./brand";
import {
  IconAccounts,
  IconCategories,
  IconClose,
  IconMovements,
  IconRules,
  IconSignOut,
} from "./icons";

export type Section = "movimentacoes" | "contas" | "categorias" | "regras";

const TABS = [
  { section: "movimentacoes", label: "Movimentações", Icon: IconMovements },
  { section: "contas", label: "Contas", Icon: IconAccounts },
  { section: "categorias", label: "Categorias", Icon: IconCategories },
  { section: "regras", label: "Regras", Icon: IconRules },
] as const;

/**
 * Moldura das seções: cabeçalho com a marca, título da tela, conteúdo e abas embaixo
 * (seções, nunca ações). Áreas seguras respeitadas no topo e no rodapé.
 */
export function AppScreen({
  section,
  onNavigate,
  title,
  subtitle,
  children,
  footer,
}: {
  section: Section;
  onNavigate: (section: Section) => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Ação principal fixa acima das abas. */
  footer?: ReactNode;
}) {
  const styles = useAppStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <BrandLockup />
        <Pressable
          onPress={() => void signOut()}
          accessibilityRole="button"
          accessibilityLabel="Sair da conta"
          hitSlop={8}
          style={({ pressed }) => [styles.signOut, pressed && styles.pressed]}
        >
          <IconSignOut size={18} color={colors.muted} />
          <Text style={styles.signOutLabel}>Sair</Text>
        </Pressable>
      </View>

      <View style={styles.titleBlock}>
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>

      <View style={styles.content}>{children}</View>

      {footer ? <View style={styles.footer}>{footer}</View> : null}

      <View
        style={[styles.tabs, { paddingBottom: Math.max(insets.bottom, 8) }]}
        accessibilityRole="tablist"
      >
        {TABS.map(({ section: target, label, Icon }) => {
          const selected = target === section;
          const color = selected ? colors.primary : colors.muted;
          return (
            <Pressable
              key={target}
              onPress={() => onNavigate(target)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={label}
              style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
            >
              <View style={[styles.tabIcon, selected && styles.tabIconSelected]}>
                <Icon size={22} color={color} />
              </View>
              <Text
                style={[styles.tabLabel, { color }, selected && styles.tabLabelSelected]}
                numberOfLines={1}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const useAppStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  signOut: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44, paddingHorizontal: 4 },
  signOutLabel: { ...type.label, color: c.muted },
  titleBlock: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, gap: 2 },
  title: { ...type.pageTitle, color: c.foreground },
  subtitle: { ...type.bodySmall, color: c.muted },
  content: { flex: 1 },
  footer: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 10, gap: 8 },
  tabs: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: c.line,
    backgroundColor: c.surface,
    paddingTop: 6,
  },
  tab: { flex: 1, alignItems: "center", gap: 2, minHeight: 52, justifyContent: "center" },
  tabIcon: {
    width: 56,
    height: 30,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  tabIconSelected: { backgroundColor: c.primaryTint },
  tabLabel: { ...type.micro, fontFamily: "Manrope_600SemiBold" },
  tabLabelSelected: { fontFamily: "Manrope_700Bold" },
  pressed: { opacity: 0.7 },
}));

/**
 * Formulário em tela cheia: "Cancelar" no topo, conteúdo rolável e ação principal
 * fixa no rodapé, acima do teclado. O Voltar do Android equivale a Cancelar.
 */
export function FormScreen({
  title,
  description,
  onCancel,
  cancelDisabled,
  children,
  footer,
}: {
  title: string;
  description?: string;
  onCancel: () => void;
  cancelDisabled?: boolean;
  children: ReactNode;
  footer: ReactNode;
}) {
  const styles = useFormStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!cancelDisabled) onCancel();
      return true;
    });
    return () => subscription.remove();
  }, [onCancel, cancelDisabled]);

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { paddingTop: insets.top }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.bar}>
        <Pressable
          onPress={onCancel}
          disabled={cancelDisabled}
          accessibilityRole="button"
          accessibilityLabel="Cancelar e voltar"
          hitSlop={8}
          style={({ pressed }) => [styles.close, pressed && styles.pressed]}
        >
          <IconClose size={22} color={colors.foreground} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.titleBlock}>
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          {description ? <Text style={styles.description}>{description}</Text> : null}
        </View>
        {children}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>{footer}</View>
    </KeyboardAvoidingView>
  );
}

const useFormStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.background },
  bar: { flexDirection: "row", paddingHorizontal: 12, paddingVertical: 4 },
  close: { width: 48, height: 48, alignItems: "center", justifyContent: "center", borderRadius: radius.control },
  content: { paddingHorizontal: 20, paddingBottom: 24, gap: 20 },
  titleBlock: { gap: 6 },
  title: { ...type.pageTitle, color: c.foreground },
  description: { ...type.bodySmall, color: c.muted },
  footer: {
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: c.line,
    backgroundColor: c.surface,
  },
  pressed: { opacity: 0.7 },
}));

/** Estilos de lista agrupada: um painel com divisórias, pontas arredondadas. */
export const useListStyles = makeStyles((c) => ({
  list: { paddingHorizontal: 20, paddingBottom: 24, flexGrow: 1 },
  item: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: c.line,
    backgroundColor: c.surface,
  },
  itemFirst: {
    borderTopWidth: 1,
    borderTopLeftRadius: radius.panel,
    borderTopRightRadius: radius.panel,
  },
  itemLast: {
    borderBottomLeftRadius: radius.panel,
    borderBottomRightRadius: radius.panel,
  },
  notices: { paddingHorizontal: 20, paddingBottom: 12, gap: 8 },
}));
