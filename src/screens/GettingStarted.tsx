import { Pressable, Text, View } from "react-native";
import { makeStyles, radius, type, useTheme } from "../theme";
import { Button } from "../ui/controls";
import { IconArrowRight, IconCheck } from "../ui/icons";
import { currentStepIndex, type OnboardingState, type OnboardingTarget, onboardingSteps } from "./getting-started-logic";

/**
 * Primeiros passos: aparece só enquanto falta algum passo essencial e mostra qual é o próximo.
 * Some sozinho quando tudo foi feito. O botão fica só no passo atual.
 */
export function GettingStarted({
  state,
  onAction,
  onGoToRules,
  /** Registrar fica indisponível se as contas não carregaram ou não existem. */
  canRegister,
}: {
  state: OnboardingState;
  onAction: (target: OnboardingTarget) => void;
  onGoToRules: () => void;
  canRegister: boolean;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const steps = onboardingSteps(state);
  const current = currentStepIndex(steps);
  const doneCount = steps.filter((step) => step.done).length;

  return (
    <View style={styles.card} accessibilityLabel={`Primeiros passos, ${doneCount} de ${steps.length} concluídos`}>
      <View style={styles.head}>
        <Text style={styles.title} accessibilityRole="header">
          Primeiros passos
        </Text>
        <Text style={styles.progress}>
          {doneCount} de {steps.length} concluídos
        </Text>
      </View>

      {steps.map((step, index) => {
        const status = step.done ? "done" : index === current ? "current" : "next";
        return (
          <View
            key={step.key}
            style={[styles.step, index > 0 && styles.stepDivider]}
            accessible
            accessibilityLabel={`${step.title}${status === "done" ? ", concluído" : status === "current" ? ", próximo passo" : ""}. ${step.text}`}
          >
            <View style={[styles.marker, status === "done" && styles.markerDone, status === "current" && styles.markerCurrent]}>
              {status === "done" ? <IconCheck size={16} color={colors.onPrimary} /> : <Text style={[styles.markerText, status === "current" && styles.markerTextCurrent]}>{index + 1}</Text>}
            </View>
            <View style={styles.body}>
              <Text style={[styles.stepTitle, status === "next" && styles.stepTitleNext]}>{step.title}</Text>
              <Text style={styles.stepText}>{step.text}</Text>
              {status === "current" ? (
                <Button
                  label={step.action.label}
                  onPress={() => onAction(step.action.target)}
                  disabled={step.action.target === "registrar-movimentacao" && !canRegister}
                  icon={(color) => <IconArrowRight size={18} color={color} />}
                />
              ) : null}
            </View>
          </View>
        );
      })}

      <Pressable onPress={onGoToRules} accessibilityRole="link" accessibilityLabel="Depois, criar regras pessoais" style={({ pressed }) => [styles.hint, pressed && styles.pressed]}>
        <Text style={styles.hintText}>
          Depois, crie <Text style={styles.hintLink}>regras pessoais</Text> para categorizar automaticamente as próximas movimentações.
        </Text>
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  card: { borderWidth: 1, borderColor: c.line, borderRadius: radius.panel, backgroundColor: c.surface, overflow: "hidden" },
  head: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },
  title: { ...type.sectionTitle, color: c.foreground },
  progress: { ...type.micro, color: c.muted },
  step: { flexDirection: "row", gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  stepDivider: { borderTopWidth: 1, borderTopColor: c.line },
  marker: { width: 28, height: 28, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: c.inputBorder },
  markerDone: { backgroundColor: c.positive, borderColor: c.positive },
  markerCurrent: { borderColor: c.primary },
  markerText: { ...type.micro, color: c.muted },
  markerTextCurrent: { color: c.primary },
  body: { flex: 1, gap: 6 },
  stepTitle: { ...type.body, fontFamily: "Manrope_700Bold", color: c.foreground },
  stepTitleNext: { color: c.muted },
  stepText: { ...type.bodySmall, color: c.muted },
  hint: { minHeight: 48, justifyContent: "center", paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: c.line, backgroundColor: c.surfaceSoft },
  hintText: { ...type.bodySmall, color: c.bodyText },
  hintLink: { color: c.primary, fontFamily: "Manrope_700Bold" },
  pressed: { opacity: 0.88 },
}));
