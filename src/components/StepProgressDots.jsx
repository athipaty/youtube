// Modeled directly on EbayListingControls.jsx's step-dots pattern in the sibling amazon-tracker
// project — same visual language (numbered dot -> checkmark, connecting line), reel-purple
// instead of that project's blue accent.
export default function StepProgressDots({ steps, currentStep, labels }) {
  const currentIdx = steps.indexOf(currentStep);
  return (
    <div className="flex flex-col gap-2 px-3 py-2.5 rounded-xl ring-1 ring-inset bg-violet-50 ring-violet-200">
      <div className="flex items-center">
        {steps.map((step, i) => {
          const done = i < currentIdx;
          const active = i === currentIdx;
          return (
            <div key={step} className="flex items-center">
              <div className={`w-[18px] h-[18px] rounded-full flex items-center justify-center text-[8px] font-bold flex-shrink-0 transition-colors ${
                done ? 'bg-reel text-white' :
                active ? 'bg-reel-dark text-white ring-2 ring-offset-1 ring-violet-300' :
                'bg-slate-200 text-slate-400'
              }`}>
                {done ? '✓' : i + 1}
              </div>
              {i < steps.length - 1 && (
                <div className={`w-3 h-px flex-shrink-0 ${done ? 'bg-violet-400' : 'bg-slate-200'}`} />
              )}
            </div>
          );
        })}
      </div>
      <span className="text-[11px] text-violet-700 font-semibold leading-snug">
        {labels?.[currentStep] || currentStep || '…'}
      </span>
    </div>
  );
}
