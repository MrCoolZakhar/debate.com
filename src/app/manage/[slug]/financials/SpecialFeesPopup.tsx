'use client';

// ── Special fees (GMC, owner 9 Nov 2026) ───────────────────────────────────
//
// A different registration fee for chosen people, with no shareable code:
// picked people, whole delegations, or everyone who gave one answer on the
// role's form. Never shown anywhere public: only the person's invoice on /pay
// changes. The rules are live in the database (special_fees_list,
// special_fee_preview, special_fee_save, special_fee_remove): someone who
// matches later gets the fee by themselves; only unpaid, unlocked invoices
// are re-priced; several matching fees, the lowest wins.
//
// ONE pop-up. The list, then three steps (role, fee, who) that replace its
// content with a back button; Remove asks in place (CLAUDE.md).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, Search, X } from 'lucide-react';
import type { Conference } from '@/app/manage/[slug]/layout';
import { PurchaseShell, PURCHASE_CSS } from '@/components/purchase/purchaseKit';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { friendlyError, plainOrFallback } from '@/lib/friendlyError';
import { notifyOk } from '@/lib/appNotify';
import { isChoiceType, normalizeBlocks, questionsOf, usableOptions } from '@/lib/customQuestions';
import { STORE_CSS } from '../store/storeKit';
import { DASH_CSS, READ_ONLY_LINE } from './dashboardKit';
import { formatMoney, ROLE_ORDER_FULL, roleLabelFull } from './shared';

const FONT = 'var(--font-brand), sans-serif';
const INK = '#1C1410';
const INK_SOFT = '#5C5140';
const DANGER = '#8B2020';
const LINE = '#E6DFCF';

export type SpecialTarget =
  | { kind: 'application'; application_id: string; label?: string }
  | { kind: 'society'; society_id: string; label?: string }
  | { kind: 'answer'; question_id: string; answer: string; label?: string }
  // MUN level (applications.experience_level) and a committee preference (any rank), 9 Nov 2026.
  | { kind: 'level'; answer: string; label?: string }
  | { kind: 'committee'; answer: string; label?: string };

/** special_fee_answer_groups: only groups with at least one live person in the role. */
interface AnswerGroups {
  levels: { answer: string; count: number }[];
  committees: { answer: string; name: string; full_name: string | null; count: number }[];
  answers: { question_id: string; answer: string; count: number }[];
}

export interface SpecialFee {
  id: string; role: string; name: string; amount: number; updated_at: string;
  targets: (SpecialTarget & { label?: string | null })[];
  reach: { matched: number; already_paid: number; locked: number };
}

interface Reach { matched: number; already_paid: number; locked: number }

export async function readSpecialFees(conferenceId: string): Promise<{ ok: true; currency: string; fees: SpecialFee[] } | { ok: false; error: string }> {
  const fallback = 'Special fees could not be read. Try again in a moment.';
  try {
    const c = await getFreshAuthedClient();
    if (!c) return { ok: false, error: fallback };
    const { data, error } = await c.rpc('special_fees_list', { p_conference_id: conferenceId });
    if (error) return { ok: false, error: friendlyError(error, fallback) };
    const d = (data ?? {}) as { ok?: boolean; currency?: string; fees?: SpecialFee[]; error?: string };
    if (d.ok !== true) return { ok: false, error: plainOrFallback(d.error, fallback) };
    return { ok: true, currency: d.currency ?? 'USD', fees: d.fees ?? [] };
  } catch (e) {
    return { ok: false, error: friendlyError(e, fallback) };
  }
}

const targetKey = (t: SpecialTarget) => t.kind === 'application' ? `a:${t.application_id}`
  : t.kind === 'society' ? `s:${t.society_id}`
  : t.kind === 'level' ? `l:${t.answer}`
  : t.kind === 'committee' ? `c:${t.answer}`
  : `q:${t.question_id}:${t.answer}`;
const stripLabel = (t: SpecialTarget): SpecialTarget => t.kind === 'application'
  ? { kind: 'application', application_id: t.application_id }
  : t.kind === 'society' ? { kind: 'society', society_id: t.society_id }
  : t.kind === 'level' ? { kind: 'level', answer: t.answer }
  : t.kind === 'committee' ? { kind: 'committee', answer: t.answer }
  : { kind: 'answer', question_id: t.question_id, answer: t.answer };
const LEVEL_WORD: Record<string, string> = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced', expert: 'Expert' };

type Step = 'list' | 'role' | 'fee' | 'who';
interface Draft { id: string | null; role: string; name: string; amount: string; targets: SpecialTarget[] }
interface RoleRow { role: string; is_enabled: boolean; fee_amount: number | null; fee_currency: string | null; custom_questions: unknown }
interface Person { id: string; name: string; email: string }
interface Society { id: string; name: string }

const inputStyle: React.CSSProperties = {
  width: '100%', borderRadius: 12, padding: '10px 14px', fontSize: 16, fontFamily: FONT, color: INK,
  border: '1.5px solid #CFC5B1', background: '#FFFFFF', outline: 'none',
};
const labelStyle: React.CSSProperties = { display: 'block', fontFamily: FONT, fontSize: 14, fontWeight: 700, color: INK, margin: '0 0 6px' };

export default function SpecialFeesPopup({ conference, readOnly, onClose }: {
  conference: Conference; readOnly: boolean; onClose: () => void;
}) {
  const [fees, setFees] = useState<SpecialFee[] | null>(null);
  const [currency, setCurrency] = useState<string>(conference.fee_currency ?? 'USD');
  const [loadErr, setLoadErr] = useState('');
  const [step, setStep] = useState<Step>('list');
  const [draft, setDraft] = useState<Draft>({ id: null, role: '', name: '', amount: '', targets: [] });
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [people, setPeople] = useState<Person[] | null>(null);
  const [societies, setSocieties] = useState<Society[] | null>(null);
  const [whoTab, setWhoTab] = useState<'people' | 'delegations' | 'answer'>('people');
  const [query, setQuery] = useState('');
  const [questionId, setQuestionId] = useState('');
  const [reach, setReach] = useState<Reach | null>(null);
  const [errs, setErrs] = useState<{ role?: string; name?: string; amount?: string; targets?: string; save?: string }>({});
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await readSpecialFees(conference.id);
    if (!r.ok) { setLoadErr(r.error); setFees([]); return; }
    setLoadErr('');
    setCurrency(r.currency);
    setFees(r.fees);
  }, [conference.id]);

  useEffect(() => {
    void load();
    void (async () => {
      const c = await getFreshAuthedClient();
      if (!c) return;
      const { data } = await c.from('application_role_configs')
        .select('role, is_enabled, fee_amount, fee_currency, custom_questions').eq('conference_id', conference.id);
      // Every role the conference has, in a fixed order (special_fee_save accepts any of them).
      const rank = (r: string) => { const i = ROLE_ORDER_FULL.indexOf(r); return i < 0 ? 99 : i; };
      setRoles(((data ?? []) as RoleRow[]).sort((a, b) => rank(a.role) - rank(b.role)));
    })();
  }, [load, conference.id]);

  // People of the chosen role and the delegations here, read once per role.
  useEffect(() => {
    if (step !== 'who' || !draft.role) return;
    let cancelled = false;
    setPeople(null);
    void (async () => {
      const c = await getFreshAuthedClient();
      if (!c || cancelled) return;
      const [{ data: apps }, { data: soc }] = await Promise.all([
        c.from('applications').select('id, invited_name, invited_email, profiles (display_name, email)')
          .eq('conference_id', conference.id).eq('role', draft.role).not('status', 'in', '(withdrawn,rejected)').limit(5000),
        c.from('applications').select('society_id, societies (name)')
          .eq('conference_id', conference.id).not('society_id', 'is', null).limit(5000),
      ]);
      if (cancelled) return;
      type AppRow = { id: string; invited_name: string | null; invited_email: string | null; profiles: { display_name: string | null; email: string | null } | { display_name: string | null; email: string | null }[] | null };
      setPeople(((apps ?? []) as AppRow[]).map(a => {
        const p = Array.isArray(a.profiles) ? a.profiles[0] : a.profiles;
        return { id: a.id, name: p?.display_name || a.invited_name || 'Unnamed applicant', email: p?.email || a.invited_email || '' };
      }).sort((x, y) => x.name.localeCompare(y.name)));
      type SocRow = { society_id: string; societies: { name: string | null } | { name: string | null }[] | null };
      const seen = new Map<string, string>();
      for (const s of (soc ?? []) as SocRow[]) {
        const n = Array.isArray(s.societies) ? s.societies[0]?.name : s.societies?.name;
        if (!seen.has(s.society_id)) seen.set(s.society_id, n || 'Unnamed delegation');
      }
      setSocieties([...seen].map(([id, name]) => ({ id, name })).sort((x, y) => x.name.localeCompare(y.name)));
    })();
    return () => { cancelled = true; };
  }, [step, draft.role, conference.id]);

  // The Application answer tab: the answer groups of this role, read once when the who step opens for it.
  const [groups, setGroups] = useState<AnswerGroups | null>(null);
  useEffect(() => {
    if (step !== 'who' || !draft.role) return;
    let cancelled = false;
    setGroups(null);
    void (async () => {
      const c = await getFreshAuthedClient();
      if (!c || cancelled) return;
      const { data, error } = await c.rpc('special_fee_answer_groups', { p_conference_id: conference.id, p_role: draft.role });
      if (cancelled) return;
      const d = (data ?? {}) as { ok?: boolean } & Partial<AnswerGroups>;
      setGroups(error || d.ok !== true ? { levels: [], committees: [], answers: [] } : { levels: d.levels ?? [], committees: d.committees ?? [], answers: d.answers ?? [] });
    })();
    return () => { cancelled = true; };
  }, [step, draft.role, conference.id]);
  // The role's questions, live AND archived, to label answers (never file uploads).
  const roleQuestions = useMemo(() => {
    const rc = roles.find(r => r.role === draft.role);
    return questionsOf(normalizeBlocks(rc?.custom_questions ?? []), { includeArchived: true }).filter(q => q.type !== 'file_upload');
  }, [roles, draft.role]);

  // Live reach of the targets, debounced.
  const targetsKey = draft.targets.map(targetKey).join('|');
  useEffect(() => {
    if (step !== 'who' || !draft.role || draft.targets.length === 0) { setReach(null); return; }
    let cancelled = false;
    const t = window.setTimeout(() => {
      void (async () => {
        const c = await getFreshAuthedClient();
        if (!c || cancelled) return;
        const { data, error } = await c.rpc('special_fee_preview', {
          p_conference_id: conference.id, p_role: draft.role, p_targets: draft.targets.map(stripLabel),
        });
        if (cancelled || error) return;
        const d = (data ?? {}) as { ok?: boolean } & Partial<Reach>;
        if (d.ok) setReach({ matched: d.matched ?? 0, already_paid: d.already_paid ?? 0, locked: d.locked ?? 0 });
      })();
    }, 400);
    return () => { cancelled = true; window.clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, draft.role, targetsKey, conference.id]);

  const toggleTarget = (t: SpecialTarget) => setDraft(d => (d.targets.some(x => targetKey(x) === targetKey(t))
    ? { ...d, targets: d.targets.filter(x => targetKey(x) !== targetKey(t)) }
    : { ...d, targets: [...d.targets, t] }));
  const hasTarget = (t: SpecialTarget) => draft.targets.some(x => targetKey(x) === targetKey(t));

  const startNew = () => { setDraft({ id: null, role: '', name: '', amount: '', targets: [] }); setErrs({}); setStep('role'); };
  const startEdit = (f: SpecialFee) => {
    setDraft({ id: f.id, role: f.role, name: f.name, amount: String(f.amount), targets: f.targets.map(t => ({ ...t, label: t.label ?? undefined }) as SpecialTarget) });
    setErrs({});
    setStep('role');
  };

  async function save() {
    if (busyRef.current || readOnly) return;
    const amount = Number(draft.amount);
    if (!draft.role) { setErrs({ role: 'Choose a role.' }); setStep('role'); return; }
    if (!draft.name.trim()) { setErrs({ name: 'Give this fee a name.' }); setStep('fee'); return; }
    if (!Number.isFinite(amount) || amount <= 0) { setErrs({ amount: 'Enter a fee above zero.' }); setStep('fee'); return; }
    if (draft.targets.length === 0) { setErrs({ targets: 'Choose who gets this fee.' }); return; }
    busyRef.current = true;
    setBusy(true);
    setErrs({});
    try {
      const c = await getFreshAuthedClient();
      if (!c) { setErrs({ save: 'Your session has expired. Please sign in again.' }); return; }
      const { data, error } = await c.rpc('special_fee_save', {
        p_conference_id: conference.id, p_fee_id: draft.id, p_role: draft.role, p_name: draft.name.trim(),
        p_amount: amount, p_targets: draft.targets.map(stripLabel),
      });
      if (error) { setErrs({ save: friendlyError(error, 'The special fee could not be saved. Try again.') }); return; }
      const d = (data ?? {}) as { ok?: boolean; field?: string; error?: string };
      if (d.ok !== true) {
        const msg = plainOrFallback(d.error, 'The special fee could not be saved. Try again.');
        if (d.field === 'role') { setErrs({ role: msg }); setStep('role'); }
        else if (d.field === 'name' || d.field === 'amount') { setErrs({ [d.field]: msg }); setStep('fee'); }
        else setErrs({ targets: msg });
        return;
      }
      notifyOk('Special fee saved');
      await load();
      setStep('list');
    } catch (e) {
      setErrs({ save: friendlyError(e, 'The special fee could not be saved. Try again.') });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (busyRef.current || readOnly) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const c = await getFreshAuthedClient();
      if (!c) return;
      const { data, error } = await c.rpc('special_fee_remove', { p_fee_id: id });
      const d = (data ?? {}) as { ok?: boolean; error?: string };
      if (error || d.ok !== true) { setLoadErr(error ? friendlyError(error, 'The special fee could not be removed.') : plainOrFallback(d.error, 'The special fee could not be removed.')); return; }
      setConfirmRemove(null);
      notifyOk('Special fee removed');
      await load();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  // Back on the left; on the add or edit steps the counter on the same line, on the right.
  const back = (to: Step) => (
    <div className="flex items-center justify-between gap-3" style={{ marginBottom: 12 }}>
      <button type="button" className="gv-st-link" onClick={() => setStep(to)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}>
        <ChevronLeft size={16} strokeWidth={2} aria-hidden /> Back
      </button>
      {step !== 'list' && (
        <span style={{ fontFamily: FONT, fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#5A5046' }}>
          Step {step === 'role' ? 1 : step === 'fee' ? 2 : 3} of 3
        </span>
      )}
    </div>
  );
  const fieldErr = (m?: string) => (m ? <p role="alert" className="gv-st-err">{m}</p> : null);
  const people2 = (n: number) => `${n} ${n === 1 ? 'person' : 'people'}`;

  let body: React.ReactNode;
  if (step === 'list') {
    body = (
      <>
        {loadErr && <p role="alert" className="gv-st-err">{loadErr}</p>}
        {fees === null ? (
          <p className="gv-st-quiet">Loading</p>
        ) : fees.length === 0 ? (
          <p className="gv-st-quiet" style={{ fontSize: 14.5 }}>Give a different fee to people you choose. Only their invoice changes.</p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {fees.map(f => (
              <li key={f.id} style={{ border: `1px solid ${LINE}`, borderRadius: 14, padding: '12px 14px', background: '#FFFFFF' }}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0" style={{ flex: '1 1 220px' }}>
                    <p className="[overflow-wrap:anywhere]" style={{ margin: 0, fontFamily: FONT, fontSize: 15, fontWeight: 800, color: INK }}>{f.name}</p>
                    <p style={{ margin: '2px 0 0', fontFamily: FONT, fontSize: 13, color: INK_SOFT }}>
                      {roleLabelFull(f.role)} · {formatMoney(f.amount, currency)}
                    </p>
                    <p style={{ margin: '2px 0 0', fontFamily: FONT, fontSize: 13, color: INK_SOFT }}>
                      {people2(f.reach?.matched ?? 0)}{(f.reach?.already_paid ?? 0) > 0 ? `, ${f.reach.already_paid} already paid the normal fee` : ''}
                    </p>
                  </div>
                  {!readOnly && confirmRemove !== f.id && (
                    <div className="flex items-center gap-3">
                      <button type="button" className="gv-st-link" onClick={() => startEdit(f)}>Edit</button>
                      <button type="button" className="gv-st-link" style={{ color: DANGER }} onClick={() => setConfirmRemove(f.id)}>Remove</button>
                    </div>
                  )}
                </div>
                {confirmRemove === f.id && (
                  <div className="flex items-center gap-3 flex-wrap" style={{ marginTop: 10 }}>
                    <span style={{ fontFamily: FONT, fontSize: 13.5, color: INK }}>Remove this special fee? Unpaid fees go back to the normal price.</span>
                    <button type="button" className="gv-st-btn gv-st-outline" disabled={busy} style={{ color: DANGER }} onClick={() => { void remove(f.id); }}>Remove</button>
                    <button type="button" className="gv-st-link" onClick={() => setConfirmRemove(null)}>Keep it</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {!readOnly && (
          <div style={{ marginTop: 16 }}>
            <button type="button" className="gv-st-btn gv-st-forest" onClick={startNew}>Add a special fee</button>
          </div>
        )}
      </>
    );
  } else if (step === 'role') {
    body = (
      <>
        {back('list')}
        <p style={labelStyle}>Which role is this fee for?</p>
        <div className="flex flex-col gap-2">
          {roles.map(r => (
            <button
              key={r.role}
              type="button"
              onClick={() => { setDraft(d => ({ ...d, role: r.role, targets: d.role === r.role ? d.targets : [] })); setErrs({}); setStep('fee'); }}
              className="flex items-center justify-between gap-3 focus:outline-none"
              style={{ border: `1.5px solid ${draft.role === r.role ? '#1B3828' : LINE}`, borderRadius: 14, padding: '12px 14px', background: '#FFFFFF', cursor: 'pointer', fontFamily: FONT, textAlign: 'left' }}
            >
              <span style={{ fontSize: 15, fontWeight: 700, color: INK }}>{roleLabelFull(r.role)}</span>
              <span style={{ fontSize: 13.5, color: INK_SOFT }}>{formatMoney(Number(r.fee_amount ?? 0), r.fee_currency || currency)}</span>
            </button>
          ))}
          {roles.length === 0 && <p className="gv-st-quiet">This conference has no roles yet.</p>}
        </div>
        {fieldErr(errs.role)}
      </>
    );
  } else if (step === 'fee') {
    body = (
      <>
        {back('role')}
        <label htmlFor="sf-name" style={labelStyle}>Name</label>
        <input id="sf-name" style={inputStyle} maxLength={60} value={draft.name}
          onChange={(e) => setDraft(d => ({ ...d, name: e.target.value }))} />
        {fieldErr(errs.name)}
        <label htmlFor="sf-amount" style={{ ...labelStyle, marginTop: 14 }}>Fee ({currency.toUpperCase()})</label>
        <input id="sf-amount" style={inputStyle} type="number" inputMode="decimal" min={0} step="any" value={draft.amount}
          onChange={(e) => setDraft(d => ({ ...d, amount: e.target.value }))} />
        {fieldErr(errs.amount)}
        <div style={{ marginTop: 16 }}>
          <button
            type="button"
            className="gv-st-btn gv-st-forest"
            onClick={() => {
              const amount = Number(draft.amount);
              if (!draft.name.trim()) { setErrs({ name: 'Give this fee a name.' }); return; }
              if (!Number.isFinite(amount) || amount <= 0) { setErrs({ amount: 'Enter a fee above zero.' }); return; }
              setErrs({});
              setStep('who');
            }}
          >
            Continue
          </button>
        </div>
      </>
    );
  } else {
    const q = query.trim().toLowerCase();
    const shownPeople = (people ?? []).filter(p => !q || p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q)).slice(0, 200);
    const question = roleQuestions.find(x => x.id === questionId) ?? null;
    const chipLabel = (t: SpecialTarget): string => {
      if (t.label) return t.label;
      if (t.kind === 'application') return people?.find(p => p.id === t.application_id)?.name ?? 'A person';
      if (t.kind === 'society') return societies?.find(s => s.id === t.society_id)?.name ?? 'A delegation';
      if (t.kind === 'level') return `MUN level: ${LEVEL_WORD[t.answer] ?? t.answer}`;
      if (t.kind === 'committee') return `Committee preference: ${groups?.committees.find(c => c.answer === t.answer)?.name ?? 'a committee'}`;
      const qq = roleQuestions.find(x => x.id === t.question_id);
      return `${qq?.label ?? 'Answer'}: ${t.answer}`;
    };
    // Answers grouped by question, only for questions found on this role's form.
    const answerQuestions = roleQuestions
      .map(x => ({ q: x, answers: (groups?.answers ?? []).filter(a => a.question_id === x.id) }))
      .filter(x => x.answers.length > 0);
    const levels = groups?.levels ?? [];
    const committeesG = groups?.committees ?? [];
    // The Application answer tab always shows (prompt 38); with no live choice
    // question on the role's form it says so and links to the form builder.
    const tab = whoTab;
    const hasLiveChoice = roleQuestions.some(x => !x.archived && isChoiceType(x.type) && usableOptions(x).length > 0);
    const countWord = (n: number) => `${n} ${n === 1 ? 'person' : 'people'}`;
    const groupHead = (t: string) => (
      <p style={{ margin: '10px 0 4px', fontFamily: FONT, fontSize: 12, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: INK_SOFT }}>{t}</p>
    );
    const tabBtn = (k: typeof whoTab, label: string) => (
      <button type="button" onClick={() => setWhoTab(k)} className="focus:outline-none"
        style={{ border: 'none', borderBottom: `2px solid ${whoTab === k ? '#1B3828' : 'transparent'}`, background: 'none', padding: '6px 2px', marginRight: 16, fontFamily: FONT, fontSize: 14, fontWeight: 700, color: whoTab === k ? INK : INK_SOFT, cursor: 'pointer' }}>
        {label}
      </button>
    );
    const rowBtn = (on: boolean, onClick: () => void, main: React.ReactNode, sub?: string, key?: string, count?: number) => (
      <button key={key} type="button" onClick={onClick} className="flex items-center justify-between gap-3 w-full focus:outline-none"
        style={{ border: `1.5px solid ${on ? '#1B3828' : LINE}`, borderRadius: 12, padding: '9px 12px', background: on ? 'rgba(27,56,40,0.05)' : '#FFFFFF', cursor: 'pointer', fontFamily: FONT, textAlign: 'left' }}>
        <span className="min-w-0">
          <span className="block [overflow-wrap:anywhere]" style={{ fontSize: 14, fontWeight: 700, color: INK }}>{main}</span>
          {sub ? <span className="block [overflow-wrap:anywhere]" style={{ fontSize: 12.5, color: INK_SOFT }}>{sub}</span> : null}
        </span>
        <span className="flex items-center gap-3 flex-shrink-0">
          {count !== undefined && count > 0 && <span style={{ fontSize: 12.5, color: INK_SOFT, fontVariantNumeric: 'tabular-nums' }}>{countWord(count)}</span>}
          <span style={{ fontSize: 12.5, fontWeight: 700, color: on ? '#1B3828' : INK_SOFT }}>{on ? 'Added' : 'Add'}</span>
        </span>
      </button>
    );
    body = (
      <>
        {back('fee')}
        <p style={labelStyle}>Who gets this fee?</p>
        <div style={{ borderBottom: `1px solid ${LINE}`, marginBottom: 12 }}>
          {tabBtn('people', 'People')}
          {tabBtn('delegations', 'Delegations')}
          {tabBtn('answer', 'Application answer')}
        </div>
        {tab === 'people' && (
          <>
            <div className="flex items-center gap-2" style={{ ...inputStyle, padding: '0 12px' }}>
              <Search size={16} strokeWidth={1.75} aria-hidden style={{ color: INK_SOFT, flexShrink: 0 }} />
              <input aria-label="Search by name or email" placeholder="Search by name or email" value={query} onChange={(e) => setQuery(e.target.value)}
                style={{ border: 'none', outline: 'none', flex: 1, padding: '10px 0', fontSize: 16, fontFamily: FONT, background: 'transparent', color: INK }} />
            </div>
            <div className="flex flex-col gap-1.5" style={{ marginTop: 10, maxHeight: 260, overflowY: 'auto' }}>
              {people === null ? <p className="gv-st-quiet">Loading</p>
                : shownPeople.length === 0 ? <p className="gv-st-quiet">Nobody matches</p>
                : shownPeople.map(p => rowBtn(hasTarget({ kind: 'application', application_id: p.id }),
                  () => toggleTarget({ kind: 'application', application_id: p.id, label: p.name }), p.name, p.email, p.id))}
            </div>
          </>
        )}
        {tab === 'delegations' && (
          <div className="flex flex-col gap-1.5" style={{ maxHeight: 300, overflowY: 'auto' }}>
            {societies === null ? <p className="gv-st-quiet">Loading</p>
              : societies.length === 0 ? <p className="gv-st-quiet">No delegations have people here yet</p>
              : societies.map(s => rowBtn(hasTarget({ kind: 'society', society_id: s.id }),
                () => toggleTarget({ kind: 'society', society_id: s.id, label: s.name }), s.name, undefined, s.id))}
          </div>
        )}
        {tab === 'answer' && (
          <div className="flex flex-col gap-1.5" style={{ maxHeight: 340, overflowY: 'auto' }}>
            {!hasLiveChoice && (
              <div style={{ marginBottom: 6 }}>
                <p className="[overflow-wrap:anywhere]" style={{ margin: '0 0 8px', fontFamily: FONT, fontSize: 14, color: INK }}>
                  No application questions with choices have been set up for {roleLabelFull(draft.role)} yet.
                </p>
                <a href={`/manage/${conference.slug}/settings?tab=applications&role=${encodeURIComponent(draft.role)}&step=form`} className="gv-st-btn gv-st-outline" style={{ textDecoration: 'none' }}>
                  Set up application questions
                </a>
              </div>
            )}
            {levels.length > 0 && (
              <>
                {groupHead('MUN level')}
                {levels.map(l => rowBtn(hasTarget({ kind: 'level', answer: l.answer }),
                  () => toggleTarget({ kind: 'level', answer: l.answer, label: `MUN level: ${LEVEL_WORD[l.answer] ?? l.answer}` }),
                  LEVEL_WORD[l.answer] ?? l.answer, undefined, `l:${l.answer}`, l.count))}
              </>
            )}
            {committeesG.length > 0 && (
              <>
                {groupHead('Committee preference')}
                {committeesG.map(c => rowBtn(hasTarget({ kind: 'committee', answer: c.answer }),
                  () => toggleTarget({ kind: 'committee', answer: c.answer, label: `Committee preference: ${c.name}` }),
                  c.name, c.full_name && c.full_name !== c.name ? c.full_name : undefined, `c:${c.answer}`, c.count))}
              </>
            )}
            {answerQuestions.length > 0 && (
              <>
                {groupHead('Application answers')}
                {!question ? answerQuestions.map(({ q: x }) => rowBtn(false, () => setQuestionId(x.id),
                  <>{x.label || 'Untitled question'}{x.archived && <span style={{ fontSize: 12, fontWeight: 500, color: INK_SOFT }}> (no longer on the form)</span>}</>,
                  undefined, x.id)) : (
                  <>
                    <button type="button" className="gv-st-link" onClick={() => setQuestionId('')} style={{ alignSelf: 'flex-start', marginBottom: 4 }}>Choose another question</button>
                    <p className="[overflow-wrap:anywhere]" style={{ margin: '0 0 4px', fontFamily: FONT, fontSize: 14, fontWeight: 700, color: INK }}>
                      {question.label}{question.archived && <span style={{ fontSize: 12, fontWeight: 500, color: INK_SOFT }}> (no longer on the form)</span>}
                    </p>
                    {(answerQuestions.find(x => x.q.id === question.id)?.answers ?? []).map(a => rowBtn(hasTarget({ kind: 'answer', question_id: question.id, answer: a.answer }),
                      () => toggleTarget({ kind: 'answer', question_id: question.id, answer: a.answer, label: `${question.label}: ${a.answer}` }),
                      a.answer, undefined, a.answer, a.count))}
                  </>
                )}
              </>
            )}
          </div>
        )}

        {draft.targets.length > 0 && (
          <div className="flex flex-wrap gap-2" style={{ marginTop: 14 }}>
            {draft.targets.map(t => (
              <span key={targetKey(t)} className="inline-flex items-center gap-1.5 [overflow-wrap:anywhere]"
                style={{ padding: '5px 8px 5px 12px', borderRadius: 999, background: 'rgba(27,56,40,0.07)', fontFamily: FONT, fontSize: 13, fontWeight: 600, color: INK }}>
                {chipLabel(t)}
                <button type="button" aria-label={`Remove ${chipLabel(t)}`} onClick={() => toggleTarget(t)} className="focus:outline-none"
                  style={{ border: 'none', background: 'none', padding: 2, cursor: 'pointer', color: INK_SOFT, lineHeight: 0 }}>
                  <X size={14} strokeWidth={2} aria-hidden />
                </button>
              </span>
            ))}
          </div>
        )}
        {reach && draft.targets.length > 0 && (
          <p style={{ margin: '10px 0 0', fontFamily: FONT, fontSize: 14, color: INK }}>
            {reach.matched === 1 ? '1 person gets this fee.' : `${reach.matched} people get this fee.`}
            {reach.already_paid > 0 ? ` ${reach.already_paid} already paid the normal fee and keep what they paid.` : ''}
            {reach.locked > 0 ? ` ${reach.locked} have a payment in progress and keep the price they started with.` : ''}
          </p>
        )}
        <p className="gv-st-quiet" style={{ marginTop: 6 }}>People who match later get this fee automatically.</p>
        {fieldErr(errs.targets)}
        {fieldErr(errs.save)}
        <div style={{ marginTop: 16 }}>
          <button type="button" className="gv-st-btn gv-st-forest" disabled={busy || readOnly} onClick={() => { void save(); }}>
            {busy ? 'Saving' : 'Save special fee'}
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{STORE_CSS}</style>
      <style>{DASH_CSS}</style>
      <style>{PURCHASE_CSS}</style>
      <PurchaseShell tone="light" label="Special Fees" onClose={onClose} panelClass="gv-fd-wide" testId="financials-special-fees">
        <div className="gv-fd-pop gv-st">
          <div style={{ paddingRight: 40 }}>
            <h2 className="gv-fd-pop-title" style={{ paddingRight: 0 }}>Special Fees</h2>
            <p className="gv-fd-note" style={{ marginTop: 6, fontSize: 15 }}>A different fee for people you choose. Only their invoice changes.</p>
          </div>
          {readOnly && <p className="gv-fd-note">{READ_ONLY_LINE}</p>}
          <div style={{ marginTop: 14 }}>{body}</div>
        </div>
      </PurchaseShell>
    </>
  );
}
