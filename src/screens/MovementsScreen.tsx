import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { listAccounts } from "../lib/accounts/api";
import { isUnauthorized } from "../lib/accounts/messages";
import { listAllPages } from "../lib/api/pagination";
import { listCategories } from "../lib/categories/api";
import { formatCivilDate, todayCivilDate } from "../lib/civil-date";
import { formatMoney } from "../lib/money";
import { listTransactions, listTransactionsSince, PERIOD_SCAN_LIMIT } from "../lib/transactions/api";
import type { Transaction } from "../lib/transactions/types";
import { makeStyles, radius, type, useTheme } from "../theme";
import { Button, EmptyState, Notice, type NoticeTone, SkeletonList, StatusChip } from "../ui/controls";
import { IconAccounts, IconInflow, IconMovements, IconOutflow, IconPlus, IconTransfer } from "../ui/icons";
import { FilterChips, SearchField } from "../ui/list-tools";
import { OverviewSparkline } from "../ui/overview-charts";
import { AppScreen, type Section, useListStyles } from "../ui/screens";
import { StatCard, StatGrid } from "../ui/stat-card";
import { CategorizeScreen } from "./CategorizeScreen";
import { MovementFiltersScreen } from "./MovementFiltersScreen";
import { MovementFormScreen } from "./MovementFormScreen";
import {
  type AccountOption,
  accountLabel,
  activeFilterCount,
  appendPage,
  canCategorize,
  categorizationTone,
  categorizeBlockedReason,
  categoryChipLabel,
  type CategoryOption,
  changeText,
  dailySeries,
  dateRange,
  DEFAULT_FILTERS,
  downsample,
  filterMovements,
  hasContentFilters,
  type MovementFilters,
  movementDirection,
  PAGE_SIZE,
  percentChange,
  PERIOD_PRESETS,
  type PeriodPreset,
  periodTotals,
  previousRange,
  replaceItem,
  SEARCH_WINDOW,
  showingText,
  signedAmount,
  statusLabel,
  statusSource,
  typeLabel,
  typeTag,
  withinRange,
} from "./movement-presentation";
import { TransferFormScreen } from "./TransferFormScreen";
import { useForegroundRefresh } from "./use-foreground-refresh";

type LoadState = "loading" | "ready" | "error";

type Mode = "list" | "movement" | "transfer" | "filters" | "custom-period";

interface NoticeState {
  tone: NoticeTone;
  text: string;
}

interface ListState<T> {
  /** null: a lista falhou; as movimentações continuam visíveis. */
  items: T[] | null;
  truncated: boolean;
}

/**
 * De onde vêm os lançamentos (a API não filtra nem soma):
 * - period: período com início; lido do mais recente até o início do período anterior.
 * - window: "Tudo" com busca/filtro; os mais recentes, filtrados no aparelho.
 * - paged: "Tudo" sem filtro; paginação da API com "Carregar mais".
 */
type Source =
  | { kind: "period"; items: Transaction[]; complete: boolean; total: number }
  | { kind: "window"; items: Transaction[]; truncated: boolean }
  | { kind: "paged"; items: Transaction[]; total: number; page: number };

type PeriodChip = PeriodPreset | "tudo" | "personalizado";

async function fetchAccounts(): Promise<{ items: AccountOption[]; truncated: boolean }> {
  const result = await listAllPages((query) => listAccounts(query));
  return { items: result.items.map(({ id, name }) => ({ id, name })), truncated: result.truncated };
}

async function fetchCategories(): Promise<{ items: CategoryOption[]; truncated: boolean }> {
  const result = await listAllPages((query) => listCategories(query));
  return { items: result.items.map(({ id, name, status }) => ({ id, name, status })), truncated: result.truncated };
}

async function fetchSource(filters: MovementFilters, today: string): Promise<Source> {
  const range = dateRange(filters, today);
  if (range.since) {
    const previous = previousRange(range.since, range.until ?? today);
    const scan = await listTransactionsSince(previous.since);
    return { kind: "period", ...scan };
  }
  if (hasContentFilters(filters)) {
    const result = await listAllPages((query) => listTransactions(query), SEARCH_WINDOW);
    return { kind: "window", items: result.items, truncated: result.truncated };
  }
  const page = await listTransactions({ page: 1, pageSize: PAGE_SIZE });
  return { kind: "paged", items: page.items, total: page.total, page: 1 };
}

/** Muda só quando a fonte dos dados muda; digitar na busca com período não busca de novo. */
function sourceKey(filters: MovementFilters, today: string): string {
  const { since, until } = dateRange(filters, today);
  if (since) return `period:${since}:${until ?? today}`;
  return hasContentFilters(filters) ? "window" : "paged";
}

export function MovementsScreen({ onNavigate }: { onNavigate: (section: Section) => void }) {
  const { handleUnauthorized } = useAuth();
  const styles = useStyles();
  const list = useListStyles();
  const { colors } = useTheme();
  const [filters, setFilters] = useState<MovementFilters>(DEFAULT_FILTERS);
  const [source, setSource] = useState<Source | null>(null);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [state, setState] = useState<LoadState>("loading");
  const [accounts, setAccounts] = useState<ListState<AccountOption>>({ items: null, truncated: false });
  const [categories, setCategories] = useState<ListState<CategoryOption>>({ items: null, truncated: false });
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [mode, setMode] = useState<Mode>("list");
  const [categorizing, setCategorizing] = useState<Transaction | null>(null);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const today = todayCivilDate();
  const key = sourceKey(filters, today);

  const loadSource = useCallback(
    async (current: MovementFilters) => {
      try {
        setSource(await fetchSource(current, todayCivilDate()));
        setVisible(PAGE_SIZE);
        setState("ready");
      } catch (error) {
        if (isUnauthorized(error)) {
          await handleUnauthorized();
          return;
        }
        setState("error");
      }
    },
    [handleUnauthorized],
  );

  const loadNames = useCallback(async () => {
    const [accountsResult, categoriesResult] = await Promise.allSettled([fetchAccounts(), fetchCategories()]);
    if ([accountsResult, categoriesResult].some((result) => result.status === "rejected" && isUnauthorized(result.reason))) {
      await handleUnauthorized();
      return;
    }
    setAccounts(accountsResult.status === "fulfilled" ? accountsResult.value : { items: null, truncated: false });
    setCategories(categoriesResult.status === "fulfilled" ? categoriesResult.value : { items: null, truncated: false });
  }, [handleUnauthorized]);

  const load = useCallback(async () => {
    await Promise.all([loadSource(filters), loadNames()]);
    // `filters` entra pela chave da fonte; recarregar não depende da busca digitada.
  }, [key, loadSource, loadNames]);

  useEffect(() => {
    void loadNames();
  }, [loadNames]);

  useEffect(() => {
    void loadSource(filters);
    // Só a mudança de fonte busca de novo; os demais filtros agem sobre o que já chegou.
  }, [key, loadSource]);

  useForegroundRefresh(() => void load());

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const reloadAccounts = useCallback(async () => {
    try {
      setAccounts(await fetchAccounts());
    } catch (error) {
      if (isUnauthorized(error)) await handleUnauthorized();
      // Mantém a lista anterior; o backend continua recusando conta indisponível.
    }
  }, [handleUnauthorized]);

  const accountItems = accounts.items;
  const categoryItems = categories.items;

  const view = useMemo(() => {
    const names = { accounts: accountItems, categories: categoryItems };
    const range = dateRange(filters, today);
    const period = range.since ? { since: range.since, until: range.until ?? today } : null;
    if (!source) return null;
    if (source.kind === "paged") {
      return { period, rows: source.items, total: source.total, historyTotal: source.total, totals: null, previous: null, series: null, covered: false, windowTruncated: false };
    }
    if (source.kind === "window") {
      const rows = filterMovements(source.items, filters, today, names);
      return { period, rows, total: rows.length, historyTotal: source.items.length, totals: null, previous: null, series: null, covered: false, windowTruncated: source.truncated };
    }
    const inPeriod = period ? filterMovements(withinRange(source.items, period.since, period.until), filters, today, names) : [];
    // O período está inteiro quando a leitura terminou ou já passou do início dele.
    const covered = Boolean(period && (source.complete || source.items.some((item) => item.occurredOn < period.since)));
    const totals = covered ? periodTotals(inPeriod) : null;
    const before = period ? previousRange(period.since, period.until) : null;
    const previous =
      totals && before && source.complete
        ? periodTotals(
            filterMovements(withinRange(source.items, before.since, before.until), { ...filters, period: "personalizado", from: before.since, to: before.until }, today, names),
          )
        : null;
    const series = totals && period ? dailySeries(inPeriod, period.since, period.until) : null;
    return { period, rows: inPeriod, total: inPeriod.length, historyTotal: source.total, totals, previous, series, covered, windowTruncated: false };
  }, [source, filters, today, accountItems, categoryItems]);

  const loadMore = useCallback(async () => {
    if (!source) return;
    if (source.kind !== "paged") {
      setVisible((count) => count + PAGE_SIZE);
      return;
    }
    if (loadingMore || source.page * PAGE_SIZE >= source.total) return;
    setLoadingMore(true);
    try {
      const next = await listTransactions({ page: source.page + 1, pageSize: PAGE_SIZE });
      setSource({ kind: "paged", items: appendPage(source.items, next.items), total: next.total, page: next.page });
    } catch (error) {
      if (isUnauthorized(error)) {
        await handleUnauthorized();
        return;
      }
      setNotice({ tone: "error", text: "Não foi possível carregar mais movimentações." });
    } finally {
      setLoadingMore(false);
    }
  }, [handleUnauthorized, loadingMore, source]);

  const finishForm = useCallback(
    (message: string) => {
      setMode("list");
      setNotice({ tone: "success", text: message });
      void load();
    },
    [load],
  );

  if (categorizing && categoryItems) {
    return (
      <CategorizeScreen
        transaction={categorizing}
        activeCategories={categoryItems.filter((category) => category.status === "active")}
        truncated={categories.truncated}
        onCancel={() => setCategorizing(null)}
        onDone={(updated, message) => {
          setSource((current) => (current ? { ...current, items: replaceItem(current.items, updated) } : current));
          setCategorizing(null);
          setNotice({ tone: "success", text: message });
        }}
        onStale={(message) => {
          setCategorizing(null);
          setNotice({ tone: "info", text: message });
          void load();
        }}
        onGoToCategories={() => onNavigate("categorias")}
      />
    );
  }

  if (mode === "filters" || mode === "custom-period") {
    return (
      <MovementFiltersScreen
        filters={filters}
        accounts={accountItems}
        categories={categoryItems}
        customPeriod={mode === "custom-period"}
        onCancel={() => setMode("list")}
        onApply={(next) => {
          setFilters(next);
          setMode("list");
        }}
      />
    );
  }

  if ((mode === "movement" || mode === "transfer") && accountItems) {
    const FormScreen = mode === "movement" ? MovementFormScreen : TransferFormScreen;
    return (
      <FormScreen accounts={accountItems} onCancel={() => setMode("list")} onDone={finishForm} onAccountsStale={() => void reloadAccounts()} />
    );
  }

  const historyTotal = view?.historyTotal ?? 0;
  const canRegister = state === "ready" && accountItems !== null && accountItems.length > 0;
  const periodChip: PeriodChip = filters.period === null ? "tudo" : filters.period;
  const periodEmpty = Boolean(view?.period && view.rows.length === 0);
  const rows = view ? (source?.kind === "paged" ? view.rows : view.rows.slice(0, visible)) : [];
  const hasMore = view ? rows.length < view.total : false;
  const change = (current: string, before: string | undefined) =>
    periodEmpty ? "Nenhum lançamento neste período" : before === undefined ? "Período anterior grande demais para comparar" : changeText(percentChange(current, before));

  const choosePeriod = (chip: PeriodChip) => {
    if (chip === "personalizado") {
      setMode("custom-period");
      return;
    }
    setFilters({ ...filters, period: chip === "tudo" ? null : chip, from: null, to: null });
  };

  const header = (
    <View style={styles.header}>
      {notice ? <Notice tone={notice.tone} text={notice.text} action={{ label: "Fechar", onPress: () => setNotice(null) }} /> : null}
      {state === "ready" && accountItems === null ? (
        <Notice
          tone="error"
          text="Não foi possível carregar suas contas. O histórico aparece abaixo, mas o registro fica indisponível até as contas carregarem."
          action={{ label: "Tentar de novo", onPress: () => void reloadAccounts() }}
        />
      ) : null}
      {state === "ready" && categoryItems === null ? (
        <Notice
          tone="warning"
          text="Não foi possível carregar suas categorias. Os nomes podem aparecer como indisponíveis e a categorização fica pausada até carregarem."
          action={{ label: "Tentar de novo", onPress: () => void loadNames() }}
        />
      ) : null}
      {accounts.truncated ? <Notice tone="info" text="Você tem muitas contas; apenas as primeiras aparecem na escolha de conta." /> : null}

      {historyTotal > 0 ? (
        <>
          <FilterChips<PeriodChip>
            label="Período"
            value={periodChip}
            onChange={choosePeriod}
            options={[
              ...(Object.entries(PERIOD_PRESETS) as [PeriodPreset, string][]).map(([value, label]) => ({ value, label })),
              { value: "tudo", label: "Tudo" },
              { value: "personalizado", label: "Personalizado" },
            ]}
          />
          {filters.period === "personalizado" && filters.from ? (
            <Text style={styles.meta}>
              {`De ${formatCivilDate(filters.from)}${filters.to ? ` até ${formatCivilDate(filters.to)}` : " até hoje"}`}
            </Text>
          ) : null}

          {view?.totals && view.series ? (
            <StatGrid>
              <StatCard
                icon={(color) => <IconInflow size={18} color={color} />}
                tone="positive"
                label="Entradas"
                value={formatMoney(view.totals.income)}
                meta={change(view.totals.income, view.previous?.income)}
                trend={periodEmpty ? undefined : (color) => <OverviewSparkline values={downsample(view.series?.income ?? [])} color={color} />}
              />
              <StatCard
                icon={(color) => <IconOutflow size={18} color={color} />}
                tone="negative"
                label="Saídas"
                value={formatMoney(view.totals.expense)}
                meta={change(view.totals.expense, view.previous?.expense)}
                trend={periodEmpty ? undefined : (color) => <OverviewSparkline values={downsample(view.series?.expense ?? [])} color={color} />}
              />
              <StatCard
                icon={(color) => <IconTransfer size={18} color={color} />}
                label="Balanço do período"
                value={formatMoney(view.totals.balance)}
                meta={periodEmpty ? "Nenhum lançamento neste período" : "Entradas menos saídas, sem transferências"}
                trend={periodEmpty ? undefined : (color) => <OverviewSparkline values={downsample(view.series?.balance ?? [])} color={color} />}
              />
            </StatGrid>
          ) : view?.period && !view.covered ? (
            <Notice tone="info" text={`Este período tem mais de ${PERIOD_SCAN_LIMIT} lançamentos: escolha um período menor para ver entradas, saídas e balanço.`} />
          ) : !view?.period ? (
            <Notice tone="info" text="Escolha um período para ver entradas, saídas e balanço." />
          ) : null}

          <SearchField value={filters.search} onChange={(search) => setFilters({ ...filters, search })} placeholder="Buscar por descrição, categoria ou conta" />
          <View style={styles.filterRow}>
            <Button
              variant="secondary"
              compact
              label={activeFilterCount(filters) > 0 ? `Filtros (${activeFilterCount(filters)})` : "Filtros"}
              onPress={() => setMode("filters")}
            />
            {hasContentFilters(filters) ? (
              <Button
                variant="text"
                label="Limpar"
                onPress={() => setFilters({ ...DEFAULT_FILTERS, period: filters.period, from: filters.from, to: filters.to })}
              />
            ) : null}
          </View>
          {view?.windowTruncated ? (
            <Notice tone="info" text={`A busca e os filtros cobrem os ${SEARCH_WINDOW} lançamentos mais recentes.`} />
          ) : null}
        </>
      ) : null}
    </View>
  );

  return (
    <AppScreen
      section="movimentacoes"
      onNavigate={onNavigate}
      title="Movimentações"
      subtitle={state !== "ready" ? undefined : "Receitas, despesas e transferências, das mais recentes às mais antigas."}
      footer={
        canRegister ? (
          <View style={styles.footerActions}>
            <View style={styles.footerMain}>
              <Button
                label="Registrar"
                accessibilityLabel="Registrar receita ou despesa"
                onPress={() => setMode("movement")}
                icon={(color) => <IconPlus size={20} color={color} />}
              />
            </View>
            {accountItems && accountItems.length >= 2 ? (
              <View style={styles.footerMain}>
                <Button
                  variant="secondary"
                  label="Transferir"
                  accessibilityLabel="Registrar transferência entre contas"
                  onPress={() => setMode("transfer")}
                  icon={(color) => <IconTransfer size={20} color={color} />}
                />
              </View>
            ) : null}
          </View>
        ) : null
      }
    >
      {state === "loading" ? (
        <View style={list.list}>
          <SkeletonList rows={6} />
        </View>
      ) : state === "error" ? (
        <View style={list.list}>
          <EmptyState
            icon={(color) => <IconMovements size={24} color={color} />}
            title="Não foi possível carregar suas movimentações"
            text="Pode ser uma falha momentânea de conexão. Seus dados não foram alterados."
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
          data={rows}
          keyExtractor={(item) => item.id}
          contentContainerStyle={list.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.primary} colors={[colors.primary]} />
          }
          ListHeaderComponent={header}
          ListEmptyComponent={
            accountItems !== null && accountItems.length === 0 ? (
              <EmptyState
                icon={(color) => <IconAccounts size={24} color={color} />}
                title="Comece criando uma conta"
                text="Toda movimentação pertence a uma conta: corrente, poupança, cartão ou dinheiro. Crie a primeira para registrar receitas e despesas."
                action={<Button label="Ir para Contas" onPress={() => onNavigate("contas")} />}
              />
            ) : historyTotal === 0 ? (
              <EmptyState
                icon={(color) => <IconMovements size={24} color={color} />}
                title="Nenhuma movimentação registrada"
                text="Toque em Registrar para lançar a primeira. O histórico mostra as mais recentes primeiro, com conta, categoria e valor."
              />
            ) : hasContentFilters(filters) ? (
              <EmptyState
                icon={(color) => <IconMovements size={24} color={color} />}
                title="Nenhuma movimentação encontrada"
                text="Nenhum lançamento combina com a busca ou os filtros escolhidos."
                action={
                  <Button
                    variant="secondary"
                    label="Limpar filtros"
                    onPress={() => setFilters({ ...DEFAULT_FILTERS, period: filters.period, from: filters.from, to: filters.to })}
                  />
                }
              />
            ) : (
              <EmptyState
                icon={(color) => <IconMovements size={24} color={color} />}
                title="Nenhuma movimentação neste período"
                text="Escolha um período maior ou veja todo o histórico para encontrar lançamentos mais antigos."
                action={<Button variant="secondary" label="Ver todo o histórico" onPress={() => choosePeriod("tudo")} />}
              />
            )
          }
          ListFooterComponent={
            rows.length > 0 && view ? (
              <View style={styles.more}>
                <Text style={styles.meta}>{showingText(rows.length, view.total)}</Text>
                {hasMore ? (
                  <Button
                    variant="secondary"
                    label={source?.kind === "paged" ? "Carregar mais" : "Mostrar mais"}
                    onPress={() => void loadMore()}
                    loading={loadingMore}
                  />
                ) : null}
              </View>
            ) : null
          }
          renderItem={({ item, index }) => (
            <MovementRow
              item={item}
              accounts={accountItems}
              categories={categoryItems}
              first={index === 0}
              last={index === rows.length - 1}
              onCategorize={setCategorizing}
            />
          )}
        />
      )}
    </AppScreen>
  );
}

/** Linhas unidas em um único painel: `first`/`last` arredondam as pontas do grupo. */
function MovementRow({
  item,
  accounts,
  categories,
  first,
  last,
  onCategorize,
}: {
  item: Transaction;
  accounts: AccountOption[] | null;
  categories: CategoryOption[] | null;
  first: boolean;
  last: boolean;
  onCategorize: (transaction: Transaction) => void;
}) {
  const styles = useStyles();
  const list = useListStyles();
  const { colors } = useTheme();
  const amount = signedAmount(item);
  const direction = movementDirection(item);
  const account = accountLabel(item.accountId, accounts);
  const description = item.description ?? "Sem descrição";
  const status = statusLabel(item);
  const source = statusSource(item);
  const chip = categoryChipLabel(item, categories);
  const Icon = direction === "in" ? IconInflow : direction === "out" ? IconOutflow : IconTransfer;
  const categorizable = categories !== null && canCategorize(item);
  const blocked = categorizeBlockedReason(item, categories !== null);
  const needsCategory = item.categorizationStatus === "unclassified";
  const date = formatCivilDate(item.occurredOn);

  // Menu em todas as linhas; quando não dá para categorizar, ele diz o motivo.
  const openMenu = () => {
    if (blocked || !categorizable) {
      Alert.alert(description, blocked ?? "Categorização indisponível.", [{ text: "Entendi" }]);
      return;
    }
    Alert.alert(description, undefined, [
      { text: needsCategory ? "Categorizar" : "Corrigir categoria", onPress: () => onCategorize(item) },
      { text: "Cancelar", style: "cancel" },
    ]);
  };

  return (
    <View style={[list.item, first && list.itemFirst, last && list.itemLast, styles.row]}>
      {/* O resumo é agrupado para leitores de tela; as ações ficam fora do grupo para serem alcançáveis. */}
      <View
        style={styles.summary}
        accessible
        accessibilityLabel={`${description}, ${typeLabel(item)}, ${amount.text}, ${date}, ${account}, ${chip}, ${status}${item.status === "voided" ? ", estornada" : ""}`}
      >
        <View style={[styles.icon, direction === "in" && styles.iconIn]}>
          <Icon size={18} color={direction === "in" ? colors.primary : colors.muted} />
        </View>
        <View style={styles.text}>
          <Text style={item.description ? styles.title : styles.titleMuted} numberOfLines={1}>
            {description}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {date} · {account}
          </Text>
        </View>
        <Text style={[styles.amount, amount.direction === "in" && styles.amountIn]}>{amount.text}</Text>
      </View>

      <View style={styles.tags}>
        <View style={styles.categoryChip}>
          <Text style={styles.categoryChipLabel} numberOfLines={1}>
            {chip}
          </Text>
        </View>
        <View style={[styles.typeTag, item.type === "income" && styles.typeIncome, item.type === "expense" && styles.typeExpense]}>
          <Text
            style={[
              styles.typeTagLabel,
              item.type === "income" && { color: colors.positive },
              item.type === "expense" && { color: colors.negative },
            ]}
          >
            {typeTag(item)}
          </Text>
        </View>
        {item.status === "voided" ? <Text style={styles.meta}>Estornada</Text> : null}
      </View>

      <View style={styles.statusRow}>
        <View style={styles.statusBox}>
          <StatusChip tone={categorizationTone(item)} label={source ? `${status} · ${source}` : status} />
        </View>
        {categorizable && needsCategory ? (
          <Pressable
            onPress={() => onCategorize(item)}
            accessibilityRole="button"
            accessibilityLabel={`Categorizar ${description}`}
            hitSlop={12}
            style={({ pressed }) => [styles.categorize, pressed && styles.pressed]}
          >
            <Text style={styles.categorizeLabel}>Categorizar</Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={openMenu}
          accessibilityRole="button"
          accessibilityLabel={`Ações para ${description}`}
          hitSlop={8}
          style={({ pressed }) => [styles.menu, pressed && styles.pressed]}
        >
          <Text style={styles.menuLabel}>⋮</Text>
        </Pressable>
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  header: { gap: 12, paddingBottom: 12 },
  filterRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  footerActions: { flexDirection: "row", gap: 10 },
  footerMain: { flex: 1 },
  more: { paddingTop: 12, gap: 10, alignItems: "stretch" },
  row: { gap: 8 },
  summary: { flexDirection: "row", alignItems: "center", gap: 12 },
  icon: {
    width: 36,
    height: 36,
    borderRadius: radius.control,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.surfaceSoft,
  },
  iconIn: { backgroundColor: c.primaryTint },
  text: { flex: 1, gap: 1 },
  title: { ...type.body, fontFamily: "Manrope_700Bold", color: c.foreground },
  titleMuted: { ...type.body, fontFamily: "Manrope_600SemiBold", color: c.muted },
  meta: { ...type.micro, fontFamily: "Manrope_500Medium", color: c.muted },
  amount: { ...type.amount, color: c.foreground },
  // O sinal (+/−) carrega a direção; a cor é só reforço.
  amountIn: { color: c.positive },
  tags: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6, paddingLeft: 48 },
  categoryChip: {
    maxWidth: "60%",
    paddingVertical: 2,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: radius.pill,
    backgroundColor: c.surfaceSoft,
  },
  categoryChipLabel: { ...type.micro, color: c.foreground },
  typeTag: {
    paddingVertical: 2,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: radius.pill,
    backgroundColor: c.surfaceSoft,
  },
  typeIncome: { borderColor: c.positive },
  typeExpense: { borderColor: c.negative },
  typeTagLabel: { ...type.micro, color: c.bodyText },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 48 },
  statusBox: { flex: 1 },
  categorize: { minHeight: 44, justifyContent: "center", paddingHorizontal: 4 },
  categorizeLabel: { ...type.label, fontFamily: "Manrope_700Bold", color: c.primary },
  menu: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  menuLabel: { fontSize: 20, lineHeight: 22, color: c.bodyText, fontFamily: "Manrope_700Bold" },
  pressed: { opacity: 0.7 },
}));
