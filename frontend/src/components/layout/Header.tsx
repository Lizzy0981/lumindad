/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  LumindAd · Layout · Header
 *  src/components/layout/Header.tsx
 *
 *  Purpose
 *   Page-level heading block rendered at the top of each page's
 *   content area, inside <PageWrapper>. It is NOT the sticky
 *   TopBar — that lives in AppLayout. This is the per-page header
 *   with the large gradient title, descriptor subtitle, and an
 *   optional actions slot for buttons or status chips.
 *
 *  Anatomy
 *   ┌─────────────────────────────────────────────────┐
 *   │  Performance Dashboard          [⟳ Refresh]     │
 *   │  Monitor your advertising performance in real   │  [✦ Create]
 *   │  time — AI-powered insights                     │
 *   └─────────────────────────────────────────────────┘
 *   ◀── left column ──▶                ◀── actions ──▶
 *
 *  Usage per page (from LumindAd.jsx)
 *   DashboardPage : title="Performance Dashboard"
 *                   subtitle="Monitor your advertising performance in real-time — AI-powered insights"
 *                   actions=[<button>⟳ Refresh</button>, <button>✦ Create New Ad</button>]
 *
 *   CampaignsPage : title="Campaigns"
 *                   subtitle="Manage and track all your advertising campaigns"
 *                   actions=[<input placeholder="Search…"/>, <button>+ New Campaign</button>]
 *
 *   BudgetPage    : title="Budget Management"
 *                   subtitle="Track and optimize your advertising spend with AI recommendations"
 *                   actions=[<span>Total Budget: $28,500</span>, <button>+ Set Budget</button>]
 *
 *   AnalyticsPage : title="Analytics & Reports"
 *                   subtitle="Deep insights — SHAP · Anomaly Detection"
 *                   actions=[<select/>, <button>↓ Export</button>]
 *
 *   UploadPage    : title="Upload Data"
 *                   subtitle="Process up to 10M rows · Chunked parallel processing"
 *
 *  Title style
 *   fontSize      30px · fontWeight 900 · letterSpacing -0.5px
 *   gradient      linear-gradient(135deg, #f0f0ff, #a78bfa)
 *   Matches the h1 style in LumindAd.jsx Header function exactly.
 *
 *  Accessibility (WCAG 2.1 AA)
 *   – title renders as <h1> — one per page, consistent heading hierarchy
 *   – actions slot is wrapped in a <div role="toolbar"> when it
 *     contains interactive elements, labelled by aria-label
 *   – subtitle uses <p> with no ARIA override — it is a description
 *   – The component does not manage focus — PageWrapper handles that
 *
 *  Author : Elizabeth Díaz Familia
 *           AI Data Scientist · Sustainable Intelligence & BI
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { type ReactNode, type CSSProperties } from 'react';

// ─── Public API ───────────────────────────────────────────────────────────────

export interface HeaderProps {
  /**
   * Primary page title. Rendered as <h1> with the LumindAd gradient.
   * Should be short enough to stay on one line at typical viewport widths.
   *
   * @example "Performance Dashboard"
   * @example "Analytics & Reports"
   */
  title: string;
  /**
   * Descriptive subtitle rendered below the title in muted text.
   * May include em-dashes (—) to separate feature callouts, as in
   * the original LumindAd.jsx header pattern.
   *
   * @example "Monitor your advertising performance in real-time — AI-powered insights"
   * @example "Deep insights — SHAP · Anomaly Detection"
   */
  subtitle?: string;
  /**
   * Optional slot for action controls — typically Buttons or status chips.
   * Rendered right-aligned on the same row as the title block.
   *
   * Accepts a single node or an array:
   * @example
   * actions={[
   *   <Button key="refresh" variant="secondary" size="sm">⟳ Refresh</Button>,
   *   <Button key="create"  variant="primary">✦ Create New Ad</Button>,
   * ]}
   */
  actions?: ReactNode;
  /**
   * Bottom margin below the header block in pixels.
   * @default 28
   */
  marginBottom?: number;
}

// ─── Design tokens ────────────────────────────────────────────────────────────
// Sourced from the Header function in LumindAd.jsx (line 295-308)

const TITLE_STYLE: CSSProperties = {
  fontSize:             '30px',
  fontWeight:            900,
  letterSpacing:        '-0.5px',
  lineHeight:            1.1,
  background:           'linear-gradient(135deg, #f0f0ff, #a78bfa)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor:  'transparent',
  backgroundClip:       'text',
  fontFamily:          "'Outfit', system-ui, sans-serif",
  margin:               0,
};

const SUBTITLE_STYLE: CSSProperties = {
  color:      '#475569',
  fontSize:   '14px',
  marginTop:  '4px',
  marginBottom: 0,
  lineHeight: 1.5,
  fontFamily:"'Outfit', system-ui, sans-serif",
};

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Page-level header block with gradient title, subtitle, and actions slot.
 *
 * @example
 * // Dashboard page
 * <Header
 *   title="Performance Dashboard"
 *   subtitle="Monitor your advertising performance in real-time — AI-powered insights"
 *   actions={[
 *     <Button key="r" variant="secondary" size="sm">⟳ Refresh</Button>,
 *     <Button key="c" variant="primary">✦ Create New Ad</Button>,
 *   ]}
 * />
 *
 * @example
 * // Simple page with no actions
 * <Header
 *   title="Upload Data"
 *   subtitle="Process up to 10M rows · Chunked parallel processing · Web Workers"
 * />
 *
 * @example
 * // Page with a search input in the actions slot
 * <Header
 *   title="Campaigns"
 *   subtitle="Manage and track all your advertising campaigns"
 *   actions={[
 *     <input key="s" placeholder="Search campaigns…" style={searchInputStyle} />,
 *     <Button key="n" variant="primary">+ New Campaign</Button>,
 *   ]}
 * />
 */
export function Header({
  title,
  subtitle,
  actions,
  marginBottom = 28,
}: HeaderProps) {
  const hasActions = Boolean(actions);

  return (
    <div
      style={{
        display:        'flex',
        justifyContent: 'space-between',
        alignItems:     'flex-start',
        marginBottom:   `${marginBottom}px`,
        gap:            '16px',
      }}
    >
      {/* ── Left: title + subtitle ────────────────────────────── */}
      <div style={{ minWidth: 0 }}>
        <h1 style={TITLE_STYLE}>{title}</h1>
        {subtitle && <p style={SUBTITLE_STYLE}>{subtitle}</p>}
      </div>

      {/* ── Right: action controls ────────────────────────────── */}
      {hasActions && (
        <div
          role="toolbar"
          aria-label={`${title} actions`}
          style={{
            display:    'flex',
            gap:        '10px',
            alignItems: 'center',
            flexShrink:  0,
            flexWrap:   'wrap',
            justifyContent: 'flex-end',
          }}
        >
          {actions}
        </div>
      )}
    </div>
  );
}

Header.displayName = 'Header';

export default Header;
