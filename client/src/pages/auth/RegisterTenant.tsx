import React, { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { PasswordInput } from '../../components/ui/PasswordInput';
import { PhoneInput } from '../../components/ui/PhoneInput';
import { CountrySelect } from '../../components/ui/CountrySelect';
import { CustomSelect } from '../../components/ui/CustomSelect';
import { PasswordStrengthMeter } from '../../components/ui/PasswordStrengthMeter';
import { TermsModal } from '../../components/ui/TermsModal';
import { Layers, ArrowRight, Check, Zap, Boxes, Sparkles, Crown, Building2, User, Mail, MapPin } from 'lucide-react';

const ORGANIZATION_TYPES = [
  { value: 'Manufacturing', label: 'Manufacturing & Assembly' },
  { value: 'Retail & Wholesale', label: 'Retail, Wholesale & Trading' },
  { value: 'Logistics & 3PL', label: 'Logistics, Warehousing & 3PL' },
  { value: 'Pharmaceutical', label: 'Pharmaceutical & Healthcare' },
  { value: 'Food & FMCG', label: 'Food, Beverage & FMCG' },
  { value: 'Technology', label: 'Technology & Hardware Electronics' },
  { value: 'Automotive', label: 'Automotive & Industrial Machinery' },
  { value: 'Construction', label: 'Construction & Building Materials' },
  { value: 'Other', label: 'Other Enterprise Operations' },
];

export const RegisterTenant: React.FC = () => {
  const { registerTenant, isLoading } = useAuth();
  const navigate = useNavigate();

  // Form Fields
  const [tenantName, setTenantName] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');
  const [organizationType, setOrganizationType] = useState('Manufacturing');
  const [country, setCountry] = useState('United States');
  const [countryCode, setCountryCode] = useState('US');
  const [businessAddress, setBusinessAddress] = useState('');
  const [plan, setPlan] = useState('GROWTH');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [isPhoneValid, setIsPhoneValid] = useState(true);
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Field-level inline errors
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Field element refs for auto-focus on first invalid field
  const fieldRefs = {
    tenantName: useRef<HTMLInputElement>(null),
    tenantSlug: useRef<HTMLInputElement>(null),
    adminName: useRef<HTMLInputElement>(null),
    adminEmail: useRef<HTMLInputElement>(null),
    phone: useRef<HTMLDivElement>(null),
    adminPassword: useRef<HTMLInputElement>(null),
    confirmPassword: useRef<HTMLInputElement>(null),
    termsAccepted: useRef<HTMLInputElement>(null),
  };

  const handleNameChange = (val: string) => {
    setTenantName(val);
    if (errors.tenantName) setErrors((prev) => ({ ...prev, tenantName: '' }));

    // Auto-generate slug if not manually divergent
    const generated = val
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
    setTenantSlug(generated);
    if (errors.tenantSlug) setErrors((prev) => ({ ...prev, tenantSlug: '' }));
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

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    let firstErrorField: keyof typeof fieldRefs | null = null;

    // Company Name
    const cleanName = tenantName.trim();
    if (!cleanName) {
      newErrors.tenantName = 'Company name is required.';
      if (!firstErrorField) firstErrorField = 'tenantName';
    } else if (cleanName.length < 2) {
      newErrors.tenantName = 'Company name must be at least 2 characters.';
      if (!firstErrorField) firstErrorField = 'tenantName';
    } else if (cleanName.length > 100) {
      newErrors.tenantName = 'Company name must not exceed 100 characters.';
      if (!firstErrorField) firstErrorField = 'tenantName';
    }

    // Slug / Workspace Identifier
    const cleanSlug = tenantSlug.trim().toLowerCase();
    if (!cleanSlug) {
      newErrors.tenantSlug = 'Workspace identifier is required.';
      if (!firstErrorField) firstErrorField = 'tenantSlug';
    } else if (!/^[a-z0-9-]+$/.test(cleanSlug)) {
      newErrors.tenantSlug = 'Workspace identifier can only contain lowercase letters, numbers, and hyphens.';
      if (!firstErrorField) firstErrorField = 'tenantSlug';
    }

    // Contact Person Name
    const cleanAdminName = adminName.trim();
    if (!cleanAdminName) {
      newErrors.adminName = 'Full name is required.';
      if (!firstErrorField) firstErrorField = 'adminName';
    } else if (cleanAdminName.length < 2) {
      newErrors.adminName = 'Please enter a valid name (at least 2 characters).';
      if (!firstErrorField) firstErrorField = 'adminName';
    }

    // Email
    const cleanEmail = adminEmail.trim().toLowerCase();
    if (!cleanEmail) {
      newErrors.adminEmail = 'Email address is required.';
      if (!firstErrorField) firstErrorField = 'adminEmail';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      newErrors.adminEmail = 'Please enter a valid email address.';
      if (!firstErrorField) firstErrorField = 'adminEmail';
    }

    // Phone (optional, but if provided, must be valid for country)
    if (phone && !isPhoneValid) {
      newErrors.phone = 'Phone number is not valid for the selected country.';
      if (!firstErrorField) firstErrorField = 'phone';
    }

    // Password
    if (!adminPassword) {
      newErrors.adminPassword = 'Password is required.';
      if (!firstErrorField) firstErrorField = 'adminPassword';
    } else if (!isPasswordComplex(adminPassword)) {
      newErrors.adminPassword =
        'Password must contain at least 8 characters, including uppercase, lowercase, number and special character.';
      if (!firstErrorField) firstErrorField = 'adminPassword';
    }

    // Confirm Password
    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password.';
      if (!firstErrorField) firstErrorField = 'confirmPassword';
    } else if (adminPassword !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match.';
      if (!firstErrorField) firstErrorField = 'confirmPassword';
    }

    // Terms
    if (!termsAccepted) {
      newErrors.termsAccepted = 'Please accept the terms and conditions.';
      if (!firstErrorField) firstErrorField = 'termsAccepted';
    }

    setErrors(newErrors);

    // Auto-focus / scroll to the first invalid field
    if (firstErrorField && fieldRefs[firstErrorField]?.current) {
      const el = fieldRefs[firstErrorField].current;
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if ('focus' in el) {
          (el as HTMLElement).focus();
        }
      }
    }

    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || isLoading) return;

    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await registerTenant({
        tenantName: tenantName.trim(),
        tenantSlug: tenantSlug.trim().toLowerCase(),
        organizationType,
        country,
        businessAddress: businessAddress.trim(),
        plan,
        adminName: adminName.trim(),
        adminEmail: adminEmail.trim().toLowerCase(),
        adminPassword,
        phone: phone || undefined,
        termsAccepted: true,
      });
      navigate('/dashboard');
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Organization registration failed.';
      if (msg.toLowerCase().includes('identifier') || msg.toLowerCase().includes('slug') || msg.toLowerCase().includes('already exists')) {
        setErrors((prev) => ({
          ...prev,
          tenantSlug: 'An organization with this identifier already exists.',
        }));
      } else if (msg.toLowerCase().includes('email')) {
        setErrors((prev) => ({
          ...prev,
          adminEmail: 'An account may already exist with this email. Please sign in or use password recovery.',
        }));
      } else {
        setErrors((prev) => ({ ...prev, form: msg }));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative">
      <div className="sm:mx-auto sm:w-full sm:max-w-2xl text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 text-white shadow-xl shadow-emerald-950/50 mb-3">
          <Layers className="w-6 h-6" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-white">
          Register New Organization
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Deploy an isolated, multi-tenant workspace with role-based access control
        </p>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-2xl px-4 sm:px-0">
        <div className="glass-panel p-8 sm:rounded-2xl shadow-2xl border border-slate-800">
          {errors.form && (
            <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
              {errors.form}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            {/* Section 1: Organization Details */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
                <Building2 className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Organization & Business Entity
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  ref={fieldRefs.tenantName}
                  label="Company / Organization Name"
                  required
                  value={tenantName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  error={errors.tenantName}
                  placeholder="Apex Global Logistics Ltd"
                />

                <Input
                  ref={fieldRefs.tenantSlug}
                  label="Workspace Identifier (Slug)"
                  required
                  value={tenantSlug}
                  onChange={(e) => {
                    setTenantSlug(e.target.value);
                    if (errors.tenantSlug) setErrors((prev) => ({ ...prev, tenantSlug: '' }));
                  }}
                  error={errors.tenantSlug}
                  placeholder="apex-global"
                  helperText="Workspace subdomain prefix"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <CustomSelect
                  label="Organization Type"
                  value={organizationType}
                  onChange={(val) => setOrganizationType(val)}
                  options={ORGANIZATION_TYPES}
                />

                <CountrySelect
                  label="Country of Incorporation"
                  value={country}
                  onChange={(cName, cCode) => {
                    setCountry(cName);
                    setCountryCode(cCode);
                  }}
                />
              </div>

              <Input
                label="Primary Business Address (Optional)"
                value={businessAddress}
                onChange={(e) => setBusinessAddress(e.target.value)}
                placeholder="100 Enterprise Way, Suite 400"
                leftIcon={<MapPin className="w-4 h-4" />}
              />
            </div>

            {/* Section 2: Subscription Plan Tier */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between pb-1">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Select Subscription Plan
                </label>
                <span className="text-[10px] text-emerald-400 font-mono">14-Day Full Feature Trial Included</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  {
                    id: 'FREE',
                    name: 'Free Tier',
                    price: '$0',
                    period: '/mo',
                    badge: 'Starter',
                    badgeColor: 'bg-slate-800 text-slate-400 border-slate-700',
                    facilities: '1 Warehouse • 3 Users',
                    features: 'Essential Stock & Ledger',
                    icon: <Zap className="w-3.5 h-3.5 text-slate-400" />,
                  },
                  {
                    id: 'STARTER',
                    name: 'Starter Tier',
                    price: '$49',
                    period: '/mo',
                    badge: 'Growing',
                    badgeColor: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
                    facilities: '2 Warehouses • 10 Users',
                    features: 'Batch Tracking & Alerts',
                    icon: <Boxes className="w-3.5 h-3.5 text-blue-400" />,
                  },
                  {
                    id: 'GROWTH',
                    name: 'Growth Tier',
                    price: '$149',
                    period: '/mo',
                    badge: 'Recommended',
                    badgeColor: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
                    facilities: '10 Warehouses • 50 Users',
                    features: 'Full QC & Manufacturing',
                    icon: <Sparkles className="w-3.5 h-3.5 text-emerald-400" />,
                  },
                  {
                    id: 'ENTERPRISE',
                    name: 'Enterprise Tier',
                    price: 'Custom',
                    period: '',
                    badge: 'Unlimited',
                    badgeColor: 'bg-purple-500/10 text-purple-300 border-purple-500/20',
                    facilities: 'Unlimited Facilities • Seats',
                    features: 'Full API & Governance',
                    icon: <Crown className="w-3.5 h-3.5 text-purple-400" />,
                  },
                ].map((tier) => {
                  const isSelected = plan === tier.id;
                  return (
                    <div
                      key={tier.id}
                      onClick={() => setPlan(tier.id)}
                      className={`p-3 rounded-xl border text-left cursor-pointer transition-all duration-150 flex flex-col justify-between ${
                        isSelected
                          ? 'bg-emerald-500/10 border-emerald-500 shadow-md ring-1 ring-emerald-500/40'
                          : 'bg-slate-900/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${isSelected ? 'bg-emerald-500/20' : 'bg-slate-800'}`}>
                              {tier.icon}
                            </div>
                            <span className="text-xs font-bold text-white">{tier.name}</span>
                          </div>
                          <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border shrink-0 ${tier.badgeColor}`}>
                            {tier.badge}
                          </span>
                        </div>

                        <div className="flex items-baseline gap-1 my-1">
                          <span className="text-sm font-black text-white">{tier.price}</span>
                          {tier.period && <span className="text-[10px] text-slate-400">{tier.period}</span>}
                        </div>

                        <p className="text-[10px] text-slate-400 font-mono">{tier.facilities}</p>
                        <p className="text-[10px] text-slate-500 truncate mt-0.5">{tier.features}</p>
                      </div>

                      <div className="mt-2 pt-2 border-t border-slate-800/60 flex items-center justify-between">
                        <span className="text-[10px] text-slate-400">Select Plan</span>
                        <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                          isSelected ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600 bg-slate-800'
                        }`}>
                          {isSelected && <Check className="w-2.5 h-2.5 text-slate-950 stroke-[3]" />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Section 3: Primary Tenant Administrator */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
                <User className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Primary Tenant Administrator
                </h3>
              </div>

              <Input
                ref={fieldRefs.adminName}
                label="Contact Person Full Name"
                required
                value={adminName}
                onChange={(e) => {
                  setAdminName(e.target.value);
                  if (errors.adminName) setErrors((prev) => ({ ...prev, adminName: '' }));
                }}
                error={errors.adminName}
                placeholder="Jane Doe"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  ref={fieldRefs.adminEmail}
                  label="Email Address"
                  type="email"
                  required
                  value={adminEmail}
                  onChange={(e) => {
                    setAdminEmail(e.target.value);
                    if (errors.adminEmail) setErrors((prev) => ({ ...prev, adminEmail: '' }));
                  }}
                  error={errors.adminEmail}
                  placeholder="admin@organization.com"
                  leftIcon={<Mail className="w-4 h-4" />}
                />

                <div ref={fieldRefs.phone}>
                  <PhoneInput
                    label="Phone Number"
                    defaultCountry={(countryCode as any) || 'US'}
                    value={phone}
                    onChange={(normalizedE164, valid) => {
                      setPhone(normalizedE164);
                      setIsPhoneValid(valid);
                      if (errors.phone) setErrors((prev) => ({ ...prev, phone: '' }));
                    }}
                    error={errors.phone}
                    helperText="Stored in normalized international E.164 format"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <PasswordInput
                    ref={fieldRefs.adminPassword}
                    label="Password"
                    required
                    value={adminPassword}
                    onChange={(e) => {
                      setAdminPassword(e.target.value);
                      if (errors.adminPassword) setErrors((prev) => ({ ...prev, adminPassword: '' }));
                    }}
                    error={errors.adminPassword}
                    placeholder="Create strong password"
                  />
                  <PasswordStrengthMeter password={adminPassword} />
                </div>

                <div>
                  <PasswordInput
                    ref={fieldRefs.confirmPassword}
                    label="Confirm Password"
                    required
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (errors.confirmPassword) setErrors((prev) => ({ ...prev, confirmPassword: '' }));
                    }}
                    error={errors.confirmPassword}
                    placeholder="Re-enter password"
                  />
                </div>
              </div>
            </div>

            {/* Section 4: Terms and Conditions Checkbox */}
            <div className="pt-2">
              <div className="flex items-start gap-3">
                <input
                  ref={fieldRefs.termsAccepted}
                  id="terms-checkbox"
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => {
                    setTermsAccepted(e.target.checked);
                    if (errors.termsAccepted) setErrors((prev) => ({ ...prev, termsAccepted: '' }));
                  }}
                  className="mt-0.5 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500 h-4 w-4 cursor-pointer"
                />
                <label htmlFor="terms-checkbox" className="text-xs text-slate-300 leading-normal cursor-pointer select-none">
                  I agree to the{' '}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setIsTermsModalOpen(true);
                    }}
                    className="text-emerald-400 hover:text-emerald-300 underline font-medium inline"
                  >
                    Terms & Conditions and Privacy Policy
                  </button>
                  .
                </label>
              </div>
              {errors.termsAccepted && (
                <p className="text-xs text-rose-400 font-medium mt-1.5 ml-7">{errors.termsAccepted}</p>
              )}
            </div>

            <Button
              type="submit"
              variant="primary"
              className="w-full mt-4"
              isLoading={isSubmitting || isLoading}
              disabled={isSubmitting || isLoading}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              {isSubmitting || isLoading ? 'Provisioning organization workspace...' : 'Provision Organization & Launch StockPilot'}
            </Button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-800/80 text-center text-xs text-slate-400">
            Already have an organization workspace?{' '}
            <Link to="/login" className="text-emerald-400 hover:underline font-medium">
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>

      <TermsModal
        isOpen={isTermsModalOpen}
        onClose={() => setIsTermsModalOpen(false)}
        onAccept={() => {
          setTermsAccepted(true);
          if (errors.termsAccepted) setErrors((prev) => ({ ...prev, termsAccepted: '' }));
        }}
      />
    </div>
  );
};
