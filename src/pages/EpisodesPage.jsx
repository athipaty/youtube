import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { io } from 'socket.io-client';
import axios from 'axios';
import StepProgressDots from '../components/StepProgressDots';
import EpisodePlayer from '../components/EpisodePlayer';
import EpisodeReviewPanel from '../components/EpisodeReviewPanel';
import ConfirmDialog from '../components/ConfirmDialog';
import { setEpisodeProgress, useEpisodeProgress } from '../utils/episodeProgressStore';
import { useLanguage } from '../utils/i18n';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const STEP_ORDER = ['script', 'images', 'tts', 'rendering', 'uploading', 'publishing'];

// These three are manual-click-only now (see backend's POST /episodes/:id/advance) — episode
// creation no longer auto-starts the pipeline, so each one sits idle until its button is clicked.
const MANUAL_STEP_STATUSES = ['pending', 'script', 'images'];

// Statuses with actual scene data worth showing/editing — mirrors the backend's own
// EDITABLE_STATUSES for PUT /episodes/:id/scenes. "pending" has no scenes yet; "error" may have a
// partial/broken script; "uploading"/"publishing"/"done" are past the point edits here would ever
// reach the published video.
const PREVIEWABLE_STATUSES = ['script', 'images', 'review', 'rendered'];

function EpisodeCard({ episode, onRetry, onDelete, onUpdate, onUploadYoutube, onRerender, onAdvance }) {
  const { t } = useLanguage();
  // Live status comes from the socket-fed store when available (updates without a refetch);
  // falls back to whatever was last loaded from the API for episodes the store hasn't heard
  // about yet (e.g. right after the initial page load, before any socket event has arrived).
  const live = useEpisodeProgress(episode._id);
  const status = live.status || episode.status;
  const statusDetail = live.statusDetail || episode.statusDetail;
  const inProgress = status && !['done', 'error'].includes(status);
  const isManualStep = MANUAL_STEP_STATUSES.includes(status);
  const showProgressDots = inProgress && status !== 'review' && status !== 'rendered' && !isManualStep;
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [rerendering, setRerendering] = useState(false);
  const [rerenderError, setRerenderError] = useState(null);
  // A manual step's status doesn't change until the whole step finishes (statusDetail updates
  // along the way, but status itself stays put) — so "is this step currently running" has to be
  // tracked locally, keyed to the status it was clicked from, rather than inferred from status
  // changing. Once status moves on to anything else (next stage, 'review', or 'error'), this
  // clears itself and the card naturally shows whatever that new status calls for.
  const [advancingFromStatus, setAdvancingFromStatus] = useState(null);
  const [advanceError, setAdvanceError] = useState(null);
  // Two ways to know a manual step is actually running: this card's own button was just clicked
  // (advancingFromStatus), or the review panel's "Save changes" kicked off a regeneration itself
  // (e.g. after a voice change) without this card doing anything — that shows up as a non-empty
  // statusDetail, which is only ever set while a step is genuinely mid-run (idle manual-step
  // statuses always carry an empty one, cleared at the end of the previous step).
  const isAdvancing = advancingFromStatus === status || (isManualStep && !!statusDetail);
  useEffect(() => {
    if (advancingFromStatus && status !== advancingFromStatus) setAdvancingFromStatus(null);
  }, [status, advancingFromStatus]);

  async function handleAdvance() {
    setAdvancingFromStatus(status);
    setAdvanceError(null);
    try {
      await onAdvance(episode._id);
    } catch (err) {
      setAdvanceError(err.response?.data?.error || 'Failed to start');
      setAdvancingFromStatus(null);
    }
  }

  // Unique characters appearing anywhere in this episode, so a glance at the card shows who's in
  // it without opening the review panel — dedupes across scenes since the same character usually
  // recurs in several.
  const episodeCharacters = Array.from(
    new Map(
      (episode.scenes || []).flatMap((s) => s.charactersOnScreen || []).filter((c) => c && c._id).map((c) => [c._id, c])
    ).values()
  );

  async function handleUploadYoutube() {
    setUploading(true);
    setUploadError(null);
    try {
      await onUploadYoutube(episode._id);
    } catch (err) {
      setUploadError(err.response?.data?.error || 'Failed to start YouTube upload');
      setUploading(false);
    }
    // on success, leave `uploading` true — the status flips to 'uploading'/'publishing' over the
    // socket almost immediately, at which point showProgressDots takes over the card's display
  }

  async function handleRerender() {
    setRerendering(true);
    setRerenderError(null);
    try {
      await onRerender(episode._id);
    } catch (err) {
      setRerenderError(err.response?.data?.error || 'Failed to start re-render');
      setRerendering(false);
    }
    // on success, leave `rerendering` true — the status flips to 'tts'/'rendering' over the socket
    // almost immediately, at which point showProgressDots takes over the card's display
  }

  async function handleConfirmDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await onDelete(episode._id);
      setConfirmingDelete(false);
    } catch (err) {
      setDeleteError(err.response?.data?.error || 'Failed to delete episode');
    } finally {
      setDeleting(false);
    }
  }

  const titleSuffix = episode.title ? ` — ${episode.title}` : '';
  const stepLabels = Object.fromEntries(STEP_ORDER.map(s => [s, t(`episodeSteps.${s}`)]));

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-soft flex flex-col gap-2">
      <ConfirmDialog
        open={confirmingDelete}
        title={t('episodes.deleteEpisodeTitle')}
        message={t('episodes.deleteEpisodeMessage', { number: episode.episodeNumber, titleSuffix })}
        confirmLabel={t('episodes.deleteEpisodeConfirm')}
        loading={deleting}
        error={deleteError}
        onConfirm={handleConfirmDelete}
        onCancel={() => { setConfirmingDelete(false); setDeleteError(null); }}
      />
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-slate-50">
          Ep. {episode.episodeNumber}{titleSuffix}
        </p>
        {/* Deletable any time nothing is actually running — a manual step just sitting idle,
            waiting for its button, is as safe to delete as 'done' or 'error'. Only genuinely
            active work (an in-flight manual step, or the backend's own auto-chained
            render/upload/publish tail) hides it. */}
        {!isAdvancing && !['tts', 'rendering', 'uploading', 'publishing'].includes(status) && (
          <button
            onClick={() => setConfirmingDelete(true)}
            className="text-[11px] font-semibold px-3 py-1 rounded-full ring-1 ring-inset ring-slate-700 text-slate-500 hover:text-red-400 hover:ring-red-800 transition-colors whitespace-nowrap"
          >
            {t('episodes.deleteEpisode')}
          </button>
        )}
      </div>
      <p className="text-xs text-slate-500">{episode.premise}</p>

      {episodeCharacters.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {episodeCharacters.map((c) => (
            <span key={c._id} className="text-[10px] font-semibold text-slate-400 bg-slate-800 rounded-full px-2 py-1 ring-1 ring-inset ring-slate-700 truncate max-w-[100px]">
              {c.name}
            </span>
          ))}
        </div>
      )}

      {showProgressDots && (
        <StepProgressDots steps={STEP_ORDER} currentStep={status} labels={{ ...stepLabels, [status]: statusDetail || stepLabels[status] }} />
      )}

      {/* Shown before the step's own action button/s below — read (and revise) what's been
          generated so far, then decide whether to advance/re-render/upload. Hidden mid-step
          (isAdvancing) since the scene data it'd show is about to change anyway. */}
      {PREVIEWABLE_STATUSES.includes(status) && !isAdvancing && (
        <EpisodeReviewPanel key={episode.updatedAt} episode={episode} onUpdated={(updated) => onUpdate(updated)} />
      )}

      {isManualStep && (
        <div className="flex flex-col gap-1.5">
          {isAdvancing ? (
            <p className="text-xs text-slate-500">{statusDetail || t('episodes.advancing')}</p>
          ) : (
            <button
              onClick={handleAdvance}
              className="self-start px-4 py-2 bg-gradient-to-b from-violet-400 to-reel text-white font-bold text-sm rounded-xl hover:brightness-105 active:scale-[0.98] transition-all shadow-soft"
            >
              {t(`episodes.advance.${status}`)}
            </button>
          )}
          {advanceError && <p className="text-xs text-red-400">{advanceError}</p>}
        </div>
      )}

      {status === 'error' && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs text-red-400">⚠ {episode.errorMessage || t('episodes.errorFallback')}</p>
          <button
            onClick={() => onRetry(episode._id)}
            className="self-start text-[11px] font-semibold px-3 py-1 rounded-full ring-1 ring-inset ring-reel/40 text-reel hover:bg-violet-950 transition-colors"
          >
            {t('episodes.retry')}
          </button>
        </div>
      )}

      {status === 'rendered' && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleUploadYoutube}
              disabled={uploading || rerendering}
              className="self-start px-4 py-2 bg-gradient-to-b from-violet-400 to-reel text-white font-bold text-sm rounded-xl hover:brightness-105 active:scale-[0.98] disabled:opacity-50 transition-all shadow-soft"
            >
              {uploading ? t('episodes.uploadingYoutube') : t('episodes.uploadToYoutube')}
            </button>
            <button
              onClick={handleRerender}
              disabled={uploading || rerendering}
              className="self-start text-[11px] font-semibold px-3 py-1 rounded-full ring-1 ring-inset ring-reel/40 text-reel hover:bg-violet-950 disabled:opacity-50 transition-colors"
            >
              {rerendering ? t('episodes.rerendering') : t('episodes.rerender')}
            </button>
          </div>
          {uploadError && <p className="text-xs text-red-400">{uploadError}</p>}
          {rerenderError && <p className="text-xs text-red-400">{rerenderError}</p>}
        </div>
      )}

      {status === 'done' && episode.youtubeUrl && (
        <a
          href={episode.youtubeUrl} target="_blank" rel="noreferrer"
          className="self-start text-[11px] font-semibold px-3 py-1 rounded-full ring-1 ring-inset ring-reel/40 text-reel hover:bg-violet-950 transition-colors"
        >
          {t('episodes.watchOnYoutube')}
        </a>
      )}

      {status === 'done' && episode.scenes?.length > 0 && (
        <details className="text-xs text-slate-400">
          <summary className="cursor-pointer font-semibold text-slate-300">{t('episodes.scriptSummary', { count: episode.scenes.length })}</summary>
          <div className="mt-2 flex flex-col gap-2">
            {episode.scenes.map((s, i) => (
              <div key={i} className="pl-2 border-l-2 border-slate-800">
                {s.narration.map((n, j) => <p key={j}>{n.text}</p>)}
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
  const { t } = useLanguage();
  const [seriesList, setSeriesList] = useState([]);
  const [selectedSeriesId, setSelectedSeriesId] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState(true);
  const [premise, setPremise] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const socketRef = useRef(null);

  // Both tabs stay mounted permanently (see AppShell), so this page's own series list would
  // otherwise only ever be fetched once at initial app load — stale as soon as a series is
  // created on the Series tab. Re-fetch every time this tab becomes active instead.
  const location = useLocation();
  useEffect(() => {
    if (location.pathname !== '/episodes') return;
    axios.get(`${API}/api/youtube/series`).then(({ data }) => {
      setSeriesList(data);
      setSelectedSeriesId(prev => (prev && data.some(s => s._id === prev)) ? prev : (data[0]?._id ?? null));
    }).catch(() => {});
  }, [location.pathname]);

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
      // The socket payload only ever carries status/statusDetail, so any status whose step just
      // filled in real data (script/title, scene spread images, or the final video/audio at
      // review) needs a refetch to actually show it — 'script' for the scenes Claude just wrote,
      // 'images' for the left/right page art, 'review' for narration audio, 'done' for the final
      // videoUrl.
      if (['script', 'images', 'review', 'done'].includes(status)) {
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

  async function deleteEpisode(episodeId) {
    await axios.delete(`${API}/api/youtube/episodes/${episodeId}`);
    setEpisodes(prev => prev.filter(e => e._id !== episodeId));
  }

  async function uploadEpisodeToYoutube(episodeId) {
    const { data } = await axios.post(`${API}/api/youtube/episodes/${episodeId}/upload-youtube`);
    setEpisodes(prev => prev.map(e => e._id === episodeId ? data : e));
  }

  async function rerenderEpisode(episodeId) {
    const { data } = await axios.post(`${API}/api/youtube/episodes/${episodeId}/rerender`);
    setEpisodes(prev => prev.map(e => e._id === episodeId ? data : e));
  }

  // Fire-and-forget, like the other single-step triggers — the 202 ack just confirms the step
  // started; its actual progress/completion arrives over the 'episode:progress' socket above.
  async function advanceEpisode(episodeId) {
    await axios.post(`${API}/api/youtube/episodes/${episodeId}/advance`);
  }

  function updateEpisode(updated) {
    setEpisodes(prev => prev.map(e => e._id === updated._id ? updated : e));
  }

  return (
    <div className="px-3 py-4 md:px-6 md:py-7 max-w-[1600px] mx-auto">
      <h1 className="text-lg font-bold text-slate-50 mb-1">{t('episodes.heading')}</h1>
      <p className="text-sm text-slate-500 mb-4">{t('episodes.subtitle')}</p>

      {seriesList.length === 0 ? (
        <p className="text-sm text-slate-500">{t('episodes.noSeries')}</p>
      ) : (
        <>
          <div className="flex items-center gap-2 flex-wrap mb-4">
            {seriesList.map(s => (
              <button
                key={s._id}
                onClick={() => setSelectedSeriesId(s._id)}
                className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-all ${
                  selectedSeriesId === s._id ? 'bg-reel text-white shadow-soft' : 'bg-slate-900 border border-slate-700 text-slate-300 hover:border-reel/40'
                }`}
              >
                {s.title}
              </button>
            ))}
          </div>

          <form onSubmit={createEpisode} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-card mb-6 flex flex-col gap-3 max-w-xl">
            <textarea
              placeholder={t('episodes.premisePlaceholder')}
              value={premise}
              onChange={e => setPremise(e.target.value)}
              rows={2}
              disabled={creating}
              className="px-3 py-2 border border-slate-700 rounded-xl text-sm outline-none focus:border-reel focus:ring-4 focus:ring-reel/10 resize-none disabled:bg-slate-950"
            />
            {createError && <p className="text-red-400 text-xs">{createError}</p>}
            <button
              type="submit" disabled={creating || !premise.trim()}
              className="self-start px-4 py-2 bg-gradient-to-b from-violet-400 to-reel text-white font-bold text-sm rounded-xl hover:brightness-105 active:scale-[0.98] disabled:opacity-50 transition-all shadow-soft"
            >
              {creating ? t('episodes.starting') : t('episodes.createEpisode')}
            </button>
          </form>

          {loadingEpisodes ? (
            <p className="text-sm text-slate-500">{t('common.loading')}</p>
          ) : episodes.length === 0 ? (
            <p className="text-sm text-slate-500">{t('episodes.noEpisodes')}</p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {episodes.map(ep => <EpisodeCard key={ep._id} episode={ep} onRetry={retryEpisode} onDelete={deleteEpisode} onUpdate={updateEpisode} onUploadYoutube={uploadEpisodeToYoutube} onRerender={rerenderEpisode} onAdvance={advanceEpisode} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}
