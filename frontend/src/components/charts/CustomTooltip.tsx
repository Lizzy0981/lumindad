/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  LumindAd · Charts · CustomTooltip
 *  src/components/charts/CustomTooltip.tsx
 *
 *  Purpose
 *   Recharts passes a content prop to its <Tooltip /> component.
 *   This file exports the branded popup that replaces Recharts'
 *   default grey tooltip across every chart in the platform.
 *
 *  Visual style (sourced from LumindAd.jsx CustomTooltip function)
 *   background     rgba(10, 8, 20, 0.95)
 *   border         1px solid rgba(124, 58, 237, 0.3)
 *   borderRadius   10px
 *   backdropFilter blur(12px)
 *   fontSize       12px · fontFamily Outfit
 *   labelColor     #a78bfa  (muted purple — same as .gradient-text)
 *   nameColor      #94a3b8  (slate muted)
 *   valueColor     #e8e8f8  (near-white body text)
 *   swatchRadius   50%  (dots) · 2px (squares, used for bar series)
 *
 *  Recharts tooltip props received
 *   active   boolean — true only when the cursor is over a data point
 *   payload  TooltipPayload[] — array of series data for the hovered x
 *   label    string | number — the x-axis value at the cursor position
 *
 *  Customisation API
 *   formatter     (value, name) => string
 *                 Applied to every series value before display.
 *                 Defaults to toLocaleString() for numbers.
 *   labelFormatter (label) => string
 *                 Applied to the x-axis label in the tooltip header.
 *                 Defaults to String(label).
 *   swatchShape   "circle" | "square"
 *                 Controls the colour indicator shape per series.
 *                 Use "square" for bar charts; "circle" for line/area.
 *                 Defaults to "circle".
 *
 *  Usage pattern
 *   Pass a pre-bound element, not a function, to Recharts <Tooltip>:
 *
 *     <Tooltip content={<CustomTooltip formatter={fmt} />} />
 *
 *   Recharts clones this element and injects its own props (active,
 *   payload, label) into it — the component must accept them as props.
 *
 *  Accessibility
 *   The tooltip is a floating, pointer-triggered element.
 *   It is not keyboard-accessible by design — Recharts does not
 *   expose keyboard navigation for chart data points. Screen-reader
 *   users should be directed to the accompanying data table (every
 *   chart in LumindAd renders a table fallback in the page).
 *   The tooltip container has aria-hidden="true" to avoid announcing
 *   duplicated content to screen readers.
 *
 *  Author : Elizabeth Díaz Familia
 *           AI Data Scientist · Sustainable Intelligence & BI
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { type CSSProperties } from 'react';

// ─── Recharts internal types (re-declared to avoid importing internals) ────────

interface TooltipPayloadEntry {
  /** Series name (dataKey or the "name" prop on <Line/> <Bar/> etc.) */
  name:   string;
  /** Raw value for this series at the hovered x position */
  value:  number | string;
  /** The stroke / fill colour of the series */
  color?: string;
  /** Recharts may include extra metadata — we ignore it */
  [key: string]: unknown;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export type SwatchShape = 'circle' | 'square';

export interface CustomTooltipProps {
  /**
   * Injected by Recharts — true only when the cursor is over the chart.
   * The component renders null when false.
   */
  active?: boolean;
  /**
   * Injected by Recharts — one entry per visible data series at the
   * hovered x position.
   */
  payload?: TooltipPayloadEntry[];
  /**
   * Injected by Recharts — the x-axis value at the cursor position
   * (e.g. "Mon", "Jan 1", 42).
   */
  label?: string | number;
  /**
   * Applied to each series value before rendering.
   * Use this to add units, currency symbols, or abbreviations.
   *
   * @param value - The raw numeric or string value from the data.
   * @param name  - The series name (e.g. "Impressions", "Spend").
   * @returns     - The formatted string shown in the tooltip row.
   *
   * @default (value) => typeof value === 'number' ? value.toLocaleString() : String(value)
   *
   * @example
   * // Currency
   * formatter={(v) => `$${v.toLocaleString()}`}
   *
   * @example
   * // Compact notation (1.4M, 320K)
   * formatter={(v) => v >= 1e6 ? `${(v/1e6).toFixed(1)}M` : `${(v/1e3).toFixed(0)}K`}
   *
   * @example
   * // Percentage
   * formatter={(v) => `${v}%`}
   */
  formatter?: (value: number | string, name: string) => string;
  /**
   * Applied to the x-axis label shown in the tooltip header.
   *
   * @default String(label)
   *
   * @example
   * // Convert "2025-01-15" to "Jan 15, 2025"
   * labelFormatter={(l) => new Date(l).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })}
   */
  labelFormatter?: (label: string | number) => string;
  /**
   * Shape of the colour swatch rendered next to each series name.
   * Use "square" for bar charts; "circle" for lines and areas.
   *
   * @default "circle"
   */
  swatchShape?: SwatchShape;
}

// ─── Design tokens ────────────────────────────────────────────────────────────
// Sourced from the CustomTooltip function in LumindAd.jsx (line 157-171)

const STYLES = {
  container: {
    background:          'rgba(10, 8, 20, 0.95)',
    border:              '1px solid rgba(124, 58, 237, 0.3)',
    borderRadius:        '10px',
    padding:             '10px 14px',
    fontSize:            '12px',
    fontFamily:         "'Outfit', system-ui, sans-serif",
    backdropFilter:      'blur(12px)',
    WebkitBackdropFilter:'blur(12px)',
    minWidth:            '140px',
    boxShadow:           '0 8px 24px rgba(0, 0, 0, 0.4)',
  } as CSSProperties,

  label: {
    color:        '#a78bfa',
    fontWeight:   700,
    marginBottom: '8px',
    lineHeight:   1.3,
  } as CSSProperties,

  row: {
    display:    'flex',
    gap:        '8px',
    alignItems: 'center',
    marginTop:  '4px',
  } as CSSProperties,

  seriesName: {
    color:    '#94a3b8',
    flexShrink: 0,
  } as CSSProperties,

  seriesValue: {
    fontWeight:  600,
    color:      '#e8e8f8',
    marginLeft: 'auto',
    paddingLeft: '8px',
  } as CSSProperties,
} as const;

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Branded tooltip overlay for all Recharts charts in LumindAd.
 *
 * Pass a pre-bound element (not a render function) to Recharts:
 *
 * @example
 * // Simple usage — default number formatting
 * <Tooltip content={<CustomTooltip />} />
 *
 * @example
 * // Currency formatter
 * <Tooltip content={<CustomTooltip formatter={(v) => `$${Number(v).toLocaleString()}`} />} />
 *
 * @example
 * // Compact metric formatter with square swatches for a bar chart
 * const fmt = (v: number | string) =>
 *   typeof v === 'number' && v >= 1000 ? `${(v / 1000).toFixed(1)}K` : String(v);
 *
 * <Tooltip content={<CustomTooltip formatter={fmt} swatchShape="square" />} />
 */
export function CustomTooltip({
  active,
  payload,
  label,
  formatter,
  labelFormatter,
  swatchShape = 'circle',
}: CustomTooltipProps) {
  // Recharts injects active=false when the cursor leaves the chart area.
  // We render nothing in that case to avoid a "ghost" tooltip.
  if (!active || !payload?.length) return null;

  const formatValue = (value: number | string, name: string): string => {
    if (formatter) return formatter(value, name);
    return typeof value === 'number' ? value.toLocaleString() : String(value);
  };

  const formatLabel = (l: string | number | undefined): string => {
    if (l === undefined || l === null) return '';
    if (labelFormatter) return labelFormatter(l);
    return String(l);
  };

  // ── Swatch geometry ──────────────────────────────────────────────
  const swatchStyle = (color: string): CSSProperties => ({
    width:        '8px',
    height:       '8px',
    borderRadius: swatchShape === 'circle' ? '50%' : '2px',
    background:   color || '#7c3aed',
    display:      'inline-block',
    flexShrink:   0,
  });

  return (
    <div style={STYLES.container} aria-hidden="true">
      {/* X-axis label — shown as the tooltip header */}
      {label !== undefined && (
        <div style={STYLES.label}>{formatLabel(label)}</div>
      )}

      {/* One row per series visible at the hovered x position */}
      {payload.map((entry, index) => (
        <div key={`${entry.name}-${index}`} style={STYLES.row}>
          {/* Colour swatch */}
          <span style={swatchStyle(entry.color ?? '#7c3aed')} />
          {/* Series name */}
          <span style={STYLES.seriesName}>{entry.name}</span>
          {/* Formatted value */}
          <span style={STYLES.seriesValue}>
            {formatValue(entry.value, entry.name)}
          </span>
        </div>
      ))}
    </div>
  );
}

CustomTooltip.displayName = 'CustomTooltip';

export default CustomTooltip;
