import { useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { matchRange, normalizeDescription, simulate, type MatchOutcome } from "../lib/category-rules/evaluation";
import type { CategoryRule } from "../lib/category-rules/types";
import { makeStyles, radius, type, useTheme } from "../theme";
import { CategoryBadge } from "../ui/category-badge";
import { Button } from "../ui/controls";
import { ChoiceGroup } from "../ui/fields";
import { IconCheck, IconInfo, IconPlus } from "../ui/icons";
import { FormScreen } from "../ui/screens";
import { termSuggestions } from "./rule-presentation";
import { CATEGORY_FALLBACK, conditionValueLabel, FIELD_LABELS, type NamedOption, OPERATOR_LABELS } from "./rule-logic";

const OUTCOME_TEXT: Record<Exclude<MatchOutcome, "aplica">, string> = {
  perde: "também combina, mas vem depois na fila",
  inativa: "combinaria, mas está inativa",
  "categoria-arquivada": "combinaria, mas a categoria está arquivada",
};

/**
 * Simulador em tela cheia: digita uma descrição e vê, na hora, qual regra categorizaria um
 * lançamento novo, por quê e quem perdeu. Tudo no aparelho, com as regras já carregadas. A lógica
 * é a cópia testada de `evaluation.ts`; o servidor é quem decide de verdade.
 */
export function RuleSimulatorScreen({
  rules,
  categories,
  colors: categoryColorMap,
  accounts,
  positions,
  recent,
  onCancel,
  onCreateWith,
}: {
  /** Regras não removidas, na ordem do backend. */
  rules: CategoryRule[];
  categories: { id: string; name: string; status: "active" | "archived" }[];
  colors: ReadonlyMap<string, string>;
  accounts: NamedOption[] | null;
  /** Posição de cada regra na fila real de aplicação. */
  positions: ReadonlyMap<string, number>;
  /** Descrições recentes sem categoria (dados reais), para testar com um toque. */
  recent: string[];
  onCancel: () => void;
  onCreateWith: (term: string) => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"expense" | "income">("expense");

  const activeIds = useMemo(() => new Set(categories.filter((c) => c.status === "active").map((c) => c.id.toLowerCase())), [categories]);
  const shown = normalizeDescription(description);
  const result = useMemo(() => (shown ? simulate(rules, activeIds, { description: shown, type, accountId: null }) : null), [rules, activeIds, shown, type]);
  const usesAccounts = rules.some((rule) => rule.conditionField === "accountId");

  const categoryOf = (rule: CategoryRule) => {
    const found = categories.find((c) => c.id.toLowerCase() === rule.categoryId.toLowerCase());
    return { name: found?.name ?? CATEGORY_FALLBACK, color: found?.status === "active" ? (categoryColorMap.get(found.id) ?? null) : null };
  };
  const condition = (rule: CategoryRule) =>
    `${FIELD_LABELS[rule.conditionField].toLowerCase()} ${OPERATOR_LABELS[rule.conditionOperator]} ${conditionValueLabel(rule, accounts)}`;
  const order = (rule: CategoryRule) => (positions.get(rule.id) ? `nº ${positions.get(rule.id)}` : "fora da fila");

  const winner = result?.winner ?? null;
  const others = result?.matches.filter((match) => match.outcome !== "aplica") ?? [];
  const range = winner && shown ? matchRange(shown, winner) : null;
  const terms = shown && !winner ? termSuggestions(shown) : [];

  return (
    <FormScreen
      title="Testar uma descrição"
      description="Veja qual regra categorizaria um lançamento novo, e por quê. É uma simulação: quem categoriza de verdade é o servidor."
      onCancel={onCancel}
      footer={<Button label="Voltar às regras" variant="secondary" onPress={onCancel} />}
    >
      <View style={styles.block}>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Ex.: UBER *TRIP, Drogasil 123, Netflix.com"
          placeholderTextColor={colors.muted}
          accessibilityLabel="Descrição do lançamento"
          autoCorrect={false}
          autoCapitalize="none"
          maxLength={200}
          style={styles.input}
        />
        <ChoiceGroup
          label="Tipo do lançamento"
          options={[
            { value: "expense", label: "Despesa" },
            { value: "income", label: "Receita" },
          ]}
          selected={type}
          onSelect={setType}
        />
        {usesAccounts ? <Text style={styles.note}>Regras por conta não entram nesta simulação.</Text> : null}
      </View>

      {recent.length > 0 ? (
        <View style={styles.block}>
          <Text style={styles.label}>Recentes sem categoria</Text>
          <View style={styles.chips}>
            {recent.map((item) => (
              <Pressable key={item} onPress={() => setDescription(item)} accessibilityRole="button" accessibilityLabel={`Testar ${item}`} style={({ pressed }) => [styles.chip, pressed && styles.pressed]}>
                <Text style={styles.chipLabel} numberOfLines={1}>
                  {item}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.result} accessibilityLiveRegion="polite">
        {!shown ? (
          <Text style={styles.idle}>Digite como a descrição aparece no extrato. O resultado aparece aqui, com a regra que decidiria e as que ficariam para trás.</Text>
        ) : winner ? (
          <>
            <View style={styles.verdict}>
              <IconCheck size={20} color={colors.positive} />
              <Text style={styles.verdictText}>Seria categorizado como</Text>
            </View>
            <View style={styles.verdictCategory}>
              <CategoryBadge name={categoryOf(winner).name} color={categoryOf(winner).color} />
              <Text style={styles.verdictName}>{categoryOf(winner).name}</Text>
            </View>
            <Text style={styles.why}>
              Pela regra {order(winner)}: se {condition(winner)} (prioridade {winner.priority}).
            </Text>
            {range ? (
              <Text style={styles.sample}>
                {shown.slice(0, range[0])}
                <Text style={styles.mark}>{shown.slice(range[0], range[1])}</Text>
                {shown.slice(range[1])}
              </Text>
            ) : null}
          </>
        ) : (
          <>
            <View style={styles.verdict}>
              <IconInfo size={20} color={colors.muted} />
              <Text style={styles.verdictText}>Ficaria sem categoria: nenhuma regra ativa combina.</Text>
            </View>
            {terms.length > 0 ? (
              <View style={styles.block}>
                <Text style={styles.label}>Criar regra “descrição contém”</Text>
                <View style={styles.chips}>
                  {terms.map((term) => (
                    <Pressable key={term} onPress={() => onCreateWith(term)} accessibilityRole="button" accessibilityLabel={`Criar regra descrição contém ${term}`} style={({ pressed }) => [styles.chip, styles.chipAction, pressed && styles.pressed]}>
                      <IconPlus size={14} color={colors.primary} />
                      <Text style={[styles.chipLabel, { color: colors.primary }]}>{term}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}
          </>
        )}

        {others.map(({ rule, outcome }) => (
          <Text key={rule.id} style={styles.other}>
            {order(rule)} · se {condition(rule)} → {categoryOf(rule).name}: {OUTCOME_TEXT[outcome as Exclude<MatchOutcome, "aplica">]}.
          </Text>
        ))}
      </View>
    </FormScreen>
  );
}

const useStyles = makeStyles((c) => ({
  block: { gap: 10 },
  label: { ...type.label, color: c.foreground },
  note: { ...type.micro, color: c.muted },
  input: { ...type.body, minHeight: 52, paddingHorizontal: 14, borderWidth: 1, borderColor: c.inputBorder, borderRadius: radius.control, backgroundColor: c.surface, color: c.foreground },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, maxWidth: "100%", minHeight: 40, paddingHorizontal: 14, borderWidth: 1, borderColor: c.line, borderRadius: radius.pill, backgroundColor: c.surface },
  chipAction: { borderStyle: "dashed", borderColor: c.primary },
  chipLabel: { ...type.label, color: c.bodyText, flexShrink: 1 },
  result: { gap: 10, padding: 16, borderRadius: radius.panel, backgroundColor: c.surfaceSoft, minHeight: 88 },
  idle: { ...type.bodySmall, color: c.muted },
  verdict: { flexDirection: "row", alignItems: "center", gap: 8 },
  verdictText: { ...type.body, fontFamily: "Manrope_700Bold", color: c.foreground, flexShrink: 1 },
  verdictCategory: { flexDirection: "row", alignItems: "center", gap: 10 },
  verdictName: { ...type.sectionTitle, color: c.foreground },
  why: { ...type.bodySmall, color: c.bodyText },
  sample: { ...type.bodySmall, color: c.muted },
  mark: { fontFamily: "Manrope_800ExtraBold", color: c.foreground, backgroundColor: `${c.positive}33` },
  other: { ...type.micro, fontFamily: "Manrope_500Medium", color: c.muted },
  pressed: { opacity: 0.88 },
}));
