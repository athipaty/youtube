import { useEffect, useState } from 'react';
import axios from 'axios';
import CharacterAttributePicker from '../components/CharacterAttributePicker';
import ConfirmDialog from '../components/ConfirmDialog';
import StoryOutlineWizard from '../components/StoryOutlineWizard';
import { useLanguage } from '../utils/i18n';
import { voicesForLocale } from '../utils/voices';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const VOICE_LOCALES = [
  { value: 'en-US', label: 'English (US)' },
  { value: 'th-TH', label: 'ไทย (Thai)' },
];

function CharacterCard({ character, onDelete, onEditCharacter }) {
  const { t } = useLanguage();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(character.name);
  const [editDescription, setEditDescription] = useState(character.description);
  const [editAttrs, setEditAttrs] = useState(character.attrs || null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');

  async function handleSaveEdit(e) {
    e.preventDefault();
    if (!editName.trim() || !editDescription.trim() || savingEdit) return;
    setSavingEdit(true);
    setEditError('');
    try {
      await onEditCharacter(character._id, { name: editName, description: editDescription, attrs: editAttrs });
      setEditing(false);
    } catch (err) {
      setEditError(err.response?.data?.error || 'Failed to save changes');
    } finally {
      setSavingEdit(false);
    }
  }

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
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="text-[11px] font-semibold px-3 py-1 rounded-full ring-1 ring-inset ring-slate-200 text-slate-500 hover:text-reel hover:ring-reel/40 transition-colors whitespace-nowrap"
            >
              {t('series.editCharacter')}
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

      {editing ? (
        <form onSubmit={handleSaveEdit} className="flex flex-col gap-3 bg-slate-50 border border-slate-100 rounded-xl p-3 animate-slide-up">
          <input
            type="text" value={editName} onChange={e => setEditName(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-reel focus:ring-4 focus:ring-reel/10"
          />
          <CharacterAttributePicker
            initialAttrs={editAttrs}
            initialManualText={editDescription}
            onChange={({ description, attrs }) => { setEditDescription(description); setEditAttrs(attrs); }}
          />
          {editError && <p className="text-red-500 text-xs">{editError}</p>}
          <div className="flex items-center gap-2">
            <button
              type="submit" disabled={savingEdit}
              className="px-4 py-2 bg-reel text-white font-bold text-sm rounded-xl hover:bg-reel-dark active:scale-[0.98] disabled:opacity-50 transition-all"
            >
              {savingEdit ? t('series.creating') : t('common.save')}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setEditName(character.name);
                setEditDescription(character.description);
                setEditAttrs(character.attrs || null);
                setEditError('');
              }}
              className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700 transition-colors"
            >
              {t('common.cancel')}
            </button>
          </div>
        </form>
      ) : (
        <p className="text-xs text-slate-400">{character.description}</p>
      )}
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

  // AI story-outline wizard (story first -> episode breakdown -> matching cast, all before
  // anything is persisted) — the alternative entry point to the blank "New series" form below.
  const [showOutlineWizard, setShowOutlineWizard] = useState(false);

  // New series form
  const [showNewSeries, setShowNewSeries] = useState(false);
  const [newSeries, setNewSeries] = useState({ title: '', premise: '', genre: '', tone: '', artStyle: '', voiceLocale: 'en-US' });
  const [creatingSeries, setCreatingSeries] = useState(false);
  const [seriesError, setSeriesError] = useState('');

  // New character form
  const [showNewCharacter, setShowNewCharacter] = useState(false);
  const [newCharacter, setNewCharacter] = useState({ name: '', description: '', attrs: null });
  const [creatingCharacter, setCreatingCharacter] = useState(false);
  const [characterError, setCharacterError] = useState('');

  // Deleting the selected series
  const [confirmingDeleteSeries, setConfirmingDeleteSeries] = useState(false);
  const [deletingSeries, setDeletingSeries] = useState(false);
  const [deleteSeriesError, setDeleteSeriesError] = useState(null);

  // Narrator voice — the one storyteller voice reading every episode of the selected series.
  const [savingNarratorVoice, setSavingNarratorVoice] = useState(false);
  const [narratorVoiceError, setNarratorVoiceError] = useState('');

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
      setNewCharacter({ name: '', description: '', attrs: null });
    } catch (err) {
      setCharacterError(err.response?.data?.error || 'Failed to create character');
    } finally {
      setCreatingCharacter(false);
    }
  }

  async function editCharacter(characterId, updates) {
    const { data } = await axios.patch(`${API}/api/youtube/characters/${characterId}`, updates);
    setCharacters(prev => prev.map(c => c._id === characterId ? data : c));
  }

  async function updateNarratorVoice(narratorVoice) {
    setSavingNarratorVoice(true);
    setNarratorVoiceError('');
    try {
      const { data } = await axios.patch(`${API}/api/youtube/series/${selectedSeriesId}`, { narratorVoice });
      setSeriesList(prev => prev.map(s => s._id === selectedSeriesId ? data : s));
    } catch (err) {
      setNarratorVoiceError(err.response?.data?.error || 'Failed to update narrator voice');
    } finally {
      setSavingNarratorVoice(false);
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

  function handleOutlineCreated(series) {
    setSeriesList(prev => [series, ...prev]);
    setSelectedSeriesId(series._id);
    setShowOutlineWizard(false);
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
          onClick={() => { setShowOutlineWizard(v => !v); setShowNewSeries(false); }}
          className="px-3 py-1.5 rounded-full text-sm font-semibold bg-gradient-to-b from-violet-400 to-reel text-white shadow-soft hover:brightness-105 transition-all"
        >
          {t('series.startFromIdea')}
        </button>
        <button
          onClick={() => { setShowNewSeries(v => !v); setShowOutlineWizard(false); }}
          className="px-3 py-1.5 rounded-full text-sm font-semibold bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
        >
          {t('series.newSeries')}
        </button>
      </div>

      {showOutlineWizard && (
        <StoryOutlineWizard onCreated={handleOutlineCreated} onCancel={() => setShowOutlineWizard(false)} />
      )}

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
          <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
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

          {/* One storyteller voice narrates every episode of this series — replaces the old
              per-character voice pickers below. */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <label className="text-xs font-semibold text-slate-500">{t('series.narratorVoiceLabel')}</label>
            <select
              value={selectedSeries.narratorVoice || ''}
              disabled={savingNarratorVoice}
              onChange={e => updateNarratorVoice(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-reel focus:ring-4 focus:ring-reel/10 bg-white disabled:opacity-50"
            >
              {voicesForLocale(selectedSeries.voiceLocale).some(v => v.value === selectedSeries.narratorVoice) ? null : (
                <option value={selectedSeries.narratorVoice || ''}>{selectedSeries.narratorVoice || '—'}</option>
              )}
              {voicesForLocale(selectedSeries.voiceLocale).map(v => <option key={v.value} value={v.value}>{v.label} ({v.gender})</option>)}
            </select>
            {narratorVoiceError && <span className="text-red-500 text-xs">{narratorVoiceError}</span>}
          </div>

          {showNewCharacter && (
            <form onSubmit={createCharacter} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-card mb-4 flex flex-col gap-3 max-w-xl animate-slide-up">
              <input
                type="text" placeholder={t('series.namePlaceholder')} value={newCharacter.name}
                onChange={e => setNewCharacter(v => ({ ...v, name: e.target.value }))}
                className="px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-reel focus:ring-4 focus:ring-reel/10"
              />
              <CharacterAttributePicker
                initialAttrs={newCharacter.attrs}
                initialManualText={newCharacter.description}
                onChange={({ description, attrs }) => setNewCharacter(v => ({ ...v, description, attrs }))}
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
                  onDelete={deleteCharacter}
                  onEditCharacter={editCharacter}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
