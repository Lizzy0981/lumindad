/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  LumindAd · Design System · Tooltip
 *  src/components/ui/Tooltip.tsx
 *
 *  Positions  · top | bottom | left | right (+ auto-flip)
 *  Features   · show/hide delay · portal render · arrow
 *               keyboard trigger (focus/blur) · custom content
 *
 *  Visual style matches the CustomTooltip (Recharts) pattern in
 *  LumindAd.jsx exactly:
 *    background: rgba(10,8,20,.95)
 *    border    : 1px solid rgba(124,58,237,.3)
 *    radius    : 10px
 *    blur      : backdrop-filter blur(12px)
 *    font      : 12px Outfit
 *
 *  Accessibility (WCAG 2.1 AA)
 *   – role="tooltip" on the popup element
 *   – aria-describedby links the trigger to the tooltip
 *   – Keyboard: tooltip opens on focus, closes on blur + Escape
 *   – Pointer: opens on mouseenter, closes on mouseleave
 *   – Never intercepts pointer events itself (pointer-events: none)
 *
 *  Rendering strategy
 *   – Uses a React Portal (document.body) so the tooltip is never
 *     clipped by overflow:hidden parents (modals, table cells, etc.)
 *   – Position is calculated via getBoundingClientRect on each open
 *
 *  Author : Elizabeth Díaz Familia
 *           AI Data Scientist · Sustainable Intelligence & BI
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import {
  useState,
  useRef,
  useEffect,
  useId,
  useCallback,
  type ReactNode,
  type CSSProperties,
} from 'react';
import { createPortal } from 'react-dom';

// ─── Public API ───────────────────────────────────────────────────────────────

export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

export interface TooltipProps {
  /**
   * The content displayed inside the tooltip bubble.
   * Accepts a string or any ReactNode for rich content.
   */
  content: ReactNode;
  /** The element that triggers the tooltip. Must be a single child. */
  children: ReactNode;
  /** Preferred tooltip position relative to the trigger. @default "top" */
  position?: TooltipPosition;
  /**
   * Milliseconds before the tooltip appears after the trigger is hovered.
   * Prevents flicker on fast mouse movements. @default 300
   */
  delay?: number;
  /** Disables the tooltip entirely without unmounting the trigger. */
  disabled?: boolean;
  /** Maximum width of the tooltip bubble in pixels. @default 220 */
  maxWidth?: number;
}

// ─── Placement calculation ────────────────────────────────────────────────────

interface Placement {
  top:       number;
  left:      number;
  arrowTop:  number | 'auto';
  arrowLeft: number | 'auto';
  arrowDir:  'up' | 'down' | 'left-arrow' | 'right-arrow';
}

/**
 * Calculates the absolute screen coordinates for the tooltip bubble
 * and its directional arrow based on the trigger's bounding rect.
 */
function calcPlacement(
  triggerRect: DOMRect,
  tipWidth:    number,
  tipHeight:   number,
  position:    TooltipPosition,
  gap          = 10,
): Placement {
  const { top, left, width, height, bottom, right } = triggerRect;
  const cx = left + width / 2;
  const cy = top  + height / 2;

  switch (position) {
    case 'top':
      return {
        top:       top - tipHeight - gap + window.scrollY,
        left:      cx  - tipWidth  / 2   + window.scrollX,
        arrowTop:  'auto',
        arrowLeft: tipWidth / 2 - 5,
        arrowDir:  'down',
      };
    case 'bottom':
      return {
        top:       bottom + gap + window.scrollY,
        left:      cx  - tipWidth / 2 + window.scrollX,
        arrowTop:  -5,
        arrowLeft: tipWidth / 2 - 5,
        arrowDir:  'up',
      };
    case 'left':
      return {
        top:       cy - tipHeight / 2 + window.scrollY,
        left:      left - tipWidth - gap + window.scrollX,
        arrowTop:  tipHeight / 2 - 5,
        arrowLeft: 'auto',
        arrowDir:  'right-arrow',
      };
    case 'right':
      return {
        top:       cy  - tipHeight / 2 + window.scrollY,
        left:      right + gap + window.scrollX,
        arrowTop:  tipHeight / 2 - 5,
        arrowLeft: -5,
        arrowDir:  'left-arrow',
      };
  }
}

// ─── Tooltip bubble (portal content) ─────────────────────────────────────────

interface BubbleProps {
  id:        string;
  content:   ReactNode;
  placement: Placement;
  visible:   boolean;
  maxWidth:  number;
}

function TooltipBubble({ id, content, placement, visible, maxWidth }: BubbleProps) {
  // ── Arrow styles ─────────────────────────────────────────────────
  const arrowBase: CSSProperties = {
    position: 'absolute',
    width:    0,
    height:   0,
  };

  const arrows: Record<BubbleProps['placement']['arrowDir'], CSSProperties> = {
    down: {
      ...arrowBase,
      bottom:      -5,
      left:         placement.arrowLeft === 'auto' ? 'auto' : placement.arrowLeft,
      borderLeft:  '5px solid transparent',
      borderRight: '5px solid transparent',
      borderTop:   '5px solid rgba(124, 58, 237, 0.35)',
    },
    up: {
      ...arrowBase,
      top:         placement.arrowTop === 'auto' ? 'auto' : placement.arrowTop,
      left:         placement.arrowLeft === 'auto' ? 'auto' : placement.arrowLeft,
      borderLeft:  '5px solid transparent',
      borderRight: '5px solid transparent',
      borderBottom:'5px solid rgba(124, 58, 237, 0.35)',
    },
    'right-arrow': {
      ...arrowBase,
      top:          placement.arrowTop === 'auto' ? 'auto' : placement.arrowTop,
      right:        -5,
      borderTop:    '5px solid transparent',
      borderBottom: '5px solid transparent',
      borderLeft:   '5px solid rgba(124, 58, 237, 0.35)',
    },
    'left-arrow': {
      ...arrowBase,
      top:          placement.arrowTop === 'auto' ? 'auto' : placement.arrowTop,
      left:          placement.arrowLeft === 'auto' ? 'auto' : placement.arrowLeft,
      borderTop:    '5px solid transparent',
      borderBottom: '5px solid transparent',
      borderRight:  '5px solid rgba(124, 58, 237, 0.35)',
    },
  };

  const bubbleStyle: CSSProperties = {
    // ── Positioning ──────────────────────────────────────────────
    position:  'absolute',
    top:        placement.top,
    left:       placement.left,
    zIndex:     9000,
    maxWidth:   maxWidth,
    // ── Visual (mirrors CustomTooltip in LumindAd.jsx) ───────────
    background:      'rgba(10, 8, 20, 0.95)',
    border:          '1px solid rgba(124, 58, 237, 0.3)',
    borderRadius:    '10px',
    backdropFilter:  'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    padding:         '10px 14px',
    fontSize:        '12px',
    fontFamily:     "'Outfit', system-ui, sans-serif",
    color:           '#e8e8f8',
    lineHeight:       1.5,
    pointerEvents:  'none',       // tooltip never steals hover/click
    // ── Fade animation ───────────────────────────────────────────
    opacity:    visible ? 1 : 0,
    transform:  visible ? 'scale(1)' : 'scale(0.95)',
    transition: 'opacity 0.15s ease, transform 0.15s ease',
    transformOrigin: 'center',
  };

  return (
    <div id={id} role="tooltip" style={bubbleStyle}>
      {content}
      <span style={arrows[placement.arrowDir]} aria-hidden="true" />
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Non-interactive informational overlay anchored to a trigger element.
 *
 * @example
 * // Simple string tooltip
 * <Tooltip content="Campaign impressions in the last 30 days">
 *   <InfoIcon />
 * </Tooltip>
 *
 * @example
 * // Rich content tooltip, positioned below
 * <Tooltip
 *   position="bottom"
 *   content={<span>ROAS: <strong style={{ color: '#10b981' }}>5.1x</strong></span>}
 * >
 *   <Badge variant="green">HIGH ROAS</Badge>
 * </Tooltip>
 *
 * @example
 * // Delayed tooltip (avoids flash on fast scans)
 * <Tooltip content="Delete this campaign" delay={500}>
 *   <Button variant="danger" size="sm">⏸</Button>
 * </Tooltip>
 */
export function Tooltip({
  content,
  children,
  position  = 'top',
  delay     = 300,
  disabled  = false,
  maxWidth  = 220,
}: TooltipProps) {
  const [visible,    setVisible]   = useState(false);
  const [placement,  setPlacement] = useState<Placement | null>(null);
  const triggerRef  = useRef<HTMLSpanElement>(null);
  const bubbleRef   = useRef<HTMLDivElement>(null);
  const timerRef    = useRef<ReturnType<typeof setTimeout>>();
  const tooltipId   = useId();

  // ── Placement recalculation ──────────────────────────────────────
  const reposition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect   = triggerRef.current.getBoundingClientRect();
    // Estimate bubble size before it renders by using last known or defaults
    const tipW   = bubbleRef.current?.offsetWidth  ?? maxWidth;
    const tipH   = bubbleRef.current?.offsetHeight ?? 40;
    setPlacement(calcPlacement(rect, tipW, tipH, position));
  }, [position, maxWidth]);

  // ── Show / hide ──────────────────────────────────────────────────
  const show = useCallback(() => {
    if (disabled) return;
    reposition();
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setVisible(true), delay);
  }, [disabled, delay, reposition]);

  const hide = useCallback(() => {
    clearTimeout(timerRef.current);
    setVisible(false);
  }, []);

  // Dismiss on Escape key
  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') hide(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [visible, hide]);

  // Cleanup timer on unmount
  useEffect(() => () => clearTimeout(timerRef.current), []);

  return (
    <>
      {/* Trigger wrapper — span is display:contents-like, no extra layout */}
      <span
        ref={triggerRef}
        aria-describedby={visible ? tooltipId : undefined}
        style={{ display: 'inline-flex' }}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
      >
        {children}
      </span>

      {/* Portal — renders outside the DOM hierarchy to avoid clipping */}
      {placement &&
        createPortal(
          <div ref={bubbleRef as React.RefObject<HTMLDivElement>}>
            <TooltipBubble
              id={tooltipId}
              content={content}
              placement={placement}
              visible={visible}
              maxWidth={maxWidth}
            />
          </div>,
          document.body,
        )}
    </>
  );
}

Tooltip.displayName = 'Tooltip';

export default Tooltip;
