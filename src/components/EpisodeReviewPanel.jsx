import { useState } from 'react';
import axios from 'axios';
import { useLanguage } from '../utils/i18n';

const EXPRESSIONS = ['neutral', 'happy', 'sad', 'surprised', 'angry'];

// Only voices confirmed working against edge-tts-universal (see edgeTts.js) — a free-text
// fallback covers anything else, matching the free-text voiceName field on the character form.
const KNOWN_VOICES = [
  { value: 'en-US-AndrewNeural', label: 'en-US-AndrewNeural (Male)' },
  { value: 'en-US-AvaNeural', label: 'en-US-AvaNeural (Female)' },
  { value: 'en-US-EmmaNeural', label: 'en-US-EmmaNeural (Female)' },
  { value: 'th-TH-NiwatNeural', label: 'th-TH-NiwatNeural (Male)' },
  { value: 'th-TH-PremwadeeNeural', label: 'th-TH-PremwadeeNeural (Female)' },
];

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function VoicePicker({ characterId, name, value, onChange }) {
  const { t } = useLanguage();
  const isKnown = KNOWN_VOICES.some((v) => v.value === value);
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-semibold text-slate-600 w-20 truncate">{name}</span>
      <select
        value={isKnown ? value : '__custom'}
        onChange={(e) => onChange(characterId, e.target.value === '__custom' ? '' : e.target.value)}
        className="flex-1 px-2 py-1 text-xs border border-slate-200 rounded-lg outline-none focus:border-reel"
      >
        {KNOWN_VOICES.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
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

// Shown while an episode is paused at status:'review' — after TTS, before the expensive render.
// Lets a human read the dialogue, look at the backgrounds, listen to the narration, and fix
// anything (wrong voice for a character being the most common case) before committing to render.
export default function EpisodeReviewPanel({ episode, onUpdated }) {
  const { t } = useLanguage();
  const [scenes, setScenes] = useState(() => episode.scenes.map((s) => ({
    ...s,
    dialogue: s.dialogue.map((d) => ({ ...d })),
  })));
  const [voices, setVoices] = useState(() => {
    const map = {};
    for (const scene of episode.scenes) {
      for (const line of scene.dialogue) {
        if (line.character?._id) map[line.character._id] = { name: line.character.name, voiceName: line.character.voiceName };
      }
    }
    return map;
  });
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState('');

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
        <p className="text-xs font-bold text-violet-900">{t('episodes.reviewHeading')}</p>
        <p className="text-[11px] text-violet-500">{t('episodes.reviewSubtitle')}</p>
      </div>

      {voiceEntries.length > 0 && (
        <div className="flex flex-col gap-1.5 bg-white rounded-lg p-2.5 ring-1 ring-inset ring-violet-100">
          <p className="text-[11px] font-bold text-slate-500">{t('episodes.reviewVoicesHeading')}</p>
          {voiceEntries.map(([characterId, v]) => (
            <VoicePicker key={characterId} characterId={characterId} name={v.name} value={v.voiceName} onChange={updateVoice} />
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3 max-h-80 overflow-y-auto pr-1">
        {scenes.map((scene) => (
          <div key={scene.order} className="bg-white rounded-lg p-2.5 ring-1 ring-inset ring-violet-100 flex flex-col gap-2">
            {scene.backgroundUrl && (
              <img src={scene.backgroundUrl} alt="" className="w-full max-h-32 object-cover rounded-md" />
            )}
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
    </div>
  );
}
