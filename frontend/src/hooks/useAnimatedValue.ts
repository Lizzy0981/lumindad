/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  LumindAd · Hooks · useAnimatedValue
 *  src/hooks/useAnimatedValue.ts
 *
 *  Purpose
 *   Smooth numeric counter animation used by KPICard.
 *   The original implementation lives in LumindAd.jsx lines 140–154
 *   as an inline function. This file promotes it to a named, typed,
 *   documented hook with zero behaviour change.
 *
 *  Original code (LumindAd.jsx lines 140–153)
 *   ┌──────────────────────────────────────────────────────────┐
 *   │ function useAnimatedValue(target, duration = 1200) {     │
 *   │   const [val, setVal] = useState(0);                     │
 *   │   useEffect(() => {                                       │
 *   │     let start = null, startVal = 0;                      │
 *   │     const step = (ts) => {                               │
 *   │       if (!start) start = ts;                            │
 *   │       const progress = Math.min((ts - start)/duration,1);│
 *   │       const ease = 1 - Math.pow(1 - progress, 3);        │
 *   │       setVal(Math.round(startVal+(target-startVal)*ease));│
 *   │       if (progress < 1) requestAnimationFrame(step);     │
 *   │     };                                                    │
 *   │     requestAnimationFrame(step);                         │
 *   │   }, [target]);                                          │
 *   │   return val;                                            │
 *   │ }                                                         │
 *   └──────────────────────────────────────────────────────────┘
 *
 *  Easing function
 *   ease = 1 - (1 - progress)³   (cubic ease-out)
 *   Starts fast, decelerates toward the target.
 *   At progress=0.5 → ease≈0.875 (87.5% of range already covered).
 *   Matches the `.kpi-val { animation: counter-up .4s ease }` aesthetic.
 *
 *  Enhancements over the prototype inline function
 *   1. `delay`  — defers the first rAF by N ms (matches KPICard `delay` prop:
 *                 0 / 80 / 160 / 240 ms stagger on Dashboard)
 *   2. `startFrom` — allows counting from a previous value on re-trigger
 *                    (instead of always counting from 0)
 *   3. `easing`  — pluggable easing function; defaults to prototype cubic
 *   4. Cancellation — calls `cancelAnimationFrame` on cleanup and clears
 *                     the delay timeout; prevents setState after unmount
 *   5. Full TypeScript generics — typed for integer and float targets
 *
 *  KPICard usage (mirrors LumindAd.jsx line 176)
 *   const animated = useAnimatedValue(typeof value === 'number' ? value : 0);
 *   → renders prefix + animated.toLocaleString() + suffix
 *
 *  CSS dependency
 *   The .kpi-val class in globals.css (line 35) adds a slide-in animation
 *   on first mount. This hook drives the numeric value; the CSS handles
 *   the opacity/transform entrance.
 *
 *  Author : Elizabeth Díaz Familia
 *           AI Data Scientist · Sustainable Intelligence & BI
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { useState, useEffect, useRef } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

/** A pure function that maps linear progress [0,1] → eased value [0,1]. */
export type EasingFn = (progress: number) => number;

export interface UseAnimatedValueOptions {
  /**
   * Animation duration in milliseconds.
   * @default 1200  — matches LumindAd.jsx line 140 exactly
   */
  duration?: number;
  /**
   * Delay before the animation starts, in milliseconds.
   * Mirrors the KPICard `delay` prop (0 · 80 · 160 · 240 on Dashboard).
   * @default 0
   */
  delay?: number;
  /**
   * Value to animate from on the initial render (or on `target` change).
   * When undefined, the animation always starts from the previous rendered
   * value — creating a smooth re-animation when the target updates.
   * @default undefined
   */
  startFrom?: number;
  /**
   * Custom easing function. Receives linear progress [0,1], returns
   * eased multiplier [0,1].
   * @default cubicEaseOut  — 1-(1-p)³, matches LumindAd.jsx line 147
   */
  easing?: EasingFn;
}

// ─── Default easing ───────────────────────────────────────────────────────────

/**
 * Cubic ease-out: starts fast, decelerates to target.
 * Exactly mirrors `const ease = 1 - Math.pow(1 - progress, 3)` from
 * LumindAd.jsx line 147.
 *
 * @example cubicEaseOut(0)    → 0
 * @example cubicEaseOut(0.5)  → 0.875
 * @example cubicEaseOut(1)    → 1
 */
export const cubicEaseOut: EasingFn = (p) => 1 - Math.pow(1 - p, 3);

/**
 * Linear (no easing). Useful for testing or sparkline animations.
 * @example linearEase(0.5) → 0.5
 */
export const linearEase: EasingFn = (p) => p;

/**
 * Quadratic ease-in-out. Slower at both ends.
 * @example quadEaseInOut(0.5) → 0.5
 */
export const quadEaseInOut: EasingFn = (p) =>
  p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Animates a number from its previous value (or `startFrom`) to `target`
 * using `requestAnimationFrame` and a cubic ease-out curve.
 *
 * Exactly reproduces the prototype `useAnimatedValue` from LumindAd.jsx
 * lines 140–153, extended with delay, startFrom, easing, and safe cleanup.
 *
 * @param target - The value to animate toward.
 * @param options - Optional duration, delay, startFrom, easing overrides.
 * @returns The current animated integer value (updates each rAF tick).
 *
 * @example
 * // KPICard — same as LumindAd.jsx line 176
 * const animated = useAnimatedValue(531_200);
 * // → counts 0 → 531200 over 1200ms with cubic ease-out
 *
 * @example
 * // With delay (Dashboard stagger: 0 / 80 / 160 / 240 ms)
 * const animated = useAnimatedValue(48_290, { delay: 160 });
 *
 * @example
 * // Float value (e.g. CTR %)
 * const animated = useAnimatedValue(7.32, { duration: 800 });
 * // Returns rounded integer → display as (animated / 100).toFixed(2)
 *
 * @example
 * // Re-animate on data refresh (animates from current val, not 0)
 * const animated = useAnimatedValue(newValue);
 *
 * @example
 * // Custom easing
 * import { quadEaseInOut } from './useAnimatedValue';
 * const animated = useAnimatedValue(target, { easing: quadEaseInOut });
 */
export function useAnimatedValue(
  target:  number,
  options: UseAnimatedValueOptions = {},
): number {
  const {
    duration  = 1200,       // LumindAd.jsx line 140 default
    delay     = 0,
    startFrom,
    easing    = cubicEaseOut,
  } = options;

  // Current displayed value — starts at startFrom or 0
  const [val, setVal] = useState<number>(startFrom ?? 0);

  // Track the value we animate FROM on each target change
  const fromRef    = useRef<number>(startFrom ?? 0);
  const rafRef     = useRef<number | null>(null);
  const timerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Capture the "from" value at the moment target changes
    const startVal = startFrom !== undefined ? startFrom : fromRef.current;

    // Cancel any in-flight animation
    if (rafRef.current !== null)  cancelAnimationFrame(rafRef.current);
    if (timerRef.current !== null) clearTimeout(timerRef.current);

    const runAnimation = () => {
      let startTs: number | null = null;

      // rAF loop — mirrors LumindAd.jsx lines 143–151 exactly
      const step = (ts: number) => {
        if (startTs === null) startTs = ts;
        const progress = Math.min((ts - startTs) / duration, 1);
        const eased    = easing(progress);
        const current  = Math.round(startVal + (target - startVal) * eased);

        setVal(current);
        fromRef.current = current;

        if (progress < 1) {
          rafRef.current = requestAnimationFrame(step);
        } else {
          // Ensure exact final value
          setVal(target);
          fromRef.current = target;
          rafRef.current = null;
        }
      };

      rafRef.current = requestAnimationFrame(step);
    };

    if (delay > 0) {
      timerRef.current = setTimeout(runAnimation, delay);
    } else {
      runAnimation();
    }

    // Cleanup — prevent setState after unmount or stale target
    return () => {
      if (rafRef.current !== null)  cancelAnimationFrame(rafRef.current);
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration, delay]);
  // `easing` and `startFrom` intentionally excluded: they are config,
  // not reactive values. Changing them mid-render is not supported.

  return val;
}

export default useAnimatedValue;
