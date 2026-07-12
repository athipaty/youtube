export default function EpisodePlayer({ episode }) {
  if (!episode?.videoUrl) return null;
  return (
    <video
      src={episode.videoUrl}
      controls
      className="w-full rounded-xl bg-black shadow-card"
    />
  );
}
