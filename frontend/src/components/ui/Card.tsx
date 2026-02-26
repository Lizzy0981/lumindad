/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  LumindAd · Design System · Card
 *  src/components/ui/Card.tsx
 *
 *  Variants  · default | elevated | flat | ai | green
 *  Features  · header slot · footer slot · hover lift · glow
 *
 *  "default"  — frosted dark glass with purple border (matches
 *                .card class in LumindAd.jsx)
 *  "elevated" — stronger shadow, used for featured KPI panels
 *  "flat"     — no background blur, lightweight inner panels
 *  "ai"       — purple/cyan gradient tint for AI insight cards
 *  "green"    — green tint for Green AI sustainability panels
 *
 *  Author : Elizabeth Díaz Familia
 *           AI Data Scientist · Sustainable Intelligence & BI
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import {
  forwardRef,
  type HTMLAttributes,
  type ReactNode,
  type CSSProperties,
} from 'react';

// ─── Public API ───────────────────────────────────────────────────────────────

export type CardVariant = 'default' | 'elevated' | 'flat' | 'ai' | 'green';
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Visual style. @default "default" */
  variant?: CardVariant;
  /** Internal spacing preset. @default "md" */
  padding?: CardPadding;
  /** Enables translateY(-2px) lift on hover. @default true */
  hoverable?: boolean;
  /** Renders a section above the body, separated by a divider. */
  header?: ReactNode;
  /** Renders a section below the body, separated by a divider. */
  footer?: ReactNode;
  /** Adds a purple glow box-shadow (used on KPI and featured cards). */
  glow?: boolean;
}

// ─── Design tokens ────────────────────────────────────────────────────────────

interface VariantTokens {
  background:   string;
  border:       string;
  backdropFilter: string;
  hoverBorder:  string;
  baseShadow:   string;
  hoverShadow:  string;
}

const VARIANTS: Record<CardVariant, VariantTokens> = {
  default: {
    background:     'rgba(15, 10, 30, 0.85)',
    border:         '1px solid rgba(124, 58, 237, 0.15)',
    backdropFilter: 'blur(12px)',
    hoverBorder:    '1px solid rgba(124, 58, 237, 0.4)',
    baseShadow:     'none',
    hoverShadow:    '0 8px 32px rgba(124, 58, 237, 0.12)',
  },
  elevated: {
    background:     'rgba(15, 10, 30, 0.95)',
    border:         '1px solid rgba(124, 58, 237, 0.2)',
    backdropFilter: 'blur(16px)',
    hoverBorder:    '1px solid rgba(124, 58, 237, 0.5)',
    baseShadow:     '0 4px 24px rgba(0, 0, 0, 0.4)',
    hoverShadow:    '0 12px 40px rgba(124, 58, 237, 0.2)',
  },
  flat: {
    background:     'rgba(124, 58, 237, 0.04)',
    border:         '1px solid rgba(124, 58, 237, 0.1)',
    backdropFilter: 'none',
    hoverBorder:    '1px solid rgba(124, 58, 237, 0.25)',
    baseShadow:     'none',
    hoverShadow:    '0 4px 16px rgba(124, 58, 237, 0.08)',
  },
  ai: {
    // Matches the AI Recommendation card in LumindAd.jsx BudgetPage
    background:     'linear-gradient(135deg, rgba(124, 58, 237, 0.1), rgba(6, 182, 212, 0.05))',
    border:         '1px solid rgba(124, 58, 237, 0.2)',
    backdropFilter: 'blur(12px)',
    hoverBorder:    '1px solid rgba(124, 58, 237, 0.45)',
    baseShadow:     'none',
    hoverShadow:    '0 8px 28px rgba(124, 58, 237, 0.15)',
  },
  green: {
    // Matches the Green AI panel in LumindAd.jsx Sidebar
    background:     'rgba(16, 185, 129, 0.06)',
    border:         '1px solid rgba(16, 185, 129, 0.15)',
    backdropFilter: 'none',
    hoverBorder:    '1px solid rgba(16, 185, 129, 0.35)',
    baseShadow:     'none',
    hoverShadow:    '0 6px 20px rgba(16, 185, 129, 0.1)',
  },
};

const PADDING_MAP: Record<CardPadding, string> = {
  none: '0',
  sm:   '14px',
  md:   '20px',
  lg:   '28px',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Divider line used between header/body/footer sections. */
function Divider() {
  return (
    <div
      aria-hidden="true"
      style={{
        height:     '1px',
        background: 'rgba(124, 58, 237, 0.1)',
        margin:     '0',
        flexShrink:  0,
      }}
    />
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Surface container for grouped content in the LumindAd platform.
 *
 * @example
 * // Basic card
 * <Card>
 *   <p>Campaign overview</p>
 * </Card>
 *
 * @example
 * // AI insight card with header
 * <Card variant="ai" header={<h3>AI Recommendation</h3>}>
 *   Reallocate $1,200 from Meta to Google Ads.
 * </Card>
 *
 * @example
 * // Green AI sustainability panel
 * <Card variant="green" padding="sm">
 *   🌱 Total CO₂: 0.00001 g
 * </Card>
 */
const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      variant   = 'default',
      padding   = 'md',
      hoverable = true,
      header,
      footer,
      glow      = false,
      children,
      style,
      onMouseEnter,
      onMouseLeave,
      ...rest
    },
    ref,
  ) => {
    const v = VARIANTS[variant];

    const glowShadow = '0 0 24px rgba(124, 58, 237, 0.3)';

    const baseStyle: CSSProperties = {
      // Layout
      display:        'flex',
      flexDirection:  'column',
      // Visual
      background:      v.background,
      border:          v.border,
      borderRadius:   '16px',
      backdropFilter:  v.backdropFilter,
      WebkitBackdropFilter: v.backdropFilter,
      boxShadow:       glow ? glowShadow : v.baseShadow,
      // Interaction
      transition: 'border 0.25s ease, box-shadow 0.25s ease, transform 0.25s ease',
      // Merge consumer overrides
      ...style,
    };

    const paddingValue = PADDING_MAP[padding];

    return (
      <div
        ref={ref}
        style={baseStyle}
        onMouseEnter={(e) => {
          if (hoverable) {
            Object.assign(e.currentTarget.style, {
              border:     v.hoverBorder,
              boxShadow:  glow ? glowShadow : v.hoverShadow,
              transform: 'translateY(-2px)',
            });
          }
          onMouseEnter?.(e);
        }}
        onMouseLeave={(e) => {
          if (hoverable) {
            Object.assign(e.currentTarget.style, {
              border:    v.border,
              boxShadow: glow ? glowShadow : v.baseShadow,
              transform: '',
            });
          }
          onMouseLeave?.(e);
        }}
        {...rest}
      >
        {/* Header slot */}
        {header && (
          <>
            <div style={{ padding: paddingValue }}>{header}</div>
            <Divider />
          </>
        )}

        {/* Body */}
        <div style={{ padding: paddingValue, flex: 1 }}>
          {children}
        </div>

        {/* Footer slot */}
        {footer && (
          <>
            <Divider />
            <div style={{ padding: paddingValue }}>{footer}</div>
          </>
        )}
      </div>
    );
  },
);

Card.displayName = 'Card';

export { Card };
export default Card;
