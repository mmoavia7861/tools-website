import React from 'react';

export interface AdSlotProps {
  slotId: string;
  format?: 'horizontal' | 'rectangle' | 'banner';
  className?: string;
  enabled?: boolean;
}

export const AdSlot: React.FC<AdSlotProps> = ({
  slotId,
  format = 'horizontal',
  className = '',
  enabled = false // Disabled by default in accordance with master prompt guidelines
}) => {
  // If ads are not enabled, return empty or a discreet, policy-compliant placeholder
  if (!enabled) {
    return (
      <div
        aria-hidden="true"
        className={`my-8 mx-auto rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-4 text-center text-xs text-slate-400 select-none ${className}`}
      >
        <span className="font-mono tracking-wider uppercase">Reserved Sponsor Space</span>
        <span className="block text-[11px] text-slate-400/80 mt-0.5">
          (Ads currently inactive pending publisher configuration)
        </span>
      </div>
    );
  }

  // Active AdSense unit container
  const dimensions =
    format === 'horizontal'
      ? 'min-h-[90px] max-w-[728px]'
      : format === 'banner'
      ? 'min-h-[60px] max-w-[970px]'
      : 'min-h-[250px] max-w-[300px]';

  return (
    <aside
      aria-label="Advertisement"
      className={`my-8 mx-auto flex flex-col items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50/50 p-2 text-center ${dimensions} ${className}`}
    >
      <div className="w-full text-right pb-1 pr-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Advertisement
        </span>
      </div>
      <div className="w-full flex items-center justify-center py-2 text-xs text-slate-400">
        <ins
          className="adsbygoogle"
          style={{ display: 'block', textAlign: 'center' }}
          data-ad-layout="in-article"
          data-ad-format="auto"
          data-ad-slot={slotId}
        />
      </div>
    </aside>
  );
};
