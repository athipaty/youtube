import { useEffect, useState } from 'react';
import axios from 'axios';
import { useLanguage } from '../utils/i18n';
import { ALL_VOICES, labelForVoice } from '../utils/voices';
import { setEpisodeProgress } from '../utils/episodeProgressStore';

const EXPRESSIONS = ['neutral', 'happy', 'sad', 'surprised', 'angry'];

// Matches Pollinations' anonymous-tier rate limit (~1 request/15s, see backend/utils/youtube/pollinations.js).
const PAGE_COOLDOWN_MS = 15000;

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// This character's own saved voiceOptions (from the Series page) come first as quick picks, then
// the rest of the full edge-tts catalog, then a free-text fallback for anything typed manually
// before this UI existed.
function VoicePicker({ characterId, name, value, voiceOptions, onChange }) {
  const { t } = useLanguage();
  const ownPicks = (voiceOptions || []).filter((v) => v !== value);
  const restOfCatalog = ALL_VOICES.map((v) => v.value).filter((v) => v !== value && !ownPicks.includes(v));
  const known = [value, ...ownPicks, ...restOfCatalog];
  const isKnown = known.includes(value);
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-semibold text-slate-600 w-20 truncate">{name}</span>
      <select
        value={isKnown ? value : '__custom'}
        onChange={(e) => onChange(characterId, e.target.value === '__custom' ? '' : e.target.value)}
        className="flex-1 px-2 py-1 text-xs border border-slate-200 rounded-lg outline-none focus:border-reel"
      >
        {value && <option value={value}>{labelForVoice(value)}</option>}
        {ownPicks.length > 0 && (
          <optgroup label={t('series.voiceOptionsLabel')}>
            {ownPicks.map((v) => <option key={v} value={v}>{labelForVoice(v)}</option>)}
          </optgroup>
        )}
        <optgroup label={t('episodes.reviewMoreVoices')}>
          {restOfCatalog.map((v) => <option key={v} value={v}>{labelForVoice(v)}</option>)}
        </optgroup>
        <option value="__custom">{t('episodes.reviewCustomVoice')}</option>
      </select>
      {!isKnown && (
        <input
          type="text" value={value} onChange={(e) => onChange(characterId, e.target.value)}
          className="flex-1 px-2 py-1 text-xs border border-slate-200 rounded-lg outline-none focus:border-reel"
        />
      )}
    </div>
  );
}

// Shown at every checkpoint that already has scene data to look at: "script" (script only),
// "images" (+ spread art), "review" (+ narration, the original use case — after TTS, before the
// expensive render), and "rendered" (+ finished video, editable so a mistake spotted after
// rendering doesn't require starting a whole new episode — approving render again is what
// actually replaces the video). Lets a human read the dialogue, look at each scene's left/right
// page spread (once it exists), listen to the narration (once it exists), and fix anything —
// wrong voice for a character being the most common case — with only the "Approve & render"
// action itself gated to "review", matching the backend's own step restrictions.
export default function EpisodeReviewPanel({ episode, onUpdated }) {
  const { t } = useLanguage();
  const HEADING_BY_STATUS = {
    script: 'episodes.previewHeadingScript',
    images: 'episodes.previewHeadingImages',
    rendered: 'episodes.previewHeadingRendered',
  };
  const SUBTITLE_BY_STATUS = {
    script: 'episodes.previewSubtitleScript',
    images: 'episodes.previewSubtitleImages',
    rendered: 'episodes.previewSubtitleRendered',
  };
  const headingKey = HEADING_BY_STATUS[episode.status] || 'episodes.reviewHeading';
  const subtitleKey = SUBTITLE_BY_STATUS[episode.status] || 'episodes.reviewSubtitle';
  const [scenes, setScenes] = useState(() => episode.scenes.map((s) => ({
    ...s,
    dialogue: s.dialogue.map((d) => ({ ...d })),
  })));
  const [voices, setVoices] = useState(() => {
    const map = {};
    for (const scene of episode.scenes) {
      for (const line of scene.dialogue) {
        if (line.character?._id) {
          map[line.character._id] = {
            name: line.character.name,
            voiceName: line.character.voiceName,
            voiceOptions: line.character.voiceOptions || [],
          };
        }
      }
    }
    return map;
  });
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState('');
  const [regeneratingKey, setRegeneratingKey] = useState(null); // `${order}:${side}`
  const [pageErrors, setPageErrors] = useState({}); // `${order}:${side}` -> error message
  const [cooldownUntil, setCooldownUntil] = useState({}); // `${order}:${side}` -> timestamp
  const [, forceTick] = useState(0);

  // Re-renders once a second while any scene is cooling down so the countdown on its button stays
  // live; stops itself once every cooldown lapses instead of ticking forever in the background.
  useEffect(() => {
    if (!Object.values(cooldownUntil).some((t) => t > Date.now())) return;
    const interval = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(interval);
  }, [cooldownUntil]);

  const original = episode.scenes;
  const hasEdits = JSON.stringify(scenes.map((s) => ({
    backgroundPrompt: s.backgroundPrompt,
    dialogue: s.dialogue.map((d) => ({ text: d.text, expression: d.expression })),
  }))) !== JSON.stringify(original.map((s) => ({
    backgroundPrompt: s.backgroundPrompt,
    dialogue: s.dialogue.map((d) => ({ text: d.text, expression: d.expression })),
  }))) || Object.entries(voices).some(([id, v]) => {
    const orig = original.flatMap((s) => s.dialogue).find((d) => d.character?._id === id);
    return orig && v.voiceName !== orig.character.voiceName;
  });

  function updateScenePrompt(order, value) {
    setScenes((prev) => prev.map((s) => (s.order === order ? { ...s, backgroundPrompt: value } : s)));
  }
  function updateLine(order, idx, field, value) {
    setScenes((prev) => prev.map((s) => {
      if (s.order !== order) return s;
      const dialogue = s.dialogue.map((d, i) => (i === idx ? { ...d, [field]: value } : d));
      return { ...s, dialogue };
    }));
  }
  function updateVoice(characterId, voiceName) {
    setVoices((prev) => ({ ...prev, [characterId]: { ...prev[characterId], voiceName } }));
  }
  function cooldownSecondsLeft(order) {
    return Math.max(0, Math.ceil(((cooldownUntil[order] || 0) - Date.now()) / 1000));
  }
  function hasPromptEdit(scene) {
    const orig = original.find((s) => s.order === scene.order);
    return !!orig && scene.backgroundPrompt.trim() !== orig.backgroundPrompt.trim();
  }

  // Regenerates just this scene's image via its own endpoint, independent of save()/the rest of
  // the form — merges the new URL straight into local `scenes` state instead of routing through
  // onUpdated, since onUpdated replaces the `episode` prop and (via the `key={episode.updatedAt}`
  // on this component in EpisodesPage) remounts this whole panel, which would discard any
  // not-yet-saved edits sitting in other scenes/lines.
  async function regenerateImage(order) {
    setRegeneratingKey(order);
    setPageErrors((prev) => ({ ...prev, [order]: null }));
    try {
      const { data } = await axios.post(`${API}/api/youtube/episodes/${episode._id}/scenes/${order}/regenerate-image`);
      const updated = data.scenes.find((s) => s.order === order);
      if (updated) {
        setScenes((prev) => prev.map((s) => (s.order === order ? { ...s, imageUrl: updated.imageUrl } : s)));
      }
    } catch (err) {
      setPageErrors((prev) => ({ ...prev, [order]: err.response?.data?.error || 'Failed to regenerate image' }));
    } finally {
      setRegeneratingKey(null);
      setCooldownUntil((prev) => ({ ...prev, [order]: Date.now() + PAGE_COOLDOWN_MS }));
    }
  }

  async function save() {
    setSaving(true);
    setError('');
    try {
      const voiceChanges = Object.entries(voices)
        .filter(([id, v]) => {
          const orig = original.flatMap((s) => s.dialogue).find((d) => d.character?._id === id);
          return orig && v.voiceName !== orig.character.voiceName;
        })
        .map(([characterId, v]) => ({ characterId, voiceName: v.voiceName }));

      const { data } = await axios.put(`${API}/api/youtube/episodes/${episode._id}/scenes`, {
        scenes: scenes.map((s) => ({
          order: s.order,
          backgroundPrompt: s.backgroundPrompt,
          dialogue: s.dialogue.map((d) => ({ text: d.text, expression: d.expression })),
        })),
        voiceChanges,
      });
      // A voice/background/text edit that actually invalidates something re-enters the pipeline
      // server-side (fire-and-forget — see the backend route's comment) to regenerate just what
      // changed, landing back at whatever step it started from once done. That regeneration is
      // what actually produces the new audio a changed voice needs — until it finishes, any
      // dialogue line whose audioUrl got cleared still shows silent/broken, not the old clip, so
      // there's no "still hear the old voice" case once this fires. Detected by comparing against
      // this episode's own prior status (not a hardcoded 'review') since edits can now also be
      // saved from "script"/"images"/"rendered" — a status *change* means the backend decided a
      // step needs to redo; unchanged means it was just cosmetic (e.g. only an expression) or an
      // edit at "script" that nothing downstream has been generated for yet. Seed the shared
      // progress store immediately (rather than waiting for the first socket update, which can lag
      // a beat behind this response) so the episode card shows "working" instead of a misleading
      // idle "click to start" button for that gap.
      if (data.status !== episode.status) {
        setEpisodeProgress(data._id, { status: data.status, statusDetail: t('episodes.advancing') });
      }
      onUpdated(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  }

  async function approve() {
    setApproving(true);
    setError('');
    try {
      const { data } = await axios.post(`${API}/api/youtube/episodes/${episode._id}/approve-render`);
      onUpdated(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to start render');
      setApproving(false);
    }
  }

  const voiceEntries = Object.entries(voices);

  return (
    <div className="flex flex-col gap-3 bg-violet-50 ring-1 ring-inset ring-violet-200 rounded-xl p-3">
      <div>
        <p className="text-xs font-bold text-violet-900">{t(headingKey)}</p>
        <p className="text-[11px] text-violet-500">{t(subtitleKey)}</p>
      </div>

      {voiceEntries.length > 0 && (
        <div className="flex flex-col gap-1.5 bg-white rounded-lg p-2.5 ring-1 ring-inset ring-violet-100">
          <p className="text-[11px] font-bold text-slate-500">{t('episodes.reviewVoicesHeading')}</p>
          {voiceEntries.map(([characterId, v]) => (
            <VoicePicker key={characterId} characterId={characterId} name={v.name} value={v.voiceName} voiceOptions={v.voiceOptions} onChange={updateVoice} />
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3 max-h-80 overflow-y-auto pr-1">
        {scenes.map((scene) => (
          <div key={scene.order} className="bg-white rounded-lg p-2.5 ring-1 ring-inset ring-violet-100 flex flex-col gap-2">
            {scene.imageUrl && (() => {
              const cooldown = cooldownSecondsLeft(scene.order);
              return (
                <div className="relative">
                  <img src={scene.imageUrl} alt="" className="w-full rounded-md" />
                  <button
                    type="button"
                    disabled={regeneratingKey === scene.order || cooldown > 0 || hasPromptEdit(scene)}
                    onClick={() => regenerateImage(scene.order)}
                    title={
                      hasPromptEdit(scene)
                        ? t('episodes.reviewPageSaveFirst')
                        : cooldown > 0
                        ? t('episodes.reviewRegenerateCooldown', { seconds: cooldown })
                        : t('episodes.reviewRegeneratePage')
                    }
                    className="absolute top-1 right-1 min-w-6 h-6 px-1 flex items-center justify-center rounded-full bg-white/90 border border-slate-200 text-xs shadow-soft hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {regeneratingKey === scene.order ? '⏳' : cooldown > 0 ? cooldown : '🔄'}
                  </button>
                  {pageErrors[scene.order] && (
                    <p className="absolute inset-x-0 -bottom-4 text-[10px] text-red-500 truncate">{pageErrors[scene.order]}</p>
                  )}
                </div>
              );
            })()}
            <textarea
              value={scene.backgroundPrompt}
              onChange={(e) => updateScenePrompt(scene.order, e.target.value)}
              rows={2}
              className="text-[11px] px-2 py-1 border border-slate-200 rounded-lg outline-none focus:border-reel resize-none"
            />
            {scene.dialogue.map((line, i) => (
              <div key={i} className="flex flex-col gap-1 pl-2 border-l-2 border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-slate-500 w-16 truncate">
                    {line.character?.name || t('episodes.reviewNarrator')}
                  </span>
                  {line.character && (
                    <select
                      value={line.expression}
                      onChange={(e) => updateLine(scene.order, i, 'expression', e.target.value)}
                      className="text-[10px] px-1.5 py-0.5 border border-slate-200 rounded-md outline-none"
                    >
                      {EXPRESSIONS.map((ex) => <option key={ex} value={ex}>{ex}</option>)}
                    </select>
                  )}
                  {line.audioUrl && <audio controls src={line.audioUrl} className="h-6 flex-1 min-w-0" />}
                </div>
                <input
                  type="text" value={line.text}
                  onChange={(e) => updateLine(scene.order, i, 'text', e.target.value)}
                  className="text-xs px-2 py-1 border border-slate-200 rounded-lg outline-none focus:border-reel"
                />
              </div>
            ))}
          </div>
        ))}
      </div>

      {error && <p className="text-red-500 text-xs">{error}</p>}

      {/* "Approve & render" only ever makes sense at "review" — that's the one action the backend
          itself still restricts to that status. At "script"/"images"/"rendered" there's nothing to
          click here when there are no edits pending; the card's own advance/upload/re-render
          button (rendered elsewhere) is the right next action instead. */}
      {(hasEdits || episode.status === 'review') && (
        <div className="flex items-center gap-2">
          {hasEdits ? (
            <button
              onClick={save} disabled={saving}
              className="px-3 py-1.5 bg-white ring-1 ring-inset ring-reel/40 text-reel font-bold text-xs rounded-lg hover:bg-violet-50 disabled:opacity-50 transition-colors"
            >
              {saving ? t('episodes.reviewSaving') : t('episodes.reviewSaveChanges')}
            </button>
          ) : (
            <button
              onClick={approve} disabled={approving}
              className="px-3 py-1.5 bg-gradient-to-b from-violet-400 to-reel text-white font-bold text-xs rounded-lg hover:brightness-105 disabled:opacity-50 transition-all shadow-soft"
            >
              {approving ? t('episodes.reviewApproving') : t('episodes.reviewApprove')}
            </button>
          )}
          {hasEdits && <span className="text-[11px] text-violet-400">{t('episodes.reviewUnsavedHint')}</span>}
        </div>
      )}
    </div>
  );
}
