import { useCallback, useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { isUnauthorized } from "../lib/accounts/messages";
import { getPatrimonyHistory } from "../lib/patrimony/api";
import type { HistoryEntry, PatrimonyCollection, PatrimonyItem } from "../lib/patrimony/types";
import { makeStyles, radius, type } from "../theme";
import { Button, Notice, SkeletonList } from "../ui/controls";
import { FormScreen } from "../ui/screens";
import { formatStamp, SECTIONS, stateFacts } from "./patrimony-presentation";

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; entries: HistoryEntry<PatrimonyCollection>[] };

/** Versões gravadas de um item: data e hora de Brasília, o estado daquela versão e a marca "atual". */
export function PatrimonyHistoryScreen({
  collection,
  item,
  assets,
  onBack,
}: {
  collection: PatrimonyCollection;
  item: PatrimonyItem;
  assets: { id: string; description: string }[] | null;
  onBack: () => void;
}) {
  const { handleUnauthorized } = useAuth();
  const styles = useStyles();
  const [state, setState] = useState<LoadState>({ status: "loading" });

  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      setState({ status: "ready", entries: await getPatrimonyHistory(collection, item.id) });
    } catch (error) {
      if (isUnauthorized(error)) {
        await handleUnauthorized();
        return;
      }
      setState({ status: "error" });
    }
  }, [collection, item.id, handleUnauthorized]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <FormScreen
      title={item.description}
      description={`${SECTIONS[collection].title} · versão ${item.version} · atualizado em ${formatStamp(item.updatedAt)}`}
      onCancel={onBack}
      footer={<Button label="Voltar" variant="secondary" onPress={onBack} />}
    >
      <Text style={styles.heading} accessibilityRole="header">
        Histórico de versões
      </Text>
      {state.status === "loading" ? (
        <SkeletonList rows={3} />
      ) : state.status === "error" ? (
        <View style={styles.block}>
          <Notice tone="error" text="Não foi possível carregar o histórico. Seus dados não foram alterados." action={{ label: "Tentar de novo", onPress: () => void load() }} />
        </View>
      ) : state.entries.length === 0 ? (
        <Text style={styles.note}>O backend não devolveu versões para este item.</Text>
      ) : (
        state.entries.map((entry) => (
          <View key={entry.version} style={styles.version} accessible accessibilityLabel={`Versão ${entry.version}${entry.version === item.version ? ", atual" : ""}`}>
            <Text style={styles.versionTitle}>
              Versão {entry.version} · {formatStamp(entry.createdAt)}
              {entry.version === item.version ? " · atual" : ""}
            </Text>
            {stateFacts(collection, entry.state, assets).map(([label, value]) => (
              <View key={label} style={styles.fact}>
                <Text style={styles.factLabel}>{label}</Text>
                <Text style={styles.factValue}>{value}</Text>
              </View>
            ))}
          </View>
        ))
      )}
    </FormScreen>
  );
}

const useStyles = makeStyles((c) => ({
  heading: { ...type.sectionTitle, color: c.foreground },
  block: { gap: 8 },
  note: { ...type.bodySmall, color: c.muted },
  version: { gap: 8, padding: 14, borderWidth: 1, borderColor: c.line, borderRadius: radius.panel, backgroundColor: c.surface },
  versionTitle: { ...type.label, color: c.foreground },
  fact: { gap: 1 },
  factLabel: { ...type.micro, color: c.muted },
  factValue: { ...type.bodySmall, color: c.foreground },
}));
