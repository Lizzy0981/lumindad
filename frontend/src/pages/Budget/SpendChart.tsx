/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  LumindAd · Budget · SpendChart
 *  src/pages/Budget/SpendChart.tsx
 *
 *  Purpose
 *   "Daily Spend vs Budget" card — the wide left column (1fr) of the
 *   Budget page charts row. A grouped bar chart comparing actual daily
 *   spend against the fixed daily budget target across 7 days.
 *
 *  Anatomy
 *   ┌──────────────────────────────────────────────────────┐
 *   │  Daily Spend vs Budget                               │
 *   │  Actual spend compared to daily budget target        │
 *   │                                                      │
 *   │  [LumindBarChart height=240]                         │
 *   │  ██░  ██░  ██░  ████  ████  ███  ██░                 │
 *   │  Mon  Tue  Wed  Thu   Fri   Sat  Sun                 │
 *   └──────────────────────────────────────────────────────┘
 *
 *  Chart series (from LumindAd.jsx lines 521–525)
 *   Actual Spend   dataKey "spend"   fill #7c3aed  opacity 0.85
 *                  radius [4,4,0,0]  ← rounded top, flat bottom
 *   Budget Target  dataKey "budget"  fill #1e1e35  opacity 1.0
 *                  radius [4,4,0,0]
 *
 *  Bar configuration
 *   barGap  4   — gap between the two bars of each day group
 *   No barSize specified → Recharts auto-sizes to fill available width
 *
 *  Budget data (from LumindAd.jsx line 119)
 *   7 days Mon–Sun · budget constant at 1,500/day
 *   Spend varies: Tue (1,820), Thu (2,250), Fri (2,480) exceed budget
 *   Note: the JSX uses uniform #7c3aed for all spend bars regardless
 *   of whether they exceed budget. Conditional cellColor is available
 *   in LumindBarChart but intentionally NOT used here to match prototype.
 *
 *  Value formatter
 *   Y-axis ticks and tooltip values: $1,500 → "$1.5K"
 *   Prevents axis labels from overflowing the card at four digits.
 *
 *  Scoped legend
 *   A small inline legend below the title mirrors the style of WeeklyChart.
 *   Two coloured squares: ■ Actual Spend (#7c3aed) · ■ Budget Target (#1e1e35)
 *
 *  Accessibility (WCAG 2.1 AA)
 *   – <article role="region"> names the card for screen readers
 *   – Legend uses role="list" + role="listitem"
 *   – LumindBarChart receives ariaLabel + summary describing peak spend days
 *   – Days where spend exceeds budget are noted in the summary text
 *
 *  Author : Elizabeth Díaz Familia
 *           AI Data Scientist · Sustainable Intelligence & BI
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { LumindBarChart } from '../../components/charts/BarChart';
import type { BarSeries }  from '../../components/charts/BarChart';

// ─── Data ─────────────────────────────────────────────────────────────────────
// Mirrors budgetData in LumindAd.jsx (line 119) exactly.

export interface BudgetDayRecord {
  day:    string;
  budget: number;
  spend:  number;
}

export const BUDGET_DATA_DEFAULT: BudgetDayRecord[] = [
  { day: 'Mon', budget: 1500, spend: 1240 },
  { day: 'Tue', budget: 1500, spend: 1820 },   // +$320 over budget
  { day: 'Wed', budget: 1500, spend: 1470 },
  { day: 'Thu', budget: 1500, spend: 2250 },   // +$750 over budget
  { day: 'Fri', budget: 1500, spend: 2480 },   // +$980 over budget
  { day: 'Sat', budget: 1500, spend: 1840 },   // +$340 over budget
  { day: 'Sun', budget: 1500, spend: 1350 },
];

// ─── Series definitions ───────────────────────────────────────────────────────
// Exact match to LumindAd.jsx lines 521–525:
//   Bar dataKey="spend"  fill="#7c3aed"  opacity={.85}  radius={[4,4,0,0]}
//   Bar dataKey="budget" fill="#1e1e35"              radius={[4,4,0,0]}

const SERIES: BarSeries[] = [
  {
    dataKey: 'spend',
    name:    'Actual Spend',
    color:   '#7c3aed',
    opacity:  0.85,
    radius:  [4, 4, 0, 0],
  },
  {
    dataKey: 'budget',
    name:    'Budget Target',
    color:   '#1e1e35',
    opacity:  1,
    radius:  [4, 4, 0, 0],
  },
];

// ─── Value formatter ──────────────────────────────────────────────────────────

/** Formats dollar values compactly for axis ticks and tooltip. $1500 → "$1.5K" */
function fmtDollar(value: number | string): string {
  const n = Number(value);
  if (isNaN(n)) return String(value);
  return n >= 1000 ? `$${(n / 1000).toFixed(1)}K` : `$${n}`;
}

// ─── Card shell tokens ────────────────────────────────────────────────────────

const CARD_STYLE = {
  background:     'rgba(15, 10, 30, 0.85)',
  border:         '1px solid rgba(124, 58, 237, 0.15)',
  borderRadius:   '16px',
  backdropFilter: 'blur(12px)',
  padding:        '24px',
  transition:     'border-color 0.25s ease, transform 0.25s ease',
} as const;

// ─── Public API ───────────────────────────────────────────────────────────────

export interface SpendChartProps {
  /**
   * 7-day budget vs spend records.
   * Defaults to the hardcoded prototype data from LumindAd.jsx.
   */
  data?: BudgetDayRecord[];
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * "Daily Spend vs Budget" grouped bar chart card for the Budget page.
 *
 * Two bars per day: actual spend (purple #7c3aed) and budget target
 * (#1e1e35). Days where spend exceeds budget are visually prominent
 * because the spend bar simply extends above the target bar.
 *
 * @example
 * // Budget/index.tsx — default prototype data
 * <SpendChart />
 *
 * @example
 * // With real API data
 * <SpendChart data={apiResponse.dailyBudget} />
 */
export function SpendChart({ data = BUDGET_DATA_DEFAULT }: SpendChartProps) {
  // Build accessible summary noting overspend days
  const overBudgetDays = data
    .filter((d) => d.spend > d.budget)
    .map((d) => `${d.day} ($${d.spend.toLocaleString()} vs $${d.budget.toLocaleString()} target)`);

  const summary = overBudgetDays.length
    ? `Budget exceeded on: ${overBudgetDays.join(', ')}.`
    : 'All days within budget target.';

  return (
    <article
      role="region"
      aria-label="Daily Spend vs Budget chart"
      style={CARD_STYLE}
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
      {/* ── Card header ──────────────────────────────────────── */}
      <div style={{ marginBottom: '20px' }}>
        <div
          style={{
            display:        'flex',
            justifyContent: 'space-between',
            alignItems:     'flex-start',
          }}
        >
          {/* Title + subtitle */}
          <div>
            <div
              style={{
                fontWeight: 700,
                fontSize:   '16px',
                color:      '#e8e8f8',
                marginBottom:'4px',
                fontFamily: "'Outfit', system-ui, sans-serif",
              }}
            >
              Daily Spend vs Budget
            </div>
            <div
              style={{
                fontSize:  '12px',
                color:     '#475569',
                fontFamily:"'Outfit', system-ui, sans-serif",
              }}
            >
              Actual spend compared to daily budget target
            </div>
          </div>

          {/* Manual legend */}
          <div
            role="list"
            aria-label="Chart series legend"
            style={{ display: 'flex', gap: '14px', fontSize: '12px', flexShrink: 0 }}
          >
            <span
              role="listitem"
              style={{
                display:    'flex',
                alignItems: 'center',
                gap:        '6px',
                color:      '#94a3b8',
                fontFamily:"'Outfit', system-ui, sans-serif",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: '10px', height: '10px',
                  borderRadius: '2px',
                  background: '#7c3aed',
                  display: 'inline-block',
                  flexShrink: 0,
                }}
              />
              Actual Spend
            </span>
            <span
              role="listitem"
              style={{
                display:    'flex',
                alignItems: 'center',
                gap:        '6px',
                color:      '#94a3b8',
                fontFamily:"'Outfit', system-ui, sans-serif",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: '10px', height: '10px',
                  borderRadius: '2px',
                  background: '#334155',
                  display: 'inline-block',
                  flexShrink: 0,
                }}
              />
              Budget Target
            </span>
          </div>
        </div>
      </div>

      {/* ── Bar chart ────────────────────────────────────────── */}
      {/* barGap={4} matches JSX line 518 exactly */}
      <LumindBarChart
        data={data as Record<string, unknown>[]}
        xDataKey="day"
        series={SERIES}
        height={240}
        barGap={4}
        tickFontSize={11}
        formatter={fmtDollar}
        labelFormatter={(label) => `${label}`}
        showLegend={false}
        ariaLabel="Grouped bar chart: daily actual spend vs budget target, Monday through Sunday"
        summary={summary}
      />
    </article>
  );
}

SpendChart.displayName = 'SpendChart';

export default SpendChart;
