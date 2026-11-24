import React, { useEffect } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

interface MotionModalProps {
  open: boolean;
  onClose: () => void;
  maxWidthClass?: string;
  children: React.ReactNode;
}

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

export function MotionModal({
  open,
  onClose,
  maxWidthClass = 'max-w-md',
  children,
}: MotionModalProps) {
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (shouldReduceMotion) {
    if (!open) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40">
        <div
          data-lenis-prevent
          className={`bg-white border border-slate-200 rounded-xl w-full ${maxWidthClass} max-h-[90vh] overflow-y-auto shadow-xl`}
        >
          {children}
        </div>
      </div>
    );
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: 0.15, ease: 'easeOut' } }}
          exit={{ opacity: 0, transition: { duration: 0.12, ease: 'easeIn' } }}
        >
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-[1px]"
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            data-lenis-prevent
            role="dialog"
            aria-modal="true"
            className={`relative z-10 bg-white border border-slate-200 rounded-xl w-full ${maxWidthClass} max-h-[90vh] overflow-y-auto shadow-xl`}
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
              transition: { duration: 0.18, ease: EASE_OUT },
            }}
            exit={{
              opacity: 0,
              scale: 0.97,
              y: 4,
              transition: { duration: 0.12, ease: 'easeIn' },
            }}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
