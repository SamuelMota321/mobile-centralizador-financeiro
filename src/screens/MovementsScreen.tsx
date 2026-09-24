import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useAuth } from "../auth/AuthContext";
import { listAccounts } from "../lib/accounts/api";
import { isUnauthorized } from "../lib/accounts/messages";
import { listAllPages } from "../lib/api/pagination";
import { listCategories } from "../lib/categories/api";
import { formatCivilDate } from "../lib/civil-date";
import { listTransactions } from "../lib/transactions/api";
import type { Transaction } from "../lib/transactions/types";
import { theme } from "../theme";
import { CategorizeScreen } from "./CategorizeScreen";
import { MovementFormScreen } from "./MovementFormScreen";
import {
  type AccountOption,
  accountLabel,
  appendPage,
  canCategorize,
  type CategoryOption,
  categorizationLabel,
  PAGE_SIZE,
  replaceItem,
  signedAmount,
  typeLabel,
} from "./movement-presentation";
import { type Section, SectionTabs } from "./SectionTabs";
import { TransferFormScreen } from "./TransferFormScreen";
import { useForegroundRefresh } from "./use-foreground-refresh";

type LoadState = "loading" | "ready" | "error";

type Mode = "list" | "movement" | "transfer";

interface Notice {
  tone: "info" | "error";
  text: string;
}

interface AccountsState {
  /** null: a lista de contas falhou; as movimentacoes continuam visiveis. */
  items: AccountOption[] | null;
  truncated: boolean;
}

interface CategoriesState {
  /** Ativas e arquivadas; null: a lista falhou e a categorizacao fica pausada. */
  items: CategoryOption[] | null;
  truncated: boolean;
}

async function fetchCategories(): Promise<{ items: CategoryOption[]; truncated: boolean }> {
  const result = await listAllPages((query) => listCategories(query));
  return {
    items: result.items.map(({ id, name, status }) => ({ id, name, status })),
    truncated: result.truncated,
  };
}

async function fetchAccounts(): Promise<{ items: AccountOption[]; truncated: boolean }> {
  const result = await listAllPages((query) => listAccounts(query));
  return {
    items: result.items.map(({ id, name }) => ({ id, name })),
    truncated: result.truncated,
  };
}

export function MovementsScreen({ onNavigate }: { onNavigate: (section: Section) => void }) {
  const { signOut, handleUnauthorized } = useAuth();
  const [items, setItems] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [state, setState] = useState<LoadState>("loading");
  const [accounts, setAccounts] = useState<AccountsState>({ items: null, truncated: false });
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [mode, setMode] = useState<Mode>("list");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [categories, setCategories] = useState<CategoriesState>({ items: null, truncated: false });
  const [categorizing, setCategorizing] = useState<Transaction | null>(null);

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
      accountsResult.status === "fulfilled"
        ? accountsResult.value
        : { items: null, truncated: false },
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
      // Mantem a lista anterior; o backend continua recusando conta indisponivel.
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
      setNotice({ tone: "error", text: "Nao foi possivel carregar mais movimentacoes." });
    } finally {
      setLoadingMore(false);
    }
  }, [handleUnauthorized, hasMore, loadingMore, page]);

  const finishForm = useCallback(
    (message: string) => {
      setMode("list");
      setNotice({ tone: "info", text: message });
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
          setNotice({ tone: "info", text: message });
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

  return (
    <View style={styles.container}>
      <SectionTabs current="movimentacoes" onNavigate={onNavigate} />
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          Movimentacoes
        </Text>
        <Pressable onPress={() => void signOut()} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.link}>Sair</Text>
        </Pressable>
      </View>

      {notice ? (
        <View
          style={[styles.notice, notice.tone === "error" && styles.noticeError]}
          accessibilityLiveRegion="polite"
        >
          <Text style={notice.tone === "error" ? styles.noticeErrorText : styles.noticeText}>
            {notice.text}
          </Text>
          <Pressable onPress={() => setNotice(null)} accessibilityRole="button" hitSlop={8}>
            <Text style={styles.link}>Fechar</Text>
          </Pressable>
        </View>
      ) : null}

      {state === "ready" && accountItems === null ? (
        <View style={[styles.notice, styles.noticeError]} accessibilityLiveRegion="polite">
          <Text style={styles.noticeErrorText}>
            Nao foi possivel carregar suas contas. As movimentacoes aparecem abaixo, mas o
            registro fica indisponivel ate as contas carregarem.
          </Text>
          <Pressable onPress={() => void reloadAccounts()} accessibilityRole="button" hitSlop={8}>
            <Text style={styles.link}>Tentar de novo</Text>
          </Pressable>
        </View>
      ) : null}

      {state === "ready" && categoryItems === null ? (
        <View style={[styles.notice, styles.noticeError]} accessibilityLiveRegion="polite">
          <Text style={styles.noticeErrorText}>
            Nao foi possivel carregar suas categorias. Os nomes podem aparecer como
            indisponiveis e a categorizacao fica pausada ate carregarem.
          </Text>
          <Pressable onPress={() => void load()} accessibilityRole="button" hitSlop={8}>
            <Text style={styles.link}>Tentar de novo</Text>
          </Pressable>
        </View>
      ) : null}

      {accounts.truncated ? (
        <Text style={styles.muted}>
          Voce tem muitas contas; apenas as primeiras aparecem na escolha de conta.
        </Text>
      ) : null}

      {state === "loading" ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.consciencia} accessibilityLabel="Carregando" />
        </View>
      ) : state === "error" ? (
        <View style={styles.center}>
          <Text style={styles.muted}>Nao foi possivel carregar suas movimentacoes.</Text>
          <Pressable
            style={styles.secondary}
            onPress={() => {
              setState("loading");
              void load();
            }}
            accessibilityRole="button"
          >
            <Text style={styles.secondaryLabel}>Tentar de novo</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.muted}>Nenhuma movimentacao registrada.</Text>
            </View>
          }
          ListFooterComponent={
            items.length === 0 ? null : hasMore ? (
              <Pressable
                style={styles.secondary}
                onPress={() => void loadMore()}
                disabled={loadingMore}
                accessibilityRole="button"
                accessibilityState={{ busy: loadingMore }}
              >
                {loadingMore ? (
                  <ActivityIndicator color={theme.consciencia} />
                ) : (
                  <Text style={styles.secondaryLabel}>Carregar mais</Text>
                )}
              </Pressable>
            ) : (
              <Text style={styles.muted}>
                {total} {total === 1 ? "lancamento" : "lancamentos"} no total.
              </Text>
            )
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

      {state === "ready" && accountItems !== null ? (
        <RegisterActions
          accounts={accountItems}
          onRegister={setMode}
          onCreateAccount={() => onNavigate("contas")}
        />
      ) : null}
    </View>
  );
}

function RegisterActions({
  accounts,
  onRegister,
  onCreateAccount,
}: {
  accounts: AccountOption[];
  onRegister: (mode: Mode) => void;
  onCreateAccount: () => void;
}) {
  if (accounts.length === 0) {
    return (
      <View style={styles.actions}>
        <Text style={styles.muted}>Para registrar movimentacoes, crie primeiro uma conta.</Text>
        <Pressable style={styles.primary} onPress={onCreateAccount} accessibilityRole="button">
          <Text style={styles.primaryLabel}>Ir para contas</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.actions}>
      <Pressable
        style={styles.primary}
        onPress={() => onRegister("movement")}
        accessibilityRole="button"
      >
        <Text style={styles.primaryLabel}>Registrar receita ou despesa</Text>
      </Pressable>
      {accounts.length < 2 ? (
        <Text style={styles.muted}>
          Para registrar uma transferencia entre contas, e preciso ter ao menos duas contas
          ativas.
        </Text>
      ) : (
        <Pressable
          style={styles.secondary}
          onPress={() => onRegister("transfer")}
          accessibilityRole="button"
        >
          <Text style={styles.secondaryLabel}>Registrar transferencia entre contas</Text>
        </Pressable>
      )}
    </View>
  );
}

/** Linhas unidas em um unico painel: `first`/`last` arredondam as pontas do grupo. */
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
  const amount = signedAmount(item);
  const account = accountLabel(item.accountId, accounts);
  const description = item.description ?? "Sem descricao";
  const status = `${categorizationLabel(item, categories)}${item.status === "voided" ? " · Estornada" : ""}`;

  return (
    <View style={[styles.item, first && styles.itemFirst, last && styles.itemLast]}>
      {/* O resumo e agrupado para leitores de tela; a acao fica fora do grupo para ser alcancavel. */}
      <View
        style={styles.itemRow}
        accessible
        accessibilityLabel={`${description}, ${typeLabel(item)}, ${amount.text}, ${formatCivilDate(item.occurredOn)}, ${account}, ${status}`}
      >
        <View style={styles.itemMain}>
          <Text style={item.description ? styles.itemName : styles.itemNameMuted}>
            {description}
          </Text>
          <Text style={styles.itemMeta}>
            {formatCivilDate(item.occurredOn)} · {account}
          </Text>
          <Text style={styles.itemMeta}>{typeLabel(item)}</Text>
          <Text style={styles.itemMeta}>{status}</Text>
        </View>
        <Text style={[styles.amount, amount.direction === "in" && styles.amountIn]}>
          {amount.text}
        </Text>
      </View>
      {categories && canCategorize(item) ? (
        <Pressable
          style={styles.categorize}
          onPress={() => onCategorize(item)}
          accessibilityRole="button"
          accessibilityLabel={`${item.categorizationStatus === "unclassified" ? "Categorizar" : "Corrigir categoria de"} ${description}`}
          hitSlop={8}
        >
          <Text style={styles.categorizeLabel}>
            {item.categorizationStatus === "unclassified" ? "Categorizar" : "Corrigir categoria"}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 64,
    paddingHorizontal: 20,
    paddingBottom: 24,
    backgroundColor: theme.respiro,
  },
  header: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    color: theme.confianca,
  },
  link: {
    color: theme.muted,
    textDecorationLine: "underline",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 48,
  },
  muted: {
    color: theme.muted,
    textAlign: "center",
  },
  list: {
    paddingBottom: 16,
    flexGrow: 1,
  },
  // Style guide: bordas discretas entre linhas no lugar de um cartao por item.
  item: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: theme.border,
    backgroundColor: theme.surface,
  },
  itemFirst: {
    borderTopWidth: 1,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  itemLast: {
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    marginBottom: 12,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  itemMain: {
    flex: 1,
    gap: 2,
  },
  itemName: {
    fontWeight: "600",
    color: theme.confianca,
  },
  itemNameMuted: {
    fontStyle: "italic",
    color: theme.muted,
  },
  itemMeta: {
    fontSize: 13,
    color: theme.muted,
  },
  amount: {
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
    color: theme.confianca,
  },
  categorize: {
    alignSelf: "flex-start",
    minHeight: 44,
    justifyContent: "center",
  },
  categorizeLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.consciencia,
  },
  // A cor reforca o sinal (+/-) do texto; nunca e o unico indicador de direcao.
  amountIn: {
    color: theme.consciencia,
  },
  notice: {
    gap: 8,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 10,
    backgroundColor: theme.surface,
  },
  noticeError: {
    borderColor: theme.danger,
  },
  noticeText: {
    color: theme.confianca,
  },
  noticeErrorText: {
    color: theme.danger,
  },
  actions: {
    gap: 10,
    paddingTop: 12,
  },
  primary: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    borderRadius: 999,
    backgroundColor: theme.consciencia,
  },
  primaryLabel: {
    color: theme.onAccent,
    fontWeight: "600",
    fontSize: 16,
  },
  secondary: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 20,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.border,
  },
  secondaryLabel: {
    color: theme.confianca,
  },
});
