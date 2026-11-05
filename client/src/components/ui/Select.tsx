import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Check, AlertCircle, Search, X } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface SelectOption {
  value: string;
  label: string;
  sublabel?: string;
  badge?: string;
  icon?: React.ReactNode;
}

export interface SelectProps {
  label?: string;
  options: SelectOption[];
  error?: string;
  value?: string | number;
  defaultValue?: string | number;
  onChange?: (e: any) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  id?: string;
  name?: string;
  searchable?: boolean;
  variant?: 'emerald' | 'rose' | 'indigo' | 'slate' | 'sky' | 'purple' | 'cyan' | 'teal';
  size?: 'sm' | 'md';
  align?: 'left' | 'right';
}

export const Select: React.FC<SelectProps> = ({
  className,
  label,
  options,
  error,
  value,
  defaultValue,
  onChange,
  disabled = false,
  placeholder = 'Select an option...',
  id,
  name,
  searchable,
  variant = 'emerald',
  size = 'md',
  align = 'left',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Maintain internal value state synced with prop
  const [internalValue, setInternalValue] = useState<string>(
    value !== undefined ? String(value) : defaultValue !== undefined ? String(defaultValue) : ''
  );

  useEffect(() => {
    if (value !== undefined) {
      setInternalValue(String(value));
    }
  }, [value]);

  // Focus search input when popover opens
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      if (isSearchEnabled) {
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
    }
  }, [isOpen]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Determine if search should be enabled (auto-enable for > 7 options unless explicitly false)
  const isSearchEnabled = searchable !== undefined ? searchable : options.length > 7;

  // Filtered options based on search query
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const q = searchQuery.toLowerCase();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        (opt.sublabel && opt.sublabel.toLowerCase().includes(q)) ||
        (opt.badge && opt.badge.toLowerCase().includes(q))
    );
  }, [options, searchQuery]);

  const selectedOption = options.find((opt) => String(opt.value) === String(internalValue));

  const handleSelect = (val: string) => {
    setInternalValue(val);
    setIsOpen(false);

    if (onChange) {
      // Create synthetic event for compatibility with standard select onChange: (e) => setVal(e.target.value)
      const syntheticEvent = {
        target: { value: val, name: name || id || '' },
        currentTarget: { value: val, name: name || id || '' },
        preventDefault: () => {},
        stopPropagation: () => {},
      };
      onChange(syntheticEvent);
    }
  };

  // Color variants
  const variantStyles = {
    emerald: {
      activeBorder: 'border-emerald-500 ring-2 ring-emerald-500/20',
      activeText: 'text-emerald-500',
      selectedItem: 'bg-emerald-500/15 text-emerald-400 font-semibold border-emerald-500/30',
      checkIcon: 'text-emerald-500',
    },
    sky: {
      activeBorder: 'border-sky-500 ring-2 ring-sky-500/20',
      activeText: 'text-sky-500',
      selectedItem: 'bg-sky-500/15 text-sky-400 font-semibold border-sky-500/30',
      checkIcon: 'text-sky-500',
    },
    purple: {
      activeBorder: 'border-purple-500 ring-2 ring-purple-500/20',
      activeText: 'text-purple-500',
      selectedItem: 'bg-purple-500/15 text-purple-400 font-semibold border-purple-500/30',
      checkIcon: 'text-purple-500',
    },
    cyan: {
      activeBorder: 'border-cyan-500 ring-2 ring-cyan-500/20',
      activeText: 'text-cyan-500',
      selectedItem: 'bg-cyan-500/15 text-cyan-400 font-semibold border-cyan-500/30',
      checkIcon: 'text-cyan-500',
    },
    teal: {
      activeBorder: 'border-teal-500 ring-2 ring-teal-500/20',
      activeText: 'text-teal-500',
      selectedItem: 'bg-teal-500/15 text-teal-400 font-semibold border-teal-500/30',
      checkIcon: 'text-teal-500',
    },
    rose: {
      activeBorder: 'border-rose-500 ring-2 ring-rose-500/20',
      activeText: 'text-rose-500',
      selectedItem: 'bg-rose-500/15 text-rose-400 font-semibold border-rose-500/30',
      checkIcon: 'text-rose-500',
    },
    indigo: {
      activeBorder: 'border-indigo-500 ring-2 ring-indigo-500/20',
      activeText: 'text-indigo-500',
      selectedItem: 'bg-indigo-500/15 text-indigo-400 font-semibold border-indigo-500/30',
      checkIcon: 'text-indigo-500',
    },
    slate: {
      activeBorder: 'border-slate-500 ring-2 ring-slate-500/20',
      activeText: 'text-slate-400',
      selectedItem: 'bg-slate-800 text-white font-semibold border-slate-700',
      checkIcon: 'text-slate-300',
    },
  }[variant] || {
    activeBorder: 'border-emerald-500 ring-2 ring-emerald-500/20',
    activeText: 'text-emerald-500',
    selectedItem: 'bg-emerald-500/15 text-emerald-400 font-semibold border-emerald-500/30',
    checkIcon: 'text-emerald-500',
  };

  const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  // Helper to parse code-name if format is "CODE - Name"
  const parseOptionDisplay = (opt: SelectOption) => {
    if (opt.badge) {
      let cleanName = opt.label;
      const badgeSuffix = `(${opt.badge})`;
      if (cleanName.endsWith(badgeSuffix)) {
        cleanName = cleanName.slice(0, -badgeSuffix.length).trim();
      }
      return { badge: opt.badge, name: cleanName || opt.badge, sublabel: opt.sublabel };
    }
    const dashIdx = opt.label.indexOf(' - ');
    if (dashIdx > 0 && dashIdx <= 15) {
      return {
        badge: opt.label.substring(0, dashIdx).trim(),
        name: opt.label.substring(dashIdx + 3).trim(),
        sublabel: opt.sublabel,
      };
    }
    return { badge: undefined, name: opt.label, sublabel: opt.sublabel };
  };

  const selectedDisplay = selectedOption ? parseOptionDisplay(selectedOption) : null;

  return (
    <div className={cn('w-full space-y-1.5', isOpen ? 'relative z-50' : 'relative z-10', className)} ref={containerRef}>
      {label && (
        <label htmlFor={selectId} className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
          {label}
        </label>
      )}

      <div className="relative">
        {/* Trigger Button */}
        <button
          id={selectId}
          type="button"
          disabled={disabled}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          className={cn(
            'w-full bg-slate-900 border text-left rounded-lg transition-all duration-150 flex items-center justify-between gap-2 shadow-sm',
            size === 'sm' ? 'px-2.5 py-1.5 text-xs min-h-[32px]' : 'px-3.5 py-2 text-xs min-h-[38px]',
            isOpen
              ? cn('bg-slate-900 text-white', variantStyles.activeBorder)
              : 'border-slate-700 hover:border-slate-600 text-slate-100 hover:text-white',
            disabled && 'opacity-50 cursor-not-allowed bg-slate-950',
            error && 'border-rose-500 ring-1 ring-rose-500'
          )}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {selectedOption?.icon && (
              <span className="shrink-0 text-slate-400">{selectedOption.icon}</span>
            )}
            {selectedDisplay ? (
              <div className="flex items-center gap-1.5 truncate">
                {selectedDisplay.badge && (
                  <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-200 shrink-0">
                    {selectedDisplay.badge}
                  </span>
                )}
                <span className="truncate text-slate-100 font-normal">
                  {selectedDisplay.name}
                </span>
              </div>
            ) : (
              <span className="truncate text-slate-400 font-normal">{placeholder}</span>
            )}
          </div>
          <ChevronDown
            className={cn(
              'w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200',
              isOpen && cn('rotate-180', variantStyles.activeText)
            )}
          />
        </button>

        {/* Custom Glassmorphism Options Popover */}
        {isOpen && (
          <div
            onMouseDown={(e) => e.stopPropagation()}
            className={cn(
              'absolute mt-1.5 min-w-full sm:min-w-[240px] bg-slate-950 border border-slate-700/90 rounded-xl shadow-2xl z-[70] overflow-hidden animate-in fade-in zoom-in-95 duration-100',
              align === 'right' ? 'right-0' : 'left-0'
            )}
          >
            {/* Search filter input if enabled */}
            {isSearchEnabled && (
              <div className="p-2 border-b border-slate-800/80 bg-slate-950/50">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search options..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-7 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-slate-600"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Options list */}
            <div className="max-h-60 overflow-y-auto p-1.5 space-y-0.5">
              {filteredOptions.length === 0 ? (
                <div className="py-4 text-center text-xs text-slate-400">
                  {searchQuery ? 'No matching options found' : 'No options available'}
                </div>
              ) : (
                filteredOptions.map((opt) => {
                  const isSelected = String(opt.value) === String(internalValue);
                  const parsed = parseOptionDisplay(opt);

                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSelect(opt.value);
                      }}
                      onClick={() => handleSelect(opt.value)}
                      className={cn(
                        'w-full flex items-center justify-between px-3 py-2 text-left rounded-lg text-xs transition-all group border border-transparent',
                        isSelected
                          ? cn(variantStyles.selectedItem, 'border')
                          : 'text-slate-200 hover:bg-slate-800/80 hover:text-white'
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {opt.icon && (
                          <span className="shrink-0 text-slate-400 group-hover:text-slate-200">
                            {opt.icon}
                          </span>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 truncate">
                            {parsed.badge && (
                              <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 shrink-0">
                                {parsed.badge}
                              </span>
                            )}
                            <span className="truncate">{parsed.name}</span>
                          </div>
                          {parsed.sublabel && (
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate mt-0.5">
                              {parsed.sublabel}
                            </span>
                          )}
                        </div>
                      </div>

                      {isSelected && (
                        <Check className={cn('w-3.5 h-3.5 shrink-0 stroke-[2.5] ml-2', variantStyles.checkIcon)} />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {error && (
        <p className="text-xs text-rose-400 font-medium flex items-center gap-1.5 mt-1 animate-in fade-in slide-in-from-top-1 duration-150">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
};
