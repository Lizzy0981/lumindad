/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  LumindAd · Analytics · BIExport · PDFExport
 *  src/pages/Analytics/BIExport/PDFExport.tsx
 *
 *  Purpose
 *   Generates a professional A4 executive report PDF and triggers a
 *   browser download. The PDF is produced server-side by reportlab
 *   (Python) via a POST to /api/export/pdf, which returns the file
 *   as a base64-encoded string. The component decodes it and uses
 *   downloadBlob() to stream it to the user without a page redirect.
 *
 *  PDF structure (4 pages / sections)
 *   Page 1 · Executive KPI Summary
 *     – 8 KPI cells in a 4×2 grid (Total Spend · Impressions · Clicks ·
 *       Conversions / CTR · Conv Rate · CPC · Budget Utilisation)
 *     – LumindAd brand header with purple gradient accent
 *   Page 2 · Campaign Performance
 *     – Full campaign table: id · name · platform · status · budget ·
 *       spent · ROAS (colour-coded by threshold)
 *     – Table repeating headers on each page
 *   Page 3 · AI-Generated Insights
 *     – 4 insight cards: Peak Performance · Anomaly Detected ·
 *       Growth Opportunity · AI Reallocation
 *     – Each card colour-coded by insight type
 *   Page 4 · Active ML Models
 *     – 4 model rows: algorithm · accuracy · status
 *     – Footer: author · model stack · confidentiality notice
 *
 *  API contract  POST /api/export/pdf
 *   Request body (JSON):
 *     { campaigns, analytics, kpiSummary, mlModels, generatedBy, reportDate }
 *   Response (JSON):
 *     { success: true, pdf: "<base64 string>", filename: "..." }
 *   On error:
 *     { success: false, error: "<message>" }
 *
 *  Fallback (dev / no backend)
 *   When the API is unavailable, the component falls back to generating
 *   a simpler HTML-based PDF via window.print() with a dedicated print
 *   stylesheet. The user gets a prompt to save as PDF from the browser.
 *   This ensures the button always works even during local development.
 *
 *  Options panel
 *   The user can toggle which sections to include before generating:
 *   [x] KPI Summary  [x] Campaigns  [x] AI Insights  [x] ML Models
 *   These are sent in the API request body so the backend can omit
 *   sections dynamically.
 *
 *  Export state machine
 *   idle → options → generating (animated 0→100 over 2 s) → ready → downloaded
 *   "Back to options" allows re-generating with different section selection.
 *
 *  Accessibility (WCAG 2.1 AA)
 *   – Checkboxes use <label htmlFor> association
 *   – Progress bar has role="progressbar" + aria-valuenow
 *   – aria-live="polite" announces state transitions
 *   – Download button has aria-label with filename
 *   – Print fallback opens a new tab and is communicated via aria-live
 *
 *  Author : Elizabeth Díaz Familia
 *           AI Data Scientist · Sustainable Intelligence & BI
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { useState, useRef, useEffect, useId } from 'react';
import {
  CAMPAIGNS, ANALYTICS_DATA, KPI_SUMMARY, ML_MODELS,
  downloadBlob, EXPORT_DATE,
} from './data';

// ─── Types ────────────────────────────────────────────────────────────────────

type ExportState = 'idle' | 'generating' | 'ready' | 'error';

interface SectionOptions {
  kpiSummary:  boolean;
  campaigns:   boolean;
  aiInsights:  boolean;
  mlModels:    boolean;
}

// ─── HTML print fallback ──────────────────────────────────────────────────────

/**
 * Generates a complete HTML document styled for print (A4 / US Letter).
 * Used as fallback when the /api/export/pdf endpoint is unavailable.
 * Opens in a new tab — user saves as PDF via Ctrl+P → Save as PDF.
 */
function buildPrintHTML(options: SectionOptions): string {
  const { kpiSummary, campaigns, aiInsights, mlModels } = options;

  const kpiGrid = kpiSummary ? `
    <section class="section">
      <h2>01 — Executive KPI Summary</h2>
      <div class="kpi-grid">
        <div class="kpi-card purple"><div class="kpi-val">$48,290</div><div class="kpi-lbl">Total Ad Spend</div><div class="kpi-delta up">+12.5%</div></div>
        <div class="kpi-card cyan">  <div class="kpi-val">531,200</div><div class="kpi-lbl">Total Impressions</div><div class="kpi-delta up">+24.5%</div></div>
        <div class="kpi-card violet"><div class="kpi-val">38,940</div><div class="kpi-lbl">Total Clicks</div><div class="kpi-delta up">+15.2%</div></div>
        <div class="kpi-card amber"> <div class="kpi-val">2,847</div><div class="kpi-lbl">Total Conversions</div><div class="kpi-delta up">+22.1%</div></div>
        <div class="kpi-card green"> <div class="kpi-val">7.32%</div><div class="kpi-lbl">Avg CTR</div><div class="kpi-delta up">+12.3%</div></div>
        <div class="kpi-card green"> <div class="kpi-val">4.18%</div><div class="kpi-lbl">Avg Conv Rate</div><div class="kpi-delta up">+8.7%</div></div>
        <div class="kpi-card green"> <div class="kpi-val">$1.24</div><div class="kpi-lbl">Avg CPC</div><div class="kpi-delta up">-5.2%</div></div>
        <div class="kpi-card amber"> <div class="kpi-val">64%</div><div class="kpi-lbl">Budget Used</div><div class="kpi-delta neutral">Normal</div></div>
      </div>
    </section>` : '';

  const campaignRows = campaigns ? CAMPAIGNS.map(c => {
    const roasClass = c.roas >= 4 ? 'green' : c.roas >= 3 ? 'amber' : c.roas > 0 ? 'red' : 'slate';
    const stsClass  = c.status === 'active' ? 'green' : c.status === 'paused' ? 'amber' : 'slate';
    return `<tr>
      <td class="mono">${c.id}</td>
      <td class="bold">${c.name}</td>
      <td>${c.platform}</td>
      <td class="${stsClass} bold upper">${c.status}</td>
      <td class="right">$${c.budget.toLocaleString()}</td>
      <td class="right bold">$${c.spent.toLocaleString()}</td>
      <td class="right ${roasClass} bold">${c.roas ? c.roas + 'x' : '—'}</td>
    </tr>`;
  }).join('') : '';

  const campaignsSection = campaigns ? `
    <section class="section">
      <h2>02 — Campaign Performance</h2>
      <table>
        <thead><tr>
          <th>ID</th><th>Campaign Name</th><th>Platform</th>
          <th>Status</th><th>Budget</th><th>Spent</th><th>ROAS</th>
        </tr></thead>
        <tbody>${campaignRows}</tbody>
      </table>
    </section>` : '';

  const insightsSection = aiInsights ? `
    <section class="section">
      <h2>03 — AI-Generated Insights</h2>
      <div class="insight-grid">
        <div class="insight purple"><strong>🎯 Peak Performance</strong><p>Friday ads convert 34% better. Recommend increasing budget by $200 for next Friday.</p></div>
        <div class="insight amber"><strong>⚠️ Anomaly Detected</strong><p>TikTok campaign CTR dropped 18% vs last week. Isolation Forest flagged this outlier.</p></div>
        <div class="insight green"><strong>📈 Growth Opportunity</strong><p>LinkedIn B2B segment shows 5.1x ROAS. XGBoost recommends scaling budget +40%.</p></div>
        <div class="insight cyan"><strong>🤖 AI Reallocation</strong><p>Reallocate $1,200 from Meta to Google Ads. Predictive model estimates +23% ROAS.</p></div>
      </div>
    </section>` : '';

  const mlRows = mlModels ? ML_MODELS.map(m => `
    <tr>
      <td class="bold">${m.name}</td>
      <td>${m.type}</td>
      <td class="purple bold center">${m.accuracy}</td>
      <td class="${m.status === 'active' ? 'green' : 'amber'} bold center upper">${m.status}</td>
    </tr>`).join('') : '';

  const mlSection = mlModels ? `
    <section class="section">
      <h2>04 — Active ML Models</h2>
      <table>
        <thead><tr><th>Model</th><th>Algorithm</th><th>Accuracy</th><th>Status</th></tr></thead>
        <tbody>${mlRows}</tbody>
      </table>
    </section>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>LumindAd Executive Report — ${EXPORT_DATE}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Outfit', Arial, sans-serif;
      background: #0F0A1E; color: #E8E8F8;
      padding: 20mm 20mm; font-size: 10pt; line-height: 1.5;
    }
    @media print {
      body { background: #fff; color: #111; }
      .kpi-card { border-color: #ddd !important; background: #fafafa !important; }
      .kpi-val  { color: #1a1a1a !important; }
      table tr:nth-child(even) { background: #f9f9f9 !important; }
    }
    header { margin-bottom: 20px; border-bottom: 3px solid #7C3AED; padding-bottom: 10px; }
    header h1 { font-size: 22pt; color: #E8E8F8; font-weight: 700; }
    header p  { color: #94A3B8; font-size: 9pt; margin-top: 4px; }
    .section  { margin-bottom: 28px; }
    h2 { font-size: 13pt; color: #7C3AED; margin-bottom: 12px; font-weight: 700;
         border-bottom: 1px solid #2D2050; padding-bottom: 6px; }
    .kpi-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 10px; }
    .kpi-card { padding: 14px; border-radius: 8px; border: 1px solid #2D2050; background: #1A0F3A; }
    .kpi-val  { font-size: 18pt; font-weight: 700; margin-bottom: 3px; }
    .kpi-lbl  { font-size: 8pt; color: #94A3B8; }
    .kpi-delta{ font-size: 8pt; margin-top: 3px; font-weight: 600; }
    .kpi-card.purple .kpi-val { color: #A78BFA; }
    .kpi-card.cyan .kpi-val   { color: #22D3EE; }
    .kpi-card.violet .kpi-val { color: #C084FC; }
    .kpi-card.amber .kpi-val  { color: #FCD34D; }
    .kpi-card.green .kpi-val  { color: #34D399; }
    .up      { color: #10B981; }
    .neutral { color: #94A3B8; }
    table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 9pt; }
    thead tr { background: #2D2050; }
    th { padding: 8px 10px; text-align: left; font-weight: 700; color: #E8E8F8; font-size: 8pt; letter-spacing: 0.5px; }
    td { padding: 7px 10px; border-bottom: 1px solid #1E1535; color: #94A3B8; }
    tr:nth-child(even) td { background: #12091D; }
    .right  { text-align: right; }
    .center { text-align: center; }
    .bold   { font-weight: 700; }
    .mono   { font-family: monospace; font-size: 8pt; }
    .upper  { text-transform: uppercase; font-size: 8pt; }
    .purple { color: #A78BFA; }
    .green  { color: #10B981; }
    .amber  { color: #F59E0B; }
    .red    { color: #EF4444; }
    .slate  { color: #94A3B8; }
    .insight-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .insight { padding: 14px; border-radius: 8px; border-left: 3px solid; }
    .insight.purple { border-color: #7C3AED; background: rgba(124,58,237,0.07); }
    .insight.amber  { border-color: #F59E0B; background: rgba(245,158,11,0.07); }
    .insight.green  { border-color: #10B981; background: rgba(16,185,129,0.07); }
    .insight.cyan   { border-color: #06B6D4; background: rgba(6,182,212,0.07); }
    .insight strong { display: block; margin-bottom: 5px; font-size: 10pt; }
    .insight p      { font-size: 8.5pt; color: #94A3B8; line-height: 1.5; }
    footer { margin-top: 28px; padding-top: 10px; border-top: 1px solid #2D2050;
             font-size: 8pt; color: #475569; }
  </style>
</head>
<body>
  <header>
    <h1>LumindAd Enterprise</h1>
    <p>Executive Performance Report · ${new Date().toLocaleDateString('en-US', {year:'numeric',month:'long',day:'numeric'})} · Confidential</p>
  </header>
  ${kpiGrid}
  ${campaignsSection}
  ${insightsSection}
  ${mlSection}
  <footer>
    Generated by LumindAd Enterprise · AI Data Scientist: Elizabeth Díaz Familia ·
    Models: XGBoost · Isolation Forest · TensorFlow · SHAP Explainability
  </footer>
  <script>window.onload = () => window.print();</script>
</body>
</html>`;
}

// ─── API call (server-side reportlab PDF) ─────────────────────────────────────

async function fetchPDFFromAPI(options: SectionOptions): Promise<Blob | null> {
  try {
    const res = await fetch('/api/export/pdf', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        campaigns:   CAMPAIGNS,
        analytics:   ANALYTICS_DATA,
        kpiSummary:  KPI_SUMMARY,
        mlModels:    ML_MODELS,
        sections:    options,
        generatedBy: 'LumindAd Enterprise v1.0',
        reportDate:  EXPORT_DATE,
      }),
    });
    if (!res.ok) return null;
    const json = await res.json() as { success: boolean; pdf?: string };
    if (!json.success || !json.pdf) return null;
    const binary = atob(json.pdf);
    const bytes  = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: 'application/pdf' });
  } catch {
    return null;
  }
}

// ─── Shared UI tokens ─────────────────────────────────────────────────────────

const CARD: React.CSSProperties = {
  background:'rgba(15,10,30,0.85)', border:'1px solid rgba(124,58,237,0.15)',
  borderRadius:'12px', backdropFilter:'blur(12px)', padding:'20px',
};
const F = "'Outfit', system-ui, sans-serif";

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Executive PDF export panel with section selection and API/print fallback.
 *
 * @example
 * // BIExport/index.tsx
 * {activeExport === 'pdf' && <PDFExport />}
 *
 * @example
 * // Standalone with all sections pre-selected
 * <PDFExport />
 */
export function PDFExport() {
  const id = useId();

  const [state,   setState]   = useState<ExportState>('idle');
  const [progress,setProgress]= useState(0);
  const [usedFallback,setUsedFallback] = useState(false);
  const [options, setOptions] = useState<SectionOptions>({
    kpiSummary: true, campaigns: true, aiInsights: true, mlModels: true,
  });

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const toggleOption = (key: keyof SectionOptions) =>
    setOptions(prev => ({ ...prev, [key]: !prev[key] }));

  const startExport = async () => {
    setState('generating');
    setProgress(0);
    setUsedFallback(false);

    let pct = 0;
    timerRef.current = setInterval(() => {
      pct = Math.min(pct + 3, 90);
      setProgress(pct);
    }, 60);

    // Try API first
    const blob = await fetchPDFFromAPI(options);

    clearInterval(timerRef.current!);
    setProgress(100);

    if (blob) {
      downloadBlob(blob, `lumindad_report_${EXPORT_DATE}.pdf`);
      setState('ready');
    } else {
      // Fallback: HTML print
      setUsedFallback(true);
      const html = buildPrintHTML(options);
      const win  = window.open('', '_blank');
      if (win) {
        win.document.write(html);
        win.document.close();
      }
      setState('ready');
    }
  };

  const reset = () => { setState('idle'); setProgress(0); setUsedFallback(false); };
  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const sectionCount = Object.values(options).filter(Boolean).length;

  const SECTION_LABELS: { key: keyof SectionOptions; label: string; icon: string }[] = [
    { key:'kpiSummary',  label:'KPI Summary',    icon:'📊' },
    { key:'campaigns',   label:'Campaigns',       icon:'📋' },
    { key:'aiInsights',  label:'AI Insights',     icon:'🤖' },
    { key:'mlModels',    label:'ML Models',       icon:'🧠' },
  ];

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>

      {/* ── Header ───────────────────────────────────────── */}
      <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
        <div style={{
          width:'40px', height:'40px', borderRadius:'10px',
          background:'rgba(239,68,68,0.12)', border:'1px solid rgba(239,68,68,0.28)',
          display:'flex', alignItems:'center', justifyContent:'center', fontSize:'20px',
        }}>
          📄
        </div>
        <div>
          <div style={{ fontWeight:700, fontSize:'16px', color:'#e8e8f8', fontFamily:F }}>
            Executive PDF Report
          </div>
          <div style={{ fontSize:'12px', color:'#475569', fontFamily:F }}>
            A4 · reportlab backend · print fallback
          </div>
        </div>
      </div>

      {/* ── Section selector ──────────────────────────────── */}
      {state === 'idle' && (
        <div style={CARD}>
          <div style={{ fontWeight:600, fontSize:'13px', color:'#e8e8f8', marginBottom:'12px', fontFamily:F }}>
            Select sections to include
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' }}>
            {SECTION_LABELS.map(({ key, label, icon }) => (
              <label
                key={key}
                htmlFor={`${id}-${key}`}
                style={{
                  display:'flex', alignItems:'center', gap:'10px',
                  padding:'10px 12px', borderRadius:'8px', cursor:'pointer',
                  background: options[key] ? 'rgba(124,58,237,0.15)' : 'rgba(124,58,237,0.04)',
                  border: `1px solid ${options[key] ? 'rgba(124,58,237,0.35)' : 'rgba(124,58,237,0.12)'}`,
                  transition:'all 0.15s ease',
                }}
              >
                <input
                  id={`${id}-${key}`}
                  type="checkbox"
                  checked={options[key]}
                  onChange={() => toggleOption(key)}
                  style={{ accentColor:'#7c3aed', width:'14px', height:'14px', flexShrink:0 }}
                />
                <span style={{ fontSize:'14px' }}>{icon}</span>
                <span style={{ fontSize:'12px', fontWeight:600, color: options[key] ? '#c4b5fd' : '#64748b', fontFamily:F }}>
                  {label}
                </span>
              </label>
            ))}
          </div>
          <div style={{ marginTop:'10px', fontSize:'11px', color:'#475569', fontFamily:F }}>
            {sectionCount} section{sectionCount !== 1 ? 's' : ''} selected
          </div>
        </div>
      )}

      {/* ── PDF structure preview ─────────────────────────── */}
      {state === 'idle' && (
        <div style={CARD}>
          <div style={{ fontWeight:600, fontSize:'13px', color:'#e8e8f8', marginBottom:'10px', fontFamily:F }}>
            Report structure
          </div>
          {[
            { num:'01', title:'Executive KPI Summary', desc:'8 KPIs in branded 4×2 grid' },
            { num:'02', title:'Campaign Performance',  desc:'Full table · status · ROAS colour-coded' },
            { num:'03', title:'AI-Generated Insights', desc:'4 insight cards · anomalies · opportunities' },
            { num:'04', title:'Active ML Models',      desc:'4 models · accuracy · algorithm · status' },
          ].map(({ num, title, desc }) => (
            <div key={num} style={{ display:'flex', gap:'10px', marginBottom:'8px', opacity: options[num==='01'?'kpiSummary':num==='02'?'campaigns':num==='03'?'aiInsights':'mlModels'] ? 1 : 0.35 }}>
              <span style={{
                fontSize:'10px', fontWeight:700, color:'#7c3aed',
                background:'rgba(124,58,237,0.1)', borderRadius:'4px',
                padding:'2px 6px', fontFamily:F, flexShrink:0, alignSelf:'flex-start', marginTop:'1px',
              }}>{num}</span>
              <div>
                <div style={{ fontSize:'12px', fontWeight:600, color:'#c4b5fd', fontFamily:F }}>{title}</div>
                <div style={{ fontSize:'11px', color:'#64748b', fontFamily:F }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Export action ─────────────────────────────────── */}
      <div aria-live="polite" aria-atomic="true">
        {state === 'idle' && (
          <button
            type="button"
            onClick={startExport}
            disabled={sectionCount === 0}
            aria-label={`Generate PDF report with ${sectionCount} sections`}
            style={{
              width:'100%', padding:'12px',
              background: sectionCount > 0 ? 'linear-gradient(135deg,#dc2626,#991b1b)' : '#2d2050',
              border:'none', borderRadius:'10px',
              color: sectionCount > 0 ? '#fff' : '#475569',
              fontSize:'13px', fontWeight:700, fontFamily:F,
              cursor: sectionCount > 0 ? 'pointer' : 'not-allowed',
              letterSpacing:'0.3px', transition:'transform 0.2s, box-shadow 0.2s',
            }}
            onMouseEnter={(e) => sectionCount > 0 && Object.assign(e.currentTarget.style, { transform:'translateY(-1px)', boxShadow:'0 6px 20px rgba(220,38,38,0.35)' })}
            onMouseLeave={(e) => Object.assign(e.currentTarget.style, { transform:'', boxShadow:'' })}
          >
            📄 Generate Executive PDF
          </button>
        )}

        {state === 'generating' && (
          <div style={CARD}>
            <div style={{ fontSize:'13px', color:'#fca5a5', fontFamily:F, fontWeight:600 }}>
              {usedFallback ? 'Opening print dialog…' : 'Generating PDF…'}
            </div>
            <div style={{ fontSize:'11px', color:'#64748b', fontFamily:F, marginTop:'4px' }}>
              {progress < 30 ? 'Preparing KPI summary…'
               : progress < 55 ? 'Building campaign table…'
               : progress < 75 ? 'Adding AI insights…'
               : progress < 90 ? 'Finalising layout…'
               : 'Almost done…'}
            </div>
            <div role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}
              aria-label={`PDF generation: ${progress}%`}
              style={{ height:'4px', borderRadius:'2px', background:'#1e1e35', overflow:'hidden', marginTop:'12px' }}>
              <div style={{ height:'100%', borderRadius:'2px', width:`${progress}%`,
                background:'linear-gradient(90deg,#dc2626,#f87171)', transition:'width 0.1s linear' }} />
            </div>
          </div>
        )}

        {state === 'ready' && (
          <div style={CARD}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px' }}>
              <div style={{ fontSize:'13px', fontWeight:700, color:'#f87171', fontFamily:F }}>
                ✓ {usedFallback ? 'Print dialog opened' : 'PDF downloaded'}
              </div>
              <button type="button" onClick={reset}
                style={{ background:'none', border:'none', color:'#475569', fontSize:'11px', cursor:'pointer', fontFamily:F }}>
                Reset
              </button>
            </div>

            {usedFallback ? (
              <div style={{ fontSize:'11px', color:'#94a3b8', fontFamily:F, lineHeight:1.6 }}>
                <p style={{ marginBottom:'6px' }}>
                  A new tab opened with the formatted report. Use{' '}
                  <kbd style={{ background:'rgba(124,58,237,0.15)', padding:'1px 5px', borderRadius:'4px', fontSize:'10px' }}>
                    Ctrl+P
                  </kbd>{' '}→ <strong style={{ color:'#c4b5fd' }}>Save as PDF</strong> to download.
                </p>
                <p style={{ color:'#475569' }}>
                  The API endpoint (/api/export/pdf) was unavailable — using browser print fallback.
                </p>
              </div>
            ) : (
              <div style={{ fontSize:'11px', color:'#94a3b8', fontFamily:F, lineHeight:1.6 }}>
                <strong style={{ color:'#e8e8f8' }}>lumindad_report_{EXPORT_DATE}.pdf</strong> saved to your downloads.
                <br />
                <span style={{ color:'#475569' }}>
                  {sectionCount} sections · A4 format · LumindAd Enterprise branding
                </span>
              </div>
            )}

            <div style={{ marginTop:'12px', display:'flex', gap:'8px' }}>
              <button
                type="button"
                onClick={() => { setState('idle'); setProgress(0); }}
                style={{
                  flex:1, padding:'9px', fontSize:'11px', fontWeight:600, fontFamily:F,
                  background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)',
                  borderRadius:'7px', color:'#fca5a5', cursor:'pointer', transition:'all 0.15s',
                }}
                onMouseEnter={(e) => Object.assign(e.currentTarget.style, { background:'rgba(239,68,68,0.16)' })}
                onMouseLeave={(e) => Object.assign(e.currentTarget.style, { background:'rgba(239,68,68,0.08)' })}
              >
                ← Change Sections
              </button>
              <button
                type="button"
                onClick={startExport}
                style={{
                  flex:1, padding:'9px', fontSize:'11px', fontWeight:600, fontFamily:F,
                  background:'linear-gradient(135deg,#dc2626,#991b1b)', border:'none',
                  borderRadius:'7px', color:'#fff', cursor:'pointer', transition:'all 0.15s',
                }}
                onMouseEnter={(e) => Object.assign(e.currentTarget.style, { transform:'translateY(-1px)' })}
                onMouseLeave={(e) => Object.assign(e.currentTarget.style, { transform:'' })}
              >
                ↓ Re-generate
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

PDFExport.displayName = 'PDFExport';
export default PDFExport;
