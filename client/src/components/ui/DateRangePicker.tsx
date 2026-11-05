import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown, X, Clock, Check } from 'lucide-react';
import { cn } from '../../utils/cn';

export type DatePresetKey =
  | 'ALL'
  | 'TODAY'
  | 'YESTERDAY'
  | 'LAST_7_DAYS'
  | 'LAST_30_DAYS'
  | 'THIS_MONTH'
  | 'LAST_MONTH'
  | 'CUSTOM';

export interface DateRangeState {
  startDate: string; // 'YYYY-MM-DD'
  endDate: string;   // 'YYYY-MM-DD'
  presetKey: DatePresetKey;
  label: string;
}

interface DateRangePickerProps {
  value: DateRangeState;
  onChange: (val: DateRangeState) => void;
  className?: string;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function toLocalDateString(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function formatShortDate(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts.map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function getPresetDates(preset: DatePresetKey): { start: string; end: string; label: string } {
  const now = new Date();
  switch (preset) {
    case 'TODAY': {
      const d = toLocalDateString(now);
      return { start: d, end: d, label: 'Today' };
    }
    case 'YESTERDAY': {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const d = toLocalDateString(y);
      return { start: d, end: d, label: 'Yesterday' };
    }
    case 'LAST_7_DAYS': {
      const s = new Date();
      s.setDate(s.getDate() - 6);
      return { start: toLocalDateString(s), end: toLocalDateString(now), label: 'Last 7 Days' };
    }
    case 'LAST_30_DAYS': {
      const s = new Date();
      s.setDate(s.getDate() - 29);
      return { start: toLocalDateString(s), end: toLocalDateString(now), label: 'Last 30 Days' };
    }
    case 'THIS_MONTH': {
      const s = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: toLocalDateString(s), end: toLocalDateString(now), label: 'This Month' };
    }
    case 'LAST_MONTH': {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const e = new Date(now.getFullYear(), now.getMonth(), 0);
      return { start: toLocalDateString(s), end: toLocalDateString(e), label: 'Last Month' };
    }
    case 'ALL':
    default:
      return { start: '', end: '', label: 'All Dates' };
  }
}

const PRESET_OPTIONS: Array<{ key: DatePresetKey; label: string; getSubtitle: () => string }> = [
  {
    key: 'ALL',
    label: 'All Time',
    getSubtitle: () => 'Full transaction history',
  },
  {
    key: 'TODAY',
    label: 'Today',
    getSubtitle: () => {
      const now = new Date();
      return formatShortDate(toLocalDateString(now));
    },
  },
  {
    key: 'YESTERDAY',
    label: 'Yesterday',
    getSubtitle: () => {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      return formatShortDate(toLocalDateString(y));
    },
  },
  {
    key: 'LAST_7_DAYS',
    label: 'Last 7 Days',
    getSubtitle: () => {
      const { start, end } = getPresetDates('LAST_7_DAYS');
      return `${formatShortDate(start)} – ${formatShortDate(end)}`;
    },
  },
  {
    key: 'LAST_30_DAYS',
    label: 'Last 30 Days',
    getSubtitle: () => {
      const { start, end } = getPresetDates('LAST_30_DAYS');
      return `${formatShortDate(start)} – ${formatShortDate(end)}`;
    },
  },
  {
    key: 'THIS_MONTH',
    label: 'This Month',
    getSubtitle: () => {
      const { start, end } = getPresetDates('THIS_MONTH');
      return `${formatShortDate(start)} – ${formatShortDate(end)}`;
    },
  },
  {
    key: 'LAST_MONTH',
    label: 'Last Month',
    getSubtitle: () => {
      const { start, end } = getPresetDates('LAST_MONTH');
      return `${formatShortDate(start)} – ${formatShortDate(end)}`;
    },
  },
];

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  value,
  onChange,
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Temporary local inputs for custom range
  const [customStart, setCustomStart] = useState(value.startDate || '');
  const [customEnd, setCustomEnd] = useState(value.endDate || '');
  const [errorMsg, setErrorMsg] = useState('');

  // Sync inputs when value prop changes
  useEffect(() => {
    setCustomStart(value.startDate || '');
    setCustomEnd(value.endDate || '');
    setErrorMsg('');
  }, [value.startDate, value.endDate]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Handle Preset Select
  const handleSelectPreset = (key: DatePresetKey) => {
    if (key === 'ALL') {
      onChange({
        startDate: '',
        endDate: '',
        presetKey: 'ALL',
        label: 'All Dates',
      });
      setCustomStart('');
      setCustomEnd('');
    } else {
      const { start, end, label } = getPresetDates(key);
      onChange({
        startDate: start,
        endDate: end,
        presetKey: key,
        label,
      });
      setCustomStart(start);
      setCustomEnd(end);
    }
    setErrorMsg('');
    setIsOpen(false);
  };

  // Handle Custom Range Apply
  const handleApplyCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customStart && !customEnd) {
      handleSelectPreset('ALL');
      return;
    }

    if (customStart && customEnd && customStart > customEnd) {
      setErrorMsg('Start date cannot be after end date');
      return;
    }

    let displayLabel = 'Custom Range';
    if (customStart && customEnd) {
      if (customStart === customEnd) {
        displayLabel = formatShortDate(customStart);
      } else {
        displayLabel = `${formatShortDate(customStart)} – ${formatShortDate(customEnd)}`;
      }
    } else if (customStart) {
      displayLabel = `From ${formatShortDate(customStart)}`;
    } else if (customEnd) {
      displayLabel = `Until ${formatShortDate(customEnd)}`;
    }

    onChange({
      startDate: customStart,
      endDate: customEnd,
      presetKey: 'CUSTOM',
      label: displayLabel,
    });
    setErrorMsg('');
    setIsOpen(false);
  };

  // Quick reset to All
  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleSelectPreset('ALL');
  };

  const isFiltered = value.presetKey !== 'ALL' && (Boolean(value.startDate) || Boolean(value.endDate));

  // Determine display label on trigger button
  const triggerLabel = isFiltered
    ? value.label || (value.startDate && value.endDate ? `${formatShortDate(value.startDate)} – ${formatShortDate(value.endDate)}` : 'Custom Date')
    : 'All Dates';

  return (
    <div ref={containerRef} className={cn('relative inline-block w-full', className)}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          'w-full flex items-center justify-between gap-2 bg-slate-900 border text-xs rounded-lg px-3 py-2 min-h-[38px] transition-all text-left shadow-sm select-none',
          isOpen
            ? 'border-emerald-500 ring-2 ring-emerald-500/20'
            : isFiltered
            ? 'border-emerald-500/50 bg-emerald-950/20 text-emerald-300 hover:border-emerald-400'
            : 'border-slate-700 text-slate-300 hover:border-slate-600 hover:text-white'
        )}
      >
        <div className="flex items-center gap-2 truncate">
          <Calendar
            className={cn(
              'w-4 h-4 shrink-0 transition-colors',
              isFiltered ? 'text-emerald-400' : 'text-slate-400'
            )}
          />
          <span className="truncate font-medium">
            {triggerLabel}
          </span>
          {isFiltered && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 animate-pulse" />
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {isFiltered && (
            <span
              onClick={handleClear}
              title="Reset to All Dates"
              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown
            className={cn(
              'w-3.5 h-3.5 text-slate-400 transition-transform duration-200',
              isOpen && 'rotate-180 text-emerald-400'
            )}
          />
        </div>
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div
          className="absolute right-0 sm:right-0 mt-2 z-50 w-full sm:w-[460px] bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-xl shadow-2xl p-4 text-xs space-y-4 animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
            <div className="flex items-center gap-2 text-slate-200 font-semibold">
              <Clock className="w-4 h-4 text-emerald-400" />
              <span>Select Date Horizon</span>
            </div>
            {isFiltered && (
              <button
                type="button"
                onClick={handleClear}
                className="text-[11px] text-rose-400 hover:text-rose-300 font-medium transition-colors"
              >
                Clear Filter
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Quick Presets Column */}
            <div className="space-y-1">
              <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Quick Presets
              </span>
              <div className="space-y-1">
                {PRESET_OPTIONS.map((preset) => {
                  const isActive = value.presetKey === preset.key;
                  return (
                    <button
                      key={preset.key}
                      type="button"
                      onClick={() => handleSelectPreset(preset.key)}
                      className={cn(
                        'w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-all text-xs group',
                        isActive
                          ? 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-semibold'
                          : 'hover:bg-slate-800/80 text-slate-300 hover:text-white border border-transparent'
                      )}
                    >
                      <div className="flex flex-col">
                        <span>{preset.label}</span>
                        <span className="text-[10px] text-slate-500 group-hover:text-slate-400 font-mono">
                          {preset.getSubtitle()}
                        </span>
                      </div>
                      {isActive && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Date Range Column */}
            <div className="border-t sm:border-t-0 sm:border-l border-slate-800 pt-3 sm:pt-0 sm:pl-4 space-y-3 flex flex-col justify-between">
              <div>
                <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Custom Range
                </span>
                <form onSubmit={handleApplyCustom} className="space-y-2.5">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={customStart}
                      onChange={(e) => {
                        setCustomStart(e.target.value);
                        setErrorMsg('');
                      }}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 [color-scheme:dark]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={customEnd}
                      onChange={(e) => {
                        setCustomEnd(e.target.value);
                        setErrorMsg('');
                      }}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 [color-scheme:dark]"
                    />
                  </div>

                  {errorMsg && (
                    <div className="text-[11px] text-rose-400 font-medium leading-tight">
                      {errorMsg}
                    </div>
                  )}

                  <div className="pt-2 flex items-center gap-2">
                    <button
                      type="submit"
                      className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-1.5 px-3 rounded-lg text-xs shadow transition-all active:scale-[0.98]"
                    >
                      Apply Range
                    </button>
                    {(customStart || customEnd) && (
                      <button
                        type="button"
                        onClick={() => {
                          setCustomStart('');
                          setCustomEnd('');
                          setErrorMsg('');
                        }}
                        className="py-1.5 px-2.5 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 text-xs transition-colors"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </form>
              </div>

              {/* Information pill */}
              <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800 text-[10px] text-slate-400 leading-relaxed">
                Dates are evaluated in your local timezone ({Intl.DateTimeFormat().resolvedOptions().timeZone}).
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
