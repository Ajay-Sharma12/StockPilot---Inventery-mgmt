import React, { useState, useEffect } from 'react';
import {
  X,
  Mail,
  Phone,
  Send,
  CheckCircle2,
  AlertTriangle,
  Key,
  ShieldCheck,
  RefreshCw,
  Info,
  Server,
} from 'lucide-react';
import { procurementApi } from '../../api/procurement.api';
import { useToast } from '../../context/ToastContext';

interface NotificationGatewayModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export const NotificationGatewayModal: React.FC<NotificationGatewayModalProps> = ({
  isOpen,
  onClose,
  onSaved,
}) => {
  const { success: toastSuccess, error: toastError } = useToast();
  const [activeTab, setActiveTab] = useState<'email' | 'sms'>('email');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<any>(null);

  // Email Config State
  const [emailProvider, setEmailProvider] = useState<'gmail' | 'smtp'>('gmail');
  const [smtpHost, setSmtpHost] = useState('smtp.gmail.com');
  const [smtpPort, setSmtpPort] = useState(465);
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [fromEmail, setFromEmail] = useState('');
  const [fromName, setFromName] = useState('StockPilot Operations');

  // SMS Config State
  const [smsProvider, setSmsProvider] = useState<'fast2sms' | 'twilio' | 'none'>('fast2sms');
  const [fast2smsApiKey, setFast2smsApiKey] = useState('');
  const [twilioAccountSid, setTwilioAccountSid] = useState('');
  const [twilioAuthToken, setTwilioAuthToken] = useState('');
  const [twilioFromNumber, setTwilioFromNumber] = useState('');
  const [smsFromName, setSmsFromName] = useState('StockPilot');

  // Diagnostics State
  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [testingEmail, setTestingEmail] = useState(false);
  const [emailTestResult, setEmailTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const [testPhoneNumber, setTestPhoneNumber] = useState('');
  const [testingSMS, setTestingSMS] = useState(false);
  const [smsTestResult, setSmsTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadGatewayStatus();
    }
  }, [isOpen]);

  const loadGatewayStatus = async () => {
    try {
      setLoading(true);
      const data = await procurementApi.getNotificationGatewayStatus();
      setStatus(data);

      if (data.email) {
        setEmailProvider(data.email.provider === 'smtp' ? 'smtp' : 'gmail');
        setSmtpHost(data.email.smtpHost || (data.email.provider === 'gmail' ? 'smtp.gmail.com' : ''));
        setSmtpPort(data.email.smtpPort || 465);
        setSmtpUser(data.email.smtpUser || '');
        setFromEmail(data.email.fromEmail || '');
        setFromName(data.email.fromName || 'StockPilot Operations');
        if (data.email.smtpUser && !testEmailAddress) {
          setTestEmailAddress(data.email.smtpUser);
        }
      }

      if (data.sms) {
        setSmsProvider(data.sms.provider || 'fast2sms');
        setTwilioAccountSid(data.sms.twilioAccountSid || '');
        setTwilioFromNumber(data.sms.twilioFromNumber || '');
        setSmsFromName(data.sms.fromName || 'StockPilot');
      }
    } catch (err: any) {
      toastError('Could not load notification gateway status');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    try {
      setSaving(true);
      const payload: any = {
        email: {
          enabled: Boolean(smtpUser),
          provider: emailProvider,
          smtpHost: emailProvider === 'gmail' ? 'smtp.gmail.com' : smtpHost,
          smtpPort: emailProvider === 'gmail' ? 465 : Number(smtpPort),
          smtpSecure: emailProvider === 'gmail' ? true : Number(smtpPort) === 465,
          smtpUser: smtpUser.trim(),
          smtpPass: smtpPass.trim(),
          fromEmail: fromEmail.trim() || smtpUser.trim(),
          fromName: fromName.trim() || 'StockPilot Operations',
        },
        sms: {
          enabled: smsProvider !== 'none',
          provider: smsProvider,
          fast2smsApiKey: fast2smsApiKey.trim(),
          twilioAccountSid: twilioAccountSid.trim(),
          twilioAuthToken: twilioAuthToken.trim(),
          twilioFromNumber: twilioFromNumber.trim(),
          fromName: smsFromName.trim() || 'StockPilot',
        },
      };

      const updated = await procurementApi.saveNotificationGatewayConfig(payload);
      setStatus(updated);
      toastSuccess('Notification Gateway credentials saved & activated!');
      if (onSaved) onSaved();
    } catch (err: any) {
      toastError(err.response?.data?.message || 'Failed to save gateway configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmail = async () => {
    if (!testEmailAddress.trim()) {
      toastError('Please enter a target email address for test delivery');
      return;
    }
    try {
      setTestingEmail(true);
      setEmailTestResult(null);
      const res = await procurementApi.testNotificationEmail(testEmailAddress.trim());
      setEmailTestResult({
        success: true,
        message: res.message || `Live test email successfully sent to ${testEmailAddress}!`,
      });
      toastSuccess('Real test email delivered to inbox!');
      loadGatewayStatus();
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.message || 'SMTP delivery failed';
      setEmailTestResult({ success: false, message: errorMsg });
      toastError('Email delivery failed: ' + errorMsg);
    } finally {
      setTestingEmail(false);
    }
  };

  const handleTestSMS = async () => {
    if (!testPhoneNumber.trim()) {
      toastError('Please enter a target phone number for test SMS');
      return;
    }
    try {
      setTestingSMS(true);
      setSmsTestResult(null);
      const res = await procurementApi.testNotificationSMS(testPhoneNumber.trim());
      setSmsTestResult({
        success: true,
        message: res.message || `Live test SMS successfully sent to ${testPhoneNumber}!`,
      });
      toastSuccess('Real test SMS sent!');
      loadGatewayStatus();
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.message || 'SMS delivery failed';
      setSmsTestResult({ success: false, message: errorMsg });
      toastError('SMS delivery failed: ' + errorMsg);
    } finally {
      setTestingSMS(false);
    }
  };

  if (!isOpen) return null;

  const isEmailConfigured = status?.email?.status === 'CONFIGURED';
  const isSMSConfigured = status?.sms?.status === 'CONFIGURED';

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <Server className="w-5 h-5 text-indigo-400" />
              <h2 className="text-lg font-bold text-white">Live Email & SMS Gateway Settings</h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Configure real SMTP and SMS gateways so supplier invites, quotes, and POs land in real inboxes and phones.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Status Indicators */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div
            className={`p-3 rounded-xl border flex items-center justify-between ${
              isEmailConfigured
                ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-950/20 border-rose-500/30 text-rose-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4" />
              <div>
                <p className="font-semibold">Email Gateway</p>
                <p className="text-[11px] opacity-80">
                  {isEmailConfigured ? `Active (${status?.email?.smtpUser})` : 'Not Configured (Emails Skipped)'}
                </p>
              </div>
            </div>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                isEmailConfigured ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
              }`}
            >
              {isEmailConfigured ? 'LIVE ON' : 'OFF'}
            </span>
          </div>

          <div
            className={`p-3 rounded-xl border flex items-center justify-between ${
              isSMSConfigured
                ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                : 'bg-amber-950/20 border-amber-500/30 text-amber-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4" />
              <div>
                <p className="font-semibold">SMS Gateway</p>
                <p className="text-[11px] opacity-80">
                  {isSMSConfigured ? `Active (${status?.sms?.provider})` : 'Not Configured (SMS Skipped)'}
                </p>
              </div>
            </div>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                isSMSConfigured ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
              }`}
            >
              {isSMSConfigured ? 'LIVE ON' : 'OPTIONAL'}
            </span>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex border-b border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab('email')}
            className={`flex items-center gap-1.5 px-4 py-2 font-semibold border-b-2 transition ${
              activeTab === 'email'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            Email (Gmail / SMTP)
          </button>
          <button
            onClick={() => setActiveTab('sms')}
            className={`flex items-center gap-1.5 px-4 py-2 font-semibold border-b-2 transition ${
              activeTab === 'sms'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Phone className="w-3.5 h-3.5" />
            SMS (Fast2SMS / Twilio)
          </button>
        </div>

        {/* Email Tab */}
        {activeTab === 'email' && (
          <div className="space-y-4 text-xs">
            {/* Provider Selector */}
            <div className="flex items-center gap-4 bg-slate-800/40 p-2.5 rounded-xl border border-slate-800">
              <span className="text-slate-400 font-semibold">Email Service:</span>
              <label className="flex items-center gap-1.5 cursor-pointer text-slate-200">
                <input
                  type="radio"
                  name="emailProvider"
                  value="gmail"
                  checked={emailProvider === 'gmail'}
                  onChange={() => {
                    setEmailProvider('gmail');
                    setSmtpHost('smtp.gmail.com');
                    setSmtpPort(465);
                  }}
                />
                Gmail (Fastest 1-Click Setup)
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer text-slate-200">
                <input
                  type="radio"
                  name="emailProvider"
                  value="smtp"
                  checked={emailProvider === 'smtp'}
                  onChange={() => setEmailProvider('smtp')}
                />
                Custom SMTP (Hostinger, Brevo, AWS SES)
              </label>
            </div>

            {/* Gmail Help Guide */}
            {emailProvider === 'gmail' && (
              <div className="bg-indigo-950/30 border border-indigo-500/30 p-3 rounded-xl text-indigo-200 space-y-1.5 text-[11px] leading-relaxed">
                <div className="flex items-center gap-1.5 font-semibold text-indigo-300">
                  <Info className="w-4 h-4" />
                  How to generate Gmail 16-digit App Password (30 Seconds):
                </div>
                <ol className="list-decimal pl-5 space-y-1">
                  <li>Apne Google Account (<strong className="text-white">myaccount.google.com/security</strong>) me jayein.</li>
                  <li><strong>2-Step Verification</strong> ON karein (agar pehle se ON hai toh theek hai).</li>
                  <li>Search bar me <strong className="text-white">"App Passwords"</strong> search karein.</li>
                  <li>App name <strong className="text-white">"StockPilot"</strong> likhein aur <strong>Create</strong> dabayein.</li>
                  <li>Wahan jo <strong className="text-emerald-400 font-mono">16-digit password</strong> mile (e.g. <code>abcd efgh ijkl mnop</code>), use niche paste karein!</li>
                </ol>
              </div>
            )}

            {/* Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 mb-1">
                  {emailProvider === 'gmail' ? 'Your Gmail Address *' : 'SMTP Username / Email *'}
                </label>
                <input
                  type="email"
                  value={smtpUser}
                  onChange={(e) => setSmtpUser(e.target.value)}
                  placeholder="e.g. operations@gmail.com"
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">
                  {emailProvider === 'gmail' ? 'Google 16-Digit App Password *' : 'SMTP Password *'}
                </label>
                <input
                  type="password"
                  value={smtpPass}
                  onChange={(e) => setSmtpPass(e.target.value)}
                  placeholder={status?.email?.hasPassword ? '•••••••• (Leave blank to keep existing)' : '16-character App Password'}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 outline-none font-mono"
                />
              </div>

              {emailProvider === 'smtp' && (
                <>
                  <div>
                    <label className="block text-slate-400 mb-1">SMTP Host</label>
                    <input
                      type="text"
                      value={smtpHost}
                      onChange={(e) => setSmtpHost(e.target.value)}
                      placeholder="e.g. smtp.brevo.com"
                      className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">SMTP Port</label>
                    <input
                      type="number"
                      value={smtpPort}
                      onChange={(e) => setSmtpPort(Number(e.target.value))}
                      placeholder="465 or 587"
                      className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-slate-400 mb-1">Sender Display Name</label>
                <input
                  type="text"
                  value={fromName}
                  onChange={(e) => setFromName(e.target.value)}
                  placeholder="e.g. StockPilot Procurement"
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">From Email Address (Optional)</label>
                <input
                  type="email"
                  value={fromEmail}
                  onChange={(e) => setFromEmail(e.target.value)}
                  placeholder={smtpUser || 'no-reply@stockpilot.io'}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs"
                />
              </div>
            </div>

            {/* Test Email Section */}
            <div className="bg-slate-800/40 border border-slate-800 p-3.5 rounded-xl space-y-2 mt-2">
              <span className="font-semibold text-slate-300 block">🧪 Test Live Email Delivery</span>
              <p className="text-[11px] text-slate-400">
                Enter your own email address to verify that real emails actually arrive in your inbox right now.
              </p>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={testEmailAddress}
                  onChange={(e) => setTestEmailAddress(e.target.value)}
                  placeholder="Enter email address (e.g. your-email@gmail.com)..."
                  className="flex-1 bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-1.5 text-xs outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={handleTestEmail}
                  disabled={testingEmail || !testEmailAddress.trim()}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shrink-0 shadow-lg shadow-emerald-600/20"
                >
                  <Send className="w-3.5 h-3.5" />
                  {testingEmail ? 'Sending...' : 'Send Email 🚀'}
                </button>
              </div>

              {emailTestResult && (
                <div
                  className={`p-2.5 rounded-lg text-[11px] flex items-start gap-2 ${
                    emailTestResult.success
                      ? 'bg-emerald-950/30 text-emerald-300 border border-emerald-800/50'
                      : 'bg-rose-950/30 text-rose-300 border border-rose-800/50'
                  }`}
                >
                  {emailTestResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <span>{emailTestResult.message}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* SMS Tab */}
        {activeTab === 'sms' && (
          <div className="space-y-4 text-xs">
            <div className="flex items-center gap-4 bg-slate-800/40 p-2.5 rounded-xl border border-slate-800">
              <span className="text-slate-400 font-semibold">SMS Provider:</span>
              <label className="flex items-center gap-1.5 cursor-pointer text-slate-200">
                <input
                  type="radio"
                  name="smsProvider"
                  value="fast2sms"
                  checked={smsProvider === 'fast2sms'}
                  onChange={() => setSmsProvider('fast2sms')}
                />
                Fast2SMS (India - Quick API Key)
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer text-slate-200">
                <input
                  type="radio"
                  name="smsProvider"
                  value="twilio"
                  checked={smsProvider === 'twilio'}
                  onChange={() => setSmsProvider('twilio')}
                />
                Twilio (International)
              </label>
            </div>

            {smsProvider === 'fast2sms' && (
              <div className="space-y-3">
                <div className="bg-amber-950/20 border border-amber-500/30 p-2.5 rounded-xl text-amber-200 text-[11px]">
                  Fast2SMS (<strong className="text-white">fast2sms.com</strong>) provides instant SMS in India. Free test credits available upon signup.
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Fast2SMS Authorization API Key *</label>
                  <input
                    type="password"
                    value={fast2smsApiKey}
                    onChange={(e) => setFast2smsApiKey(e.target.value)}
                    placeholder={status?.sms?.hasFast2SmsKey ? '•••••••• (Leave blank to keep existing)' : 'Enter Fast2SMS API Key'}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs font-mono"
                  />
                </div>
              </div>
            )}

            {smsProvider === 'twilio' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Twilio Account SID *</label>
                  <input
                    type="text"
                    value={twilioAccountSid}
                    onChange={(e) => setTwilioAccountSid(e.target.value)}
                    placeholder="ACxxxxxxxxxxxxxxxx"
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Twilio Auth Token *</label>
                  <input
                    type="password"
                    value={twilioAuthToken}
                    onChange={(e) => setTwilioAuthToken(e.target.value)}
                    placeholder={status?.sms?.hasTwilioCreds ? '••••••••' : 'Enter Twilio Auth Token'}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs font-mono"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-slate-400 mb-1">Twilio Sender Phone Number (E.164) *</label>
                  <input
                    type="text"
                    value={twilioFromNumber}
                    onChange={(e) => setTwilioFromNumber(e.target.value)}
                    placeholder="+1234567890"
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs font-mono"
                  />
                </div>
              </div>
            )}

            {/* Test SMS Section */}
            <div className="bg-slate-800/40 border border-slate-800 p-3.5 rounded-xl space-y-2 mt-2">
              <span className="font-semibold text-slate-300 block">📱 Test Live SMS Delivery</span>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={testPhoneNumber}
                  onChange={(e) => setTestPhoneNumber(e.target.value)}
                  placeholder="Enter mobile number (e.g. 9876543210 or +919876543210)..."
                  className="flex-1 bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-1.5 text-xs outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={handleTestSMS}
                  disabled={testingSMS || !testPhoneNumber.trim()}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shrink-0 shadow-lg shadow-indigo-600/20"
                >
                  <Send className="w-3.5 h-3.5" />
                  {testingSMS ? 'Sending...' : 'Send SMS 🚀'}
                </button>
              </div>

              {smsTestResult && (
                <div
                  className={`p-2.5 rounded-lg text-[11px] flex items-start gap-2 ${
                    smsTestResult.success
                      ? 'bg-emerald-950/30 text-emerald-300 border border-emerald-800/50'
                      : 'bg-rose-950/30 text-rose-300 border border-rose-800/50'
                  }`}
                >
                  {smsTestResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <span>{smsTestResult.message}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-800">
          <div className="flex items-center gap-1 text-[11px] text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Credentials are securely stored locally on your server.
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-400 hover:bg-slate-800 rounded-xl text-xs"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveConfig}
              disabled={saving}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/30 flex items-center gap-1.5"
            >
              {saving ? 'Saving...' : 'Save & Activate Gateway'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
