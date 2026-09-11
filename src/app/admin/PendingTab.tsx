'use client';

// Staff → Users → Pending. Everyone the platform knows by email who has no
// account behind them yet, from the four places such a person can come from:
// an imported or invited applicant who never claimed the row, a chair invited
// to a committee, a secretariat member invited onto a team, and a bare
// pre-registration.
//
// SECURITY: same model as UsersTab. admin_pending_people is SECURITY DEFINER
// and raises 'not authorised' unless is_platform_admin(). This component holds
// no access logic worth trusting; a non-staff visitor gets a database error and
// an empty screen.
//
// READ ONLY. There is deliberately no resend, no invite and no delete here.
// Every one of those sends mail or mutates somebody else's conference, and the
// surfaces that own them (the organiser's own team and chairs pages) already do
// it with the right permissions and the right audit trail.

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, X, Inbox, Gavel, Building2, MailPlus, UserX } from 'lucide-react';
import Loader from '@/components/Loader';
import Avatar from '@/components/Avatar';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { NEU, NEU_GRADIENTS, OUTFIT, EASE, NeuCard, NeuInset, NeuStatTile, NeuIconDisc } from '@/components/neu';
import { Chip, Eyebrow, MONO, NUM, RED, int, timeAgo } from './staffBits';

const PAGE_SIZE = 50;

/** Mirrors admin_pending_people exactly. */
interface PendingRow {
  id: string;
  kind: string;
  email: string;
  name: string | null;
  conference_name: string | null;
  conference_slug: string | null;
  detail: string | null;
  created_at: string | null;
  has_account: boolean;
  total_count: number;
  kind_counts: Record<string, number> | null;
}

type Kind = 'applicant' | 'chair' | 'organiser' | 'prereg';

/** One definition of each source: the chip, the tile, the icon and the sentence
 *  that says where the row came from. Nothing about a kind is spelled twice. */
const KINDS: {
  key: Kind;
  chip: string;
  tile: string;
  icon: typeof Inbox;
  gradient: [string, string];
  bg: string;
  fg: string;
  where: string;
}[] = [
  {
    key: 'applicant',
    chip: 'UNCLAIMED APPLICANT',
    tile: 'Unclaimed applicants',
    icon: Inbox,
    gradient: NEU_GRADIENTS.forest,
    bg: 'color-mix(in srgb, var(--gv-main) 10%, transparent)',
    fg: NEU.forest,
    where: 'An application imported or entered by an organiser, with an email on it and nobody signed in behind it.',
  },
  {
    key: 'chair',
    chip: 'CHAIR INVITE',
    tile: 'Chairs invited',
    icon: Gavel,
    gradient: NEU_GRADIENTS.gold,
    bg: 'color-mix(in srgb, var(--gv-accent) 14%, transparent)',
    fg: NEU.deepGold,
    where: 'Invited to chair a committee. The invite is still pending.',
  },
  {
    key: 'organiser',
    chip: 'ORGANISER INVITE',
    tile: 'Organisers invited',
    icon: Building2,
    gradient: NEU_GRADIENTS.green,
    bg: 'color-mix(in srgb, var(--gv-main-light) 14%, transparent)',
    fg: NEU.green,
    where: 'Invited onto a secretariat. The invite is still pending.',
  },
  {
    key: 'prereg',
    chip: 'PRE-REGISTRATION',
    tile: 'Pre-registrations',
    icon: MailPlus,
    gradient: NEU_GRADIENTS.sage,
    bg: 'rgba(27,56,40,0.07)',
    fg: NEU.inkSoft,
    where: 'Left an email before accounts existed. There is nothing on record but the address.',
  },
];

const KIND_BY_KEY = new Map(KINDS.map(k => [k.key, k]));

export default function PendingTab() {
  const { session, loading: authLoading } = useAuth();
  const [rows, setRows] = useState<PendingRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<Kind | null>(null);

  // Debounced, so typing does not fire an RPC per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setSearch(q.trim()), 260);
    return () => clearTimeout(t);
  }, [q]);

  const fetchPage = useCallback(async (offset: number) => {
    if (!session) { setError('Not signed in.'); setRows([]); return; }
    if (offset === 0) setLoading(true); else setMore(true);
    setError(null);
    const supabase = getAuthedClient(session.access_token);
    const { data, error: e } = await supabase.rpc('admin_pending_people', {
      p_search: search || null,
      p_kind: kind,
      p_limit: PAGE_SIZE,
      p_offset: offset,
    });
    setLoading(false);
    setMore(false);
    if (e) {
      setError(e.message);
      setRows(r => (offset === 0 ? [] : r));
      return;
    }
    const page = (data ?? []) as PendingRow[];
    // bigint and jsonb can arrive as strings over PostgREST — coerce, never trust.
    if (page.length) {
      setTotal(Number(page[0].total_count) || 0);
      const kc = page[0].kind_counts;
      if (kc) {
        const parsed = typeof kc === 'string' ? (JSON.parse(kc) as Record<string, number>) : kc;
        setCounts(Object.fromEntries(Object.entries(parsed).map(([k, v]) => [k, Number(v) || 0])));
      }
    } else if (offset === 0) {
      setTotal(0);
      // An empty page carries no kind_counts row, so a search that matches one
      // kind and not another must not leave that tile showing a stale number.
      // With no kind filter an empty page means the search matched nothing at
      // all, so every tile is genuinely zero.
      if (kind) setCounts(c => ({ ...c, [kind]: 0 }));
      else setCounts({});
    }
    setRows(r => (offset === 0 || !r ? page : [...r, ...page]));
  }, [session, search, kind]);

  useEffect(() => {
    if (authLoading) return;
    void fetchPage(0);
  }, [authLoading, fetchPage]);

  const loadedAll = !!rows && rows.length >= total;

  return (
    <div className="flex flex-col" style={{ gap: 16 }}>

      {/* ── Four sources, each a filter ─────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {KINDS.map(k => (
          <NeuStatTile
            key={k.key}
            compact
            gradient={k.gradient}
            icon={k.icon}
            value={int(counts[k.key] ?? 0)}
            label={k.tile}
            active={kind === k.key}
            onClick={() => setKind(cur => (cur === k.key ? null : k.key))}
          />
        ))}
      </div>

      <p style={{ fontFamily: OUTFIT, fontSize: 11.5, color: NEU.inkSoft, lineHeight: 1.55 }}>
        {int(counts.all ?? 0)} people the platform knows by email with no account behind them.
        Tap a tile to show only that source, tap it again to clear.
        {kind && ` Showing ${KIND_BY_KEY.get(kind)?.tile.toLowerCase()} only.`}
      </p>

      {/* ── Search ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        <NeuInset small className="flex items-center gap-2" style={{ padding: '8px 14px', borderRadius: 999 }}>
          <Search size={13} style={{ color: NEU.muted }} />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Email, name or conference…"
            className="focus:outline-none"
            style={{ fontFamily: OUTFIT, fontSize: 12.5, background: 'transparent', border: 'none', color: NEU.ink, width: 230 }}
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ('')}
              aria-label="Clear search"
              className="focus:outline-none"
              style={{ background: 'transparent', border: 'none', color: NEU.muted, cursor: 'pointer', lineHeight: 0 }}
            >
              <X size={13} />
            </button>
          )}
        </NeuInset>

        {rows && (
          <span className="ml-auto" style={{ fontFamily: MONO, fontSize: 11, color: NEU.inkSoft, ...NUM }}>
            {int(rows.length)} of {int(total)}
          </span>
        )}
      </div>

      {loading && <div className="flex items-center justify-center py-16"><Loader /></div>}

      {!loading && error && (
        <NeuCard style={{ padding: '18px 20px', textAlign: 'center' }}>
          <p style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 800, color: RED }}>Could not load pending people.</p>
          <p className="mt-1" style={{ fontFamily: MONO, fontSize: 11, color: NEU.inkSoft }}>{error}</p>
        </NeuCard>
      )}

      {!loading && !error && rows && rows.length === 0 && (
        <p className="py-12 text-center" style={{ fontFamily: OUTFIT, fontSize: 13, color: NEU.inkSoft }}>
          {search ? 'Nobody matches that search.' : 'Nothing pending here.'}
        </p>
      )}

      {!loading && !error && rows && rows.length > 0 && (
        <div className="flex flex-col" style={{ gap: 8 }}>
          {rows.map(r => {
            const k = KIND_BY_KEY.get(r.kind as Kind);
            const label = r.name || r.email || 'No email on record';
            // The headline is the name when there is one, so the email drops to
            // the second line. With no name the email IS the headline and must
            // not be printed twice.
            const sub = [r.name ? r.email : null, r.detail].filter(Boolean).join(' · ');
            return (
              <NeuCard key={r.id} style={{ padding: '11px 15px' }}>
                <div className="flex items-center gap-3">
                  {r.name
                    ? <Avatar url={null} name={r.name} size={32} />
                    : <NeuIconDisc gradient={k?.gradient ?? NEU_GRADIENTS.sage} icon={k?.icon ?? MailPlus} size={32} />}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="truncate" style={{ fontFamily: OUTFIT, fontSize: 13.5, fontWeight: 900, color: NEU.ink, maxWidth: 300 }}>
                        {label}
                      </span>
                      {k && <Chip text={k.chip} bg={k.bg} fg={k.fg} />}
                      {r.has_account && <Chip text="HAS ACCOUNT" bg="color-mix(in srgb, var(--gv-main-light) 14%, transparent)" fg={NEU.green} />}
                    </div>
                    {sub && (
                      <p className="truncate" style={{ fontFamily: OUTFIT, fontSize: 11.5, color: NEU.inkSoft, marginTop: 1 }}>
                        {sub}
                      </p>
                    )}
                  </div>

                  {r.conference_name && (
                    <span className="hidden md:block truncate" style={{ width: 210, textAlign: 'end' }}>
                      {r.conference_slug ? (
                        <Link
                          href={`/manage/${r.conference_slug}`}
                          style={{ fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 700, color: NEU.forest, textDecoration: 'none' }}
                        >
                          {r.conference_name}
                        </Link>
                      ) : (
                        <span style={{ fontFamily: OUTFIT, fontSize: 11.5, color: NEU.inkSoft }}>{r.conference_name}</span>
                      )}
                    </span>
                  )}

                  <span style={{ fontFamily: MONO, fontSize: 10.5, color: NEU.muted, width: 74, textAlign: 'end', flexShrink: 0, ...NUM }}>
                    {timeAgo(r.created_at)}
                  </span>
                </div>
              </NeuCard>
            );
          })}

          {!loadedAll && (
            <button
              type="button"
              onClick={() => rows && void fetchPage(rows.length)}
              disabled={more}
              className="focus:outline-none"
              style={{
                marginTop: 4, padding: '12px 0', borderRadius: 999, border: 'none',
                backgroundColor: NEU.surface, boxShadow: NEU.outSm, color: NEU.forest,
                fontFamily: OUTFIT, fontSize: 12, fontWeight: 800, letterSpacing: '0.05em',
                cursor: more ? 'default' : 'pointer', opacity: more ? 0.6 : 1,
                transition: `box-shadow 200ms ${EASE}`,
              }}
            >
              {more ? 'LOADING…' : `LOAD ${Math.min(PAGE_SIZE, total - rows.length)} MORE`}
            </button>
          )}
        </div>
      )}

      {/* ── What each source means. The tiles are a filter, not a definition. */}
      <NeuCard style={{ padding: '16px 20px 18px' }}>
        <div className="flex items-center gap-2 mb-3">
          <UserX size={14} strokeWidth={2.4} style={{ color: NEU.deepGold }} />
          <Eyebrow>Where these people come from</Eyebrow>
        </div>
        <div className="flex flex-col" style={{ gap: 7 }}>
          {KINDS.map(k => (
            <div key={k.key} className="flex items-start gap-2.5">
              <Chip text={k.chip} bg={k.bg} fg={k.fg} />
              <span style={{ fontFamily: OUTFIT, fontSize: 11.5, color: NEU.inkSoft, lineHeight: 1.5 }}>{k.where}</span>
            </div>
          ))}
        </div>
        <p style={{ fontFamily: OUTFIT, fontSize: 11.5, color: NEU.inkSoft, lineHeight: 1.55, marginTop: 12 }}>
          Everyone here is unregistered. Somebody who has since signed up under the same address
          leaves the list, and so do seeded conferences and example.com addresses, so the number is
          people you could actually chase.
        </p>
      </NeuCard>
    </div>
  );
}
