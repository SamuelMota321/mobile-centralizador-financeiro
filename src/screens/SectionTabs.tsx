import { Pressable, StyleSheet, Text, View } from "react-native";
import { theme } from "../theme";

export type Section = "contas" | "movimentacoes" | "categorias";

const SECTIONS: { section: Section; label: string }[] = [
  { section: "contas", label: "Contas" },
  { section: "movimentacoes", label: "Movimentacoes" },
  { section: "categorias", label: "Categorias" },
];

/** Navegacao entre as areas autenticadas, sem biblioteca de navegacao (decisao da Fase 1). */
export function SectionTabs({
  current,
  onNavigate,
}: {
  current: Section;
  onNavigate: (section: Section) => void;
}) {
  return (
    <View style={styles.tabs} accessibilityRole="tablist">
      {SECTIONS.map(({ section, label }) => {
        const selected = section === current;
        return (
          <Pressable
            key={section}
            style={[styles.tab, selected && styles.tabSelected]}
            onPress={() => onNavigate(section)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
          >
            <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: 20,
    marginBottom: 16,
  },
  tab: {
    minHeight: 44,
    justifyContent: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabSelected: {
    borderBottomColor: theme.consciencia,
  },
  label: {
    fontWeight: "600",
    color: theme.muted,
  },
  labelSelected: {
    color: theme.confianca,
  },
});
