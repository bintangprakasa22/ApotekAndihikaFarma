import React, { memo, useMemo, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(ScrollTrigger, useGSAP);

interface AnimatedHeadingProps {
  text: string;
  as?: 'h1' | 'h2' | 'h3';
  className?: string;
  delay?: number;
  stagger?: number;
}

export const AnimatedHeading = memo(function AnimatedHeading({
  text,
  as = 'h2',
  className = '',
  delay = 0,
  stagger = 0.04,
}: AnimatedHeadingProps) {
  const containerRef = useRef<HTMLHeadingElement>(null);
  const words = useMemo(() => text.trim().split(/\s+/).filter(Boolean), [text]);

  useGSAP(
    () => {
      const el = containerRef.current;
      if (!el) return;

      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const wordEls = gsap.utils.toArray<HTMLElement>('.gsap-reveal-word', el);
        if (wordEls.length === 0) return;

        const rect = el.getBoundingClientRect();
        const inInitialViewport = rect.top < window.innerHeight * 0.94;

        gsap.fromTo(
          wordEls,
          { yPercent: 100, opacity: 0 },
          {
            yPercent: 0,
            opacity: 1,
            duration: 0.48,
            delay,
            stagger,
            ease: 'power3.out',
            force3D: true,
            clearProps: 'transform,opacity',
            ...(inInitialViewport
              ? {}
              : {
                  scrollTrigger: {
                    trigger: el,
                    start: 'top 98%',
                    once: true,
                    invalidateOnRefresh: true,
                  },
                }),
          },
        );
      });
    },
    { scope: containerRef, dependencies: [text, delay, stagger], revertOnUpdate: true },
  );

  const Tag = as;

  return (
    <Tag ref={containerRef} className={className}>
      {words.map((word, idx) => (
        <React.Fragment key={`${word}-${idx}`}>
          <span className="inline-block overflow-hidden align-bottom">
            <span className="gsap-reveal-word inline-block">{word}</span>
          </span>
          {idx < words.length - 1 ? ' ' : ''}
        </React.Fragment>
      ))}
    </Tag>
  );
});
