/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  LumindAd · Layout · Public API
 *  src/components/layout/index.ts
 *
 *  Import any layout component from this single path:
 *
 *    import { Sidebar, Header, Footer, PageWrapper } from '@/components/layout';
 *
 *  Note: AppLayout is consumed only by App.tsx via a direct import:
 *    import AppLayout from '@/components/layout/AppLayout';
 *  It is still re-exported here for completeness and testability.
 *
 *  Author : Elizabeth Díaz Familia
 *           AI Data Scientist · Sustainable Intelligence & BI
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

// ─── AppLayout ────────────────────────────────────────────────────────────────
// Full authenticated shell: Sidebar + TopBar + scrollable main + Footer.
// Used as a route element wrapper in App.tsx.
export { default as AppLayout } from './AppLayout';

// ─── Sidebar ──────────────────────────────────────────────────────────────────
// Fixed left navigation: logo · NavLinks · AI Engine badge · Green AI · user
export { Sidebar }              from './Sidebar';

// ─── Header ───────────────────────────────────────────────────────────────────
// Page-level heading block: gradient h1 · subtitle · actions slot
export { Header }               from './Header';
export type { HeaderProps }     from './Header';

// ─── Footer ───────────────────────────────────────────────────────────────────
// Application footer: copyright · bouncing social icons · meta badges
export { Footer }               from './Footer';

// ─── PageWrapper ──────────────────────────────────────────────────────────────
// Animated <main> landmark: float-in entrance · consistent padding · skip target
export { PageWrapper }          from './PageWrapper';
export type { PageWrapperProps } from './PageWrapper';
