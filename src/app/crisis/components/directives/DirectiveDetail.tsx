'use client';
// Gavelling Crisis: one directive, opened. The backroom inbox shows it beside the queue and the
// Crisis Command page reuses it. Staff only: it shows the author's secret goals and internal notes.
// WHO wrote it leads: a big portrait overhanging the card (click it for the character's directives,
// performance and points), the name, their title, the cabinet logo and name, and small tags for
// the details. The reply box has a "+" for what is done together with the reply.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ArrowLeft, ArrowRight, Check, ChevronDown, Clock, FileText, Landmark, Lock, MessageCircle, MessageSquare, Package, Plus, Send, Target,
  UserCheck, VenetianMask, X, Zap,
} from 'lucide-react';
import GSelect from '@/components/GSelect';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { addNote, answerDirective, assignDirective, crisisError, listNotes, loadSecrets } from '@/lib/crisis/api';
import { getCrisisClient } from '@/lib/crisis/client';
import { dirNumber, timeAgo } from '@/lib/crisis/format';
import {
  KIND_LABEL, OUTCOME_LABEL, ROLE_LABEL,
  type Directive, type DirectiveNote, type DirectiveOutcome,
} from '@/lib/crisis/types';
import { Avatar, Btn, CK, Eyebrow, Skeleton, ThemeTag, cabinetTint, fieldStyle, waitLabel, waitSeverity } from '../../crisisKit';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import CharacterModal from '../character/CharacterModal';
import { CabinetLogo, StaffPic, Tag } from './directiveParts';
import { KIND_ICON, OUTCOME_STYLE, authorName, buildNames, listDirectiveCoauthors, memberName } from './directiveKit';
import ReplyActionsDialog, { ActionChips, actionsToEffects, type ReplyAction } from './ReplyActions';
import { readReplyDraft, writeReplyDraft } from './replyDraft';

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

// The "+" actions of an unsent reply survive switching between directives (the text itself is saved on this device).
const actionDrafts = new Map<string, ReplyAction[]>();

/** A small tile with an icon, a label and a value (only for the old fields a row still carries). */
function Tile({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="flex items-start" style={{ gap: 8, background: CK.card, borderRadius: 14, padding: '9px 11px', boxShadow: `inset 0 0 0 1px ${CK.hair}`, minWidth: 0 }}>
      <span aria-hidden style={{ color: CK.red, lineHeight: 0, marginTop: 2, flex: 'none' }}>{icon}</span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: CK.muted }}>{label}</span>
        <b style={{ display: 'block', fontSize: 13, marginTop: 1, overflowWrap: 'break-word', color: CK.ink }}>{value}</b>
      </span>
    </div>
  );
}


const PORTRAIT = 92;
const OVERHANG = Math.round(PORTRAIT / 3);

export function DirectiveDetail(props: DirectiveDetailProps) {
  // One fresh state per directive, wherever this is mounted.
  return <DirectiveDetailInner key={props.directive.id} {...props} />;
}

function DirectiveDetailInner({ directive, onClose, onChanged, notesVersion = 0 }: DirectiveDetailProps) {
  const { ref, core, memberId, director, settings, staff } = useCrisis();
  const names = useMemo(() => buildNames(core.cabinets, core.characters, core.members), [core]);
  const d = directive;
  const who = authorName(d, names);
  const cabinet = d.cabinet_id ? names.cabinets.get(d.cabinet_id) : undefined;
  const character = d.author_character_id ? names.characters.get(d.author_character_id) : undefined;
  const backroomerId = character?.owner_member_id ?? null;
  const mine = !!memberId && d.assigned_member_id === memberId;
  const open = d.status === 'queued' || d.status === 'claimed' || d.status === 'clarify';

  // The reply being written: restored from this device, saved as it is typed.
  const [stored] = useState(() => readReplyDraft(ref.id, d.id));
  const [outcome, setOutcome] = useState<DirectiveOutcome | null>(stored?.outcome ?? null);
  const [reply, setReply] = useState(stored?.reply ?? '');
  const [saved, setSaved] = useState(!!stored);
  const [editing, setEditing] = useState(!!stored && d.status === 'answered');
  const [actions, setActionsState] = useState<ReplyAction[]>(() => actionDrafts.get(d.id) ?? []);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [busy, setBusy] = useState<'send' | 'claim' | 'assign' | 'note' | null>(null);
  const [handTo, setHandTo] = useState('');
  const sent = useRef(false);
  const firstRun = useRef(true);

  const setActions = (next: ReplyAction[]) => { setActionsState(next); if (next.length) actionDrafts.set(d.id, next); else actionDrafts.delete(d.id); };

  // Autosave, a moment after the last keystroke.
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    const t = window.setTimeout(() => {
      if (sent.current) return;
      const untouched = d.status === 'answered' && reply === (d.reply ?? '') && outcome === d.outcome;
      if (untouched) return;
      setSaved(writeReplyDraft(ref.id, d.id, { outcome, reply }));
    }, 600);
    return () => window.clearTimeout(t);
  }, [outcome, reply, ref.id, d.id, d.status, d.reply, d.outcome]);

  // Notes
  const [notes, setNotes] = useState<DirectiveNote[] | null>(null);
  const [noteText, setNoteText] = useState('');

  // Joint directives: who signed with the author
  const [coIds, setCoIds] = useState<string[]>([]);

  // Context
  const [goals, setGoals] = useState<string | null | undefined>(undefined);
  const [goalsOpen, setGoalsOpen] = useState(false);
  const [lastHeard, setLastHeard] = useState<string | null | undefined>(undefined);
  const [now, setNow] = useState(() => Date.now());
  const [modalCharacter, setModalCharacter] = useState<string | null>(null);

  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(t); }, []);

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

  // Hand to: other staff only, never yourself (Claim is separate), each with their picture.
  const staffOptions = useMemo(
    () => core.members
      .filter((m) => (m.role === 'director' || m.role === 'assistant_director' || m.role === 'backroomer') && m.id !== memberId)
      .map((m) => ({ value: m.id, label: m.display_name, hint: ROLE_LABEL[m.role], icon: <StaffPic member={m} size={24} /> })),
    [core.members, memberId],
  );

  if (!staff) return null;

  const powers = {
    resources: director || settings.backroomPowers.resources,
    units: director || settings.backroomPowers.units,
    map: director || settings.backroomPowers.map,
  };

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

  // Every staff note is internal; the delegate's own notes come in through the clarification flow.
  const sendNote = async () => {
    const text = noteText.trim();
    if (!text) return;
    setBusy('note');
    try { await addNote(ref, d.id, text, true); setNoteText(''); await loadNotes(); }
    catch (e) { notifyErr(crisisError(e), 'crisis-directive'); }
    finally { setBusy(null); }
  };

  const send = async () => {
    if (!outcome || !reply.trim() || busy) return;
    setBusy('send');
    try {
      const effects = await actionsToEffects(ref, actions);
      await answerDirective(ref, d.id, outcome, reply.trim(), effects);
      sent.current = true;
      writeReplyDraft(ref.id, d.id, null);
      actionDrafts.delete(d.id);
      notifyOk(`Reply sent to ${who}`, 'crisis-directive');
      setEditing(false);
      setSaved(false);
      setActionsState([]);
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
  const hasLegacy = !!(d.resources_used || d.goal || d.affects);
  const waitText = d.status === 'answered' ? `Answered ${waitLabel(d.answered_at, now)} ago` : d.status === 'clarify' ? 'Waiting for the delegate' : `Waiting ${waitLabel(d.waiting_since, now)}`;
  const waitTagColor = d.status === 'queued' || d.status === 'claimed' ? sevColor : CK.inkSoft;
  const hasGoals = !!(goals && goals.trim());

  const portrait = (
    <Avatar name={who} src={character?.picture_url} size={PORTRAIT} color={accent} />
  );
  const closeBtnStyle = { width: 34, height: 34, borderRadius: '50%', border: 0, background: CK.card, boxShadow: CK.shadowSm, color: CK.ink, flex: 'none', cursor: 'pointer' } as const;

  return (
    <div className="flex flex-col" style={{ gap: 12, fontFamily: CK.font }}>
      {onClose && (
        <div className="lg:hidden">
          <Btn tone="ghost" size="sm" icon={<ArrowLeft size={15} strokeWidth={1.5} />} onClick={onClose}>Back to the queue</Btn>
        </div>
      )}

      {/* The character bar: a big portrait overhanging the card, name, title, cabinet, small tags */}
      <div style={{
        position: 'relative', overflow: 'visible', marginTop: OVERHANG + 6, background: CK.redWash, borderRadius: 26,
        border: '1px solid rgba(27,56,40,0.14)', boxShadow: CK.shadow, padding: '14px 16px 14px', minWidth: 0,
      }}>
        <span style={{ position: 'absolute', zIndex: 2, top: -OVERHANG, left: OVERHANG, lineHeight: 0 }}>
          {character ? (
            <button type="button" onClick={() => setModalCharacter(character.id)} aria-label={`Open ${who}`} title={`Open ${who}`}
              className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] transition-transform hover:scale-[1.03]"
              style={{ border: 0, padding: 0, borderRadius: '50%', background: 'transparent', cursor: 'pointer', lineHeight: 0 }}>
              {portrait}
            </button>
          ) : portrait}
        </span>

        <div style={{ minHeight: PORTRAIT - OVERHANG - 6, paddingLeft: OVERHANG + PORTRAIT - 2, paddingRight: onClose ? 40 : 0 }}>
          <h2 style={{ margin: 0, fontSize: 26, fontWeight: 800, lineHeight: 1.1, color: CK.ink, overflowWrap: 'break-word' }}>{who}</h2>
          {character?.title && <p style={{ margin: '4px 0 0', fontSize: 15, fontWeight: 600, lineHeight: 1.3, color: CK.inkSoft, overflowWrap: 'break-word' }}>{character.title}</p>}
          <p className="flex items-center" style={{ margin: '8px 0 0', gap: 8 }}>
            <CabinetLogo cabinet={cabinet} size={30} />
            <span style={{ fontSize: 15, fontWeight: 800, color: accent, overflowWrap: 'break-word', minWidth: 0 }}>{cabinet?.name ?? 'No cabinet'}</span>
          </p>
        </div>

        {onClose && (
          <button onClick={onClose} aria-label="Close" className="hidden lg:grid place-items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
            style={{ ...closeBtnStyle, position: 'absolute', top: 10, right: 12 }}>
            <X size={17} strokeWidth={1.5} />
          </button>
        )}

        <div className="flex flex-wrap items-center" style={{ gap: '6px 8px', marginTop: 12 }}>
          <Tag icon={<Clock size={13} strokeWidth={1.6} />} color={waitTagColor}>{waitText}</Tag>
          <Tag icon={<MessageCircle size={13} strokeWidth={1.6} />}>
            {lastHeard === undefined ? 'Last heard back: loading' : lastHeard ? `Last heard back ${waitLabel(lastHeard, now)} ago` : 'Not heard back yet'}
          </Tag>
          <Tag icon={<FileText size={13} strokeWidth={1.6} />}>{d.word_count} words</Tag>
          <Tag icon={<StaffPic member={backroomerId ? names.members.get(backroomerId) : null} size={18} />} title="Their backroomer">
            <span style={{ color: CK.muted, fontWeight: 600 }}>Backroomer </span>{memberName(backroomerId, names, 'nobody yet')}
          </Tag>
          {hasGoals && (
            <button type="button" onClick={() => setGoalsOpen((v) => !v)} aria-expanded={goalsOpen}
              className="inline-flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
              style={{ gap: 5, border: 0, cursor: 'pointer', fontFamily: CK.font, fontSize: 12, fontWeight: 700, color: CK.goldDeep, background: cabinetTint(CK.gold, 0.45), borderRadius: 9, padding: '3px 9px', boxShadow: `inset 0 0 0 1px ${cabinetTint(CK.goldDeep, 0.25)}` }}>
              <Lock size={12} strokeWidth={1.6} aria-hidden />Goals
              <ChevronDown size={13} strokeWidth={1.8} aria-hidden style={{ transform: goalsOpen ? 'rotate(180deg)' : 'none', transition: 'transform 160ms' }} />
            </button>
          )}
        </div>

        {hasGoals && goalsOpen && (
          <div style={{ marginTop: 10, background: `linear-gradient(180deg, ${cabinetTint(CK.gold, 0.5)}, ${cabinetTint(CK.gold, 0.26)})`, borderRadius: 14, padding: '10px 13px', boxShadow: `inset 0 0 0 1px ${cabinetTint(CK.goldDeep, 0.25)}` }}>
            <span style={{ display: 'block', fontSize: 11.5, fontWeight: 800, color: CK.goldDeep }}>Secret goals, only staff see this</span>
            <b style={{ display: 'block', fontSize: 13.5, marginTop: 3, fontWeight: 600, lineHeight: 1.5, whiteSpace: 'pre-wrap', overflowWrap: 'break-word', color: CK.ink }}>{goals}</b>
          </div>
        )}

        {d.kind === 'joint' && coChars.length > 0 && (
          <div className="flex items-center flex-wrap" style={{ gap: '6px 12px', marginTop: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: CK.inkSoft }}>With</span>
            {coChars.map((c) => {
              const cc = c.cabinet_id ? names.cabinets.get(c.cabinet_id) : undefined;
              return (
                <button key={c.id} type="button" onClick={() => setModalCharacter(c.id)} title={`Open ${c.name}`}
                  className="inline-flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
                  style={{ gap: 6, border: 0, background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: CK.font, fontSize: 12.5, fontWeight: 700, color: CK.ink, textAlign: 'left' }}>
                  <Avatar name={c.name} src={c.picture_url} size={28} color={cc?.color ?? CK.red} />
                  <span style={{ overflowWrap: 'break-word' }}>{c.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* The directive itself */}
      <div>
        <div className="flex items-center" style={{ gap: 6 }}>
          <span aria-hidden style={{ color: CK.red, lineHeight: 0 }}><KindIcon size={15} strokeWidth={1.5} /></span>
          <Eyebrow>{`${KIND_LABEL[d.kind].toUpperCase()} · NO. ${dirNumber(d)}`}</Eyebrow>
        </div>
        <h3 style={{ margin: '3px 0 0', fontSize: 20, fontWeight: 800, lineHeight: 1.25, color: CK.ink, overflowWrap: 'break-word' }}>{d.title}</h3>
      </div>

      <div className="flex items-center flex-wrap" style={{ gap: '6px 8px' }}>
        <span className="inline-flex items-center" style={{ gap: 5, fontSize: 13, fontWeight: 700, color: CK.ink, background: CK.card, borderRadius: 10, padding: '4px 10px', boxShadow: `inset 0 0 0 1px ${CK.hair}`, overflowWrap: 'break-word' }}>
          <ArrowRight size={14} strokeWidth={1.5} aria-hidden style={{ color: CK.red, flex: 'none' }} />
          <span style={{ color: CK.muted, fontWeight: 600 }}>To</span> {d.receiver}
        </span>
        {d.themes.map((t) => <ThemeTag key={t} theme={t} size="md" />)}
        {d.kind === 'committee' && cabinet && (
          <span className="inline-flex items-center" style={{ gap: 5, fontSize: 12.5, fontWeight: 700, color: cabinet.color }}>
            <Landmark size={14} strokeWidth={1.5} aria-hidden />On behalf of {cabinet.name}
          </span>
        )}
        {d.covert && (
          <span className="inline-flex items-center" style={{ gap: 4, fontSize: 12.5, fontWeight: 700, color: CK.redDeep, background: cabinetTint(CK.redDeep, 0.08), borderRadius: 8, padding: '3px 9px' }}>
            <VenetianMask size={14} strokeWidth={1.6} aria-hidden />Covert
          </span>
        )}
      </div>
      {hasLegacy && (
        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          {d.resources_used && <Tile icon={<Package size={16} strokeWidth={1.5} />} label="Resources used" value={d.resources_used} />}
          {d.affects && <Tile icon={<Zap size={16} strokeWidth={1.5} />} label="Affects" value={d.affects} />}
          {d.goal && <Tile icon={<Target size={16} strokeWidth={1.5} />} label="Goal" value={d.goal} />}
        </div>
      )}

      <div style={{ background: CK.card, borderRadius: 16, padding: '13px 15px', lineHeight: 1.6, fontSize: 14.5, boxShadow: `inset 4px 0 0 ${accent}, ${CK.shadowSm}`, whiteSpace: 'pre-wrap', overflowWrap: 'break-word' }}>
        {d.body}
      </div>

      {/* Thread */}
      <div>
        <h3 className="flex items-center" style={{ margin: '0 0 8px', gap: 6, fontSize: 14, fontWeight: 800, color: CK.ink }}>
          <MessageSquare size={16} strokeWidth={1.5} aria-hidden style={{ color: CK.red }} />Notes
        </h3>
        <div className="flex flex-col" style={{ gap: 8 }}>
          {notes === null && <Skeleton h={34} r={14} />}
          {notes?.length === 0 && <p style={{ margin: 0, fontSize: 13, color: CK.muted }}>No notes yet</p>}
          {notes?.map((n) => {
            const fromAuthor = !n.internal && !!n.member_id && n.member_id === d.author_member_id;
            const author = n.member_id ? names.members.get(n.member_id) : undefined;
            return (
              <div key={n.id} style={{
                alignSelf: fromAuthor ? 'flex-start' : 'flex-end', maxWidth: '92%', minWidth: 'min(200px, 100%)', padding: '8px 12px',
                borderRadius: fromAuthor ? '4px 16px 16px 16px' : '16px 4px 16px 16px',
                background: fromAuthor ? CK.card : n.internal ? cabinetTint(CK.gold, 0.34) : cabinetTint(CK.forest, 0.1),
                boxShadow: fromAuthor ? CK.shadowSm : 'none',
              }}>
                <p className="flex items-center flex-wrap" style={{ margin: 0, gap: '2px 6px', fontSize: 11.5, fontWeight: 700, color: CK.inkSoft }}>
                  {fromAuthor
                    ? <Avatar name={who} src={character?.picture_url} size={22} color={accent} />
                    : <StaffPic member={author} size={22} />}
                  <span style={{ color: CK.ink }}>{fromAuthor ? `${who}, the delegate` : memberName(n.member_id, names, 'Staff')}</span>
                  {!fromAuthor && n.internal && <span className="inline-flex items-center" style={{ gap: 3, color: CK.goldDeep }}><Lock size={11} strokeWidth={1.6} aria-hidden />Internal note</span>}
                  {!fromAuthor && !n.internal && <span style={{ fontWeight: 600, color: CK.muted }}>Seen by the delegate</span>}
                  <span title={new Date(n.created_at).toLocaleString()} style={{ fontWeight: 500, color: CK.muted }}>{timeAgo(n.created_at)}</span>
                </p>
                <p style={{ margin: '4px 0 0', fontSize: 13.5, whiteSpace: 'pre-wrap', overflowWrap: 'break-word' }}>{n.body}</p>
              </div>
            );
          })}
        </div>
        <div className="flex flex-col" style={{ gap: 6, marginTop: 10 }}>
          <span className="inline-flex items-center" style={{ gap: 5, fontSize: 12.5, fontWeight: 700, color: CK.goldDeep }}>
            <Lock size={13} strokeWidth={1.5} aria-hidden />Internal note
          </span>
          <textarea
            value={noteText} onChange={(e) => setNoteText(e.target.value)} rows={2} maxLength={4000}
            aria-label="Internal note" placeholder="Only staff see this" style={{ ...fieldStyle, resize: 'vertical' }}
          />
          <div className="flex justify-end">
            <Btn tone="ghost" size="sm" icon={<MessageSquare size={14} strokeWidth={1.5} />} onClick={sendNote} disabled={!noteText.trim() || busy === 'note'}>Add internal note</Btn>
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
          <p style={{ margin: '6px 0 0', fontSize: 14, lineHeight: 1.55, whiteSpace: 'pre-wrap', overflowWrap: 'break-word' }}>{d.reply}</p>
          <p className="flex items-center" style={{ margin: '6px 0 0', gap: 6, fontSize: 12, color: CK.muted }}>
            <StaffPic member={d.answered_by ? names.members.get(d.answered_by) : null} size={18} />By {memberName(d.answered_by, names, 'staff')}
          </p>
          <div style={{ marginTop: 8 }}><Btn tone="ghost" size="sm" onClick={() => { setOutcome(d.outcome); setReply(d.reply ?? ''); setSaved(false); setEditing(true); }}>Answer again</Btn></div>
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
          <div style={{ display: 'grid', gap: 6, gridTemplateColumns: 'repeat(auto-fit, minmax(118px, 1fr))' }} role="radiogroup" aria-label="Outcome">
            {OUTCOMES.map((o) => {
              const on = outcome === o;
              const st = OUTCOME_STYLE[o];
              return (
                <button key={o} role="radio" aria-checked={on} onClick={() => { setOutcome(o); setSaved(false); }}
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

          <div style={{ position: 'relative' }}>
            <textarea value={reply} onChange={(e) => { setReply(e.target.value); setSaved(false); }} rows={5} maxLength={8000}
              aria-label="Reply to the delegate" placeholder={`Reply to ${who}`} style={{ ...fieldStyle, resize: 'vertical', background: CK.page, paddingBottom: 48 }} />
            <button type="button" onClick={() => setActionsOpen(true)}
              className="inline-flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] active:scale-[0.97] transition-transform"
              style={{ position: 'absolute', left: 10, bottom: 10, gap: 6, height: 32, padding: '0 14px 0 10px', borderRadius: 12, border: 0, background: CK.greenBtn, color: '#fff', boxShadow: CK.shadowSm, cursor: 'pointer', fontFamily: CK.font, fontSize: 13, fontWeight: 700 }}>
              <Plus size={16} strokeWidth={1.8} aria-hidden />Add an action
            </button>
            {saved && (
              <span className="inline-flex items-center" aria-live="polite" style={{ position: 'absolute', right: 14, bottom: 14, gap: 4, fontSize: 11.5, fontWeight: 700, color: CK.muted }}>
                <Check size={12} strokeWidth={2} aria-hidden />Draft saved
              </span>
            )}
          </div>
          <ActionChips actions={actions} onRemove={(id) => setActions(actions.filter((a) => a.id !== id))} />
        </div>
      )}

      {/* Actions */}
      {(open || editing) && (
        <div className="flex items-center flex-wrap" style={{ gap: 8, paddingTop: 4 }}>
          {!mine && !!memberId && d.status !== 'clarify' && (
            <Btn tone="ghost" icon={<UserCheck size={15} strokeWidth={1.5} />} onClick={claim} disabled={busy === 'claim'}>Claim</Btn>
          )}
          {staffOptions.length > 0 && (
            <div className="flex items-center" style={{ gap: 6 }}>
              <div style={{ width: 210 }}>
                <GSelect size="sm" value={handTo} onChange={setHandTo} options={staffOptions} placeholder="Choose a person" aria-label="Hand to" />
              </div>
              <Btn tone="ghost" onClick={hand} disabled={!handTo || busy === 'assign'}>Hand to</Btn>
            </div>
          )}
          <span className="flex-1" />
          {showForm && (
            <Btn tone="green" icon={<Send size={15} strokeWidth={1.5} />} onClick={send} disabled={!outcome || !reply.trim() || busy === 'send'}>Send reply</Btn>
          )}
        </div>
      )}

      {actionsOpen && (
        <ReplyActionsDialog
          crisisRef={ref}
          authorCharacterId={d.author_character_id}
          cabinetId={d.cabinet_id ?? character?.cabinet_id ?? null}
          powers={powers}
          actions={actions}
          onChange={setActions}
          onClose={() => setActionsOpen(false)}
        />
      )}
      {modalCharacter && <CharacterModal characterId={modalCharacter} initialTab="directives" onClose={() => setModalCharacter(null)} />}
    </div>
  );
}

export default DirectiveDetail;
