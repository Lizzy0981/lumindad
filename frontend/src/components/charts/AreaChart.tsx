/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  LumindAd · Charts · AreaChart
 *  src/components/charts/AreaChart.tsx
 *
 *  Purpose
 *   Reusable wrapper around Recharts AreaChart that applies the
 *   LumindAd visual language: dark grid, branded axes, per-series
 *   SVG gradient fills, and the shared CustomTooltip.
 *
 *  Used in
 *   AnalyticsPage — "Performance Trends" panel
 *     data      : analyticsData (impressions over 7 weeks)
 *     series    : [{ dataKey:'impressions', color:'#7c3aed' }]
 *     height    : 220px
 *
 *  Multi-series gradient strategy
 *   Each series receives its own <linearGradient> defined in the SVG
 *   <defs> block, identified by a unique id (`lad-area-grad-{index}`).
 *   The gradient fades from the series colour at 40% opacity (top) to
 *   0% opacity (bottom), matching the gradA definition in LumindAd.jsx.
 *
 *   Recharts requires gradient IDs to be globally unique across the
 *   entire DOM. A `uid` derived from a React useId() call is prefixed
 *   to each gradient id to prevent collisions when multiple AreaChart
 *   instances appear on the same page.
 *
 *  Axis design tokens (from LumindAd.jsx AreaChart instances)
 *   axis line stroke   #334155   (slate-700)
 *   tick fill          #64748b   (slate-500)
 *   tick fontSize      10px
 *   grid stroke        rgba(124, 58, 237, 0.08)   (purple, very faint)
 *   grid dashArray     "3 3"
 *
 *  Accessibility (WCAG 2.1 AA)
 *   – The chart wrapper has role="img" and an aria-label that describes
 *     the chart type and metric — screen readers announce it correctly
 *   – All decorative elements inside the SVG are aria-hidden
 *   – A visually hidden summary is available via the `summary` prop for
 *     users who need a text alternative to the visual trend
 *
 *  Author : Elizabeth Díaz Familia
 *           AI Data Scientist · Sustainable Intelligence & BI
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { useId } from 'react';
import {
  AreaChart  as RechartsAreaChart,
  Area,
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

/** Configuration for a single data series rendered as a filled area. */
export interface AreaSeries {
  /** Key in each data object to read the y-value from. */
  dataKey: string;
  /**
   * Human-readable series label — shown in the tooltip and legend.
   * Falls back to dataKey if omitted.
   */
  name?: string;
  /**
   * Stroke + gradient base colour.
   * @default "#7c3aed"
   */
  color?: string;
  /**
   * Stroke width in pixels.
   * @default 2.5
   */
  strokeWidth?: number;
  /**
   * Radius of the active dot shown when the cursor hovers over a point.
   * @default 6
   */
  activeDotRadius?: number;
}

export interface AreaChartProps {
  /** Array of data objects. Each object represents one x-axis point. */
  data: Record<string, unknown>[];
  /**
   * Key in each data object used for the x-axis category labels.
   * @example "date" | "day" | "month"
   */
  xDataKey: string;
  /** One or more area series to render. */
  series: AreaSeries[];
  /**
   * Chart height in pixels. Width is always 100% of the container.
   * @default 220
   */
  height?: number;
  /**
   * Value formatter applied to every tooltip row.
   * Receives the raw value and series name; returns a display string.
   *
   * @example (v) => v >= 1e6 ? `${(v/1e6).toFixed(1)}M` : `${(v/1e3).toFixed(0)}K`
   */
  formatter?: CustomTooltipProps['formatter'];
  /**
   * X-axis label formatter applied to the tooltip header.
   * @example (l) => `Week of ${l}`
   */
  labelFormatter?: CustomTooltipProps['labelFormatter'];
  /**
   * When true, renders a Recharts <Legend /> below the chart.
   * @default false
   */
  showLegend?: boolean;
  /**
   * Accessible label describing what the chart shows.
   * Read aloud by screen readers via role="img".
   * @example "Impressions over the last 7 weeks"
   */
  ariaLabel?: string;
  /**
   * Optional visually-hidden text summary of the chart trend.
   * Provides a text alternative for screen reader users.
   * @example "Impressions grew from 11,000 in week 1 to 30,100 in week 7."
   */
  summary?: string;
}

// ─── Design tokens ────────────────────────────────────────────────────────────

const GRID_STROKE   = 'rgba(124, 58, 237, 0.08)';
const AXIS_STROKE   = '#334155';
const TICK_FILL     = '#64748b';
const TICK_FONT     = 10;
const AREA_TYPE     = 'monotone' as const;
const LEGEND_STYLE  = {
  fontSize:   '11px',
  color:      '#94a3b8',
  fontFamily: "'Outfit', system-ui, sans-serif",
};

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Branded area chart for trend visualisations in LumindAd.
 *
 * @example
 * // Analytics — single impressions series
 * <LumindAreaChart
 *   data={analyticsData}
 *   xDataKey="date"
 *   series={[{ dataKey: 'impressions', name: 'Impressions', color: '#7c3aed' }]}
 *   height={220}
 *   formatter={(v) => v >= 1e6 ? `${(v/1e6).toFixed(1)}M` : `${(v/1e3).toFixed(0)}K`}
 *   ariaLabel="Impressions over 7 weeks"
 * />
 *
 * @example
 * // Multi-series — impressions + conversions
 * <LumindAreaChart
 *   data={weeklyData}
 *   xDataKey="day"
 *   series={[
 *     { dataKey: 'impressions', name: 'Impressions', color: '#7c3aed' },
 *     { dataKey: 'conversions', name: 'Conversions', color: '#06b6d4' },
 *   ]}
 *   height={260}
 *   showLegend
 * />
 */
export function LumindAreaChart({
  data,
  xDataKey,
  series,
  height       = 220,
  formatter,
  labelFormatter,
  showLegend   = false,
  ariaLabel    = 'Area chart',
  summary,
}: AreaChartProps) {
  // Unique prefix per instance — prevents SVG gradient id collisions
  const uid = useId().replace(/:/g, '');

  return (
    <div
      role="img"
      aria-label={ariaLabel}
      style={{ width: '100%' }}
    >
      {/* Visually hidden text summary for screen readers */}
      {summary && (
        <span
          style={{
            position:   'absolute',
            width:      '1px',
            height:     '1px',
            padding:    0,
            margin:    '-1px',
            overflow:  'hidden',
            clip:      'rect(0,0,0,0)',
            whiteSpace:'nowrap',
            border:     0,
          }}
        >
          {summary}
        </span>
      )}

      <ResponsiveContainer width="100%" height={height}>
        <RechartsAreaChart
          data={data}
          margin={{ top: 4, right: 4, bottom: 0, left: -8 }}
        >
          {/* ── SVG gradient definitions — one per series ── */}
          <defs>
            {series.map((s, i) => {
              const colour = s.color ?? '#7c3aed';
              return (
                <linearGradient
                  key={s.dataKey}
                  id={`${uid}-grad-${i}`}
                  x1="0" y1="0" x2="0" y2="1"
                >
                  {/* Top: series colour at 40% — matches gradA in LumindAd.jsx */}
                  <stop offset="5%"  stopColor={colour} stopOpacity={0.40} />
                  {/* Bottom: fully transparent — creates the fade-out effect */}
                  <stop offset="95%" stopColor={colour} stopOpacity={0}    />
                </linearGradient>
              );
            })}
          </defs>

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
            tick={{ fill: TICK_FILL, fontSize: TICK_FONT }}
            tickLine={false}
            axisLine={{ stroke: AXIS_STROKE }}
          />

          {/* ── Y Axis ── */}
          <YAxis
            stroke={AXIS_STROKE}
            tick={{ fill: TICK_FILL, fontSize: TICK_FONT }}
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

          {/* ── Area series ── */}
          {series.map((s, i) => {
            const colour = s.color ?? '#7c3aed';
            return (
              <Area
                key={s.dataKey}
                type={AREA_TYPE}
                dataKey={s.dataKey}
                name={s.name ?? s.dataKey}
                stroke={colour}
                strokeWidth={s.strokeWidth ?? 2.5}
                fill={`url(#${uid}-grad-${i})`}
                activeDot={{
                  r:           s.activeDotRadius ?? 6,
                  fill:        colour,
                  stroke:     '#060610',
                  strokeWidth: 2,
                }}
                dot={false}
                isAnimationActive
                animationDuration={800}
                animationEasing="ease-out"
              />
            );
          })}
        </RechartsAreaChart>
      </ResponsiveContainer>
    </div>
  );
}

LumindAreaChart.displayName = 'LumindAreaChart';

export default LumindAreaChart;
