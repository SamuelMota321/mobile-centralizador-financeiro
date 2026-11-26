import { Text, View } from "react-native";
import Svg, { Circle, G, Line, Path, Polyline, Rect, Text as SvgText } from "react-native-svg";
import { formatMoney } from "../lib/money";
import { DONUT_OTHER_ID, donutArcs, toGeometry, type DonutItem } from "../lib/overview/chart-model";
import { formatDay, monthShort } from "../lib/overview/presentation";
import type { FlowMonth } from "../lib/overview/types";
import { makeStyles, type, useTheme } from "../theme";

const WIDTH = 320;
const HEIGHT = 138;
const CHART_VIEW_BOX = ["0", "0", WIDTH, HEIGHT].join(" ");
const PLOT_TOP = 12;
const PLOT_BOTTOM = 110;
const PLOT_LEFT = 39;
const PLOT_RIGHT = WIDTH - 12;
const GRID_FRACTIONS = [0, 0.5, 1] as const;

const tick = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

function ChartGrid({ min, max, color, muted }: { min: number; max: number; color: string; muted: string }) {
  return GRID_FRACTIONS.map((fraction) => {
    const y = PLOT_BOTTOM - (PLOT_BOTTOM - PLOT_TOP) * fraction;
    return (
      <G key={fraction}>
        <Line x1={PLOT_LEFT} x2={PLOT_RIGHT} y1={y} y2={y} stroke={color} />
        <SvgText fill={muted} x={PLOT_LEFT - 6} y={y + 4} fontSize={11} textAnchor="end">
          {tick.format(min + (max - min) * fraction)}
        </SvgText>
      </G>
    );
  });
}

function linePoints(values: readonly number[], x0: number, x1: number, y0: number, y1: number, min: number, max: number) {
  return values.map((value, index) => ({
    x: x0 + ((x1 - x0) * index) / Math.max(1, values.length - 1),
    y: y1 - (y1 - y0) * (max === min ? 0.5 : (value - min) / (max - min)),
  }));
}

export function OverviewSparkline({ values, color, partialLast }: { values: readonly string[]; color: string; partialLast?: boolean }) {
  if (values.length < 2) return null;
  const numbers = values.map(toGeometry);
  const points = linePoints(numbers, 2, 78, 4, 28, Math.min(...numbers), Math.max(...numbers));
  const solid = partialLast ? points.slice(0, -1) : points;
  const lastPair = partialLast ? points.slice(-2) : [];
  return (
    <Svg width={80} height={32} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Polyline points={solid.map(({ x, y }) => x + "," + y).join(" ")} fill="none" stroke={color} strokeWidth={2} />
      {partialLast ? (
        <Polyline points={lastPair.map(({ x, y }) => x + "," + y).join(" ")} fill="none" stroke={color} strokeWidth={2} strokeDasharray="3 3" />
      ) : null}
    </Svg>
  );
}

export interface DailyPoint {
  date: string;
  value: string;
}

export function OverviewDailyChart({ series, color }: { series: readonly DailyPoint[]; color: string }) {
  const { colors } = useTheme();
  if (!series.length) return null;
  const numbers = series.map((point) => toGeometry(point.value));
  const min = Math.min(...numbers);
  const highest = Math.max(...numbers);
  const max = highest === min ? min + 1 : highest;
  const points = linePoints(numbers, PLOT_LEFT, PLOT_RIGHT, PLOT_TOP, PLOT_BOTTOM, min, max);
  const last = points[points.length - 1];
  return (
    <Svg width="100%" height={HEIGHT} viewBox={CHART_VIEW_BOX} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <ChartGrid min={min} max={max} color={colors.line} muted={colors.muted} />
      <Polyline points={points.map(({ x, y }) => x + "," + y).join(" ")} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" />
      <Circle cx={last.x} cy={last.y} r={3.5} fill={color} />
      <SvgText x={PLOT_LEFT} y={HEIGHT - 7} fontSize={11} fill={colors.muted}>{formatDay(series[0].date)}</SvgText>
      <SvgText x={PLOT_RIGHT} y={HEIGHT - 7} fontSize={11} fill={colors.muted} textAnchor="end">{formatDay(series[series.length - 1].date)}</SvgText>
    </Svg>
  );
}

export function OverviewFlowChart({ months }: { months: readonly FlowMonth[] }) {
  const { colors } = useTheme();
  if (!months.length) return null;
  const moneys = months.map(({ month, inflow, outflow, partial }) => ({
    month,
    inflow: toGeometry(inflow),
    outflow: toGeometry(outflow),
    partial,
  }));
  const max = Math.max(1, ...moneys.flatMap(({ inflow, outflow }) => [inflow, outflow]));
  const step = (PLOT_RIGHT - PLOT_LEFT) / moneys.length;
  const bar = Math.min(20, (step - 8) / 2);
  return (
    <Svg width="100%" height={HEIGHT} viewBox={CHART_VIEW_BOX} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <ChartGrid min={0} max={max} color={colors.line} muted={colors.muted} />
      {moneys.map(({ month, inflow, outflow, partial }, index) => {
        const x = PLOT_LEFT + step * (index + 0.5);
        const heightIn = ((PLOT_BOTTOM - PLOT_TOP) * inflow) / max;
        const heightOut = ((PLOT_BOTTOM - PLOT_TOP) * outflow) / max;
        return (
          <G key={month}>
            <Rect x={x - bar - 1} y={PLOT_BOTTOM - heightIn} width={bar} height={heightIn} rx={2} fill={colors.positive} opacity={partial ? 0.6 : 1} />
            <Rect x={x + 1} y={PLOT_BOTTOM - heightOut} width={bar} height={heightOut} rx={2} fill={colors.negative} opacity={partial ? 0.6 : 1} />
            <SvgText x={x} y={HEIGHT - 7} fontSize={11} fill={colors.muted} textAnchor="middle">
              {monthShort(month)}{partial ? "*" : ""}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
}

const DONUT_RADIUS = 65;
const DONUT_CENTER = 84;
const CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;

function pointOnDonut(distance: number): string {
  const angle = distance / DONUT_RADIUS - Math.PI / 2;
  const x = DONUT_CENTER + Math.cos(angle) * DONUT_RADIUS;
  const y = DONUT_CENTER + Math.sin(angle) * DONUT_RADIUS;
  return x + " " + y;
}

export function OverviewDonut({
  items,
  total,
  selected,
  onSelect,
}: {
  items: readonly DonutItem[];
  total: string;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const arcs = donutArcs(items, total, CIRCUMFERENCE);
  return (
    <View style={styles.donut}>
      <View style={styles.donutText} pointerEvents="none">
        <Text style={styles.totalLabel}>Total de saídas</Text>
        <Text style={styles.total}>{formatMoney(total)}</Text>
      </View>
      <Svg width={168} height={168} viewBox="0 0 168 168" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Circle cx={DONUT_CENTER} cy={DONUT_CENTER} r={DONUT_RADIUS} fill="none" stroke={colors.line} strokeWidth={18} />
        {arcs.map(({ id, length, start }, index) => {
          const item = items[index];
          if (length === 0) return null;
          const onPress = id === DONUT_OTHER_ID ? undefined : () => onSelect(id);
          if (length >= CIRCUMFERENCE) {
            return <Circle key={id} cx={DONUT_CENTER} cy={DONUT_CENTER} r={DONUT_RADIUS} fill="none" stroke={item.color} strokeWidth={18} onPress={onPress} />;
          }
          const largeArc = length > CIRCUMFERENCE / 2 ? 1 : 0;
          const path = [
            "M", pointOnDonut(start),
            "A", DONUT_RADIUS, DONUT_RADIUS, 0, largeArc, 1, pointOnDonut(start + length),
          ].join(" ");
          return (
            <Path
              key={id}
              d={path}
              fill="none"
              stroke={item.color}
              strokeWidth={18}
              strokeDasharray={item.review ? "3 2" : undefined}
              opacity={selected === null || selected === id ? 1 : 0.4}
              onPress={onPress}
            />
          );
        })}
      </Svg>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  donut: { width: 168, height: 168, alignSelf: "center", justifyContent: "center", alignItems: "center" },
  donutText: { position: "absolute", width: 110, alignItems: "center" },
  totalLabel: { ...type.micro, color: c.muted, textAlign: "center" },
  total: { ...type.amount, color: c.foreground, textAlign: "center" },
}));
