import { useState } from 'react';
import { useLanguage } from '../utils/i18n';

// A review step before an episode actually goes to YouTube, rather than uploading with silent
// defaults — privacy and "made for kids" both go straight onto the real video via the Data API
// (see backend's uploadVideoToYoutube), so getting them wrong isn't a quick undo afterward, only
// a fixable-in-YouTube-Studio one. Defaults to public + made for kids, matching what this app's
// content actually is, but both are a deliberate choice here rather than assumed silently.
export default function UploadOptionsDialog({ open, loading, error, onConfirm, onCancel }) {
  const { t } = useLanguage();
  const [privacyStatus, setPrivacyStatus] = useState('public');
  const [madeForKids, setMadeForKids] = useState(true);
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-[2px] p-4"
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-slate-900 rounded-2xl shadow-card p-5 flex flex-col gap-4"
      >
        <div>
          <h3 className="text-sm font-bold text-slate-100">{t('episodes.uploadOptionsTitle')}</h3>
          <p className="text-[13px] text-slate-400 leading-relaxed mt-1">{t('episodes.uploadOptionsSubtitle')}</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">{t('episodes.uploadOptionsPrivacyLabel')}</p>
          {['public', 'unlisted', 'private'].map((opt) => (
            <label key={opt} className="flex items-center gap-2 text-sm text-slate-200 cursor-pointer">
              <input
                type="radio" name="privacyStatus" value={opt}
                checked={privacyStatus === opt}
                onChange={() => setPrivacyStatus(opt)}
                className="accent-reel"
              />
              {t(`episodes.uploadOptionsPrivacy.${opt}`)}
            </label>
          ))}
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">{t('episodes.uploadOptionsKidsLabel')}</p>
          <label className="flex items-center gap-2 text-sm text-slate-200 cursor-pointer">
            <input
              type="radio" name="madeForKids"
              checked={madeForKids === true}
              onChange={() => setMadeForKids(true)}
              className="accent-reel"
            />
            {t('episodes.uploadOptionsKidsYes')}
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-200 cursor-pointer">
            <input
              type="radio" name="madeForKids"
              checked={madeForKids === false}
              onChange={() => setMadeForKids(false)}
              className="accent-reel"
            />
            {t('episodes.uploadOptionsKidsNo')}
          </label>
          <p className="text-[11px] text-slate-500 leading-relaxed">{t('episodes.uploadOptionsKidsHint')}</p>
        </div>

        {error && (
          <p className="text-[12px] text-red-400 bg-red-950 ring-1 ring-inset ring-red-800 rounded-lg px-2.5 py-1.5">⚠ {error}</p>
        )}

        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={loading}
            className="text-xs font-semibold px-3.5 py-2 rounded-full bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={() => onConfirm({ privacyStatus, madeForKids })}
            disabled={loading}
            className="text-xs font-bold px-3.5 py-2 rounded-full text-white bg-reel hover:bg-reel-dark transition-colors disabled:opacity-60 whitespace-nowrap"
          >
            {loading ? t('episodes.uploadingYoutube') : t('episodes.uploadOptionsConfirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
