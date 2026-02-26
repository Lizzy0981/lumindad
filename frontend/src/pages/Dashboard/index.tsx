/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  LumindAd · Pages · Performance Dashboard
 *  src/pages/Dashboard/index.tsx
 *
 *  Route  /dashboard  (matched by App.tsx inside AppLayout)
 *
 *  Layout (top → bottom)
 *   ┌──────────────────────────────────────────────────────────┐
 *   │  Header — "Performance Dashboard"  [⟳ Refresh] [✦ Create]│
 *   ├──────────────────────────────────────────────────────────┤
 *   │  KPI row — 4-column grid (gap 16, marginBottom 24)       │
 *   │  💰 Total Spend  👁 Impressions  ⚡ Clicks  🎯 Conversions│
 *   ├──────────────────────────────────────────────────────────┤
 *   │  Charts row — grid "1fr 320px" (gap 16, marginBottom 24) │
 *   │  ┌─────────────────────────────┐ ┌────────────────────┐  │
 *   │  │  WeeklyChart (line)         │ │  PlatformSplit     │  │
 *   │  │  240px · impressions+clicks │ │  (donut 45/75)     │  │
 *   │  └─────────────────────────────┘ │  + vertical legend │  │
 *   │                                  └────────────────────┘  │
 *   ├──────────────────────────────────────────────────────────┤
 *   │  AI Insights panel — 3-column insight cards              │
 *   │  🎯 Peak Performance · ⚠️ Anomaly Detected · 📈 Growth   │
 *   └──────────────────────────────────────────────────────────┘
 *
 *  KPI configuration (from LumindAd.jsx line 323–326)
 *   Total Spend    $48,290   change +12.5%  color #7c3aed  delay 0
 *   Impressions    531,200   change  +8.3%  color #06b6d4  delay 80
 *   Clicks          38,940   change +15.2%  color #a855f7  delay 160
 *   Conversions      2,847   change +22.1%  color #f59e0b  delay 240
 *
 *  AI Insights panel (from LumindAd.jsx line 383–403)
 *   3 cards in a repeat(3, 1fr) grid, each with:
 *   – coloured bg at 4% opacity  (${color}0a)
 *   – coloured border at 12.5%   (${color}20)
 *   – icon · title (13px/700) · description (11px/1.5 line-height)
 *   Colors: #7c3aed · #f59e0b · #10b981
 *
 *  Header actions
 *   "⟳ Refresh" → btn-secondary (fontSize 12 — slightly smaller, per JSX)
 *   "✦ Create New Ad" → btn-primary → navigates to /create-ad
 *
 *  Data strategy
 *   This page uses the static prototype data (exported from child
 *   components) for now. In a real deployment, data would be fetched
 *   here via a custom hook (e.g. useDashboardData()) and passed down
 *   as props to WeeklyChart and PlatformSplit.
 *
 *  Accessibility (WCAG 2.1 AA)
 *   – Page is wrapped in PageWrapper (role="main", aria-label set by AppLayout)
 *   – KPI grid has role="list" so screen readers count the 4 metrics
 *   – AI Insights panel has role="region" aria-label="AI-Generated Insights"
 *   – All interactive elements are native <button> or <a> — no role overrides
 *
 *  Author : Elizabeth Díaz Familia
 *           AI Data Scientist · Sustainable Intelligence & BI
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { useNavigate }   from 'react-router-dom';
import { Header }        from '../../components/layout/Header';
import { KPICard }       from '../../components/shared/KPICard';
import { Button }        from '../../components/ui/Button';
import { WeeklyChart }   from './WeeklyChart';
import { PlatformSplit } from './PlatformSplit';

// ─── KPI data ─────────────────────────────────────────────────────────────────
// Sourced from DashboardPage in LumindAd.jsx (lines 323–326).
// Extracted to a constant for testability and future API replacement.

const KPI_CARDS = [
  {
    id:      'spend',
    title:   'Total Spend',
    value:    48290,
    prefix:  '$',
    change:   12.5,
    icon:    '💰',
    color:   '#7c3aed',
    delay:    0,
  },
  {
    id:      'impressions',
    title:   'Impressions',
    value:    531200,
    change:   8.3,
    icon:    '👁',
    color:   '#06b6d4',
    delay:    80,
  },
  {
    id:      'clicks',
    title:   'Clicks',
    value:    38940,
    change:   15.2,
    icon:    '⚡',
    color:   '#a855f7',
    delay:    160,
  },
  {
    id:      'conversions',
    title:   'Conversions',
    value:    2847,
    change:   22.1,
    icon:    '🎯',
    color:   '#f59e0b',
    delay:    240,
  },
] as const;

// ─── AI Insights data ─────────────────────────────────────────────────────────
// Sourced from the inline .map() in LumindAd.jsx lines 387–399.

interface InsightCard {
  icon:  string;
  title: string;
  desc:  string;
  color: string;
}

const AI_INSIGHTS: InsightCard[] = [
  {
    icon:  '🎯',
    title: 'Peak Performance',
    desc:  'Friday ads convert 34% better. Increase budget by $200 for next Friday.',
    color: '#7c3aed',
  },
  {
    icon:  '⚠️',
    title: 'Anomaly Detected',
    desc:  'TikTok campaign CTR dropped 18% vs last week. Isolation Forest flagged this.',
    color: '#f59e0b',
  },
  {
    icon:  '📈',
    title: 'Growth Opportunity',
    desc:  'LinkedIn B2B segment shows 5.1x ROAS. Recommend scaling budget +40%.',
    color: '#10b981',
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Performance Dashboard page — route /dashboard.
 *
 * Renders KPI cards, weekly line chart, platform donut chart,
 * and the AI-generated insights panel.
 *
 * @example
 * // Consumed automatically by React Router via App.tsx
 * <Route path="/dashboard" element={<DashboardPage />} />
 */
export default function DashboardPage() {
  const navigate = useNavigate();

  return (
    <>
      {/* ── Page header ────────────────────────────────────────── */}
      <Header
        title="Performance Dashboard"
        subtitle="Monitor your advertising performance in real-time — AI-powered insights"
        actions={[
          /* "⟳ Refresh" — btn-secondary, fontSize 12 (per JSX line 316) */
          <Button
            key="refresh"
            variant="secondary"
            size="sm"
            onClick={() => window.location.reload()}
            aria-label="Refresh dashboard data"
          >
            ⟳ Refresh
          </Button>,

          /* "✦ Create New Ad" — btn-primary */
          <Button
            key="create"
            variant="primary"
            onClick={() => navigate('/create-ad')}
          >
            ✦ Create New Ad
          </Button>,
        ]}
      />

      {/* ── KPI row — 4 animated metric cards ─────────────────── */}
      {/* grid repeat(4,1fr) gap:16 marginBottom:24 — matches JSX line 322 */}
      <div
        role="list"
        aria-label="Key performance indicators"
        style={{
          display:             'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap:                 '16px',
          marginBottom:        '24px',
        }}
      >
        {KPI_CARDS.map((kpi) => (
          <div key={kpi.id} role="listitem">
            <KPICard
              title={kpi.title}
              value={kpi.value}
              prefix={'prefix' in kpi ? (kpi as typeof kpi & { prefix: string }).prefix : ''}
              change={kpi.change}
              icon={kpi.icon}
              color={kpi.color}
              delay={kpi.delay}
            />
          </div>
        ))}
      </div>

      {/* ── Charts row — 1fr + 320px fixed ────────────────────── */}
      {/* grid "1fr 320px" gap:16 marginBottom:24 — matches JSX line 329 */}
      <div
        style={{
          display:             'grid',
          gridTemplateColumns: '1fr 320px',
          gap:                 '16px',
          marginBottom:        '24px',
        }}
      >
        {/* Left: Weekly Performance line chart */}
        <WeeklyChart />

        {/* Right: Platform Split donut + vertical legend */}
        <PlatformSplit />
      </div>

      {/* ── AI Insights panel ──────────────────────────────────── */}
      {/* card + padding:20 + 3-col insight grid — matches JSX lines 383-403 */}
      <section
        role="region"
        aria-label="AI-Generated Insights"
        style={{
          background:     'rgba(15, 10, 30, 0.85)',
          border:         '1px solid rgba(124, 58, 237, 0.15)',
          borderRadius:   '16px',
          backdropFilter: 'blur(12px)',
          padding:        '20px',
        }}
      >
        {/* Panel header */}
        <div
          style={{
            display:     'flex',
            alignItems:  'center',
            gap:         '10px',
            marginBottom:'16px',
          }}
        >
          <span aria-hidden="true" style={{ fontSize: '18px' }}>🧠</span>
          <span
            style={{
              fontWeight: 700,
              color:     '#e8e8f8',
              fontFamily:"'Outfit', system-ui, sans-serif",
            }}
          >
            AI-Generated Insights
          </span>
          {/* "Live" tag — tag-up style from globals.css */}
          <span
            aria-label="Live data"
            style={{
              marginLeft:    'auto',
              background:    'rgba(16, 185, 129, 0.12)',
              color:         '#10b981',
              border:        '1px solid rgba(16, 185, 129, 0.25)',
              display:       'inline-flex',
              alignItems:    'center',
              gap:           '4px',
              padding:       '3px 10px',
              borderRadius:  '20px',
              fontSize:      '11px',
              fontWeight:     600,
              letterSpacing: '0.4px',
              fontFamily:   "'Outfit', system-ui, sans-serif",
            }}
          >
            Live
          </span>
        </div>

        {/* Insight cards — repeat(3,1fr) gap:12 */}
        <div
          style={{
            display:             'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap:                 '12px',
          }}
        >
          {AI_INSIGHTS.map((insight) => (
            <article
              key={insight.title}
              style={{
                padding:      '14px',
                borderRadius: '12px',
                // colour at 4% opacity (${color}0a) — matches JSX line 392
                background:   `${insight.color}0a`,
                // colour at 12.5% opacity (${color}20) — matches JSX line 393
                border:       `1px solid ${insight.color}20`,
              }}
            >
              <div
                aria-hidden="true"
                style={{ fontSize: '20px', marginBottom: '8px' }}
              >
                {insight.icon}
              </div>
              <div
                style={{
                  fontSize:     '13px',
                  fontWeight:    700,
                  color:        '#e8e8f8',
                  marginBottom: '4px',
                  fontFamily:  "'Outfit', system-ui, sans-serif",
                }}
              >
                {insight.title}
              </div>
              <div
                style={{
                  fontSize:   '11px',
                  color:      '#64748b',
                  lineHeight:  1.5,
                  fontFamily:"'Outfit', system-ui, sans-serif",
                }}
              >
                {insight.desc}
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

DashboardPage.displayName = 'DashboardPage';
