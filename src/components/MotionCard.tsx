import React from 'react';
import { motion } from 'motion/react';

interface MotionCardProps {
  children: React.ReactNode;
  className?: string;
  index?: number;
  hoverLift?: boolean;
  as?: 'div' | 'button';
  type?: 'button' | 'submit' | 'reset';
  onClick?: () => void;
}

export function MotionCard({
  children,
  className = '',
  index = 0,
  hoverLift = true,
  as = 'div',
  type = 'button',
  onClick,
}: MotionCardProps) {
  const delay = Math.min(index, 6) * 0.045;
  const hoverAnimation = hoverLift
    ? { y: -3, transition: { duration: 0.18, ease: [0.16, 1, 0.3, 1] as const } }
    : undefined;

  const baseMotionProps = {
    initial: { opacity: 0, y: 16 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.08 },
    transition: { duration: 0.36, delay, ease: [0.16, 1, 0.3, 1] as const },
    whileHover: hoverAnimation,
  };

  if (as === 'button') {
    return (
      <motion.button
        type={type}
        onClick={onClick}
        whileTap={{ scale: 0.985 }}
        {...baseMotionProps}
        className={`transition-[border-color,box-shadow] duration-200 hover:shadow-md ${className}`}
      >
        {children}
      </motion.button>
    );
  }

  return (
    <motion.div
      onClick={onClick}
      {...baseMotionProps}
      className={`transition-[border-color,box-shadow] duration-200 hover:shadow-sm ${className}`}
    >
      {children}
    </motion.div>
  );
}
