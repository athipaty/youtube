// External store for episode render progress, keyed by episode id — modeled directly on the
// sibling amazon-tracker project's autoListStore.js. Episode cards can remount when the list
// re-renders/re-keys; storing progress here (outside React) lets it survive that, since the
// actual render pipeline keeps running on the server regardless of what's mounted client-side.
import { useSyncExternalStore } from 'react';

const EMPTY = { status: null, statusDetail: '' };

const state = new Map(); // episodeId -> { status, statusDetail }
const listeners = new Map(); // episodeId -> Set<fn>

function notify(key) {
  listeners.get(key)?.forEach(fn => fn());
}

export function getEpisodeProgress(key) {
  return state.get(key) || EMPTY;
}

export function setEpisodeProgress(key, patch) {
  state.set(key, { ...getEpisodeProgress(key), ...patch });
  notify(key);
}

export function useEpisodeProgress(key) {
  return useSyncExternalStore(
    (onChange) => {
      if (!listeners.has(key)) listeners.set(key, new Set());
      listeners.get(key).add(onChange);
      return () => listeners.get(key).delete(onChange);
    },
    () => getEpisodeProgress(key),
  );
}
