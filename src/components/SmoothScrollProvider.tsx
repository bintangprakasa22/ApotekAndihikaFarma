import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.config({ ignoreMobileResize: true });

interface SmoothScrollContextValue {
  scrollToTop: (immediate?: boolean) => void;
  refreshScrollTriggers: () => void;
}

const SmoothScrollContext = createContext<SmoothScrollContextValue>({
  scrollToTop: () => window.scrollTo({ top: 0 }),
  refreshScrollTriggers: () => {
    if (ScrollTrigger.getAll().length > 0) {
      ScrollTrigger.refresh();
    }
  },
});

export function SmoothScrollProvider({ children }: { children: React.ReactNode }) {
  const lenisRef = useRef<Lenis | null>(null);
  const refreshTimerRef = useRef<number | null>(null);
  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let lenis: Lenis | null = null;
    let unsubscribeScroll: (() => void) | null = null;
    let tickFn: ((time: number) => void) | null = null;

    const teardown = () => {
      if (tickFn) {
        gsap.ticker.remove(tickFn);
        tickFn = null;
      }
      if (unsubscribeScroll) {
        unsubscribeScroll();
        unsubscribeScroll = null;
      }
      if (lenis) {
        lenis.destroy();
        lenis = null;
      }
      lenisRef.current = null;
      gsap.ticker.lagSmoothing(500, 33);
    };

    const setup = () => {
      teardown();
      if (mediaQuery.matches) return;

      lenis = new Lenis({
        duration: 0.9,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
        touchMultiplier: 1.4,
      });

      lenisRef.current = lenis;
      unsubscribeScroll = lenis.on('scroll', ScrollTrigger.update);

      tickFn = (time: number) => {
        lenis?.raf(time * 1000);
      };

      gsap.ticker.add(tickFn);
      gsap.ticker.lagSmoothing(0);
    };

    setup();

    const handleMotionChange = () => {
      setup();
    };

    mediaQuery.addEventListener('change', handleMotionChange);

    return () => {
      mediaQuery.removeEventListener('change', handleMotionChange);
      if (refreshTimerRef.current !== null) {
        window.clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      if (rafIdRef.current !== null) {
        window.cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      teardown();
    };
  }, []);

  const scrollToTop = useCallback((immediate = false) => {
    if (lenisRef.current) {
      lenisRef.current.scrollTo(0, { immediate });
    } else {
      window.scrollTo({ top: 0, behavior: immediate ? 'auto' : 'smooth' });
    }
  }, []);

  const refreshScrollTriggers = useCallback(() => {
    if (refreshTimerRef.current !== null) {
      window.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    if (rafIdRef.current !== null) {
      window.cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    refreshTimerRef.current = window.setTimeout(() => {
      refreshTimerRef.current = null;
      rafIdRef.current = window.requestAnimationFrame(() => {
        rafIdRef.current = null;
        lenisRef.current?.resize();
        if (ScrollTrigger.getAll().length > 0) {
          ScrollTrigger.refresh();
        }
      });
    }, 80);
  }, []);

  const value = useMemo<SmoothScrollContextValue>(
    () => ({ scrollToTop, refreshScrollTriggers }),
    [scrollToTop, refreshScrollTriggers],
  );

  return <SmoothScrollContext.Provider value={value}>{children}</SmoothScrollContext.Provider>;
}

export function useSmoothScroll() {
  return useContext(SmoothScrollContext);
}
