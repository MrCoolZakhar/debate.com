'use client';

// "Open to team roles" nudge (Job Board prompt 11). A slim card for signed-in
// people whose talent_settings says show_prompt. "Turn on" calls
// talent_set_open(true); "Not now" calls talent_dismiss_prompt. Either way the
// server ends show_prompt, and a per-session flag keeps the card from flashing
// back before the server's next answer. Renders nothing otherwise.
//
// The CV privacy panel dispatches TALENT_CHANGED_EVENT after a successful
// write, so turning the toggle on there removes this card on the same page.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Briefcase, Check } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { dismissTalentPrompt, fetchTalentSettings, setTalentOpen } from '@/lib/jobBoard';

export const TALENT_CHANGED_EVENT = 'gavelling-talent-changed';

const DONE_KEY = 'gavelling-talent-prompt-done:';
const FOREST = '#1B3828';
const INK = '#1C1410';
const INK_SOFT = '#5A5046';
const FONT = 'var(--font-brand), Inter, system-ui, sans-serif';

function markDone(userId: string) {
  try { window.sessionStorage.setItem(DONE_KEY + userId, '1'); } catch { /* storage blocked */ }
}
function isDone(userId: string): boolean {
  try { return window.sessionStorage.getItem(DONE_KEY + userId) === '1'; } catch { return false; }
}

type Phase = 'hidden' | 'ask' | 'done';

export default function TalentPrompt({ className, style }: { className?: string; style?: React.CSSProperties }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [phase, setPhase] = useState<Phase>('hidden');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);
  const leaveTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!userId || isDone(userId)) return;
    let cancelled = false;
    fetchTalentSettings().then((r) => {
      if (cancelled || 'ok' in r) return;
      if (r.show_prompt && !r.open && !isDone(userId)) setPhase('ask');
    });
    return () => { cancelled = true; setPhase('hidden'); };
  }, [userId]);

  // The toggle on the CV page turned it on (or off): the question is answered.
  useEffect(() => {
    if (!userId) return;
    const onChange = () => {
      markDone(userId);
      if (!busyRef.current) setPhase((p) => (p === 'ask' ? 'hidden' : p));
    };
    window.addEventListener(TALENT_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(TALENT_CHANGED_EVENT, onChange);
  }, [userId]);

  useEffect(() => () => { if (leaveTimer.current) window.clearTimeout(leaveTimer.current); }, []);

  const turnOn = useCallback(async () => {
    if (!userId || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    const r = await setTalentOpen(true);
    busyRef.current = false;
    setBusy(false);
    if (!r.ok) { setError(r.message); return; }
    markDone(userId);
    setPhase('done');
    try { window.dispatchEvent(new CustomEvent(TALENT_CHANGED_EVENT, { detail: { open: r.open } })); } catch { /* nothing listening */ }
    leaveTimer.current = window.setTimeout(() => setPhase('hidden'), 4000);
  }, [userId]);

  const notNow = useCallback(() => {
    if (!userId || busyRef.current) return;
    markDone(userId);
    setPhase('hidden');
    void dismissTalentPrompt();
  }, [userId]);

  if (!userId || phase === 'hidden') return null;

  return (
    <div
      role="status"
      className={`flex flex-wrap items-center gap-x-4 gap-y-3 rounded-[18px] ${className ?? ''}`}
      style={{
        width: '100%',
        padding: '14px 18px',
        background: '#FFFFFF',
        boxShadow: '0 0 0 1px rgba(27,56,40,0.06), 0 10px 24px -14px rgba(27,56,40,0.30)',
        fontFamily: FONT,
        ...style,
      }}
    >
      <span
        aria-hidden
        className="inline-flex items-center justify-center rounded-full flex-shrink-0"
        style={{ width: 36, height: 36, background: 'rgba(238,217,138,0.45)', color: FOREST }}
      >
        {phase === 'done' ? <Check size={17} strokeWidth={2.4} /> : <Briefcase size={17} strokeWidth={2.2} />}
      </span>

      <div className="min-w-0" style={{ flex: '1 1 260px' }}>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: INK, lineHeight: 1.4 }}>
          {phase === 'done'
            ? "You're open to team roles. Change it any time in your CV settings."
            : 'Want conferences to invite you to chair or join their team?'}
        </p>
        {phase === 'ask' && error && (
          <p role="alert" style={{ margin: '4px 0 0', fontSize: 13, fontWeight: 700, color: '#8B2020', lineHeight: 1.45 }}>
            {error}
          </p>
        )}
      </div>

      {phase === 'ask' && (
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={notNow}
            disabled={busy}
            className="rounded-[10px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
            style={{
              minHeight: 40, padding: '0 14px', border: 'none', background: 'transparent',
              fontFamily: FONT, fontSize: 14, fontWeight: 600, color: INK_SOFT,
              cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1,
            }}
          >
            Not now
          </button>
          <button
            type="button"
            onClick={() => { void turnOn(); }}
            disabled={busy}
            aria-busy={busy}
            className="rounded-[10px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F]"
            style={{
              minHeight: 40, padding: '0 18px', border: 'none',
              background: 'linear-gradient(90deg,#1B3828 0%,#2A5A3C 55%,#1E4A31 100%)',
              boxShadow: '0 8px 18px -8px rgba(27,56,40,0.55), inset 0 1px 0 rgba(255,255,255,0.14)',
              fontFamily: FONT, fontSize: 14, fontWeight: 700, color: '#FFFFFF', whiteSpace: 'nowrap',
              cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.7 : 1,
            }}
          >
            {busy ? 'Turning on' : 'Turn on'}
          </button>
        </div>
      )}
    </div>
  );
}
