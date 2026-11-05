import React from 'react';
import { X, ShieldCheck, FileText, Lock } from 'lucide-react';
import { Button } from './Button';

export interface TermsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept?: () => void;
}

export const TermsModal: React.FC<TermsModalProps> = ({ isOpen, onClose, onAccept }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 px-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">StockPilot Terms of Service & Privacy Policy</h3>
              <p className="text-[11px] text-slate-400 font-mono">Effective: March 2026 • Multi-Tenant SaaS Agreement</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-300 leading-relaxed font-sans">
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-start gap-3">
            <Lock className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-white">Enterprise Data Isolation Guarantee:</span>
              <p className="text-slate-400 mt-0.5">
                Every tenant provisioned on StockPilot operates within a cryptographically and contextually isolated
                tenant partition. Your warehouse, inventory, procurement, and commercial data are strictly inaccessible
                to other tenants or external organizations.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-bold text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-teal-400" />
              1. Multi-Tenant Service Architecture
            </h4>
            <p>
              By provisioning an organization workspace on StockPilot, you establish a primary tenant account.
              The designated Initial Administrator holds fiduciary responsibility for role assignments, user access
              delegation, warehouse access scope restrictions, and data hygiene within your organization.
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-bold text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-teal-400" />
              2. User Access, RBAC & ABAC Compliance
            </h4>
            <p>
              StockPilot enforces granular Role-Based Access Control (RBAC) and Attribute-Based Access Control (ABAC).
              Users must not attempt to bypass warehouse facility scopes, approval authorization limits, or subscription
              tier boundaries. All authentication attempts and privileged operations are permanently logged to an immutable
              audit trail.
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-bold text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-teal-400" />
              3. Privacy, Data Retention & Security
            </h4>
            <p>
              StockPilot does not sell, rent, or monetize proprietary business inventory records. Technical telemetry
              is collected strictly for service reliability, brute-force mitigation, and security compliance. Passwords are
              never stored in plain text and are hashed using bcrypt with adaptive salt work factors.
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-bold text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-teal-400" />
              4. Subscription & Cancellation
            </h4>
            <p>
              Workspaces may upgrade, downgrade, or cancel subscription tiers at any time through the billing dashboard.
              Upon subscription termination, organization administrators retain a 30-day export window for inventory ledger
              and transaction records before secure deprovisioning.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 px-6 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">By continuing, you bind your organization to these terms.</span>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
            {onAccept && (
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => {
                  onAccept();
                  onClose();
                }}
              >
                I Understand & Agree
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
