import React from 'react';
import { useTheme } from '../../context/ThemeContext';
import { Sun, Moon } from 'lucide-react';

interface ThemeToggleProps {
  className?: string;
  variant?: 'icon' | 'pill' | 'button'; // retained for compatibility, defaults to icon-only
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = '' }) => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`relative w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 border shadow-sm group active:scale-95 ${
        isDark
          ? 'bg-slate-900 border-slate-700/80 text-amber-400 hover:bg-slate-800 hover:border-amber-500/50 shadow-amber-950/20'
          : 'bg-white border-slate-200 text-indigo-600 hover:bg-slate-50 hover:border-indigo-300 shadow-indigo-100'
      } ${className}`}
      title={isDark ? 'Switch to Day Mode (Light Theme)' : 'Switch to Night Mode (Dark Theme)'}
      aria-label={isDark ? 'Switch to Day Mode' : 'Switch to Night Mode'}
    >
      <div className="relative w-4 h-4 flex items-center justify-center">
        {isDark ? (
          <Sun className="w-4 h-4 text-amber-400 transition-transform duration-300 group-hover:rotate-45" />
        ) : (
          <Moon className="w-4 h-4 text-indigo-600 transition-transform duration-300 group-hover:-rotate-12" />
        )}
      </div>
    </button>
  );
};
