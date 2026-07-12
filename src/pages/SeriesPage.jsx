import { useEffect, useState } from 'react';
import axios from 'axios';
import CharacterSpriteGrid from '../components/CharacterSpriteGrid';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const VOICE_LOCALES = [
  { value: 'en-US', label: 'English (US)' },
  { value: 'th-TH', label: 'ไทย (Thai)' },
];

export default function SeriesPage() {
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

  const selectedSeries = seriesList.find(s => s._id === selectedSeriesId);

  return (
    <div className="px-3 py-4 md:px-6 md:py-7 max-w-[1600px] mx-auto">
      <h1 className="text-lg font-bold text-slate-900 mb-1">Series &amp; Characters</h1>
      <p className="text-sm text-slate-400 mb-4">Set up a story world once — characters keep the same look across every episode.</p>

      {/* ── Series list + picker ── */}
      <div className="flex items-center gap-2 flex-wrap mb-4">
        {loadingSeries ? (
          <p className="text-sm text-slate-400">Loading…</p>
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
          + New series
        </button>
      </div>

      {showNewSeries && (
        <form onSubmit={createSeries} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-card mb-6 flex flex-col gap-3 max-w-xl animate-slide-up">
          <input
            type="text" placeholder="Series title" value={newSeries.title}
            onChange={e => setNewSeries(v => ({ ...v, title: e.target.value }))}
            className="px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-reel focus:ring-4 focus:ring-reel/10"
          />
          <textarea
            placeholder="Premise — a one-paragraph pitch for the whole series" value={newSeries.premise}
            onChange={e => setNewSeries(v => ({ ...v, premise: e.target.value }))}
            rows={2}
            className="px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-reel focus:ring-4 focus:ring-reel/10 resize-none"
          />
          <div className="flex gap-2 flex-wrap">
            <input
              type="text" placeholder="Genre (optional)" value={newSeries.genre}
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
            type="text" placeholder="Tone (optional) — e.g. gentle, whimsical, funny" value={newSeries.tone}
            onChange={e => setNewSeries(v => ({ ...v, tone: e.target.value }))}
            className="px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-reel focus:ring-4 focus:ring-reel/10"
          />
          <input
            type="text" placeholder="Art style (optional) — e.g. flat vector cartoon, pastel colors" value={newSeries.artStyle}
            onChange={e => setNewSeries(v => ({ ...v, artStyle: e.target.value }))}
            className="px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-reel focus:ring-4 focus:ring-reel/10"
          />
          {seriesError && <p className="text-red-500 text-xs">{seriesError}</p>}
          <button
            type="submit" disabled={creatingSeries}
            className="self-start px-4 py-2 bg-reel text-white font-bold text-sm rounded-xl hover:bg-reel-dark active:scale-[0.98] disabled:opacity-50 transition-all"
          >
            {creatingSeries ? 'Creating…' : 'Create series'}
          </button>
        </form>
      )}

      {/* ── Characters for the selected series ── */}
      {selectedSeries && (
        <div className="mt-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Characters — {selectedSeries.title}</h2>
            <button
              onClick={() => setShowNewCharacter(v => !v)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
            >
              + New character
            </button>
          </div>

          {showNewCharacter && (
            <form onSubmit={createCharacter} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-card mb-4 flex flex-col gap-3 max-w-xl animate-slide-up">
              <input
                type="text" placeholder="Character name" value={newCharacter.name}
                onChange={e => setNewCharacter(v => ({ ...v, name: e.target.value }))}
                className="px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-reel focus:ring-4 focus:ring-reel/10"
              />
              <textarea
                placeholder="Locked visual description — be specific, this is reused in every sprite image forever (e.g. 'a friendly young cartoon fox, orange fur, cream belly, big round brown eyes')"
                value={newCharacter.description}
                onChange={e => setNewCharacter(v => ({ ...v, description: e.target.value }))}
                rows={3}
                className="px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-reel focus:ring-4 focus:ring-reel/10 resize-none"
              />
              <input
                type="text" placeholder="edge-tts voice name (e.g. en-US-AvaNeural, th-TH-PremwadeeNeural)"
                value={newCharacter.voiceName}
                onChange={e => setNewCharacter(v => ({ ...v, voiceName: e.target.value }))}
                className="px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-reel focus:ring-4 focus:ring-reel/10"
              />
              {characterError && <p className="text-red-500 text-xs">{characterError}</p>}
              <button
                type="submit" disabled={creatingCharacter}
                className="self-start px-4 py-2 bg-reel text-white font-bold text-sm rounded-xl hover:bg-reel-dark active:scale-[0.98] disabled:opacity-50 transition-all"
              >
                {creatingCharacter ? 'Creating…' : 'Create character'}
              </button>
            </form>
          )}

          {loadingCharacters ? (
            <p className="text-sm text-slate-400">Loading…</p>
          ) : characters.length === 0 ? (
            <p className="text-sm text-slate-400">No characters yet — add one above.</p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {characters.map(c => (
                <div key={c._id} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-soft flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-slate-900">{c.name}</p>
                    {c.status !== 'ready' && (
                      <button
                        onClick={() => generateSprites(c._id)}
                        disabled={generatingSpritesFor === c._id}
                        className="text-[11px] font-semibold px-3 py-1 rounded-full bg-reel text-white hover:bg-reel-dark disabled:opacity-50 transition-colors whitespace-nowrap"
                      >
                        {generatingSpritesFor === c._id ? '🎨 Generating…' : '🎨 Generate sprites'}
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">{c.description}</p>
                  <CharacterSpriteGrid character={c} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
