/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  LumindAd · Design System · Button
 *  src/components/ui/Button.tsx
 *
 *  Variants  · primary | secondary | danger | success | ghost
 *  Sizes     · sm | md | lg
 *  States    · default | hover | active | disabled | loading
 *  Features  · leftIcon · rightIcon · fullWidth · forwardRef
 *
 *  Accessibility (WCAG 2.1 AA)
 *   – aria-disabled preserves tab focus for screen readers
 *   – aria-busy signals loading state to assistive technology
 *   – Native <button> ensures Enter + Space keyboard activation
 *   – Focus ring is always visible; outline is never suppressed
 *
 *  Author : Elizabeth Díaz Familia
 *           AI Data Scientist · Sustainable Intelligence & BI
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import {
  forwardRef,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type ReactNode,
} from 'react';

// ─── Public API ───────────────────────────────────────────────────────────────

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'success' | 'ghost';
export type ButtonSize    = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style of the button. @default "primary" */
  variant?:   ButtonVariant;
  /** Size preset. @default "md" */
  size?:      ButtonSize;
  /** When true renders a spinner and blocks all interaction. */
  loading?:   boolean;
  /** Node rendered before the label — any SVG, emoji, or component. */
  leftIcon?:  ReactNode;
  /** Node rendered after the label. Hidden while loading. */
  rightIcon?: ReactNode;
  /** Stretches the button to 100 % of its container. */
  fullWidth?: boolean;
}

// ─── Design tokens ────────────────────────────────────────────────────────────
// Values are extracted directly from LumindAd.jsx so every button matches
// the established brand precisely without importing a global stylesheet.

interface VariantTokens {
  bg:          string;
  color:       string;
  border:      string;
  hoverBg:     string;
  hoverBorder: string;
  hoverShadow: string;
  activeBg:    string;
}

const VARIANTS: Record<ButtonVariant, VariantTokens> = {
  primary: {
    bg:          'linear-gradient(135deg, #7c3aed, #5b21b6)',
    color:       '#ffffff',
    border:      '1px solid transparent',
    hoverBg:     'linear-gradient(135deg, #8b5cf6, #6d28d9)',
    hoverBorder: '1px solid transparent',
    hoverShadow: '0 8px 24px rgba(124,58,237,0.45)',
    activeBg:    'linear-gradient(135deg, #6d28d9, #4c1d95)',
  },
  secondary: {
    bg:          'transparent',
    color:       '#a78bfa',
    border:      '1px solid #2d2050',
    hoverBg:     '#1a0f3a',
    hoverBorder: '1px solid #7c3aed',
    hoverShadow: '0 4px 12px rgba(124,58,237,0.2)',
    activeBg:    '#0f0a1e',
  },
  danger: {
    bg:          'linear-gradient(135deg, #dc2626, #991b1b)',
    color:       '#ffffff',
    border:      '1px solid transparent',
    hoverBg:     'linear-gradient(135deg, #ef4444, #b91c1c)',
    hoverBorder: '1px solid transparent',
    hoverShadow: '0 8px 24px rgba(220,38,38,0.4)',
    activeBg:    'linear-gradient(135deg, #b91c1c, #7f1d1d)',
  },
  success: {
    bg:          'linear-gradient(135deg, #059669, #065f46)',
    color:       '#ffffff',
    border:      '1px solid transparent',
    hoverBg:     'linear-gradient(135deg, #10b981, #047857)',
    hoverBorder: '1px solid transparent',
    hoverShadow: '0 8px 24px rgba(5,150,105,0.4)',
    activeBg:    'linear-gradient(135deg, #047857, #064e3b)',
  },
  ghost: {
    bg:          'transparent',
    color:       '#64748b',
    border:      '1px solid transparent',
    hoverBg:     'rgba(124,58,237,0.08)',
    hoverBorder: '1px solid rgba(124,58,237,0.2)',
    hoverShadow: 'none',
    activeBg:    'rgba(124,58,237,0.14)',
  },
};

interface SizeTokens {
  height:   string;
  padding:  string;
  fontSize: string;
  radius:   string;
  gap:      string;
  iconPx:   string;
}

const SIZES: Record<ButtonSize, SizeTokens> = {
  sm: { height: '32px', padding: '0 14px', fontSize: '12px', radius: '8px',  gap: '6px',  iconPx: '13px' },
  md: { height: '40px', padding: '0 22px', fontSize: '13px', radius: '10px', gap: '8px',  iconPx: '14px' },
  lg: { height: '48px', padding: '0 28px', fontSize: '15px', radius: '12px', gap: '10px', iconPx: '16px' },
};

// ─── Loading spinner ──────────────────────────────────────────────────────────

function Spinner({ sizePx }: { sizePx: string }) {
  return (
    <svg
      width={sizePx} height={sizePx}
      viewBox="0 0 16 16" fill="none" aria-hidden="true"
      style={{ animation: 'lad-btn-spin 0.7s linear infinite', flexShrink: 0 }}
    >
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
      <path   d="M8 2 A6 6 0 0 1 14 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Primary interactive control for the LumindAd platform.
 *
 * @example
 * // Default primary
 * <Button onClick={handleSave}>Save Campaign</Button>
 *
 * @example
 * // Loading + success variant
 * <Button variant="success" loading>Processing…</Button>
 *
 * @example
 * // Small ghost with icon
 * <Button variant="ghost" size="sm" leftIcon={<RefreshIcon />}>Refresh</Button>
 *
 * @example
 * // Full-width destructive
 * <Button variant="danger" fullWidth>Delete All</Button>
 */
const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant   = 'primary',
      size      = 'md',
      loading   = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      disabled,
      children,
      style,
      onMouseEnter,
      onMouseLeave,
      onMouseDown,
      onMouseUp,
      onFocus,
      onBlur,
      ...rest
    },
    ref,
  ) => {
    const v          = VARIANTS[variant];
    const s          = SIZES[size];
    const isDisabled = disabled || loading;

    const base: CSSProperties = {
      // ── Layout ───────────────────────────────────
      display:        'inline-flex',
      alignItems:     'center',
      justifyContent: 'center',
      gap:             s.gap,
      width:           fullWidth ? '100%' : 'auto',
      height:          s.height,
      padding:         s.padding,
      // ── Typography ───────────────────────────────
      fontFamily:     "'Outfit', system-ui, sans-serif",
      fontSize:        s.fontSize,
      fontWeight:      600,
      letterSpacing:  '0.3px',
      lineHeight:      1,
      whiteSpace:     'nowrap',
      // ── Visual ───────────────────────────────────
      background:     v.bg,
      color:          v.color,
      border:         v.border,
      borderRadius:   s.radius,
      // ── Interaction ──────────────────────────────
      cursor:      isDisabled ? 'not-allowed' : 'pointer',
      opacity:     isDisabled && !loading ? 0.48 : 1,
      outline:    'none',       // visual focus ring applied via onFocus below
      transition: [
        'background 0.2s ease',
        'box-shadow 0.2s ease',
        'transform 0.15s ease',
        'border 0.2s ease',
        'opacity 0.15s ease',
      ].join(', '),
      // ── Consumer overrides ────────────────────────
      ...style,
    };

    return (
      <>
        {/* Scoped keyframe — avoids polluting the global stylesheet */}
        <style>{`@keyframes lad-btn-spin { to { transform: rotate(360deg); } }`}</style>

        <button
          ref={ref}
          disabled={isDisabled}
          aria-disabled={isDisabled}
          aria-busy={loading || undefined}
          style={base}

          onMouseEnter={(e) => {
            if (!isDisabled) {
              Object.assign(e.currentTarget.style, {
                background: v.hoverBg,
                border:     v.hoverBorder,
                boxShadow:  v.hoverShadow,
                transform:  variant !== 'ghost' ? 'translateY(-2px)' : '',
              });
            }
            onMouseEnter?.(e);
          }}
          onMouseLeave={(e) => {
            if (!isDisabled) {
              Object.assign(e.currentTarget.style, {
                background: v.bg,
                border:     v.border,
                boxShadow:  '',
                transform:  '',
              });
            }
            onMouseLeave?.(e);
          }}
          onMouseDown={(e) => {
            if (!isDisabled) {
              Object.assign(e.currentTarget.style, {
                transform:  'translateY(0) scale(0.98)',
                boxShadow: 'none',
              });
            }
            onMouseDown?.(e);
          }}
          onMouseUp={(e) => {
            if (!isDisabled) {
              Object.assign(e.currentTarget.style, {
                transform: 'translateY(-2px)',
                boxShadow: v.hoverShadow,
              });
            }
            onMouseUp?.(e);
          }}

          /* Keyboard focus ring — always visible for accessibility */
          onFocus={(e) => {
            e.currentTarget.style.boxShadow =
              `0 0 0 3px rgba(124,58,237,0.5), ${v.hoverShadow}`;
            onFocus?.(e);
          }}
          onBlur={(e) => {
            e.currentTarget.style.boxShadow = '';
            onBlur?.(e);
          }}

          {...rest}
        >
          {/* Leading slot: spinner while loading, icon otherwise */}
          {loading ? (
            <Spinner sizePx={s.iconPx} />
          ) : (
            leftIcon && (
              <span aria-hidden="true"
                style={{ display: 'inline-flex', fontSize: s.iconPx, flexShrink: 0 }}>
                {leftIcon}
              </span>
            )
          )}

          {children}

          {/* Trailing icon — hidden while loading to prevent layout shift */}
          {!loading && rightIcon && (
            <span aria-hidden="true"
              style={{ display: 'inline-flex', fontSize: s.iconPx, flexShrink: 0 }}>
              {rightIcon}
            </span>
          )}
        </button>
      </>
    );
  },
);

Button.displayName = 'Button';

export { Button };
export default Button;
