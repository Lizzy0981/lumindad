/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  LumindAd · Analytics · PerformanceTrends
 *  src/pages/Analytics/PerformanceTrends.tsx
 *
 *  Purpose
 *   Two-column chart row (grid 1fr 1fr, gap 16, marginBottom 24)
 *   that visualises 7-week analytics trends from LumindAd.jsx.
 *
 *  Left card — "Performance Trends" (AreaChart)
 *   ┌──────────────────────────────────────────┐
 *   │  Performance Trends                      │  ← fontWeight 700 fontSize 16
 *   │  Impressions over time                   │  ← fontSize 12 #475569
 *   │                                          │
 *   │  [LumindAreaChart height=220]            │
 *   │   gradient fill #7c3aed 40%→0%           │
 *   │   stroke #7c3aed strokeWidth 2.5         │
 *   │   activeDot r=6                          │
 *   └──────────────────────────────────────────┘
 *
 *  Right card — "Conversions & Clicks" (LineChart dual series)
 *   ┌──────────────────────────────────────────┐
 *   │  Conversions & Clicks                    │
 *   │  Engagement funnel over time             │
 *   │                                          │
 *   │  [LumindLineChart height=220]            │
 *   │   clicks      stroke #06b6d4 sw 2.5 r=3  │
 *   │   conversions stroke #10b981 sw 2.5 r=3  │
 *   └──────────────────────────────────────────┘
 *
 *  Chart tokens from LumindAd.jsx lines 586–625
 *   AreaChart  gradId "gradA" · stopColors #7c3aed opacities 0.4/0
 *              XAxis dataKey "date" · tick fontSize 10 · fill #64748b
 *              YAxis tick fontSize 10 · fill #64748b
 *              CartesianGrid strokeDasharray "3 3" stroke rgba(124,58,237,.08)
 *   LineChart  clicks      stroke #06b6d4 · dot { r:3 }
 *              conversions stroke #10b981 · dot { r:3 }
 *              (no activeDot override — inherits series stroke colour)
 *
 *  Data (mirrors analyticsData from LumindAd.jsx line 112)
 *   7 weekly records Jan 1 → Feb 12
 *   Fields: date · impressions · clicks · conversions
 *
 *  Platform filter
 *   Accepts an optional `platformFilter` prop from the parent page.
 *   When set, the chart title subtitle notes the active filter.
 *   (Data filtering is the parent's responsibility; the chart renders
 *    whatever array it receives.)
 *
 *  Accessibility (WCAG 2.1 AA)
 *   – Both charts are wrapped in role="region" with aria-label
 *   – Chart summaries describe the trend direction for screen readers
 *   – activeDot r=6 on AreaChart increases hit-target for pointer users
 *   – Dual-line chart uses both colour AND stroke/dash for distinction
 *     (currently solid for both — future: add strokeDasharray to one)
 *
 *  Author : Elizabeth Díaz Familia
 *           AI Data Scientist · Sustainable Intelligence & BI
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { LumindAreaChart } from '../../components/charts/AreaChart';
import { LumindLineChart } from '../../components/charts/LineChart';
import type { AreaSeries }  from '../../components/charts/AreaChart';
import type { LineSeries }  from '../../components/charts/LineChart';
import { ANALYTICS_DATA }  from './BIExport/data';

// ─── Data ─────────────────────────────────────────────────────────────────────

export { ANALYTICS_DATA };

// ─── Series configs ───────────────────────────────────────────────────────────
// Exact match to LumindAd.jsx lines 596–603 and 610–614

/** Impressions area — gradient fill #7c3aed 40%→0%, strokeWidth 2.5, activeDot r=6 */
const AREA_SERIES: AreaSeries[] = [
  {
    dataKey:         'impressions',
    name:            'Impressions',
    stroke:          '#7c3aed',
    strokeWidth:      2.5,
    fill:            'url(#gradA)',          // gradient defined in LumindAreaChart
    gradientId:      'gradA',
    gradientColor:   '#7c3aed',
    gradientOpacity: [0.4, 0],              // stopOpacity 5% → 95%
    activeDot:       { r: 6 },
    type:            'monotone',
  },
];

/** Clicks (cyan) + Conversions (green) — strokeWidth 2.5, dot r=3 */
const LINE_SERIES: LineSeries[] = [
  {
    dataKey:     'clicks',
    name:        'Clicks',
    stroke:      '#06b6d4',
    strokeWidth:  2.5,
    dot:         { r: 3 },
    type:        'monotone',
  },
  {
    dataKey:     'conversions',
    name:        'Conversions',
    stroke:      '#10b981',
    strokeWidth:  2.5,
    dot:         { r: 3 },
    type:        'monotone',
  },
];

// ─── Card shell ───────────────────────────────────────────────────────────────

const CARD: React.CSSProperties = {
  background:     'rgba(15, 10, 30, 0.85)',
  border:         '1px solid rgba(124, 58, 237, 0.15)',
  borderRadius:   '16px',
  backdropFilter: 'blur(12px)',
  padding:        '24px',
  transition:     'border-color 0.25s ease, transform 0.25s ease',
};

const F = "'Outfit', system-ui, sans-serif";

// ─── Public API ───────────────────────────────────────────────────────────────

export interface PerformanceTrendsProps {
  /**
   * Analytics records to visualise. Defaults to the 7-week prototype data.
   * The parent filters by platform and passes the result here.
   */
  data?: typeof ANALYTICS_DATA;
  /**
   * Active platform filter label — shown as subtitle suffix.
   * @example "Google Ads" → subtitle "Impressions over time — Google Ads"
   */
  platformFilter?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Two-column chart row: area chart (impressions) + line chart (clicks & conversions).
 *
 * @example
 * // Analytics/index.tsx — default data
 * <PerformanceTrends />
 *
 * @example
 * // With platform filter applied by parent
 * <PerformanceTrends
 *   data={filtered}
 *   platformFilter={selectedPlatform}
 * />
 */
export function PerformanceTrends({
  data           = ANALYTICS_DATA,
  platformFilter = 'All Platforms',
}: PerformanceTrendsProps) {
  const filterLabel = platformFilter !== 'All Platforms' ? ` — ${platformFilter}` : '';

  // Derive summary for screen readers
  const first = data[0];
  const last  = data[data.length - 1];
  const pctChange = first
    ? Math.round(((last.impressions - first.impressions) / first.impressions) * 100)
    : 0;

  return (
    <div
      style={{
        display:             'grid',
        gridTemplateColumns: '1fr 1fr',
        gap:                 '16px',
        marginBottom:        '24px',
      }}
    >
      {/* ── Left: Performance Trends (AreaChart) ─────────── */}
      <article
        role="region"
        aria-label="Performance Trends chart: impressions over time"
        style={CARD}
        onMouseEnter={(e) => Object.assign(e.currentTarget.style, { borderColor: 'rgba(124,58,237,0.4)', transform: 'translateY(-2px)' })}
        onMouseLeave={(e) => Object.assign(e.currentTarget.style, { borderColor: 'rgba(124,58,237,0.15)', transform: '' })}
      >
        <div
          style={{ fontWeight: 700, fontSize: '16px', marginBottom: '4px', color: '#e8e8f8', fontFamily: F }}
        >
          Performance Trends
        </div>
        <div
          style={{ fontSize: '12px', color: '#475569', marginBottom: '20px', fontFamily: F }}
        >
          {`Impressions over time${filterLabel}`}
        </div>

        <LumindAreaChart
          data={data as Record<string, unknown>[]}
          xDataKey="date"
          series={AREA_SERIES}
          height={220}
          tickFontSize={10}
          showLegend={false}
          ariaLabel="Area chart: weekly impressions Jan 1 through Feb 12"
          summary={`Impressions rose ${pctChange > 0 ? `${pctChange}%` : 'over the period'} from ${first?.impressions?.toLocaleString() ?? '—'} to ${last?.impressions?.toLocaleString() ?? '—'}.`}
        />
      </article>

      {/* ── Right: Conversions & Clicks (LineChart) ───────── */}
      <article
        role="region"
        aria-label="Conversions and Clicks chart: engagement funnel over time"
        style={CARD}
        onMouseEnter={(e) => Object.assign(e.currentTarget.style, { borderColor: 'rgba(124,58,237,0.4)', transform: 'translateY(-2px)' })}
        onMouseLeave={(e) => Object.assign(e.currentTarget.style, { borderColor: 'rgba(124,58,237,0.15)', transform: '' })}
      >
        <div
          style={{ fontWeight: 700, fontSize: '16px', marginBottom: '4px', color: '#e8e8f8', fontFamily: F }}
        >
          Conversions &amp; Clicks
        </div>
        <div
          style={{ fontSize: '12px', color: '#475569', marginBottom: '20px', fontFamily: F }}
        >
          {`Engagement funnel over time${filterLabel}`}
        </div>

        {/* Manual legend — matches WeeklyChart pattern */}
        <div
          role="list"
          aria-label="Chart series legend"
          style={{ display: 'flex', gap: '14px', fontSize: '11px', marginBottom: '12px' }}
        >
          {LINE_SERIES.map((s) => (
            <span
              key={s.dataKey}
              role="listitem"
              style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#94a3b8', fontFamily: F }}
            >
              <span
                aria-hidden="true"
                style={{
                  display: 'inline-block', width: '20px', height: '2px',
                  background: s.stroke, borderRadius: '1px', flexShrink: 0,
                }}
              />
              {s.name}
            </span>
          ))}
        </div>

        <LumindLineChart
          data={data as Record<string, unknown>[]}
          xDataKey="date"
          series={LINE_SERIES}
          height={220}
          tickFontSize={10}
          showLegend={false}
          ariaLabel="Line chart: weekly clicks (cyan) and conversions (green) Jan 1 through Feb 12"
          summary={`Clicks grew from ${first?.clicks?.toLocaleString() ?? '—'} to ${last?.clicks?.toLocaleString() ?? '—'}. Conversions from ${first?.conversions} to ${last?.conversions}.`}
        />
      </article>
    </div>
  );
}

PerformanceTrends.displayName = 'PerformanceTrends';
export default PerformanceTrends;
