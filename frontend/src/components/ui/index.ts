/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  LumindAd · Design System · Public API
 *  src/components/ui/index.ts
 *
 *  Central barrel file — import any UI primitive from this path:
 *
 *    import { Button, Badge, ProgressBar } from '@/components/ui';
 *
 *  Never import from individual files in production code.
 *  This barrel is the single public API of the design system
 *  and allows internal file structure to change without breaking
 *  consumer imports.
 *
 *  Author : Elizabeth Díaz Familia
 *           AI Data Scientist · Sustainable Intelligence & BI
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

// ─── Button ───────────────────────────────────────────────────────────────────
export { Button }            from './Button';
export type { ButtonProps, ButtonVariant, ButtonSize } from './Button';

// ─── Card ─────────────────────────────────────────────────────────────────────
export { Card }              from './Card';
export type { CardProps, CardVariant, CardPadding } from './Card';

// ─── Badge ────────────────────────────────────────────────────────────────────
export { Badge, campaignStatusVariant } from './Badge';
export type { BadgeProps, BadgeVariant, BadgeSize } from './Badge';

// ─── ProgressBar ──────────────────────────────────────────────────────────────
export { ProgressBar }       from './ProgressBar';
export type { ProgressBarProps, ProgressVariant, ProgressSize } from './ProgressBar';

// ─── Tooltip ──────────────────────────────────────────────────────────────────
export { Tooltip }           from './Tooltip';
export type { TooltipProps, TooltipPosition } from './Tooltip';

// ─── Modal ────────────────────────────────────────────────────────────────────
export { Modal }             from './Modal';
export type { ModalProps, ModalSize } from './Modal';
