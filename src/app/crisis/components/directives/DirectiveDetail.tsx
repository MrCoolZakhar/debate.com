'use client';
// Gavelling Crisis: one directive, opened. The backroom inbox shows it beside the queue and the
// Crisis Command page reuses it. Staff only: it shows the author's secret goals and internal notes.

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ArrowLeft, ArrowRight, Check, Clock, Coins, FileText, Landmark, Lock, MessageCircle, MessageSquare, Newspaper, Send, Target, UserCheck,
  UserRound, VenetianMask, X, Zap, Package,
} from 'lucide-react';
import GSelect from '@/components/GSelect';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import {
  addNote, answerDirective, assignDirective, crisisError, listNotes, loadResources, loadSecrets,
  type AnswerEffects,
} from '@/lib/crisis/api';
import { getCrisisClient } from '@/lib/crisis/client';
import {
  KIND_LABEL, OUTCOME_LABEL, ROLE_LABEL,
  type Directive, type DirectiveNote, type DirectiveOutcome, type Resource, type ResourceType,
} from '@/lib/crisis/types';
import { Avatar, Btn, CK, Eyebrow, FieldLabel, OverhangCard, Skeleton, ThemeTag, cabinetTint, fieldStyle, waitLabel, waitSeverity } from '../../crisisKit';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import { KIND_ICON, OUTCOME_STYLE, authorName, buildNames, listDirectiveCoauthors, memberName } from './directiveKit';

export interface DirectiveDetailProps {
  directive: Directive;
  /** Shown as a back button on phones and a close X on desktop when given. */
  onClose?: () => void;
  /** Called after this person claimed, handed over or answered. */
  onChanged?: (what: 'claimed' | 'assigned' | 'answered') => void;
  /** Bump to re-read the notes (the inbox does it on a live ping). */
  notesVersion?: number;
}

const OUTCOMES: DirectiveOutcome[] = ['approved', 'partial', 'denied', 'clarify', 'later'];

// Unsent replies survive switching between directives.
const drafts = new Map<string, { outcome: DirectiveOutcome | null; reply: string }>();

/** A small tile with an icon, a label and a value. */
function Tile({ icon, label, value, tone }: { icon: ReactNode; label: string; value: ReactNode; tone?: string }) {
  return (
    <div className="flex items-start" style={{ gap: 8, background: CK.card, borderRadius: 14, padding: '9px 11px', boxShadow: `inset 0 0 0 1px ${CK.hair}`, minWidth: 0 }}>
      <span aria-hidden style={{ color: tone ?? CK.red, lineHeight: 0, marginTop: 2, flex: 'none' }}>{icon}</span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: CK.muted }}>{label}</span>
        <b style={{ display: 'block', fontSize: 13, marginTop: 1, overflowWrap: 'anywhere', color: CK.ink }}>{value}</b>
      </span>
    </div>
  );
}

const timeOf = (iso: string) => new Date(iso).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export function DirectiveDetail({ directive, onClose, onChanged, notesVersion = 0 }: DirectiveDetailProps) {
  const { ref, core, memberId, director, settings, staff } = useCrisis();
  const names = useMemo(() => buildNames(core.cabinets, core.characters, core.members), [core]);
  const d = directive;
  const who = authorName(d, names);
  const cabinet = d.cabinet_id ? names.cabinets.get(d.cabinet_id) : undefined;
  const character = d.author_character_id ? names.characters.get(d.author_character_id) : undefined;
  const backroomer = character?.owner_member_id ?? null;
  const mine = !!memberId && d.assigned_member_id === memberId;
  const open = d.status === 'queued' || d.status === 'claimed' || d.status === 'clarify';

  const draft = drafts.get(d.id);
  const [outcome, setOutcome] = useState<DirectiveOutcome | null>(draft?.outcome ?? null);
  const [reply, setReply] = useState(draft?.reply ?? '');
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<'send' | 'claim' | 'assign' | 'note' | null>(null);
  const [handTo, setHandTo] = useState('');

  // Also: resources and news.
  const [resOn, setResOn] = useState(false);
  const [resData, setResData] = useState<{ types: ResourceType[]; resources: Resource[] } | null>(null);
  const [resRows, setResRows] = useState<Array<{ id: string; delta: string }>>([{ id: '', delta: '' }]);
  const [newsOn, setNewsOn] = useState(false);
  const [newsTitle, setNewsTitle] = useState('');
  const [newsBody, setNewsBody] = useState('');
  const [newsAudience, setNewsAudience] = useState('');

  // Notes
  const [notes, setNotes] = useState<DirectiveNote[] | null>(null);
  const [noteText, setNoteText] = useState('');
  const [internal, setInternal] = useState(true);

  // Joint directives: who signed with the author
  const [coIds, setCoIds] = useState<string[]>([]);

  // Context
  const [goals, setGoals] = useState<string | null | undefined>(undefined);
  const [lastHeard, setLastHeard] = useState<string | null | undefined>(undefined);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(t); }, []);
  useEffect(() => { drafts.set(d.id, { outcome, reply }); }, [d.id, outcome, reply]);

  const loadNotes = useCallback(async () => {
    try { setNotes(await listNotes(ref, d.id)); } catch { setNotes((prev) => prev ?? []); }
  }, [ref, d.id]);
  useEffect(() => { void loadNotes(); }, [loadNotes, notesVersion, d.updated_at]);

  useEffect(() => {
    let cancelled = false;
    if (d.kind !== 'joint') { setCoIds([]); return; }
    listDirectiveCoauthors(ref, d.id).then((ids) => { if (!cancelled) setCoIds(ids); }).catch(() => { if (!cancelled) setCoIds([]); });
    return () => { cancelled = true; };
  }, [ref, d.id, d.kind]);

  useEffect(() => {
    let cancelled = false;
    if (!d.author_character_id) { setGoals(null); return; }
    loadSecrets(ref).then((rows) => {
      if (!cancelled) setGoals(rows.find((r) => r.character_id === d.author_character_id)?.goals ?? null);
    }).catch(() => { if (!cancelled) setGoals(null); });
    return () => { cancelled = true; };
  }, [ref, d.author_character_id]);

  useEffect(() => {
    let cancelled = false;
    if (!d.author_member_id) { setLastHeard(null); return; }
    (async () => {
      try {
        const client = await getCrisisClient(ref.conf, ref.crisis);
        const res = await client.from('crisis_directives').select('answered_at')
          .eq('author_member_id', d.author_member_id).neq('id', d.id).not('answered_at', 'is', null)
          .order('answered_at', { ascending: false }).limit(1);
        if (!cancelled) setLastHeard(res.error ? null : ((res.data?.[0] as { answered_at: string } | undefined)?.answered_at ?? null));
      } catch { if (!cancelled) setLastHeard(null); }
    })();
    return () => { cancelled = true; };
  }, [ref, d.author_member_id, d.id]);

  const canResources = director || settings.backroomPowers.resources;
  useEffect(() => {
    if (!resOn || resData) return;
    let cancelled = false;
    loadResources(ref).then((r) => { if (!cancelled) setResData(r); }).catch((e) => { if (!cancelled) { notifyErr(crisisError(e, 'Could not load the resources.'), 'crisis-resources'); setResOn(false); } });
    return () => { cancelled = true; };
  }, [resOn, resData, ref]);

  const resourceOptions = useMemo(() => {
    if (!resData) return [];
    const cabId = d.cabinet_id ?? character?.cabinet_id ?? null;
    const typeById = new Map(resData.types.map((t) => [t.id, t]));
    return resData.resources
      .filter((r) => (r.character_id && r.character_id === d.author_character_id) || (r.cabinet_id && r.cabinet_id === cabId))
      .map((r) => {
        const t = typeById.get(r.type_id);
        const owner = r.character_id ? (names.characters.get(r.character_id)?.name ?? 'Character') : (names.cabinets.get(r.cabinet_id ?? '')?.name ?? 'Cabinet');
        return { value: r.id, label: `${t?.name ?? 'Resource'}, ${owner}: ${r.amount}${t?.unit ? ` ${t.unit}` : ''}` };
      });
  }, [resData, d.cabinet_id, d.author_character_id, character, names]);

  const staffOptions = useMemo(
    () => core.members
      .filter((m) => m.role === 'director' || m.role === 'assistant_director' || m.role === 'backroomer')
      .map((m) => ({ value: m.id, label: m.display_name, hint: ROLE_LABEL[m.role] })),
    [core.members],
  );

  const audienceOptions = useMemo(
    () => [{ value: '', label: 'Every room' }, ...core.cabinets.map((c) => ({ value: c.id, label: c.name }))],
    [core.cabinets],
  );

  if (!staff) return null;

  const claim = async () => {
    setBusy('claim');
    try { await assignDirective(ref, d.id); notifyOk('Directive is yours', 'crisis-directive'); onChanged?.('claimed'); }
    catch (e) { notifyErr(crisisError(e), 'crisis-directive'); }
    finally { setBusy(null); }
  };

  const hand = async () => {
    if (!handTo) return;
    setBusy('assign');
    try { await assignDirective(ref, d.id, handTo); notifyOk(`Handed to ${memberName(handTo, names)}`, 'crisis-directive'); setHandTo(''); onChanged?.('assigned'); }
    catch (e) { notifyErr(crisisError(e), 'crisis-directive'); }
    finally { setBusy(null); }
  };

  const sendNote = async () => {
    const text = noteText.trim();
    if (!text) return;
    setBusy('note');
    try { await addNote(ref, d.id, text, internal); setNoteText(''); await loadNotes(); }
    catch (e) { notifyErr(crisisError(e), 'crisis-directive'); }
    finally { setBusy(null); }
  };

  const effectsFromForm = (): AnswerEffects => {
    const effects: AnswerEffects = {};
    if (resOn && canResources) {
      const rows = resRows
        .map((r) => ({ id: r.id, delta: Number(r.delta) }))
        .filter((r) => r.id && Number.isFinite(r.delta) && r.delta !== 0);
      if (rows.length) effects.resources = rows;
    }
    if (newsOn && newsTitle.trim()) {
      effects.news = { title: newsTitle.trim(), body: newsBody.trim() || undefined, audience_cabinet_id: newsAudience || null };
    }
    return effects;
  };

  const send = async () => {
    if (!outcome || !reply.trim() || busy) return;
    setBusy('send');
    try {
      await answerDirective(ref, d.id, outcome, reply.trim(), effectsFromForm());
      drafts.delete(d.id);
      notifyOk(`Reply sent to ${who}`, 'crisis-directive');
      setEditing(false);
      setResOn(false); setNewsOn(false); setNewsTitle(''); setNewsBody(''); setResRows([{ id: '', delta: '' }]);
      onChanged?.('answered');
    } catch (e) {
      notifyErr(crisisError(e, 'Could not send the reply. Your text is kept, try again.'), 'crisis-directive');
    } finally { setBusy(null); }
  };


  const showForm = d.status !== 'answered' || editing;
  const KindIcon = KIND_ICON[d.kind];
  const accent = cabinet?.color ?? CK.red;
  const coChars = coIds.map((id) => names.characters.get(id)).filter((c): c is NonNullable<typeof c> => !!c);
  const sev = waitSeverity(d.waiting_since, now);
  const sevColor = sev === 'very' ? CK.danger : sev === 'late' ? CK.goldDeep : CK.ink;
  const answeredStyle = d.outcome ? OUTCOME_STYLE[d.outcome] : null;
  const hasLegacy = !!(d.resources_used || d.goal || d.affects || d.covert);

  return (
    <div className="flex flex-col" style={{ gap: 12, fontFamily: CK.font }}>
      {/* Header: the author's picture overhangs the corner */}
      <OverhangCard name={who} src={character?.picture_url} color={accent} size={58} warm>
        <div className="flex items-start" style={{ gap: 10 }}>
          {onClose && (
            <button onClick={onClose} aria-label="Back to the queue" className="lg:hidden grid place-items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
              style={{ width: 34, height: 34, borderRadius: '50%', border: 0, background: CK.card, boxShadow: CK.shadowSm, color: CK.ink, flex: 'none', cursor: 'pointer' }}>
              <ArrowLeft size={17} strokeWidth={1.5} />
            </button>
          )}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="flex items-center" style={{ gap: 6 }}>
              <span aria-hidden style={{ color: CK.red, lineHeight: 0 }}><KindIcon size={15} strokeWidth={1.5} /></span>
              <Eyebrow>{`${KIND_LABEL[d.kind].toUpperCase()} · NO. ${d.no}`}</Eyebrow>
            </div>
            <h2 style={{ margin: '3px 0 0', fontSize: 20, fontWeight: 800, lineHeight: 1.2, color: CK.ink, overflowWrap: 'anywhere' }}>{d.title}</h2>
            <p style={{ margin: '5px 0 0', fontSize: 13, color: CK.inkSoft, overflowWrap: 'anywhere' }}>
              <b style={{ color: CK.ink }}>{who}</b>
              {cabinet && <> · <span style={{ color: cabinet.color, fontWeight: 700 }}>{cabinet.name}</span></>}
            </p>
            <p className="flex items-center" style={{ margin: '3px 0 0', gap: 5, fontSize: 12.5, color: d.status === 'queued' || d.status === 'claimed' ? sevColor : CK.inkSoft, fontWeight: 600 }}>
              <Clock size={13} strokeWidth={1.5} aria-hidden />
              {d.status === 'answered' ? `Answered ${waitLabel(d.answered_at, now)} ago` : d.status === 'clarify' ? 'Waiting for the delegate' : `Waiting ${waitLabel(d.waiting_since, now)}`}
            </p>
            {d.kind === 'committee' && cabinet && (
              <p className="flex items-center" style={{ margin: '6px 0 0', gap: 6, fontSize: 12.5, fontWeight: 700, color: cabinet.color }}>
                <Landmark size={14} strokeWidth={1.5} aria-hidden />On behalf of {cabinet.name}
              </p>
            )}
            {d.kind === 'joint' && coChars.length > 0 && (
              <div className="flex items-center flex-wrap" style={{ gap: '6px 12px', marginTop: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: CK.inkSoft }}>With</span>
                {coChars.map((c) => {
                  const cc = c.cabinet_id ? names.cabinets.get(c.cabinet_id) : undefined;
                  return (
                    <span key={c.id} className="inline-flex items-center" style={{ gap: 6, fontSize: 12.5, fontWeight: 700, color: CK.ink }}>
                      <Avatar name={c.name} src={c.picture_url} size={26} color={cc?.color ?? CK.red} />
                      <span style={{ overflowWrap: 'anywhere' }}>{c.name}</span>
                    </span>
                  );
                })}
              </div>
            )}
          </div>
          {onClose && (
            <button onClick={onClose} aria-label="Close" className="hidden lg:grid place-items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
              style={{ width: 34, height: 34, borderRadius: '50%', border: 0, background: CK.card, boxShadow: CK.shadowSm, color: CK.ink, flex: 'none', cursor: 'pointer' }}>
              <X size={17} strokeWidth={1.5} />
            </button>
          )}
        </div>
      </OverhangCard>

      {/* To and themes (and only the old fields a row still carries) */}
      <div className="flex items-center flex-wrap" style={{ gap: '6px 8px' }}>
        <span className="inline-flex items-center" style={{ gap: 5, fontSize: 13, fontWeight: 700, color: CK.ink, background: CK.card, borderRadius: 10, padding: '4px 10px', boxShadow: `inset 0 0 0 1px ${CK.hair}`, overflowWrap: 'anywhere' }}>
          <ArrowRight size={14} strokeWidth={1.5} aria-hidden style={{ color: CK.red, flex: 'none' }} />
          <span style={{ color: CK.muted, fontWeight: 600 }}>To</span> {d.receiver}
        </span>
        {d.themes.map((t) => <ThemeTag key={t} theme={t} size="md" />)}
        {d.covert && (
          <span className="inline-flex items-center" style={{ gap: 4, fontSize: 12.5, fontWeight: 700, color: CK.redDeep, background: cabinetTint(CK.redDeep, 0.08), borderRadius: 8, padding: '3px 9px' }}>
            <VenetianMask size={14} strokeWidth={1.6} aria-hidden />Covert
          </span>
        )}
      </div>
      {hasLegacy && (d.resources_used || d.goal || d.affects) && (
        <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 8 }}>
          {d.resources_used && <Tile icon={<Package size={16} strokeWidth={1.5} />} label="Resources used" value={d.resources_used} />}
          {d.affects && <Tile icon={<Zap size={16} strokeWidth={1.5} />} label="Affects" value={d.affects} />}
          {d.goal && <div style={{ gridColumn: '1 / -1' }}><Tile icon={<Target size={16} strokeWidth={1.5} />} label="Goal" value={d.goal} /></div>}
        </div>
      )}

      <div style={{ background: CK.card, borderRadius: 16, padding: '13px 15px', lineHeight: 1.6, fontSize: 14.5, boxShadow: `inset 4px 0 0 ${accent}, ${CK.shadowSm}`, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
        {d.body}
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4" style={{ gap: 8 }}>
        <Tile icon={<Clock size={16} strokeWidth={1.5} />} label={d.status === 'answered' ? 'Answered' : 'Waiting'} tone={d.status === 'answered' ? CK.ok : sevColor}
          value={d.status === 'answered' ? `${waitLabel(d.answered_at, now)} ago` : d.status === 'clarify' ? 'For the delegate' : waitLabel(d.waiting_since, now)} />
        <Tile icon={<MessageCircle size={16} strokeWidth={1.5} />} label="Last heard back" value={lastHeard === undefined ? 'Loading' : lastHeard ? `${waitLabel(lastHeard, now)} ago` : 'Not yet'} />
        <Tile icon={<FileText size={16} strokeWidth={1.5} />} label="Length" value={`${d.word_count} words`} />
        <Tile icon={<UserRound size={16} strokeWidth={1.5} />} label="Their backroomer" value={memberName(backroomer, names, 'Nobody yet')} />
      </div>

      {(goals === undefined || (goals && goals.trim())) && (
        <div style={{ background: `linear-gradient(180deg, ${cabinetTint(CK.gold, 0.5)}, ${cabinetTint(CK.gold, 0.26)})`, borderRadius: 16, padding: '11px 14px', boxShadow: `inset 0 0 0 1px ${cabinetTint(CK.goldDeep, 0.25)}` }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 800, color: CK.goldDeep }}>
            <Lock size={14} strokeWidth={1.5} /> Their goals, only staff see this
          </span>
          {goals === undefined ? <div style={{ marginTop: 6 }}><Skeleton h={14} w="70%" /></div> : (
            <b style={{ display: 'block', fontSize: 13.5, marginTop: 4, fontWeight: 600, lineHeight: 1.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', color: CK.ink }}>{goals}</b>
          )}
        </div>
      )}

      {/* Thread */}
      <div>
        <h3 className="flex items-center" style={{ margin: '0 0 8px', gap: 6, fontSize: 14, fontWeight: 800, color: CK.ink }}>
          <MessageSquare size={16} strokeWidth={1.5} aria-hidden style={{ color: CK.red }} />Notes
        </h3>
        <div className="flex flex-col" style={{ gap: 8 }}>
          {notes === null && <Skeleton h={34} r={14} />}
          {notes?.length === 0 && <p style={{ margin: 0, fontSize: 13, color: CK.muted }}>No notes yet</p>}
          {notes?.map((n) => {
            const fromAuthor = !!n.member_id && n.member_id === d.author_member_id;
            return (
              <div key={n.id} style={{
                alignSelf: fromAuthor ? 'flex-start' : 'flex-end', maxWidth: '90%', padding: '8px 12px',
                borderRadius: fromAuthor ? '4px 16px 16px 16px' : '16px 4px 16px 16px',
                background: n.internal ? cabinetTint(CK.gold, 0.34) : fromAuthor ? CK.card : cabinetTint(CK.forest, 0.1),
                boxShadow: fromAuthor ? CK.shadowSm : 'none',
              }}>
                <p style={{ margin: 0, fontSize: 11.5, fontWeight: 700, color: CK.inkSoft, display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                  {n.internal && <Lock size={11} strokeWidth={1.5} aria-label="Internal note" />}
                  <span>{memberName(n.member_id, names, 'Staff')}{fromAuthor ? ' (delegate)' : ''}</span>
                  <span style={{ fontWeight: 500, color: CK.muted }}>{timeOf(n.created_at)}{n.internal ? ' · Internal' : ''}</span>
                </p>
                <p style={{ margin: '2px 0 0', fontSize: 13.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{n.body}</p>
              </div>
            );
          })}
        </div>
        <div className="flex flex-col" style={{ gap: 6, marginTop: 10 }}>
          <textarea
            value={noteText} onChange={(e) => setNoteText(e.target.value)} rows={2} maxLength={4000}
            aria-label="Write a note" placeholder={internal ? 'Note for staff only' : 'Note the delegate will see'}
            style={{ ...fieldStyle, resize: 'vertical' }}
          />
          <div className="flex items-center justify-between flex-wrap" style={{ gap: 8 }}>
            <label className="inline-flex items-center" style={{ gap: 6, fontSize: 13, fontWeight: 600, color: CK.inkSoft, cursor: 'pointer' }}>
              <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} />
              <Lock size={13} strokeWidth={1.5} aria-hidden /> Internal note
            </label>
            <Btn tone="ghost" size="sm" icon={<MessageSquare size={14} strokeWidth={1.5} />} onClick={sendNote} disabled={!noteText.trim() || busy === 'note'}>Add note</Btn>
          </div>
        </div>
      </div>

      {/* Answer */}
      {d.status === 'answered' && !editing && (
        <div style={{ background: answeredStyle ? cabinetTint(answeredStyle.color, 0.08) : CK.card, borderRadius: 18, padding: '13px 15px', boxShadow: `inset 0 0 0 1px ${cabinetTint(answeredStyle?.color ?? CK.red, 0.28)}` }}>
          <span className="inline-flex items-center" style={{ gap: 6, fontSize: 13, fontWeight: 800, color: answeredStyle?.color ?? CK.ink }}>
            {answeredStyle && <answeredStyle.Icon size={18} strokeWidth={1.5} aria-hidden />}
            {d.outcome ? OUTCOME_LABEL[d.outcome] : 'Answered'}
          </span>
          <p style={{ margin: '6px 0 0', fontSize: 14, lineHeight: 1.55, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{d.reply}</p>
          <p style={{ margin: '6px 0 0', fontSize: 12, color: CK.muted }}>By {memberName(d.answered_by, names, 'staff')}</p>
          <div style={{ marginTop: 8 }}><Btn tone="ghost" size="sm" onClick={() => { setOutcome(d.outcome); setReply(d.reply ?? ''); setEditing(true); }}>Answer again</Btn></div>
        </div>
      )}

      {showForm && (
        <div className="flex flex-col" style={{ gap: 12, background: CK.card, borderRadius: 20, padding: '14px 15px', boxShadow: CK.shadow }}>
          <h3 className="flex items-center" style={{ margin: 0, gap: 6, fontSize: 15, fontWeight: 800, color: CK.ink }}>
            <Send size={16} strokeWidth={1.5} aria-hidden style={{ color: CK.red }} />Your Answer
          </h3>
          {d.status === 'clarify' && d.reply && (
            <p style={{ margin: 0, fontSize: 12.5, color: CK.inkSoft }}>You asked for more detail: <i>{d.reply}</i></p>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5" style={{ gap: 6 }} role="radiogroup" aria-label="Outcome">
            {OUTCOMES.map((o) => {
              const on = outcome === o;
              const st = OUTCOME_STYLE[o];
              return (
                <button key={o} role="radio" aria-checked={on} onClick={() => setOutcome(o)}
                  className="flex flex-col items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] active:scale-[0.97] transition-transform"
                  style={{ border: 0, borderRadius: 14, padding: '9px 6px', gap: 4, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: CK.font, textAlign: 'center',
                    background: on ? st.color : cabinetTint(st.color, 0.07), color: on ? '#fff' : st.color,
                    boxShadow: on ? CK.shadowSm : `inset 0 0 0 1px ${cabinetTint(st.color, 0.22)}` }}>
                  <st.Icon size={21} strokeWidth={1.5} aria-hidden />
                  <span>{OUTCOME_LABEL[o]}</span>
                </button>
              );
            })}
          </div>
          <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={5} maxLength={8000}
            aria-label="Reply to the delegate" placeholder={`Reply to ${who}`} style={{ ...fieldStyle, resize: 'vertical', background: CK.page }} />

          <div className="flex flex-col" style={{ gap: 8 }}>
            <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: CK.inkSoft }}>Also</p>
            <div className="flex flex-wrap" style={{ gap: 6 }}>
              {canResources && <AlsoToggle icon={<Coins size={16} strokeWidth={1.5} />} label="Change resources" on={resOn} onClick={() => setResOn((v) => !v)} />}
              <AlsoToggle icon={<Newspaper size={16} strokeWidth={1.5} />} label="Write news from this" on={newsOn} onClick={() => setNewsOn((v) => !v)} />
            </div>
            {resOn && canResources && (
              <div className="flex flex-col" style={{ gap: 6 }}>
                {!resData && <Skeleton h={34} />}
                {resData && resourceOptions.length === 0 && <p style={{ margin: 0, fontSize: 13, color: CK.muted }}>This character and cabinet have no resources yet</p>}
                {resData && resourceOptions.length > 0 && resRows.map((row, i) => (
                  <div key={i} className="flex items-center flex-wrap" style={{ gap: 6 }}>
                    <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                      <GSelect size="sm" value={row.id} placeholder="Pick a resource" aria-label="Resource" options={resourceOptions}
                        onChange={(v) => setResRows((rs) => rs.map((r, j) => (j === i ? { ...r, id: v } : r)))} />
                    </div>
                    <input type="number" inputMode="decimal" value={row.delta} aria-label="Change by"
                      onChange={(e) => setResRows((rs) => rs.map((r, j) => (j === i ? { ...r, delta: e.target.value } : r)))}
                      placeholder="+5 or -5" style={{ ...fieldStyle, width: 110, padding: '6px 10px' }} />
                  </div>
                ))}
                {resData && resourceOptions.length > 0 && (
                  <div><Btn tone="ghost" size="sm" onClick={() => setResRows((rs) => [...rs, { id: '', delta: '' }])}>Add another</Btn></div>
                )}
              </div>
            )}
            {newsOn && (
              <div className="flex flex-col" style={{ gap: 6 }}>
                <input value={newsTitle} onChange={(e) => setNewsTitle(e.target.value)} maxLength={160} aria-label="News title" placeholder="News title" style={fieldStyle} />
                <textarea value={newsBody} onChange={(e) => setNewsBody(e.target.value)} rows={3} aria-label="News text" placeholder="News text" style={{ ...fieldStyle, resize: 'vertical' }} />
                <div>
                  <FieldLabel>Who reads it</FieldLabel>
                  <GSelect size="sm" value={newsAudience} options={audienceOptions} onChange={setNewsAudience} aria-label="News audience" />
                </div>
                <p style={{ margin: 0, fontSize: 12, color: CK.muted }}>It is saved as a draft on the News page.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      {(open || editing) && (
        <div className="flex items-center flex-wrap" style={{ gap: 8, paddingTop: 4 }}>
          {!mine && !!memberId && d.status !== 'clarify' && (
            <Btn tone="ghost" icon={<UserCheck size={15} strokeWidth={1.5} />} onClick={claim} disabled={busy === 'claim'}>Claim</Btn>
          )}
          <div className="flex items-center" style={{ gap: 6 }}>
            <div style={{ width: 190 }}>
              <GSelect size="sm" value={handTo} onChange={setHandTo} options={staffOptions} placeholder="Choose a person" aria-label="Hand to" />
            </div>
            <Btn tone="ghost" onClick={hand} disabled={!handTo || busy === 'assign'}>Hand to</Btn>
          </div>
          <span className="flex-1" />
          {showForm && (
            <Btn tone="green" icon={<Send size={15} strokeWidth={1.5} />} onClick={send} disabled={!outcome || !reply.trim() || busy === 'send'}>Send reply</Btn>
          )}
        </div>
      )}
    </div>
  );
}

function AlsoToggle({ icon, label, on, onClick }: { icon: ReactNode; label: string; on: boolean; onClick: () => void }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick}
      className="inline-flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] active:scale-[0.97] transition-transform"
      style={{ gap: 7, border: 0, borderRadius: 12, padding: '7px 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: CK.font,
        background: on ? cabinetTint(CK.forest, 0.1) : CK.page, color: on ? CK.forest : CK.inkSoft,
        boxShadow: on ? `inset 0 0 0 1.5px ${CK.forest}` : `inset 0 0 0 1px ${CK.hair}` }}>
      <span aria-hidden style={{ lineHeight: 0 }}>{icon}</span>
      {label}
      {on && <Check size={14} strokeWidth={2} aria-hidden />}
    </button>
  );
}

export default DirectiveDetail;
