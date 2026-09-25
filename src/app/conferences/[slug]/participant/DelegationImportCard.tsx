'use client';

// "Import Your Delegates": a delegation leader (faculty advisor or head
// delegate) brings their own delegates in by name and email. Each imported
// delegate uses one of the LEADER's own credits, returned to the leader if the
// delegate is rejected or withdraws; the delegate never pays a credit to claim.
// The server emails every imported delegate an invite itself.
//
// Shown on the pay page under "Pay for your delegates", and only while the
// conference allows it (conferences.allow_delegation_import) and the caller
// leads this delegation. The pay page reads that through useDelegationImport()
// below, so the action row itself never appears when the switch is off.
//
// Reads:  my_delegation_import(p_society)
// Writes: leader_import_delegates(p_society, p_rows)   1..200 rows, all or nothing
// Every refusal carries a plain `message`, shown through plainOrFallback. A
// leader short of credits is sent to the credits pop-up preselected at the
// shortfall, and the SAME import runs again once, when the purchase completes.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BadgeCheck, ClipboardPaste, Mail, Plus, RotateCcw, Undo2, UserCheck, UserX, X,
} from 'lucide-react';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { refreshCreditsEverywhere } from '@/hooks/useCredits';
import { openCreditsPopup } from '@/lib/purchasePopup';
import { triggerEmailDelivery } from '@/lib/emailDelivery';
import { friendlyError, plainOrFallback, UserFacingError } from '@/lib/friendlyError';
import { GoldWord } from '@/components/BrandHeading';
import { SectionCard, OUTFIT } from './shared';

const MAX_ROWS = 200;
const INK = '#1C1410';
const INK_SOFT = '#5A5046';
const FOREST = '#1B3828';
const LINE = '#DDD4C0';
const DANGER = '#8B2020';
const FOCUS = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FAF8F3]';

// ── Server shapes ──────────────────────────────────────────────────────────

export interface ImportedDelegate {
  application_id: string;
  name: string | null;
  email: string | null;
  status: string;
  claimed: boolean;
  credit: 'held' | 'claimed' | 'refunded' | string;
  imported_at: string;
}

export interface LeaderImport {
  enabled: boolean;
  pledged: number;
  delegates: number;
  free_spots: number;
  balance: number;
  imports: ImportedDelegate[];
}

type InvalidReason = 'name' | 'email' | 'duplicate' | 'self' | 'already_applied';

interface ImportAnswer {
  ok?: boolean;
  message?: string;
  invalid?: { email?: string; name?: string; reason?: InvalidReason }[];
  free_spots?: number;
  need_spots?: number;
  need_credits?: number;
  balance?: number;
  imported?: number;
  invited?: number;
}

function asInt(v: unknown, fallback = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : fallback;
}

function messageOr(a: unknown, fallback: string): string {
  const m = a && typeof a === 'object' && 'message' in a ? (a as { message?: unknown }).message : undefined;
  return typeof m === 'string' && m.length > 0 ? plainOrFallback(m, fallback) : fallback;
}

async function authedClient() {
  const client = await getFreshAuthedClient();
  if (!client) throw new UserFacingError('Your session has expired. Refresh the page and sign in again.');
  return client;
}

// ── The read, shared with the pay page ─────────────────────────────────────

/**
 * my_delegation_import for one delegation. `leader` is null for anyone who
 * does not lead it (or before the first answer); the pay page shows the
 * action row only when `leader?.enabled`.
 */
export function useDelegationImport(societyId: string | null) {
  const [leader, setLeader] = useState<LeaderImport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  const reload = useCallback(async () => {
    if (!societyId) { setLeader(null); return; }
    const mine = ++seq.current;
    setLoading(true);
    try {
      const client = await authedClient();
      const { data, error: rpcError } = await client.rpc('my_delegation_import', { p_society: societyId });
      if (mine !== seq.current) return;
      if (rpcError) throw rpcError;
      const a = (data ?? {}) as Record<string, unknown>;
      if (a.ok === true && a.is_leader === true) {
        setLeader({
          enabled: a.enabled === true,
          pledged: asInt(a.pledged),
          delegates: asInt(a.delegates),
          free_spots: asInt(a.free_spots),
          balance: asInt(a.balance),
          imports: Array.isArray(a.imports) ? (a.imports as ImportedDelegate[]) : [],
        });
        setError(null);
      } else if (a.ok === true) {
        setLeader(null);
        setError(null);
      } else {
        setError(messageOr(a, 'Your delegation could not be read. Refresh the page to try again.'));
      }
    } catch (e) {
      if (mine !== seq.current) return;
      setError(friendlyError(e, 'Your delegation could not be read. Refresh the page to try again.'));
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, [societyId]);

  useEffect(() => { void reload(); }, [reload]);

  return { leader, loading, error, reload };
}

// ── Rows ───────────────────────────────────────────────────────────────────

interface Row { key: number; name: string; email: string }

let rowKey = 0;
const newRow = (name = '', email = ''): Row => ({ key: ++rowKey, name, email });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const norm = (s: string) => s.trim().toLowerCase();

/** One delegate per line; name and email in either order, split by a comma,
 *  tab or semicolon. The token with an @ is the email, the rest the name. */
function parsePaste(text: string): Row[] {
  const out: Row[] = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    if (!line.trim()) return;
    // A spreadsheet header row ("Name, Email") is not a delegate.
    if (i === 0 && !line.includes('@') && /name/i.test(line) && /e-?mail/i.test(line)) return;
    const tokens = line.split(/[,\t;]/).map(t => t.trim()).filter(Boolean);
    const at = tokens.findIndex(t => t.includes('@'));
    const email = at >= 0 ? tokens[at] : '';
    const name = tokens.filter((_, j) => j !== at).join(' ').replace(/\s+/g, ' ');
    out.push(newRow(name, email));
  });
  return out;
}

function firstName(name: string | undefined | null): string {
  const n = (name ?? '').trim();
  return n ? n.split(/\s+/)[0] : 'This delegate';
}

// ── Status of an imported delegate ─────────────────────────────────────────

function statusOf(d: ImportedDelegate): { Icon: typeof Mail; label: string; color: string } {
  if (d.status === 'rejected') return { Icon: UserX, label: 'Not accepted', color: DANGER };
  if (d.status === 'withdrawn') return { Icon: Undo2, label: 'Withdrawn', color: INK_SOFT };
  if (d.status === 'accepted' || d.status === 'assigned' || d.status === 'checked-in') {
    return { Icon: BadgeCheck, label: 'Accepted', color: '#2A5A3C' };
  }
  if (d.claimed) return { Icon: UserCheck, label: 'Joined', color: FOREST };
  return { Icon: Mail, label: 'Invited', color: '#8A6414' };
}

// ── Card ───────────────────────────────────────────────────────────────────

export default function DelegationImportCard({
  societyId, data, reload, conferenceAcronym, userEmail, onPledgeMore, onImported,
}: {
  societyId: string;
  data: LeaderImport;
  reload: () => Promise<void>;
  /** Names the conference in the "has already applied" sentence. */
  conferenceAcronym: string;
  /** The leader's own address, refused as a row before the server does. */
  userEmail: string | null;
  /** Opens the pay page's own "Add spots" row and scrolls to it. */
  onPledgeMore: () => void;
  /** Whatever the pay page refreshes after a delegation change. */
  onImported?: () => void;
}) {
  const [rows, setRows] = useState<Row[]>(() => [newRow()]);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [capNote, setCapNote] = useState<string | null>(null);

  const [showClientErrors, setShowClientErrors] = useState(false);
  const [serverErrors, setServerErrors] = useState<Record<number, string>>({});
  const [topError, setTopError] = useState<string | null>(null);
  const [needSpots, setNeedSpots] = useState(false);
  const [okLine, setOkLine] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const aliveRef = useRef(true);
  // The rows to import again once the credits pop-up completes. Consumed
  // exactly once, so a second onComplete or a reopened pop-up cannot import twice.
  const retryRowsRef = useRef<{ name: string; email: string }[] | null>(null);
  const runRef = useRef<((list: { name: string; email: string }[]) => Promise<void>) | null>(null);

  useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; };
  }, []);

  // Rows that carry anything: an untouched blank row is not a delegate.
  const filled = useMemo(() => rows.filter(r => r.name.trim() || r.email.trim()), [rows]);
  const count = filled.length;

  const clientErrors = useMemo(() => {
    const errs: Record<number, string> = {};
    const seen = new Set<string>();
    const mine = userEmail ? norm(userEmail) : null;
    for (const r of rows) {
      if (!r.name.trim() && !r.email.trim()) continue;
      const e = norm(r.email);
      if (!r.name.trim()) errs[r.key] = "Add this delegate's name";
      else if (!EMAIL_RE.test(e)) errs[r.key] = 'Check this email address';
      else if (mine && e === mine) errs[r.key] = 'That is your own email';
      else if (seen.has(e)) errs[r.key] = 'This email is already on your list';
      if (e) seen.add(e);
    }
    return errs;
  }, [rows, userEmail]);

  const rowError = (key: number) => serverErrors[key] ?? (showClientErrors ? clientErrors[key] : undefined);

  function edit(key: number, field: 'name' | 'email', value: string) {
    setRows(prev => prev.map(r => (r.key === key ? { ...r, [field]: value } : r)));
    setServerErrors(prev => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setOkLine(null);
  }

  function removeRow(key: number) {
    setRows(prev => {
      const next = prev.filter(r => r.key !== key);
      return next.length > 0 ? next : [newRow()];
    });
    setCapNote(null);
  }

  function addRow() {
    if (rows.length >= MAX_ROWS) { setCapNote(`You can import up to ${MAX_ROWS} delegates at a time`); return; }
    setRows(prev => [...prev, newRow()]);
  }

  function fillFromPaste() {
    const parsed = parsePaste(pasteText);
    if (parsed.length === 0) return;
    // Keep the rows already typed, dropping blank ones, then add the paste.
    const kept = rows.filter(r => r.name.trim() || r.email.trim());
    const merged = [...kept, ...parsed];
    if (merged.length > MAX_ROWS) {
      setCapNote(`You can import up to ${MAX_ROWS} delegates at a time, so we kept the first ${MAX_ROWS}`);
    } else {
      setCapNote(null);
    }
    setRows(merged.slice(0, MAX_ROWS));
    setPasteText('');
    setPasteOpen(false);
    setOkLine(null);
  }

  const run = useCallback(async (list: { name: string; email: string }[]) => {
    if (busyRef.current || list.length === 0) return;
    busyRef.current = true;
    setBusy(true);
    setTopError(null);
    setNeedSpots(false);
    setOkLine(null);
    try {
      const client = await authedClient();
      const { data: answerData, error } = await client.rpc('leader_import_delegates', {
        p_society: societyId,
        p_rows: list,
      });
      if (error) throw error;
      if (!aliveRef.current) return;
      const a = (answerData ?? {}) as ImportAnswer;

      if (a.ok === true) {
        const n = asInt(a.imported, list.length);
        setOkLine(n === 1
          ? '1 delegate imported. We emailed them an invite'
          : `${n} delegates imported. We emailed each of them an invite`);
        setRows([newRow()]);
        setServerErrors({});
        setShowClientErrors(false);
        setCapNote(null);
        refreshCreditsEverywhere();
        void triggerEmailDelivery(client);
        void reload();
        onImported?.();
        return;
      }

      if (Array.isArray(a.invalid) && a.invalid.length > 0) {
        // Match each reason to its row by lowercased email; a duplicate marks
        // the later occurrence, never the first.
        const errs: Record<number, string> = {};
        {
          const current = rowsRef.current;
          const byEmail = new Map<string, Row[]>();
          for (const r of current) {
            if (!r.name.trim() && !r.email.trim()) continue;
            const e = norm(r.email);
            byEmail.set(e, [...(byEmail.get(e) ?? []), r]);
          }
          for (const inv of a.invalid ?? []) {
            const matches = byEmail.get(norm(inv.email ?? '')) ?? [];
            let sentence: string;
            switch (inv.reason) {
              case 'name': sentence = "Add this delegate's name"; break;
              case 'duplicate': sentence = 'This email is already on your list'; break;
              case 'self': sentence = 'That is your own email'; break;
              case 'already_applied':
                sentence = `${firstName(inv.name ?? matches[0]?.name)} has already applied to ${conferenceAcronym}`;
                break;
              default: sentence = 'Check this email address';
            }
            const targets = inv.reason === 'duplicate' ? matches.slice(1) : matches.slice(0, 1);
            for (const t of targets) if (!errs[t.key]) errs[t.key] = sentence;
          }
        }
        setServerErrors(errs);
        const n = a.invalid.length;
        setTopError(messageOr(a, `${n} ${n === 1 ? 'row needs' : 'rows need'} fixing before you import`));
        return;
      }

      if (typeof a.need_spots === 'number' && a.need_spots > 0) {
        setNeedSpots(true);
        setTopError(messageOr(a, 'You need more pledged spots for these delegates'));
        return;
      }

      if (typeof a.need_credits === 'number' && a.need_credits > 0) {
        setTopError(messageOr(a, "It seems you don't have enough credits for this"));
        retryRowsRef.current = list;
        openCreditsPopup({
          context: 'pay',
          preselect: a.need_credits,
          purpose: 'import',
          onComplete: () => {
            const again = retryRowsRef.current;
            retryRowsRef.current = null;
            if (again === null || !aliveRef.current) return;
            void runRef.current?.(again);
          },
        });
        return;
      }

      setTopError(messageOr(a, 'Your delegates could not be imported. Try again in a moment.'));
    } catch (e) {
      if (!aliveRef.current) return;
      setTopError(friendlyError(e, 'Your delegates could not be imported. Try again in a moment.'));
    } finally {
      busyRef.current = false;
      if (aliveRef.current) setBusy(false);
    }
  }, [societyId, conferenceAcronym, reload, onImported]);
  runRef.current = run;

  function submit() {
    if (busyRef.current || count === 0) return;
    setShowClientErrors(true);
    setServerErrors({});
    if (Object.keys(clientErrors).length > 0) {
      const n = Object.keys(clientErrors).length;
      setTopError(`${n} ${n === 1 ? 'row needs' : 'rows need'} fixing before you import`);
      setNeedSpots(false);
      return;
    }
    void run(filled.map(r => ({ name: r.name.trim(), email: r.email.trim() })));
  }

  const inputStyle = (hasError: boolean): React.CSSProperties => ({
    height: 46,
    width: '100%',
    padding: '0 12px',
    fontFamily: OUTFIT,
    fontSize: 16,
    color: INK,
    backgroundColor: '#FFFFFF',
    border: `1px solid ${hasError ? DANGER : LINE}`,
    borderRadius: 12,
  });

  const Stat = ({ n, label }: { n: number; label: string }) => (
    <div>
      <p style={{ fontFamily: OUTFIT, fontSize: 26, fontWeight: 900, color: FOREST, margin: 0, lineHeight: 1.05, fontVariantNumeric: 'tabular-nums' }}>{n}</p>
      <p style={{ fontFamily: OUTFIT, fontSize: 12, color: INK_SOFT, margin: '2px 0 0 0' }}>{label}</p>
    </div>
  );

  return (
    <SectionCard>
      <h3 style={{ fontFamily: OUTFIT, fontSize: 24, fontWeight: 800, color: INK, margin: 0, lineHeight: 1.15 }}>
        Import Your <GoldWord tone="light">Delegates</GoldWord>
      </h3>
      <p style={{ fontFamily: OUTFIT, fontSize: 13, color: INK_SOFT, margin: '6px 0 0 0', lineHeight: 1.55 }}>
        Add a name and an email for each delegate and we&rsquo;ll invite them to join your delegation
      </p>

      <div className="flex flex-wrap gap-x-7 gap-y-3 mt-5">
        <Stat n={data.free_spots} label={data.free_spots === 1 ? 'pledged spot free' : 'pledged spots free'} />
        <Stat n={data.pledged} label={data.pledged === 1 ? 'spot pledged' : 'spots pledged'} />
        <Stat n={data.balance} label={data.balance === 1 ? 'credit of yours' : 'credits of yours'} />
      </div>

      {/* The list */}
      <div className="mt-6 flex items-center justify-between gap-3">
        <p style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 700, color: INK, margin: 0 }}>Your delegates</p>
        <button
          type="button"
          onClick={() => setPasteOpen(v => !v)}
          aria-expanded={pasteOpen}
          className={`inline-flex items-center gap-1.5 rounded-lg px-2 ${FOCUS}`}
          style={{ height: 36, fontFamily: OUTFIT, fontSize: 13, fontWeight: 700, color: FOREST, textDecoration: 'underline', textUnderlineOffset: 3, background: 'none', border: 'none', cursor: 'pointer' }}
        >
          <ClipboardPaste size={15} aria-hidden />
          {pasteOpen ? 'Type them instead' : 'Paste a list'}
        </button>
      </div>

      {pasteOpen && (
        <div className="mt-3">
          <label htmlFor="gv-import-paste" style={{ fontFamily: OUTFIT, fontSize: 12, color: INK_SOFT }}>
            One delegate per line, a name and an email split by a comma, tab or semicolon
          </label>
          <textarea
            id="gv-import-paste"
            value={pasteText}
            onChange={e => setPasteText(e.target.value)}
            rows={6}
            placeholder={'Ana Pérez, ana@school.edu\nkai@school.edu; Kai Tanaka'}
            className={`mt-1.5 rounded-xl ${FOCUS}`}
            style={{ width: '100%', padding: 12, fontFamily: OUTFIT, fontSize: 16, color: INK, backgroundColor: '#FFFFFF', border: `1px solid ${LINE}`, resize: 'vertical' }}
          />
          <button
            type="button"
            onClick={fillFromPaste}
            disabled={!pasteText.trim()}
            className={`mt-2 rounded-xl px-4 font-bold text-sm ${FOCUS}`}
            style={{ height: 44, backgroundColor: '#FFFFFF', border: `1.5px solid ${INK}`, color: INK, fontFamily: OUTFIT, letterSpacing: '0.06em', cursor: pasteText.trim() ? 'pointer' : 'not-allowed', opacity: pasteText.trim() ? 1 : 0.5 }}
          >
            FILL THE ROWS
          </button>
        </div>
      )}

      <ol className="mt-3 flex flex-col gap-3" style={{ listStyle: 'none', padding: 0, margin: '12px 0 0 0' }}>
        {rows.map((r, i) => {
          const err = rowError(r.key);
          const errId = `gv-import-err-${r.key}`;
          return (
            <li key={r.key}>
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0 grid gap-2 sm:grid-cols-2">
                  <input
                    type="text"
                    value={r.name}
                    onChange={e => edit(r.key, 'name', e.target.value)}
                    placeholder="Name"
                    aria-label={`Delegate ${i + 1} name`}
                    aria-invalid={!!err}
                    aria-describedby={err ? errId : undefined}
                    autoComplete="off"
                    className={FOCUS}
                    style={inputStyle(!!err)}
                  />
                  <input
                    type="email"
                    inputMode="email"
                    value={r.email}
                    onChange={e => edit(r.key, 'email', e.target.value)}
                    placeholder="Email"
                    aria-label={`Delegate ${i + 1} email`}
                    aria-invalid={!!err}
                    aria-describedby={err ? errId : undefined}
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    className={FOCUS}
                    style={inputStyle(!!err)}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeRow(r.key)}
                  aria-label={`Remove delegate ${i + 1}`}
                  title="Remove this row"
                  className={`flex items-center justify-center flex-shrink-0 rounded-xl ${FOCUS}`}
                  style={{ width: 44, height: 46, backgroundColor: 'transparent', border: 'none', color: INK_SOFT, cursor: 'pointer' }}
                >
                  <X size={18} aria-hidden />
                </button>
              </div>
              {err && (
                <p id={errId} style={{ fontFamily: OUTFIT, fontSize: 12.5, color: DANGER, margin: '6px 0 0 2px', lineHeight: 1.45 }}>
                  {err}
                </p>
              )}
            </li>
          );
        })}
      </ol>

      <button
        type="button"
        onClick={addRow}
        className={`mt-3 inline-flex items-center gap-1.5 rounded-xl px-3 font-bold text-sm ${FOCUS}`}
        style={{ height: 40, backgroundColor: '#EDE7D8', border: 'none', color: FOREST, fontFamily: OUTFIT, letterSpacing: '0.06em', cursor: 'pointer' }}
      >
        <Plus size={16} strokeWidth={2.4} aria-hidden />
        ADD ROW
      </button>
      {capNote && (
        <p role="status" style={{ fontFamily: OUTFIT, fontSize: 12.5, color: INK_SOFT, margin: '8px 0 0 0' }}>{capNote}</p>
      )}

      {/* Import */}
      <div className="mt-5 pt-5 flex flex-wrap items-center gap-x-4 gap-y-2" style={{ borderTop: `1px solid ${LINE}` }}>
        <button
          type="button"
          onClick={submit}
          disabled={busy || count === 0}
          aria-busy={busy}
          className={`flex items-center justify-center rounded-xl px-5 font-bold text-sm transition-colors ${FOCUS}`}
          style={{
            minWidth: 220, height: 48,
            backgroundColor: busy ? '#2A5A3C' : FOREST,
            color: '#EED98A',
            fontFamily: OUTFIT, letterSpacing: '0.06em', border: 'none',
            cursor: busy ? 'wait' : count === 0 ? 'not-allowed' : 'pointer',
            opacity: count === 0 ? 0.5 : busy ? 0.85 : 1,
          }}
        >
          {busy ? 'IMPORTING' : count === 1 ? 'IMPORT 1 DELEGATE' : `IMPORT ${count} DELEGATES`}
        </button>
        {count > 0 && (
          <p style={{ fontFamily: OUTFIT, fontSize: 13, color: INK_SOFT, margin: 0 }}>
            Uses {count} of your {data.balance} {data.balance === 1 ? 'credit' : 'credits'}
          </p>
        )}
      </div>

      {topError && (
        <div className="mt-3">
          <p role="alert" style={{ fontFamily: OUTFIT, fontSize: 13, color: DANGER, margin: 0, lineHeight: 1.5 }}>{topError}</p>
          {needSpots && (
            <button
              type="button"
              onClick={onPledgeMore}
              className={`mt-3 rounded-xl px-4 font-bold text-sm ${FOCUS}`}
              style={{ height: 44, backgroundColor: '#FFFFFF', border: `1.5px solid ${INK}`, color: INK, fontFamily: OUTFIT, letterSpacing: '0.06em', cursor: 'pointer' }}
            >
              PLEDGE MORE SPOTS
            </button>
          )}
        </div>
      )}
      {okLine && (
        <p role="status" style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 600, color: '#2A5A3C', margin: '12px 0 0 0' }}>{okLine}</p>
      )}

      {/* Everyone imported so far */}
      {data.imports.length > 0 && (
        <div className="mt-6 pt-5" style={{ borderTop: `1px solid ${LINE}` }}>
          <p style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 700, color: INK, margin: 0 }}>Your imported delegates</p>
          <ul className="mt-3 flex flex-col gap-2" style={{ listStyle: 'none', padding: 0, margin: '12px 0 0 0' }}>
            {data.imports.map(d => {
              const s = statusOf(d);
              return (
                <li
                  key={d.application_id}
                  className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1.5 rounded-xl"
                  style={{ padding: '12px 14px', backgroundColor: '#FFFFFF', boxShadow: '0 1px 3px rgba(27,56,40,0.06)' }}
                >
                  <div className="min-w-0 flex-1" style={{ minWidth: 180 }}>
                    <p style={{ fontFamily: OUTFIT, fontSize: 15.5, fontWeight: 700, color: INK, margin: 0, overflowWrap: 'anywhere', lineHeight: 1.3 }}>
                      {d.name?.trim() || d.email || 'Imported delegate'}
                    </p>
                    {d.email && (
                      <p style={{ fontFamily: OUTFIT, fontSize: 12, color: INK_SOFT, margin: '2px 0 0 0', overflowWrap: 'anywhere' }}>{d.email}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-start sm:items-end">
                    <span className="inline-flex items-center gap-1.5" style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 700, color: s.color }}>
                      <s.Icon size={16} strokeWidth={2.2} aria-hidden />
                      {s.label}
                    </span>
                    {d.credit === 'refunded' && (
                      <span className="inline-flex items-center gap-1 mt-1" style={{ fontFamily: OUTFIT, fontSize: 12, color: INK_SOFT }}>
                        <RotateCcw size={12} aria-hidden />
                        Credit returned to you
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </SectionCard>
  );
}

