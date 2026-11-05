import React from 'react';
import { PackageOpen } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className,
}) => {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-12 text-center rounded-xl border border-dashed border-slate-800 bg-slate-900/30',
        className
      )}
    >
      <div className="p-3 mb-4 rounded-full bg-slate-800/80 text-slate-400">
        {icon || <PackageOpen className="w-8 h-8" />}
      </div>
      <h4 className="text-base font-semibold text-slate-200">{title}</h4>
      {description && <p className="text-xs text-slate-400 max-w-sm mt-1 mb-6 leading-relaxed">{description}</p>}
      {action && <div>{action}</div>}
    </div>
  );
};
