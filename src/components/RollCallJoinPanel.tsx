'use client';

// ─────────────────────────────────────────────────────────────────────────────
// "Will delegates join on their phones?" (23 Sep 2026)
//
// Shown beside the full-screen roll call (pre-session only; the chair page mounts it and it
// disappears with Begin Session, because pre-session is the only phase that renders it).
// Yes puts the SESSION code big and a QR code for gavelling.com/join?code=CODE on the
// left of the roll call, so delegates can join while the dais takes roll; "Present on
// screen" opens the full-screen SessionCodePresenter. No folds it to one quiet line.
// The answer is remembered per room on this device (`gavelling-phones-join:<CODE>`).
//
// The QR is drawn locally (src/lib/qrCode.ts), like the presenter: no third-party request.
// Only the session code is ever shown here, never the chair code. Writes nothing to the
// committee (rules 3 to 5).
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from 'react';
import { Maximize2, Smartphone, MonitorSmartphone } from 'lucide-react';
import { useT } from '@/contexts/LanguageContext';
import { encodeQr } from '@/lib/qrCode';

const OUTFIT = "var(--font-brand), sans-serif";
const JOIN_HOST = 'gavelling.com';
const storageKey = (code: string) => `gavelling-phones-join:${code.toUpperCase()}`;

function Qr({ text, size }: { text: string; size: number }) {
  const matrix = useMemo(() => encodeQr(text), [text]);
  if (!matrix) return null;
  const quiet = 2;
  const dim = matrix.length + quiet * 2;
  let d = '';
  matrix.forEach((row, y) => row.forEach((dark, x) => { if (dark) d += `M${x + quiet} ${y + quiet}h1v1h-1z`; }));
  return (
    <svg aria-hidden viewBox={`0 0 ${dim} ${dim}`} width={size} height={size} shapeRendering="crispEdges"
      style={{ display: 'block', borderRadius: 10, backgroundColor: '#FFFFFF' }}>
      <path d={d} fill="#1C1410" />
    </svg>
  );
}

function readAnswer(code: string): 'yes' | 'no' | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = localStorage.getItem(storageKey(code));
    return v === 'yes' || v === 'no' ? v : null;
  } catch { return null; /* storage unavailable: ask */ }
}

export default function RollCallJoinPanel({ code, onPresent, compact = false }: {
  code: string;
  /** Opens the full-screen SessionCodePresenter, growing from the pressed button. */
  onPresent: (origin: DOMRect) => void;
  /** Narrow screens: a horizontal strip above the roll call instead of a side column. */
  compact?: boolean;
}) {
  const t = useT();
  // The remembered answer is read in the initial state (the chair page renders this only
  // on the client, after the room loaded); a different room code re-reads it during render.
  const [stored, setStored] = useState(() => ({ code, answer: readAnswer(code) }));
  if (stored.code !== code) setStored({ code, answer: readAnswer(code) });
  const answer = stored.code === code ? stored.answer : readAnswer(code);
  const choose = (v: 'yes' | 'no' | null) => {
    setStored({ code, answer: v });
    try {
      if (v) localStorage.setItem(storageKey(code), v); else localStorage.removeItem(storageKey(code));
    } catch { /* not remembered, still works */ }
  };

  const joinUrl = `https://${JOIN_HOST}/join?code=${encodeURIComponent(code)}`;
  const card: React.CSSProperties = {
    backgroundColor: '#F6F1E6', border: '1px solid #DDD4C0', borderRadius: 22,
    boxShadow: '0 18px 44px rgba(27,56,40,0.14)', fontFamily: OUTFIT, color: '#1C1410',
  };
  const btn = 'inline-flex items-center justify-center gap-2 rounded-xl font-black focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] transition-[transform,background-color] duration-150 active:scale-[0.96]';
  const change = (
    <button type="button" onClick={() => choose(null)}
      className="text-xs font-bold underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] rounded"
      style={{ color: '#6A5A4A' }}>
      {t('rc_phones_change')}
    </button>
  );

  if (answer === null) {
    return (
      <section aria-label={t('rc_phones_title')} className={compact ? 'w-full px-4 py-3 flex items-center gap-3 flex-wrap' : 'w-full p-5'} style={card}>
        <div className={compact ? 'flex items-center gap-2 flex-1 min-w-[12rem]' : ''}>
          <span className="inline-flex items-center justify-center rounded-full shrink-0"
            style={{ width: compact ? 32 : 44, height: compact ? 32 : 44, backgroundColor: '#1B3828', color: '#EED98A', marginBottom: compact ? 0 : 12 }}>
            <Smartphone size={compact ? 16 : 22} strokeWidth={2.2} aria-hidden />
          </span>
          <h2 style={{ fontWeight: 800, fontSize: compact ? 15 : 20, lineHeight: 1.2, color: '#1B3828', textWrap: 'balance' }}>{t('rc_phones_title')}</h2>
        </div>
        <div className={`flex gap-2 ${compact ? '' : 'mt-4'}`}>
          <button type="button" onClick={() => choose('yes')} className={`${btn} ${compact ? 'h-10 px-5 text-sm' : 'flex-1 h-12 text-base'} gv-lift-dark`}
            style={{ backgroundColor: '#1B3828', color: '#EED98A' }}>{t('rc_phones_yes')}</button>
          <button type="button" onClick={() => choose('no')} className={`${btn} ${compact ? 'h-10 px-5 text-sm' : 'flex-1 h-12 text-base'}`}
            style={{ backgroundColor: '#EDE7D8', color: '#1C1410', border: '1.5px solid #DDD4C0' }}>{t('rc_phones_no')}</button>
        </div>
      </section>
    );
  }

  if (answer === 'no') {
    return (
      <section aria-label={t('rc_phones_title')} className="w-full px-4 py-3 flex items-center gap-2 flex-wrap" style={card}>
        <MonitorSmartphone size={16} strokeWidth={2.2} aria-hidden style={{ color: '#1B3828' }} />
        <p className="text-sm flex-1 min-w-0" style={{ color: '#6A5A4A' }}>{t('rc_phones_no_note')}</p>
        {change}
      </section>
    );
  }

  const present = (e: React.MouseEvent<HTMLButtonElement>) => onPresent(e.currentTarget.getBoundingClientRect());
  if (compact) {
    return (
      <section aria-label={t('rc_phones_join_title')} className="w-full px-4 py-3 flex items-center gap-4" style={card}>
        <div role="img" aria-label={t('code_present_qr', { url: `${JOIN_HOST}/join` })} className="shrink-0" style={{ lineHeight: 0 }}>
          <Qr text={joinUrl} size={92} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold" style={{ color: '#6A5A4A' }}>{JOIN_HOST}/join</p>
          <p className="tabular-nums truncate" style={{ fontWeight: 900, fontSize: 34, letterSpacing: '0.08em', color: '#1B3828', lineHeight: 1.1 }}>{code}</p>
          <div className="flex items-center gap-3 mt-1">
            <button type="button" onClick={present} className={`${btn} h-9 px-3 text-sm gv-lift-dark`} style={{ backgroundColor: '#1B3828', color: '#EED98A' }}>
              <Maximize2 size={14} strokeWidth={2.4} aria-hidden />{t('rc_phones_present')}
            </button>
            {change}
          </div>
        </div>
      </section>
    );
  }
  return (
    <section aria-label={t('rc_phones_join_title')} className="w-full p-5 flex flex-col items-center text-center" style={card}>
      <p className="text-xs font-black uppercase" style={{ letterSpacing: '0.12em', color: '#6A5A4A' }}>{t('rc_phones_join_title')}</p>
      <p className="mt-1 text-sm font-bold" style={{ color: '#1C1410' }}>{JOIN_HOST}/join</p>
      <p className="tabular-nums mt-1 max-w-full truncate" title={code}
        style={{ fontWeight: 900, fontSize: code.length > 8 ? 30 : 46, letterSpacing: '0.08em', color: '#1B3828', lineHeight: 1.05 }}>{code}</p>
      <div className="mt-4" role="img" aria-label={t('code_present_qr', { url: `${JOIN_HOST}/join` })} style={{ lineHeight: 0 }}>
        <Qr text={joinUrl} size={188} />
      </div>
      <p className="mt-3 text-xs" style={{ color: '#6A5A4A' }}>{t('rc_phones_scan')}</p>
      <button type="button" onClick={present} className={`${btn} mt-4 w-full h-11 text-sm gv-lift-dark`} style={{ backgroundColor: '#1B3828', color: '#EED98A' }}>
        <Maximize2 size={15} strokeWidth={2.4} aria-hidden />{t('rc_phones_present')}
      </button>
      <div className="mt-3">{change}</div>
    </section>
  );
}

/**
 * The roll call with the panel beside it. From SIDE_MIN px of room (measured on this box,
 * never the viewport, because FitToScreen scales the console) the panel sits on the left in a
 * 260px column and an equal empty column on the right keeps the roll-call card exactly
 * centred and at its full width. Below that the compact strip sits above the card. State
 * changes only when the answer to "is there room" changes.
 */
const SIDE_W = 260;
const SIDE_GAP = 24;
const CARD_W = 672;
const SIDE_MIN = CARD_W + (SIDE_W + SIDE_GAP) * 2 + 48;

export function RollCallWithJoin({ code, onPresent, children }: {
  code: string;
  onPresent: (origin: DOMRect) => void;
  children: React.ReactNode;
}) {
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  const [side, setSide] = useState(true);
  useEffect(() => {
    if (!box) return;
    const measure = () => {
      const next = box.clientWidth >= SIDE_MIN;
      setSide((prev) => (prev === next ? prev : next));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    return () => ro.disconnect();
  }, [box]);
  return (
    <div ref={setBox} className="flex-1 flex flex-col items-center justify-center px-6 py-5 min-h-0 min-w-0">
      {!side && (
        <div className="w-full shrink-0 mb-3" style={{ maxWidth: CARD_W }}>
          <RollCallJoinPanel code={code} onPresent={onPresent} compact />
        </div>
      )}
      <div className="w-full flex-1 min-h-0 flex items-stretch justify-center" style={{ gap: side ? SIDE_GAP : 0 }}>
        {side && (
          <div className="shrink-0 self-center" style={{ width: SIDE_W }}>
            <RollCallJoinPanel code={code} onPresent={onPresent} />
          </div>
        )}
        {children}
        {side && <div aria-hidden className="shrink-0" style={{ width: SIDE_W }} />}
      </div>
    </div>
  );
}
