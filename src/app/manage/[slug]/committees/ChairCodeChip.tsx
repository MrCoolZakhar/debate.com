import { Copy, Check } from 'lucide-react';
import type { getAuthedClient } from '@/lib/supabase-auth';
import { NEU, OUTFIT } from '@/components/neu';

// The chair code ({session code}-{chairJoinSuffix}) for a committee whose dais
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
const HINT = 'No chairs are assigned yet, so chairs join with this code. Share it only with your chairs.';
const FOCUS = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]/40';

/** One batched pass for the whole grid: one `committees` read for every
 *  suffix, then `session_join_rules` per session in parallel. Returns the full
 *  chair code keyed by conference_committees.id, for open daises only. */
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
      return [r.id, `${s.code}-${suffix}`];
    }));
    return Object.fromEntries(entries.filter((e): e is [string, string] => e !== null));
  } catch {
    return {};
  }
}

/** Same chip as the session code beside it, labelled, sharing the page's copy
 *  feedback. Renders nothing when `code` is null (gated dais, or no session). */
export function ChairCodeChip({ code, copiedCode, onCopy, layout }: {
  code: string | null;
  copiedCode: string | null;
  onCopy: (code: string) => void;
  layout: 'row' | 'card';
}) {
  if (!code) return null;
  const copied = copiedCode === code;
  const label = (
    <span style={{ fontFamily: OUTFIT, fontSize: 8.5, fontWeight: 700, letterSpacing: '0.14em', color: '#6B5F52' }}>
      CHAIR CODE
    </span>
  );

  if (layout === 'row') {
    return (
      <button
        type="button"
        onClick={() => onCopy(code)}
        title={HINT}
        aria-label={`Copy chair code ${code}`}
        className={`inline-flex items-center gap-1.5 flex-shrink-0 ${FOCUS}`}
        style={{ padding: '6px 12px', borderRadius: 9999, backgroundColor: copied ? 'rgba(61,122,82,0.12)' : NEU.surface, boxShadow: copied ? 'none' : NEU.outSm, cursor: 'pointer', transition: `background-color 250ms ${EASE}` }}
      >
        {copied ? (
          <>
            <Check size={12} style={{ color: NEU.green }} />
            <span style={{ fontFamily: OUTFIT, fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', color: NEU.green }}>COPIED</span>
          </>
        ) : (
          <>
            {label}
            <span style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 700, letterSpacing: '0.12em', color: NEU.forest, fontVariantNumeric: 'tabular-nums' }}>{code}</span>
            <Copy size={11} style={{ color: 'rgba(27,56,40,0.55)' }} />
          </>
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onCopy(code)}
      title={HINT}
      aria-label={`Copy chair code ${code}`}
      className={`mt-1.5 w-full flex items-center justify-between gap-2 rounded-[10px] px-2.5 py-2 active:scale-[0.96] ${FOCUS}`}
      style={{
        minHeight: 34,
        backgroundColor: copied ? 'rgba(61,122,82,0.12)' : NEU.surface,
        boxShadow: copied ? 'none' : NEU.outSm,
        cursor: 'pointer',
        transitionProperty: 'background-color, scale',
        transitionDuration: '300ms', transitionTimingFunction: EASE,
      }}
    >
      {label}
      {copied ? (
        <span className="inline-flex items-center gap-1.5">
          <Check size={12} style={{ color: NEU.green }} />
          <span style={{ fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 800, letterSpacing: '0.08em', color: '#2F6644' }}>COPIED</span>
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5 min-w-0">
          <span style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 700, letterSpacing: '0.12em', color: NEU.forest, fontVariantNumeric: 'tabular-nums', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {code}
          </span>
          <Copy size={11} style={{ color: 'rgba(27,56,40,0.55)', flexShrink: 0 }} />
        </span>
      )}
    </button>
  );
}
