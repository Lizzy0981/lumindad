/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  LumindAd · Charts · PieChart
 *  src/components/charts/PieChart.tsx
 *
 *  Purpose
 *   Reusable wrapper around Recharts PieChart that applies the
 *   LumindAd visual language: per-slice Cell colours, optional
 *   donut mode, paddingAngle separation, and the shared CustomTooltip.
 *
 *  Used in
 *   DashboardPage — "Platform Split" panel
 *     data         : platformData (Google Ads 38%, Meta 29%, etc.)
 *     dataKey      : "value"       nameKey  : "name"
 *     colorKey     : "color"       (each record supplies its own colour)
 *     innerRadius  : 45            outerRadius : 75
 *     paddingAngle : 3
 *     height       : 160px
 *     Below the chart, a custom legend lists platform · percentage
 *     (not rendered here — the page component owns that layout)
 *
 *  Colour strategy
 *   The component supports two colour modes:
 *   1. colorKey — each data record contains a colour field
 *      (used in LumindAd.jsx: platformData[i].color)
 *   2. colors   — a static array of colours cycled by index
 *      (fallback for data that does not carry per-record colour)
 *   If neither is provided, the LumindAd brand palette is used.
 *
 *  Donut vs Pie
 *   Donut mode is enabled when innerRadius > 0.
 *   The centre of a donut chart can optionally show a label
 *   (centreLabel / centreValue) rendered as an SVG <text> overlay.
 *   This is useful for "Total" or "Top platform" callouts.
 *
 *  paddingAngle
 *   A 3° gap between slices prevents colour bleed on adjacent thin
 *   slices and gives the chart a modern, segmented appearance that
 *   matches the LumindAd.jsx usage.
 *
 *  Accessibility (WCAG 2.1 AA)
 *   – role="img" + aria-label on the wrapper
 *   – Each slice percentage and name is included in the optional
 *     summary string for screen reader users
 *   – Tooltip is pointer-triggered; pie charts should always be
 *     accompanied by a data table or legend listing the exact values
 *
 *  Author : Elizabeth Díaz Familia
 *           AI Data Scientist · Sustainable Intelligence & BI
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import {
  PieChart  as RechartsPieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

import { CustomTooltip } from './CustomTooltip';
import type { CustomTooltipProps } from './CustomTooltip';

// ─── Brand fallback palette ───────────────────────────────────────────────────
// Used when neither colorKey nor colors prop is supplied.
// Ordered by visual contrast on the dark background.

const BRAND_PALETTE = [
  '#7c3aed',   // purple
  '#06b6d4',   // cyan
  '#10b981',   // green
  '#f59e0b',   // amber
  '#ef4444',   // red
  '#a78bfa',   // light purple
  '#0891b2',   // dark cyan
  '#059669',   // dark green
];

// ─── Public API ───────────────────────────────────────────────────────────────

/** A single data record for the pie chart. */
export interface PieDataItem {
  /** Display name for this slice — shown in tooltip and legend. */
  [nameKey: string]: unknown;
}

export interface PieChartProps {
  /**
   * Array of data records. Each item becomes one slice.
   * @example
   * [
   *   { name: 'Google Ads', value: 38, color: '#4285f4' },
   *   { name: 'Meta Ads',   value: 29, color: '#1877f2' },
   * ]
   */
  data: Record<string, unknown>[];
  /**
   * Key in each record that holds the numeric value driving the
   * slice size.
   * @default "value"
   */
  dataKey?: string;
  /**
   * Key in each record that holds the slice label string.
   * Used by Recharts for tooltip names.
   * @default "name"
   */
  nameKey?: string;
  /**
   * Key in each record that holds a per-slice CSS colour.
   * When present, each record supplies its own colour (as in
   * LumindAd.jsx platformData). Takes precedence over `colors`.
   * @default "color"
   */
  colorKey?: string;
  /**
   * Static colour array cycled by slice index.
   * Used when data records do not carry a colour field.
   * Falls back to the LumindAd brand palette when omitted.
   */
  colors?: string[];
  /**
   * Inner radius in pixels. Set > 0 to enable donut mode.
   * Matches the innerRadius={45} in LumindAd.jsx DashboardPage.
   * @default 0  (full pie)
   */
  innerRadius?: number;
  /**
   * Outer radius in pixels.
   * @default 75
   */
  outerRadius?: number;
  /**
   * Gap in degrees between adjacent slices.
   * @default 3
   */
  paddingAngle?: number;
  /**
   * Opacity applied uniformly to all slices.
   * Matches the opacity={0.9} in LumindAd.jsx.
   * @default 0.9
   */
  sliceOpacity?: number;
  /**
   * Chart height in pixels. Width is always 100%.
   * @default 160
   */
  height?: number;
  /**
   * When provided, renders this string as the top line of a centred
   * SVG label inside the donut hole. Requires innerRadius > 0.
   * @example "Total"
   */
  centreLabel?: string;
  /**
   * When provided, renders this string as the bottom (larger) line
   * of the centred donut label. Typically a formatted aggregate value.
   * @example "100%"  |  "$48K"
   */
  centreValue?: string;
  /**
   * Value formatter for tooltip rows.
   * @example (v) => `${v}%`
   */
  formatter?: CustomTooltipProps['formatter'];
  /**
   * Accessible description of the chart.
   * @example "Ad spend split across 5 platforms"
   */
  ariaLabel?: string;
  /**
   * Visually hidden text alternative for screen reader users.
   * @example "Google Ads 38%, Meta 29%, TikTok 18%, LinkedIn 10%, Twitter 5%"
   */
  summary?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Branded pie / donut chart for LumindAd.
 *
 * @example
 * // Dashboard — platform split donut (matches LumindAd.jsx exactly)
 * <LumindPieChart
 *   data={platformData}
 *   dataKey="value"
 *   nameKey="name"
 *   colorKey="color"
 *   innerRadius={45}
 *   outerRadius={75}
 *   paddingAngle={3}
 *   height={160}
 *   formatter={(v) => `${v}%`}
 *   ariaLabel="Ad spend split across platforms"
 *   summary="Google Ads 38%, Meta Ads 29%, TikTok 18%, LinkedIn 10%, Twitter/X 5%"
 * />
 *
 * @example
 * // Full pie with centre label (total spend)
 * <LumindPieChart
 *   data={categorySpend}
 *   dataKey="amount"
 *   nameKey="category"
 *   innerRadius={50}
 *   outerRadius={80}
 *   centreLabel="Total"
 *   centreValue="$48K"
 *   formatter={(v) => `$${Number(v).toLocaleString()}`}
 *   height={200}
 * />
 *
 * @example
 * // Simple pie using the brand palette (no per-record colours)
 * <LumindPieChart
 *   data={[{ name:'A', value:60 }, { name:'B', value:40 }]}
 *   height={140}
 * />
 */
export function LumindPieChart({
  data,
  dataKey      = 'value',
  nameKey      = 'name',
  colorKey     = 'color',
  colors,
  innerRadius  = 0,
  outerRadius  = 75,
  paddingAngle = 3,
  sliceOpacity = 0.9,
  height       = 160,
  centreLabel,
  centreValue,
  formatter,
  ariaLabel    = 'Pie chart',
  summary,
}: PieChartProps) {
  const isDonut   = innerRadius > 0;
  const palette   = colors ?? BRAND_PALETTE;

  /**
   * Resolves the colour for a slice at `index`.
   * Priority: per-record colorKey → colors array → brand palette.
   */
  const resolveColor = (record: Record<string, unknown>, index: number): string => {
    const recordColor = record[colorKey];
    if (typeof recordColor === 'string' && recordColor) return recordColor;
    return palette[index % palette.length];
  };

  return (
    <div role="img" aria-label={ariaLabel} style={{ width: '100%' }}>
      {/* Visually hidden text alternative */}
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
        <RechartsPieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            dataKey={dataKey}
            nameKey={nameKey}
            paddingAngle={paddingAngle}
            isAnimationActive
            animationBegin={0}
            animationDuration={800}
            animationEasing="ease-out"
          >
            {/* Per-slice colour cells */}
            {data.map((entry, index) => (
              <Cell
                key={`slice-${index}`}
                fill={resolveColor(entry, index)}
                opacity={sliceOpacity}
              />
            ))}
          </Pie>

          {/* ── Donut centre label ── */}
          {isDonut && (centreLabel || centreValue) && (
            <text
              x="50%"
              y="50%"
              textAnchor="middle"
              dominantBaseline="middle"
              aria-hidden="true"
            >
              {centreLabel && (
                <tspan
                  x="50%"
                  dy={centreValue ? '-0.6em' : '0'}
                  style={{
                    fontSize:   '11px',
                    fill:       '#64748b',
                    fontFamily: "'Outfit', system-ui, sans-serif",
                    fontWeight: 500,
                  }}
                >
                  {centreLabel}
                </tspan>
              )}
              {centreValue && (
                <tspan
                  x="50%"
                  dy={centreLabel ? '1.3em' : '0'}
                  style={{
                    fontSize:   '16px',
                    fill:       '#e8e8f8',
                    fontFamily: "'Outfit', system-ui, sans-serif",
                    fontWeight: 800,
                  }}
                >
                  {centreValue}
                </tspan>
              )}
            </text>
          )}

          {/* ── Tooltip ── */}
          <Tooltip
            content={
              <CustomTooltip
                formatter={formatter}
                swatchShape="circle"
              />
            }
          />
        </RechartsPieChart>
      </ResponsiveContainer>
    </div>
  );
}

LumindPieChart.displayName = 'LumindPieChart';

export default LumindPieChart;
