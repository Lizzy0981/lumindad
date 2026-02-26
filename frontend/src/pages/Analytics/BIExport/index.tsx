/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  LumindAd · Analytics · BIExport · index
 *  src/pages/Analytics/BIExport/index.tsx
 *
 *  Purpose
 *   Entry point for the BI Export module. Renders a 2×2 tool-card
 *   grid; clicking a card mounts the corresponding exporter panel
 *   below, replacing the grid until the user returns.
 *
 *  Layout (selector state)
 *   ┌──────────────────────────────────────────────────────────┐
 *   │  BI Export Hub                                           │
 *   │  Export to your preferred BI or reporting platform       │
 *   ├──────────────┬───────────────┬──────────────┬───────────┤
 *   │  📊 Power BI │ 📈 Tableau    │ 📗 Excel     │ 📄 PDF    │
 *   │  CSV+Schema  │ CSV+TDS       │ 6-sheet .xlsx│ Exec PDF  │
 *   │  +DAX        │               │               │ reportlab │
 *   └──────────────┴───────────────┴──────────────┴───────────┘
 *
 *  Layout (active-exporter state)
 *   ┌──────────────────────────────────────────────────────────┐
 *   │  ← BI Export Hub  /  Power BI                           │
 *   ├──────────────────────────────────────────────────────────┤
 *   │  <PowerBIExport />  (or Tableau / Excel / PDF)          │
 *   └──────────────────────────────────────────────────────────┘
 *
 *  Tool cards
 *   Each card: 130px min-height · hover → border brightens + translateY(-2px)
 *   Selected card: border 2px solid tool-colour · bg tool-colour@15%
 *   Tool colours:
 *     Power BI  #F3BB16  (yellow — Microsoft brand)
 *     Tableau   #10B981  (green — Salesforce brand)
 *     Excel     #22C55E  (green — Microsoft brand)
 *     PDF       #EF4444  (red — document standard)
 *
 *  Exporter panel
 *   Mounted directly below the breadcrumb when a tool is selected.
 *   The tool grid is hidden while a panel is active.
 *   Uses React.lazy + Suspense so each exporter is code-split and
 *   only loads when the user actually clicks the card.
 *
 *  Props
 *   onClose  — fired when the user clicks "Close" at the top.
 *              The parent (ExportReport.tsx) hides the BIExport panel.
 *
 *  Accessibility (WCAG 2.1 AA)
 *   – Tool cards are <button type="button"> — not <div> clickable areas
 *   – aria-pressed on each card reflects selected state
 *   – aria-label names each tool and its output format
 *   – Breadcrumb "back" uses aria-label="Back to tool selection"
 *   – Exporter panel region has aria-label matching the active tool
 *   – Loading state uses role="status" while Suspense resolves
 *
 *  Author : Elizabeth Díaz Familia
 *           AI Data Scientist · Sustainable Intelligence & BI
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import {
  useState,
  Suspense,
  lazy,
  type ReactNode,
} from 'react';

// ─── Lazy-loaded exporter panels ──────────────────────────────────────────────
// Each chunk only loads when the user clicks the corresponding card.

const PowerBIExport = lazy(() =>
  import('./PowerBIExport').then((m) => ({ default: m.PowerBIExport }))
);
const TableauExport = lazy(() =>
  import('./TableauExport').then((m) => ({ default: m.TableauExport }))
);
const ExcelExport = lazy(() =>
  import('./ExcelExport').then((m) => ({ default: m.ExcelExport }))
);
const PDFExport = lazy(() =>
  import('./PDFExport').then((m) => ({ default: m.PDFExport }))
);

// ─── Tool definitions ─────────────────────────────────────────────────────────

type ToolId = 'powerbi' | 'tableau' | 'excel' | 'pdf';

interface Tool {
  id:      ToolId;
  icon:    string;
  label:   string;
  brand:   string;   // company / product name
  color:   string;   // brand accent hex
  outputs: string;   // short description of artifacts
  panel:   ReactNode;
}

const TOOLS: Tool[] = [
  {
    id:      'powerbi',
    icon:    '📊',
    label:   'Power BI',
    brand:   'Microsoft',
    color:   '#F3BB16',
    outputs: 'CSV · JSON Schema · DAX Measures',
    panel:   <PowerBIExport />,
  },
  {
    id:      'tableau',
    icon:    '📈',
    label:   'Tableau',
    brand:   'Salesforce',
    color:   '#10B981',
    outputs: 'Enriched CSV · TDS Data Source',
    panel:   <TableauExport />,
  },
  {
    id:      'excel',
    icon:    '📗',
    label:   'Excel',
    brand:   'Microsoft',
    color:   '#22C55E',
    outputs: '6-sheet .xlsx · Formulas · Totals',
    panel:   <ExcelExport />,
  },
  {
    id:      'pdf',
    icon:    '📄',
    label:   'PDF Report',
    brand:   'reportlab',
    color:   '#EF4444',
    outputs: 'A4 · 4 sections · Executive format',
    panel:   <PDFExport />,
  },
];

// ─── Shared style tokens ──────────────────────────────────────────────────────

const F = "'Outfit', system-ui, sans-serif";

const OUTER: React.CSSProperties = {
  background:     'rgba(15, 10, 30, 0.92)',
  border:         '1px solid rgba(124, 58, 237, 0.2)',
  borderRadius:   '16px',
  backdropFilter: 'blur(16px)',
  overflow:       'hidden',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Loading skeleton shown while a lazy exporter chunk resolves. */
function ExporterSkeleton({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-label={`Loading ${label} exporter…`}
      style={{
        padding:        '40px 24px',
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        gap:            '12px',
        color:          '#475569',
        fontFamily:      F,
        fontSize:       '13px',
      }}
    >
      <div style={{
        width:        '36px',
        height:       '36px',
        border:       '3px solid rgba(124,58,237,0.15)',
        borderTopColor:'#7c3aed',
        borderRadius: '50%',
        animation:    'spin 0.8s linear infinite',
      }} />
      <span>Loading {label}…</span>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

/** Single tool selection card. */
function ToolCard({
  tool,
  onClick,
}: {
  tool:    Tool;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Export to ${tool.label} — ${tool.outputs}`}
      aria-pressed={false}
      style={{
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'flex-start',
        gap:            '8px',
        padding:        '18px',
        background:     `${tool.color}09`,
        border:         `1px solid ${tool.color}28`,
        borderRadius:   '12px',
        cursor:         'pointer',
        textAlign:      'left',
        transition:     'all 0.2s ease',
        minHeight:      '130px',
        fontFamily:      F,
      }}
      onMouseEnter={(e) => {
        Object.assign(e.currentTarget.style, {
          background:   `${tool.color}16`,
          borderColor:  `${tool.color}55`,
          transform:    'translateY(-2px)',
          boxShadow:    `0 8px 24px ${tool.color}22`,
        });
      }}
      onMouseLeave={(e) => {
        Object.assign(e.currentTarget.style, {
          background:   `${tool.color}09`,
          borderColor:  `${tool.color}28`,
          transform:    '',
          boxShadow:    '',
        });
      }}
    >
      {/* Icon + brand label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
        <span style={{
          fontSize:     '22px',
          lineHeight:    1,
          flexShrink:    0,
        }}>
          {tool.icon}
        </span>
        <div>
          <div style={{
            fontSize:   '13px',
            fontWeight:  700,
            color:       '#e8e8f8',
            lineHeight:  1.2,
          }}>
            {tool.label}
          </div>
          <div style={{
            fontSize:   '10px',
            color:      '#475569',
            marginTop:  '2px',
          }}>
            {tool.brand}
          </div>
        </div>
        {/* Arrow indicator */}
        <span style={{
          marginLeft:   'auto',
          fontSize:     '16px',
          color:        `${tool.color}88`,
          flexShrink:    0,
        }}>
          →
        </span>
      </div>

      {/* Output description */}
      <div style={{
        fontSize:    '11px',
        color:       '#64748b',
        lineHeight:   1.5,
        paddingTop:  '4px',
        borderTop:   `1px solid ${tool.color}20`,
        width:       '100%',
      }}>
        {tool.outputs}
      </div>

      {/* Generate badge */}
      <div style={{
        marginTop:    'auto',
        padding:      '3px 8px',
        background:   `${tool.color}18`,
        borderRadius: '20px',
        fontSize:     '10px',
        fontWeight:    600,
        color:        tool.color,
        letterSpacing:'0.3px',
      }}>
        Generate ↓
      </div>
    </button>
  );
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface BIExportPanelProps {
  /**
   * Fired when the user clicks "Close" in the panel header.
   * The parent should hide the BIExport panel.
   */
  onClose?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * BI Export Hub — tool selector + active exporter panel.
 *
 * @example
 * // ExportReport.tsx — toggled by "↓ Export Report" button
 * {showBIExport && (
 *   <BIExportPanel onClose={() => setShowBIExport(false)} />
 * )}
 *
 * @example
 * // Analytics/index.tsx — inline below the page header
 * <BIExportPanel />
 */
export function BIExportPanel({ onClose }: BIExportPanelProps) {
  const [activeTool, setActiveTool] = useState<Tool | null>(null);

  const handleSelectTool = (tool: Tool) => setActiveTool(tool);
  const handleBack       = () => setActiveTool(null);

  return (
    <div style={OUTER}>
      {/* ── Panel header ─────────────────────────────────── */}
      <div style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        padding:        '16px 20px',
        borderBottom:   '1px solid rgba(124,58,237,0.12)',
        background:     'rgba(124,58,237,0.04)',
      }}>
        {/* Breadcrumb */}
        <div style={{
          display:    'flex',
          alignItems: 'center',
          gap:        '6px',
          fontSize:   '13px',
          fontFamily:  F,
        }}>
          {activeTool ? (
            <>
              <button
                type="button"
                onClick={handleBack}
                aria-label="Back to tool selection"
                style={{
                  background: 'none',
                  border:     'none',
                  color:      '#a78bfa',
                  fontWeight:  600,
                  cursor:     'pointer',
                  padding:     0,
                  fontFamily:  F,
                  fontSize:   '13px',
                  transition: 'color 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#c4b5fd'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#a78bfa'; }}
              >
                BI Export Hub
              </button>
              <span style={{ color: '#2d2050' }}>/</span>
              <span style={{
                color:      '#e8e8f8',
                fontWeight:  700,
              }}>
                {activeTool.icon} {activeTool.label}
              </span>
            </>
          ) : (
            <span style={{ fontWeight: 700, color: '#e8e8f8' }}>
              📤 BI Export Hub
            </span>
          )}
        </div>

        {/* Close button */}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close BI Export panel"
            style={{
              background:   'none',
              border:       '1px solid rgba(124,58,237,0.2)',
              borderRadius: '7px',
              color:        '#475569',
              fontSize:     '12px',
              fontWeight:    600,
              cursor:       'pointer',
              padding:      '4px 10px',
              fontFamily:    F,
              transition:   'all 0.15s',
            }}
            onMouseEnter={(e) => {
              Object.assign(e.currentTarget.style, {
                background:  'rgba(124,58,237,0.08)',
                borderColor: 'rgba(124,58,237,0.3)',
                color:       '#a78bfa',
              });
            }}
            onMouseLeave={(e) => {
              Object.assign(e.currentTarget.style, {
                background:  'none',
                borderColor: 'rgba(124,58,237,0.2)',
                color:       '#475569',
              });
            }}
          >
            ✕ Close
          </button>
        )}
      </div>

      {/* ── Body ─────────────────────────────────────────── */}
      <div style={{ padding: '20px' }}>

        {/* ── Tool selector grid ───────────────────────── */}
        {!activeTool && (
          <>
            <p style={{
              fontSize:     '12px',
              color:        '#64748b',
              fontFamily:    F,
              marginBottom: '16px',
              lineHeight:    1.5,
            }}>
              Select a BI platform to generate export-ready artifacts.
              Each tool produces files optimised for that platform's native import flow.
            </p>

            <div style={{
              display:             'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap:                 '12px',
            }}>
              {TOOLS.map((tool) => (
                <ToolCard
                  key={tool.id}
                  tool={tool}
                  onClick={() => handleSelectTool(tool)}
                />
              ))}
            </div>

            {/* Capability footnote */}
            <div style={{
              marginTop:    '16px',
              padding:      '12px 14px',
              background:   'rgba(124,58,237,0.05)',
              border:       '1px solid rgba(124,58,237,0.12)',
              borderRadius: '10px',
              fontSize:     '11px',
              color:        '#475569',
              fontFamily:    F,
              lineHeight:    1.6,
            }}>
              <strong style={{ color: '#a78bfa' }}>💡 How it works: </strong>
              Power BI & Tableau generate files in the browser instantly.
              Excel uses SheetJS (client-side). PDF uses a reportlab backend with a browser print fallback.
              No data leaves the browser for CSV/JSON/DAX/TDS exports.
            </div>
          </>
        )}

        {/* ── Active exporter panel ─────────────────────── */}
        {activeTool && (
          <section
            aria-label={`${activeTool.label} export panel`}
          >
            <Suspense fallback={<ExporterSkeleton label={activeTool.label} />}>
              {activeTool.panel}
            </Suspense>
          </section>
        )}
      </div>
    </div>
  );
}

BIExportPanel.displayName = 'BIExportPanel';
export default BIExportPanel;
