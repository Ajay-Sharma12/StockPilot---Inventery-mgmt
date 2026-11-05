import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../../api/auth.api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Layers, Mail, ArrowLeft, ArrowRight, CheckCircle2, ShieldAlert } from 'lucide-react';

export const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');
  const [emailError, setEmailError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [demoResetUrl, setDemoResetUrl] = useState<string | null>(null);

  const validate = (): boolean => {
    let valid = true;
    setEmailError('');

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setEmailError('Email address is required.');
      valid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setEmailError('Please enter a valid email address.');
      valid = false;
    }

    return valid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    try {
      const response = await authApi.forgotPassword({
        email: email.trim().toLowerCase(),
        tenantSlug: tenantSlug.trim().toLowerCase() || undefined,
      });

      setIsSubmitted(true);
      if (response?.data?.resetUrl) {
        setDemoResetUrl(response.data.resetUrl);
      }
    } catch {
      // Regardless of error, show generic confirmation so account existence is never leaked
      setIsSubmitted(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background ambient glow */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-teal-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center z-10">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 text-white shadow-xl shadow-emerald-950/50 mb-4">
          <Layers className="w-8 h-8" />
        </div>
        <h2 className="text-3xl font-extrabold tracking-tight text-white">
          Reset Password
        </h2>
        <p className="mt-2 text-xs text-emerald-400 font-mono font-medium tracking-wide uppercase">
          StockPilot Account Recovery
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Enter your registered email to receive a secure recovery link
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10 px-4 sm:px-0">
        <div className="glass-panel p-8 sm:rounded-2xl shadow-2xl border border-slate-800">
          {isSubmitted ? (
            <div className="space-y-5 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>

              <div>
                <h3 className="text-base font-bold text-white">Check Your Inbox</h3>
                <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                  If an account exists for <span className="font-semibold text-emerald-400">{email}</span>, a secure password reset link has been sent.
                </p>
                <p className="text-[11px] text-slate-500 mt-2">
                  The link is valid for 60 minutes and can only be used once. Please check your spam folder if you do not see it.
                </p>
              </div>

              {/* Developer / Demo convenience banner */}
              {demoResetUrl && (
                <div className="p-3.5 rounded-xl bg-slate-900 border border-emerald-500/30 text-left space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    Demo / Local Environment Shortcut:
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Since this environment has simulated SMTP, you can use the direct reset link generated below:
                  </p>
                  <Link
                    to={demoResetUrl}
                    className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 underline font-mono break-all mt-1"
                  >
                    Open Password Reset Screen
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              )}

              <div className="pt-4 border-t border-slate-800">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Return to Sign In
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Email Address"
                type="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (emailError) setEmailError('');
                }}
                error={emailError}
                placeholder="user@organization.com"
                leftIcon={<Mail className="w-4 h-4" />}
              />

              <Input
                label="Organization Slug (Optional)"
                type="text"
                value={tenantSlug}
                onChange={(e) => setTenantSlug(e.target.value)}
                placeholder="e.g. apex-logistics"
                helperText="Leave blank if unknown or for super administrators"
              />

              <Button
                type="submit"
                variant="primary"
                className="w-full mt-2"
                isLoading={isLoading}
                disabled={isLoading}
              >
                {isLoading ? 'Sending Reset Link...' : 'Send Reset Link'}
              </Button>

              <div className="pt-4 border-t border-slate-800 text-center">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-emerald-400 transition-colors font-medium"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back to Sign In
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
