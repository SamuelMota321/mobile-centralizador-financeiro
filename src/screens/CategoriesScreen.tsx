import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { isUnauthorized } from "../lib/accounts/messages";
import { listAllPages, SELECTOR_ITEM_LIMIT } from "../lib/api/pagination";
import { deactivateCategory, listCategories } from "../lib/categories/api";
import { createOneSuggestedCategory, createSuggestedCategories } from "../lib/categories/apply-suggestions";
import { categoryColors, idsByCreation } from "../lib/categories/category-colors";
import { categoriesToCreate, SUGGESTED_CATEGORIES } from "../lib/categories/suggestions";
import type { Category } from "../lib/categories/types";
import { listCategoryRules } from "../lib/category-rules/api";
import { todayCivilDate } from "../lib/civil-date";
import { formatMoney } from "../lib/money";
import { fromCents } from "../lib/overview/chart-model";
import { listTransactionsSince, PERIOD_SCAN_LIMIT } from "../lib/transactions/api";
import { makeStyles, radius, type, useTheme } from "../theme";
import { Banner, CollapsibleCard, Pager, SectionCard } from "../ui/blocks";
import { CategoryBadge } from "../ui/category-badge";
import { CategoryTile } from "../ui/category-tile";
import { Button, EmptyState, Notice, type NoticeTone, SkeletonList, StatusChip } from "../ui/controls";
import { IconArrowRight, IconCategories, IconLightbulb, IconPlus, IconRules, IconSparkles } from "../ui/icons";
import { FilterChips, SearchField } from "../ui/list-tools";
import { AppScreen, type Section } from "../ui/screens";
import {
  arrangeCategories,
  categoryFilters,
  type CategorySort,
  DEFAULT_PERIOD,
  expenseShare,
  paginate,
  type PeriodUsage,
  periodLabel,
  periodRange,
  periodUsage,
  reviewFilters,
  rulesPerCategory,
  SORTS,
  suggestionTiles,
  usageFigure,
} from "./category-presentation";
import { CATEGORY_STATUS_LABELS, classifyCategoryError } from "./category-logic";
import { CategoryFormScreen } from "./CategoryFormScreen";
import { type MovementFilters, PERIOD_PRESETS, type PeriodPreset } from "./movement-presentation";
import { useForegroundRefresh } from "./use-foreground-refresh";

type LoadState = "loading" | "ready" | "error";

type Mode = { kind: "list" } | { kind: "create" } | { kind: "rename"; category: Category };

interface NoticeState {
  tone: NoticeTone;
  text: string;
}

interface Scan {
  items: Awaited<ReturnType<typeof listTransactionsSince>>["items"];
  complete: boolean;
}

const PERIOD_OPTIONS = (Object.entries(PERIOD_PRESETS) as [PeriodPreset, string][]).map(([value, label]) => ({ value, label }));
const SORT_OPTIONS = (Object.entries(SORTS) as [CategorySort, string][]).map(([value, label]) => ({ value, label }));

export function CategoriesScreen({
  onNavigate,
  onOpenMovements,
}: {
  onNavigate: (section: Section) => void;
  /** Abre Movimentações já filtrada ("Ver lançamentos", "Revisar"). */
  onOpenMovements: (filters: Partial<MovementFilters>) => void;
}) {
  const { handleUnauthorized } = useAuth();
  const styles = useStyles();
  const { colors } = useTheme();
  const [categories, setCategories] = useState<Category[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [ruleCounts, setRuleCounts] = useState<Map<string, number> | null>(null);
  const [scan, setScan] = useState<Scan | null>(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [state, setState] = useState<LoadState>("loading");
  const [refreshing, setRefreshing] = useState(false);
  const [mode, setMode] = useState<Mode>({ kind: "list" });
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [suggesting, setSuggesting] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [period, setPeriod] = useState<PeriodPreset>(DEFAULT_PERIOD);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<CategorySort>("uso");
  const [page, setPage] = useState(1);
  const [archivedPage, setArchivedPage] = useState(1);

  const today = todayCivilDate();
  const range = useMemo(() => periodRange(period, today), [period, today]);

  /** Lançamentos do período: leitura à parte, para trocar o período sem recarregar tudo. */
  const loadScan = useCallback(
    async (since: string) => {
      setScanLoading(true);
      try {
        const result = await listTransactionsSince(since);
        setScan({ items: result.items, complete: result.complete });
      } catch (error) {
        if (isUnauthorized(error)) {
          await handleUnauthorized();
          return;
        }
        setScan(null);
      } finally {
        setScanLoading(false);
      }
    },
    [handleUnauthorized],
  );

  const load = useCallback(async () => {
    // Categorias são o conteúdo; regras e lançamentos só enriquecem as linhas.
    const [categoriesResult, rulesResult] = await Promise.allSettled([
      listAllPages((query) => listCategories(query)),
      listAllPages((query) => listCategoryRules(query)),
    ]);
    if ([categoriesResult, rulesResult].some((result) => result.status === "rejected" && isUnauthorized(result.reason))) {
      await handleUnauthorized();
      return;
    }
    if (categoriesResult.status === "rejected") {
      setState("error");
      return;
    }
    setCategories(categoriesResult.value.items);
    setTruncated(categoriesResult.value.truncated);
    setRuleCounts(rulesResult.status === "fulfilled" ? rulesPerCategory(rulesResult.value.items) : null);
    setState("ready");
  }, [handleUnauthorized]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadScan(range.since);
  }, [loadScan, range.since]);

  const reload = useCallback(async () => {
    await Promise.all([load(), loadScan(range.since)]);
  }, [load, loadScan, range.since]);

  useForegroundRefresh(() => void reload());

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }, [reload]);

  // Atalhos opcionais: criam sugeridas, que depois pertencem à pessoa. Repetir é seguro.
  const addSuggested = useCallback(
    async (name: string | "todas") => {
      if (suggesting) return;
      setSuggesting(name);
      const result = name === "todas" ? await createSuggestedCategories() : await createOneSuggestedCategory(name);
      setSuggesting(null);
      if (!result.ok && isUnauthorized(result.error)) {
        await handleUnauthorized();
        return;
      }
      setNotice(
        result.ok
          ? {
              tone: result.created > 0 ? "success" : "info",
              text:
                name === "todas"
                  ? `${result.created} ${result.created === 1 ? "categoria criada" : "categorias criadas"}. Renomeie ou arquive as que não fizerem sentido.`
                  : result.created > 0
                    ? `Categoria “${name}” adicionada.`
                    : `A categoria “${name}” já existe.`,
            }
          : { tone: "error", text: `Não foi possível criar ${name === "todas" ? "todas as sugeridas" : `“${name}”`}. ${result.created > 0 ? `${result.created} entraram; ` : ""}toque de novo.` },
      );
      await load();
    },
    [handleUnauthorized, load, suggesting],
  );

  const archive = useCallback(
    async (category: Category) => {
      setBusyId(category.id);
      setNotice(null);
      try {
        await deactivateCategory(category.id);
        setNotice({ tone: "success", text: "Categoria arquivada. Ela continua no histórico, mas não pode mais ser atribuída." });
        setExpandedId(null);
        await reload();
      } catch (error) {
        const failure = classifyCategoryError(error, "Não foi possível arquivar a categoria.");
        if (failure.kind === "unauthorized") {
          await handleUnauthorized();
          return;
        }
        setNotice({ tone: failure.kind === "unavailable" ? "info" : "error", text: failure.message });
        if (failure.kind === "unavailable") await reload();
      } finally {
        setBusyId(null);
      }
    },
    [handleUnauthorized, reload],
  );

  const confirmArchive = useCallback(
    (category: Category) => {
      Alert.alert(
        "Arquivar categoria",
        `Arquivar “${category.name}”? Ela continua visível no histórico das movimentações, mas não poderá ser atribuída de novo nem reativada. As regras dela deixam de ser aplicadas.`,
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Arquivar", style: "destructive", onPress: () => void archive(category) },
        ],
        { cancelable: true },
      );
    },
    [archive],
  );

  const finishForm = useCallback(
    (message: string) => {
      setMode({ kind: "list" });
      setNotice({ tone: "success", text: message });
      void reload();
    },
    [reload],
  );

  // Valores só com o período lido por inteiro (regra do PRODUCT.md): nunca um número parcial.
  const covered = Boolean(scan && (scan.complete || scan.items.some((item) => item.occurredOn < range.since)));
  const usage: PeriodUsage | null = useMemo(
    () => (scan && covered ? periodUsage(scan.items, range.since, range.until) : null),
    [scan, covered, range.since, range.until],
  );

  const colorMap = useMemo(
    () => categoryColors(idsByCreation(categories), colors.categories, colors.categoryOther),
    [categories, colors.categories, colors.categoryOther],
  );
  const active = useMemo(() => categories.filter((category) => category.status === "active"), [categories]);
  const archived = useMemo(() => categories.filter((category) => category.status === "archived"), [categories]);
  const arranged = useMemo(() => arrangeCategories(active, usage?.byCategory ?? null, search, sort), [active, usage, search, sort]);
  const arrangedArchived = useMemo(() => arrangeCategories(archived, usage?.byCategory ?? null, search, "nome"), [archived, usage, search]);
  const activePage = paginate(arranged, page);
  const archivedPageData = paginate(arrangedArchived, archivedPage);
  const missing = useMemo(() => categoriesToCreate(categories), [categories]);
  const tiles = useMemo(() => suggestionTiles(SUGGESTED_CATEGORIES, categories, colorMap), [categories, colorMap]);
  const withoutRules = ruleCounts ? active.filter((category) => !ruleCounts.get(category.id)).length : 0;
  const periodName = periodLabel(period);

  if (mode.kind !== "list") {
    return (
      <CategoryFormScreen
        category={mode.kind === "rename" ? mode.category : undefined}
        onCancel={() => setMode({ kind: "list" })}
        onDone={finishForm}
      />
    );
  }

  const subtitle =
    state !== "ready"
      ? undefined
      : categories.length === 0
        ? "Organize seus gastos e veja para onde seu dinheiro vai."
        : `${active.length} ${active.length === 1 ? "categoria ativa" : "categorias ativas"}${archived.length > 0 ? ` · ${archived.length} arquivada${archived.length === 1 ? "" : "s"}` : ""}`;

  const renderRow = (category: Category) => {
    const entry = usage?.byCategory.get(category.id);
    const figure = usage ? usageFigure(entry, usage.totalExpense) : null;
    const isArchived = category.status === "archived";
    const rules = ruleCounts?.get(category.id) ?? 0;
    const expanded = expandedId === category.id;
    const busy = busyId === category.id;
    const meta = [
      figure ? `${entry?.count ?? 0} ${(entry?.count ?? 0) === 1 ? "lançamento" : "lançamentos"}` : null,
      ruleCounts ? (rules === 0 ? "sem regras" : `${rules} ${rules === 1 ? "regra" : "regras"}`) : null,
    ]
      .filter(Boolean)
      .join(" · ");
    const valueText = figure?.value ? formatMoney(figure.value) : null;
    const spoken = [
      category.name,
      isArchived ? "arquivada" : null,
      valueText ? `${figure?.kind === "recebido" ? "recebido" : "gasto"} em ${periodName}: ${valueText}` : null,
      figure?.share ? `${figure.share} das despesas` : null,
      meta,
    ]
      .filter(Boolean)
      .join(", ");

    return (
      <View key={`${category.id}:${category.updatedAt}`} style={styles.rowWrap}>
        <Pressable
          onPress={() => setExpandedId(expanded ? null : category.id)}
          accessibilityRole="button"
          accessibilityLabel={spoken}
          accessibilityHint={expanded ? "Fechar as ações" : "Abrir as ações da categoria"}
          accessibilityState={{ expanded }}
          style={({ pressed }) => [styles.row, expanded && styles.rowOpen, pressed && styles.pressed]}
        >
          <CategoryBadge name={category.name} color={isArchived ? null : (colorMap.get(category.id) ?? null)} />
          <View style={styles.rowName}>
            <View style={styles.rowTitleLine}>
              <Text style={[styles.rowTitle, isArchived && styles.rowTitleArchived]} numberOfLines={2}>
                {category.name}
              </Text>
              {isArchived ? <StatusChip tone="neutral" label={CATEGORY_STATUS_LABELS.archived} /> : null}
            </View>
            {meta ? <Text style={styles.rowMeta}>{meta}</Text> : null}
          </View>
          <View style={styles.rowFigure}>
            {valueText ? (
              <>
                <Text style={styles.rowValue}>{valueText}</Text>
                {figure?.kind === "gasto" && figure.share ? <Text style={styles.rowShare}>{figure.share}</Text> : null}
                {figure?.kind === "recebido" ? <Text style={styles.rowShare}>recebido</Text> : null}
              </>
            ) : (
              <Text style={styles.rowShare}>{figure ? "—" : ""}</Text>
            )}
          </View>
        </Pressable>
        {expanded ? (
          <View style={styles.rowActions}>
            {isArchived ? null : (
              <Button
                variant="text"
                label="Renomear"
                accessibilityLabel={`Renomear ${category.name}`}
                onPress={() => setMode({ kind: "rename", category })}
                disabled={busy}
              />
            )}
            <Button
              variant="text"
              label="Ver lançamentos"
              accessibilityLabel={`Ver lançamentos de ${category.name}`}
              onPress={() => onOpenMovements(categoryFilters(category.id, period))}
            />
            {isArchived ? null : (
              <Button
                variant="textDanger"
                label="Arquivar"
                accessibilityLabel={`Arquivar ${category.name}`}
                onPress={() => confirmArchive(category)}
                disabled={busyId !== null}
                loading={busy}
              />
            )}
          </View>
        ) : null}
      </View>
    );
  };

  const emptyList = categories.length === 0;

  return (
    <AppScreen
      section="categorias"
      onNavigate={onNavigate}
      title="Categorias"
      subtitle={subtitle}
      footer={
        state === "ready" ? (
          <Button label="Nova categoria" onPress={() => setMode({ kind: "create" })} icon={(color) => <IconPlus size={20} color={color} />} />
        ) : null
      }
    >
      {state === "loading" ? (
        <View style={styles.content}>
          <SkeletonList rows={5} />
        </View>
      ) : state === "error" ? (
        <View style={styles.content}>
          <EmptyState
            icon={(color) => <IconCategories size={24} color={color} />}
            title="Não foi possível carregar suas categorias"
            text="Pode ser uma falha momentânea de conexão ou o servidor ainda acordando (até 1 minuto). Tente de novo em alguns segundos. Suas categorias não foram alteradas."
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
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.primary} colors={[colors.primary]} />}
        >
          {notice ? <Notice tone={notice.tone} text={notice.text} action={{ label: "Fechar", onPress: () => setNotice(null) }} /> : null}

          {missing.length > 0 ? (
            <Banner
              icon={(color) => <IconLightbulb size={22} color={color} />}
              title={
                emptyList
                  ? "Comece com as categorias sugeridas"
                  : missing.length === 1
                    ? "Ainda falta 1 categoria sugerida"
                    : `Ainda faltam ${missing.length} categorias sugeridas`
              }
              text={
                emptyList
                  ? "Um conjunto básico para começar. Depois, elas são suas para renomear ou arquivar."
                  : "Adicione as que faltam para ter uma visão mais completa das suas finanças."
              }
              action={
                <Button
                  variant="secondary"
                  label={missing.length === 1 ? "Adicionar a que falta" : `Adicionar as ${missing.length} que faltam`}
                  onPress={() => void addSuggested("todas")}
                  loading={suggesting === "todas"}
                  disabled={suggesting !== null}
                  icon={(color) => <IconArrowRight size={18} color={color} />}
                />
              }
            />
          ) : null}

          <CollapsibleCard
            icon={(color) => <IconSparkles size={22} color={color} />}
            title="Categorias sugeridas"
            count={SUGGESTED_CATEGORIES.length}
            hint={missing.length === 0 ? "Todas adicionadas." : "Um toque adiciona a categoria."}
            defaultOpen={missing.length > 0}
          >
            <View style={styles.tiles}>
              {tiles.map((tile) => {
                const isMissing = tile.state === "missing";
                return (
                  <CategoryTile
                    key={tile.name}
                    name={tile.name}
                    color={tile.color}
                    state={isMissing ? "missing" : tile.state === "archived" ? "off" : "on"}
                    detail={isMissing ? (suggesting === tile.name ? "Adicionando…" : "Adicionar") : tile.state === "archived" ? "Arquivada" : "Adicionada"}
                    mark={isMissing ? "plus" : tile.state === "added" ? "check" : undefined}
                    disabled={suggesting !== null}
                    onPress={isMissing ? () => void addSuggested(tile.name) : undefined}
                    accessibilityLabel={isMissing ? `Adicionar a categoria ${tile.name}` : undefined}
                  />
                );
              })}
            </View>
          </CollapsibleCard>

          <SectionCard
            icon={(color) => <IconCategories size={22} color={color} />}
            title="Suas categorias"
            count={arranged.length}
            hint={emptyList ? undefined : `Valores em ${periodName}, sem transferências.`}
          >
            {emptyList ? null : (
              <View style={styles.tools}>
                <FilterChips
                  label="Período"
                  options={PERIOD_OPTIONS}
                  value={period}
                  onChange={(next) => {
                    setPeriod(next);
                    setPage(1);
                    setArchivedPage(1);
                  }}
                />
                <SearchField
                  value={search}
                  onChange={(next) => {
                    setSearch(next);
                    setPage(1);
                    setArchivedPage(1);
                  }}
                  placeholder="Buscar categoria"
                />
                <FilterChips
                  label="Ordenar"
                  options={SORT_OPTIONS}
                  value={sort}
                  onChange={(next) => {
                    setSort(next);
                    setPage(1);
                  }}
                />
              </View>
            )}

            {scan && !covered ? (
              <View style={styles.inlineNotice}>
                <Notice tone="info" text={`Este período tem mais de ${PERIOD_SCAN_LIMIT} lançamentos: escolha um período menor para ver os valores por categoria.`} />
              </View>
            ) : scanLoading && !usage ? (
              <Text style={styles.inlineText}>Calculando os valores do período…</Text>
            ) : null}

            {emptyList ? (
              <Text style={styles.inlineText}>Nenhuma categoria ainda. Adicione as sugeridas acima ou crie a sua em “Nova categoria”.</Text>
            ) : arranged.length === 0 ? (
              <Text style={styles.inlineText}>Nenhuma categoria ativa combina com a busca.</Text>
            ) : (
              <View>
                {activePage.items.map(renderRow)}
                {usage && usage.uncategorizedExpense > BigInt(0) && search === "" ? (
                  <Pressable
                    onPress={() => onOpenMovements(reviewFilters(usage.reviewKinds, period))}
                    accessibilityRole="button"
                    accessibilityLabel={`A revisar: ${usage.uncategorizedCount} ${usage.uncategorizedCount === 1 ? "despesa" : "despesas"}, ${formatMoney(fromCents(usage.uncategorizedExpense))}. Abrir as movimentações a revisar`}
                    style={({ pressed }) => [styles.row, styles.reviewRow, pressed && styles.pressed]}
                  >
                    <View style={styles.reviewBadge}>
                      <Text style={styles.reviewMark}>?</Text>
                    </View>
                    <View style={styles.rowName}>
                      <Text style={styles.rowTitle}>A revisar</Text>
                      <Text style={styles.rowMeta}>
                        {usage.uncategorizedCount} {usage.uncategorizedCount === 1 ? "despesa sem categoria ou incerta" : "despesas sem categoria ou incertas"}
                      </Text>
                    </View>
                    <View style={styles.rowFigure}>
                      <Text style={styles.rowValue}>{formatMoney(fromCents(usage.uncategorizedExpense))}</Text>
                      <Text style={styles.rowShare}>{expenseShare(usage.uncategorizedExpense, usage.totalExpense)}</Text>
                    </View>
                  </Pressable>
                ) : null}
                {usage ? (
                  <Text style={styles.total}>
                    {usage.totalExpense > BigInt(0)
                      ? `Total de despesas em ${periodName}: ${formatMoney(fromCents(usage.totalExpense))}`
                      : `Nenhuma despesa em ${periodName}.`}
                  </Text>
                ) : null}
                <Pager page={activePage.page} pages={activePage.pages} onChange={setPage} label="Páginas das categorias" />
              </View>
            )}
          </SectionCard>

          {archivedPageData.items.length > 0 ? (
            <CollapsibleCard title="Arquivadas" count={arrangedArchived.length}>
              <View>
                {archivedPageData.items.map(renderRow)}
                <Pager page={archivedPageData.page} pages={archivedPageData.pages} onChange={setArchivedPage} label="Páginas das arquivadas" />
              </View>
            </CollapsibleCard>
          ) : null}

          {truncated ? <Notice tone="info" text={`Você tem mais de ${SELECTOR_ITEM_LIMIT} categorias: a lista mostra só as primeiras.`} /> : null}

          {ruleCounts && active.length > 0 ? (
            <Banner
              icon={(color) => <IconRules size={22} color={color} />}
              title="Automatize ainda mais com regras"
              text={`${withoutRules > 0 ? `${withoutRules} ${withoutRules === 1 ? "categoria ainda não tem" : "categorias ainda não têm"} regra. ` : "Todas as suas categorias têm regra. "}Regras categorizam sozinhas os lançamentos novos, como “se a descrição contém Uber, use Transporte”.`}
              action={<Button variant="secondary" label="Gerenciar regras" onPress={() => onNavigate("regras")} icon={(color) => <IconArrowRight size={18} color={color} />} />}
            />
          ) : null}
        </ScrollView>
      )}
    </AppScreen>
  );
}

const useStyles = makeStyles((c) => ({
  content: { paddingHorizontal: 20, paddingBottom: 24, gap: 14, flexGrow: 1 },
  pressed: { opacity: 0.88 },
  tiles: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 8, paddingBottom: 12 },
  tools: { gap: 10, paddingHorizontal: 16, paddingBottom: 12 },
  inlineNotice: { paddingHorizontal: 16, paddingBottom: 12 },
  inlineText: { ...type.bodySmall, color: c.muted, paddingHorizontal: 16, paddingBottom: 16 },
  rowWrap: { borderTopWidth: 1, borderTopColor: c.line },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 64, paddingHorizontal: 16, paddingVertical: 10 },
  rowOpen: { backgroundColor: c.surfaceSoft },
  rowName: { flex: 1, gap: 2 },
  rowTitleLine: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
  rowTitle: { ...type.body, fontFamily: "Manrope_700Bold", color: c.foreground, flexShrink: 1 },
  rowTitleArchived: { fontFamily: "Manrope_600SemiBold", color: c.muted },
  rowMeta: { ...type.micro, fontFamily: "Manrope_500Medium", color: c.muted },
  rowFigure: { alignItems: "flex-end", minWidth: 84 },
  rowValue: { ...type.amount, fontSize: 14, lineHeight: 20, color: c.foreground },
  rowShare: { ...type.micro, color: c.muted, fontVariant: ["tabular-nums"] },
  rowActions: { flexDirection: "row", flexWrap: "wrap", gap: 20, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: c.surfaceSoft },
  reviewRow: { borderTopWidth: 1, borderTopColor: c.line, backgroundColor: `${c.warning}12` },
  reviewBadge: { width: 36, height: 36, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderStyle: "dashed", borderColor: c.warning },
  reviewMark: { ...type.label, color: c.warning },
  total: { ...type.micro, color: c.muted, textAlign: "right", paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: c.line },
}));
