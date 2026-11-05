import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { authApi } from '../../api/auth.api';
import { useToast } from '../../context/ToastContext';
import { Button } from '../../components/ui/Button';
import { PasswordInput } from '../../components/ui/PasswordInput';
import { PasswordStrengthMeter } from '../../components/ui/PasswordStrengthMeter';
import { Layers, KeyRound, AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react';

export const ResetPassword: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();
  const { success } = useToast();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [apiError, setApiError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Validate password complexity
  const isPasswordComplex = (pwd: string): boolean => {
    return (
      pwd.length >= 8 &&
      /[A-Z]/.test(pwd) &&
      /[a-z]/.test(pwd) &&
      /[0-9]/.test(pwd) &&
      /[^A-Za-z0-9]/.test(pwd)
    );
  };

  const validate = (): boolean => {
    let valid = true;
    setPasswordError('');
    setConfirmPasswordError('');
    setApiError('');

    if (!password) {
      setPasswordError('Password is required.');
      valid = false;
    } else if (!isPasswordComplex(password)) {
      setPasswordError(
        'Password must contain at least 8 characters, including uppercase, lowercase, number and special character.'
      );
      valid = false;
    }

    if (!confirmPassword) {
      setConfirmPasswordError('Please confirm your password.');
      valid = false;
    } else if (password !== confirmPassword) {
      setConfirmPasswordError('Passwords do not match.');
      valid = false;
    }

    return valid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setApiError('This password reset link is invalid.');
      return;
    }

    if (!validate()) return;

    setIsLoading(true);
    setApiError('');

    try {
      await authApi.resetPassword({ token, password });
      setIsSuccess(true);
      success('Password reset successfully. Please sign in with your new password.');
      setTimeout(() => {
        navigate('/login', {
          state: { message: 'Password reset successfully. Please sign in with your new password.' },
        });
      }, 2000);
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to reset password. The link may have expired.';
      setApiError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-teal-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center z-10">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 text-white shadow-xl shadow-emerald-950/50 mb-4">
          <Layers className="w-8 h-8" />
        </div>
        <h2 className="text-3xl font-extrabold tracking-tight text-white">
          Create New Password
        </h2>
        <p className="mt-2 text-xs text-emerald-400 font-mono font-medium tracking-wide uppercase">
          Secure Credential Update
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Enter and verify your new account password below
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10 px-4 sm:px-0">
        <div className="glass-panel p-8 sm:rounded-2xl shadow-2xl border border-slate-800">
          {!token ? (
            <div className="space-y-4 text-center">
              <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-white">Missing Password Reset Token</h3>
              <p className="text-xs text-slate-400">
                This link is incomplete or missing its verification token. Please request a new recovery link.
              </p>
              <Link to="/forgot-password">
                <Button variant="outline" className="w-full mt-2">
                  Request New Reset Link
                </Button>
              </Link>
            </div>
          ) : isSuccess ? (
            <div className="space-y-4 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">Password Reset Successfully</h3>
              <p className="text-xs text-slate-300">
                Your credentials have been securely updated. Redirecting you to the sign-in screen...
              </p>
              <Link to="/login">
                <Button variant="primary" className="w-full mt-2" rightIcon={<ArrowRight className="w-4 h-4" />}>
                  Go to Sign In Now
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {apiError && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                  <span>{apiError}</span>
                </div>
              )}

              <div>
                <PasswordInput
                  label="New Password"
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (passwordError) setPasswordError('');
                  }}
                  error={passwordError}
                  placeholder="Enter strong password"
                  leftIcon={<KeyRound className="w-4 h-4" />}
                />
                <PasswordStrengthMeter password={password} />
              </div>

              <div>
                <PasswordInput
                  label="Confirm New Password"
                  required
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (confirmPasswordError) setConfirmPasswordError('');
                  }}
                  error={confirmPasswordError}
                  placeholder="Re-enter password to confirm"
                  leftIcon={<KeyRound className="w-4 h-4" />}
                />
              </div>

              <Button
                type="submit"
                variant="primary"
                className="w-full mt-4"
                isLoading={isLoading}
                disabled={isLoading}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                {isLoading ? 'Resetting Password...' : 'Reset Password & Sign In'}
              </Button>

              <div className="pt-4 border-t border-slate-800 text-center text-xs text-slate-400">
                Remember your password?{' '}
                <Link to="/login" className="text-emerald-400 hover:underline font-medium">
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
