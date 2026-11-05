import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  AsYouType,
  CountryCode,
} from 'libphonenumber-js';
import { Search, ChevronDown, Check, Phone } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface PhoneInputProps {
  label?: string;
  error?: string;
  helperText?: string;
  value?: string;
  onChange: (normalizedE164: string, isValid: boolean) => void;
  required?: boolean;
  disabled?: boolean;
  defaultCountry?: CountryCode;
  id?: string;
}

interface CountryMeta {
  code: CountryCode;
  name: string;
  callingCode: string;
  flag: string;
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

export const PhoneInput: React.FC<PhoneInputProps> = ({
  label = 'Phone Number',
  error,
  helperText,
  value = '',
  onChange,
  required,
  disabled,
  defaultCountry = 'US',
  id,
}) => {
  const [selectedCountry, setSelectedCountry] = useState<CountryCode>(defaultCountry);
  const [nationalNumber, setNationalNumber] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Generate complete country metadata list from libphonenumber-js
  const countryList: CountryMeta[] = useMemo(() => {
    const countries = getCountries();
    return countries
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

  // Filter countries by search query
  const filteredCountries = useMemo(() => {
    if (!searchQuery.trim()) return countryList;
    const q = searchQuery.toLowerCase().trim();
    return countryList.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.callingCode.includes(q)
    );
  }, [countryList, searchQuery]);

  // Initial sync from incoming value (if already in E.164)
  useEffect(() => {
    if (value && value.startsWith('+')) {
      const parsed = parsePhoneNumberFromString(value);
      if (parsed) {
        if (parsed.country) {
          setSelectedCountry(parsed.country);
        }
        setNationalNumber(parsed.nationalNumber);
      }
    }
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
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

  const currentCallingCode = useMemo(() => {
    try {
      return `+${getCountryCallingCode(selectedCountry)}`;
    } catch {
      return '+1';
    }
  }, [selectedCountry]);

  // Handle number input change
  const handleNumberChange = (raw: string) => {
    // Only allow digits and spaces
    const cleaned = raw.replace(/[^\d\s-]/g, '');
    const asYouType = new AsYouType(selectedCountry);
    const formatted = asYouType.input(cleaned);
    setNationalNumber(formatted);

    // Validate using libphonenumber-js
    const fullNumber = `${currentCallingCode}${cleaned.replace(/\D/g, '')}`;
    const parsed = parsePhoneNumberFromString(fullNumber, selectedCountry);

    const isValid = !!(parsed && parsed.isValid());
    const normalizedE164 = parsed ? parsed.number : fullNumber;

    onChange(normalizedE164, isValid);
  };

  const handleCountrySelect = (c: CountryMeta) => {
    setSelectedCountry(c.code);
    setIsOpen(false);
    setSearchQuery('');

    // Re-validate existing national number with new country
    const cleaned = nationalNumber.replace(/\D/g, '');
    if (cleaned) {
      const fullNumber = `${c.callingCode}${cleaned}`;
      const parsed = parsePhoneNumberFromString(fullNumber, c.code);
      const isValid = !!(parsed && parsed.isValid());
      const normalizedE164 = parsed ? parsed.number : fullNumber;
      onChange(normalizedE164, isValid);
    }
  };

  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : 'phone-input');

  return (
    <div className="w-full space-y-1.5" ref={containerRef}>
      {label && (
        <label htmlFor={inputId} className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
          {label} {required && <span className="text-emerald-400">*</span>}
        </label>
      )}

      <div className="relative flex items-center">
        {/* Country Code Trigger Button */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen((prev) => !prev)}
          className={cn(
            'inline-flex items-center gap-1.5 bg-slate-900 border border-r-0 border-slate-700 text-slate-200 px-3 py-2 text-sm rounded-l-lg hover:bg-slate-800 transition-colors focus:outline-none focus:ring-1 focus:ring-emerald-500 shrink-0 min-w-[95px] justify-between',
            error && 'border-rose-500',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-label="Select Country"
        >
          <span className="text-base leading-none mr-0.5">{getFlagEmoji(selectedCountry)}</span>
          <span className="font-mono text-xs text-slate-300">{currentCallingCode}</span>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
        </button>

        {/* National Number Input */}
        <div className="relative flex-1">
          <input
            id={inputId}
            type="tel"
            disabled={disabled}
            value={nationalNumber}
            onChange={(e) => handleNumberChange(e.target.value)}
            placeholder="e.g. 98765 43210"
            className={cn(
              'w-full bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 rounded-r-lg px-3.5 py-2 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:opacity-50 disabled:bg-slate-950 font-mono tracking-tight',
              error && 'border-rose-500 focus:ring-rose-500'
            )}
          />
        </div>

        {/* Searchable Country Dropdown Popover */}
        {isOpen && (
          <div className="absolute top-full left-0 mt-1 w-80 max-w-[90vw] max-h-72 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100">
            {/* Search Input */}
            <div className="p-2 border-b border-slate-800 bg-slate-950/60 sticky top-0 z-10 flex items-center gap-2">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search country or code..."
                className="w-full bg-transparent text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
              />
            </div>

            {/* Country List */}
            <div className="overflow-y-auto divide-y divide-slate-800/40 p-1">
              {filteredCountries.length === 0 ? (
                <div className="p-3 text-center text-xs text-slate-500">No countries match "{searchQuery}"</div>
              ) : (
                filteredCountries.map((c) => {
                  const isSelected = c.code === selectedCountry;
                  return (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => handleCountrySelect(c)}
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
