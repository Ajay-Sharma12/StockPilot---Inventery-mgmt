import React from 'react';
import { cn } from '../../utils/cn';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  glass?: boolean;
}

export const Card: React.FC<CardProps> = ({ className, glass = false, children, ...props }) => {
  // Normalize raw dark background and border utilities (e.g. bg-slate-900/60, border-slate-800)
  // so that twMerge doesn't discard light mode defaults (bg-white, border-slate-200)
  const normalizedClass = className
    ? className
        .split(/\s+/)
        .map((cls) => {
          if (!cls) return cls;
          if ((cls.startsWith('bg-slate-9') || cls.startsWith('bg-slate-8')) && !cls.includes(':')) {
            return `bg-white dark:${cls}`;
          }
          if ((cls.startsWith('border-slate-8') || cls.startsWith('border-slate-7') || cls.startsWith('border-slate-9')) && !cls.includes(':')) {
            return `border-slate-200 dark:${cls}`;
          }
          return cls;
        })
        .join(' ')
    : className;

  return (
    <div
      className={cn(
        'rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-6 shadow-xl transition-all',
        glass && 'glass-panel',
        normalizedClass
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, children, ...props }) => {
  const normalizedClass = className
    ? className
        .split(/\s+/)
        .map((cls) => {
          if (!cls) return cls;
          if ((cls.startsWith('border-slate-8') || cls.startsWith('border-slate-7') || cls.startsWith('border-slate-9')) && !cls.includes(':')) {
            return `border-slate-100 dark:${cls}`;
          }
          return cls;
        })
        .join(' ')
    : className;

  return (
    <div className={cn('flex flex-col space-y-1.5 pb-4 border-b border-slate-100 dark:border-slate-800/80 mb-5', normalizedClass)} {...props}>
      {children}
    </div>
  );
};

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({ className, children, ...props }) => {
  return (
    <h3 className={cn('text-lg font-semibold leading-none tracking-tight text-slate-900 dark:text-white', className)} {...props}>
      {children}
    </h3>
  );
};

export const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({ className, children, ...props }) => {
  return (
    <p className={cn('text-xs text-slate-500 dark:text-slate-400', className)} {...props}>
      {children}
    </p>
  );
};

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, children, ...props }) => {
  return (
    <div className={cn('pt-0', className)} {...props}>
      {children}
    </div>
  );
};

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, children, ...props }) => {
  return (
    <div className={cn('flex items-center pt-4 border-t border-slate-100 dark:border-slate-800/80 mt-5', className)} {...props}>
      {children}
    </div>
  );
};
