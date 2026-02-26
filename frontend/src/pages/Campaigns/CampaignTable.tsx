/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  LumindAd · Campaigns · CampaignTable
 *  src/pages/Campaigns/CampaignTable.tsx
 *
 *  Purpose
 *   Renders the campaigns data table exactly as it appears in
 *   LumindAd.jsx CampaignsPage. Accepts a pre-filtered array so
 *   the parent (index.tsx) owns the search/filter state.
 *
 *  Columns (from LumindAd.jsx line 435)
 *   Campaign      name (600/e8e8f8) + id (11px/475569) stacked
 *   Platform      plain text, slate-400
 *   Status        badge: status-dot + coloured text (statusColor/statusBg)
 *   Budget        $1,234 format, slate-400
 *   Spent         $1,234 (white/600) + 80px progress bar beneath
 *   Impressions   compact (K/M), slate-400
 *   CTR           raw string (already formatted in data, e.g. "7.16%")
 *   ROAS          coloured threshold: ≥4 green #10b981 · ≥3 amber #f59e0b
 *                 · <3 red #ef4444 · 0 shows "—"
 *   Actions       Edit (purple) · ⏸ (red) — row-level buttons
 *
 *  Progress bar (Spent column)
 *   height 4px · bg #1e1e35 · fill gradient #7c3aed→#06b6d4
 *   width 80px · pct = Math.round(spent/budget*100), capped at 100
 *   Matches .progress-bar / .progress-fill in globals.css
 *
 *  Status badge tokens (statusColor / statusBg from LumindAd.jsx)
 *   active    color #10b981  bg rgba(16,185,129,.12)
 *   paused    color #f59e0b  bg rgba(245,158,11,.12)
 *   draft     color #94a3b8  bg rgba(148,163,184,.12)
 *   completed color #7c3aed  bg rgba(124,58,237,.12)
 *
 *  Row hover
 *   background rgba(124,58,237,.06) — matches .table-row:hover in globals.css
 *   transition: background 0.15s
 *
 *  Empty state
 *   Shown when `campaigns` is an empty array (all results filtered out).
 *   Centred layout with 📭 icon and "No campaigns match your search." message.
 *
 *  Callbacks
 *   onEdit(campaign)  — fires when "Edit" is clicked; parent opens CampaignForm
 *   onToggle(campaign)— fires when "⏸" is clicked; parent handles pause/resume
 *
 *  Accessibility (WCAG 2.1 AA)
 *   – Semantic <table> with <thead>, <th scope="col">, <tbody>
 *   – aria-label on the <table> names it for screen readers
 *   – Status badge text is present alongside the dot (not colour-only)
 *   – Progress bar has role="progressbar" + aria-valuenow
 *   – Edit/Pause buttons have aria-label per row for unambiguous identification
 *   – Empty state has role="status" so its appearance is announced
 *
 *  Author : Elizabeth Díaz Familia
 *           AI Data Scientist · Sustainable Intelligence & BI
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { type CSSProperties } from 'react';

// ─── Campaign data type ───────────────────────────────────────────────────────

export interface Campaign {
  id:          string;
  name:        string;
  platform:    string;
  status:      'active' | 'paused' | 'draft' | 'completed';
  budget:      number;
  spent:       number;
  impressions: number;
  clicks:      number;
  ctr:         string;   // pre-formatted: "7.16%" | "—"
  conv:        number;
  roas:        number;   // 0 means no data → "—"
}

// ─── Default data ─────────────────────────────────────────────────────────────
// Mirrors `campaigns` in LumindAd.jsx (line 103) exactly.

export const CAMPAIGNS_DEFAULT: Campaign[] = [
  { id:'C-001', name:'Summer Sale 2025',    platform:'Google Ads', status:'active',    budget:5000, spent:3240, impressions:124500, clicks:8920,  ctr:'7.16%', conv:342, roas:3.8 },
  { id:'C-002', name:'Brand Awareness Q1',  platform:'Meta Ads',   status:'active',    budget:8000, spent:5180, impressions:287000, clicks:12400, ctr:'4.32%', conv:520, roas:2.9 },
  { id:'C-003', name:'Product Launch Beta', platform:'TikTok',     status:'paused',   budget:3500, spent:1890, impressions:98200,  clicks:5430,  ctr:'5.53%', conv:187, roas:4.2 },
  { id:'C-004', name:'Retargeting Dec',     platform:'Google Ads', status:'active',    budget:2000, spent:1740, impressions:43100,  clicks:3280,  ctr:'7.61%', conv:245, roas:5.1 },
  { id:'C-005', name:'LinkedIn B2B Push',   platform:'LinkedIn',   status:'draft',    budget:6000, spent:0,    impressions:0,      clicks:0,     ctr:'—',     conv:0,   roas:0   },
  { id:'C-006', name:'Holiday Promos',      platform:'Meta Ads',   status:'completed', budget:4200, spent:4198, impressions:178000, clicks:9870,  ctr:'5.54%', conv:430, roas:3.5 },
];

// ─── Status helpers ───────────────────────────────────────────────────────────
// Mirrors statusColor / statusBg in LumindAd.jsx (line 145)

const STATUS_COLOR: Record<Campaign['status'], string> = {
  active:    '#10b981',
  paused:    '#f59e0b',
  draft:     '#94a3b8',
  completed: '#7c3aed',
};
const STATUS_BG: Record<Campaign['status'], string> = {
  active:    'rgba(16,185,129,0.12)',
  paused:    'rgba(245,158,11,0.12)',
  draft:     'rgba(148,163,184,0.12)',
  completed: 'rgba(124,58,237,0.12)',
};

// ─── Formatters ───────────────────────────────────────────────────────────────
// Mirrors fmt / fmtMoney in LumindAd.jsx (line 145)

const fmtMoney = (n: number) => `$${n.toLocaleString()}`;
const fmt = (n: number): string =>
  n >= 1e6 ? `${(n / 1e6).toFixed(1)}M`
  : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K`
  : String(n);

// ─── Shared cell style ────────────────────────────────────────────────────────

const TD: CSSProperties = { padding: '14px 18px', whiteSpace: 'nowrap' };

// ─── Public API ───────────────────────────────────────────────────────────────

export interface CampaignTableProps {
  /**
   * Pre-filtered array of campaigns to display.
   * The parent manages the search/filter state and passes results here.
   */
  campaigns: Campaign[];
  /**
   * Fired when the user clicks the "Edit" button on a row.
   * The parent should open CampaignForm pre-populated with this campaign.
   *
   * @param campaign - The campaign record for the clicked row.
   */
  onEdit: (campaign: Campaign) => void;
  /**
   * Fired when the user clicks the "⏸" (pause/resume) button on a row.
   *
   * @param campaign - The campaign record for the clicked row.
   */
  onToggle: (campaign: Campaign) => void;
  /**
   * Message shown when `campaigns` is empty.
   * @default "No campaigns match your search."
   */
  emptyMessage?: string;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Campaign['status'] }) {
  const color = STATUS_COLOR[status];
  const bg    = STATUS_BG[status];
  return (
    <span
      style={{
        display:       'inline-flex',
        alignItems:    'center',
        padding:       '4px 12px',
        borderRadius:  '20px',
        fontSize:      '11px',
        fontWeight:     700,
        letterSpacing: '0.5px',
        background:     bg,
        color,
        fontFamily:   "'Outfit', system-ui, sans-serif",
        gap:           '6px',
      }}
    >
      {/* status-dot — 7px circle, same colour as text */}
      <span
        aria-hidden="true"
        style={{
          width:        '7px',
          height:       '7px',
          borderRadius: '50%',
          background:    color,
          display:      'inline-block',
          flexShrink:    0,
        }}
      />
      {status.toUpperCase()}
    </span>
  );
}

function SpentCell({ spent, budget }: { spent: number; budget: number }) {
  const pct = budget > 0 ? Math.min(Math.round((spent / budget) * 100), 100) : 0;
  return (
    <div>
      <div
        style={{
          color:      '#e8e8f8',
          fontWeight:  600,
          fontFamily:"'Outfit', system-ui, sans-serif",
        }}
      >
        {fmtMoney(spent)}
      </div>
      {/* .progress-bar + .progress-fill — matches globals.css */}
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${pct}% of budget spent`}
        style={{
          width:        '80px',
          height:       '4px',
          borderRadius: '2px',
          background:   '#1e1e35',
          overflow:     'hidden',
          marginTop:    '4px',
        }}
      >
        <div
          style={{
            height:      '100%',
            borderRadius:'2px',
            width:       `${pct}%`,
            background:  'linear-gradient(90deg, #7c3aed, #06b6d4)',
            transition:  'width 0.3s ease',
          }}
        />
      </div>
    </div>
  );
}

function RoasCell({ roas }: { roas: number }) {
  if (!roas) return <span style={{ color: '#475569' }}>—</span>;
  const color = roas >= 4 ? '#10b981' : roas >= 3 ? '#f59e0b' : '#ef4444';
  return (
    <span
      style={{
        color,
        fontWeight:  700,
        fontFamily:"'Outfit', system-ui, sans-serif",
      }}
    >
      {roas}x
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Campaigns data table with status badges, progress bars, and row actions.
 *
 * @example
 * // Campaigns/index.tsx — with filtered data
 * <CampaignTable
 *   campaigns={filtered}
 *   onEdit={(c) => { setEditing(c); setShowForm(true); }}
 *   onToggle={(c) => handleTogglePause(c.id)}
 * />
 *
 * @example
 * // With custom empty message
 * <CampaignTable
 *   campaigns={[]}
 *   onEdit={handleEdit}
 *   onToggle={handleToggle}
 *   emptyMessage="No active campaigns. Create your first one!"
 * />
 */
export function CampaignTable({
  campaigns,
  onEdit,
  onToggle,
  emptyMessage = 'No campaigns match your search.',
}: CampaignTableProps) {
  return (
    <div
      style={{
        background:     'rgba(15, 10, 30, 0.85)',
        border:         '1px solid rgba(124, 58, 237, 0.15)',
        borderRadius:   '16px',
        backdropFilter: 'blur(12px)',
        overflow:       'hidden',
      }}
    >
      <div style={{ overflowX: 'auto' }}>
        <table
          aria-label="Campaigns table"
          style={{
            width:          '100%',
            borderCollapse: 'collapse',
            fontSize:       '13px',
            fontFamily:    "'Outfit', system-ui, sans-serif",
          }}
        >
          {/* ── Header ────────────────────────────────────────── */}
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(124, 58, 237, 0.15)' }}>
              {/* Column headers — exact order from JSX line 435 */}
              {(
                ['Campaign','Platform','Status','Budget','Spent','Impressions','CTR','ROAS',''] as const
              ).map((h) => (
                <th
                  key={h || '__actions'}
                  scope="col"
                  style={{
                    padding:       '14px 18px',
                    textAlign:     'left',
                    fontSize:      '11px',
                    fontWeight:     700,
                    color:         '#475569',
                    letterSpacing: '0.8px',
                    textTransform: 'uppercase',
                    whiteSpace:   'nowrap',
                  }}
                >
                  {h || <span className="sr-only">Actions</span>}
                </th>
              ))}
            </tr>
          </thead>

          {/* ── Body ──────────────────────────────────────────── */}
          <tbody>
            {campaigns.length === 0 ? (
              <tr>
                <td colSpan={9}>
                  <div
                    role="status"
                    style={{
                      display:        'flex',
                      flexDirection:  'column',
                      alignItems:     'center',
                      gap:            '12px',
                      padding:        '48px 24px',
                    }}
                  >
                    <span style={{ fontSize: '32px' }}>📭</span>
                    <span style={{ color: '#475569', fontSize: '13px' }}>
                      {emptyMessage}
                    </span>
                  </div>
                </td>
              </tr>
            ) : (
              campaigns.map((c) => (
                <tr
                  key={c.id}
                  style={{
                    borderBottom: '1px solid rgba(124, 58, 237, 0.08)',
                    transition:   'background 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(124, 58, 237, 0.06)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  {/* Campaign — name + id stacked */}
                  <td style={TD}>
                    <div
                      style={{
                        fontWeight: 600,
                        color:      '#e8e8f8',
                        fontFamily:"'Outfit', system-ui, sans-serif",
                      }}
                    >
                      {c.name}
                    </div>
                    <div
                      style={{
                        fontSize:  '11px',
                        color:     '#475569',
                        marginTop: '2px',
                        fontFamily:"'Outfit', system-ui, sans-serif",
                      }}
                    >
                      {c.id}
                    </div>
                  </td>

                  {/* Platform */}
                  <td style={{ ...TD, color: '#94a3b8' }}>{c.platform}</td>

                  {/* Status badge */}
                  <td style={TD}>
                    <StatusBadge status={c.status} />
                  </td>

                  {/* Budget */}
                  <td style={{ ...TD, color: '#94a3b8' }}>{fmtMoney(c.budget)}</td>

                  {/* Spent + progress bar */}
                  <td style={TD}>
                    <SpentCell spent={c.spent} budget={c.budget} />
                  </td>

                  {/* Impressions */}
                  <td style={{ ...TD, color: '#94a3b8' }}>{fmt(c.impressions)}</td>

                  {/* CTR */}
                  <td style={{ ...TD, color: '#94a3b8' }}>{c.ctr}</td>

                  {/* ROAS — coloured by threshold */}
                  <td style={TD}>
                    <RoasCell roas={c.roas} />
                  </td>

                  {/* Actions: Edit + ⏸ */}
                  <td style={TD}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => onEdit(c)}
                        aria-label={`Edit campaign ${c.name}`}
                        style={{
                          background:   'rgba(124, 58, 237, 0.12)',
                          border:       'none',
                          color:        '#a78bfa',
                          padding:      '5px 10px',
                          borderRadius: '7px',
                          cursor:       'pointer',
                          fontSize:     '11px',
                          fontWeight:    600,
                          fontFamily:  "'Outfit', system-ui, sans-serif",
                          transition:  'background 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(124,58,237,0.22)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(124,58,237,0.12)';
                        }}
                      >
                        Edit
                      </button>

                      <button
                        onClick={() => onToggle(c)}
                        aria-label={
                          c.status === 'active'
                            ? `Pause campaign ${c.name}`
                            : `Resume campaign ${c.name}`
                        }
                        style={{
                          background:   'rgba(239, 68, 68, 0.08)',
                          border:       'none',
                          color:        '#ef4444',
                          padding:      '5px 10px',
                          borderRadius: '7px',
                          cursor:       'pointer',
                          fontSize:     '11px',
                          fontWeight:    600,
                          fontFamily:  "'Outfit', system-ui, sans-serif",
                          transition:  'background 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(239,68,68,0.16)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(239,68,68,0.08)';
                        }}
                      >
                        ⏸
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

CampaignTable.displayName = 'CampaignTable';

export default CampaignTable;
