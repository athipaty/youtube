// Same external-store pattern as episodeProgressStore.js, keyed by character id — tracks which
// sprite expression is currently being generated so the card can show live step-dots instead of
// just a static spinner for the ~1-2 min sprite-generation call.
import { useSyncExternalStore } from 'react';

const EMPTY = { expression: null };

const state = new Map(); // characterId -> { expression }
const listeners = new Map(); // characterId -> Set<fn>

function notify(key) {
  listeners.get(key)?.forEach(fn => fn());
}

export function getCharacterProgress(key) {
  return state.get(key) || EMPTY;
}

export function setCharacterProgress(key, patch) {
  state.set(key, { ...getCharacterProgress(key), ...patch });
  notify(key);
}

export function useCharacterProgress(key) {
  return useSyncExternalStore(
    (onChange) => {
      if (!listeners.has(key)) listeners.set(key, new Set());
      listeners.get(key).add(onChange);
      return () => listeners.get(key).delete(onChange);
    },
    () => getCharacterProgress(key),
  );
}
