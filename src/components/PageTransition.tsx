import React, { useCallback } from 'react';
import { motion, useReducedMotion } from 'motion/react';

const TRANSITION_EASE = [0.22, 1, 0.36, 1] as const;

interface PageTransitionProps {
  children: React.ReactNode;
  onEnterComplete?: () => void;
  className?: string;
}

export function PageTransition({
  children,
  onEnterComplete,
  className = 'w-full',
}: PageTransitionProps) {
  const shouldReduceMotion = useReducedMotion();

  const handleAnimationComplete = useCallback(
    (definition: unknown) => {
      if (
        typeof definition === 'object' &&
        definition !== null &&
        'opacity' in definition &&
        (definition as { opacity?: unknown }).opacity === 1
      ) {
        onEnterComplete?.();
      }
    },
    [onEnterComplete],
  );

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={`print-reset ${className}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{
        opacity: 1,
        y: 0,
        transition: {
          opacity: { duration: 0.2, ease: TRANSITION_EASE },
          y: { duration: 0.24, ease: TRANSITION_EASE },
        },
      }}
      exit={{
        opacity: 0,
        y: -6,
        transition: {
          opacity: { duration: 0.12, ease: 'easeIn' },
          y: { duration: 0.12, ease: 'easeIn' },
        },
      }}
      onAnimationComplete={handleAnimationComplete}
    >
      {children}
    </motion.div>
  );
}
