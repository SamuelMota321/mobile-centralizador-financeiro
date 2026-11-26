import { type ReactNode, useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { CategoryRule } from "../lib/category-rules/types";
import { RULE_PACK, rulePackSize, type SuggestedRuleGroup } from "../lib/categories/suggestions";
import { makeStyles, radius, type } from "../theme";
import { Button } from "../ui/controls";

/**
 * Regras sugeridas num único grupo recolhido, para não poluir a lista. Dentro: o botão que
 * adiciona as que faltam e as já adicionadas, por categoria, com as mesmas ações das demais.
 */
export function RulePackSection({
  canApply,
  applying,
  onApply,
  onGoToCategories,
  groups,
  count,
  missing,
  missingCategories,
  renderRule,
}: {
  missingCategories: readonly string[];
  canApply: boolean;
  applying: boolean;
  onApply: () => void;
  onGoToCategories: () => void;
  groups: SuggestedRuleGroup<CategoryRule>[];
  count: number;
  missing: number;
  renderRule: (rule: CategoryRule, first: boolean, last: boolean) => ReactNode;
}) {
  const styles = useStyles();
  const [open, setOpen] = useState(false);
  const [openCategory, setOpenCategory] = useState<string | null>(null);

  return (
    <View style={styles.box}>
      <Disclosure label={`Regras sugeridas · ${count} de ${rulePackSize()}`} open={open} onToggle={() => setOpen(!open)} strong />
      {open ? (
        <View style={styles.body}>
          <Text style={styles.text}>
            Regras do tipo “a descrição contém” para termos comuns. Funcionam como as suas: valem para as próximas
            movimentações e cada uma pode ser editada, desativada ou removida.
          </Text>
          {canApply && missing > 0 ? (
            <Button
              label={missing === 1 ? "Adicionar a regra que falta" : `Adicionar as ${missing} regras que faltam`}
              variant="secondary"
              onPress={onApply}
              loading={applying}
            />
          ) : null}
          {!canApply ? <Button label="Criar as categorias primeiro" variant="text" onPress={onGoToCategories} /> : null}
          {canApply && missingCategories.length > 0 ? (
            <>
              <Text style={styles.text}>
                {`As regras de ${missingCategories.join(", ")} dependem de categorias que você ainda não tem.`}
              </Text>
              <Button label="Adicionar categorias sugeridas" variant="text" onPress={onGoToCategories} />
            </>
          ) : null}

          {groups.length > 0
            ? groups.map((group) => {
                const expanded = openCategory === group.category;
                return (
                  <View key={group.category} style={styles.group}>
                    <Disclosure
                      label={`${group.category} (${group.rules.length})`}
                      open={expanded}
                      onToggle={() => setOpenCategory(expanded ? null : group.category)}
                    />
                    {expanded ? (
                      <View>{group.rules.map((rule, index) => <View key={rule.id}>{renderRule(rule, index === 0, index === group.rules.length - 1)}</View>)}</View>
                    ) : null}
                  </View>
                );
              })
            : RULE_PACK.map((group) => (
                // Nada adicionado ainda: mostra o que o pacote cria, por categoria.
                <View key={group.category} style={styles.preview}>
                  <Text style={styles.category}>{group.category}</Text>
                  <Text style={styles.values}>{group.values.map((value) => `“${value}”`).join(", ")}</Text>
                </View>
              ))}
        </View>
      ) : null}
    </View>
  );
}

function Disclosure({ label, open, onToggle, strong }: { label: string; open: boolean; onToggle: () => void; strong?: boolean }) {
  const styles = useStyles();
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      style={({ pressed }) => [styles.summary, !strong && styles.summarySoft, pressed && styles.pressed]}
    >
      <Text style={styles.title}>{label}</Text>
      <Text style={styles.mark}>{open ? "−" : "+"}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  box: { borderWidth: 1, borderColor: c.line, borderRadius: radius.panel, backgroundColor: c.surface },
  summary: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingHorizontal: 14 },
  summarySoft: { minHeight: 44, borderWidth: 1, borderColor: c.line, borderRadius: radius.control, backgroundColor: c.surfaceSoft },
  title: { ...type.label, color: c.foreground, flexShrink: 1 },
  mark: { fontSize: 20, lineHeight: 22, color: c.bodyText, fontFamily: "Manrope_700Bold" },
  body: { gap: 10, paddingHorizontal: 14, paddingBottom: 14 },
  text: { ...type.bodySmall, color: c.muted },
  group: { gap: 8 },
  preview: { gap: 2 },
  category: { ...type.label, color: c.foreground },
  values: { ...type.micro, color: c.muted },
  pressed: { opacity: 0.88 },
}));
