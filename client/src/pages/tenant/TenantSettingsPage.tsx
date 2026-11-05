import React, { useState, useEffect } from 'react';
import { tenantApi } from '../../api/tenant.api';
import { authApi } from '../../api/auth.api';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import { useToast } from '../../context/ToastContext';
import { PageHeader } from '../../components/common/PageHeader';
import { PermissionGate } from '../../components/common/PermissionGate';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { PasswordInput } from '../../components/ui/PasswordInput';
import { PasswordStrengthMeter } from '../../components/ui/PasswordStrengthMeter';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { Building2, Settings2, Globe, Save, ShieldCheck, KeyRound } from 'lucide-react';

export const TenantSettingsPage: React.FC = () => {
  const { tenant, refreshProfile } = useAuth();
  const { can } = usePermissions();
  const { success, error } = useToast();

  const [name, setName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [timezone, setTimezone] = useState('America/Chicago');
  const [dateFormat, setDateFormat] = useState('YYYY-MM-DD');
  const [fiscalYearStartMonth, setFiscalYearStartMonth] = useState('1');
  const [isSaving, setIsSaving] = useState(false);

  // Security & Password Change State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [currentPasswordError, setCurrentPasswordError] = useState('');
  const [newPasswordError, setNewPasswordError] = useState('');
  const [confirmNewPasswordError, setConfirmNewPasswordError] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  useEffect(() => {
    refreshProfile();
  }, []);

  useEffect(() => {
    if (tenant) {
      setName(tenant.name || '');
      // Only update contact fields if they have actual values from server
      // This prevents cached empty-state from overwriting real DB values
      if (tenant.contactEmail !== undefined) setContactEmail(tenant.contactEmail || '');
      if (tenant.phone !== undefined) setPhone(tenant.phone || '');
      setCurrency(tenant.settings?.currency || 'USD');
      setTimezone(tenant.settings?.timezone || 'America/Chicago');
      setDateFormat(tenant.settings?.dateFormat || 'YYYY-MM-DD');
      setFiscalYearStartMonth(String(tenant.settings?.fiscalYearStartMonth || 1));
    }
  }, [tenant]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      // Build profile payload — only include contactEmail/phone if user has a value
      // to prevent empty strings from overwriting stored data
      const profilePayload: Record<string, string> = {
        name: name.trim(),
      };
      // Always send contactEmail and phone — even empty — so user can deliberately clear them
      // but only if the field was actually shown/loaded (tenant data was received from server)
      profilePayload.contactEmail = contactEmail.trim();
      profilePayload.phone = phone.trim();

      await tenantApi.updateProfile(profilePayload);
      await tenantApi.updateSettings({
        currency,
        timezone,
        dateFormat,
        fiscalYearStartMonth: Number(fiscalYearStartMonth),
      });
      success('Organization profile and settings updated successfully!');
      await refreshProfile();
    } catch (err: any) {
      error(err.response?.data?.message || 'Failed to update settings');
    } finally {
      setIsSaving(false);
    }
  };

  const isPasswordComplex = (pwd: string): boolean => {
    return (
      pwd.length >= 8 &&
      /[A-Z]/.test(pwd) &&
      /[a-z]/.test(pwd) &&
      /[0-9]/.test(pwd) &&
      /[^A-Za-z0-9]/.test(pwd)
    );
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPasswordError('');
    setNewPasswordError('');
    setConfirmNewPasswordError('');

    let valid = true;
    if (!currentPassword) {
      setCurrentPasswordError('Current password is required.');
      valid = false;
    }

    if (!newPassword) {
      setNewPasswordError('New password is required.');
      valid = false;
    } else if (!isPasswordComplex(newPassword)) {
      setNewPasswordError(
        'Password must contain at least 8 characters, including uppercase, lowercase, number and special character.'
      );
      valid = false;
    }

    if (!confirmNewPassword) {
      setConfirmNewPasswordError('Please confirm your new password.');
      valid = false;
    } else if (newPassword !== confirmNewPassword) {
      setConfirmNewPasswordError('Passwords do not match.');
      valid = false;
    }

    if (!valid) return;

    setIsChangingPassword(true);
    try {
      await authApi.changePassword({ currentPassword, newPassword });
      success('Password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to update password.';
      if (msg.toLowerCase().includes('current password')) {
        setCurrentPasswordError('Current password does not match.');
      } else {
        error(msg);
      }
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organization Profile & Preferences"
        description="Configure tenant branding, currency, locale, and operational defaults"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Organization Settings' }]}
      />

      <form onSubmit={handleSaveProfile} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Organization Identity */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-emerald-400" />
                    Organization Identity
                  </CardTitle>
                  <CardDescription>Primary business entity and contact information</CardDescription>
                </div>
                <Badge variant="success" size="sm">
                  {tenant?.status || 'ACTIVE'}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <Input
                label="Organization Name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!can('tenant:update')}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Contact Email"
                  type="email"
                  required
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  disabled={!can('tenant:update')}
                />

                <Input
                  label="Phone Number"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={!can('tenant:update')}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Tenant Identifier (Slug)
                </label>
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 text-xs font-mono text-slate-400">
                  <Globe className="w-3.5 h-3.5 text-slate-500" />
                  <span>https://app.stockpilot.io/t/</span>
                  <span className="font-bold text-emerald-400">{tenant?.slug}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Localization & Preferences */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-emerald-400" />
                Regional & Localization Defaults
              </CardTitle>
              <CardDescription>System-wide currency, date formatting, and financial year</CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Select
                  label="Base Currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  disabled={!can('tenant:update')}
                  options={[
                    { value: 'USD', label: 'USD ($) - US Dollar' },
                    { value: 'EUR', label: 'EUR (€) - Euro' },
                    { value: 'GBP', label: 'GBP (£) - British Pound' },
                    { value: 'CAD', label: 'CAD ($) - Canadian Dollar' },
                    { value: 'AUD', label: 'AUD ($) - Australian Dollar' },
                    { value: 'JPY', label: 'JPY (¥) - Japanese Yen' },
                    { value: 'INR', label: 'INR (₹) - Indian Rupee' },
                  ]}
                />

                <Select
                  label="Date Format"
                  value={dateFormat}
                  onChange={(e) => setDateFormat(e.target.value)}
                  disabled={!can('tenant:update')}
                  options={[
                    { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (ISO 8601)' },
                    { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (US Standard)' },
                    { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (UK/EU Standard)' },
                  ]}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Select
                  label="System Timezone"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  disabled={!can('tenant:update')}
                  options={[
                    { value: 'America/Chicago', label: 'America/Chicago (CST/CDT)' },
                    { value: 'America/New_York', label: 'America/New_York (EST/EDT)' },
                    { value: 'America/Los_Angeles', label: 'America/Los_Angeles (PST/PDT)' },
                    { value: 'Europe/London', label: 'Europe/London (GMT/BST)' },
                    { value: 'Europe/Berlin', label: 'Europe/Berlin (CET/CEST)' },
                    { value: 'Asia/Tokyo', label: 'Asia/Tokyo (JST)' },
                    { value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST)' },
                    { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
                  ]}
                />

                <Select
                  label="Fiscal Year Start Month"
                  value={fiscalYearStartMonth}
                  onChange={(e) => setFiscalYearStartMonth(e.target.value)}
                  disabled={!can('tenant:update')}
                  options={[
                    { value: '1', label: 'January' },
                    { value: '4', label: 'April' },
                    { value: '7', label: 'July' },
                    { value: '10', label: 'October' },
                  ]}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <PermissionGate permission="tenant:update">
          <div className="flex justify-end">
            <Button
              type="submit"
              variant="primary"
              isLoading={isSaving}
              leftIcon={<Save className="w-4 h-4" />}
            >
              Save Organization Settings
            </Button>
          </div>
        </PermissionGate>
      </form>

      {/* Security & Password Management Section */}
      <div className="pt-6 border-t border-slate-800">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  Security & Password Management
                </CardTitle>
                <CardDescription>
                  Update your authentication credentials with enterprise-grade password complexity
                </CardDescription>
              </div>
              <Badge variant="outline" size="sm">
                Session Active
              </Badge>
            </div>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4 max-w-xl">
              <div>
                <PasswordInput
                  label="Current Password"
                  required
                  value={currentPassword}
                  onChange={(e) => {
                    setCurrentPassword(e.target.value);
                    if (currentPasswordError) setCurrentPasswordError('');
                  }}
                  error={currentPasswordError}
                  placeholder="Enter your current password"
                  leftIcon={<KeyRound className="w-4 h-4" />}
                />
              </div>

              <div>
                <PasswordInput
                  label="New Password"
                  required
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    if (newPasswordError) setNewPasswordError('');
                  }}
                  error={newPasswordError}
                  placeholder="Enter new strong password"
                  leftIcon={<KeyRound className="w-4 h-4" />}
                />
                <PasswordStrengthMeter password={newPassword} />
              </div>

              <div>
                <PasswordInput
                  label="Confirm New Password"
                  required
                  value={confirmNewPassword}
                  onChange={(e) => {
                    setConfirmNewPassword(e.target.value);
                    if (confirmNewPasswordError) setConfirmNewPasswordError('');
                  }}
                  error={confirmNewPasswordError}
                  placeholder="Re-enter new password to verify"
                  leftIcon={<KeyRound className="w-4 h-4" />}
                />
              </div>

              <div className="pt-2 flex justify-end">
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={isChangingPassword}
                  disabled={isChangingPassword}
                  leftIcon={<KeyRound className="w-4 h-4" />}
                >
                  {isChangingPassword ? 'Updating Password...' : 'Update Password'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
