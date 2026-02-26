/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  LumindAd · Analytics · BIExport · TableauExport
 *  src/pages/Analytics/BIExport/TableauExport.tsx
 *
 *  Purpose
 *   Generates two downloadable artifacts for Tableau Desktop /
 *   Tableau Public / Tableau Server integration:
 *
 *   1. lumindad_tableau_{date}.csv   — Enriched campaign CSV
 *      All 6 campaigns + computed columns ready for Tableau:
 *      id · name · platform · status · budget · spent · impressions
 *      clicks · ctr_num (numeric) · conversions · roas · spend_pct
 *      roas_band · platform_group · is_active
 *
 *   2. lumindad_{date}.tds   — Tableau Data Source XML
 *      A .tds file that references the CSV above and pre-configures:
 *      – Column aliases and friendly names
 *      – Data types (string / integer / real)
 *      – Default aggregation (SUM / AVG / COUNT)
 *      – Calculated fields: ROAS Band, Budget Utilisation %, CTR
 *      – Color encoding: platform → brand hex palette
 *      Import via Tableau → Connect → More → Tableau Data Source (.tds)
 *
 *  Enriched CSV columns
 *   ctr_num       numeric CTR (e.g. 7.16) parsed from ctr string "7.16%"
 *   spend_pct     integer 0–100 (spent/budget×100)
 *   roas_band     "High (≥4x)" | "Medium (3–4x)" | "Low (<3x)" | "—"
 *   platform_group "Search" | "Social" | "Video" | "Professional"
 *   is_active     TRUE | FALSE
 *
 *  TDS structure
 *   The generated XML follows Tableau's .tds v18.1 schema.
 *   Key sections: <datasource> → <connection> → <relation> (CSV path)
 *   + <column> definitions for all fields + <aliases> for platform colors.
 *   Note: the CSV path in the TDS uses a relative reference so both files
 *   must be in the same folder when opened in Tableau Desktop.
 *
 *  Export state machine
 *   idle → generating (animated progress 0→100 over 1.4 s) → ready
 *
 *  Accessibility (WCAG 2.1 AA)
 *   – Progress bar has role="progressbar" + aria-valuenow
 *   – aria-live="polite" on the action container
 *   – Download buttons have descriptive aria-label per file
 *   – TDS preview uses <code> inside <pre> with scrollable container
 *
 *  Author : Elizabeth Díaz Familia
 *           AI Data Scientist · Sustainable Intelligence & BI
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { useState, useRef, useEffect } from 'react';
import {
  CAMPAIGNS,
  downloadBlob,
  toCSV,
  EXPORT_DATE,
} from './data';

// ─── Types ────────────────────────────────────────────────────────────────────

type ExportState = 'idle' | 'generating' | 'ready';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PLATFORM_GROUP: Record<string, string> = {
  'Google Ads': 'Search',
  'Meta Ads':   'Social',
  'TikTok':     'Video',
  'LinkedIn':   'Professional',
  'Twitter/X':  'Social',
};

const PLATFORM_COLOR: Record<string, string> = {
  'Google Ads': '#4285f4',
  'Meta Ads':   '#1877f2',
  'TikTok':     '#ff0050',
  'LinkedIn':   '#0077b5',
  'Twitter/X':  '#1da1f2',
};

function roasBand(roas: number): string {
  if (!roas) return '—';
  if (roas >= 4) return 'High (≥4x)';
  if (roas >= 3) return 'Medium (3–4x)';
  return 'Low (<3x)';
}

// ─── CSV builder ──────────────────────────────────────────────────────────────

function buildEnrichedCSV(): string {
  const rows = CAMPAIGNS.map((c) => {
    const ctrNum  = parseFloat(c.ctr) || 0;
    const spentPct = c.budget > 0 ? Math.round(c.spent / c.budget * 100) : 0;
    return {
      id:             c.id,
      name:           c.name,
      platform:       c.platform,
      platform_group: PLATFORM_GROUP[c.platform] ?? 'Other',
      status:         c.status,
      is_active:      c.status === 'active' ? 'TRUE' : 'FALSE',
      budget:         c.budget,
      spent:          c.spent,
      spend_pct:      spentPct,
      impressions:    c.impressions,
      clicks:         c.clicks,
      ctr_num:        ctrNum,
      conversions:    c.conv,
      roas:           c.roas,
      roas_band:      roasBand(c.roas),
    };
  });
  return toCSV(rows as unknown as Record<string, unknown>[]);
}

// ─── TDS builder ──────────────────────────────────────────────────────────────

function buildTDS(csvFilename: string): string {
  const platformAliases = Object.entries(PLATFORM_COLOR)
    .map(([name, color]) =>
      `    <alias key="${name}" value="${name}" color="${color}" />`
    ).join('\n');

  return `<?xml version='1.0' encoding='utf-8' ?>
<!-- Tableau Data Source — LumindAd Enterprise v1.0 -->
<!-- Generated: ${new Date().toISOString()} -->
<!-- Instructions:
     1. Place this .tds file in the same folder as ${csvFilename}
     2. Open Tableau Desktop → Connect → More → Tableau Data Source (.tds)
     3. Navigate to this file and click Open
     4. The data source will connect to the CSV automatically
-->
<datasource name='LumindAd Campaign Performance' version='18.1'
            xmlns:user='http://www.tableausoftware.com/xml/user'>

  <connection class='text' filename='${csvFilename}'
              default-settings='yes'>
    <format character=',' header='yes' precision='15' />
    <relation name='${csvFilename}' table='${csvFilename}' type='table' />
  </connection>

  <!-- ── Column Definitions ─────────────────────────────── -->
  <column datatype='string'  name='[id]'             role='dimension' type='nominal'
          caption='Campaign ID' />
  <column datatype='string'  name='[name]'           role='dimension' type='nominal'
          caption='Campaign Name' />
  <column datatype='string'  name='[platform]'       role='dimension' type='nominal'
          caption='Platform' />
  <column datatype='string'  name='[platform_group]' role='dimension' type='nominal'
          caption='Platform Group' />
  <column datatype='string'  name='[status]'         role='dimension' type='nominal'
          caption='Status' />
  <column datatype='boolean' name='[is_active]'      role='dimension' type='nominal'
          caption='Is Active' />
  <column datatype='real'    name='[budget]'         role='measure'   type='quantitative'
          caption='Budget (USD)' default-format='$#,##0' />
  <column datatype='real'    name='[spent]'          role='measure'   type='quantitative'
          caption='Spend (USD)' default-format='$#,##0' />
  <column datatype='integer' name='[spend_pct]'      role='measure'   type='quantitative'
          caption='Budget Used %' default-format='#,##0"%"' />
  <column datatype='integer' name='[impressions]'    role='measure'   type='quantitative'
          caption='Impressions' default-format='#,##0' />
  <column datatype='integer' name='[clicks]'         role='measure'   type='quantitative'
          caption='Clicks' default-format='#,##0' />
  <column datatype='real'    name='[ctr_num]'        role='measure'   type='quantitative'
          caption='CTR (%)' default-format='0.00"%"' />
  <column datatype='integer' name='[conversions]'    role='measure'   type='quantitative'
          caption='Conversions' default-format='#,##0' />
  <column datatype='real'    name='[roas]'           role='measure'   type='quantitative'
          caption='ROAS' default-format='0.0"x"' />
  <column datatype='string'  name='[roas_band]'      role='dimension' type='ordinal'
          caption='ROAS Band' />

  <!-- ── Calculated Fields ──────────────────────────────── -->
  <column caption='Budget Utilisation %' datatype='real'
          name='[Calculation_BudgetUtil]' role='measure' type='quantitative'>
    <calculation class='tableau' formula='SUM([spent]) / SUM([budget])' />
  </column>

  <column caption='Avg ROAS' datatype='real'
          name='[Calculation_AvgROAS]' role='measure' type='quantitative'>
    <calculation class='tableau' formula='AVG(IIF([roas] > 0, [roas], NULL))' />
  </column>

  <column caption='Conversion Rate %' datatype='real'
          name='[Calculation_ConvRate]' role='measure' type='quantitative'>
    <calculation class='tableau' formula='SUM([conversions]) / SUM([clicks])' />
  </column>

  <column caption='Cost Per Conversion' datatype='real'
          name='[Calculation_CPC]' role='measure' type='quantitative'>
    <calculation class='tableau' formula='SUM([spent]) / SUM([conversions])' />
  </column>

  <!-- ── Platform Colour Aliases ────────────────────────── -->
  <aliases enabled='yes'>
${platformAliases}
  </aliases>

  <!-- ── Sort & Filter Hints ────────────────────────────── -->
  <layout dim-ordering='alphabetic' measure-ordering='alphabetic'
          show-structure='true' />
  <semantic-values>
    <semantic-value col='[platform]' label='Platform' />
  </semantic-values>

</datasource>
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
      role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}
      aria-label={`Export progress: ${pct}%`}
      style={{ height:'4px', borderRadius:'2px', background:'#1e1e35', overflow:'hidden', marginTop:'12px' }}
    >
      <div style={{
        height:'100%', borderRadius:'2px', width:`${pct}%`,
        background:'linear-gradient(90deg,#10b981,#06b6d4)',
        transition:'width 0.1s linear',
      }} />
    </div>
  );
}

function DownloadButton({
  icon, label, filename, onClick, ariaLabel,
}: {
  icon: string; label: string; filename: string; onClick: () => void; ariaLabel: string;
}) {
  return (
    <button
      type="button" onClick={onClick} aria-label={ariaLabel}
      style={{
        display:'flex', alignItems:'center', gap:'10px',
        background:'rgba(16,185,129,0.08)', border:'1px solid rgba(16,185,129,0.2)',
        borderRadius:'8px', padding:'10px 16px',
        color:'#6ee7b7', fontSize:'12px', fontWeight:600,
        fontFamily:F, cursor:'pointer', transition:'all 0.15s ease',
      }}
      onMouseEnter={(e) => Object.assign(e.currentTarget.style, {
        background:'rgba(16,185,129,0.16)', borderColor:'rgba(16,185,129,0.38)', transform:'translateY(-1px)',
      })}
      onMouseLeave={(e) => Object.assign(e.currentTarget.style, {
        background:'rgba(16,185,129,0.08)', borderColor:'rgba(16,185,129,0.2)', transform:'',
      })}
    >
      <span style={{ fontSize:'18px' }}>{icon}</span>
      <div>
        <div>{label}</div>
        <div style={{ fontSize:'10px', color:'#475569', marginTop:'1px' }}>{filename}</div>
      </div>
    </button>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Tableau export panel — generates enriched CSV + TDS data source file.
 *
 * @example
 * // BIExport/index.tsx
 * {activeExport === 'tableau' && <TableauExport />}
 *
 * @example
 * // Standalone usage
 * <TableauExport />
 */
export function TableauExport() {
  const [state,    setState]    = useState<ExportState>('idle');
  const [progress, setProgress] = useState(0);
  const timerRef               = useRef<ReturnType<typeof setInterval> | null>(null);

  const csvFilename = `lumindad_tableau_${EXPORT_DATE}.csv`;
  const tdsFilename = `lumindad_${EXPORT_DATE}.tds`;

  const csvRef = useRef('');
  const tdsRef = useRef('');

  const startExport = () => {
    setState('generating');
    setProgress(0);
    csvRef.current = buildEnrichedCSV();
    tdsRef.current = buildTDS(csvFilename);

    let pct = 0;
    timerRef.current = setInterval(() => {
      pct += 4;
      setProgress(pct);
      if (pct >= 100) { clearInterval(timerRef.current!); setState('ready'); }
    }, 56);
  };

  const reset = () => { setState('idle'); setProgress(0); };
  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const dl = (content: string, name: string, mime: string) =>
    downloadBlob(new Blob([content], { type: mime }), name);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>

      {/* ── Header ───────────────────────────────────────── */}
      <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
        <div style={{
          width:'40px', height:'40px', borderRadius:'10px',
          background:'rgba(16,185,129,0.12)', border:'1px solid rgba(16,185,129,0.28)',
          display:'flex', alignItems:'center', justifyContent:'center', fontSize:'20px',
        }}>
          📈
        </div>
        <div>
          <div style={{ fontWeight:700, fontSize:'16px', color:'#e8e8f8', fontFamily:F }}>
            Salesforce Tableau
          </div>
          <div style={{ fontSize:'12px', color:'#475569', fontFamily:F }}>
            Enriched CSV + TDS Data Source
          </div>
        </div>
      </div>

      {/* ── Enriched columns card ─────────────────────────── */}
      <div style={CARD}>
        <div style={{ fontWeight:600, fontSize:'13px', color:'#e8e8f8', marginBottom:'12px', fontFamily:F }}>
          Enriched columns added for Tableau
        </div>
        {[
          { col:'ctr_num',        type:'REAL',    note:'Numeric CTR parsed from "7.16%" → 7.16' },
          { col:'spend_pct',      type:'INTEGER', note:'Budget utilisation 0–100' },
          { col:'roas_band',      type:'STRING',  note:'High / Medium / Low ordinal dimension' },
          { col:'platform_group', type:'STRING',  note:'Search · Social · Video · Professional' },
          { col:'is_active',      type:'BOOLEAN', note:'TRUE for status = "active"' },
        ].map(({ col, type, note }) => (
          <div key={col} style={{ display:'flex', gap:'8px', marginBottom:'8px', alignItems:'flex-start' }}>
            <code style={{
              background:'rgba(16,185,129,0.1)', border:'1px solid rgba(16,185,129,0.2)',
              borderRadius:'4px', padding:'1px 6px', fontSize:'11px', color:'#6ee7b7',
              fontFamily:"'Fira Code','Courier New',monospace", flexShrink:0,
            }}>
              {col}
            </code>
            <div>
              <span style={{ fontSize:'10px', color:'#475569', fontFamily:F }}>{type} · </span>
              <span style={{ fontSize:'11px', color:'#94a3b8', fontFamily:F }}>{note}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── TDS calculated fields preview ─────────────────── */}
      <div style={CARD}>
        <div style={{ fontWeight:600, fontSize:'13px', color:'#e8e8f8', marginBottom:'10px', fontFamily:F }}>
          TDS Calculated Fields
        </div>
        <pre style={{
          background:'rgba(16,185,129,0.05)', border:'1px solid rgba(16,185,129,0.12)',
          borderRadius:'8px', padding:'12px',
          fontSize:'11px', color:'#6ee7b7',
          fontFamily:"'Fira Code','Courier New',monospace",
          overflowX:'auto', margin:0, lineHeight:1.6,
        }}>
{`// Budget Utilisation %
SUM([spent]) / SUM([budget])

// Avg ROAS (active campaigns only)
AVG(IIF([roas] > 0, [roas], NULL))

// Conversion Rate %
SUM([conversions]) / SUM([clicks])

// Cost Per Conversion
SUM([spent]) / SUM([conversions])`}
        </pre>
      </div>

      {/* ── Export action ────────────────────────────────── */}
      <div aria-live="polite" aria-atomic="true">
        {state === 'idle' && (
          <button
            type="button" onClick={startExport}
            style={{
              width:'100%', padding:'12px',
              background:'linear-gradient(135deg,#059669,#0d9488)',
              border:'none', borderRadius:'10px',
              color:'#fff', fontSize:'13px', fontWeight:700,
              fontFamily:F, cursor:'pointer', letterSpacing:'0.3px',
              transition:'transform 0.2s, box-shadow 0.2s',
            }}
            onMouseEnter={(e) => Object.assign(e.currentTarget.style, { transform:'translateY(-1px)', boxShadow:'0 6px 20px rgba(16,185,129,0.35)' })}
            onMouseLeave={(e) => Object.assign(e.currentTarget.style, { transform:'', boxShadow:'' })}
          >
            📈 Generate Tableau Export
          </button>
        )}

        {state === 'generating' && (
          <div style={CARD}>
            <div style={{ fontSize:'13px', color:'#6ee7b7', fontFamily:F, fontWeight:600 }}>
              Building Tableau artifacts…
            </div>
            <div style={{ fontSize:'11px', color:'#64748b', fontFamily:F, marginTop:'4px' }}>
              {progress < 50 ? 'Enriching CSV columns…' : progress < 85 ? 'Generating TDS schema…' : 'Finalising…'}
            </div>
            <ProgressBar pct={progress} />
          </div>
        )}

        {state === 'ready' && (
          <div style={CARD}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px' }}>
              <div style={{ fontSize:'13px', fontWeight:700, color:'#10b981', fontFamily:F }}>
                ✓ Export ready — 2 files
              </div>
              <button type="button" onClick={reset}
                style={{ background:'none', border:'none', color:'#475569', fontSize:'11px', cursor:'pointer', fontFamily:F }}>
                Reset
              </button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
              <DownloadButton
                icon="📄" label="Enriched CSV"
                filename={csvFilename}
                ariaLabel="Download enriched campaign CSV for Tableau"
                onClick={() => dl(csvRef.current, csvFilename, 'text/csv')}
              />
              <DownloadButton
                icon="🔗" label="Tableau Data Source (.tds)"
                filename={tdsFilename}
                ariaLabel="Download Tableau Data Source TDS file"
                onClick={() => dl(tdsRef.current, tdsFilename, 'application/xml')}
              />
            </div>
            <div style={{
              marginTop:'12px', padding:'10px 12px',
              background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.2)',
              borderRadius:'8px', fontSize:'11px', color:'#fbbf24', fontFamily:F, lineHeight:1.5,
            }}>
              💡 Place both files in the same folder before opening the .tds in Tableau Desktop.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

TableauExport.displayName = 'TableauExport';
export default TableauExport;
