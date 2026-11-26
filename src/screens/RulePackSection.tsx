import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { RULE_PACK, rulePackSize } from "../lib/categories/suggestions";
import { makeStyles, radius, type } from "../theme";
import { Button } from "../ui/controls";

/**
 * Pacote de regras sugeridas: recolhido para não poluir a lista. Aberto, mostra cada regra
 * que seria criada; nada é criado sem o botão.
 */
export function RulePackSection({
  canApply,
  applying,
  onApply,
  onGoToCategories,
}: {
  canApply: boolean;
  applying: boolean;
  onApply: () => void;
  onGoToCategories: () => void;
}) {
  const styles = useStyles();
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.box}>
      <Pressable
        onPress={() => setOpen(!open)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityHint="Mostra as regras que seriam criadas"
        style={({ pressed }) => [styles.summary, pressed && styles.pressed]}
      >
        <Text style={styles.title}>{`Pacote de regras sugeridas · ${rulePackSize()} regras`}</Text>
        <Text style={styles.mark}>{open ? "−" : "+"}</Text>
      </Pressable>
      {open ? (
        <View style={styles.body}>
          <Text style={styles.text}>
            Regras do tipo “a descrição contém” para termos comuns. Só são criadas as que faltam e só para categorias ativas
            com o mesmo nome. Valem para as próximas movimentações.
          </Text>
          {RULE_PACK.map((group) => (
            <View key={group.category} style={styles.group}>
              <Text style={styles.category}>{group.category}</Text>
              <Text style={styles.values}>{group.values.map((value) => `“${value}”`).join(", ")}</Text>
            </View>
          ))}
          {canApply ? (
            <Button label="Adicionar as regras que faltam" variant="secondary" onPress={onApply} loading={applying} />
          ) : (
            <Button label="Criar as categorias primeiro" variant="text" onPress={onGoToCategories} />
          )}
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  box: { borderWidth: 1, borderColor: c.line, borderRadius: radius.panel, backgroundColor: c.surface },
  summary: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingHorizontal: 14 },
  title: { ...type.label, color: c.foreground, flexShrink: 1 },
  mark: { fontSize: 20, lineHeight: 22, color: c.bodyText, fontFamily: "Manrope_700Bold" },
  body: { gap: 10, paddingHorizontal: 14, paddingBottom: 14 },
  text: { ...type.bodySmall, color: c.muted },
  group: { gap: 2 },
  category: { ...type.label, color: c.foreground },
  values: { ...type.micro, color: c.muted },
  pressed: { opacity: 0.88 },
}));
