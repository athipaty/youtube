export default function CharacterSpriteGrid({ character }) {
  if (!character) return null;

  if (character.status === 'pending') {
    return <p className="text-xs text-slate-400">No sprites generated yet.</p>;
  }
  if (character.status === 'generating_sprites') {
    return <p className="text-xs text-violet-600 font-semibold">🎨 Generating sprite set…</p>;
  }
  if (character.status === 'error') {
    return <p className="text-xs text-red-500">⚠ Sprite generation failed: {character.spriteError}</p>;
  }

  return (
    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
      {character.sprites.map((s) => (
        <div key={s.expression} className="flex flex-col items-center gap-1">
          <img
            src={s.imageUrl}
            alt={`${character.name} — ${s.expression}`}
            className="w-full aspect-square object-contain rounded-xl bg-slate-50 border border-slate-100"
          />
          <span className="text-[10px] text-slate-400 capitalize">{s.expression}</span>
        </div>
      ))}
    </div>
  );
}
