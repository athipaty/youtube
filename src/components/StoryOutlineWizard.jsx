import { useState } from 'react';
import axios from 'axios';
import { useLanguage } from '../utils/i18n';
import { voicesForLocale } from '../utils/voices';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const VOICE_LOCALES = [
  { value: 'en-US', label: 'English (US)' },
  { value: 'th-TH', label: 'ไทย (Thai)' },
];

// Plan the whole story first, then decide episodes, then decide characters — this wizard is the
// UI for that order. It never touches the DB until "commit": drafting via POST /outline is pure
// generation, and the user can edit every field of the draft before anything is actually created.
export default function StoryOutlineWizard({ onCreated, onCancel }) {
  const { t } = useLanguage();

  const [idea, setIdea] = useState('');
  const [voiceLocale, setVoiceLocale] = useState('en-US');
  const [targetEpisodeMinutes, setTargetEpisodeMinutes] = useState(0.5); // 0.5 min = 30s, for a short first episode
  const [episodeCount, setEpisodeCount] = useState(1); // start with a single episode
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState('');

  const [draft, setDraft] = useState(null); // the editable outline once drafted
  const [committing, setCommitting] = useState(false);
  const [commitError, setCommitError] = useState('');

  const [suggestingIdea, setSuggestingIdea] = useState(false);
  const [suggestError, setSuggestError] = useState('');

  // Fills the idea box with a fresh AI-suggested premise — click again for a different one, no
  // commitment either way since this only touches the idea textarea, not anything persisted.
  async function handleSuggestIdea() {
    if (suggestingIdea) return;
    setSuggestingIdea(true);
    setSuggestError('');
    try {
      const { data } = await axios.post(`${API}/api/youtube/outline/idea`, { voiceLocale });
      if (data.idea) setIdea(data.idea);
    } catch (err) {
      setSuggestError(err.response?.data?.error || 'Failed to suggest an idea');
    } finally {
      setSuggestingIdea(false);
    }
  }

  async function handleDraft(e) {
    e.preventDefault();
    if (!idea.trim() || drafting) return;
    setDrafting(true);
    setDraftError('');
    try {
      const { data } = await axios.post(`${API}/api/youtube/outline`, {
        idea: idea.trim(), voiceLocale, targetEpisodeMinutes: Number(targetEpisodeMinutes) || 0.5,
        episodeCount: episodeCount ? Number(episodeCount) : null,
      });
      setDraft(data);
    } catch (err) {
      setDraftError(err.response?.data?.error || 'Failed to draft the story');
    } finally {
      setDrafting(false);
    }
  }

  function updateDraft(patch) {
    setDraft((d) => ({ ...d, ...patch }));
  }

  function updateEpisode(i, patch) {
    setDraft((d) => ({ ...d, episodes: d.episodes.map((ep, idx) => (idx === i ? { ...ep, ...patch } : ep)) }));
  }
  function removeEpisode(i) {
    setDraft((d) => ({ ...d, episodes: d.episodes.filter((_, idx) => idx !== i) }));
  }
  function addEpisode() {
    setDraft((d) => ({ ...d, episodes: [...d.episodes, { title: '', premise: '' }] }));
  }

  function updateCharacter(i, patch) {
    setDraft((d) => ({ ...d, characters: d.characters.map((c, idx) => (idx === i ? { ...c, ...patch } : c)) }));
  }
  function removeCharacter(i) {
    setDraft((d) => ({ ...d, characters: d.characters.filter((_, idx) => idx !== i) }));
  }
  function addCharacter() {
    setDraft((d) => ({ ...d, characters: [...d.characters, { name: '', description: '' }] }));
  }

  async function handleCommit() {
    if (!draft || committing) return;
    setCommitting(true);
    setCommitError('');
    try {
      const { data } = await axios.post(`${API}/api/youtube/outline/commit`, draft);
      onCreated(data.series);
    } catch (err) {
      setCommitError(err.response?.data?.error || 'Failed to create the series');
    } finally {
      setCommitting(false);
    }
  }

  const inputClass = 'px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-reel focus:ring-4 focus:ring-reel/10';

  if (!draft) {
    return (
      <form onSubmit={handleDraft} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-card mb-6 flex flex-col gap-3 max-w-xl animate-slide-up">
        <p className="text-sm font-bold text-slate-900">{t('outline.heading')}</p>
        <textarea
          placeholder={t('outline.ideaPlaceholder')}
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          rows={3}
          className={`${inputClass} resize-none`}
        />
        <button
          type="button" onClick={handleSuggestIdea} disabled={suggestingIdea}
          className="self-start text-xs font-semibold px-3 py-1.5 rounded-full bg-violet-50 text-reel hover:bg-violet-100 disabled:opacity-50 transition-colors"
        >
          {suggestingIdea ? t('outline.suggestingIdea') : t('outline.suggestIdea')}
        </button>
        {suggestError && <p className="text-red-500 text-xs">{suggestError}</p>}
        <div className="flex gap-2 flex-wrap items-center">
          <select
            value={voiceLocale}
            onChange={(e) => setVoiceLocale(e.target.value)}
            className={`${inputClass} bg-white`}
          >
            {VOICE_LOCALES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
          <label className="flex items-center gap-1.5 text-xs text-slate-500">
            {t('outline.targetMinutesLabel')}
            <input
              type="number" min={0.5} max={10} step={0.5}
              value={targetEpisodeMinutes}
              onChange={(e) => setTargetEpisodeMinutes(e.target.value)}
              className={`${inputClass} w-20`}
            />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-slate-500">
            {t('outline.episodeCountLabel')}
            <input
              type="number" min={1} max={30} step={1}
              value={episodeCount}
              onChange={(e) => setEpisodeCount(e.target.value)}
              placeholder={t('outline.episodeCountAuto')}
              className={`${inputClass} w-20`}
            />
          </label>
        </div>
        {draftError && <p className="text-red-500 text-xs">{draftError}</p>}
        <div className="flex items-center gap-2">
          <button
            type="submit" disabled={drafting || !idea.trim()}
            className="px-4 py-2 bg-reel text-white font-bold text-sm rounded-xl hover:bg-reel-dark active:scale-[0.98] disabled:opacity-50 transition-all"
          >
            {drafting ? t('outline.drafting') : t('outline.draftButton')}
          </button>
          <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700 transition-colors">
            {t('common.cancel')}
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-card mb-6 flex flex-col gap-4 max-w-2xl animate-slide-up">
      <div>
        <p className="text-sm font-bold text-slate-900">{t('outline.reviewHeading')}</p>
        <p className="text-xs text-slate-400">{t('outline.reviewSubtitle')}</p>
      </div>

      {/* ── Show identity ── */}
      <div className="flex flex-col gap-2">
        <input type="text" value={draft.title} onChange={(e) => updateDraft({ title: e.target.value })} className={inputClass} placeholder={t('series.titlePlaceholder')} />
        <textarea value={draft.premise} onChange={(e) => updateDraft({ premise: e.target.value })} rows={2} className={`${inputClass} resize-none`} placeholder={t('series.premisePlaceholder')} />
        <div className="flex gap-2 flex-wrap">
          <input type="text" value={draft.genre} onChange={(e) => updateDraft({ genre: e.target.value })} className={`${inputClass} flex-1 min-w-[120px]`} placeholder={t('series.genrePlaceholder')} />
          <input type="text" value={draft.tone} onChange={(e) => updateDraft({ tone: e.target.value })} className={`${inputClass} flex-1 min-w-[120px]`} placeholder={t('series.tonePlaceholder')} />
        </div>
        <input type="text" value={draft.artStyle} onChange={(e) => updateDraft({ artStyle: e.target.value })} className={inputClass} placeholder={t('series.artStylePlaceholder')} />
        <label className="flex items-center gap-1.5 text-xs text-slate-500">
          {t('series.narratorVoiceLabel')}
          <select
            value={draft.narratorVoice}
            onChange={(e) => updateDraft({ narratorVoice: e.target.value })}
            className={`${inputClass} bg-white flex-1`}
          >
            {voicesForLocale(draft.voiceLocale).map((v) => <option key={v.value} value={v.value}>{v.label} ({v.gender})</option>)}
          </select>
        </label>
      </div>

      {/* ── Episodes ── */}
      <div className="flex flex-col gap-2">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('outline.episodesHeading', { count: draft.episodes.length })}</p>
        {draft.episodes.map((ep, i) => (
          <div key={i} className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400 w-6 flex-shrink-0">{i + 1}.</span>
              <input type="text" value={ep.title} onChange={(e) => updateEpisode(i, { title: e.target.value })} className={`${inputClass} flex-1`} placeholder={t('outline.episodeTitlePlaceholder')} />
              <button type="button" onClick={() => removeEpisode(i)} className="text-[11px] font-semibold px-2 py-1 rounded-full text-slate-400 hover:text-red-500 transition-colors flex-shrink-0">
                {t('outline.remove')}
              </button>
            </div>
            <textarea value={ep.premise} onChange={(e) => updateEpisode(i, { premise: e.target.value })} rows={2} className={`${inputClass} resize-none`} placeholder={t('outline.episodePremisePlaceholder')} />
          </div>
        ))}
        <button type="button" onClick={addEpisode} className="self-start text-xs font-semibold px-3 py-1.5 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors">
          {t('outline.addEpisode')}
        </button>
      </div>

      {/* ── Characters ── */}
      <div className="flex flex-col gap-2">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('outline.charactersHeading', { count: draft.characters.length })}</p>
        {draft.characters.map((c, i) => (
          <div key={i} className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <input type="text" value={c.name} onChange={(e) => updateCharacter(i, { name: e.target.value })} className={`${inputClass} flex-1`} placeholder={t('outline.characterNamePlaceholder')} />
              <button type="button" onClick={() => removeCharacter(i)} className="text-[11px] font-semibold px-2 py-1 rounded-full text-slate-400 hover:text-red-500 transition-colors flex-shrink-0">
                {t('outline.remove')}
              </button>
            </div>
            {c.role && <p className="text-[11px] text-slate-400 italic">{c.role}</p>}
            <textarea value={c.description} onChange={(e) => updateCharacter(i, { description: e.target.value })} rows={2} className={`${inputClass} resize-none`} placeholder={t('series.descriptionPlaceholder')} />
          </div>
        ))}
        <button type="button" onClick={addCharacter} className="self-start text-xs font-semibold px-3 py-1.5 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors">
          {t('outline.addCharacter')}
        </button>
      </div>

      {commitError && <p className="text-red-500 text-xs">{commitError}</p>}
      <div className="flex items-center gap-2">
        <button
          type="button" onClick={handleCommit}
          disabled={committing || !draft.episodes.length || !draft.characters.length}
          className="px-4 py-2 bg-gradient-to-b from-violet-400 to-reel text-white font-bold text-sm rounded-xl hover:brightness-105 active:scale-[0.98] disabled:opacity-50 transition-all shadow-soft"
        >
          {committing ? t('outline.committing') : t('outline.commitButton')}
        </button>
        <button type="button" onClick={() => setDraft(null)} disabled={committing} className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700 transition-colors">
          {t('outline.startOver')}
        </button>
      </div>
    </div>
  );
}
