/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  LumindAd · Design System · ProgressBar
 *  src/components/ui/ProgressBar.tsx
 *
 *  Variants  · default | success | danger | custom
 *  Sizes     · xs | sm | md | lg
 *  Features  · animated fill · label · percentage display
 *             · striped animation · indeterminate mode
 *
 *  Maps directly to three usage patterns in LumindAd.jsx:
 *   1. `.progress-bar / .progress-fill` (4 px, purple→cyan gradient)
 *      — Spend ratio in Campaigns table (80 px wide, inline)
 *   2. Budget by Platform bars with custom per-platform color
 *      — Full-width with label + value above
 *   3. Upload processing bar (green→cyan when done, purple→cyan active)
 *      — `width: f.progress%` driven by real-time state
 *
 *  Accessibility (WCAG 2.1 AA)
 *   – role="progressbar" declared on the track element
 *   – aria-valuenow / aria-valuemin / aria-valuemax always present
 *   – aria-label required when no visible label is provided
 *   – Indeterminate mode sets aria-valuenow to undefined
 *
 *  Author : Elizabeth Díaz Familia
 *           AI Data Scientist · Sustainable Intelligence & BI
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { type HTMLAttributes, type CSSProperties } from 'react';

// ─── Public API ───────────────────────────────────────────────────────────────

export type ProgressVariant = 'default' | 'success' | 'danger' | 'amber' | 'cyan';
export type ProgressSize    = 'xs' | 'sm' | 'md' | 'lg';

export interface ProgressBarProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /**
   * Current progress value (0–100).
   * Pass `undefined` for indeterminate/loading state.
   */
  value?: number;
  /** Minimum value. @default 0 */
  min?: number;
  /** Maximum value. @default 100 */
  max?: number;
  /** Colour preset for the fill. @default "default" */
  variant?: ProgressVariant;
  /**
   * Overrides the fill colour with a custom CSS gradient or solid colour.
   * Takes precedence over `variant`.
   */
  fillColor?: string;
  /** Track height. @default "sm" */
  size?: ProgressSize;
  /** Text label rendered above the bar on the left. */
  label?: string;
  /** Text rendered above the bar on the right (e.g. "$1,240"). */
  valueLabel?: string;
  /** Shows the numeric percentage to the right of the bar. @default false */
  showPercent?: boolean;
  /**
   * Adds a repeating diagonal stripe animation to the fill.
   * Useful for "in-progress" states.
   * @default false
   */
  striped?: boolean;
  /** Accessible description for screen readers when no visible label exists. */
  'aria-label'?: string;
}

// ─── Design tokens ────────────────────────────────────────────────────────────

/**
 * Fill gradients sourced from LumindAd.jsx:
 *   default → `linear-gradient(90deg, #7c3aed, #06b6d4)`  (.progress-fill)
 *   success → `linear-gradient(90deg, #10b981, #06b6d4)`  (upload done state)
 *   danger  → solid #ef4444
 *   amber   → solid #f59e0b
 *   cyan    → solid #06b6d4
 */
const FILL_GRADIENTS: Record<ProgressVariant, string> = {
  default: 'linear-gradient(90deg, #7c3aed, #06b6d4)',
  success: 'linear-gradient(90deg, #10b981, #06b6d4)',
  danger:  'linear-gradient(90deg, #ef4444, #dc2626)',
  amber:   'linear-gradient(90deg, #f59e0b, #d97706)',
  cyan:    'linear-gradient(90deg, #06b6d4, #0891b2)',
};

/** Track height values. xs is used for inline table cells. */
const SIZE_HEIGHT: Record<ProgressSize, string> = {
  xs: '3px',
  sm: '4px',   // matches .progress-bar in LumindAd.jsx
  md: '6px',
  lg: '8px',
};

// ─── Keyframes (scoped, injected once) ───────────────────────────────────────

const KEYFRAMES = `
  @keyframes lad-progress-indeterminate {
    0%   { left: -40%; width: 40%; }
    100% { left: 100%; width: 40%; }
  }
  @keyframes lad-progress-stripes {
    0%   { background-position: 0 0; }
    100% { background-position: 28px 0; }
  }
`;

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Horizontal progress indicator for the LumindAd platform.
 *
 * @example
 * // Inline spend bar (Campaigns table)
 * <ProgressBar value={Math.round(spent / budget * 100)} style={{ width: 80 }} />
 *
 * @example
 * // Budget-by-platform row (BudgetPage)
 * <ProgressBar
 *   label="Google Ads"
 *   valueLabel="$7,420"
 *   value={43}
 *   fillColor="#7c3aed"
 * />
 *
 * @example
 * // Upload processing (UploadPage)
 * <ProgressBar
 *   value={file.progress}
 *   variant={file.status === 'done' ? 'success' : 'default'}
 *   striped={file.status === 'processing'}
 *   aria-label={`Processing ${file.name}`}
 * />
 *
 * @example
 * // Indeterminate / loading
 * <ProgressBar aria-label="Loading data…" />
 */
export function ProgressBar({
  value,
  min          = 0,
  max          = 100,
  variant      = 'default',
  fillColor,
  size         = 'sm',
  label,
  valueLabel,
  showPercent  = false,
  striped      = false,
  style,
  'aria-label': ariaLabel,
  ...rest
}: ProgressBarProps) {
  const isIndeterminate = value === undefined;
  const clampedValue    = isIndeterminate
    ? 0
    : Math.min(Math.max(value, min), max);
  const pct             = isIndeterminate
    ? 0
    : Math.round(((clampedValue - min) / (max - min)) * 100);

  const trackHeight = SIZE_HEIGHT[size];
  const fill        = fillColor ?? FILL_GRADIENTS[variant];

  // ── Track (outer container) ──────────────────────────────────────
  const trackStyle: CSSProperties = {
    // Matches .progress-bar in LumindAd.jsx
    height:       trackHeight,
    borderRadius: '2px',
    background:   '#1e1e35',
    overflow:     'hidden',
    position:     'relative',
    ...style,
  };

  // ── Fill (inner bar) ─────────────────────────────────────────────
  const fillBase: CSSProperties = {
    // Matches .progress-fill
    height:       '100%',
    borderRadius: '2px',
    transition:   isIndeterminate ? 'none' : 'width 0.3s ease',
    width:         isIndeterminate ? '40%' : `${pct}%`,
    background:    fill,
    position:      isIndeterminate ? 'absolute' : 'relative',
    animation:     isIndeterminate
      ? 'lad-progress-indeterminate 1.4s ease-in-out infinite'
      : striped
        ? 'lad-progress-stripes 0.6s linear infinite'
        : 'none',
  };

  // Striped overlay layered on top of the gradient
  if (striped && !isIndeterminate) {
    fillBase.backgroundImage = [
      fill,
      'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(255,255,255,0.07) 5px, rgba(255,255,255,0.07) 10px)',
    ].join(', ');
    fillBase.backgroundSize = '28px 28px, 28px 28px';
  }

  return (
    <>
      <style>{KEYFRAMES}</style>

      <div style={{ width: '100%' }}>
        {/* Optional label row */}
        {(label || valueLabel || showPercent) && (
          <div
            style={{
              display:        'flex',
              justifyContent: 'space-between',
              alignItems:     'center',
              marginBottom:   '5px',
              fontSize:       '12px',
              fontFamily:    "'Outfit', system-ui, sans-serif",
            }}
          >
            {label && (
              <span style={{ color: '#94a3b8', fontWeight: 500 }}>{label}</span>
            )}
            <span style={{ color: '#e8e8f8', fontWeight: 700, marginLeft: 'auto' }}>
              {valueLabel ?? (showPercent ? `${pct}%` : null)}
            </span>
          </div>
        )}

        {/* Track */}
        <div
          role="progressbar"
          aria-valuenow={isIndeterminate ? undefined : clampedValue}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-label={ariaLabel ?? label}
          style={trackStyle}
          {...rest}
        >
          {/* Fill */}
          <div style={fillBase} />
        </div>
      </div>
    </>
  );
}

ProgressBar.displayName = 'ProgressBar';

export default ProgressBar;
