export default function EpisodePlayer({ episode }) {
  if (!episode?.videoUrl) return null;
  return (
    <video
      // Keyed on the URL itself so a rerender (which now uploads to a genuinely new URL each time,
      // see stepRenderAndUpload's cache-busting fix) forces React to remount the element instead of
      // just patching the `src` attribute in place — some browsers don't reliably reload an
      // already-loaded <video> on an attribute-only src change without an explicit .load() call.
      key={episode.videoUrl}
      src={episode.videoUrl}
      controls
      className="w-full rounded-xl bg-black shadow-card"
    />
  );
}
