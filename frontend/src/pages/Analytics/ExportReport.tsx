/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  LumindAd · Analytics · ExportReport
 *  src/pages/Analytics/ExportReport.tsx
 *
 *  Purpose
 *   The "↓ Export Report" button from LumindAd.jsx line 574 and the
 *   slide-in drawer panel it opens. The drawer hosts the full BIExport
 *   module (PowerBI · Tableau · Excel · PDF) without navigating away
 *   from the Analytics page.
 *
 *  Behaviour
 *   1. Header renders "↓ Export Report" as a btn-secondary-styled <button>.
 *   2. Click → drawer slides in from the right (400px wide, 100dvh tall).
 *   3. Drawer shows the BIExport selection panel (BIExport/index.tsx).
 *   4. Clicking the backdrop or pressing Escape closes the drawer.
 *   5. "✕" button in the drawer header also closes it.
 *
 *  Drawer design tokens
 *   Width         400px (fits next to content without covering it on 1280+)
 *   Background    rgba(10, 8, 20, 0.97)
 *   Border-left   1px solid rgba(124,58,237,0.20)
 *   Backdrop      rgba(0,0,0,0.55) blur(4px)
 *   Slide-in      translateX: 400px → 0  duration 280ms cubic-bezier(.4,0,.2,1)
 *   z-index       80 (below modal overlays at z=100)
 *
 *  Exported button component
 *   ExportReportButton is exported separately so Analytics/index.tsx can
 *   place it in the Header actions array directly.
 *   It receives an `onClick` prop which the parent (ExportReport) wires up.
 *
 *  Accessibility (WCAG 2.1 AA)
 *   – Drawer is role="dialog" aria-modal="true" aria-label="Export Report"
 *   – Focus moves into the drawer's "✕" close button on open
 *   – Escape key closes the drawer (keydown handler on the dialog)
 *   – Backdrop click closes the drawer with keyboard equivalency
 *   – Body scroll is locked while drawer is open (overflow:hidden on body)
 *   – aria-expanded on the trigger button reflects open/closed state
 *
 *  Author : Elizabeth Díaz Familia
 *           AI Data Scientist · Sustainable Intelligence & BI
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import {
  useState,
  useEffect,
  useRef,
  type KeyboardEvent,
  type CSSProperties,
} from 'react';
import { BIExportPanel } from './BIExport/index';

// ─── Shared tokens ────────────────────────────────────────────────────────────

const F = "'Outfit', system-ui, sans-serif";

// ─── Exported trigger button ──────────────────────────────────────────────────

/**
 * Standalone trigger button — drop into any Header actions array.
 * Styled as btn-secondary matching LumindAd.jsx line 574.
 *
 * @example
 * // Analytics/index.tsx
 * <Header actions={[<ExportReportButton key="e" onClick={() => setDrawerOpen(true)} />]} />
 */
export function ExportReportButton({
  onClick,
  expanded = false,
}: {
  onClick:   () => void;
  expanded?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={expanded}
      aria-haspopup="dialog"
      aria-label="Open export report panel"
      style={{
        background:   'transparent',
        border:       '1px solid rgba(124,58,237,0.3)',
        borderRadius: '10px',
        padding:      '9px 18px',
        color:        '#a78bfa',
        fontSize:     '13px',
        fontWeight:    600,
        fontFamily:    F,
        cursor:       'pointer',
        display:      'flex',
        alignItems:   'center',
        gap:          '6px',
        letterSpacing:'0.2px',
        transition:   'all 0.15s ease',
        whiteSpace:   'nowrap',
      }}
      onMouseEnter={(e) => {
        Object.assign(e.currentTarget.style, {
          background:  'rgba(124,58,237,0.1)',
          borderColor: 'rgba(124,58,237,0.5)',
        });
      }}
      onMouseLeave={(e) => {
        Object.assign(e.currentTarget.style, {
          background:  'transparent',
          borderColor: 'rgba(124,58,237,0.3)',
        });
      }}
    >
      ↓ Export Report
    </button>
  );
}

// ─── Drawer ───────────────────────────────────────────────────────────────────

interface DrawerProps {
  open:    boolean;
  onClose: () => void;
}

function ExportDrawer({ open, onClose }: DrawerProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  // Lock body scroll while open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  // Focus close button on open
  useEffect(() => {
    if (open) setTimeout(() => closeRef.current?.focus(), 50);
  }, [open]);

  const handleKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') onClose();
  };

  const drawerStyle: CSSProperties = {
    position:         'fixed',
    top:               0,
    right:             0,
    bottom:            0,
    width:            '400px',
    background:       'rgba(10, 8, 20, 0.97)',
    borderLeft:       '1px solid rgba(124,58,237,0.20)',
    backdropFilter:   'blur(16px)',
    zIndex:            80,
    overflowY:        'auto',
    transform:         open ? 'translateX(0)' : 'translateX(400px)',
    transition:       'transform 280ms cubic-bezier(0.4, 0, 0.2, 1)',
    display:          'flex',
    flexDirection:    'column',
  };

  const backdropStyle: CSSProperties = {
    position:         'fixed',
    inset:             0,
    background:       'rgba(0,0,0,0.55)',
    backdropFilter:   'blur(4px)',
    zIndex:            79,
    opacity:           open ? 1 : 0,
    pointerEvents:     open ? 'auto' : 'none',
    transition:       'opacity 280ms ease',
  };

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        style={backdropStyle}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Export Report"
        aria-hidden={!open}
        style={drawerStyle}
        onKeyDown={handleKey}
      >
        {/* Drawer header */}
        <div
          style={{
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'space-between',
            padding:        '20px 24px 16px',
            borderBottom:   '1px solid rgba(124,58,237,0.12)',
            position:       'sticky',
            top:             0,
            background:     'rgba(10,8,20,0.97)',
            zIndex:          1,
            flexShrink:      0,
          }}
        >
          <div>
            <div
              style={{ fontWeight: 700, fontSize: '16px', color: '#e8e8f8', fontFamily: F }}
            >
              Export Report
            </div>
            <div
              style={{ fontSize: '11px', color: '#475569', fontFamily: F, marginTop: '2px' }}
            >
              Power BI · Tableau · Excel · PDF
            </div>
          </div>

          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close export panel"
            style={{
              background:   'rgba(124,58,237,0.08)',
              border:       '1px solid rgba(124,58,237,0.15)',
              borderRadius: '8px',
              width:        '32px',
              height:       '32px',
              color:        '#a78bfa',
              fontSize:     '16px',
              cursor:       'pointer',
              display:      'flex',
              alignItems:   'center',
              justifyContent:'center',
              transition:   'all 0.15s ease',
              flexShrink:    0,
            }}
            onMouseEnter={(e) => {
              Object.assign(e.currentTarget.style, {
                background:  'rgba(124,58,237,0.18)',
                borderColor: 'rgba(124,58,237,0.35)',
              });
            }}
            onMouseLeave={(e) => {
              Object.assign(e.currentTarget.style, {
                background:  'rgba(124,58,237,0.08)',
                borderColor: 'rgba(124,58,237,0.15)',
              });
            }}
          >
            ✕
          </button>
        </div>

        {/* Drawer body — BIExport panel */}
        <div style={{ padding: '20px 24px', flex: 1 }}>
          <BIExportPanel />
        </div>
      </div>
    </>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Self-contained Export Report trigger + drawer.
 * Renders both the trigger button and the slide-in drawer.
 * The parent (Analytics/index.tsx) can use this component directly
 * OR use ExportReportButton separately with its own open state.
 *
 * @example
 * // All-in-one — renders button + drawer together
 * <ExportReport />
 *
 * @example
 * // Separate button in Header, drawer managed by parent
 * const [open, setOpen] = useState(false);
 * <Header actions={[<ExportReportButton onClick={() => setOpen(true)} expanded={open} />]} />
 * <ExportDrawer open={open} onClose={() => setOpen(false)} />
 */
export function ExportReport() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <ExportReportButton
        onClick={() => setOpen(true)}
        expanded={open}
      />
      <ExportDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}

ExportReport.displayName = 'ExportReport';
export { ExportDrawer };
export default ExportReport;
