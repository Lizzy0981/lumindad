/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  LumindAd · Charts · BarChart
 *  src/components/charts/BarChart.tsx
 *
 *  Purpose
 *   Reusable wrapper around Recharts BarChart that applies the
 *   LumindAd visual language: rounded bar tops, dark grid, branded
 *   axes, configurable bar gap, and the shared CustomTooltip.
 *
 *  Used in
 *   BudgetPage — "Daily Spend vs Budget" panel
 *     data      : budgetData ({day, budget, spend})
 *     series    : [
 *       { dataKey:'spend',  name:'Actual Spend',  color:'#7c3aed', opacity:0.85 },
 *       { dataKey:'budget', name:'Budget Target', color:'#1e1e35' },
 *     ]
 *     height    : 240px
 *     barGap    : 4   (from LumindAd.jsx <BarChart barGap={4}>)
 *
 *  Rounded bar corners
 *   Recharts Bar accepts radius as [topLeft, topRight, bottomRight, bottomLeft].
 *   LumindAd uses [4, 4, 0, 0] — rounded top, flat bottom — which gives the
 *   modern "pillar" appearance used throughout the platform.
 *   Per-series radius override is supported for grouped bars where a
 *   background series (budget) needs flat corners to read as a track.
 *
 *  Layout mode
 *   Supports both "vertical" (default, value on Y-axis) and "horizontal"
 *   (value on X-axis) layouts. Horizontal mode is useful for ranked
 *   lists (e.g. "Top Campaigns by ROAS") where category labels are long.
 *
 *  Axis design tokens (from LumindAd.jsx BarChart instance)
 *   axis line stroke   #334155
 *   tick fill          #64748b
 *   tick fontSize      11px
 *   grid stroke        rgba(124, 58, 237, 0.08)
 *   grid dashArray     "3 3"
 *
 *  Accessibility (WCAG 2.1 AA)
 *   – role="img" + aria-label describes the chart to screen readers
 *   – swatchShape="square" is passed to CustomTooltip — square colour
 *     indicators are semantically appropriate for bar series
 *   – Optional summary prop provides a text alternative
 *
 *  Author : Elizabeth Díaz Familia
 *           AI Data Scientist · Sustainable Intelligence & BI
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import {
  BarChart  as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts';

import { CustomTooltip } from './CustomTooltip';
import type { CustomTooltipProps } from './CustomTooltip';

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Recharts bar radius tuple: [topLeft, topRight, bottomRight, bottomLeft].
 * All values in pixels.
 */
export type BarRadius = [number, number, number, number];

/** Configuration for a single bar series. */
export interface BarSeries {
  /** Key in each data object to read the bar height from. */
  dataKey: string;
  /**
   * Human-readable label — shown in tooltip and optional legend.
   * Falls back to dataKey.
   */
  name?: string;
  /**
   * Fill colour for all bars in this series.
   * @default "#7c3aed"
   */
  color?: string;
  /**
   * Per-value colour override. When provided, each bar uses the
   * colour returned by this function instead of the series colour.
   * Useful for coloring individual bars by value (e.g. red when
   * spend exceeds budget).
   *
   * @param value     - The data value for this bar.
   * @param dataIndex - Zero-based index of the bar in the dataset.
   * @returns A CSS colour string, or undefined to fall back to color.
   *
   * @example
   * // Red when over budget, purple otherwise
   * cellColor={(v, i) => budgetData[i].spend > budgetData[i].budget ? '#ef4444' : '#7c3aed'}
   */
  cellColor?: (value: number, dataIndex: number) => string | undefined;
  /**
   * Opacity of the bars (0–1).
   * @default 1
   */
  opacity?: number;
  /**
   * Corner radius of each bar. Tuple: [TL, TR, BR, BL].
   * @default [4, 4, 0, 0]   — rounded top, flat bottom
   */
  radius?: BarRadius;
}

export interface BarChartProps {
  /** Array of data objects. Each object is one group of bars. */
  data: Record<string, unknown>[];
  /**
   * Key in each data object used for the x-axis category labels.
   * @example "day" | "platform" | "campaign"
   */
  xDataKey: string;
  /** One or more bar series. */
  series: BarSeries[];
  /**
   * Chart height in pixels.
   * @default 240
   */
  height?: number;
  /**
   * Layout orientation.
   * "vertical"   — bars grow upward (standard column chart)
   * "horizontal" — bars grow rightward (horizontal bar chart)
   * @default "vertical"
   */
  layout?: 'vertical' | 'horizontal';
  /**
   * Gap between grouped bars within a single x-axis tick.
   * Matches the barGap={4} in the LumindAd.jsx BudgetPage.
   * @default 4
   */
  barGap?: number;
  /**
   * Value formatter applied to tooltip rows.
   * @example (v) => `$${Number(v).toLocaleString()}`
   */
  formatter?: CustomTooltipProps['formatter'];
  /** Label formatter for the tooltip header. */
  labelFormatter?: CustomTooltipProps['labelFormatter'];
  /**
   * When true, renders a Recharts <Legend /> below the chart.
   * @default false
   */
  showLegend?: boolean;
  /**
   * Accessible label for the chart region.
   * @example "Daily spend versus budget target"
   */
  ariaLabel?: string;
  /**
   * Visually hidden text alternative for screen reader users.
   * @example "Spend exceeded budget on Tuesday and Thursday."
   */
  summary?: string;
}

// ─── Design tokens ────────────────────────────────────────────────────────────

const GRID_STROKE     = 'rgba(124, 58, 237, 0.08)';
const AXIS_STROKE     = '#334155';
const TICK_FILL       = '#64748b';
const TICK_FONT       = 11;
const DEFAULT_RADIUS: BarRadius = [4, 4, 0, 0];
const LEGEND_STYLE    = {
  fontSize:   '11px',
  color:      '#94a3b8',
  fontFamily: "'Outfit', system-ui, sans-serif",
};

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Branded grouped bar chart for LumindAd.
 *
 * @example
 * // Budget page — spend vs budget with gap between bars
 * <LumindBarChart
 *   data={budgetData}
 *   xDataKey="day"
 *   series={[
 *     { dataKey: 'spend',  name: 'Actual Spend',  color: '#7c3aed', opacity: 0.85 },
 *     { dataKey: 'budget', name: 'Budget Target', color: '#1e1e35', radius: [4,4,0,0] },
 *   ]}
 *   height={240}
 *   barGap={4}
 *   formatter={(v) => `$${Number(v).toLocaleString()}`}
 *   ariaLabel="Daily spend versus budget"
 * />
 *
 * @example
 * // Conditional colouring — red when over-spend
 * <LumindBarChart
 *   data={budgetData}
 *   xDataKey="day"
 *   series={[{
 *     dataKey:   'spend',
 *     name:      'Spend',
 *     color:     '#7c3aed',
 *     cellColor: (v, i) => budgetData[i].spend > budgetData[i].budget
 *       ? '#ef4444' : '#7c3aed',
 *   }]}
 *   height={200}
 * />
 *
 * @example
 * // Horizontal bar chart — platform ROAS ranking
 * <LumindBarChart
 *   data={roasData}
 *   xDataKey="platform"
 *   layout="horizontal"
 *   series={[{ dataKey: 'roas', name: 'ROAS', color: '#06b6d4' }]}
 *   height={200}
 *   formatter={(v) => `${v}x`}
 * />
 */
export function LumindBarChart({
  data,
  xDataKey,
  series,
  height     = 240,
  layout     = 'vertical',
  barGap     = 4,
  formatter,
  labelFormatter,
  showLegend = false,
  ariaLabel  = 'Bar chart',
  summary,
}: BarChartProps) {
  const isHorizontal = layout === 'horizontal';

  return (
    <div role="img" aria-label={ariaLabel} style={{ width: '100%' }}>
      {/* Visually hidden summary for screen readers */}
      {summary && (
        <span
          style={{
            position:  'absolute',
            width:     '1px',
            height:    '1px',
            padding:   0,
            margin:   '-1px',
            overflow: 'hidden',
            clip:     'rect(0,0,0,0)',
            whiteSpace:'nowrap',
            border:    0,
          }}
        >
          {summary}
        </span>
      )}

      <ResponsiveContainer width="100%" height={height}>
        <RechartsBarChart
          data={data}
          layout={layout}
          barGap={barGap}
          margin={{ top: 4, right: 4, bottom: 0, left: -8 }}
        >
          {/* ── Grid ── */}
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={GRID_STROKE}
            // In horizontal mode, suppress vertical grid lines for clarity
            horizontal={!isHorizontal}
            vertical={isHorizontal}
          />

          {/* ── Axes ── */}
          {isHorizontal ? (
            <>
              {/* Horizontal layout: category on Y, value on X */}
              <YAxis
                type="category"
                dataKey={xDataKey}
                stroke={AXIS_STROKE}
                tick={{ fill: TICK_FILL, fontSize: TICK_FONT }}
                tickLine={false}
                width={90}
              />
              <XAxis
                type="number"
                stroke={AXIS_STROKE}
                tick={{ fill: TICK_FILL, fontSize: TICK_FONT }}
                tickLine={false}
                axisLine={false}
              />
            </>
          ) : (
            <>
              {/* Vertical layout (default): category on X, value on Y */}
              <XAxis
                dataKey={xDataKey}
                stroke={AXIS_STROKE}
                tick={{ fill: TICK_FILL, fontSize: TICK_FONT }}
                tickLine={false}
                axisLine={{ stroke: AXIS_STROKE }}
              />
              <YAxis
                stroke={AXIS_STROKE}
                tick={{ fill: TICK_FILL, fontSize: TICK_FONT }}
                tickLine={false}
                axisLine={false}
                width={40}
              />
            </>
          )}

          {/* ── Tooltip ── */}
          <Tooltip
            content={
              <CustomTooltip
                formatter={formatter}
                labelFormatter={labelFormatter}
                // Square swatches are semantically appropriate for bars
                swatchShape="square"
              />
            }
            cursor={{ fill: 'rgba(124,58,237,0.06)' }}
          />

          {/* ── Legend ── */}
          {showLegend && (
            <Legend
              wrapperStyle={LEGEND_STYLE}
              iconType="square"
              iconSize={8}
            />
          )}

          {/* ── Bar series ── */}
          {series.map((s) => {
            const colour = s.color  ?? '#7c3aed';
            const radius = s.radius ?? DEFAULT_RADIUS;

            return (
              <Bar
                key={s.dataKey}
                dataKey={s.dataKey}
                name={s.name ?? s.dataKey}
                fill={colour}
                radius={radius}
                opacity={s.opacity ?? 1}
                isAnimationActive
                animationDuration={700}
                animationEasing="ease-out"
              >
                {/* Per-cell colour override (conditional colouring) */}
                {s.cellColor &&
                  data.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={
                        s.cellColor!(entry[s.dataKey] as number, index)
                        ?? colour
                      }
                    />
                  ))
                }
              </Bar>
            );
          })}
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}

LumindBarChart.displayName = 'LumindBarChart';

export default LumindBarChart;
