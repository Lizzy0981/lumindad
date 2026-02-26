/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  LumindAd · Dashboard · PlatformSplit
 *  src/pages/Dashboard/PlatformSplit.tsx
 *
 *  Purpose
 *   Renders the "Platform Split" card that occupies the narrow right
 *   column (320px fixed) of the Dashboard charts row. Contains a
 *   donut chart showing ad spend distribution across 5 platforms
 *   and a custom vertical legend below it.
 *
 *  Data
 *   platformData — 5 platform records
 *   Fields: name · value (percentage 0–100) · color (brand colour)
 *
 *  Chart configuration (sourced from LumindAd.jsx line 362–368)
 *   height       160 px
 *   innerRadius  45  ← donut mode
 *   outerRadius  75
 *   paddingAngle  3  ← gap between slices
 *   dataKey      "value"
 *   colorKey     "color"  ← each record supplies its own color
 *   sliceOpacity  0.9
 *
 *  Custom legend (below the chart)
 *   Rendered as a flex-column list, not Recharts <Legend />.
 *   Each row: [■ swatch] [platform name] [value%]
 *   Swatch is an 8×8 square (borderRadius 2px) — matches JSX line 373
 *   Platform name: color #94a3b8 · Value: fontWeight 700 color #e8e8f8
 *   Row gap: 6px · fontSize: 12px
 *
 *  Platform colours (from LumindAd.jsx platformData)
 *   Google Ads  #4285f4   38%
 *   Meta Ads    #1877f2   29%
 *   TikTok      #ff0050   18%
 *   LinkedIn    #0077b5   10%
 *   Twitter/X   #1da1f2    5%
 *
 *  Accessibility (WCAG 2.1 AA)
 *   – Card has role="region" aria-label="Platform ad spend distribution"
 *   – LumindPieChart receives ariaLabel + summary with exact percentages
 *   – Legend list is a <ul> with role="list" so screen readers enumerate items
 *   – Each swatch is aria-hidden; percentage is communicated in text
 *   – Tooltip is aria-hidden (data is accessible via the legend)
 *
 *  Author : Elizabeth Díaz Familia
 *           AI Data Scientist · Sustainable Intelligence & BI
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { LumindPieChart } from '../../components/charts/PieChart';

// ─── Data ─────────────────────────────────────────────────────────────────────
// Mirrors platformData in LumindAd.jsx (line 95) exactly.

export interface PlatformRecord {
  name:  string;
  value: number;   // percentage (0–100)
  color: string;   // CSS hex colour
}

export const PLATFORM_DATA_DEFAULT: PlatformRecord[] = [
  { name: 'Google Ads', value: 38, color: '#4285f4' },
  { name: 'Meta Ads',   value: 29, color: '#1877f2' },
  { name: 'TikTok',     value: 18, color: '#ff0050' },
  { name: 'LinkedIn',   value: 10, color: '#0077b5' },
  { name: 'Twitter/X',  value:  5, color: '#1da1f2' },
];

// ─── Public API ───────────────────────────────────────────────────────────────

export interface PlatformSplitProps {
  /**
   * Platform distribution data. Defaults to prototype values when omitted.
   * Values must sum to 100 for the donut to render correctly.
   */
  data?: PlatformRecord[];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/**
 * A single row in the platform legend.
 * Renders: [■ coloured square] [platform name] [N%]
 */
function LegendRow({ platform }: { platform: PlatformRecord }) {
  return (
    <li
      style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        fontSize:       '12px',
        listStyle:      'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {/* Square swatch — matches borderRadius:2 in LumindAd.jsx line 373 */}
        <span
          aria-hidden="true"
          style={{
            width:        '8px',
            height:       '8px',
            borderRadius: '2px',
            background:    platform.color,
            display:      'inline-block',
            flexShrink:    0,
          }}
        />
        <span
          style={{
            color:      '#94a3b8',
            fontFamily:"'Outfit', system-ui, sans-serif",
          }}
        >
          {platform.name}
        </span>
      </div>
      <span
        style={{
          fontWeight:  700,
          color:      '#e8e8f8',
          fontFamily:"'Outfit', system-ui, sans-serif",
        }}
      >
        {platform.value}%
      </span>
    </li>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * "Platform Split" card — right column (320px) of the Dashboard charts row.
 *
 * Renders a donut chart with innerRadius=45 showing ad spend across 5
 * platforms, plus a custom vertical legend listing each platform and its
 * percentage share.
 *
 * @example
 * // Dashboard/index.tsx — with default prototype data
 * <PlatformSplit />
 *
 * @example
 * // With real API data
 * <PlatformSplit data={apiResponse.platformSplit} />
 */
export function PlatformSplit({ data = PLATFORM_DATA_DEFAULT }: PlatformSplitProps) {
  // Build accessible summary string from data
  const summary = data
    .map((p) => `${p.name} ${p.value}%`)
    .join(', ');

  return (
    <article
      role="region"
      aria-label="Platform ad spend distribution"
      style={{
        background:     'rgba(15, 10, 30, 0.85)',
        border:         '1px solid rgba(124, 58, 237, 0.15)',
        borderRadius:   '16px',
        backdropFilter: 'blur(12px)',
        padding:        '24px',
        transition:     'border-color 0.25s, transform 0.25s',
      }}
      onMouseEnter={(e) => {
        Object.assign(e.currentTarget.style, {
          borderColor: 'rgba(124,58,237,0.4)',
          transform:   'translateY(-2px)',
        });
      }}
      onMouseLeave={(e) => {
        Object.assign(e.currentTarget.style, {
          borderColor: 'rgba(124,58,237,0.15)',
          transform:   '',
        });
      }}
    >
      {/* ── Card header ──────────────────────────────────────────── */}
      <div
        style={{
          fontWeight:  700,
          fontSize:   '16px',
          color:      '#e8e8f8',
          marginBottom:'4px',
          fontFamily:"'Outfit', system-ui, sans-serif",
        }}
      >
        Platform Split
      </div>
      <div
        style={{
          fontSize:     '12px',
          color:        '#475569',
          marginBottom: '16px',
          fontFamily:  "'Outfit', system-ui, sans-serif",
        }}
      >
        Ad spend distribution
      </div>

      {/* ── Donut chart ──────────────────────────────────────────── */}
      {/* Matches: innerRadius={45} outerRadius={75} paddingAngle={3} */}
      <LumindPieChart
        data={data as Record<string, unknown>[]}
        dataKey="value"
        nameKey="name"
        colorKey="color"
        innerRadius={45}
        outerRadius={75}
        paddingAngle={3}
        sliceOpacity={0.9}
        height={160}
        formatter={(v) => `${v}%`}
        ariaLabel="Donut chart of ad spend by platform"
        summary={summary}
      />

      {/* ── Vertical legend ──────────────────────────────────────── */}
      {/* Matches the .map() legend in LumindAd.jsx lines 370–379 */}
      <ul
        role="list"
        aria-label="Platform spend breakdown"
        style={{
          display:       'flex',
          flexDirection: 'column',
          gap:           '6px',
          padding:        0,
          margin:        '0',
          marginTop:     '4px',
        }}
      >
        {data.map((platform) => (
          <LegendRow key={platform.name} platform={platform} />
        ))}
      </ul>
    </article>
  );
}

PlatformSplit.displayName = 'PlatformSplit';

export default PlatformSplit;
