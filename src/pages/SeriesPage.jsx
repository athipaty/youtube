import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';
import CharacterSpriteGrid from '../components/CharacterSpriteGrid';
import StepProgressDots from '../components/StepProgressDots';
import ConfirmDialog from '../components/ConfirmDialog';
import { setCharacterProgress, useCharacterProgress } from '../utils/characterProgressStore';
import { useLanguage } from '../utils/i18n';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const VOICE_LOCALES = [
  { value: 'en-US', label: 'English (US)' },
  { value: 'th-TH', label: 'ไทย (Thai)' },
];

// Mirrors EXPRESSIONS in backend/utils/youtube/claudeScript.js — one sprite generated per
// expression, sequentially, at Pollinations' rate limit (~16s apart).
const SPRITE_STEPS = ['neutral', 'happy', 'sad', 'surprised', 'action'];

function CharacterCard({ character, generating, onGenerateSprites, onDelete }) {
  const { t } = useLanguage();
  const live = useCharacterProgress(character._id);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  async function handleConfirmDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await onDelete(character._id);
      setConfirmingDelete(false);
    } catch (err) {
      setDeleteError(err.response?.data?.error || 'Failed to delete character');
    } finally {
      setDeleting(false);
    }
  }

  const spriteLabels = Object.fromEntries(SPRITE_STEPS.map(s => [s, t(`spriteSteps.${s}`)]));

  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-soft flex flex-col gap-2">
      <ConfirmDialog
        open={confirmingDelete}
        title={t('series.deleteCharacterTitle')}
        message={t('series.deleteCharacterMessage', { name: character.name })}
        confirmLabel={t('series.deleteCharacterConfirm')}
        loading={deleting}
        error={deleteError}
        onConfirm={handleConfirmDelete}
        onCancel={() => { setConfirmingDelete(false); setDeleteError(null); }}
      />
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-slate-900">{character.name}</p>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {character.status !== 'ready' && !generating && (
            <button
              onClick={() => onGenerateSprites(character._id)}
              className="text-[11px] font-semibold px-3 py-1 rounded-full bg-reel text-white hover:bg-reel-dark transition-colors whitespace-nowrap"
            >
              {t('series.generateSprites')}
            </button>
          )}
          <button
            onClick={() => setConfirmingDelete(true)}
            className="text-[11px] font-semibold px-3 py-1 rounded-full ring-1 ring-inset ring-slate-200 text-slate-400 hover:text-red-500 hover:ring-red-200 transition-colors whitespace-nowrap"
          >
            {t('series.deleteCharacter')}
          </button>
        </div>
      </div>
      <p className="text-xs text-slate-400">{character.description}</p>
      {generating && (
        <StepProgressDots steps={SPRITE_STEPS} currentStep={live.expression} labels={spriteLabels} />
      )}
      <CharacterSpriteGrid character={character} />
    </div>
  );
}

export default function SeriesPage() {
  const { t } = useLanguage();
  const [seriesList, setSeriesList] = useState([]);
  const [loadingSeries, setLoadingSeries] = useState(true);
  const [selectedSeriesId, setSelectedSeriesId] = useState(null);

  const [characters, setCharacters] = useState([]);
  const [loadingCharacters, setLoadingCharacters] = useState(false);

  // New series form
  const [showNewSeries, setShowNewSeries] = useState(false);
  const [newSeries, setNewSeries] = useState({ title: '', premise: '', genre: '', tone: '', artStyle: '', voiceLocale: 'en-US' });
  const [creatingSeries, setCreatingSeries] = useState(false);
  const [seriesError, setSeriesError] = useState('');

  // New character form
  const [showNewCharacter, setShowNewCharacter] = useState(false);
  const [newCharacter, setNewCharacter] = useState({ name: '', description: '', voiceName: 'en-US-AvaNeural' });
  const [creatingCharacter, setCreatingCharacter] = useState(false);
  const [characterError, setCharacterError] = useState('');

  // Sprite generation is a real ~1-2 min operation (5 sprites, rate-limited) — tracked per
  // character id so multiple "Generate sprites" clicks across different characters don't
  // interfere with each other.
  const [generatingSpritesFor, setGeneratingSpritesFor] = useState(null);
  const socketRef = useRef(null);

  // Deleting the selected series
  const [confirmingDeleteSeries, setConfirmingDeleteSeries] = useState(false);
  const [deletingSeries, setDeletingSeries] = useState(false);
  const [deleteSeriesError, setDeleteSeriesError] = useState(null);

  // Live sprite-generation progress — same connection pattern as EpisodesPage.jsx.
  useEffect(() => {
    socketRef.current = io(API);
    const socket = socketRef.current;
    socket.on('character:progress', ({ characterId, expression }) => {
      setCharacterProgress(characterId, { expression });
    });
    return () => socket.disconnect();
  }, []);

  async function loadSeries() {
    try {
      const { data } = await axios.get(`${API}/api/youtube/series`);
      setSeriesList(data);
      if (!selectedSeriesId && data.length) setSelectedSeriesId(data[0]._id);
    } catch { /* leave previous list showing on a transient failure */ }
    finally { setLoadingSeries(false); }
  }

  async function loadCharacters(seriesId) {
    if (!seriesId) { setCharacters([]); return; }
    setLoadingCharacters(true);
    try {
      const { data } = await axios.get(`${API}/api/youtube/characters`, { params: { seriesId } });
      setCharacters(data);
    } catch { /* leave previous list showing */ }
    finally { setLoadingCharacters(false); }
  }

  useEffect(() => { loadSeries(); }, []);
  useEffect(() => { loadCharacters(selectedSeriesId); }, [selectedSeriesId]);

  async function createSeries(e) {
    e.preventDefault();
    if (!newSeries.title.trim() || !newSeries.premise.trim() || creatingSeries) return;
    setCreatingSeries(true);
    setSeriesError('');
    try {
      const { data } = await axios.post(`${API}/api/youtube/series`, newSeries);
      setSeriesList(prev => [data, ...prev]);
      setSelectedSeriesId(data._id);
      setShowNewSeries(false);
      setNewSeries({ title: '', premise: '', genre: '', tone: '', artStyle: '', voiceLocale: 'en-US' });
    } catch (err) {
      setSeriesError(err.response?.data?.error || 'Failed to create series');
    } finally {
      setCreatingSeries(false);
    }
  }

  async function createCharacter(e) {
    e.preventDefault();
    if (!newCharacter.name.trim() || !newCharacter.description.trim() || creatingCharacter || !selectedSeriesId) return;
    setCreatingCharacter(true);
    setCharacterError('');
    try {
      const { data } = await axios.post(`${API}/api/youtube/characters`, { seriesId: selectedSeriesId, ...newCharacter });
      setCharacters(prev => [data, ...prev]);
      setShowNewCharacter(false);
      setNewCharacter({ name: '', description: '', voiceName: 'en-US-AvaNeural' });
    } catch (err) {
      setCharacterError(err.response?.data?.error || 'Failed to create character');
    } finally {
      setCreatingCharacter(false);
    }
  }

  async function generateSprites(characterId) {
    setGeneratingSpritesFor(characterId);
    try {
      const { data } = await axios.post(`${API}/api/youtube/characters/${characterId}/generate-sprites`);
      setCharacters(prev => prev.map(c => c._id === characterId ? data : c));
    } catch (err) {
      setCharacters(prev => prev.map(c => c._id === characterId ? { ...c, status: 'error', spriteError: err.response?.data?.error || err.message } : c));
    } finally {
      setGeneratingSpritesFor(null);
    }
  }

  async function deleteCharacter(characterId) {
    await axios.delete(`${API}/api/youtube/characters/${characterId}`);
    setCharacters(prev => prev.filter(c => c._id !== characterId));
  }

  async function handleConfirmDeleteSeries() {
    setDeletingSeries(true);
    setDeleteSeriesError(null);
    try {
      await axios.delete(`${API}/api/youtube/series/${selectedSeriesId}`);
      setSeriesList(prev => {
        const next = prev.filter(s => s._id !== selectedSeriesId);
        setSelectedSeriesId(next.length ? next[0]._id : null);
        return next;
      });
      setConfirmingDeleteSeries(false);
    } catch (err) {
      setDeleteSeriesError(err.response?.data?.error || 'Failed to delete series');
    } finally {
      setDeletingSeries(false);
    }
  }

  const selectedSeries = seriesList.find(s => s._id === selectedSeriesId);

  return (
    <div className="px-3 py-4 md:px-6 md:py-7 max-w-[1600px] mx-auto">
      <h1 className="text-lg font-bold text-slate-900 mb-1">{t('series.heading')}</h1>
      <p className="text-sm text-slate-400 mb-4">{t('series.subtitle')}</p>

      {/* ── Series list + picker ── */}
      <div className="flex items-center gap-2 flex-wrap mb-4">
        {loadingSeries ? (
          <p className="text-sm text-slate-400">{t('common.loading')}</p>
        ) : (
          seriesList.map(s => (
            <button
              key={s._id}
              onClick={() => setSelectedSeriesId(s._id)}
              className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-all ${
                selectedSeriesId === s._id ? 'bg-reel text-white shadow-soft' : 'bg-white border border-slate-200 text-slate-600 hover:border-reel/40'
              }`}
            >
              {s.title}
            </button>
          ))
        )}
        <button
          onClick={() => setShowNewSeries(v => !v)}
          className="px-3 py-1.5 rounded-full text-sm font-semibold bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
        >
          {t('series.newSeries')}
        </button>
      </div>

      {showNewSeries && (
        <form onSubmit={createSeries} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-card mb-6 flex flex-col gap-3 max-w-xl animate-slide-up">
          <input
            type="text" placeholder={t('series.titlePlaceholder')} value={newSeries.title}
            onChange={e => setNewSeries(v => ({ ...v, title: e.target.value }))}
            className="px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-reel focus:ring-4 focus:ring-reel/10"
          />
          <textarea
            placeholder={t('series.premisePlaceholder')} value={newSeries.premise}
            onChange={e => setNewSeries(v => ({ ...v, premise: e.target.value }))}
            rows={2}
            className="px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-reel focus:ring-4 focus:ring-reel/10 resize-none"
          />
          <div className="flex gap-2 flex-wrap">
            <input
              type="text" placeholder={t('series.genrePlaceholder')} value={newSeries.genre}
              onChange={e => setNewSeries(v => ({ ...v, genre: e.target.value }))}
              className="flex-1 min-w-[140px] px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-reel focus:ring-4 focus:ring-reel/10"
            />
            <select
              value={newSeries.voiceLocale}
              onChange={e => setNewSeries(v => ({ ...v, voiceLocale: e.target.value }))}
              className="px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-reel focus:ring-4 focus:ring-reel/10 bg-white"
            >
              {VOICE_LOCALES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </div>
          <input
            type="text" placeholder={t('series.tonePlaceholder')} value={newSeries.tone}
            onChange={e => setNewSeries(v => ({ ...v, tone: e.target.value }))}
            className="px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-reel focus:ring-4 focus:ring-reel/10"
          />
          <input
            type="text" placeholder={t('series.artStylePlaceholder')} value={newSeries.artStyle}
            onChange={e => setNewSeries(v => ({ ...v, artStyle: e.target.value }))}
            className="px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-reel focus:ring-4 focus:ring-reel/10"
          />
          {seriesError && <p className="text-red-500 text-xs">{seriesError}</p>}
          <button
            type="submit" disabled={creatingSeries}
            className="self-start px-4 py-2 bg-reel text-white font-bold text-sm rounded-xl hover:bg-reel-dark active:scale-[0.98] disabled:opacity-50 transition-all"
          >
            {creatingSeries ? t('series.creating') : t('series.createSeries')}
          </button>
        </form>
      )}

      {/* ── Characters for the selected series ── */}
      {selectedSeries && (
        <div className="mt-2">
          <ConfirmDialog
            open={confirmingDeleteSeries}
            title={t('series.deleteSeriesTitle')}
            message={t('series.deleteSeriesMessage', { title: selectedSeries.title })}
            confirmLabel={t('series.deleteSeriesConfirm')}
            loading={deletingSeries}
            error={deleteSeriesError}
            onConfirm={handleConfirmDeleteSeries}
            onCancel={() => { setConfirmingDeleteSeries(false); setDeleteSeriesError(null); }}
          />
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider">{t('series.charactersHeading', { title: selectedSeries.title })}</h2>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowNewCharacter(v => !v)}
                className="px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
              >
                {t('series.newCharacter')}
              </button>
              <button
                onClick={() => setConfirmingDeleteSeries(true)}
                className="px-3 py-1.5 rounded-full text-xs font-semibold ring-1 ring-inset ring-slate-200 text-slate-400 hover:text-red-500 hover:ring-red-200 transition-colors whitespace-nowrap"
              >
                {t('series.deleteSeries')}
              </button>
            </div>
          </div>

          {showNewCharacter && (
            <form onSubmit={createCharacter} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-card mb-4 flex flex-col gap-3 max-w-xl animate-slide-up">
              <input
                type="text" placeholder={t('series.namePlaceholder')} value={newCharacter.name}
                onChange={e => setNewCharacter(v => ({ ...v, name: e.target.value }))}
                className="px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-reel focus:ring-4 focus:ring-reel/10"
              />
              <textarea
                placeholder={t('series.descriptionPlaceholder')}
                value={newCharacter.description}
                onChange={e => setNewCharacter(v => ({ ...v, description: e.target.value }))}
                rows={3}
                className="px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-reel focus:ring-4 focus:ring-reel/10 resize-none"
              />
              <input
                type="text" placeholder={t('series.voiceNamePlaceholder')}
                value={newCharacter.voiceName}
                onChange={e => setNewCharacter(v => ({ ...v, voiceName: e.target.value }))}
                className="px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-reel focus:ring-4 focus:ring-reel/10"
              />
              {characterError && <p className="text-red-500 text-xs">{characterError}</p>}
              <button
                type="submit" disabled={creatingCharacter}
                className="self-start px-4 py-2 bg-reel text-white font-bold text-sm rounded-xl hover:bg-reel-dark active:scale-[0.98] disabled:opacity-50 transition-all"
              >
                {creatingCharacter ? t('series.creating') : t('series.createCharacter')}
              </button>
            </form>
          )}

          {loadingCharacters ? (
            <p className="text-sm text-slate-400">{t('common.loading')}</p>
          ) : characters.length === 0 ? (
            <p className="text-sm text-slate-400">{t('series.noCharacters')}</p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {characters.map(c => (
                <CharacterCard
                  key={c._id}
                  character={c}
                  generating={generatingSpritesFor === c._id}
                  onGenerateSprites={generateSprites}
                  onDelete={deleteCharacter}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
