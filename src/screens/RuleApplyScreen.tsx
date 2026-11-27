import { useRef, useState } from "react";
import { Text, View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { applyCategoryRule } from "../lib/category-rules/api";
import type { CategoryRule } from "../lib/category-rules/types";
import { makeStyles, radius, type } from "../theme";
import { Button, Notice } from "../ui/controls";
import { ChoiceGroup, Field } from "../ui/fields";
import { FormScreen } from "../ui/screens";
import { type ApplyPresetValue, APPLY_PRESETS, applicationMessage, classifyApplyError, DEFAULT_APPLY_PRESET, presetPeriod } from "./rule-apply-logic";
import { type NamedOption, ruleCondition } from "./rule-logic";

interface Props {
  rule: CategoryRule;
  categoryName: string;
  accounts: NamedOption[];
  /** Fecha sem aplicar, ou depois de aplicar: a lista recarrega. */
  onClose: (changed: boolean) => void;
  /** Regra ou categoria indisponível: volta para a lista, que recarrega. */
  onStale: (message: string) => void;
  /** Texto de abertura (ex.: depois de criar a regra). */
  intro?: string;
}

/**
 * Aplica uma regra às movimentações já registradas, nos últimos meses. Só mexe no que está sem
 * classificação: categoria que a pessoa ou outra regra já definiu nunca é trocada.
 */
export function RuleApplyScreen({ rule, categoryName, accounts, onClose, onStale, intro }: Props) {
  const { handleUnauthorized } = useAuth();
  const styles = useStyles();
  const [preset, setPreset] = useState<ApplyPresetValue>(DEFAULT_APPLY_PRESET);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ message: string; categorized: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const condition = ruleCondition(rule, accounts);

  async function submit() {
    if (inFlight.current) return;
    inFlight.current = true;
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const months = APPLY_PRESETS.find((option) => option.value === preset)?.months ?? 3;
      const response = await applyCategoryRule(rule.id, presetPeriod(months));
      setResult({ message: applicationMessage(response), categorized: response.categorized });
    } catch (failure) {
      const classified = classifyApplyError(failure);
      if (classified.kind === "unauthorized") await handleUnauthorized();
      else if (classified.kind === "stale") onStale(classified.message);
      else setError(classified.message);
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  const applied = result !== null;

  return (
    <FormScreen
      title="Aplicar às movimentações"
      description={intro ?? "Escolha os meses em que esta regra deve categorizar o que ainda não tem categoria."}
      onCancel={() => onClose(applied && result.categorized > 0)}
      cancelDisabled={submitting}
      footer={
        applied ? (
          <Button label="Concluir" onPress={() => onClose(result.categorized > 0)} />
        ) : (
          <>
            <Button label="Aplicar às movimentações" onPress={() => void submit()} loading={submitting} />
            <Button variant="text" label="Agora não" onPress={() => onClose(false)} disabled={submitting} />
          </>
        )
      }
    >
      <View style={styles.rule} accessibilityLabel={`Regra: ${condition}, categoria ${categoryName}`}>
        <Text style={styles.ruleLabel}>Regra</Text>
        <Text style={styles.ruleText}>
          {condition} → {categoryName}
        </Text>
      </View>

      <Field label="Período">
        <ChoiceGroup label="Período" options={APPLY_PRESETS.map(({ value, label }) => ({ value, label }))} selected={preset} onSelect={setPreset} disabled={submitting || applied} />
      </Field>
      <Text style={styles.help}>Só as movimentações sem classificação desses meses entram. As que já têm categoria não mudam.</Text>

      {result ? <Notice tone={result.categorized > 0 ? "success" : "info"} text={result.message} /> : null}
      {error ? <Notice tone="error" text={error} /> : null}
    </FormScreen>
  );
}

const useStyles = makeStyles((c) => ({
  rule: {
    gap: 2,
    padding: 14,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surfaceSoft,
  },
  ruleLabel: { ...type.micro, color: c.muted },
  ruleText: { ...type.bodySmall, fontFamily: "Manrope_700Bold", color: c.foreground },
  help: { ...type.micro, fontFamily: "Manrope_500Medium", color: c.muted },
}));
