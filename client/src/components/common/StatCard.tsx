import React from 'react';
import { Card } from '../ui/Card';
import { cn } from '../../utils/cn';

export interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  change?: string;
  isPositive?: boolean;
  icon: React.ReactNode;
  iconBgColor?: string;
  iconColor?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  change,
  isPositive,
  icon,
  iconBgColor = 'bg-emerald-500/10',
  iconColor = 'text-emerald-500 dark:text-emerald-400',
}) => {
  return (
    <Card className="hover:border-slate-300 dark:hover:border-slate-700/80 transition-all duration-200 p-5 shadow-lg flex flex-col justify-between min-h-[110px]">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1.5 min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
            {title}
          </p>
          <p className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white truncate">
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
              {subtitle}
            </p>
          )}
          {change && (
            <p
              className={cn(
                'text-xs font-medium flex items-center gap-1 pt-1',
                isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              )}
            >
              <span>{isPositive ? '↑' : '↓'}</span>
              <span>{change}</span>
            </p>
          )}
        </div>

        <div className={cn('p-3 rounded-xl border border-slate-100 dark:border-white/5 flex items-center justify-center shrink-0 self-start', iconBgColor, iconColor)}>
          {icon}
        </div>
      </div>
    </Card>
  );
};
