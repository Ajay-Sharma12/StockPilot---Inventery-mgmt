import React, { useMemo } from 'react';
import { Check, X } from 'lucide-react';

export interface PasswordStrengthMeterProps {
  password: string;
  showRequirements?: boolean;
}

export const PasswordStrengthMeter: React.FC<PasswordStrengthMeterProps> = ({
  password,
  showRequirements = true,
}) => {
  const requirements = useMemo(() => {
    return [
      { id: 'length', label: '8+ characters', met: password.length >= 8 },
      { id: 'upper', label: 'Uppercase letter (A-Z)', met: /[A-Z]/.test(password) },
      { id: 'lower', label: 'Lowercase letter (a-z)', met: /[a-z]/.test(password) },
      { id: 'number', label: 'Number (0-9)', met: /[0-9]/.test(password) },
      { id: 'special', label: 'Special character (!@#$%^&*)', met: /[^A-Za-z0-9]/.test(password) },
    ];
  }, [password]);

  const metCount = useMemo(() => requirements.filter((r) => r.met).length, [requirements]);

  const strength = useMemo(() => {
    if (!password) return { label: 'Empty', color: 'bg-slate-700', percent: 0, textClass: 'text-slate-500' };
    if (metCount <= 2) return { label: 'Weak', color: 'bg-rose-500', percent: 25, textClass: 'text-rose-400' };
    if (metCount === 3) return { label: 'Fair', color: 'bg-amber-500', percent: 50, textClass: 'text-amber-400' };
    if (metCount === 4) return { label: 'Good', color: 'bg-blue-500', percent: 75, textClass: 'text-blue-400' };
    return { label: 'Strong', color: 'bg-emerald-500', percent: 100, textClass: 'text-emerald-400' };
  }, [metCount, password]);

  if (!password && !showRequirements) return null;

  return (
    <div className="space-y-2 mt-1.5 animate-in fade-in duration-100">
      {/* Strength Bar */}
      {password && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Password Strength:</span>
            <span className={`font-semibold font-mono ${strength.textClass}`}>{strength.label}</span>
          </div>
          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${strength.color}`}
              style={{ width: `${strength.percent}%` }}
            />
          </div>
        </div>
      )}

      {/* Requirements Checklist */}
      {showRequirements && (
        <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80 space-y-1">
          <p className="text-[10px] uppercase font-semibold tracking-wider text-slate-400 mb-1">
            Password Requirements:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px]">
            {requirements.map((req) => (
              <div
                key={req.id}
                className={`flex items-center gap-1.5 transition-colors ${
                  req.met ? 'text-emerald-400 font-medium' : 'text-slate-500'
                }`}
              >
                {req.met ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                ) : (
                  <X className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                )}
                <span>{req.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
