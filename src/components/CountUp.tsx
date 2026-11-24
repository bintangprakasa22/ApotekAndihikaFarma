import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { animate, useReducedMotion } from 'motion/react';
import { formatNumber } from '../lib/format';

interface CountUpProps {
  value: number;
  decimals?: number;
  duration?: number;
  delay?: number;
  className?: string;
}

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

/**
 * Animates a numeric statistic smoothly from 0 (or its previous value)
 * to the exact API/database value via direct DOM text updates so React
 * never re-renders on animation frames.
 */
export const CountUp = React.memo(function CountUp({
  value,
  decimals = 0,
  duration = 0.75,
  delay = 0,
  className = '',
}: CountUpProps) {
  const shouldReduceMotion = useReducedMotion();
  const displayRef = useRef<HTMLSpanElement>(null);
  const currentDisplayedRef = useRef<number>(0);
  const completedTargetRef = useRef<number | null>(null);

  const safeTarget = Number.isFinite(value) ? value : 0;
  const formattedTarget = formatNumber(safeTarget, decimals);

  useLayoutEffect(() => {
    const el = displayRef.current;
    if (!el) return;

    if (shouldReduceMotion || (completedTargetRef.current === null && safeTarget === 0)) {
      el.textContent = formattedTarget;
      currentDisplayedRef.current = safeTarget;
      completedTargetRef.current = safeTarget;
    } else if (completedTargetRef.current === null && !el.textContent) {
      el.textContent = formatNumber(0, decimals);
      currentDisplayedRef.current = 0;
    }
  }, [shouldReduceMotion, safeTarget, decimals, formattedTarget]);

  useEffect(() => {
    const el = displayRef.current;
    if (!el) return;

    if (shouldReduceMotion) {
      el.textContent = formattedTarget;
      currentDisplayedRef.current = safeTarget;
      completedTargetRef.current = safeTarget;
      return;
    }

    if (completedTargetRef.current === safeTarget) {
      return;
    }

    const fromValue = currentDisplayedRef.current;

    if (fromValue === safeTarget) {
      el.textContent = formattedTarget;
      currentDisplayedRef.current = safeTarget;
      completedTargetRef.current = safeTarget;
      return;
    }

    const effectiveDelay = completedTargetRef.current === null ? delay : 0;
    const effectiveDuration = completedTargetRef.current === null ? duration : Math.min(duration, 0.45);
    const factor = decimals > 0 ? Math.pow(10, decimals) : 1;

    const controls = animate(fromValue, safeTarget, {
      duration: effectiveDuration,
      delay: effectiveDelay,
      ease: EASE_OUT_EXPO,
      onUpdate: (latest) => {
        const rounded = decimals === 0 ? Math.round(latest) : Math.round(latest * factor) / factor;
        if (rounded !== currentDisplayedRef.current) {
          currentDisplayedRef.current = rounded;
          el.textContent = formatNumber(rounded, decimals);
        }
      },
      onComplete: () => {
        currentDisplayedRef.current = safeTarget;
        completedTargetRef.current = safeTarget;
        el.textContent = formattedTarget;
      },
    });

    return () => {
      controls.stop();
    };
  }, [safeTarget, decimals, duration, delay, shouldReduceMotion, formattedTarget]);

  return (
    <span className={`inline-block tabular-nums ${className}`}>
      <span ref={displayRef} aria-hidden="true" />
      <span className="sr-only">{formattedTarget}</span>
    </span>
  );
});
