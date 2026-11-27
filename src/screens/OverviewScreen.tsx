import { type ReactNode, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { formatCivilDate } from "../lib/civil-date";
import { formatMoney } from "../lib/money";
import { DONUT_OTHER_ID, formatShare } from "../lib/overview/chart-model";
import {
  attentionItems,
  formatChange,
  formatDay,
  formatReference,
  freshnessChip,
  monthRange,
  monthShort,
  movementCategory,
  movementsTitle,
  pageRange,
  periodTitle,
  SOURCE_LABELS,
  splitAccounts,
  toDonutItems,
} from "../lib/overview/presentation";
import {
  getAvailableDaily,
  getBalances,
  getDailyFlow,
  getFlow,
  getRecentMovements,
  getSpending,
  getSpendingMovements,
  listPeriods,
  MOVEMENTS_PAGE_SIZE,
  parseCategory,
  type OverviewPeriod,
} from "../lib/overview/source";
import type { AccountBalance, FlowMonth, RecentMovement } from "../lib/overview/types";
import { makeStyles, radius, type, useTheme } from "../theme";
import { Button, Notice, StatusChip } from "../ui/controls";
import {
  type DailyPoint,
  OverviewDailyChart,
  OverviewDonut,
  OverviewFlowChart,
  OverviewSparkline,
} from "../ui/overview-charts";
import { AppScreen, type Section } from "../ui/screens";
import { ACCOUNT_TYPE_LABELS } from "./account-type-labels";

const PERIODS = listPeriods();
const CURRENT_PERIOD = PERIODS[0];
const CATEGORY_COLORS = {
  light: ["#3b72c4", "#d0683a", "#1f9a8a", "#d39a1a", "#c95b8a", "#6c5bd0"],
  dark: ["#4a80d6", "#d0683a", "#219a89", "#b88518", "#cc5f8e", "#8576e0"],
};
const DAILY_TITLES = {
  available: "Disponível nos últimos 30 dias",
  inflow: "Entradas nos últimos 30 dias",
  outflow: "Saídas nos últimos 30 dias",
};
type FigureKey = keyof typeof DAILY_TITLES;
type Navigate = (section: Section) => void;

export function OverviewScreen({ onNavigate }: { onNavigate: Navigate }) {
  const styles = useStyles();
  const [period, setPeriod] = useState(CURRENT_PERIOD);
  const partial = period === CURRENT_PERIOD;

  return (
    <AppScreen
      section="visao-geral"
      onNavigate={onNavigate}
      title="Visão geral"
      subtitle={periodTitle(period) + (partial ? " · parcial" : "")}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <Notice tone="info" text="Prévia com dados de exemplo. Os valores exibidos são fictícios." />
        <View>
          <Text style={styles.heading} accessibilityRole="header">Período</Text>
          <View style={styles.periods}>
            {PERIODS.map((month) => (
              <Pressable
                key={month}
                onPress={() => setPeriod(month)}
                accessibilityRole="button"
                accessibilityLabel={periodTitle(month) + (month === CURRENT_PERIOD ? ", parcial" : "")}
                accessibilityState={{ selected: month === period }}
                style={({ pressed }) => [
                  styles.period,
                  month === period && styles.selected,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.label}>
                  {monthShort(month)}{month === CURRENT_PERIOD ? " · parcial" : ""}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
        <PeriodOverview key={period} period={period} onNavigate={onNavigate} />
      </ScrollView>
    </AppScreen>
  );
}

function PeriodOverview({ period, onNavigate }: { period: OverviewPeriod; onNavigate: Navigate }) {
  const styles = useStyles();
  const balances = getBalances(period);
  const spending = getSpending(period);
  const recent = getRecentMovements();
  const { accounts, cards } = splitAccounts(balances.accounts);
  const attention = attentionItems(balances, spending);
  const [detailsOpen, setDetailsOpen] = useState(false);

  return (
    <>
      <Panel title="Resumo do período">
        <Figures period={period} />
      </Panel>
      <SpendingPanel
        period={period}
        detailsOpen={detailsOpen}
        setDetailsOpen={setDetailsOpen}
      />
      <FlowPanel
        period={period}
        detailsOpen={detailsOpen}
        setDetailsOpen={setDetailsOpen}
      />
      <Panel
        title="Últimas movimentações"
        action={<Button label="Ver todas" variant="text" onPress={() => onNavigate("movimentacoes")} />}
      >
        {recent.length ? <MovementList items={recent} /> : <Text style={styles.meta}>Nenhuma movimentação.</Text>}
      </Panel>
      <Panel title="Pede sua atenção">
        {attention.length ? attention.map((item) => (
          <View key={item.id} style={styles.detailRow}>
            <Notice
              tone={item.tone === "info" ? "info" : "warning"}
              text={item.title + "\n" + item.text}
              action={{ label: item.action.label, onPress: () => onNavigate(item.action.section) }}
            />
          </View>
        )) : <Text style={styles.meta}>Nenhum ponto de atenção no período.</Text>}
      </Panel>
      <Panel title="Saldos por conta">
        <AccountBalances accounts={accounts} />
        {cards.length ? (
          <>
            <Text style={styles.heading} accessibilityRole="header">Cartões de crédito</Text>
            <Text style={styles.meta}>Os cartões ficam fora do Disponível.</Text>
            <AccountBalances accounts={cards} />
          </>
        ) : null}
      </Panel>
    </>
  );
}

function Figures({ period }: { period: OverviewPeriod }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [opened, setOpened] = useState<FigureKey | null>(null);
  const balances = getBalances(period);
  const { months } = getFlow(period);
  const current = months[months.length - 1];
  const previous = months.at(-2);
  const priorBalance = balances.history.at(-2);

  const figures = [
    {
      key: "available",
      label: "Disponível",
      value: balances.available,
      change: priorBalance ? formatChange(balances.available, priorBalance.available, priorBalance.month) : null,
      meta: balances.availableAccounts + " contas · ref. " + formatReference(balances.asOf),
      values: balances.history.map((entry) => entry.available),
      color: colors.primary,
    },
    ...(["inflow", "outflow"] as const).map((key) => ({
      key,
      label: key === "inflow" ? "Entradas do período" : "Saídas do período",
      value: current[key],
      change: current.partial
        ? "Mês em andamento, sem comparação"
        : previous ? formatChange(current[key], previous[key], previous.month) : null,
      meta: current[key] === "0.00"
        ? (key === "inflow" ? "Nenhuma entrada no período" : "Nenhuma saída no período")
        : periodTitle(period) + (current.partial ? " · parcial" : ""),
      values: months.map((entry) => entry[key]),
      color: key === "inflow" ? colors.positive : colors.negative,
    })),
  ] satisfies { key: FigureKey; label: string; value: string; change: string | null; meta: string; values: string[]; color: string }[];

  return figures.map(({ key, label, value, change, meta, values, color }) => (
    <View key={key}>
      <Pressable
        onPress={() => setOpened((open) => open === key ? null : key)}
        accessibilityRole="button"
        accessibilityLabel={label + ", " + formatMoney(value) + ", " + meta + (change ? ", " + change : "")}
        accessibilityHint="Abre ou fecha o gráfico dos últimos 30 dias"
        accessibilityState={{ expanded: opened === key }}
        style={({ pressed }) => [styles.figure, pressed && styles.pressed]}
      >
        <View style={styles.rowMain}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.figureValue}>{formatMoney(value)}</Text>
          {change ? <Text style={styles.label}>{change}</Text> : null}
          <Text style={styles.meta}>{meta}</Text>
        </View>
        <OverviewSparkline values={values} color={color} partialLast={key !== "available" && current.partial} />
        <Text style={styles.disclosureMark}>{opened === key ? "−" : "+"}</Text>
      </Pressable>
      {key === "available" && balances.includesStale ? (
        <StatusChip tone="warning" label="Inclui conta desatualizada" />
      ) : null}
      {opened === key ? <DailyDetails period={period} figure={key} color={color} /> : null}
    </View>
  ));
}

function DailyDetails({ period, figure, color }: { period: OverviewPeriod; figure: FigureKey; color: string }) {
  const styles = useStyles();
  const [showValues, setShowValues] = useState(false);
  const series: DailyPoint[] = figure === "available"
    ? getAvailableDaily(period).points.map(({ date, available }) => ({ date, value: available }))
    : getDailyFlow(period, figure).points.map(({ date, amount }) => ({ date, value: amount }));

  return (
    <View style={styles.daily}>
      <Text style={styles.heading} accessibilityRole="header">{DAILY_TITLES[figure]}</Text>
      <OverviewDailyChart series={series} color={color} />
      <Disclosure label="Valores por dia" open={showValues} onToggle={() => setShowValues(!showValues)} />
      {showValues ? series.map(({ date, value }) => (
        <ValueRow key={date} title={formatCivilDate(date)} value={formatMoney(value)} />
      )) : null}
    </View>
  );
}

interface PeriodPanelProps {
  period: OverviewPeriod;
  detailsOpen: boolean;
  setDetailsOpen: (open: boolean) => void;
}

function SpendingPanel({ period, detailsOpen, setDetailsOpen }: PeriodPanelProps) {
  const styles = useStyles();
  const { colors, scheme } = useTheme();
  const [filter, setFilter] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const spending = getSpending(period);
  const slices = toDonutItems(spending, CATEGORY_COLORS[scheme], colors.muted);
  const selected = parseCategory(filter, spending);
  const movements = getSpendingMovements(period, { category: selected, page });
  const selectedLabel = slices.find((item) => item.id === selected)?.label ?? null;

  function selectCategory(id: string) {
    if (id === DONUT_OTHER_ID) return;
    setFilter(id === selected ? null : id);
    setPage(1);
    setDetailsOpen(true);
  }

  if (spending.total === "0.00") {
    return (
      <Panel title="Gastos por categoria">
        <Text style={styles.meta}>Nenhuma saída no período.</Text>
      </Panel>
    );
  }

  return (
    <Panel title="Gastos por categoria">
      <OverviewDonut items={slices} total={spending.total} selected={selected} onSelect={selectCategory} />
      {slices.map((item) => {
        const content = (
          <>
            <View style={[styles.swatch, { backgroundColor: item.color }]} />
            <Text style={[styles.label, styles.rowMain]}>{item.label}</Text>
            <Text style={styles.meta}>{formatShare(item.value, spending.total)}</Text>
            <Text style={styles.amount}>{formatMoney(item.value)}</Text>
          </>
        );
        return item.id === DONUT_OTHER_ID ? (
          <View key={item.id} style={styles.legendRow}>{content}</View>
        ) : (
          <Pressable
            key={item.id}
            onPress={() => selectCategory(item.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: selected === item.id }}
            style={({ pressed }) => [
              styles.legendRow,
              selected === item.id && styles.selected,
              pressed && styles.pressed,
            ]}
          >
            {content}
          </Pressable>
        );
      })}
      <Text style={styles.heading} accessibilityRole="header">{movementsTitle(period, selectedLabel)}</Text>
      <View style={styles.inline}>
        <Text style={styles.meta} accessibilityLiveRegion="polite">
          {pageRange(movements.page, MOVEMENTS_PAGE_SIZE, movements.total)}
        </Text>
        {selected ? (
          <Button label="Mostrar todas" variant="text" onPress={() => selectCategory(selected)} />
        ) : null}
      </View>
      <Disclosure label="Ver saídas" open={detailsOpen} onToggle={() => setDetailsOpen(!detailsOpen)} />
      {detailsOpen ? <MovementList items={movements.items.map((item) => ({ ...item, direction: "outflow" }))} /> : null}
      <Pagination
        page={movements.page}
        pages={movements.pages}
        label="saídas"
        onChange={(target) => { setPage(target); setDetailsOpen(true); }}
      />
    </Panel>
  );
}

function FlowPanel({ period, detailsOpen, setDetailsOpen }: PeriodPanelProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [page, setPage] = useState(1);
  const flow = getFlow(period, page);

  return (
    <Panel title="Entradas e saídas por mês">
      <Text style={styles.meta}>{monthRange(flow.months[0].month, flow.months[flow.months.length - 1].month)}</Text>
      <View style={styles.inline}>
        <View style={styles.legendKey}>
          <View style={[styles.swatch, { backgroundColor: colors.positive }]} />
          <Text style={styles.label}>Entradas</Text>
        </View>
        <View style={styles.legendKey}>
          <View style={[styles.swatch, { backgroundColor: colors.negative }]} />
          <Text style={styles.label}>Saídas</Text>
        </View>
      </View>
      <OverviewFlowChart months={flow.months} />
      {flow.months.some((month) => month.partial) ? <Text style={styles.meta}>* Mês parcial</Text> : null}
      <Disclosure label="Valores por mês" open={detailsOpen} onToggle={() => setDetailsOpen(!detailsOpen)} />
      {detailsOpen ? [...flow.months].reverse().map((month) => <MonthValues key={month.month} month={month} />) : null}
      <Pagination
        page={flow.page}
        pages={flow.pages}
        label="meses"
        onChange={(target) => { setPage(target); setDetailsOpen(true); }}
      />
    </Panel>
  );
}

function MonthValues({ month }: { month: FlowMonth }) {
  const styles = useStyles();
  return (
    <View style={styles.detailRow}>
      <Text style={styles.heading}>{periodTitle(month.month)}{month.partial ? " · parcial" : ""}</Text>
      <ValueRow title="Entradas" value={formatMoney(month.inflow)} />
      <ValueRow title="Saídas" value={formatMoney(month.outflow)} />
      <ValueRow title="Resultado" value={formatMoney(month.net)} />
    </View>
  );
}

function MovementList({ items }: { items: readonly RecentMovement[] }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return items.map((item) => {
    const sign = item.direction === "transfer" ? "" : item.direction === "inflow" ? "+ " : "− ";
    const color = item.direction === "transfer" ? colors.foreground : item.direction === "inflow" ? colors.positive : colors.negative;
    return (
      <View key={item.transactionId} style={styles.detailRow}>
        <ValueRow
          title={item.description ?? "Sem descrição"}
          value={sign + formatMoney(item.amount)}
          color={color}
        />
        <Text style={styles.meta}>{[formatDay(item.date), movementCategory(item), item.accountName].join(" · ")}</Text>
      </View>
    );
  });
}

function AccountBalances({ accounts }: { accounts: readonly AccountBalance[] }) {
  const styles = useStyles();
  return accounts.map((account) => {
    const status = freshnessChip(account.freshness);
    return (
      <View key={account.accountId} style={styles.detailRow}>
        <ValueRow title={account.name} value={account.freshness === "unavailable" ? "Indisponível" : formatMoney(account.balance)} />
        <Text style={styles.meta}>
          {[ACCOUNT_TYPE_LABELS[account.type], account.institutionName, SOURCE_LABELS[account.source]].filter(Boolean).join(" · ")}
        </Text>
        <Text style={styles.meta}>Ref. {formatReference(account.asOf)}</Text>
        {status ? <StatusChip {...status} /> : null}
      </View>
    );
  });
}

function ValueRow({ title, value, color }: { title: string; value: string; color?: string }) {
  const styles = useStyles();
  return (
    <View style={styles.valueRow}>
      <Text style={[styles.label, styles.rowMain]}>{title}</Text>
      <Text style={[styles.amount, color ? { color } : undefined]}>{value}</Text>
    </View>
  );
}

function Panel({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.panel}>
      <View style={styles.valueRow}>
        <Text style={[styles.heading, styles.rowMain]} accessibilityRole="header">{title}</Text>
        {action}
      </View>
      {children}
    </View>
  );
}

function Disclosure({ label, open, onToggle }: { label: string; open: boolean; onToggle: () => void }) {
  const styles = useStyles();
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      style={({ pressed }) => [styles.disclosure, pressed && styles.pressed]}
    >
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.disclosureMark} importantForAccessibility="no">{open ? "−" : "+"}</Text>
    </Pressable>
  );
}

function Pagination({ page, pages, label, onChange }: {
  page: number; pages: number; label: string; onChange: (page: number) => void;
}) {
  const styles = useStyles();
  if (pages <= 1) return null;
  return (
    <View style={styles.inline}>
      <Button label="Anterior" accessibilityLabel={"Página anterior de " + label} variant="text" disabled={page === 1} onPress={() => onChange(page - 1)} />
      <Text style={styles.meta} accessibilityLiveRegion="polite">{page} de {pages}</Text>
      <Button label="Próxima" accessibilityLabel={"Próxima página de " + label} variant="text" disabled={page === pages} onPress={() => onChange(page + 1)} />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  content: { paddingHorizontal: 16, paddingBottom: 24, gap: 14, width: "100%", maxWidth: 640, alignSelf: "center" },
  panel: { backgroundColor: c.surface, borderColor: c.line, borderWidth: 1, borderRadius: radius.panel, padding: 14, gap: 8 },
  heading: { ...type.sectionTitle, color: c.foreground },
  label: { ...type.label, color: c.foreground },
  meta: { ...type.micro, color: c.muted },
  amount: { ...type.amount, color: c.foreground, flexShrink: 1, textAlign: "right" },
  figureValue: { ...type.amount, fontSize: 23, lineHeight: 30, color: c.foreground },
  periods: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
  period: { borderWidth: 1, borderColor: c.line, borderRadius: radius.pill, paddingHorizontal: 12, minHeight: 44, justifyContent: "center", backgroundColor: c.surface },
  selected: { backgroundColor: c.primaryTint, borderColor: c.primary },
  pressed: { opacity: 0.75 },
  inline: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", columnGap: 8 },
  valueRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  rowMain: { flex: 1, flexBasis: 0 },
  figure: { borderTopWidth: 1, borderTopColor: c.line, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44 },
  daily: { backgroundColor: c.surfaceSoft, borderRadius: radius.control, padding: 8, gap: 4, marginTop: 8 },
  disclosure: { backgroundColor: c.surfaceSoft, borderRadius: radius.control, paddingHorizontal: 8, minHeight: 44, flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  disclosureMark: { ...type.sectionTitle, color: c.primary },
  detailRow: { borderTopWidth: 1, borderTopColor: c.line, paddingVertical: 7, gap: 4 },
  legendRow: { minHeight: 44, paddingHorizontal: 5, flexDirection: "row", alignItems: "center", gap: 5, borderRadius: radius.control, borderWidth: 1, borderColor: "transparent" },
  legendKey: { flexDirection: "row", alignItems: "center", gap: 5 },
  swatch: { width: 10, height: 10, borderRadius: radius.pill },
}));
