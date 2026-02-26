/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  LumindAd · Design System · Badge
 *  src/components/ui/Badge.tsx
 *
 *  Variants  · purple | cyan | green | amber | red | gray
 *  Sizes     · sm | md
 *  Features  · status dot · icon slot · uppercase label
 *
 *  Maps directly to three patterns found in LumindAd.jsx:
 *   1. `.badge` + `statusColor/statusBg` — campaign status chips
 *      (ACTIVE · PAUSED · DRAFT · COMPLETED)
 *   2. `.tag .tag-up/.tag-down/.tag-neutral` — KPI delta tags
 *      (▲ +12.5% · ▼ −3.2% · ≈ neutral)
 *   3. Inline cyan "NEW" labels in the sidebar navigation
 *
 *  Accessibility (WCAG 2.1 AA)
 *   – Non-decorative badges receive role="status" or are wrapped
 *     in an element with an appropriate aria-label by the consumer
 *   – Status dot is aria-hidden; its meaning is conveyed by text
 *   – Contrast ratio ≥ 4.5 : 1 for all colour/background pairs
 *
 *  Author : Elizabeth Díaz Familia
 *           AI Data Scientist · Sustainable Intelligence & BI
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { type HTMLAttributes, type ReactNode, type CSSProperties } from 'react';

// ─── Public API ───────────────────────────────────────────────────────────────

/** Semantic colour intent of the badge. */
export type BadgeVariant =
  | 'purple'   // default brand  — used for "completed" campaign status
  | 'cyan'     // accent         — used for "NEW" labels, info states
  | 'green'    // success        — used for "active" campaign status
  | 'amber'    // warning        — used for "paused" campaign status
  | 'red'      // destructive    — used for critical alerts, "down" deltas
  | 'gray';    // neutral        — used for "draft" campaign status

export type BadgeSize = 'sm' | 'md';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  /** Colour intent. @default "purple" */
  variant?: BadgeVariant;
  /** Size preset. @default "md" */
  size?: BadgeSize;
  /**
   * Renders a filled circle (status dot) before the label.
   * Colour matches the variant automatically.
   */
  withDot?: boolean;
  /** Node placed before the label — use for icons or trend arrows. */
  icon?: ReactNode;
}

// ─── Design tokens ────────────────────────────────────────────────────────────
// Sourced directly from LumindAd.jsx:
//   .badge            → padding, radius, font
//   .tag-up/down/neutral → background, color, border per semantic colour
//   statusColor/statusBg → green/amber/gray/purple mappings

interface VariantTokens {
  background: string;
  color:      string;
  border:     string;
  dotColor:   string;
}

const VARIANTS: Record<BadgeVariant, VariantTokens> = {
  purple: {
    background: 'rgba(124, 58, 237, 0.12)',
    color:      '#a78bfa',
    border:     '1px solid rgba(124, 58, 237, 0.25)',
    dotColor:   '#7c3aed',
  },
  cyan: {
    background: 'rgba(6, 182, 212, 0.15)',
    color:      '#06b6d4',
    border:     '1px solid rgba(6, 182, 212, 0.3)',
    dotColor:   '#06b6d4',
  },
  green: {
    // Matches statusBg('active') + statusColor('active') from LumindAd.jsx
    background: 'rgba(16, 185, 129, 0.12)',
    color:      '#10b981',
    border:     '1px solid rgba(16, 185, 129, 0.25)',
    dotColor:   '#10b981',
  },
  amber: {
    // Matches statusBg('paused') + statusColor('paused')
    background: 'rgba(245, 158, 11, 0.12)',
    color:      '#f59e0b',
    border:     '1px solid rgba(245, 158, 11, 0.25)',
    dotColor:   '#f59e0b',
  },
  red: {
    // Matches .tag-down
    background: 'rgba(239, 68, 68, 0.12)',
    color:      '#ef4444',
    border:     '1px solid rgba(239, 68, 68, 0.25)',
    dotColor:   '#ef4444',
  },
  gray: {
    // Matches statusBg('draft') + statusColor('draft')
    background: 'rgba(148, 163, 184, 0.12)',
    color:      '#94a3b8',
    border:     '1px solid rgba(148, 163, 184, 0.2)',
    dotColor:   '#94a3b8',
  },
};

interface SizeTokens {
  padding:       string;
  fontSize:      string;
  dotSize:       string;
  gap:           string;
  borderRadius:  string;
  letterSpacing: string;
}

const SIZES: Record<BadgeSize, SizeTokens> = {
  // .badge from LumindAd.jsx: padding 4px 12px, font-size 11px, font-weight 700
  sm: { padding: '2px 8px',   fontSize: '10px', dotSize: '6px', gap: '5px', borderRadius: '20px', letterSpacing: '0.4px' },
  md: { padding: '4px 12px',  fontSize: '11px', dotSize: '7px', gap: '6px', borderRadius: '20px', letterSpacing: '0.5px' },
};

// ─── Preset builders (convenience helpers) ───────────────────────────────────

/**
 * Returns the correct BadgeVariant for a campaign status string.
 * Mirrors the statusColor/statusBg helper functions in LumindAd.jsx.
 *
 * @example
 * <Badge variant={campaignStatusVariant(campaign.status)} withDot>
 *   {campaign.status.toUpperCase()}
 * </Badge>
 */
export function campaignStatusVariant(
  status: 'active' | 'paused' | 'draft' | 'completed' | string,
): BadgeVariant {
  const map: Record<string, BadgeVariant> = {
    active:    'green',
    paused:    'amber',
    draft:     'gray',
    completed: 'purple',
    training:  'amber',
    error:     'red',
    new:       'cyan',
  };
  return map[status.toLowerCase()] ?? 'gray';
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Compact label used to communicate status, category, or delta values.
 *
 * @example
 * // Campaign status chip
 * <Badge variant={campaignStatusVariant(campaign.status)} withDot>
 *   {campaign.status.toUpperCase()}
 * </Badge>
 *
 * @example
 * // KPI delta tag (mirrors .tag-up from LumindAd.jsx)
 * <Badge variant="green" icon="▲">+12.5%</Badge>
 *
 * @example
 * // Sidebar "NEW" label
 * <Badge variant="cyan" size="sm">NEW</Badge>
 */
export function Badge({
  variant = 'purple',
  size    = 'md',
  withDot = false,
  icon,
  children,
  style,
  ...rest
}: BadgeProps) {
  const v = VARIANTS[variant];
  const s = SIZES[size];

  const baseStyle: CSSProperties = {
    display:        'inline-flex',
    alignItems:     'center',
    gap:             s.gap,
    padding:         s.padding,
    borderRadius:    s.borderRadius,
    fontSize:        s.fontSize,
    fontWeight:      700,
    fontFamily:     "'Outfit', system-ui, sans-serif",
    letterSpacing:   s.letterSpacing,
    lineHeight:      1,
    whiteSpace:     'nowrap',
    background:      v.background,
    color:           v.color,
    border:          v.border,
    ...style,
  };

  return (
    <span style={baseStyle} {...rest}>
      {/* Status dot — aria-hidden, visual only */}
      {withDot && (
        <span
          aria-hidden="true"
          style={{
            width:        s.dotSize,
            height:       s.dotSize,
            borderRadius: '50%',
            background:   v.dotColor,
            flexShrink:   0,
            display:      'inline-block',
          }}
        />
      )}

      {/* Leading icon slot */}
      {icon && (
        <span aria-hidden="true" style={{ display: 'inline-flex', flexShrink: 0 }}>
          {icon}
        </span>
      )}

      {children}
    </span>
  );
}

Badge.displayName = 'Badge';

export default Badge;
