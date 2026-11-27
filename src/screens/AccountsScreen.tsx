import { useCallback, useEffect, useState } from "react";
import { Alert, RefreshControl, SectionList, Text, View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { deactivateAccount, listAccounts } from "../lib/accounts/api";
import {
  ACCOUNT_UNAVAILABLE_MESSAGE,
  accountErrorMessage,
  isAccountUnavailable,
  isUnauthorized,
} from "../lib/accounts/messages";
import type { Account } from "../lib/accounts/types";
import { listAllPages, SELECTOR_ITEM_LIMIT } from "../lib/api/pagination";
import { formatCivilDate } from "../lib/civil-date";
import { formatMoney } from "../lib/money";
import { makeStyles, radius, type, useTheme } from "../theme";
import { Banner } from "../ui/blocks";
import { Button, EmptyState, Notice, type NoticeTone, SkeletonList, StatusChip } from "../ui/controls";
import { IconAccounts, IconArrowRight, IconHome, IconPlus, IconTransfer, IconTrendUp } from "../ui/icons";
import { FilterChips, GroupHeader, SearchField } from "../ui/list-tools";
import { Monogram } from "../ui/monogram";
import { StatCard, StatGrid } from "../ui/stat-card";
import { AppScreen, type Section, useListStyles } from "../ui/screens";
import { ACCOUNT_TYPE_LABELS } from "./account-type-labels";
import {
  ACCOUNT_GROUPS,
  type AccountGroup,
  accountCounts,
  filterAccounts,
  GROUP_LABELS,
  groupAccounts,
  groupBreakdown,
  shareOf,
} from "./accounts-logic";
import { AccountFormScreen } from "./AccountFormScreen";
import { ConnectScreen } from "./ConnectScreen";
import { OfxImportScreen } from "./OfxImportScreen";
import { useForegroundRefresh } from "./use-foreground-refresh";

type LoadState = "loading" | "ready" | "error";

type Mode =
  | { kind: "list" }
  | { kind: "create" }
  | { kind: "edit"; account: Account }
  | { kind: "import" }
  | { kind: "connect" };

interface NoticeState {
  tone: NoticeTone;
  text: string;
}

export function AccountsScreen({ onNavigate, startCreating = false }: { onNavigate: (section: Section) => void; /** Abre já no formulário de nova conta (vindo dos Primeiros passos). */ startCreating?: boolean }) {
  const { handleUnauthorized } = useAuth();
  const styles = useStyles();
  const list = useListStyles();
  const { colors } = useTheme();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [refreshing, setRefreshing] = useState(false);
  const [mode, setMode] = useState<Mode>(startCreating ? { kind: "create" } : { kind: "list" });
  const [notice, setNotice] = useState<NoticeState | null>(null);
  // Conta com desativação em andamento: bloqueia toque duplo e outras ações nela.
  const [busyId, setBusyId] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState<AccountGroup | "all">("all");

  const load = useCallback(async () => {
    try {
      // Lista inteira (até 500) para agrupar, contar e buscar: a API não tem busca nem totais.
      const result = await listAllPages((query) => listAccounts(query));
      setAccounts(result.items);
      setTruncated(result.truncated);
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
    (message: string, tone: NoticeTone = "success") => {
      setMode({ kind: "list" });
      setNotice({ tone, text: message });
      void load();
    },
    [load],
  );

  if (mode.kind === "import") {
    return <OfxImportScreen onCancel={() => setMode({ kind: "list" })} onDone={finishForm} />;
  }

  if (mode.kind === "connect") {
    return <ConnectScreen onCancel={() => setMode({ kind: "list" })} onDone={finishForm} />;
  }

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
        : "Suas contas manuais e conectadas em um só lugar.";
  const counts = accountCounts(accounts);
  const sections = groupAccounts(filterAccounts(accounts, { search, group: group === "all" ? null : group })).map(
    (view) => ({ key: view.group, title: view.label, data: view.accounts }),
  );
  const filtering = search.trim() !== "" || group !== "all";

  return (
    <AppScreen
      section="contas"
      onNavigate={onNavigate}
      title="Contas"
      subtitle={subtitle}
      footer={
        state === "ready" ? (
          <>
            <Button
              label="Nova conta"
              onPress={() => setMode({ kind: "create" })}
              icon={(color) => <IconPlus size={20} color={color} />}
            />
            {accounts.length > 0 ? (
              <Button
                label="Importar extrato OFX"
                variant="text"
                onPress={() => setMode({ kind: "import" })}
              />
            ) : null}
            <Button
              label="Conectar banco (Sandbox)"
              variant="text"
              onPress={() => setMode({ kind: "connect" })}
            />
          </>
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
            text="Pode ser uma falha momentânea de conexão ou o servidor ainda acordando (até 1 minuto). Tente de novo em alguns segundos. Suas contas não foram alteradas."
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
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={list.list}
          stickySectionHeadersEnabled={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void refresh()}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListHeaderComponent={
            accounts.length > 0 ? (
              <View style={styles.header}>
                <StatGrid>
                  <StatCard
                    icon={(color) => <IconAccounts size={18} color={color} />}
                    label="Contas ativas"
                    value={String(counts.total)}
                    meta={groupBreakdown(counts.byGroup)}
                  />
                  <StatCard
                    label="Manuais"
                    value={String(counts.manual)}
                    meta={`de ${counts.total}, registradas por você`}
                    share={shareOf(counts.manual, counts.total)}
                  />
                  <StatCard
                    icon={(color) => <IconTransfer size={18} color={color} />}
                    label="Conectadas"
                    value={String(counts.connected)}
                    meta={`de ${counts.total}, lidas do banco pelo Open Finance`}
                    share={shareOf(counts.connected, counts.total)}
                  />
                </StatGrid>
                {truncated ? (
                  <Notice
                    tone="info"
                    text={`Você tem mais de ${SELECTOR_ITEM_LIMIT} contas: a lista, a busca e os números mostram só as primeiras.`}
                  />
                ) : null}
                <SearchField value={search} onChange={setSearch} placeholder="Buscar por nome ou instituição" />
                <FilterChips
                  label="Grupo de contas"
                  value={group}
                  onChange={setGroup}
                  options={[{ value: "all", label: "Todas" }, ...ACCOUNT_GROUPS.map((g) => ({ value: g, label: GROUP_LABELS[g] }))]}
                />
              </View>
            ) : null
          }
          ListEmptyComponent={
            filtering ? (
              <EmptyState
                icon={(color) => <IconAccounts size={24} color={color} />}
                title="Nenhuma conta encontrada"
                text="Nenhuma conta combina com a busca ou o grupo escolhido."
                action={
                  <Button
                    variant="secondary"
                    label="Limpar busca"
                    onPress={() => {
                      setSearch("");
                      setGroup("all");
                    }}
                  />
                }
              />
            ) : (
              <EmptyState
                icon={(color) => <IconAccounts size={24} color={color} />}
                title="Nenhuma conta ainda"
                text="Crie sua primeira conta para registrar receitas, despesas e transferências."
              />
            )
          }
          renderSectionHeader={({ section }) => <GroupHeader label={section.title} count={section.data.length} />}
          renderItem={({ item, index, section }) => {
            const busy = busyId === item.id;
            const manual = item.origin === "manual";
            return (
              <View
                style={[
                  list.item,
                  index === 0 && list.itemFirst,
                  index === section.data.length - 1 && list.itemLast,
                  styles.item,
                ]}
              >
                <View style={styles.row}>
                  <Monogram text={item.institutionName ?? item.name} />
                  <View style={styles.main}>
                    <Text style={styles.name}>{item.name}</Text>
                    <Text style={styles.meta}>{item.institutionName ?? "Instituição não informada"}</Text>
                  </View>
                  <StatusChip tone={manual ? "neutral" : "info"} label={manual ? "Manual" : "Conectada"} />
                </View>

                <View style={styles.row}>
                  <View style={styles.main}>
                    <View style={styles.typeTag}>
                      <Text style={styles.typeTagLabel}>{ACCOUNT_TYPE_LABELS[item.type]}</Text>
                    </View>
                  </View>
                  <View style={styles.balanceBox}>
                    <Text style={styles.balance}>{formatMoney(item.initialBalance)}</Text>
                    <Text style={styles.meta}>saldo inicial em {formatCivilDate(item.initialBalanceAsOf)}</Text>
                  </View>
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
            );
          }}
          ListFooterComponent={
            <View style={styles.footnote}>
              {accounts.length > 0 ? (
                <Notice
                  tone="info"
                  text="O valor de cada conta é o saldo inicial que você informou. Saldos atuais e totais chegam com o painel consolidado."
                />
              ) : null}
              {/* Bens e dívidas e Investimentos não têm aba própria: abrem a partir daqui. */}
              <Banner
                icon={(color) => <IconTrendUp size={22} color={color} />}
                title="Investimentos"
                text="Posições lidas das suas conexões autorizadas, com a origem e a data de cada dado."
                action={<Button variant="secondary" label="Abrir investimentos" onPress={() => onNavigate("investimentos")} icon={(color) => <IconArrowRight size={18} color={color} />} />}
              />
              <Banner
                icon={(color) => <IconHome size={22} color={color} />}
                title="Bens e dívidas"
                text="Registre imóveis, veículos, financiamentos e outras dívidas, com os valores que você informa."
                action={<Button variant="secondary" label="Abrir bens e dívidas" onPress={() => onNavigate("patrimonio")} icon={(color) => <IconArrowRight size={18} color={color} />} />}
              />
            </View>
          }
        />
      )}
    </AppScreen>
  );
}

const useStyles = makeStyles((c) => ({
  header: { gap: 12, paddingBottom: 4 },
  item: { gap: 10 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  main: { flex: 1, gap: 2 },
  name: { ...type.body, fontFamily: "Manrope_700Bold", color: c.foreground },
  meta: { ...type.micro, fontFamily: "Manrope_500Medium", color: c.muted },
  typeTag: {
    alignSelf: "flex-start",
    paddingVertical: 2,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: radius.pill,
    backgroundColor: c.surfaceSoft,
  },
  typeTagLabel: { ...type.micro, color: c.bodyText },
  balanceBox: { alignItems: "flex-end" },
  balance: { ...type.amount, color: c.foreground },
  actions: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 16 },
  footnote: { paddingTop: 16, gap: 12 },
}));
