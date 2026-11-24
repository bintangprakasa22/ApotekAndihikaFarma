import React, { memo } from 'react';
import { motion, useReducedMotion } from 'motion/react';

interface MotionCardProps {
  children: React.ReactNode;
  className?: string;
  index?: number;
  hoverLift?: boolean;
  as?: 'div' | 'button';
  type?: 'button' | 'submit' | 'reset';
  onClick?: () => void;
}

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

export const MotionCard = memo(function MotionCard({
  children,
  className = '',
  index = 0,
  hoverLift = true,
  as = 'div',
  type = 'button',
  onClick,
}: MotionCardProps) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    if (as === 'button') {
      return (
        <button
          type={type}
          onClick={onClick}
          className={`group print-reset transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40 ${className}`}
        >
          {children}
        </button>
      );
    }

    return (
      <div onClick={onClick} className={`print-reset transition-colors duration-150 ${className}`}>
        {children}
      </div>
    );
  }

  const delay = Math.min(index, 5) * 0.035;
  const hoverAnimation = hoverLift
    ? { y: -2.5, transition: { duration: 0.16, ease: EASE_OUT_EXPO } }
    : undefined;

  const baseMotionProps = {
    initial: { opacity: 0, y: 12 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 'some' as const },
    transition: { duration: 0.28, delay, ease: EASE_OUT_EXPO },
    whileHover: hoverAnimation,
  };

  if (as === 'button') {
    return (
      <motion.button
        type={type}
        onClick={onClick}
        whileTap={{ scale: 0.985, transition: { duration: 0.08 } }}
        {...baseMotionProps}
        className={`group print-reset transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40 ${className}`}
      >
        {children}
      </motion.button>
    );
  }

  return (
    <motion.div
      onClick={onClick}
      {...baseMotionProps}
      className={`print-reset transition-colors duration-150 ${className}`}
    >
      {children}
    </motion.div>
  );
});
