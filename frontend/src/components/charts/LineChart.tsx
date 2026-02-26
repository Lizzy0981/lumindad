/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  LumindAd · Charts · LineChart
 *  src/components/charts/LineChart.tsx
 *
 *  Purpose
 *   Reusable wrapper around Recharts LineChart that applies the
 *   LumindAd visual language: dark grid, branded axes, per-series
 *   dot styling, and the shared CustomTooltip.
 *
 *  Used in
 *   DashboardPage — "Weekly Performance" panel
 *     data      : weeklyPerf
 *     series    : impressions (#7c3aed) + clicks (#06b6d4)
 *     height    : 240px
 *     dotRadius : 4   activeDotRadius : 6
 *
 *   AnalyticsPage — "Click & Conversion Trends" panel
 *     data      : analyticsData
 *     series    : clicks (#06b6d4) + conversions (#10b981)
 *     height    : 220px
 *     dotRadius : 3   (smaller dots for denser data)
 *
 *  Dot configuration
 *   Each series exposes dotRadius and activeDotRadius independently
 *   so dense datasets can use smaller dots (r:3) while dashboard
 *   summary charts use more prominent ones (r:4 / r:6).
 *   Setting dotRadius to 0 hides dots entirely for sparkline-style
 *   charts — useful when displaying 30+ data points.
 *
 *  Axis design tokens (from LumindAd.jsx LineChart instances)
 *   axis line stroke   #334155
 *   tick fill          #64748b
 *   tick fontSize      11px (Dashboard) / 10px (Analytics)
 *   grid stroke        rgba(124, 58, 237, 0.08)
 *   grid dashArray     "3 3"
 *
 *  Accessibility (WCAG 2.1 AA)
 *   – role="img" + aria-label on the wrapper describes the chart
 *   – Optional `summary` prop provides a visually hidden text
 *     alternative for screen reader users
 *   – Tooltip is pointer-triggered and intentionally aria-hidden
 *     (data tables are the accessible alternative in each page)
 *
 *  Author : Elizabeth Díaz Familia
 *           AI Data Scientist · Sustainable Intelligence & BI
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import {
  LineChart  as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

import { CustomTooltip } from './CustomTooltip';
import type { CustomTooltipProps } from './CustomTooltip';

// ─── Public API ───────────────────────────────────────────────────────────────

/** Configuration for a single line series. */
export interface LineSeries {
  /** Key in each data object to read the y-value from. */
  dataKey: string;
  /**
   * Human-readable label — shown in tooltip and optional legend.
   * Falls back to dataKey.
   */
  name?: string;
  /**
   * Line and dot stroke colour.
   * @default "#7c3aed"
   */
  color?: string;
  /**
   * Stroke width in pixels.
   * @default 2.5
   */
  strokeWidth?: number;
  /**
   * Radius of the static dots rendered on each data point.
   * Set to 0 to hide dots (sparkline mode).
   * @default 4
   */
  dotRadius?: number;
  /**
   * Radius of the dot shown when hovering over a data point.
   * @default 6
   */
  activeDotRadius?: number;
  /**
   * Optional lighter colour for the active dot fill.
   * Defaults to the series colour.
   * @example "#a78bfa"  (light purple — used in Dashboard)
   */
  activeDotColor?: string;
}

export interface LineChartProps {
  /** Array of data objects. Each object is one x-axis tick. */
  data: Record<string, unknown>[];
  /**
   * Key in each data object used for x-axis category labels.
   * @example "day" | "date" | "week"
   */
  xDataKey: string;
  /** One or more line series to render. */
  series: LineSeries[];
  /**
   * Chart height in pixels.
   * @default 240
   */
  height?: number;
  /**
   * Tick font size for both axes.
   * @default 11
   */
  tickFontSize?: number;
  /**
   * Value formatter applied to tooltip rows.
   * @example (v) => `$${Number(v).toLocaleString()}`
   */
  formatter?: CustomTooltipProps['formatter'];
  /**
   * Label formatter applied to the tooltip header (x-axis value).
   */
  labelFormatter?: CustomTooltipProps['labelFormatter'];
  /**
   * When true, renders a Recharts <Legend /> below the chart.
   * @default false
   */
  showLegend?: boolean;
  /**
   * Accessible label for the chart region.
   * @example "Weekly impressions and clicks"
   */
  ariaLabel?: string;
  /**
   * Optional visually-hidden text summary for screen reader users.
   * @example "Impressions peaked on Friday at 25,800."
   */
  summary?: string;
}

// ─── Design tokens ────────────────────────────────────────────────────────────

const GRID_STROKE  = 'rgba(124, 58, 237, 0.08)';
const AXIS_STROKE  = '#334155';
const TICK_FILL    = '#64748b';
const LINE_TYPE    = 'monotone' as const;
const LEGEND_STYLE = {
  fontSize:   '11px',
  color:      '#94a3b8',
  fontFamily: "'Outfit', system-ui, sans-serif",
};

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Branded multi-series line chart for LumindAd.
 *
 * @example
 * // Dashboard — impressions + clicks (with visible dots)
 * <LumindLineChart
 *   data={weeklyPerf}
 *   xDataKey="day"
 *   series={[
 *     { dataKey: 'impressions', name: 'Impressions', color: '#7c3aed',
 *       dotRadius: 4, activeDotRadius: 6, activeDotColor: '#a78bfa' },
 *     { dataKey: 'clicks',      name: 'Clicks',      color: '#06b6d4',
 *       dotRadius: 4, activeDotRadius: 6 },
 *   ]}
 *   height={240}
 *   formatter={(v) => Number(v).toLocaleString()}
 *   ariaLabel="Weekly impressions and clicks"
 * />
 *
 * @example
 * // Analytics — clicks + conversions (smaller dots for denser data)
 * <LumindLineChart
 *   data={analyticsData}
 *   xDataKey="date"
 *   series={[
 *     { dataKey: 'clicks',      name: 'Clicks',      color: '#06b6d4', dotRadius: 3 },
 *     { dataKey: 'conversions', name: 'Conversions', color: '#10b981', dotRadius: 3 },
 *   ]}
 *   height={220}
 *   tickFontSize={10}
 *   showLegend
 * />
 *
 * @example
 * // Sparkline — no dots, minimal axes
 * <LumindLineChart
 *   data={sparkData}
 *   xDataKey="t"
 *   series={[{ dataKey: 'v', color: '#7c3aed', dotRadius: 0 }]}
 *   height={60}
 * />
 */
export function LumindLineChart({
  data,
  xDataKey,
  series,
  height       = 240,
  tickFontSize = 11,
  formatter,
  labelFormatter,
  showLegend   = false,
  ariaLabel    = 'Line chart',
  summary,
}: LineChartProps) {
  return (
    <div role="img" aria-label={ariaLabel} style={{ width: '100%' }}>
      {/* Visually hidden text alternative for screen readers */}
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
        <RechartsLineChart
          data={data}
          margin={{ top: 4, right: 4, bottom: 0, left: -8 }}
        >
          {/* ── Grid ── */}
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={GRID_STROKE}
            vertical={false}
          />

          {/* ── X Axis ── */}
          <XAxis
            dataKey={xDataKey}
            stroke={AXIS_STROKE}
            tick={{ fill: TICK_FILL, fontSize: tickFontSize }}
            tickLine={false}
            axisLine={{ stroke: AXIS_STROKE }}
          />

          {/* ── Y Axis ── */}
          <YAxis
            stroke={AXIS_STROKE}
            tick={{ fill: TICK_FILL, fontSize: tickFontSize }}
            tickLine={false}
            axisLine={false}
            width={40}
          />

          {/* ── Tooltip ── */}
          <Tooltip
            content={
              <CustomTooltip
                formatter={formatter}
                labelFormatter={labelFormatter}
                swatchShape="circle"
              />
            }
            cursor={{ stroke: 'rgba(124,58,237,0.2)', strokeWidth: 1 }}
          />

          {/* ── Legend ── */}
          {showLegend && (
            <Legend
              wrapperStyle={LEGEND_STYLE}
              iconType="circle"
              iconSize={8}
            />
          )}

          {/* ── Line series ── */}
          {series.map((s) => {
            const colour      = s.color         ?? '#7c3aed';
            const dotR        = s.dotRadius      ?? 4;
            const activeDotR  = s.activeDotRadius ?? 6;
            const activeColor = s.activeDotColor  ?? colour;

            return (
              <Line
                key={s.dataKey}
                type={LINE_TYPE}
                dataKey={s.dataKey}
                name={s.name ?? s.dataKey}
                stroke={colour}
                strokeWidth={s.strokeWidth ?? 2.5}
                // Static dots on every data point
                dot={dotR > 0
                  ? { fill: colour, r: dotR, stroke: '#060610', strokeWidth: 1.5 }
                  : false
                }
                // Enlarged dot on hover
                activeDot={activeDotR > 0
                  ? { r: activeDotR, fill: activeColor, stroke: '#060610', strokeWidth: 2 }
                  : false
                }
                isAnimationActive
                animationDuration={800}
                animationEasing="ease-out"
              />
            );
          })}
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  );
}

LumindLineChart.displayName = 'LumindLineChart';

export default LumindLineChart;
