import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { listAccounts } from "../lib/accounts/api";
import { isUnauthorized } from "../lib/accounts/messages";
import { listAllPages } from "../lib/api/pagination";
import { listCategories } from "../lib/categories/api";
import { formatCivilDate } from "../lib/civil-date";
import { listTransactions } from "../lib/transactions/api";
import type { Transaction } from "../lib/transactions/types";
import { makeStyles, radius, type, useTheme } from "../theme";
import {
  Button,
  EmptyState,
  Notice,
  type NoticeTone,
  SkeletonList,
  StatusChip,
} from "../ui/controls";
import {
  IconAccounts,
  IconInflow,
  IconMovements,
  IconOutflow,
  IconPlus,
  IconTransfer,
} from "../ui/icons";
import { AppScreen, type Section, useListStyles } from "../ui/screens";
import { CategorizeScreen } from "./CategorizeScreen";
import { MovementFormScreen } from "./MovementFormScreen";
import {
  type AccountOption,
  accountLabel,
  appendPage,
  canCategorize,
  type CategoryOption,
  categorizationLabel,
  categorizationTone,
  movementDirection,
  PAGE_SIZE,
  replaceItem,
  signedAmount,
  typeLabel,
} from "./movement-presentation";
import { TransferFormScreen } from "./TransferFormScreen";
import { useForegroundRefresh } from "./use-foreground-refresh";

type LoadState = "loading" | "ready" | "error";

type Mode = "list" | "movement" | "transfer";

interface NoticeState {
  tone: NoticeTone;
  text: string;
}

interface ListState<T> {
  /** null: a lista falhou; as movimentações continuam visíveis. */
  items: T[] | null;
  truncated: boolean;
}

async function fetchAccounts(): Promise<{ items: AccountOption[]; truncated: boolean }> {
  const result = await listAllPages((query) => listAccounts(query));
  return {
    items: result.items.map(({ id, name }) => ({ id, name })),
    truncated: result.truncated,
  };
}

async function fetchCategories(): Promise<{ items: CategoryOption[]; truncated: boolean }> {
  const result = await listAllPages((query) => listCategories(query));
  return {
    items: result.items.map(({ id, name, status }) => ({ id, name, status })),
    truncated: result.truncated,
  };
}

export function MovementsScreen({ onNavigate }: { onNavigate: (section: Section) => void }) {
  const { handleUnauthorized } = useAuth();
  const styles = useStyles();
  const list = useListStyles();
  const { colors } = useTheme();
  const [items, setItems] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [state, setState] = useState<LoadState>("loading");
  const [accounts, setAccounts] = useState<ListState<AccountOption>>({ items: null, truncated: false });
  const [categories, setCategories] = useState<ListState<CategoryOption>>({
    items: null,
    truncated: false,
  });
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [mode, setMode] = useState<Mode>("list");
  const [categorizing, setCategorizing] = useState<Transaction | null>(null);
  const [notice, setNotice] = useState<NoticeState | null>(null);

  const load = useCallback(async () => {
    const [transactionsResult, accountsResult, categoriesResult] = await Promise.allSettled([
      listTransactions({ page: 1, pageSize: PAGE_SIZE }),
      fetchAccounts(),
      fetchCategories(),
    ]);

    if (
      [transactionsResult, accountsResult, categoriesResult].some(
        (result) => result.status === "rejected" && isUnauthorized(result.reason),
      )
    ) {
      await handleUnauthorized();
      return;
    }

    setAccounts(
      accountsResult.status === "fulfilled" ? accountsResult.value : { items: null, truncated: false },
    );
    setCategories(
      categoriesResult.status === "fulfilled"
        ? categoriesResult.value
        : { items: null, truncated: false },
    );

    if (transactionsResult.status === "rejected") {
      setState("error");
      return;
    }
    setItems(transactionsResult.value.items);
    setTotal(transactionsResult.value.total);
    setPage(1);
    setState("ready");
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

  const reloadAccounts = useCallback(async () => {
    try {
      setAccounts(await fetchAccounts());
    } catch (error) {
      if (isUnauthorized(error)) await handleUnauthorized();
      // Mantém a lista anterior; o backend continua recusando conta indisponível.
    }
  }, [handleUnauthorized]);

  const hasMore = page * PAGE_SIZE < total;

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const next = await listTransactions({ page: page + 1, pageSize: PAGE_SIZE });
      setItems((current) => appendPage(current, next.items));
      setTotal(next.total);
      setPage(next.page);
    } catch (error) {
      if (isUnauthorized(error)) {
        await handleUnauthorized();
        return;
      }
      setNotice({ tone: "error", text: "Não foi possível carregar mais movimentações." });
    } finally {
      setLoadingMore(false);
    }
  }, [handleUnauthorized, hasMore, loadingMore, page]);

  const finishForm = useCallback(
    (message: string) => {
      setMode("list");
      setNotice({ tone: "success", text: message });
      void load();
    },
    [load],
  );

  const accountItems = accounts.items;
  const categoryItems = categories.items;

  if (categorizing && categoryItems) {
    return (
      <CategorizeScreen
        transaction={categorizing}
        activeCategories={categoryItems.filter((category) => category.status === "active")}
        truncated={categories.truncated}
        onCancel={() => setCategorizing(null)}
        onDone={(updated, message) => {
          setItems((current) => replaceItem(current, updated));
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

  if (mode !== "list" && accountItems) {
    const FormScreen = mode === "movement" ? MovementFormScreen : TransferFormScreen;
    return (
      <FormScreen
        accounts={accountItems}
        onCancel={() => setMode("list")}
        onDone={finishForm}
        onAccountsStale={() => void reloadAccounts()}
      />
    );
  }

  const canRegister = state === "ready" && accountItems !== null && accountItems.length > 0;
  const subtitle =
    state !== "ready"
      ? undefined
      : total === 0
        ? "Receitas, despesas e transferências entre suas contas."
        : `${total} ${total === 1 ? "lançamento" : "lançamentos"} · mais recentes primeiro`;

  const notices = (
    <>
      {notice ? (
        <Notice
          tone={notice.tone}
          text={notice.text}
          action={{ label: "Fechar", onPress: () => setNotice(null) }}
        />
      ) : null}
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
          action={{ label: "Tentar de novo", onPress: () => void load() }}
        />
      ) : null}
      {accounts.truncated ? (
        <Notice tone="info" text="Você tem muitas contas; apenas as primeiras aparecem na escolha de conta." />
      ) : null}
    </>
  );

  return (
    <AppScreen
      section="movimentacoes"
      onNavigate={onNavigate}
      title="Movimentações"
      subtitle={subtitle}
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
          data={items}
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
          ListHeaderComponent={<View style={styles.notices}>{notices}</View>}
          ListEmptyComponent={
            accountItems !== null && accountItems.length === 0 ? (
              <EmptyState
                icon={(color) => <IconAccounts size={24} color={color} />}
                title="Comece criando uma conta"
                text="Toda movimentação pertence a uma conta: corrente, poupança, cartão ou dinheiro. Crie a primeira para registrar receitas e despesas."
                action={<Button label="Ir para Contas" onPress={() => onNavigate("contas")} />}
              />
            ) : (
              <EmptyState
                icon={(color) => <IconMovements size={24} color={color} />}
                title="Nenhuma movimentação registrada"
                text="Toque em Registrar para lançar a primeira. O histórico mostra as mais recentes primeiro, com conta, categoria e valor."
              />
            )
          }
          ListFooterComponent={
            items.length > 0 && hasMore ? (
              <View style={styles.more}>
                <Button
                  variant="secondary"
                  label="Carregar mais"
                  onPress={() => void loadMore()}
                  loading={loadingMore}
                />
              </View>
            ) : null
          }
          renderItem={({ item, index }) => (
            <MovementRow
              item={item}
              accounts={accountItems}
              categories={categoryItems}
              first={index === 0}
              last={index === items.length - 1}
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
  const status = `${categorizationLabel(item, categories)}${item.status === "voided" ? " · Estornada" : ""}`;
  const Icon = direction === "in" ? IconInflow : direction === "out" ? IconOutflow : IconTransfer;
  const categorizable = categories !== null && canCategorize(item);

  return (
    <View style={[list.item, first && list.itemFirst, last && list.itemLast, styles.row]}>
      {/* O resumo é agrupado para leitores de tela; a ação fica fora do grupo para ser alcançável. */}
      <View
        style={styles.summary}
        accessible
        accessibilityLabel={`${description}, ${typeLabel(item)}, ${amount.text}, ${formatCivilDate(item.occurredOn)}, ${account}, ${status}`}
      >
        <View style={[styles.icon, direction === "in" && styles.iconIn]}>
          <Icon size={18} color={direction === "in" ? colors.primary : colors.muted} />
        </View>
        <View style={styles.text}>
          <Text style={item.description ? styles.title : styles.titleMuted} numberOfLines={1}>
            {description}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {formatCivilDate(item.occurredOn)} · {account}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {typeLabel(item)}
          </Text>
        </View>
        <Text style={[styles.amount, amount.direction === "in" && styles.amountIn]}>
          {amount.text}
        </Text>
      </View>

      <View style={styles.categoryRow}>
        <StatusChip tone={categorizationTone(item)} label={status} />
        {categorizable ? (
          <Pressable
            onPress={() => onCategorize(item)}
            accessibilityRole="button"
            accessibilityLabel={`${item.categorizationStatus === "unclassified" ? "Categorizar" : "Corrigir a categoria de"} ${description}`}
            hitSlop={12}
            style={({ pressed }) => [styles.categorize, pressed && styles.pressed]}
          >
            <Text style={styles.categorizeLabel}>
              {item.categorizationStatus === "unclassified" ? "Categorizar" : "Corrigir"}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  notices: { gap: 8, paddingBottom: 12 },
  footerActions: { flexDirection: "row", gap: 10 },
  footerMain: { flex: 1 },
  more: { paddingTop: 12 },
  row: { gap: 10 },
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
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingLeft: 48,
  },
  categorize: { minHeight: 44, justifyContent: "center", paddingHorizontal: 4 },
  categorizeLabel: { ...type.label, fontFamily: "Manrope_700Bold", color: c.primary },
  pressed: { opacity: 0.7 },
}));
