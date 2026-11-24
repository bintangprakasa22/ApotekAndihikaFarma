import React, { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

interface AnimatedHeadingProps {
  text: string;
  as?: 'h1' | 'h2' | 'h3';
  className?: string;
  delay?: number;
  stagger?: number;
}

export function AnimatedHeading({
  text,
  as = 'h2',
  className = '',
  delay = 0,
  stagger = 0.045,
}: AnimatedHeadingProps) {
  const containerRef = useRef<HTMLHeadingElement>(null);
  const words = text.trim().split(/\s+/).filter(Boolean);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const ctx = gsap.context(() => {
      const wordEls = el.querySelectorAll('.gsap-reveal-word');
      if (wordEls.length === 0) return;

      gsap.fromTo(
        wordEls,
        { yPercent: 105, opacity: 0 },
        {
          yPercent: 0,
          opacity: 1,
          duration: 0.52,
          delay,
          stagger,
          ease: 'power3.out',
          clearProps: 'transform,opacity',
          scrollTrigger: {
            trigger: el,
            start: 'top 92%',
            once: true,
          },
        },
      );
    }, containerRef);

    return () => ctx.revert();
  }, [text, delay, stagger]);

  const Tag = as;

  return (
    <Tag ref={containerRef} className={className}>
      {words.map((word, idx) => (
        <React.Fragment key={`${word}-${idx}`}>
          <span className="inline-block overflow-hidden align-bottom">
            <span className="gsap-reveal-word inline-block will-change-transform">{word}</span>
          </span>
          {idx < words.length - 1 ? ' ' : ''}
        </React.Fragment>
      ))}
    </Tag>
  );
}
