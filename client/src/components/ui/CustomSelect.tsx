import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, X } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface CustomSelectOption {
  value: string;
  label: string;
  description?: string;
  badge?: string;
  badgeColor?: string;
  icon?: React.ReactNode;
}

export interface CustomSelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: CustomSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  error?: string;
  allowClear?: boolean;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  label,
  value,
  onChange,
  options,
  placeholder = 'Select an option...',
  disabled = false,
  className,
  error,
  allowClear = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

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

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
  };

  return (
    <div className={cn('w-full space-y-1.5', className)} ref={containerRef}>
      {label && (
        <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
          {label}
        </label>
      )}

      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          className={cn(
            'w-full bg-slate-900/90 border text-left rounded-xl px-3.5 py-2.5 text-xs transition-all duration-150 flex items-center justify-between gap-2 shadow-sm backdrop-blur-sm',
            isOpen
              ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-slate-900 text-white'
              : 'border-slate-700/80 hover:border-slate-600 text-slate-200 hover:text-white',
            disabled && 'opacity-50 cursor-not-allowed bg-slate-950',
            error && 'border-rose-500 ring-1 ring-rose-500'
          )}
        >
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            {selectedOption?.icon && (
              <span className="shrink-0 text-slate-400">{selectedOption.icon}</span>
            )}
            <div className="flex-1 truncate">
              {selectedOption ? (
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white truncate">{selectedOption.label}</span>
                  {selectedOption.badge && (
                    <span
                      className={cn(
                        'text-[10px] font-mono px-1.5 py-0.5 rounded border shrink-0',
                        selectedOption.badgeColor || 'bg-slate-800 text-slate-300 border-slate-700'
                      )}
                    >
                      {selectedOption.badge}
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-slate-400 font-normal">{placeholder}</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {allowClear && value && (
              <span
                onClick={handleClear}
                className="p-0.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </span>
            )}
            <ChevronDown
              className={cn(
                'w-4 h-4 text-slate-400 transition-transform duration-200',
                isOpen && 'rotate-180 text-emerald-400'
              )}
            />
          </div>
        </button>

        {isOpen && (
          <div className="absolute left-0 right-0 mt-2 bg-slate-900/98 border border-slate-700/80 rounded-xl shadow-2xl backdrop-blur-xl py-1.5 z-50 max-h-72 overflow-y-auto animate-in fade-in zoom-in-95 duration-150 divide-y divide-slate-800/40">
            {options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleSelect(opt.value)}
                  className={cn(
                    'w-full text-left px-3.5 py-2.5 text-xs transition-colors flex items-center justify-between gap-3',
                    isSelected
                      ? 'bg-emerald-500/10 text-emerald-300 font-semibold'
                      : 'hover:bg-slate-800/70 text-slate-300 hover:text-white'
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    {opt.icon && (
                      <span
                        className={cn(
                          'shrink-0',
                          isSelected ? 'text-emerald-400' : 'text-slate-400'
                        )}
                      >
                        {opt.icon}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate">{opt.label}</span>
                        {opt.badge && (
                          <span
                            className={cn(
                              'text-[9px] font-mono px-1.5 py-0.5 rounded border shrink-0',
                              opt.badgeColor || 'bg-slate-800 text-slate-400 border-slate-700'
                            )}
                          >
                            {opt.badge}
                          </span>
                        )}
                      </div>
                      {opt.description && (
                        <p className="text-[10px] text-slate-400 font-normal line-clamp-1 mt-0.5">
                          {opt.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {isSelected && (
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {error && <p className="text-xs text-rose-400 font-medium">{error}</p>}
    </div>
  );
};
