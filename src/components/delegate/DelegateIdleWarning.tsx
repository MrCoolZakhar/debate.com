'use client';
// "Still there?" warning shown two minutes before the delegate idle logout
// (src/lib/delegateIdle.ts). Owns its own one-second countdown so the delegate page does
// not re-render every second. The countdown is derived from the wall-clock deadline, so
// it is right after the tab was throttled or the phone slept.
import { useEffect, useRef, useState } from 'react';
import { OUTFIT } from '@/components/neu';
import { DG, Panel, ChunkyButton } from '@/components/delegate/DelegateUI';
import { useT } from '@/contexts/LanguageContext';

function mmss(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export default function DelegateIdleWarning({ deadline, onStillHere, onExpire }: {
  deadline: () => number;
  onStillHere: () => void;
  onExpire: () => void;
}) {
  const t = useT();
  const [now, setNow] = useState(() => Date.now());
  const buttonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (n >= deadline()) onExpire();
    }, 1000);
    return () => clearInterval(id);
  }, [deadline, onExpire]);

  // Move focus to the action so a keyboard or screen-reader user can answer at once.
  useEffect(() => {
    buttonRef.current?.querySelector('button')?.focus();
  }, []);

  const remaining = mmss(deadline() - now);
  // Screen readers hear the sentence once, when the dialog opens, not every second.
  const [announced] = useState(() => t('delegate_idle_body', { time: mmss(deadline() - Date.now()) }));

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-end sm:items-center justify-center px-4 pb-6 sm:pb-0"
      style={{ background: 'rgba(28,20,16,0.35)' }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delegate-idle-title"
        aria-describedby="delegate-idle-body"
        className="w-full max-w-sm"
      >
        <Panel className="dgv-rise text-center">
          <h2 id="delegate-idle-title" style={{ margin: 0, fontFamily: OUTFIT, fontSize: 22, fontWeight: 900, color: DG.forest }}>
            {t('delegate_idle_title')}
          </h2>
          <p id="delegate-idle-body" className="sr-only">{announced}</p>
          <p aria-hidden="true" style={{ margin: '10px 0 18px', fontFamily: OUTFIT, fontSize: 15, lineHeight: 1.5, color: DG.body, fontVariantNumeric: 'tabular-nums' }}>
            {t('delegate_idle_body', { time: remaining })}
          </p>
          <div ref={buttonRef}>
            <ChunkyButton onClick={onStillHere}>{t('delegate_idle_im_here')}</ChunkyButton>
          </div>
        </Panel>
      </div>
    </div>
  );
}
