import React from 'react';
import { motion, useReducedMotion } from 'motion/react';

export interface SegmentedTabItem<T extends string> {
  key: T;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface SegmentedTabsProps<T extends string> {
  items: SegmentedTabItem<T>[];
  activeKey: T;
  onChange: (key: T) => void;
  layoutId: string;
  className?: string;
  itemClassName?: string;
}

export function SegmentedTabs<T extends string>({
  items,
  activeKey,
  onChange,
  layoutId,
  className = '',
  itemClassName = 'rounded-md',
}: SegmentedTabsProps<T>) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div
      className={`flex flex-wrap items-center gap-1 bg-white border border-slate-200 rounded-lg p-1 ${className}`}
    >
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = activeKey === item.key;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onChange(item.key)}
            className={`relative px-3 py-1.5 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${itemClassName} ${
              isActive ? 'text-white' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            {isActive &&
              (shouldReduceMotion ? (
                <span className={`absolute inset-0 bg-sky-600 ${itemClassName}`} />
              ) : (
                <motion.span
                  layoutId={layoutId}
                  transition={{ type: 'spring', stiffness: 500, damping: 38, mass: 0.7 }}
                  className={`absolute inset-0 bg-sky-600 ${itemClassName}`}
                />
              ))}
            <span className="relative z-10 flex items-center gap-1.5">
              {Icon && <Icon className="w-3.5 h-3.5" />}
              <span>{item.label}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
