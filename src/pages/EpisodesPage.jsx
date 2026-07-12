import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';
import StepProgressDots from '../components/StepProgressDots';
import EpisodePlayer from '../components/EpisodePlayer';
import { setEpisodeProgress, useEpisodeProgress } from '../utils/episodeProgressStore';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const STEP_ORDER = ['script', 'sprites', 'backgrounds', 'tts', 'rendering', 'uploading'];
const STEP_LABELS = {
  pending: '⏳ Queued…',
  script: '✍️ Writing script…',
  sprites: '🎨 Generating character sprites…',
  backgrounds: '🖼️ Generating scene backgrounds…',
  tts: '🎙️ Recording narration…',
  rendering: '🎬 Rendering video…',
  uploading: '☁️ Uploading…',
};

function EpisodeCard({ episode, onRetry }) {
  // Live status comes from the socket-fed store when available (updates without a refetch);
  // falls back to whatever was last loaded from the API for episodes the store hasn't heard
  // about yet (e.g. right after the initial page load, before any socket event has arrived).
  const live = useEpisodeProgress(episode._id);
  const status = live.status || episode.status;
  const statusDetail = live.statusDetail || episode.statusDetail;
  const inProgress = status && !['done', 'error'].includes(status);

  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-soft flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-slate-900">
          Ep. {episode.episodeNumber}{episode.title ? ` — ${episode.title}` : ''}
        </p>
      </div>
      <p className="text-xs text-slate-400">{episode.premise}</p>

      {inProgress && (
        <StepProgressDots steps={STEP_ORDER} currentStep={status} labels={{ ...STEP_LABELS, [status]: statusDetail || STEP_LABELS[status] }} />
      )}

      {status === 'error' && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs text-red-500">⚠ {episode.errorMessage || 'Something went wrong.'}</p>
          <button
            onClick={() => onRetry(episode._id)}
            className="self-start text-[11px] font-semibold px-3 py-1 rounded-full ring-1 ring-inset ring-reel/40 text-reel hover:bg-violet-50 transition-colors"
          >
            🔄 Retry
          </button>
        </div>
      )}

      {status === 'done' && episode.scenes?.length > 0 && (
        <details className="text-xs text-slate-500">
          <summary className="cursor-pointer font-semibold text-slate-600">Script ({episode.scenes.length} scenes)</summary>
          <div className="mt-2 flex flex-col gap-2">
            {episode.scenes.map((s, i) => (
              <div key={i} className="pl-2 border-l-2 border-slate-100">
                {s.dialogue.map((d, j) => <p key={j}>{d.text}</p>)}
              </div>
            ))}
          </div>
        </details>
      )}

      <EpisodePlayer episode={episode} />
    </div>
  );
}

export default function EpisodesPage() {
  const [seriesList, setSeriesList] = useState([]);
  const [selectedSeriesId, setSelectedSeriesId] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState(true);
  const [premise, setPremise] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const socketRef = useRef(null);

  useEffect(() => {
    axios.get(`${API}/api/youtube/series`).then(({ data }) => {
      setSeriesList(data);
      if (data.length) setSelectedSeriesId(data[0]._id);
    }).catch(() => {});
  }, []);

  async function loadEpisodes(seriesId) {
    if (!seriesId) { setEpisodes([]); return; }
    setLoadingEpisodes(true);
    try {
      const { data } = await axios.get(`${API}/api/youtube/episodes`, { params: { seriesId } });
      setEpisodes(data);
    } catch { /* leave previous list showing */ }
    finally { setLoadingEpisodes(false); }
  }

  useEffect(() => { loadEpisodes(selectedSeriesId); }, [selectedSeriesId]);

  // Live progress via Socket.IO — same connection pattern as amazon-tracker's useProductTracker.js.
  useEffect(() => {
    socketRef.current = io(API);
    const socket = socketRef.current;

    socket.on('episode:progress', ({ episodeId, status, statusDetail }) => {
      setEpisodeProgress(episodeId, { status, statusDetail });
      // 'done' means videoUrl (and the final script) are now set server-side — refetch that one
      // episode to pick them up, since the socket payload itself only carries status/statusDetail.
      if (status === 'done' || status === 'script') {
        axios.get(`${API}/api/youtube/episodes/${episodeId}`)
          .then(({ data }) => setEpisodes(prev => prev.map(e => e._id === episodeId ? data : e)))
          .catch(() => {});
      }
    });

    socket.on('episode:error', ({ episodeId, error }) => {
      setEpisodeProgress(episodeId, { status: 'error', statusDetail: '' });
      setEpisodes(prev => prev.map(e => e._id === episodeId ? { ...e, status: 'error', errorMessage: error } : e));
    });

    return () => socket.disconnect();
  }, []);

  async function createEpisode(e) {
    e.preventDefault();
    if (!premise.trim() || creating || !selectedSeriesId) return;
    setCreating(true);
    setCreateError('');
    try {
      const { data } = await axios.post(`${API}/api/youtube/episodes`, { seriesId: selectedSeriesId, premise });
      setEpisodes(prev => [data, ...prev]);
      setPremise('');
    } catch (err) {
      setCreateError(err.response?.data?.error || 'Failed to create episode');
    } finally {
      setCreating(false);
    }
  }

  async function retryEpisode(episodeId) {
    try {
      const { data } = await axios.post(`${API}/api/youtube/episodes/${episodeId}/retry`);
      setEpisodes(prev => prev.map(e => e._id === episodeId ? data : e));
    } catch { /* the card's own error state stays visible either way */ }
  }

  return (
    <div className="px-3 py-4 md:px-6 md:py-7 max-w-[1600px] mx-auto">
      <h1 className="text-lg font-bold text-slate-900 mb-1">Episodes</h1>
      <p className="text-sm text-slate-400 mb-4">Pitch one line — the pipeline writes the script, generates art, records narration, and renders the video.</p>

      {seriesList.length === 0 ? (
        <p className="text-sm text-slate-400">No series yet — create one on the Series tab first.</p>
      ) : (
        <>
          <div className="flex items-center gap-2 flex-wrap mb-4">
            {seriesList.map(s => (
              <button
                key={s._id}
                onClick={() => setSelectedSeriesId(s._id)}
                className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-all ${
                  selectedSeriesId === s._id ? 'bg-reel text-white shadow-soft' : 'bg-white border border-slate-200 text-slate-600 hover:border-reel/40'
                }`}
              >
                {s.title}
              </button>
            ))}
          </div>

          <form onSubmit={createEpisode} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-card mb-6 flex flex-col gap-3 max-w-xl">
            <textarea
              placeholder="What happens in this episode? e.g. 'Ruso gets lost and a wise old owl helps him find his way home.'"
              value={premise}
              onChange={e => setPremise(e.target.value)}
              rows={2}
              disabled={creating}
              className="px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-reel focus:ring-4 focus:ring-reel/10 resize-none disabled:bg-slate-50"
            />
            {createError && <p className="text-red-500 text-xs">{createError}</p>}
            <button
              type="submit" disabled={creating || !premise.trim()}
              className="self-start px-4 py-2 bg-gradient-to-b from-violet-400 to-reel text-white font-bold text-sm rounded-xl hover:brightness-105 active:scale-[0.98] disabled:opacity-50 transition-all shadow-soft"
            >
              {creating ? 'Starting…' : '🎬 Create episode'}
            </button>
          </form>

          {loadingEpisodes ? (
            <p className="text-sm text-slate-400">Loading…</p>
          ) : episodes.length === 0 ? (
            <p className="text-sm text-slate-400">No episodes yet — pitch one above.</p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {episodes.map(ep => <EpisodeCard key={ep._id} episode={ep} onRetry={retryEpisode} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}
