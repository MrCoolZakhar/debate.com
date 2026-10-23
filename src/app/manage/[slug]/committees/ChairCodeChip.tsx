import { useEffect, useRef, useState } from 'react';
import { Copy, Check, Info } from 'lucide-react';
import type { getAuthedClient } from '@/lib/supabase-auth';
import { NEU, OUTFIT } from '@/components/neu';
import Portal from '@/components/Portal';

// The CHAIR PASSWORD (13 Oct 2026: shown and copied as the 4 digits of chairJoinSuffix
// alone, no longer as "{session code}-{suffix}"; the join page asks for exactly that) for a
// committee whose dais
// is OPEN: no assigned chair, no pending chair invite, no unclaimed imported
// chair. On an open dais the join page lets chairs in with this code exactly
// like a standalone session, and nothing else under /manage shows it, so
// without this chip nobody could chair the room.
//
// Open or gated is decided by the server's own `session_join_rules(p_code)`
// (its `chairs_open`), the same RPC the join page reads, so this chip can never
// disagree with the door it opens. It fails closed: any error, a missing
// suffix, or a committee without a linked session shows nothing. The code is
// also the RLS write credential for the room, hence the hint.

type Client = ReturnType<typeof getAuthedClient>;

const EASE = 'cubic-bezier(0.22,1,0.36,1)';
const HINT = 'Chairs need this only while nobody is added or invited to chair this committee. Once chairs are added, they join without it. Share it only with your chairs.';
const FOCUS = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]/40';

/** One batched pass for the whole grid: one `committees` read for every
 *  suffix, then `session_join_rules` per session in parallel. Returns the chair
 *  password (the 4-digit suffix) keyed by conference_committees.id, for open daises only. */
export async function loadOpenDaisChairCodes(
  supabase: Client,
  rows: { id: string; session_id: string | null }[],
): Promise<Record<string, string>> {
  const linked = rows.filter(r => !!r.session_id);
  if (linked.length === 0) return {};
  try {
    const { data, error } = await supabase
      .from('committees')
      .select('id, code, settings')
      .in('id', linked.map(r => r.session_id as string));
    if (error || !data) return {};
    type SessionRow = { id: string; code: string | null; settings: { chairJoinSuffix?: unknown } | null };
    const byId = new Map((data as SessionRow[]).map(s => [s.id, s]));
    const entries = await Promise.all(linked.map(async (r): Promise<[string, string] | null> => {
      const s = byId.get(r.session_id as string);
      const suffix = s?.settings?.chairJoinSuffix;
      if (!s?.code || typeof suffix !== 'string' || suffix === '') return null;
      const { data: rules, error: rulesError } = await supabase.rpc('session_join_rules', { p_code: s.code });
      if (rulesError || (rules as { chairs_open?: boolean } | null)?.chairs_open !== true) return null;
      return [r.id, suffix];
    }));
    return Object.fromEntries(entries.filter((e): e is [string, string] => e !== null));
  } catch {
    return {};
  }
}

/** Same chip as the session code beside it, sharing the page's copy feedback, with the
 *  label "CHAIR PASSWORD" and an Info hint beside it (hover, focus or tap). Renders nothing
 *  when `code` is null (gated dais, or no session). `code` is the 4-digit password. */
export function ChairCodeChip({ code, copiedCode, onCopy, layout }: {
  code: string | null;
  copiedCode: string | null;
  onCopy: (code: string) => void;
  layout: 'row' | 'tile';
}) {
  if (!code) return null;
  const copied = copiedCode === code;
  const label = (
    <span className="inline-flex items-center gap-1">
      <span style={{ fontFamily: OUTFIT, fontSize: 8.5, fontWeight: 700, letterSpacing: '0.14em', color: '#6B5F52' }}>
        CHAIR PASSWORD
      </span>
      <InfoHint text={HINT} />
    </span>
  );
  const digits = (
    <span style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 700, letterSpacing: '0.12em', color: NEU.forest, fontVariantNumeric: 'tabular-nums' }}>{code}</span>
  );
  const copiedMark = (
    <span className="inline-flex items-center gap-1.5">
      <Check size={12} style={{ color: NEU.green }} />
      <span style={{ fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 800, color: '#2F6644' }}>Copied</span>
    </span>
  );

  if (layout === 'row') {
    return (
      <span
        className="inline-flex items-center gap-1.5 flex-shrink-0"
        style={{ padding: '4px 4px 4px 12px', borderRadius: 9999, backgroundColor: copied ? 'rgba(61,122,82,0.12)' : NEU.surface, boxShadow: copied ? 'none' : NEU.outSm, transition: `background-color 250ms ${EASE}` }}
      >
        {label}
        <button
          type="button"
          onClick={() => onCopy(code)}
          aria-label="Copy chair password"
          className={`inline-flex items-center gap-1.5 rounded-full ${FOCUS}`}
          style={{ padding: '2px 8px', cursor: 'pointer', background: 'transparent', border: 'none' }}
        >
          {copied ? copiedMark : (<>{digits}<Copy size={11} style={{ color: 'rgba(27,56,40,0.55)' }} /></>)}
        </button>
      </span>
    );
  }

  // The card's tile (owner, 23 Oct 2026): one of two equal tiles on a row
  // beside the session code tile, the label on top (it may wrap, never cut)
  // and the digits with the copy icon beneath. The whole tile copies: the click
  // lands on the tile, the inner button is the keyboard target (its click
  // bubbles to the tile), and the Info hint stops its own click.
  return (
    <div
      onClick={() => onCopy(code)}
      title="Copy chair password"
      className="flex-1 basis-0 min-w-0 flex flex-col items-start justify-center gap-1 rounded-[10px] px-2 py-2"
      style={{
        minHeight: 48,
        cursor: 'pointer',
        backgroundColor: copied ? 'rgba(61,122,82,0.12)' : NEU.surface,
        boxShadow: copied ? 'none' : NEU.outSm,
        transition: `background-color 300ms ${EASE}`,
      }}
    >
      <span className="flex flex-wrap items-center gap-x-1">
        <span style={{ fontFamily: OUTFIT, fontSize: 8.5, fontWeight: 700, letterSpacing: '0.14em', color: '#6B5F52' }}>
          CHAIR PASSWORD
        </span>
        <InfoHint text={HINT} />
      </span>
      <button
        type="button"
        aria-label="Copy chair password"
        className={`inline-flex items-center gap-1.5 min-w-0 rounded-md active:scale-[0.96] ${FOCUS}`}
        style={{ padding: 0, cursor: 'pointer', background: 'transparent', border: 'none', transitionProperty: 'scale', transitionDuration: '300ms', transitionTimingFunction: EASE }}
      >
        {copied ? copiedMark : (<>{digits}<Copy size={11} style={{ color: 'rgba(27,56,40,0.55)', flexShrink: 0 }} /></>)}
      </button>
    </div>
  );
}

/** A small Info icon whose hint opens on hover and focus (and on a tap, for touch), drawn
 *  through Portal at fixed coordinates so no card clips it, flipped above near the bottom. */
function InfoHint({ text }: { text: string }) {
  const [pos, setPos] = useState<{ left: number; top: number; above: boolean } | null>(null);
  const ref = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<number | null>(null);
  const show = () => {
    if (closeTimer.current) { window.clearTimeout(closeTimer.current); closeTimer.current = null; }
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const width = 260;
    const left = Math.max(8, Math.min(r.left + r.width / 2 - width / 2, window.innerWidth - width - 8));
    const above = r.bottom + 110 > window.innerHeight;
    setPos({ left, top: above ? r.top - 8 : r.bottom + 8, above });
  };
  const hide = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setPos(null), 120);
  };
  useEffect(() => {
    if (!pos) return;
    const away = () => setPos(null);
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setPos(null); };
    window.addEventListener('scroll', away, true);
    window.addEventListener('resize', away);
    window.addEventListener('keydown', esc);
    return () => { window.removeEventListener('scroll', away, true); window.removeEventListener('resize', away); window.removeEventListener('keydown', esc); };
  }, [pos]);
  useEffect(() => () => { if (closeTimer.current) window.clearTimeout(closeTimer.current); }, []);
  return (
    <>
      <button
        ref={ref}
        type="button"
        aria-label={text}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={(e) => { e.stopPropagation(); if (pos) setPos(null); else show(); }}
        className={`inline-flex items-center justify-center rounded-full ${FOCUS}`}
        style={{ width: 16, height: 16, color: '#6B5F52', background: 'transparent', border: 'none', cursor: 'help', padding: 0 }}
      >
        <Info size={12} strokeWidth={2.4} aria-hidden />
      </button>
      {pos && (
        <Portal>
          <div
            role="tooltip"
            onMouseEnter={show}
            onMouseLeave={hide}
            className="fixed z-[90]"
            style={{
              left: pos.left, top: pos.top, width: 260, transform: pos.above ? 'translateY(-100%)' : undefined,
              padding: '10px 12px', borderRadius: 12, backgroundColor: '#FFFFFF', color: '#1C1410',
              fontFamily: OUTFIT, fontSize: 12.5, lineHeight: 1.45,
              boxShadow: '0 1px 2px rgba(27,56,40,0.12), 0 12px 28px rgba(27,56,40,0.20)',
            }}
          >
            {text}
          </div>
        </Portal>
      )}
    </>
  );
}
