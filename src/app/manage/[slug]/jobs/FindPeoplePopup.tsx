'use client';

// ── Find people: search opted-in chairs and secretariat, invite one ────────
//
// One pop-up (the Store shell), two steps that replace each other:
//   Search   talent_search with a debounced text field, the Chair /
//            Secretariat pills, a country and a level; results as cards,
//            "Show more" pages by 24.
//   Invite   one person: which live Gavelling listing, an optional note,
//            the price (talent_search's `price`), "Send invite".
// Back from Invite keeps the search and its scroll position. Short on
// credits hands the SAME call (p_top_up true) to the page, which closes
// this pop-up before the credits pop-up opens (never a pop-up on a pop-up).

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Ban, CheckCircle2, Clock, Search, Send, XCircle } from 'lucide-react';
import { PurchaseShell, PURCHASE_CSS } from '@/components/purchase/purchaseKit';
import GSelect from '@/components/GSelect';
import { CountryField } from '@/components/CountryField';
import { CircleFlag } from '@/components/CircleFlag';
import VerifiedCheck from '@/components/VerifiedCheck';
import { getCountryByName } from '@/lib/countries';
import { notifyOk } from '@/lib/appNotify';
import { POSTING_CSS } from './PostingPopup';
import { PersonAvatar } from './SentInvitesCard';
import {
  sendInvite, talentSearch,
  type JobPanel, type Refusal, type TalentPage, type TalentPerson,
} from './jobsApi';

const FONT = "var(--font-brand), sans-serif";
const INK = '#1C1410';
const INK_SOFT = '#5C5140';
const FOREST = '#1B3828';
const DANGER = '#9E2A12';
const PAGE = 24;
const NOTE_MAX = 500;

type Role = 'chair' | 'secretariat';

/** profiles.mun_experience_level, labelled as in sign-up (auth/onboarding). */
const LEVELS = [
  { value: '', label: 'Any level' },
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
  { value: 'expert', label: 'Expert' },
] as const;
const LEVEL_LABEL: Record<string, string> = Object.fromEntries(LEVELS.filter((l) => l.value).map((l) => [l.value, l.label]));

function times(n: number): string {
  if (n === 1) return 'once';
  if (n === 2) return 'twice';
  return `${n.toLocaleString('en-US')} times`;
}

function experienceLine(p: TalentPerson): string {
  const parts: string[] = [];
  if (p.chairs > 0) parts.push(`Chaired ${times(p.chairs)}`);
  if (p.secretariat > 0) parts.push(`Secretariat ${times(p.secretariat)}`);
  return parts.join(' · ');
}

function yearOf(date: string | null): string {
  if (!date) return '';
  const m = /^(\d{4})/.exec(date);
  return m ? m[1] : '';
}

const INVITE_STATE: Record<string, { label: string; icon: typeof Send; color: string }> = {
  sent: { label: 'Invited', icon: Send, color: FOREST },
  opened: { label: 'Invited', icon: Send, color: FOREST },
  applied: { label: 'Applied', icon: CheckCircle2, color: FOREST },
  not_interested: { label: 'Not interested', icon: XCircle, color: INK_SOFT },
  queued: { label: 'Waiting to be delivered', icon: Clock, color: INK_SOFT },
  cancelled: { label: 'Cancelled', icon: Ban, color: INK_SOFT },
};

export interface FindPeopleShort {
  need: number;
  retry: () => Promise<{ ok: true } | Refusal>;
  okMessage: (answer: Record<string, unknown>) => string;
}

interface Results extends TalentPage { key: string }

export default function FindPeoplePopup({ confId, panel, onClose, onShort, onSent }: {
  confId: string;
  slug: string;
  panel: JobPanel;
  onClose: () => void;
  onShort: (req: FindPeopleShort) => void;
  onSent: () => void;
}) {
  // ── Search state (kept while the Invite step is open) ──
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<Role | null>(null);
  const [countryText, setCountryText] = useState('');
  const [level, setLevel] = useState('');
  const [results, setResults] = useState<Results | null>(null);
  const [searchErr, setSearchErr] = useState<{ key: string; message: string } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [moreBusy, setMoreBusy] = useState(false);
  const moreRef = useRef(false);

  const country = useMemo(() => (countryText.trim() ? getCountryByName(countryText)?.name ?? null : null), [countryText]);
  const key = JSON.stringify([query, role, country, level, attempt]);

  useEffect(() => {
    const t = window.setTimeout(() => setQuery(text.trim()), 320);
    return () => window.clearTimeout(t);
  }, [text]);

  useEffect(() => {
    let cancelled = false;
    void talentSearch(confId, { query, role, country, level, limit: PAGE, offset: 0 }).then((r) => {
      if (cancelled) return;
      if (r.ok) { setResults({ ...r, key }); setSearchErr(null); } else setSearchErr({ key, message: r.message });
    });
    return () => { cancelled = true; };
  }, [confId, query, role, country, level, key]);

  const current = results && results.key === key ? results : null;
  const err = searchErr && searchErr.key === key ? searchErr.message : null;
  const loading = !current && !err;

  const showMore = async () => {
    if (moreRef.current || !current) return;
    moreRef.current = true;
    setMoreBusy(true);
    const forKey = current.key;
    try {
      const r = await talentSearch(confId, { query, role, country, level, limit: PAGE, offset: current.people.length });
      if (!r.ok) { setSearchErr({ key: forKey, message: r.message }); return; }
      setResults((prev) => {
        if (!prev || prev.key !== forKey) return prev;
        const seen = new Set(prev.people.map((p) => p.user_id));
        return { ...prev, ...r, key: forKey, people: [...prev.people, ...r.people.filter((p) => !seen.has(p.user_id))] };
      });
    } finally {
      moreRef.current = false;
      setMoreBusy(false);
    }
  };

  // ── Invite step ──
  const live = useMemo(() => panel.listings.filter((l) => l.shown === 'live' && l.kind === 'gavelling'), [panel]);
  const [person, setPerson] = useState<TalentPerson | null>(null);
  const [listingId, setListingId] = useState('');
  const [note, setNote] = useState('');
  const [inviteErr, setInviteErr] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef(0);
  const restoreRef = useRef(false);
  const scroller = () => rootRef.current?.closest('.gv-buy-body') as HTMLElement | null;

  const openInvite = (p: TalentPerson) => {
    scrollRef.current = scroller()?.scrollTop ?? 0;
    setPerson(p);
    setListingId(live.length === 1 ? live[0].id : '');
    setNote('');
    setInviteErr('');
  };
  const backToSearch = () => {
    restoreRef.current = true;
    setPerson(null);
    setInviteErr('');
  };

  useLayoutEffect(() => {
    const el = scroller();
    if (!el) return;
    if (person) { el.scrollTop = 0; return; }
    if (restoreRef.current) {
      restoreRef.current = false;
      el.scrollTop = scrollRef.current;
    }
  }, [person]);

  const price = current?.price ?? results?.price ?? 0;
  const canPay = current?.can_pay ?? results?.can_pay ?? true;

  const send = async () => {
    if (busyRef.current || !person) return;
    if (!listingId) { setInviteErr('Pick the listing to invite them to'); return; }
    if (note.trim().length > NOTE_MAX) { setInviteErr('Keep the note under 500 characters'); return; }
    busyRef.current = true;
    setBusy(true);
    setInviteErr('');
    const chosen = listingId;
    const user = person.user_id;
    const message = note.trim() || null;
    try {
      const r = await sendInvite(chosen, user, message, false);
      if (r.ok) {
        const patch = { id: r.id, status: r.status, listing_id: chosen };
        setResults((prev) => (prev ? { ...prev, people: prev.people.map((p) => (p.user_id === user ? { ...p, invite: patch } : p)) } : prev));
        notifyOk((typeof r.message === 'string' && r.message) || 'Invite sent', 'jobs');
        onSent();
        backToSearch();
        return;
      }
      if (r.code === 'short' || (r.need_credits ?? 0) > 0) {
        onShort({
          need: Math.max(1, r.need_credits ?? 1),
          retry: () => sendInvite(chosen, user, message, true),
          okMessage: (a) => (typeof a.message === 'string' && a.message) || 'Invite sent',
        });
        return;
      }
      setInviteErr(r.message);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return (
    <PurchaseShell tone="light" label="Find people" onClose={onClose} panelClass="gv-st-pop gv-jp gv-fp" testId="job-find-people">
      <style>{PURCHASE_CSS}{POSTING_CSS}{FIND_CSS}</style>
      <div className="gv-jp-col" ref={rootRef}>
        {person ? (
          <>
            <header className="gv-jp-head">
              <div className="gv-jp-headrow">
                <button type="button" className="gv-jp-back" onClick={backToSearch} disabled={busy} aria-label="Back">
                  <ArrowLeft size={18} strokeWidth={2.4} aria-hidden />
                </button>
              </div>
              <h2 className="gv-jp-title">Send an Invite</h2>
            </header>

            <div className="gv-fp-who">
              <PersonAvatar name={person.name} url={person.avatar_url} size={56} />
              <div style={{ minWidth: 0 }}>
                <p className="gv-fp-name gv-fp-name-big">{person.name || 'A Gavelling member'}</p>
                {experienceLine(person) && <p className="gv-fp-line">{experienceLine(person)}</p>}
              </div>
            </div>

            <div className="gv-jp-field">
              <span className="gv-jp-label">Listing</span>
              <GSelect
                value={listingId}
                onChange={(v) => { setListingId(v); setInviteErr(''); }}
                options={live.map((l) => ({ value: l.id, label: l.title, hint: l.committee ?? undefined }))}
                placeholder="Pick a listing"
                aria-label="Listing"
                disabled={busy}
              />
            </div>

            <label className="gv-jp-field">
              <span className="gv-jp-label">Note (optional)</span>
              <textarea
                className="gv-jp-input gv-fp-note"
                value={note}
                maxLength={NOTE_MAX}
                onChange={(e) => { setNote(e.target.value); setInviteErr(''); }}
                placeholder="Why you think they'd be great"
                disabled={busy}
              />
              <span className="gv-jp-hint">{note.length}/{NOTE_MAX}</span>
            </label>

            <p className="gv-jp-line">Costs {price} {price === 1 ? 'credit' : 'credits'} from your conference credits</p>
            {inviteErr && <p className="gv-jp-err gv-jp-err-block" role="alert">{inviteErr}</p>}
            <div className="gv-jp-actions">
              <button type="button" className="gv-jp-main" onClick={() => { void send(); }} disabled={busy || !canPay} aria-busy={busy || undefined}>
                <Send size={16} strokeWidth={2.4} aria-hidden /> {busy ? 'Sending…' : 'Send invite'}
              </button>
            </div>
          </>
        ) : (
          <>
            <header className="gv-jp-head">
              <h2 className="gv-jp-title" style={{ marginTop: 0 }}>Find People</h2>
            </header>

            <div className="gv-fp-filters">
              <label className="gv-fp-search">
                <Search size={17} strokeWidth={2.4} aria-hidden className="gv-fp-search-icon" />
                <input
                  className="gv-jp-input gv-fp-search-input"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Search by name, conference or committee"
                  aria-label="Search by name, conference or committee"
                />
              </label>
              <div className="gv-fp-row">
                <div className="gv-jp-offers" role="group" aria-label="Experience">
                  {(['chair', 'secretariat'] as Role[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      aria-pressed={role === r}
                      className={`gv-jp-offer${role === r ? ' gv-jp-offer-on' : ''}`}
                      onClick={() => setRole((cur) => (cur === r ? null : r))}
                    >
                      {r === 'chair' ? 'Chair' : 'Secretariat'}
                    </button>
                  ))}
                </div>
                <div className="gv-fp-country">
                  <CountryField
                    value={countryText}
                    onChange={setCountryText}
                    placeholder="Any country"
                    ariaLabel="Country"
                    id="gv-fp-country"
                    circleFlag
                  />
                </div>
                <div className="gv-fp-level">
                  <GSelect value={level} onChange={setLevel} options={LEVELS} aria-label="Level" />
                </div>
              </div>
            </div>

            <p className="gv-jp-line gv-jp-soft">Only people open to team roles appear here. Each person gets at most 3 invites a week from all conferences.</p>
            {!canPay && <p className="gv-jp-line gv-jp-soft">Inviting uses conference credits, which needs the Store permission</p>}

            {err ? (
              <p className="gv-jp-err gv-jp-err-block" role="alert">
                {err} <button type="button" className="gv-jp-a" onClick={() => setAttempt((n) => n + 1)}>Try again</button>
              </p>
            ) : loading ? (
              <div className="gv-fp-grid" aria-busy="true" aria-label="Searching">
                {[0, 1, 2, 3].map((i) => <span key={i} className="gv-fp-skel" />)}
              </div>
            ) : current && current.people.length === 0 ? (
              <p className="gv-fp-empty">Nobody matches yet. Only people who chose to be open to team roles appear here.</p>
            ) : current ? (
              <>
                <ul className="gv-fp-grid">
                  {current.people.map((p) => (
                    <PersonCard key={p.user_id} person={p} canPay={current.can_pay} onInvite={() => openInvite(p)} />
                  ))}
                </ul>
                {current.people.length < current.total && (
                  <div className="gv-fp-more">
                    <button type="button" className="gv-jp-second" onClick={() => { void showMore(); }} disabled={moreBusy} aria-busy={moreBusy || undefined}>
                      {moreBusy ? 'Loading…' : 'Show more'}
                    </button>
                  </div>
                )}
              </>
            ) : null}
          </>
        )}
      </div>
    </PurchaseShell>
  );
}

function PersonCard({ person: p, canPay, onInvite }: { person: TalentPerson; canPay: boolean; onInvite: () => void }) {
  const state = p.invite ? (INVITE_STATE[String(p.invite.status)] ?? INVITE_STATE.sent) : null;
  const line = experienceLine(p);
  const levelLabel = p.level ? (LEVEL_LABEL[p.level] ?? p.level.charAt(0).toUpperCase() + p.level.slice(1)) : null;
  return (
    <li className="gv-fp-card">
      <div className="gv-fp-top">
        <PersonAvatar name={p.name} url={p.avatar_url} size={48} />
        <div className="gv-fp-id">
          <p className="gv-fp-name">{p.name || 'A Gavelling member'}</p>
          {(p.nationality || levelLabel) && (
            <p className="gv-fp-meta">
              {p.nationality && <CircleFlag country={p.nationality} size={16} decorative />}
              {p.nationality && <span>{p.nationality}</span>}
              {p.nationality && levelLabel && <span aria-hidden>·</span>}
              {levelLabel && <span>{levelLabel}</span>}
            </p>
          )}
        </div>
      </div>

      {line && <p className="gv-fp-line">{line}</p>}
      {p.verified > 0 && (
        <p className="gv-fp-verified">
          <VerifiedCheck verified size={15} /> {p.verified.toLocaleString('en-US')} verified by conferences
        </p>
      )}

      {p.recent.length > 0 && (
        <ul className="gv-fp-recent">
          {p.recent.slice(0, 4).map((e, i) => {
            const what = e.committee || e.title;
            const year = yearOf(e.date);
            return (
              <li key={i}>
                <span className="gv-fp-conf">
                  {e.conference || (e.type === 'chair' ? 'Chair' : 'Secretariat')}
                  {e.verified && <VerifiedCheck verified size={13} style={{ marginLeft: 5, verticalAlign: '-2px' }} />}
                </span>
                {(what || year) && <span className="gv-fp-sub">{[what, year].filter(Boolean).join(' · ')}</span>}
              </li>
            );
          })}
        </ul>
      )}

      <div className="gv-fp-act">
        {state ? (
          <span className="gv-fp-state" style={{ color: state.color }}>
            <state.icon size={15} strokeWidth={2.4} aria-hidden /> {state.label}
          </span>
        ) : (
          <button type="button" className="gv-jp-main gv-fp-invite" onClick={onInvite} disabled={!canPay}>
            <Send size={15} strokeWidth={2.4} aria-hidden /> Invite
          </button>
        )}
      </div>
    </li>
  );
}

const FIND_CSS = `
.gv-buy-panel.gv-jp.gv-fp{max-width:960px}
.gv-fp-filters{display:flex;flex-direction:column;gap:12px}
.gv-fp-search{position:relative;display:block}
.gv-fp-search-icon{position:absolute;left:14px;top:50%;transform:translateY(-50%);color:${INK_SOFT};pointer-events:none}
.gv-jp-input.gv-fp-search-input{padding-left:42px}
.gv-fp-row{display:flex;flex-wrap:wrap;align-items:center;gap:10px 12px}
.gv-fp-country{flex:1 1 220px;min-width:0}
.gv-fp-level{flex:0 1 200px;min-width:160px}
.gv-fp-grid{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:minmax(0,1fr);gap:14px}
@media (min-width:760px){.gv-fp-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
.gv-fp-skel{display:block;min-height:230px;border-radius:18px;background:rgba(28,20,16,0.08);animation:gvFpPulse 1.2s ease-in-out infinite}
@keyframes gvFpPulse{0%,100%{opacity:1}50%{opacity:0.55}}
@media (prefers-reduced-motion:reduce){.gv-fp-skel{animation:none}}
.gv-fp-card{display:flex;flex-direction:column;gap:10px;padding:16px;border-radius:18px;background:#FFFFFF;box-shadow:0 1px 2px rgba(27,56,40,0.05),0 4px 14px rgba(27,56,40,0.07);font-family:${FONT};min-width:0}
.gv-fp-top{display:flex;align-items:center;gap:12px}
.gv-fp-id{min-width:0}
.gv-fp-name{margin:0;font-size:16px;font-weight:800;line-height:1.3;color:${INK};overflow-wrap:anywhere}
.gv-fp-name-big{font-size:19px}
.gv-fp-meta{margin:3px 0 0;display:flex;flex-wrap:wrap;align-items:center;gap:6px;font-size:13px;color:${INK_SOFT}}
.gv-fp-line{margin:0;font-size:14px;font-weight:600;color:${INK}}
.gv-fp-verified{margin:0;display:inline-flex;align-items:center;gap:6px;font-size:13.5px;font-weight:600;color:${INK}}
.gv-fp-recent{list-style:none;margin:0;padding:10px 0 0;border-top:1px solid rgba(28,20,16,0.08);display:flex;flex-direction:column;gap:8px}
.gv-fp-recent li{display:flex;flex-direction:column;min-width:0}
.gv-fp-conf{font-size:13.5px;font-weight:700;color:${INK};overflow-wrap:anywhere}
.gv-fp-sub{font-size:12.5px;color:${INK_SOFT};overflow-wrap:anywhere}
.gv-fp-act{margin-top:auto;padding-top:4px;display:flex;justify-content:flex-end}
.gv-jp-main.gv-fp-invite{min-height:42px;padding:0 18px;font-size:14.5px}
.gv-fp-state{display:inline-flex;align-items:center;gap:6px;min-height:42px;font-size:14px;font-weight:700}
.gv-fp-empty{margin:8px 0;padding:22px 18px;border-radius:16px;background:#FFFFFF;font-family:${FONT};font-size:15px;line-height:1.5;color:${INK_SOFT}}
.gv-fp-more{display:flex;justify-content:center}
.gv-fp-who{display:flex;align-items:center;gap:14px}
.gv-fp-note{min-height:120px;line-height:1.5;resize:vertical}
.gv-fp :is(textarea):focus-visible{outline:2px solid ${FOREST};outline-offset:2px}
.gv-fp .gv-jp-err{color:${DANGER}}
`;
