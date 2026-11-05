import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  type?: 'primary' | 'danger' | 'warning' | 'success';
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  warning: (message: string) => void;
  confirmAction: (options: ConfirmOptions) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmModal, setConfirmModal] = useState<ConfirmOptions | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = 'info', duration = 4000) => {
      const id = Math.random().toString(36).substring(2, 9);
      setToasts((prev) => [...prev, { id, type, message, duration }]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  const success = useCallback((msg: string) => showToast(msg, 'success'), [showToast]);
  const error = useCallback((msg: string) => showToast(msg, 'error', 5000), [showToast]);
  const info = useCallback((msg: string) => showToast(msg, 'info'), [showToast]);
  const warning = useCallback((msg: string) => showToast(msg, 'warning', 5000), [showToast]);

  const confirmAction = useCallback((options: ConfirmOptions) => {
    setConfirmModal(options);
  }, []);

  const handleConfirmClick = async () => {
    if (!confirmModal) return;
    try {
      setConfirmLoading(true);
      await confirmModal.onConfirm();
      setConfirmModal(null);
    } catch (err) {
      console.error('Confirmation action error:', err);
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleCancelClick = () => {
    if (confirmModal?.onCancel) {
      confirmModal.onCancel();
    }
    setConfirmModal(null);
  };

  return (
    <ToastContext.Provider value={{ showToast, success, error, info, warning, confirmAction }}>
      {children}
      <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 pointer-events-none max-w-md w-full">
        {/* Active Confirmation Toast */}
        {confirmModal && (
          <div className="pointer-events-auto p-4 rounded-2xl shadow-2xl border bg-slate-900/95 border-indigo-500/50 backdrop-blur-md text-white animate-in slide-in-from-bottom-5 mb-2">
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-xl mt-0.5 shrink-0 ${
                confirmModal.type === 'danger'
                  ? 'bg-rose-500/20 text-rose-400'
                  : confirmModal.type === 'success'
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-indigo-500/20 text-indigo-400'
              }`}>
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold text-white tracking-wide">
                  {confirmModal.title || 'Action Confirmation'}
                </h4>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  {confirmModal.message}
                </p>
                <div className="flex items-center justify-end gap-2.5 mt-3 pt-2.5 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={handleCancelClick}
                    disabled={confirmLoading}
                    className="px-3 py-1.5 rounded-xl text-xs font-medium text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors disabled:opacity-50"
                  >
                    {confirmModal.cancelLabel || 'Cancel'}
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmClick}
                    disabled={confirmLoading}
                    className={`px-4 py-1.5 rounded-xl text-xs font-semibold text-white shadow-lg transition-all disabled:opacity-50 ${
                      confirmModal.type === 'danger'
                        ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/30'
                        : confirmModal.type === 'success'
                        ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30'
                        : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/30'
                    }`}
                  >
                    {confirmLoading ? 'Processing...' : (confirmModal.confirmLabel || 'Confirm')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl shadow-2xl border transition-all animate-in slide-in-from-bottom-5 ${
              toast.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200'
                : toast.type === 'error'
                ? 'bg-rose-950/90 border-rose-500/40 text-rose-200'
                : toast.type === 'warning'
                ? 'bg-amber-950/90 border-amber-500/40 text-amber-200'
                : 'bg-slate-900/90 border-slate-700 text-slate-200'
            }`}
          >
            {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />}
            {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />}
            {toast.type === 'warning' && <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />}
            {toast.type === 'info' && <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />}

            <div className="flex-1 text-sm font-medium leading-relaxed">{toast.message}</div>

            <button
              onClick={() => removeToast(toast.id)}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
