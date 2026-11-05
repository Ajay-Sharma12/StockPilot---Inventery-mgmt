import React, { useState, useEffect, useRef, useMemo } from 'react';
import { getCountries, getCountryCallingCode, CountryCode } from 'libphonenumber-js';
import { Search, ChevronDown, Check, Globe } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface CountryOption {
  code: CountryCode;
  name: string;
  callingCode: string;
  flag: string;
}

export interface CountrySelectProps {
  label?: string;
  error?: string;
  helperText?: string;
  value?: string; // country code e.g. "US", "IN" or country name
  onChange: (countryName: string, countryCode: string) => void;
  required?: boolean;
  disabled?: boolean;
  id?: string;
}

function getFlagEmoji(countryCode: string): string {
  try {
    const codePoints = countryCode
      .toUpperCase()
      .split('')
      .map((char) => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  } catch {
    return '🌐';
  }
}

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });

export const CountrySelect: React.FC<CountrySelectProps> = ({
  label = 'Country / Region',
  error,
  helperText,
  value = '',
  onChange,
  required,
  disabled,
  id,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Maintained country list from libphonenumber-js + Intl.DisplayNames
  const allCountries: CountryOption[] = useMemo(() => {
    const codes = getCountries();
    return codes
      .map((c) => {
        let name: string = c;
        try {
          name = regionNames.of(c) || c;
        } catch {
          name = c;
        }
        let callingCode = '';
        try {
          callingCode = getCountryCallingCode(c);
        } catch {
          callingCode = '';
        }
        return {
          code: c,
          name,
          callingCode: `+${callingCode}`,
          flag: getFlagEmoji(c),
        };
      })
      .filter((c) => c.callingCode !== '+')
      .sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  const selectedCountry = useMemo(() => {
    if (!value) return null;
    return (
      allCountries.find(
        (c) => c.code.toLowerCase() === value.toLowerCase() || c.name.toLowerCase() === value.toLowerCase()
      ) || null
    );
  }, [allCountries, value]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return allCountries;
    const q = searchQuery.toLowerCase().trim();
    return allCountries.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.callingCode.includes(q)
    );
  }, [allCountries, searchQuery]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (c: CountryOption) => {
    onChange(c.name, c.code);
    setIsOpen(false);
    setSearchQuery('');
  };

  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : 'country-select');

  return (
    <div className="w-full space-y-1.5" ref={containerRef}>
      {label && (
        <label htmlFor={inputId} className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
          {label} {required && <span className="text-emerald-400">*</span>}
        </label>
      )}

      <div className="relative">
        <button
          id={inputId}
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen((prev) => !prev)}
          className={cn(
            'w-full bg-slate-900 border border-slate-700 text-left text-slate-100 rounded-lg px-3.5 py-2 text-sm flex items-center justify-between transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:opacity-50 disabled:bg-slate-950',
            error && 'border-rose-500 focus:ring-rose-500',
            !selectedCountry && 'text-slate-500'
          )}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          <div className="flex items-center gap-2 truncate">
            {selectedCountry ? (
              <>
                <span className="text-base leading-none">{selectedCountry.flag}</span>
                <span className="font-medium text-slate-100 truncate">{selectedCountry.name}</span>
                <span className="text-xs text-slate-400 font-mono">({selectedCountry.callingCode})</span>
              </>
            ) : (
              <span className="flex items-center gap-2 text-slate-500">
                <Globe className="w-4 h-4 text-slate-500" />
                Select country or territory...
              </span>
            )}
          </div>
          <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 ml-2" />
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 mt-1 w-full max-h-72 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100">
            <div className="p-2 border-b border-slate-800 bg-slate-950/60 sticky top-0 z-10 flex items-center gap-2">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search country, code or calling prefix..."
                className="w-full bg-transparent text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
              />
            </div>

            <div className="overflow-y-auto divide-y divide-slate-800/40 p-1">
              {filtered.length === 0 ? (
                <div className="p-3 text-center text-xs text-slate-500">No countries found</div>
              ) : (
                filtered.map((c) => {
                  const isSelected = selectedCountry?.code === c.code;
                  return (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => handleSelect(c)}
                      className={cn(
                        'w-full flex items-center justify-between px-3 py-2 text-left rounded-lg text-xs hover:bg-slate-800/80 transition-colors group',
                        isSelected ? 'bg-emerald-500/10 text-emerald-300 font-semibold' : 'text-slate-300'
                      )}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <span className="text-base leading-none shrink-0">{c.flag}</span>
                        <span className="truncate">{c.name}</span>
                        <span className="text-[10px] text-slate-500 font-mono">({c.code})</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <span className="font-mono text-slate-400 group-hover:text-emerald-400 text-xs">
                          {c.callingCode}
                        </span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-rose-400 font-medium">{error}</p>}
      {helperText && !error && <p className="text-xs text-slate-400">{helperText}</p>}
    </div>
  );
};
