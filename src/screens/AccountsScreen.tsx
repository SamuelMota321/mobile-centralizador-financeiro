import { useCallback, useEffect, useState } from "react";
import { Alert, FlatList, RefreshControl, Text, View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { deactivateAccount, listAccounts } from "../lib/accounts/api";
import {
  ACCOUNT_UNAVAILABLE_MESSAGE,
  accountErrorMessage,
  isAccountUnavailable,
  isUnauthorized,
} from "../lib/accounts/messages";
import type { Account } from "../lib/accounts/types";
import { formatCivilDate } from "../lib/civil-date";
import { formatMoney } from "../lib/money";
import { makeStyles, type, useTheme } from "../theme";
import { Button, EmptyState, Notice, type NoticeTone, SkeletonList, StatusChip } from "../ui/controls";
import { IconAccounts, IconPlus } from "../ui/icons";
import { AppScreen, type Section, useListStyles } from "../ui/screens";
import { ACCOUNT_TYPE_LABELS } from "./account-type-labels";
import { AccountFormScreen } from "./AccountFormScreen";
import { useForegroundRefresh } from "./use-foreground-refresh";

type LoadState = "loading" | "ready" | "error";

type Mode = { kind: "list" } | { kind: "create" } | { kind: "edit"; account: Account };

interface NoticeState {
  tone: NoticeTone;
  text: string;
}

export function AccountsScreen({ onNavigate }: { onNavigate: (section: Section) => void }) {
  const { handleUnauthorized } = useAuth();
  const styles = useStyles();
  const list = useListStyles();
  const { colors } = useTheme();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [refreshing, setRefreshing] = useState(false);
  const [mode, setMode] = useState<Mode>({ kind: "list" });
  const [notice, setNotice] = useState<NoticeState | null>(null);
  // Conta com desativação em andamento: bloqueia toque duplo e outras ações nela.
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const page = await listAccounts();
      setAccounts(page.items);
      setState("ready");
    } catch (error) {
      if (isUnauthorized(error)) {
        await handleUnauthorized();
        return;
      }
      setState("error");
    }
  }, [handleUnauthorized]);

  useEffect(() => {
    void load();
  }, [load]);

  useForegroundRefresh(() => void load());

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const deactivate = useCallback(
    async (account: Account) => {
      setBusyId(account.id);
      setNotice(null);
      try {
        await deactivateAccount(account.id);
        setNotice({
          tone: "success",
          text: "Conta desativada. Ela deixou de aparecer na lista e o histórico foi preservado.",
        });
        await load();
      } catch (error) {
        if (isUnauthorized(error)) {
          await handleUnauthorized();
          return;
        }
        if (isAccountUnavailable(error)) {
          setNotice({ tone: "info", text: ACCOUNT_UNAVAILABLE_MESSAGE });
          await load();
          return;
        }
        setNotice({
          tone: "error",
          text: accountErrorMessage(error, "Não foi possível desativar a conta."),
        });
      } finally {
        setBusyId(null);
      }
    },
    [handleUnauthorized, load],
  );

  const confirmDeactivate = useCallback(
    (account: Account) => {
      Alert.alert(
        "Desativar conta",
        `Desativar “${account.name}”? Ela deixa de aparecer na lista e não poderá ser editada nem reativada. O histórico é preservado.`,
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Desativar", style: "destructive", onPress: () => void deactivate(account) },
        ],
        { cancelable: true },
      );
    },
    [deactivate],
  );

  const finishForm = useCallback(
    (message: string) => {
      setMode({ kind: "list" });
      setNotice({ tone: "success", text: message });
      void load();
    },
    [load],
  );

  if (mode.kind !== "list") {
    return (
      <AccountFormScreen
        account={mode.kind === "edit" ? mode.account : undefined}
        onCancel={() => setMode({ kind: "list" })}
        onDone={finishForm}
      />
    );
  }

  const subtitle =
    state !== "ready"
      ? undefined
      : accounts.length === 0
        ? "Contas correntes, poupanças, cartões e dinheiro."
        : `${accounts.length} ${accounts.length === 1 ? "conta ativa" : "contas ativas"}`;

  return (
    <AppScreen
      section="contas"
      onNavigate={onNavigate}
      title="Contas"
      subtitle={subtitle}
      footer={
        state === "ready" ? (
          <Button
            label="Nova conta"
            onPress={() => setMode({ kind: "create" })}
            icon={(color) => <IconPlus size={20} color={color} />}
          />
        ) : null
      }
    >
      {notice ? (
        <View style={list.notices}>
          <Notice
            tone={notice.tone}
            text={notice.text}
            action={{ label: "Fechar", onPress: () => setNotice(null) }}
          />
        </View>
      ) : null}

      {state === "loading" ? (
        <View style={list.list}>
          <SkeletonList rows={4} />
        </View>
      ) : state === "error" ? (
        <View style={list.list}>
          <EmptyState
            icon={(color) => <IconAccounts size={24} color={color} />}
            title="Não foi possível carregar suas contas"
            text="Pode ser uma falha momentânea de conexão. Suas contas não foram alteradas."
            action={
              <Button
                variant="secondary"
                label="Tentar de novo"
                onPress={() => {
                  setState("loading");
                  void load();
                }}
              />
            }
          />
        </View>
      ) : (
        <FlatList
          data={accounts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={list.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void refresh()}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon={(color) => <IconAccounts size={24} color={color} />}
              title="Nenhuma conta ainda"
              text="Crie sua primeira conta para registrar receitas, despesas e transferências."
            />
          }
          renderItem={({ item, index }) => {
            const busy = busyId === item.id;
            const manual = item.origin === "manual";
            return (
              <View
                style={[
                  list.item,
                  index === 0 && list.itemFirst,
                  index === accounts.length - 1 && list.itemLast,
                  styles.item,
                ]}
              >
                <View style={styles.row}>
                  <View style={styles.main}>
                    <Text style={styles.name}>{item.name}</Text>
                    <Text style={styles.meta}>
                      {ACCOUNT_TYPE_LABELS[item.type]}
                      {item.institutionName ? ` · ${item.institutionName}` : ""}
                    </Text>
                  </View>
                  <StatusChip tone={manual ? "neutral" : "info"} label={manual ? "Manual" : "Conectada"} />
                </View>

                <View style={styles.row}>
                  <View>
                    <Text style={styles.balance}>{formatMoney(item.initialBalance)}</Text>
                    <Text style={styles.meta}>
                      saldo inicial em {formatCivilDate(item.initialBalanceAsOf)}
                    </Text>
                  </View>
                  <View style={styles.actions}>
                    {manual ? (
                      <Button
                        variant="text"
                        label="Editar"
                        accessibilityLabel={`Editar ${item.name}`}
                        onPress={() => setMode({ kind: "edit", account: item })}
                        disabled={busy}
                      />
                    ) : null}
                    <Button
                      variant="textDanger"
                      label="Desativar"
                      accessibilityLabel={`Desativar ${item.name}`}
                      onPress={() => confirmDeactivate(item)}
                      disabled={busyId !== null}
                      loading={busy}
                    />
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}
    </AppScreen>
  );
}

const useStyles = makeStyles((c) => ({
  item: { gap: 10 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  main: { flex: 1, gap: 2 },
  name: { ...type.body, fontFamily: "Manrope_700Bold", color: c.foreground },
  meta: { ...type.micro, fontFamily: "Manrope_500Medium", color: c.muted },
  balance: { ...type.amount, color: c.foreground },
  actions: { flexDirection: "row", alignItems: "center", gap: 16 },
}));
