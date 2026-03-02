/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  LumindAd · Design System · Modal
 *  src/components/ui/Modal.tsx
 *
 *  Sizes    · sm (480px) | md (600px) | lg (800px) | xl (1000px)
 *  Features · focus trap · scroll lock · portal render
 *             · Escape key close · backdrop click close
 *             · header / body / footer slots · close button
 *             · entrance / exit animation
 *
 *  Visual style derives from the frosted-glass card language in
 *  LumindAd.jsx, extended with a dark backdrop overlay:
 *    backdrop  : rgba(0,0,0,0.7) + blur(4px)
 *    surface   : rgba(15,10,30,0.97) — deeper than .card for focus
 *    border    : rgba(124,58,237,0.25)
 *    radius    : 20px (larger than cards for hierarchy)
 *    header bg : rgba(124,58,237,0.06)
 *
 *  Accessibility (WCAG 2.1 AA)
 *   – role="dialog" + aria-modal="true" on the dialog element
 *   – aria-labelledby links to the modal title (required)
 *   – aria-describedby links to the modal body when provided
 *   – Focus trap: Tab/Shift+Tab cycle only within the modal
 *   – First focusable element receives focus on open
 *   – Focus returns to the trigger element on close
 *   – Escape key always closes the modal
 *   – Body scroll is locked while modal is open (overflow:hidden)
 *
 *  Author : Elizabeth Díaz Familia
 *           AI Data Scientist · Sustainable Intelligence & BI
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import {
  useEffect,
  useRef,
  useId,
  useCallback,
  type ReactNode,
  type CSSProperties,
  type KeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';

// ─── Public API ───────────────────────────────────────────────────────────────

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

export interface ModalProps {
  /** Controls visibility. The consumer owns this state. */
  isOpen: boolean;
  /** Called when the user dismisses the modal (Escape, backdrop, close btn). */
  onClose: () => void;
  /** Modal heading — rendered in the header bar and linked via aria-labelledby. */
  title: string;
  /**
   * Optional subtitle rendered below the title in muted text.
   * Useful for action descriptions or destructive-action warnings.
   */
  subtitle?: string;
  /** Main content area. Scrolls independently of the header/footer. */
  children: ReactNode;
  /** Content rendered in the sticky footer (typically action buttons). */
  footer?: ReactNode;
  /** Dialog width preset. @default "md" */
  size?: ModalSize;
  /**
   * When false the backdrop click does not close the modal.
   * Use for critical confirmations or multi-step forms. @default true
   */
  closeOnBackdrop?: boolean;
  /**
   * Icon or emoji shown to the left of the title.
   * Kept aria-hidden; purely decorative.
   */
  icon?: ReactNode;
}

// ─── Design tokens ────────────────────────────────────────────────────────────

const MAX_WIDTHS: Record<ModalSize, string> = {
  sm: '480px',
  md: '600px',
  lg: '800px',
  xl: '1000px',
};

// ─── Focus trap utility ───────────────────────────────────────────────────────

/** CSS selector for all natively focusable elements. */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), ' +
  'select:not([disabled]), textarea:not([disabled]), ' +
  '[tabindex]:not([tabindex="-1"])';

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE));
}

// ─── Keyframes ────────────────────────────────────────────────────────────────

const KEYFRAMES = `
  @keyframes lad-modal-backdrop-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes lad-modal-slide-in {
    from { opacity: 0; transform: translateY(20px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0)    scale(1);    }
  }
`;

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Accessible dialog overlay for the LumindAd platform.
 *
 * @example
 * // Confirmation modal
 * const [open, setOpen] = useState(false);
 *
 * <Button onClick={() => setOpen(true)}>Delete Campaign</Button>
 *
 * <Modal
 *   isOpen={open}
 *   onClose={() => setOpen(false)}
 *   title="Delete Campaign"
 *   subtitle="This action cannot be undone."
 *   icon="⚠️"
 *   size="sm"
 *   footer={
 *     <>
 *       <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
 *       <Button variant="danger" onClick={handleDelete}>Delete</Button>
 *     </>
 *   }
 * >
 *   <p>Are you sure you want to delete "Summer Sale 2025"?</p>
 * </Modal>
 *
 * @example
 * // Create / Edit form modal
 * <Modal isOpen={open} onClose={close} title="New Campaign" size="lg"
 *   footer={<Button variant="primary" fullWidth>Save Campaign</Button>}
 * >
 *   <CampaignForm />
 * </Modal>
 */
export function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size             = 'md',
  closeOnBackdrop  = true,
  icon,
}: ModalProps) {
  const dialogRef       = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId         = useId();
  const bodyId          = useId();

  // ── Body scroll lock ─────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  // ── Focus management ─────────────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      // Save the element that had focus before the modal opened
      previousFocusRef.current = document.activeElement as HTMLElement;

      // Move focus into the dialog on the next tick
      requestAnimationFrame(() => {
        const focusable = getFocusable(dialogRef.current!);
        (focusable[0] ?? dialogRef.current)?.focus();
      });
    } else {
      // Return focus to the original trigger on close
      previousFocusRef.current?.focus();
    }
  }, [isOpen]);

  // ── Keyboard handlers ────────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      // Escape: close
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }

      // Tab / Shift+Tab: trap focus inside dialog
      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = getFocusable(dialogRef.current);
        if (focusable.length === 0) { e.preventDefault(); return; }

        const first = focusable[0];
        const last  = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    },
    [onClose],
  );

  if (!isOpen) return null;

  // ── Sizes ────────────────────────────────────────────────────────
  const maxWidth = MAX_WIDTHS[size];

  // ── Styles ───────────────────────────────────────────────────────
  const backdropStyle: CSSProperties = {
    position:        'fixed',
    inset:           0,
    zIndex:          1000,
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'center',
    padding:         '24px 16px',
    background:      'rgba(0, 0, 0, 0.72)',
    backdropFilter:  'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
    animation:       'lad-modal-backdrop-in 0.2s ease forwards',
  };

  const dialogStyle: CSSProperties = {
    position:       'relative',
    width:          '100%',
    maxWidth,
    maxHeight:      'calc(100vh - 48px)',
    display:        'flex',
    flexDirection:  'column',
    background:     'rgba(15, 10, 30, 0.97)',
    border:         '1px solid rgba(124, 58, 237, 0.25)',
    borderRadius:   '20px',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    boxShadow:      '0 24px 80px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(124, 58, 237, 0.1)',
    animation:      'lad-modal-slide-in 0.25s ease forwards',
    outline:        'none',   // focus ring provided programmatically
  };

  const headerStyle: CSSProperties = {
    display:        'flex',
    alignItems:     'flex-start',
    justifyContent: 'space-between',
    gap:            '16px',
    padding:        '20px 24px',
    borderBottom:   '1px solid rgba(124, 58, 237, 0.1)',
    background:     'rgba(124, 58, 237, 0.04)',
    borderRadius:   '20px 20px 0 0',
    flexShrink:      0,
  };

  const bodyStyle: CSSProperties = {
    flex:       1,
    overflowY: 'auto',
    padding:   '24px',
    // Custom scrollbar matching LumindAd's global scrollbar
    scrollbarWidth:     'thin',
    scrollbarColor:     '#4c1d95 #0c0c1a',
  };

  const footerStyle: CSSProperties = {
    display:      'flex',
    alignItems:   'center',
    justifyContent:'flex-end',
    gap:          '12px',
    padding:      '16px 24px',
    borderTop:    '1px solid rgba(124, 58, 237, 0.1)',
    background:   'rgba(6, 4, 18, 0.5)',
    borderRadius: '0 0 20px 20px',
    flexShrink:    0,
  };

  return createPortal(
    <>
      <style>{KEYFRAMES}</style>

      {/* ── Backdrop ─────────────────────────────────────────────── */}
      <div
        style={backdropStyle}
        onClick={closeOnBackdrop ? onClose : undefined}
        aria-hidden="true"
      >
        {/* ── Dialog ───────────────────────────────────────────── */}
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={bodyId}
          tabIndex={-1}
          style={dialogStyle}
          onKeyDown={handleKeyDown}
          onClick={(e) => e.stopPropagation()} // prevent backdrop close
        >
          {/* ── Header ─────────────────────────────────────────── */}
          <div style={headerStyle}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              {/* Decorative icon */}
              {icon && (
                <span
                  aria-hidden="true"
                  style={{
                    fontSize:       '22px',
                    lineHeight:      1,
                    flexShrink:      0,
                    paddingTop:     '2px',
                  }}
                >
                  {icon}
                </span>
              )}
              <div>
                {/* Title — linked to aria-labelledby */}
                <h2
                  id={titleId}
                  style={{
                    margin:       0,
                    fontSize:    '17px',
                    fontWeight:   700,
                    color:       '#e8e8f8',
                    fontFamily: "'Outfit', system-ui, sans-serif",
                    lineHeight:   1.3,
                    letterSpacing: '0.2px',
                  }}
                >
                  {title}
                </h2>
                {/* Optional subtitle */}
                {subtitle && (
                  <p
                    style={{
                      margin:      '4px 0 0',
                      fontSize:   '12px',
                      color:      '#64748b',
                      fontFamily:"'Outfit', system-ui, sans-serif",
                      lineHeight:  1.5,
                    }}
                  >
                    {subtitle}
                  </p>
                )}
              </div>
            </div>

            {/* Close button */}
            <button
              onClick={onClose}
              aria-label="Close dialog"
              style={{
                flexShrink:    0,
                width:        '32px',
                height:       '32px',
                display:      'flex',
                alignItems:   'center',
                justifyContent:'center',
                background:   'rgba(124, 58, 237, 0.08)',
                border:       '1px solid rgba(124, 58, 237, 0.15)',
                borderRadius: '8px',
                color:        '#64748b',
                fontSize:     '18px',
                lineHeight:    1,
                cursor:       'pointer',
                transition:   'all 0.15s ease',
                fontFamily:  "'Outfit', sans-serif",
              }}
              onMouseEnter={(e) => {
                Object.assign(e.currentTarget.style, {
                  background:  'rgba(239,68,68,0.1)',
                  borderColor: 'rgba(239,68,68,0.3)',
                  color:       '#ef4444',
                });
              }}
              onMouseLeave={(e) => {
                Object.assign(e.currentTarget.style, {
                  background:  'rgba(124,58,237,0.08)',
                  borderColor: 'rgba(124,58,237,0.15)',
                  color:       '#64748b',
                });
              }}
            >
              ×
            </button>
          </div>

          {/* ── Body ───────────────────────────────────────────── */}
          <div id={bodyId} style={bodyStyle}>
            {children}
          </div>

          {/* ── Footer ─────────────────────────────────────────── */}
          {footer && <div style={footerStyle}>{footer}</div>}
        </div>
      </div>
    </>,
    document.body,
  );
}

Modal.displayName = 'Modal';

export default Modal;
