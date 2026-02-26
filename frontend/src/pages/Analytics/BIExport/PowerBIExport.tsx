/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  LumindAd · Analytics · BIExport · PowerBIExport
 *  src/pages/Analytics/BIExport/PowerBIExport.tsx
 *
 *  Purpose
 *   Generates three downloadable artifacts for Power BI Desktop /
 *   Power BI Service integration:
 *
 *   1. lumindad_campaigns_{date}.csv
 *      Flat CSV of all campaign records — one file per Get Data import.
 *      Columns: id · name · platform · status · budget · spent ·
 *               impressions · clicks · ctr · conv · roas · spend_pct
 *      `spend_pct` is a computed column: Math.round(spent/budget*100)
 *
 *   2. lumindad_schema_{date}.json
 *      Power BI compatible metadata schema describing column names,
 *      data types, and recommended roles (dimension / measure).
 *      Paste this into a Power Query M expression or use it with
 *      the Power BI REST API to auto-configure column types.
 *
 *   3. lumindad_measures_{date}.dax
 *      Ready-to-use DAX measures for the most common KPIs.
 *      Copy each measure into Power BI's "New Measure" dialog.
 *      Includes: Total Spend · CTR · Avg ROAS · Conversion Rate ·
 *                Cost Per Conversion · Budget Utilisation %
 *
 *  Export state machine
 *   idle → generating (fakeProgress 0→100 over 1.2 s) → ready
 *   Each artifact has its own download button in the "ready" state.
 *   "Reset" returns to idle for a new export run.
 *
 *  DAX measures included
 *   ─── KPI Measures ────────────────────────────────────────────
 *   [Total Spend]       = SUM(campaigns[spent])
 *   [Total Impressions] = SUM(campaigns[impressions])
 *   [Total Clicks]      = SUM(campaigns[clicks])
 *   [Total Conversions] = SUM(campaigns[conv])
 *   [CTR]               = DIVIDE([Total Clicks],[Total Impressions])
 *   [Avg ROAS]          = AVERAGEX(campaigns, campaigns[roas])
 *   [Conversion Rate]   = DIVIDE([Total Conversions],[Total Clicks])
 *   [Cost Per Conv]     = DIVIDE([Total Spend],[Total Conversions])
 *   [Budget Util %]     = DIVIDE([Total Spend],SUM(campaigns[budget]))
 *   ─── Time Intelligence ───────────────────────────────────────
 *   [Spend MTD]         = TOTALMTD([Total Spend], DimDate[Date])
 *   [Impressions YTD]   = TOTALYTD([Total Impressions], DimDate[Date])
 *
 *  Accessibility (WCAG 2.1 AA)
 *   – All buttons are native <button type="button">
 *   – Progress bar has role="progressbar" + aria-valuenow
 *   – aria-live="polite" announces state transitions
 *   – DAX preview is a <pre> inside a scrollable container
 *   – Download buttons have descriptive aria-label per file
 *
 *  Author : Elizabeth Díaz Familia
 *           AI Data Scientist · Sustainable Intelligence & BI
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { useState, useRef, useEffect } from 'react';
import {
  CAMPAIGNS,
  ANALYTICS_DATA,
  KPI_SUMMARY,
  downloadBlob,
  toCSV,
  EXPORT_DATE,
} from './data';

// ─── State ────────────────────────────────────────────────────────────────────

type ExportState = 'idle' | 'generating' | 'ready';

// ─── CSV builder ──────────────────────────────────────────────────────────────

function buildCampaignCSV(): string {
  const rows = CAMPAIGNS.map((c) => ({
    id:          c.id,
    name:        c.name,
    platform:    c.platform,
    status:      c.status,
    budget:      c.budget,
    spent:       c.spent,
    impressions: c.impressions,
    clicks:      c.clicks,
    ctr:         c.ctr,
    conversions: c.conv,
    roas:        c.roas,
    spend_pct:   c.budget > 0 ? Math.round(c.spent / c.budget * 100) : 0,
  }));
  return toCSV(rows as unknown as Record<string, unknown>[]);
}

// ─── JSON Schema builder ──────────────────────────────────────────────────────

function buildSchema(): string {
  const schema = {
    name:        'LumindAd Campaign Performance',
    version:     '1.0',
    generatedAt: new Date().toISOString(),
    source:      'LumindAd Enterprise v1.0',
    table:       'campaigns',
    columns: [
      { name:'id',          type:'Text',    role:'dimension', description:'Campaign identifier (e.g. C-001)' },
      { name:'name',        type:'Text',    role:'dimension', description:'Campaign display name' },
      { name:'platform',    type:'Text',    role:'dimension', description:'Advertising platform' },
      { name:'status',      type:'Text',    role:'dimension', description:'active | paused | draft | completed' },
      { name:'budget',      type:'Decimal', role:'measure',   description:'Total campaign budget (USD)' },
      { name:'spent',       type:'Decimal', role:'measure',   description:'Amount spent to date (USD)' },
      { name:'impressions', type:'Int64',   role:'measure',   description:'Total ad impressions' },
      { name:'clicks',      type:'Int64',   role:'measure',   description:'Total ad clicks' },
      { name:'ctr',         type:'Text',    role:'measure',   description:'Click-through rate (pre-formatted)' },
      { name:'conversions', type:'Int64',   role:'measure',   description:'Total conversions' },
      { name:'roas',        type:'Decimal', role:'measure',   description:'Return on ad spend multiplier' },
      { name:'spend_pct',   type:'Int64',   role:'measure',   description:'Percentage of budget spent (0–100)' },
    ],
    kpiSummary: KPI_SUMMARY,
  };
  return JSON.stringify(schema, null, 2);
}

// ─── DAX measures builder ─────────────────────────────────────────────────────

function buildDAX(): string {
  return `// ═══════════════════════════════════════════════════════
// LumindAd Enterprise — Power BI DAX Measures
// Generated: ${new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })}
// Table: campaigns
// Copy each measure into Power BI Desktop → New Measure
// ═══════════════════════════════════════════════════════

// ─── Core KPI Measures ───────────────────────────────────

[Total Spend] =
    SUM(campaigns[spent])

[Total Budget] =
    SUM(campaigns[budget])

[Total Impressions] =
    SUM(campaigns[impressions])

[Total Clicks] =
    SUM(campaigns[clicks])

[Total Conversions] =
    SUM(campaigns[conversions])

// ─── Ratio Measures ──────────────────────────────────────

[CTR] =
    DIVIDE(
        [Total Clicks],
        [Total Impressions],
        0
    )

[CTR %] =
    FORMAT([CTR], "0.00%")

[Avg ROAS] =
    AVERAGEX(
        FILTER(campaigns, campaigns[roas] > 0),
        campaigns[roas]
    )

[Conversion Rate] =
    DIVIDE(
        [Total Conversions],
        [Total Clicks],
        0
    )

[Cost Per Conversion] =
    DIVIDE(
        [Total Spend],
        [Total Conversions],
        BLANK()
    )

[Budget Utilisation %] =
    DIVIDE(
        [Total Spend],
        [Total Budget],
        0
    )

// ─── Time Intelligence (requires DimDate table) ──────────

[Spend MTD] =
    TOTALMTD(
        [Total Spend],
        DimDate[Date]
    )

[Spend QTD] =
    TOTALQTD(
        [Total Spend],
        DimDate[Date]
    )

[Impressions YTD] =
    TOTALYTD(
        [Total Impressions],
        DimDate[Date]
    )

[Spend MoM Change] =
    VAR CurrentMonth = [Total Spend]
    VAR PreviousMonth =
        CALCULATE(
            [Total Spend],
            DATEADD(DimDate[Date], -1, MONTH)
        )
    RETURN
        DIVIDE(CurrentMonth - PreviousMonth, PreviousMonth, 0)

// ─── Conditional Measures ────────────────────────────────

[ROAS Band] =
    SWITCH(
        TRUE(),
        [Avg ROAS] >= 4, "High (≥ 4x)",
        [Avg ROAS] >= 3, "Medium (3–4x)",
        [Avg ROAS] > 0,  "Low (< 3x)",
        "No Data"
    )

[Budget Status] =
    SWITCH(
        TRUE(),
        [Budget Utilisation %] >= 0.9, "Over Budget",
        [Budget Utilisation %] >= 0.7, "On Track",
        "Under-utilized"
    )

// ─── Platform Aggregations ───────────────────────────────

[Active Campaign Count] =
    COUNTROWS(
        FILTER(campaigns, campaigns[status] = "active")
    )

[Top Platform by Spend] =
    FIRSTNONBLANK(
        TOPN(1,
            SUMMARIZE(campaigns, campaigns[platform],
                "spend", [Total Spend]),
            [spend], DESC
        )[platform],
        1
    )
`;
}

// ─── Shared UI tokens ─────────────────────────────────────────────────────────

const CARD: React.CSSProperties = {
  background:     'rgba(15,10,30,0.85)',
  border:         '1px solid rgba(124,58,237,0.15)',
  borderRadius:   '12px',
  backdropFilter: 'blur(12px)',
  padding:        '20px',
};

const F = "'Outfit', system-ui, sans-serif";

// ─── Sub-components ───────────────────────────────────────────────────────────

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Export progress: ${pct}%`}
      style={{
        height: '4px', borderRadius: '2px',
        background: '#1e1e35', overflow: 'hidden', marginTop: '12px',
      }}
    >
      <div style={{
        height: '100%', borderRadius: '2px',
        width: `${pct}%`,
        background: 'linear-gradient(90deg,#7c3aed,#06b6d4)',
        transition: 'width 0.1s linear',
      }} />
    </div>
  );
}

function DownloadButton({
  label, filename, onClick, ariaLabel,
}: {
  label: string;
  filename: string;
  onClick: () => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        background: 'rgba(124,58,237,0.12)',
        border: '1px solid rgba(124,58,237,0.25)',
        borderRadius: '8px', padding: '10px 16px',
        color: '#a78bfa', fontSize: '12px', fontWeight: 600,
        fontFamily: F, cursor: 'pointer',
        transition: 'all 0.15s ease',
      }}
      onMouseEnter={(e) => {
        Object.assign(e.currentTarget.style, {
          background: 'rgba(124,58,237,0.22)',
          borderColor: 'rgba(124,58,237,0.45)',
          transform: 'translateY(-1px)',
        });
      }}
      onMouseLeave={(e) => {
        Object.assign(e.currentTarget.style, {
          background: 'rgba(124,58,237,0.12)',
          borderColor: 'rgba(124,58,237,0.25)',
          transform: '',
        });
      }}
    >
      <span style={{ fontSize: '14px' }}>↓</span>
      <div>
        <div>{label}</div>
        <div style={{ fontSize: '10px', color: '#64748b', marginTop: '1px' }}>
          {filename}
        </div>
      </div>
    </button>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Power BI export panel — generates CSV, JSON schema, and DAX measures.
 *
 * @example
 * // BIExport/index.tsx
 * {activeExport === 'powerbi' && <PowerBIExport />}
 */
export function PowerBIExport() {
  const [state,    setState]    = useState<ExportState>('idle');
  const [progress, setProgress] = useState(0);
  const timerRef               = useRef<ReturnType<typeof setInterval> | null>(null);

  // Pre-build artifacts when generating
  const csvRef    = useRef('');
  const schemaRef = useRef('');
  const daxRef    = useRef('');

  const startExport = () => {
    setState('generating');
    setProgress(0);

    // Build artifacts synchronously (fast for small datasets)
    csvRef.current    = buildCampaignCSV();
    schemaRef.current = buildSchema();
    daxRef.current    = buildDAX();

    // Animate progress 0 → 100 over 1.2 s
    let pct = 0;
    timerRef.current = setInterval(() => {
      pct += 5;
      setProgress(pct);
      if (pct >= 100) {
        clearInterval(timerRef.current!);
        setState('ready');
      }
    }, 60);
  };

  const reset = () => { setState('idle'); setProgress(0); };

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const dl = (content: string, filename: string, mime: string) => {
    downloadBlob(new Blob([content], { type: mime }), filename);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* ── Header ───────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: '40px', height: '40px', borderRadius: '10px',
          background: 'rgba(243,187,22,0.15)',
          border: '1px solid rgba(243,187,22,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '20px',
        }}>
          📊
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: '16px', color: '#e8e8f8', fontFamily: F }}>
            Microsoft Power BI
          </div>
          <div style={{ fontSize: '12px', color: '#475569', fontFamily: F }}>
            CSV + JSON Schema + DAX Measures
          </div>
        </div>
      </div>

      {/* ── What's included ──────────────────────────────── */}
      <div style={CARD}>
        <div style={{ fontWeight: 600, fontSize: '13px', color: '#e8e8f8', marginBottom: '12px', fontFamily: F }}>
          What's included in this export
        </div>
        {[
          { icon: '📄', label: 'Campaign CSV',  desc: `${CAMPAIGNS.length} rows · 12 columns including computed spend_pct` },
          { icon: '🔧', label: 'JSON Schema',   desc: 'Column types, roles, and metadata for Power Query auto-config' },
          { icon: '⚡', label: 'DAX Measures',  desc: '15 ready-to-use measures: KPIs, ratios, time intelligence' },
        ].map(({ icon, label, desc }) => (
          <div key={label} style={{
            display: 'flex', gap: '10px', marginBottom: '10px', alignItems: 'flex-start',
          }}>
            <span style={{ fontSize: '16px', flexShrink: 0, marginTop: '1px' }}>{icon}</span>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#c4b5fd', fontFamily: F }}>{label}</div>
              <div style={{ fontSize: '11px', color: '#64748b', fontFamily: F }}>{desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── DAX preview card ─────────────────────────────── */}
      <div style={CARD}>
        <div style={{ fontWeight: 600, fontSize: '13px', color: '#e8e8f8', marginBottom: '10px', fontFamily: F }}>
          DAX Preview — key measures
        </div>
        <pre style={{
          background: 'rgba(124,58,237,0.06)',
          border: '1px solid rgba(124,58,237,0.12)',
          borderRadius: '8px', padding: '12px',
          fontSize: '11px', color: '#94a3b8',
          fontFamily: "'Fira Code', 'Courier New', monospace",
          overflowX: 'auto', margin: 0,
          lineHeight: 1.6,
          maxHeight: '200px', overflowY: 'auto',
        }}>
{`[CTR] =
    DIVIDE([Total Clicks], [Total Impressions], 0)

[Avg ROAS] =
    AVERAGEX(
        FILTER(campaigns, campaigns[roas] > 0),
        campaigns[roas]
    )

[Budget Utilisation %] =
    DIVIDE([Total Spend], [Total Budget], 0)

[ROAS Band] =
    SWITCH(TRUE(),
        [Avg ROAS] >= 4, "High (≥ 4x)",
        [Avg ROAS] >= 3, "Medium (3–4x)",
        [Avg ROAS] > 0,  "Low (< 3x)",
        "No Data"
    )`}
        </pre>
      </div>

      {/* ── Export action ────────────────────────────────── */}
      <div aria-live="polite" aria-atomic="true">
        {state === 'idle' && (
          <button
            type="button"
            onClick={startExport}
            style={{
              width: '100%', padding: '12px',
              background: 'linear-gradient(135deg,#7c3aed,#5b21b6)',
              border: 'none', borderRadius: '10px',
              color: '#fff', fontSize: '13px', fontWeight: 700,
              fontFamily: F, cursor: 'pointer', letterSpacing: '0.3px',
              transition: 'transform 0.2s, box-shadow 0.2s',
            }}
            onMouseEnter={(e) => Object.assign(e.currentTarget.style, { transform: 'translateY(-1px)', boxShadow: '0 6px 20px rgba(124,58,237,0.4)' })}
            onMouseLeave={(e) => Object.assign(e.currentTarget.style, { transform: '', boxShadow: '' })}
          >
            ⚡ Generate Power BI Export
          </button>
        )}

        {state === 'generating' && (
          <div style={{ ...CARD }}>
            <div style={{ fontSize: '13px', color: '#a78bfa', fontFamily: F, fontWeight: 600 }}>
              Building export artifacts…
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', fontFamily: F, marginTop: '4px' }}>
              {progress < 40  ? 'Processing campaign data…'
               : progress < 70 ? 'Generating JSON schema…'
               : progress < 90 ? 'Compiling DAX measures…'
               : 'Finalising…'}
            </div>
            <ProgressBar pct={progress} />
          </div>
        )}

        {state === 'ready' && (
          <div style={{ ...CARD }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px',
            }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#10b981', fontFamily: F }}>
                ✓ Export ready — 3 files
              </div>
              <button
                type="button"
                onClick={reset}
                style={{
                  background: 'none', border: 'none', color: '#475569',
                  fontSize: '11px', cursor: 'pointer', fontFamily: F,
                }}
              >
                Reset
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <DownloadButton
                label="Campaign CSV"
                filename={`lumindad_campaigns_${EXPORT_DATE}.csv`}
                ariaLabel="Download campaign data as CSV for Power BI"
                onClick={() => dl(csvRef.current, `lumindad_campaigns_${EXPORT_DATE}.csv`, 'text/csv')}
              />
              <DownloadButton
                label="JSON Schema"
                filename={`lumindad_schema_${EXPORT_DATE}.json`}
                ariaLabel="Download Power BI JSON schema file"
                onClick={() => dl(schemaRef.current, `lumindad_schema_${EXPORT_DATE}.json`, 'application/json')}
              />
              <DownloadButton
                label="DAX Measures"
                filename={`lumindad_measures_${EXPORT_DATE}.dax`}
                ariaLabel="Download DAX measures file for Power BI"
                onClick={() => dl(daxRef.current, `lumindad_measures_${EXPORT_DATE}.dax`, 'text/plain')}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

PowerBIExport.displayName = 'PowerBIExport';
export default PowerBIExport;
