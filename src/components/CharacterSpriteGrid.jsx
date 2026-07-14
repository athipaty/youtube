import { useLanguage } from '../utils/i18n';

export default function CharacterSpriteGrid({ character, regeneratingExpression, onRegenerate }) {
  const { t } = useLanguage();
  if (!character) return null;

  if (character.status === 'pending') {
    return <p className="text-xs text-slate-400">{t('spriteGrid.none')}</p>;
  }
  if (character.status === 'generating_sprites') {
    return <p className="text-xs text-violet-600 font-semibold">{t('spriteGrid.generating')}</p>;
  }
  if (character.status === 'error' && !character.sprites?.length) {
    return <p className="text-xs text-red-500">{t('spriteGrid.failed', { error: character.spriteError })}</p>;
  }

  return (
    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
      {character.sprites.map((s) => {
        const busy = regeneratingExpression === s.expression;
        return (
          <div key={s.expression} className="flex flex-col items-center gap-1">
            <div className="relative w-full">
              <img
                src={s.imageUrl}
                alt={`${character.name} — ${s.expression}`}
                className={`w-full aspect-square object-contain rounded-xl bg-slate-50 border border-slate-100 transition-opacity ${busy ? 'opacity-40' : ''}`}
              />
              {onRegenerate && (
                <button
                  type="button"
                  disabled={busy || !!regeneratingExpression}
                  onClick={() => onRegenerate(s.expression)}
                  title={t('spriteGrid.regenerate')}
                  className="absolute top-1 right-1 w-6 h-6 flex items-center justify-center rounded-full bg-white/90 border border-slate-200 text-xs shadow-soft hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {busy ? '⏳' : '🔄'}
                </button>
              )}
            </div>
            <span className="text-[10px] text-slate-400 capitalize">{s.expression}</span>
          </div>
        );
      })}
    </div>
  );
}
