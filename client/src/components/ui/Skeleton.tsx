import React from 'react';
import { cn } from '../../utils/cn';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'circular' | 'rounded' | 'text';
  shimmer?: boolean;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className,
  variant = 'default',
  shimmer = true,
  ...props
}) => {
  const variantStyles = {
    default: 'rounded-md',
    circular: 'rounded-full',
    rounded: 'rounded-xl',
    text: 'rounded h-4',
  }[variant];

  return (
    <div
      className={cn(
        'bg-slate-800/60',
        shimmer ? 'shimmer-effect' : 'animate-pulse',
        variantStyles,
        className
      )}
      {...props}
    />
  );
};

/**
 * StatCardSkeleton: Mirrors the layout and size of StatCard
 */
export const StatCardSkeleton: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div
      className={cn(
        'bg-slate-900/60 border border-slate-800/90 rounded-xl p-5 shadow-lg relative overflow-hidden backdrop-blur-sm',
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-2">
          {/* Label skeleton */}
          <Skeleton className="w-24 h-3.5 bg-slate-800/70" />
          {/* Value skeleton */}
          <Skeleton className="w-32 h-7 bg-slate-800" />
        </div>
        {/* Icon circle placeholder */}
        <Skeleton variant="rounded" className="w-10 h-10 bg-slate-800/80 shrink-0" />
      </div>
      {/* Subtitle / trend skeleton */}
      <div className="mt-3 flex items-center gap-2">
        <Skeleton className="w-36 h-3 bg-slate-800/50" />
      </div>
    </div>
  );
};

/**
 * TableSkeleton: Universal table skeleton with pulsing headers and rows
 */
export const TableSkeleton: React.FC<{
  rows?: number;
  columns?: number;
  className?: string;
}> = ({ rows = 5, columns = 5, className }) => {
  const rowArray = Array.from({ length: rows });
  const colArray = Array.from({ length: columns });

  return (
    <div className={cn('w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40', className)}>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950/60 border-b border-slate-800">
            <tr>
              {colArray.map((_, i) => (
                <th key={i} className="py-3 px-4">
                  <Skeleton className={cn('h-3.5 bg-slate-800/70', i === 0 ? 'w-24' : 'w-20')} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {rowArray.map((_, r) => (
              <tr key={r} className="hover:bg-slate-800/20">
                {colArray.map((_, c) => (
                  <td key={c} className="py-3.5 px-4">
                    <Skeleton
                      className={cn(
                        'h-3 bg-slate-800/60',
                        c === 0 ? 'w-32' : c === 1 ? 'w-24' : c === columns - 1 ? 'w-16 ml-auto' : 'w-20'
                      )}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/**
 * ListSkeleton: Ideal for audit trail, activity logs, notifications
 */
export const ListSkeleton: React.FC<{ items?: number; className?: string }> = ({
  items = 4,
  className,
}) => {
  return (
    <div className={cn('divide-y divide-slate-800/60', className)}>
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="py-3 flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            <Skeleton className="w-16 h-5 rounded bg-slate-800" />
            <Skeleton className="w-24 h-4 bg-slate-800/70" />
            <Skeleton className="w-48 h-3.5 bg-slate-800/50 hidden sm:block" />
          </div>
          <Skeleton className="w-14 h-3 bg-slate-800/40" />
        </div>
      ))}
    </div>
  );
};

/**
 * DashboardSkeleton: Mimics the StockPilot DynamicDashboard layout
 */
export const DashboardSkeleton: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div className={cn('space-y-6 animate-in fade-in duration-200', className)}>
      {/* Top Welcome / Header skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800/70 pb-5">
        <div className="space-y-2">
          <Skeleton className="w-64 h-8 bg-slate-800" />
          <Skeleton className="w-96 h-4 bg-slate-800/60" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="w-24 h-9 bg-slate-800 rounded-lg" />
          <Skeleton className="w-28 h-9 bg-slate-800 rounded-lg" />
        </div>
      </div>

      {/* Tabs Filter Bar Skeleton */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton
            key={i}
            className={cn('h-8 rounded-lg shrink-0', i === 0 ? 'w-24 bg-emerald-500/20' : 'w-28 bg-slate-800/50')}
          />
        ))}
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>

      {/* Main Content Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Larger Card Skeleton */}
        <div className="lg:col-span-2 bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <Skeleton className="w-48 h-5 bg-slate-800" />
            <Skeleton className="w-20 h-4 bg-slate-800/60" />
          </div>
          <div className="space-y-3 pt-2">
            <TableSkeleton rows={4} columns={4} />
          </div>
        </div>

        {/* Right Audit Trail / Activity Skeleton */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <Skeleton className="w-36 h-5 bg-slate-800" />
            <Skeleton className="w-16 h-4 bg-slate-800/60" />
          </div>
          <ListSkeleton items={5} />
        </div>
      </div>
    </div>
  );
};

/**
 * PageSkeleton: Generic page skeleton for standard tables/forms
 */
export const PageSkeleton: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div className={cn('space-y-6 animate-in fade-in duration-200', className)}>
      {/* Page Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800/70 pb-5">
        <div className="space-y-2">
          <Skeleton className="w-56 h-7 bg-slate-800" />
          <Skeleton className="w-80 h-3.5 bg-slate-800/60" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="w-24 h-9 bg-slate-800 rounded-lg" />
          <Skeleton className="w-32 h-9 bg-slate-800 rounded-lg" />
        </div>
      </div>

      {/* Filter / Search Bar Skeleton */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/40 border border-slate-800/80 rounded-xl p-3">
        <Skeleton className="w-full sm:w-72 h-9 bg-slate-800 rounded-lg" />
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Skeleton className="w-28 h-9 bg-slate-800 rounded-lg" />
          <Skeleton className="w-28 h-9 bg-slate-800 rounded-lg" />
        </div>
      </div>

      {/* Table Skeleton Card */}
      <TableSkeleton rows={7} columns={5} />
    </div>
  );
};

/**
 * AppSkeleton: Full-screen application layout skeleton
 * Shown during initial auth loading and role transitions
 */
export const AppSkeleton: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col text-slate-200">
      {/* Top RolePersonaBar placeholder */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-2 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Skeleton className="w-28 h-5 rounded bg-emerald-500/20" />
            <Skeleton className="w-36 h-4 bg-slate-800/80 hidden sm:block" />
            <Skeleton className="w-24 h-4 bg-slate-800/60 hidden md:block" />
          </div>
          <Skeleton className="w-36 h-7 rounded-lg bg-slate-800" />
        </div>
      </div>

      <div className="flex-1 flex w-full">
        {/* Sidebar placeholder */}
        <aside className="w-64 bg-slate-900/90 border-r border-slate-800 p-4 shrink-0 hidden md:flex flex-col gap-6">
          <div className="flex items-center gap-3 px-2">
            <Skeleton variant="rounded" className="w-8 h-8 bg-emerald-500/30" />
            <div className="space-y-1.5">
              <Skeleton className="w-24 h-4 bg-slate-800" />
              <Skeleton className="w-16 h-2.5 bg-slate-800/60" />
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <Skeleton className="w-20 h-2.5 bg-slate-800/50 uppercase px-2 mb-2" />
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-2 py-2">
                <Skeleton className="w-4 h-4 rounded bg-slate-800" />
                <Skeleton className={cn('h-3.5 bg-slate-800/70', i % 2 === 0 ? 'w-28' : 'w-20')} />
              </div>
            ))}
          </div>

          <div className="space-y-2 pt-4 border-t border-slate-800/60">
            <Skeleton className="w-20 h-2.5 bg-slate-800/50 uppercase px-2 mb-2" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-2 py-2">
                <Skeleton className="w-4 h-4 rounded bg-slate-800" />
                <Skeleton className={cn('h-3.5 bg-slate-800/70', i % 2 === 0 ? 'w-24' : 'w-32')} />
              </div>
            ))}
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
          {/* Header Placeholder */}
          <header className="h-16 border-b border-slate-800 bg-slate-900/50 px-6 flex items-center justify-between">
            <Skeleton className="w-64 h-9 rounded-lg bg-slate-800/80" />
            <div className="flex items-center gap-4">
              <Skeleton variant="circular" className="w-8 h-8 bg-slate-800" />
              <div className="flex items-center gap-2">
                <Skeleton variant="circular" className="w-8 h-8 bg-emerald-500/20" />
                <Skeleton className="w-24 h-4 bg-slate-800 hidden sm:block" />
              </div>
            </div>
          </header>

          {/* Viewport Dashboard Skeleton */}
          <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto">
            <DashboardSkeleton />
          </main>
        </div>
      </div>
    </div>
  );
};
