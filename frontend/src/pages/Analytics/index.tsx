/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  LumindAd · Pages · Analytics & Reports
 *  src/pages/Analytics/index.tsx
 *
 *  Route   /analytics  (matched by App.tsx inside AppLayout)
 *
 *  Layout  (top → bottom, mirrors LumindAd.jsx lines 563–657)
 *  ┌──────────────────────────────────────────────────────────┐
 *  │  Header — "Analytics & Reports"                          │
 *  │  [Platform filter ▾] [↓ Export Report]                  │
 *  ├──────────────────────────────────────────────────────────┤
 *  │  KPI row — repeat(4,1fr) gap:16 marginBottom:24          │
 *  │  👁 Impressions · 🎯 CTR · ✅ Conv Rate · 💲 CPC         │
 *  ├──────────────────────────────────────────────────────────┤
 *  │  Charts row — 1fr 1fr  gap:16  marginBottom:24           │
 *  │  PerformanceTrends (Area + Line)                         │
 *  ├──────────────────────────────────────────────────────────┤
 *  │  ML Models Panel — repeat(4,1fr) gap:12                  │
 *  └──────────────────────────────────────────────────────────┘
 *
 *  Header action 1 — Platform filter <select>
 *   From LumindAd.jsx lines 568–572 exactly:
 *   background  rgba(124,58,237,0.08)
 *   border      1px solid rgba(124,58,237,0.20)
 *   borderRadius  10px
 *   padding       9px 16px
 *   color         #a78bfa
 *   fontSize      13
 *   outline       none
 *   Options: ['All Platforms','Google Ads','Meta Ads','TikTok']
 *   Native <select> — not a custom dropdown — matches JSX exactly.
 *
 *  Header action 2 — Export Report
 *   Delegated to <ExportReportButton> (ExportReport.tsx) which opens
 *   a 400px slide-in drawer hosting the full BIExport module.
 *   This replaces the static `<button className="btn-secondary">↓ Export Report</button>`
 *   from the prototype with a fully functional implementation.
 *
 *  KPI values (from LumindAd.jsx lines 577–581)
 *   Total Impressions  531200        👁  #06b6d4  +24.5%  delay 0
 *   Click-Through Rate '7.32' (%)   🎯  #a855f7  +12.3%  delay 80
 *   Conversion Rate    '4.18' (%)   ✅  #10b981   +8.7%  delay 160
 *   Cost Per Click     '1.24' ($)   💲  #f59e0b   -5.2%  delay 240
 *     ↳ CTR value passed as string '7.32' — KPICard renders it as "7.32%"
 *     ↳ CPC value passed as string '1.24' — KPICard renders it as "$1.24"
 *     ↳ CPC change -5.2 renders in red (negative delta)
 *
 *  Platform filter → data flow
 *   filter state ──→ passed to <PerformanceTrends platformFilter={filter} />
 *   PerformanceTrends shows the filter label in chart subtitles.
 *   In the prototype, the chart data is unfiltered (analyticsData is global).
 *   A future API integration would pass filtered data here.
 *   MLModelsPanel is unaffected by the platform filter.
 *
 *  Export Report → drawer
 *   <ExportReportButton> toggles <ExportDrawer> (both from ExportReport.tsx).
 *   The drawer slides in from the right at 400px and hosts <BIExportPanel>
 *   with 4 tools: Power BI · Tableau · Excel · PDF.
 *
 *  Accessibility (WCAG 2.1 AA)
 *   – KPI row has role="list" (screen reader counts 4 metrics)
 *   – Platform <select> has an associated <label> (visually hidden)
 *   – Charts row/ML panel each have role="region" (inside child components)
 *   – Export drawer managed by ExportReport.tsx with aria-modal + focus trap
 *   – aria-live="polite" on the filter announces chart update to screen readers
 *
 *  Author : Elizabeth Díaz Familia
 *           AI Data Scientist · Sustainable Intelligence & BI
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { useState }            from 'react';
import { Header }              from '../../components/layout/Header';
import { KPICard }             from '../../components/shared/KPICard';
import { PerformanceTrends }   from './PerformanceTrends';
import { MLModelsPanel }       from './MLModelsPanel';
import { ExportReportButton, ExportDrawer } from './ExportReport';

// ─── Platform filter options (from LumindAd.jsx line 570) ─────────────────────

const PLATFORMS = ['All Platforms', 'Google Ads', 'Meta Ads', 'TikTok'] as const;
type Platform = typeof PLATFORMS[number];

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Analytics & Reports page — route /analytics.
 *
 * Renders four KPI cards, the PerformanceTrends dual-chart row,
 * and the MLModelsPanel. The platform <select> in the header filters
 * the chart subtitle. The Export Report button opens a slide-in drawer
 * hosting the full BIExport module (Power BI, Tableau, Excel, PDF).
 *
 * @example
 * // Consumed automatically by React Router via App.tsx
 * <Route path="/analytics" element={<AnalyticsPage />} />
 *
 * @example
 * // KPI token mapping from LumindAd.jsx (lines 577–581):
 * //   CTR value passed as string '7.32' so KPICard renders "7.32%"
 * //   CPC value passed as string '1.24' so KPICard renders "$1.24"
 * //   Negative change (-5.2) renders in red — lower CPC is better
 *
 * @example
 * // Platform filter → chart data flow:
 * //   filter = 'Google Ads'
 * //   → PerformanceTrends shows "Impressions over time — Google Ads"
 * //   → Future: parent fetches filtered analytics data and passes as prop
 */
export default function AnalyticsPage() {
  const [filter,      setFilter]      = useState<Platform>('All Platforms');
  const [exportOpen,  setExportOpen]  = useState(false);

  return (
    <>
      {/* ── Page header ──────────────────────────────────── */}
      <Header
        title="Analytics & Reports"
        subtitle="Deep insights into your advertising performance — SHAP · Anomaly Detection"
        actions={[

          /* ── Platform filter <select> ─────────────────────────────────────
           * Matches LumindAd.jsx lines 568–572 exactly.
           * Native <select> intentionally — not a custom dropdown —
           * so the prototype pixel-perfect match is preserved.
           * The visually hidden <label> satisfies WCAG 1.3.1.
           * ─────────────────────────────────────────────────────────────── */
          <div key="filter" style={{ position: 'relative' }}>
            <label
              htmlFor="platform-filter"
              style={{
                position: 'absolute',
                width: '1px', height: '1px',
                overflow: 'hidden', clip: 'rect(0,0,0,0)',
                whiteSpace: 'nowrap',
              }}
            >
              Filter by platform
            </label>
            <select
              id="platform-filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value as Platform)}
              style={{
                /* Token-exact match to LumindAd.jsx line 569 */
                background:   'rgba(124,58,237,0.08)',
                border:       '1px solid rgba(124,58,237,0.20)',
                borderRadius:  '10px',
                padding:      '9px 16px',
                color:        '#a78bfa',
                fontSize:     '13px',
                outline:       'none',
                cursor:       'pointer',
                fontFamily:   "'Outfit', system-ui, sans-serif",
                fontWeight:    500,
                appearance:   'none',
                paddingRight: '28px',   // room for chevron
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23a78bfa'/%3E%3C/svg%3E")`,
                backgroundRepeat:   'no-repeat',
                backgroundPosition: 'right 10px center',
              }}
            >
              {PLATFORMS.map((o) => (
                <option key={o} value={o}
                  style={{ background: '#1a0f3a', color: '#e8e8f8' }}
                >
                  {o}
                </option>
              ))}
            </select>
          </div>,

          /* ── Export Report trigger ──────────────────────────────────────
           * Replaces the static btn-secondary from LumindAd.jsx line 574.
           * Opens the BIExport slide-in drawer (ExportReport.tsx).
           * ─────────────────────────────────────────────────────────────── */
          <ExportReportButton
            key="export"
            onClick={() => setExportOpen(true)}
            expanded={exportOpen}
          />,
        ]}
      />

      {/* ── KPI row ──────────────────────────────────────── */}
      {/* repeat(4,1fr) gap:16 marginBottom:24 — LumindAd.jsx line 577 */}
      <div
        role="list"
        aria-label="Analytics key performance indicators"
        aria-live="polite"
        aria-atomic="false"
        style={{
          display:             'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap:                 '16px',
          marginBottom:        '24px',
        }}
      >
        {/* 👁 Total Impressions — #06b6d4 +24.5% delay 0 */}
        <div role="listitem">
          <KPICard
            title="Total Impressions"
            value={531200}
            change={24.5}
            icon="👁"
            color="#06b6d4"
            delay={0}
          />
        </div>

        {/* 🎯 Click-Through Rate — value '7.32' suffix % #a855f7 +12.3% delay 80 */}
        <div role="listitem">
          <KPICard
            title="Click-Through Rate"
            value="7.32"
            suffix="%"
            change={12.3}
            icon="🎯"
            color="#a855f7"
            delay={80}
          />
        </div>

        {/* ✅ Conversion Rate — value '4.18' suffix % #10b981 +8.7% delay 160 */}
        <div role="listitem">
          <KPICard
            title="Conversion Rate"
            value="4.18"
            suffix="%"
            change={8.7}
            icon="✅"
            color="#10b981"
            delay={160}
          />
        </div>

        {/* 💲 Cost Per Click — value '1.24' prefix $ #f59e0b -5.2% delay 240 */}
        {/* Negative change → rendered in red by KPICard (lower CPC is good) */}
        <div role="listitem">
          <KPICard
            title="Cost Per Click"
            value="1.24"
            prefix="$"
            change={-5.2}
            icon="💲"
            color="#f59e0b"
            delay={240}
          />
        </div>
      </div>

      {/* ── Charts row ───────────────────────────────────── */}
      {/* PerformanceTrends renders its own 1fr 1fr grid + marginBottom:24 */}
      {/* Platform filter propagated as label — data filtering left to future API */}
      <PerformanceTrends platformFilter={filter} />

      {/* ── ML Models Panel ──────────────────────────────── */}
      {/* Full-width card — repeat(4,1fr) grid inside */}
      <MLModelsPanel />

      {/* ── Export Report drawer ─────────────────────────── */}
      {/* Slide-in from right, 400px, hosts BIExport module */}
      <ExportDrawer
        open={exportOpen}
        onClose={() => setExportOpen(false)}
      />
    </>
  );
}

AnalyticsPage.displayName = 'AnalyticsPage';
