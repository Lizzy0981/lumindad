/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  LumindAd · Layout · PageWrapper
 *  src/components/layout/PageWrapper.tsx
 *
 *  Purpose
 *   Wraps every page's content in a standardised container that:
 *   1. Applies the float-in entrance animation on each navigation
 *   2. Enforces consistent max-width and horizontal centering
 *   3. Provides the semantic <main> landmark for skip-link targets
 *
 *  The float-in animation
 *   Defined in globals.css as `.page-enter`:
 *     @keyframes float-in {
 *       from { opacity: 0; transform: translateY(20px); }
 *       to   { opacity: 1; transform: translateY(0);    }
 *     }
 *     .page-enter { animation: float-in 0.35s ease forwards; }
 *
 *   Because React Router replaces the page component on navigation,
 *   each new page mount triggers a fresh animation — no explicit
 *   key management or animation library is needed.
 *
 *   The scoped keyframe defined here (lad-float-in) mirrors float-in
 *   exactly and serves as a self-contained fallback. Both can coexist.
 *
 *  Re-triggering on navigation
 *   The `key` prop on this component must be set to the current
 *   pathname by AppLayout so React unmounts and remounts it on each
 *   route change:
 *
 *     <PageWrapper key={location.pathname}>
 *       <Outlet />
 *     </PageWrapper>
 *
 *   Without the key, the same PageWrapper instance is reused across
 *   navigations and the animation only runs once on the initial load.
 *
 *  prefers-reduced-motion
 *   When the user has enabled reduced motion in their OS settings,
 *   the entrance animation is suppressed via a CSS media query in the
 *   scoped <style> block. The content still appears; it just skips
 *   the translateY transition.
 *
 *  Accessibility (WCAG 2.1 AA)
 *   – The wrapper renders a <main> element — the primary page landmark
 *   – id="main-content" enables the skip-link in AppLayout to work:
 *       <a href="#main-content">Skip to main content</a>
 *   – aria-label is set to the page title if provided, improving
 *     screen reader announcements when navigating between pages
 *   – No role override is needed — <main> carries implicit role="main"
 *
 *  Author : Elizabeth Díaz Familia
 *           AI Data Scientist · Sustainable Intelligence & BI
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { type ReactNode, type CSSProperties } from 'react';

// ─── Public API ───────────────────────────────────────────────────────────────

export interface PageWrapperProps {
  /** Page content — typically an entire page component's JSX tree. */
  children: ReactNode;
  /**
   * Accessible label for the <main> landmark.
   * Should match the current page's <h1> title.
   * @example "Performance Dashboard"
   */
  ariaLabel?: string;
  /**
   * When false, the float-in entrance animation is disabled.
   * Useful for pages that manage their own animation (e.g. the 404 page).
   * @default true
   */
  animate?: boolean;
  /**
   * Additional inline styles merged into the <main> element.
   * Use sparingly — prefer padding/margin adjustments over structural overrides.
   */
  style?: CSSProperties;
}

// ─── Scoped keyframes ─────────────────────────────────────────────────────────

const KEYFRAMES = `
  @keyframes lad-float-in {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0);    }
  }
  @media (prefers-reduced-motion: reduce) {
    .lad-page-wrapper { animation: none !important; opacity: 1 !important; }
  }
`;

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Animated page content wrapper. Wrap every page component's root with this.
 *
 * The key prop must be set to the current pathname by the parent (AppLayout)
 * to ensure the animation re-triggers on every navigation.
 *
 * @example
 * // AppLayout.tsx — key re-mounts wrapper on route change
 * const { pathname } = useLocation();
 *
 * <PageWrapper key={pathname} ariaLabel={currentPageTitle}>
 *   <Outlet />
 * </PageWrapper>
 *
 * @example
 * // Alternatively, each page wraps its own content
 * export default function DashboardPage() {
 *   return (
 *     <PageWrapper ariaLabel="Performance Dashboard">
 *       <Header title="Performance Dashboard" … />
 *       …
 *     </PageWrapper>
 *   );
 * }
 */
export function PageWrapper({
  children,
  ariaLabel,
  animate = true,
  style,
}: PageWrapperProps) {
  return (
    <>
      <style>{KEYFRAMES}</style>

      <main
        id="main-content"
        aria-label={ariaLabel}
        className={animate ? 'lad-page-wrapper' : undefined}
        style={{
          // Entrance animation — matches .page-enter in LumindAd.jsx globals
          animation:    animate ? 'lad-float-in 0.35s ease forwards' : 'none',
          // Content is invisible until animation begins (prevents flash)
          opacity:      animate ? 0 : 1,
          // Merge consumer overrides last
          ...style,
        }}
      >
        {children}
      </main>
    </>
  );
}

PageWrapper.displayName = 'PageWrapper';

export default PageWrapper;
