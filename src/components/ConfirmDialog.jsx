import { useLanguage } from '../utils/i18n';

// Centered modal confirmation — deliberately NOT an inline button swap.
// An inline Yes/No that appears where the trigger button was is a mis-click trap:
// a second/accidental click lands on "Yes" before anyone reads what it does.
// A modal forces a deliberate action in a different location on screen.
export default function ConfirmDialog({
  open, title, message, confirmLabel = 'Yes, continue', cancelLabel,
  danger = true, loading = false, error = null, onConfirm, onCancel,
}) {
  const { t } = useLanguage();
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-[2px] p-4"
      onClick={onCancel}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-sm bg-slate-900 rounded-2xl shadow-card p-5 flex flex-col gap-3"
      >
        <h3 className="text-sm font-bold text-slate-100">{title}</h3>
        {message && <p className="text-[13px] text-slate-400 leading-relaxed">{message}</p>}
        {error && (
          <p className="text-[12px] text-red-400 bg-red-950 ring-1 ring-inset ring-red-800 rounded-lg px-2.5 py-1.5">⚠ {error}</p>
        )}
        <div className="flex items-center justify-end gap-2 mt-1">
          <button
            onClick={onCancel}
            disabled={loading}
            className="text-xs font-semibold px-3.5 py-2 rounded-full bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            {cancelLabel || t('common.cancel')}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`text-xs font-bold px-3.5 py-2 rounded-full text-white transition-colors disabled:opacity-60 whitespace-nowrap ${
              danger ? 'bg-red-500 hover:bg-red-600' : 'bg-reel hover:bg-reel-dark'
            }`}
          >
            {loading ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
