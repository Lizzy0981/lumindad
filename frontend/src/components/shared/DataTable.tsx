/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  LumindAd · Shared · DataTable
 *  src/components/shared/DataTable.tsx
 *
 *  Purpose
 *   Generic, fully typed data table component. Accepts column
 *   definitions and a data array; renders the branded LumindAd table
 *   style with hover rows, status badges, inline progress bars, and
 *   an optional row actions column.
 *
 *  Used in
 *   CampaignsPage — campaigns table (8 columns + actions)
 *     Columns: Campaign · Platform · Status · Budget · Spent · Impressions · CTR · ROAS
 *   BudgetPage    — platform budget breakdown table
 *   UploadPage    — uploaded files list
 *
 *  Column definition API
 *   Each column is typed with a `ColumnDef<T>` where T is the row type.
 *   The `render` function receives the full row record and returns ReactNode,
 *   giving each column complete flexibility (text, badge, progress, actions).
 *   The `type` shorthand covers the most common patterns without requiring
 *   a custom render function.
 *
 *  Cell type shorthands
 *   "text"         Plain string value (default)
 *   "currency"     Formats as $1,234
 *   "number"       Formats with toLocaleString()
 *   "badge"        Renders a status badge with coloured dot
 *   "progress"     Renders a progress bar (0–100, reads `percentKey`)
 *   "roas"         Renders ROAS value with colour threshold (≥4 green, ≥3 amber, else red)
 *   "actions"      Row-level Edit / Pause buttons
 *
 *  Table visual tokens (from LumindAd.jsx CampaignsPage)
 *   table-row hover  rgba(124,58,237,0.06)
 *   row border       1px solid rgba(124,58,237,0.08)
 *   th color         #475569 · fontSize 11px · letterSpacing 0.8px · uppercase
 *   thead border     1px solid rgba(124,58,237,0.15)
 *   td padding       14px 18px
 *   badge            .badge style: padding 4px 12px · radius 20px · font 11px/700
 *   status-dot       7px circle, same color as badge text
 *   progress-bar     height 4px · bg #1e1e35 · width 80px
 *   progress-fill    gradient #7c3aed → #06b6d4
 *
 *  Empty state
 *   When `data` is empty, renders a centred empty state with icon and
 *   `emptyMessage`. Uses the same card background as the table wrapper.
 *
 *  Accessibility (WCAG 2.1 AA)
 *   – Semantic <table>, <thead>, <tbody>, <th scope="col">, <td>
 *   – aria-label on the table wrapper names the table for screen readers
 *   – Sortable columns will have aria-sort (future: add sortable support)
 *   – Status badge text is always present (not colour-only communication)
 *   – Progress bar has role="progressbar" + aria-valuenow
 *   – Action buttons have aria-label per row
 *   – Empty state has role="status"
 *
 *  Author : Elizabeth Díaz Familia
 *           AI Data Scientist · Sustainable Intelligence & BI
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { type ReactNode, type CSSProperties } from 'react';

// ─── Status helpers ───────────────────────────────────────────────────────────
// Mirrors statusColor / statusBg in LumindAd.jsx (line 145)

const STATUS_COLOR: Record<string, string> = {
  active:    '#10b981',
  paused:    '#f59e0b',
  draft:     '#94a3b8',
  completed: '#7c3aed',
};

const STATUS_BG: Record<string, string> = {
  active:    'rgba(16,185,129,0.12)',
  paused:    'rgba(245,158,11,0.12)',
  draft:     'rgba(148,163,184,0.12)',
  completed: 'rgba(124,58,237,0.12)',
};

function resolveStatusColor(status: string): string {
  return STATUS_COLOR[status.toLowerCase()] ?? '#94a3b8';
}
function resolveStatusBg(status: string): string {
  return STATUS_BG[status.toLowerCase()]    ?? 'rgba(148,163,184,0.12)';
}

// ─── Public API ───────────────────────────────────────────────────────────────

export type CellType = 'text' | 'currency' | 'number' | 'badge' | 'progress' | 'roas' | 'custom';

/** Definition for a single table column. */
export interface ColumnDef<T extends Record<string, unknown>> {
  /** Column heading text. */
  header: string;
  /**
   * Key in the row record to read the cell value from.
   * Required for built-in cell types. Optional when `render` is provided.
   */
  key?: keyof T & string;
  /**
   * Built-in cell renderer type.
   * @default "text"
   */
  type?: CellType;
  /**
   * Custom render function. Overrides `type` when provided.
   * Receives the full row object and its index.
   *
   * @example
   * {
   *   header: 'Actions',
   *   type: 'custom',
   *   render: (row) => (
   *     <button onClick={() => handleEdit(row.id)}>Edit</button>
   *   ),
   * }
   */
  render?: (row: T, index: number) => ReactNode;
  /**
   * For `type: "progress"` — key that holds the total/max value used to
   * compute the percentage. The cell value is the "spent" amount.
   * Percentage = (row[key] / row[percentKey]) * 100.
   * @example "budget"
   */
  percentKey?: keyof T & string;
  /**
   * Minimum column width in pixels. Passed as minWidth style.
   */
  minWidth?: number;
  /**
   * Text alignment for this column's cells.
   * @default "left"
   */
  align?: 'left' | 'center' | 'right';
}

/** Optional row action configuration. */
export interface RowAction<T extends Record<string, unknown>> {
  /** Button label text. */
  label: string;
  /** Called when the action button is clicked. Receives the row object. */
  onClick: (row: T) => void;
  /**
   * Visual style of the action button.
   * @default "default"
   */
  variant?: 'default' | 'danger';
  /**
   * Returns true when the action should be disabled for a given row.
   * @default () => false
   */
  disabled?: (row: T) => boolean;
}

export interface DataTableProps<T extends Record<string, unknown>> {
  /**
   * Array of data objects to display. Each object is one row.
   * @example campaigns | budgetBreakdown | uploadedFiles
   */
  data: T[];
  /** Column definitions — defines what to display and how. */
  columns: ColumnDef<T>[];
  /**
   * Row-level action buttons rendered in the rightmost column.
   * When provided, a final "actions" column is appended automatically.
   */
  actions?: RowAction<T>[];
  /**
   * Accessible label for the table element.
   * @example "Campaigns table" | "Budget breakdown"
   */
  ariaLabel?: string;
  /**
   * Message shown when `data` is empty.
   * @default "No data to display"
   */
  emptyMessage?: string;
  /**
   * Emoji shown above the empty state message.
   * @default "📭"
   */
  emptyIcon?: string;
  /**
   * When true, renders a loading skeleton instead of rows.
   * @default false
   */
  loading?: boolean;
  /**
   * Number of skeleton rows shown when `loading` is true.
   * @default 5
   */
  loadingRows?: number;
}

// ─── Cell renderers ───────────────────────────────────────────────────────────

function CurrencyCell({ value }: { value: unknown }) {
  const n = Number(value);
  return (
    <span style={{ color: '#94a3b8' }}>
      {isNaN(n) ? '—' : `$${n.toLocaleString()}`}
    </span>
  );
}

function NumberCell({ value }: { value: unknown }) {
  const n = Number(value);
  if (isNaN(n)) return <span style={{ color: '#94a3b8' }}>—</span>;
  return (
    <span style={{ color: '#94a3b8' }}>
      {n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : n.toLocaleString()}
    </span>
  );
}

function BadgeCell({ value }: { value: unknown }) {
  const status = String(value);
  const color  = resolveStatusColor(status);
  const bg     = resolveStatusBg(status);

  return (
    <span
      style={{
        padding:      '4px 12px',
        borderRadius: '20px',
        fontSize:     '11px',
        fontWeight:    700,
        letterSpacing: '0.5px',
        background:    bg,
        color,
        display:      'inline-flex',
        alignItems:   'center',
        gap:          '6px',
        fontFamily:  "'Outfit', system-ui, sans-serif",
      }}
    >
      {/* Status dot */}
      <span
        style={{
          width:        '7px',
          height:       '7px',
          borderRadius: '50%',
          background:    color,
          display:      'inline-block',
          flexShrink:    0,
        }}
        aria-hidden="true"
      />
      {status.toUpperCase()}
    </span>
  );
}

function ProgressCell({
  value,
  max,
}: {
  value: unknown;
  max:   unknown;
}) {
  const spent  = Number(value);
  const budget = Number(max);
  const pct    = budget > 0 ? Math.min(Math.round((spent / budget) * 100), 100) : 0;

  return (
    <div>
      <div style={{ color: '#e8e8f8', fontWeight: 600, fontFamily: "'Outfit',system-ui,sans-serif" }}>
        ${isNaN(spent) ? '—' : spent.toLocaleString()}
      </div>
      {/* Progress bar — matches .progress-bar / .progress-fill in globals.css */}
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
          position:     'relative',
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

function RoasCell({ value }: { value: unknown }) {
  const roas = Number(value);
  if (!roas) return <span style={{ color: '#475569' }}>—</span>;

  const color = roas >= 4 ? '#10b981' : roas >= 3 ? '#f59e0b' : '#ef4444';
  return (
    <span style={{ color, fontWeight: 700, fontFamily: "'Outfit',system-ui,sans-serif" }}>
      {roas}x
    </span>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

const SKELETON_KF = `
  @keyframes lad-shimmer {
    0%   { background-position: -200% 0; }
    100% { background-position:  200% 0; }
  }
`;

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <>
      <style>{SKELETON_KF}</style>
      <tr>
        {Array.from({ length: cols }).map((_, i) => (
          <td key={i} style={{ padding: '14px 18px' }}>
            <div
              aria-hidden="true"
              style={{
                height:           '14px',
                borderRadius:     '6px',
                width:            i === 0 ? '140px' : '60px',
                background:       'linear-gradient(90deg, rgba(124,58,237,.06) 25%, rgba(124,58,237,.12) 50%, rgba(124,58,237,.06) 75%)',
                backgroundSize:   '200% 100%',
                animation:        'lad-shimmer 1.5s ease-in-out infinite',
              }}
            />
          </td>
        ))}
      </tr>
    </>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Generic branded data table for LumindAd pages.
 *
 * @example
 * // CampaignsPage — campaigns table (mirrors LumindAd.jsx exactly)
 * <DataTable
 *   data={filtered}
 *   ariaLabel="Campaigns table"
 *   columns={[
 *     { header: 'Campaign',    key: 'name',        type: 'text'     },
 *     { header: 'Platform',   key: 'platform',    type: 'text'     },
 *     { header: 'Status',     key: 'status',      type: 'badge'    },
 *     { header: 'Budget',     key: 'budget',      type: 'currency' },
 *     { header: 'Spent',      key: 'spent',       type: 'progress', percentKey: 'budget' },
 *     { header: 'Impressions',key: 'impressions', type: 'number'   },
 *     { header: 'CTR',        key: 'ctr',         type: 'text'     },
 *     { header: 'ROAS',       key: 'roas',        type: 'roas'     },
 *   ]}
 *   actions={[
 *     { label: 'Edit',  variant: 'default', onClick: (row) => handleEdit(row.id)  },
 *     { label: '⏸',    variant: 'danger',  onClick: (row) => handlePause(row.id) },
 *   ]}
 * />
 *
 * @example
 * // Simple text-only table with loading state
 * <DataTable
 *   data={rows}
 *   loading={isLoading}
 *   columns={[
 *     { header: 'Name',   key: 'name'   },
 *     { header: 'Value',  key: 'value', type: 'currency' },
 *   ]}
 * />
 */
export function DataTable<T extends Record<string, unknown>>({
  data,
  columns,
  actions,
  ariaLabel    = 'Data table',
  emptyMessage = 'No data to display',
  emptyIcon    = '📭',
  loading      = false,
  loadingRows  = 5,
}: DataTableProps<T>) {
  const totalCols = columns.length + (actions ? 1 : 0);

  // ── Cell resolver ────────────────────────────────────────────────
  const renderCell = (col: ColumnDef<T>, row: T, rowIndex: number): ReactNode => {
    if (col.render) return col.render(row, rowIndex);

    const value = col.key ? row[col.key] : undefined;
    const type  = col.type ?? 'text';

    switch (type) {
      case 'currency': return <CurrencyCell value={value} />;
      case 'number':   return <NumberCell   value={value} />;
      case 'badge':    return <BadgeCell    value={value} />;
      case 'roas':     return <RoasCell     value={value} />;
      case 'progress':
        return (
          <ProgressCell
            value={value}
            max={col.percentKey ? row[col.percentKey] : undefined}
          />
        );
      case 'text':
      default:
        return (
          <span style={{ color: '#94a3b8', fontFamily: "'Outfit',system-ui,sans-serif" }}>
            {value != null ? String(value) : '—'}
          </span>
        );
    }
  };

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
          aria-label={ariaLabel}
          style={{
            width:           '100%',
            borderCollapse:  'collapse',
            fontSize:        '13px',
            fontFamily:     "'Outfit', system-ui, sans-serif",
          }}
        >
          {/* ── Header ──────────────────────────────────────── */}
          <thead>
            <tr
              style={{ borderBottom: '1px solid rgba(124, 58, 237, 0.15)' }}
            >
              {columns.map((col) => (
                <th
                  key={col.header}
                  scope="col"
                  style={{
                    padding:       '14px 18px',
                    textAlign:      (col.align ?? 'left') as CSSProperties['textAlign'],
                    fontSize:      '11px',
                    fontWeight:     700,
                    color:         '#475569',
                    letterSpacing: '0.8px',
                    textTransform: 'uppercase',
                    whiteSpace:   'nowrap',
                    minWidth:      col.minWidth,
                  }}
                >
                  {col.header}
                </th>
              ))}
              {/* Actions column header */}
              {actions && (
                <th scope="col" style={{ padding: '14px 18px' }}>
                  <span className="sr-only">Actions</span>
                </th>
              )}
            </tr>
          </thead>

          {/* ── Body ────────────────────────────────────────── */}
          <tbody>
            {loading
              ? Array.from({ length: loadingRows }).map((_, i) => (
                  <SkeletonRow key={i} cols={totalCols} />
                ))
              : data.length === 0
              ? (
                  <tr>
                    <td colSpan={totalCols}>
                      <div
                        role="status"
                        style={{
                          display:        'flex',
                          flexDirection:  'column',
                          alignItems:     'center',
                          padding:        '48px 24px',
                          gap:            '12px',
                        }}
                      >
                        <span style={{ fontSize: '32px' }}>{emptyIcon}</span>
                        <span
                          style={{
                            color:      '#475569',
                            fontSize:   '13px',
                            fontFamily:"'Outfit',system-ui,sans-serif",
                          }}
                        >
                          {emptyMessage}
                        </span>
                      </div>
                    </td>
                  </tr>
                )
              : data.map((row, rowIndex) => (
                  <tr
                    key={rowIndex}
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
                    {columns.map((col) => (
                      <td
                        key={col.header}
                        style={{
                          padding:  '14px 18px',
                          textAlign:(col.align ?? 'left') as CSSProperties['textAlign'],
                          whiteSpace:'nowrap',
                        }}
                      >
                        {renderCell(col, row, rowIndex)}
                      </td>
                    ))}

                    {/* ── Row actions ──────────────────────── */}
                    {actions && (
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          {actions.map((action) => {
                            const isDanger   = action.variant === 'danger';
                            const isDisabled = action.disabled?.(row) ?? false;
                            return (
                              <button
                                key={action.label}
                                onClick={() => !isDisabled && action.onClick(row)}
                                disabled={isDisabled}
                                aria-label={`${action.label} row ${rowIndex + 1}`}
                                style={{
                                  background:   isDanger
                                    ? 'rgba(239, 68, 68, 0.08)'
                                    : 'rgba(124, 58, 237, 0.12)',
                                  border:       'none',
                                  color:        isDanger ? '#ef4444' : '#a78bfa',
                                  padding:      '5px 10px',
                                  borderRadius: '7px',
                                  cursor:        isDisabled ? 'not-allowed' : 'pointer',
                                  fontSize:     '11px',
                                  fontFamily:  "'Outfit',system-ui,sans-serif",
                                  fontWeight:    600,
                                  opacity:       isDisabled ? 0.4 : 1,
                                  transition:   'background 0.15s ease',
                                }}
                                onMouseEnter={(e) => {
                                  if (!isDisabled) {
                                    e.currentTarget.style.background = isDanger
                                      ? 'rgba(239,68,68,0.18)'
                                      : 'rgba(124,58,237,0.22)';
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = isDanger
                                    ? 'rgba(239,68,68,0.08)'
                                    : 'rgba(124,58,237,0.12)';
                                }}
                              >
                                {action.label}
                              </button>
                            );
                          })}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
            }
          </tbody>
        </table>
      </div>
    </div>
  );
}

DataTable.displayName = 'DataTable';

export default DataTable;
