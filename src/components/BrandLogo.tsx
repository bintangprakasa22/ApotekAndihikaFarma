import React, { useState } from 'react';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASSES: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'w-9 h-9 p-0.5 rounded-lg',
  md: 'w-11 h-11 p-0.5 rounded-xl',
  lg: 'w-20 h-20 p-1 rounded-2xl',
};

export function BrandLogo({ size = 'md', className = '' }: BrandLogoProps) {
  const [imgError, setImgError] = useState(false);

  return (
    <div
      className={`bg-white border border-slate-200 flex items-center justify-center overflow-hidden shrink-0 ${SIZE_CLASSES[size]} ${className}`}
    >
      {!imgError ? (
        <img
          src="/assets/aistudio/apt_andhika_f52075c8.png"
          alt="Logo Apotek Andhika Farma"
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className="w-full h-full object-contain"
        />
      ) : (
        <span className="font-bold text-amber-600 text-sm tracking-tight">AF</span>
      )}
    </div>
  );
}
