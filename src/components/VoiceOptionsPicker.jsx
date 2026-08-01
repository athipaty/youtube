import { useState } from 'react';
import { voicesForLocale, labelForVoice } from '../utils/voices';
import { useLanguage } from '../utils/i18n';

// Manages a character's `voiceOptions` pool (chips + an "add" dropdown scoped to the series'
// locale) alongside its single active `voiceName` — lets a character have a few alternates on
// hand for the episode review voice picker without ever ambiguously running more than one voice
// at once.
export default function VoiceOptionsPicker({ locale, primaryVoice, options, onChange }) {
  const { t } = useLanguage();
  const [toAdd, setToAdd] = useState('');
  const catalog = voicesForLocale(locale);
  const available = catalog.filter((v) => v.value !== primaryVoice && !options.includes(v.value));

  function addOption() {
    if (!toAdd) return;
    onChange([...options, toAdd]);
    setToAdd('');
  }
  function removeOption(value) {
    onChange(options.filter((v) => v !== value));
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold text-slate-400">{t('series.voiceOptionsLabel')}</span>
      {options.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {options.map((v) => (
            <span
              key={v}
              className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-200"
            >
              {labelForVoice(v)}
              <button type="button" onClick={() => removeOption(v)} className="text-violet-400 hover:text-violet-700">×</button>
            </span>
          ))}
        </div>
      )}
      {available.length > 0 && (
        <div className="flex items-center gap-1.5">
          <select
            value={toAdd}
            onChange={(e) => setToAdd(e.target.value)}
            className="flex-1 px-2 py-1 text-xs border border-slate-200 rounded-lg outline-none focus:border-reel bg-white"
          >
            <option value="">{t('series.voiceOptionsAddPlaceholder')}</option>
            {available.map((v) => <option key={v.value} value={v.value}>{v.label} ({v.gender})</option>)}
          </select>
          <button
            type="button" disabled={!toAdd} onClick={addOption}
            className="text-[11px] font-semibold px-2 py-1 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 disabled:opacity-40 transition-colors"
          >
            {t('series.voiceOptionsAdd')}
          </button>
        </div>
      )}
    </div>
  );
}
