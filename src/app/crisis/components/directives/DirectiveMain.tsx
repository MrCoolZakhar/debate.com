'use client';
// Gavelling Crisis: the main panel of an opened directive (the left side of DirectivePopup).
// Top, fixed: a red band with the kind, the wait and the TITLE (the biggest text, wraps, never cut)
// under the "No. 13" badge that overlaps the pop-up's top edge, then the character: a portrait
// overhanging the band, the name in two rows, their title and cabinet. Middle, scrolls: tags, the
// directive, the notes, the answer and the reply box with the outcome buttons. Bottom, fixed: claim,
// hand to, and Send reply. Staff only: it shows the author's secret goals and internal notes.

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Check, ChevronDown, Clock, FileText, Landmark, Lock, MessageCircle, MessageSquare, Package, Send, Target,
  UserCheck, VenetianMask, X, Zap, ArrowRight, SlidersHorizontal,
} from 'lucide-react';
import GSelect from '@/components/GSelect';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { addNote, assignDirective, crisisError, listNotes, loadSecrets } from '@/lib/crisis/api';
import { getCrisisClient } from '@/lib/crisis/client';
import { dirNumber, timeAgo } from '@/lib/crisis/format';
import {
  KIND_LABEL, OUTCOME_LABEL, ROLE_LABEL,
  type Directive, type DirectiveNote, type DirectiveOutcome,
} from '@/lib/crisis/types';
import { Avatar, Btn, CK, Skeleton, ThemeTag, cabinetTint, fieldStyle, waitLabel } from '../../crisisKit';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import { CabinetLogo, NameStack, NumberBadge, StaffPic, Tag } from './directiveParts';
import { KIND_ICON, OUTCOME_STYLE, authorName, buildNames, listDirectiveCoauthors, memberName } from './directiveKit';
import type { DirectiveReply } from './useDirectiveReply';

const OUTCOMES: DirectiveOutcome[] = ['approved', 'partial', 'denied', 'clarify', 'later'];
const PORTRAIT = 72;
const OVERHANG = Math.round(PORTRAIT / 3);

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

export default function DirectiveMain({ directive: d, reply, notesVersion = 0, onChanged, onClose, effectsButton }: {
  directive: Directive;
  reply: DirectiveReply;
  notesVersion?: number;
  onChanged?: (what: 'claimed' | 'assigned' | 'answered') => void;
  onClose: () => void;
  /** On a narrow screen: the button that goes to the second step (the changes panel). */
  effectsButton?: ReactNode;
}) {
  const { ref, core, memberId } = useCrisis();
  const names = useMemo(() => buildNames(core.cabinets, core.characters, core.members), [core]);
  const who = authorName(d, names);
  const cabinet = d.cabinet_id ? names.cabinets.get(d.cabinet_id) : undefined;
  const character = d.author_character_id ? names.characters.get(d.author_character_id) : undefined;
  const backroomerId = character?.owner_member_id ?? null;
  const mine = !!memberId && d.assigned_member_id === memberId;
  const open = d.status === 'queued' || d.status === 'claimed' || d.status === 'clarify';
  const { outcome, toggleOutcome, reply: text, setReply, saved, editing, startEditing, busy, canSend, send } = reply;

  const [claimBusy, setClaimBusy] = useState<'claim' | 'assign' | 'note' | null>(null);
  const [handTo, setHandTo] = useState('');
  const [notes, setNotes] = useState<DirectiveNote[] | null>(null);
  const [noteText, setNoteText] = useState('');
  const [coIds, setCoIds] = useState<string[]>([]);
  const [goals, setGoals] = useState<string | null | undefined>(undefined);
  const [goalsOpen, setGoalsOpen] = useState(false);
  const [lastHeard, setLastHeard] = useState<string | null | undefined>(undefined);
  const [now, setNow] = useState(() => Date.now());

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

  const claim = async () => {
    setClaimBusy('claim');
    try { await assignDirective(ref, d.id); notifyOk('Directive is yours', 'crisis-directive'); onChanged?.('claimed'); }
    catch (e) { notifyErr(crisisError(e), 'crisis-directive'); }
    finally { setClaimBusy(null); }
  };
  const hand = async () => {
    if (!handTo) return;
    setClaimBusy('assign');
    try { await assignDirective(ref, d.id, handTo); notifyOk(`Handed to ${memberName(handTo, names)}`, 'crisis-directive'); setHandTo(''); onChanged?.('assigned'); }
    catch (e) { notifyErr(crisisError(e), 'crisis-directive'); }
    finally { setClaimBusy(null); }
  };
  // Every staff note is internal; the delegate's own notes come in through the clarification flow.
  const sendNote = async () => {
    const body = noteText.trim();
    if (!body) return;
    setClaimBusy('note');
    try { await addNote(ref, d.id, body, true); setNoteText(''); await loadNotes(); }
    catch (e) { notifyErr(crisisError(e), 'crisis-directive'); }
    finally { setClaimBusy(null); }
  };

  const showForm = d.status !== 'answered' || editing;
  const KindIcon = KIND_ICON[d.kind];
  const accent = cabinet?.color ?? CK.red;
  const coChars = coIds.map((id) => names.characters.get(id)).filter((c): c is NonNullable<typeof c> => !!c);
  const answeredStyle = d.outcome ? OUTCOME_STYLE[d.outcome] : null;
  const hasLegacy = !!(d.resources_used || d.goal || d.affects);
  const waitText = d.status === 'answered' ? `Answered ${waitLabel(d.answered_at, now)} ago` : d.status === 'clarify' ? 'Waiting for the delegate' : `Waiting ${waitLabel(d.waiting_since, now)}`;
  const hasGoals = !!(goals && goals.trim());
  const closeStyle = {
    width: 32, height: 32, borderRadius: '50%', border: 0, background: 'rgba(255,244,230,0.18)', color: '#FFF4E6', flex: 'none', cursor: 'pointer',
  } as const;

  return (
    <>
      {/* Top, fixed */}
      <div style={{ flex: 'none', position: 'relative' }}>
        <div style={{ position: 'absolute', zIndex: 3, top: 'var(--dp-badge-top)', left: 22 }}><NumberBadge n={dirNumber(d)} /></div>
        <div style={{ background: CK.redGrad, color: '#FFF4E6', padding: 'var(--dp-pt) 18px 16px 22px', borderRadius: 'var(--dp-r) var(--dp-r) 0 0' }}>
          <div className="flex items-center justify-between" style={{ gap: 10 }}>
            <p className="inline-flex items-center flex-wrap" style={{ margin: 0, gap: '2px 12px', fontSize: 12.5, fontWeight: 700, color: 'rgba(255,232,214,0.88)' }}>
              <span className="inline-flex items-center" style={{ gap: 6 }}><KindIcon size={15} strokeWidth={1.5} aria-hidden />{KIND_LABEL[d.kind]}</span>
              <span className="inline-flex items-center" style={{ gap: 5 }}><Clock size={13} strokeWidth={1.6} aria-hidden />{waitText}</span>
            </p>
            <button type="button" onClick={onClose} aria-label="Close" title="Close" className="grid place-items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-white" style={closeStyle}>
              <X size={17} strokeWidth={1.6} />
            </button>
          </div>
          <h2 style={{ margin: '6px 0 0', fontSize: 26, lineHeight: 1.18, fontWeight: 800, overflowWrap: 'anywhere' }}>{d.title}</h2>
        </div>
        <div className="flex" style={{ gap: 14, padding: '0 22px 12px', background: CK.card, boxShadow: `0 1px 0 ${CK.hair}` }}>
          <span style={{ flex: 'none', marginTop: -OVERHANG, lineHeight: 0 }}>
            <Avatar name={who} src={character?.picture_url} size={PORTRAIT} color={accent} style={{ boxShadow: '0 4px 12px rgba(27,56,40,0.25)' }} />
          </span>
          <div className="flex flex-col" style={{ paddingTop: 8, minWidth: 0, flex: 1, gap: 4 }}>
            <NameStack name={who} align="left" big={19} small={12.5} width={220} />
            {character?.title && <p style={{ margin: 0, fontSize: 13, fontWeight: 600, lineHeight: 1.3, color: CK.inkSoft, overflowWrap: 'anywhere' }}>{character.title}</p>}
            <p className="flex items-center" style={{ margin: 0, gap: 7 }}>
              <CabinetLogo cabinet={cabinet} size={24} />
              <span style={{ fontSize: 13.5, fontWeight: 800, color: accent, overflowWrap: 'anywhere', minWidth: 0 }}>{cabinet?.name ?? 'No cabinet'}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Middle, scrolls */}
      <div className="flex flex-col" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px 22px 18px', gap: 12 }}>
        <div className="flex flex-wrap items-center" style={{ gap: '6px 8px' }}>
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
          <div style={{ background: `linear-gradient(180deg, ${cabinetTint(CK.gold, 0.5)}, ${cabinetTint(CK.gold, 0.26)})`, borderRadius: 14, padding: '10px 13px', boxShadow: `inset 0 0 0 1px ${cabinetTint(CK.goldDeep, 0.25)}` }}>
            <span style={{ display: 'block', fontSize: 11.5, fontWeight: 800, color: CK.goldDeep }}>Secret goals, only staff see this</span>
            <b style={{ display: 'block', fontSize: 13.5, marginTop: 3, fontWeight: 600, lineHeight: 1.5, whiteSpace: 'pre-wrap', overflowWrap: 'break-word', color: CK.ink }}>{goals}</b>
          </div>
        )}
        {d.kind === 'joint' && coChars.length > 0 && (
          <div className="flex items-center flex-wrap" style={{ gap: '6px 12px' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: CK.inkSoft }}>With</span>
            {coChars.map((c) => {
              const cc = c.cabinet_id ? names.cabinets.get(c.cabinet_id) : undefined;
              return (
                <span key={c.id} className="inline-flex items-center" style={{ gap: 6, fontSize: 12.5, fontWeight: 700, color: CK.ink }}>
                  <Avatar name={c.name} src={c.picture_url} size={28} color={cc?.color ?? CK.red} />
                  <span style={{ overflowWrap: 'break-word' }}>{c.name}</span>
                </span>
              );
            })}
          </div>
        )}

        <div className="flex items-center flex-wrap" style={{ gap: '6px 8px' }}>
          {d.receiver && d.receiver.trim() && (
            <span className="inline-flex items-center" style={{ gap: 5, fontSize: 13, fontWeight: 700, color: CK.ink, background: CK.card, borderRadius: 10, padding: '4px 10px', boxShadow: `inset 0 0 0 1px ${CK.hair}`, overflowWrap: 'break-word' }}>
              <ArrowRight size={14} strokeWidth={1.5} aria-hidden style={{ color: CK.red, flex: 'none' }} />
              <span style={{ color: CK.muted, fontWeight: 600 }}>To</span> {d.receiver}
            </span>
          )}
          {d.themes.map((t) => <ThemeTag key={t} theme={t} size="md" />)}
          {d.kind === 'committee' && cabinet && (
            <span className="inline-flex items-center" style={{ gap: 5, fontSize: 12.5, fontWeight: 700, color: cabinet.color }}>
              <Landmark size={14} strokeWidth={1.5} aria-hidden />On behalf of {cabinet.name}
            </span>
          )}
          {d.covert && !d.themes.some((t) => t.toLowerCase() === 'covert') && (
            <span className="inline-flex items-center" style={{ gap: 4, fontSize: 12.5, fontWeight: 700, color: CK.redDeep, background: cabinetTint(CK.redDeep, 0.08), borderRadius: 8, padding: '3px 9px' }}>
              <VenetianMask size={14} strokeWidth={1.6} aria-hidden />Covert
            </span>
          )}
        </div>
        {hasLegacy && (
          <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            {d.resources_used && <Tile icon={<Package size={16} strokeWidth={1.5} />} label="Resources used" value={d.resources_used} />}
            {d.affects && <Tile icon={<Zap size={16} strokeWidth={1.5} />} label="Affects" value={d.affects} />}
            {d.goal && <Tile icon={<Target size={16} strokeWidth={1.5} />} label="Goal" value={d.goal} />}
          </div>
        )}

        <div style={{ background: CK.card, borderRadius: 16, padding: '13px 15px', lineHeight: 1.6, fontSize: 14.5, boxShadow: `inset 4px 0 0 ${accent}, ${CK.shadowSm}`, whiteSpace: 'pre-wrap', overflowWrap: 'break-word' }}>
          {d.body}
        </div>

        {/* Notes */}
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
            <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} rows={2} maxLength={4000}
              aria-label="Internal note" placeholder="Only staff see this" style={{ ...fieldStyle, resize: 'vertical' }} />
            <div className="flex justify-end">
              <Btn tone="ghost" size="sm" icon={<MessageSquare size={14} strokeWidth={1.5} />} onClick={sendNote} disabled={!noteText.trim() || claimBusy === 'note'}>Add internal note</Btn>
            </div>
          </div>
        </div>

        {/* The answer that was sent */}
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
            <div style={{ marginTop: 8 }}><Btn tone="ghost" size="sm" onClick={startEditing}>Answer again</Btn></div>
          </div>
        )}

        {/* Your answer */}
        {showForm && (
          <div className="flex flex-col" style={{ gap: 12, background: CK.card, borderRadius: 20, padding: '14px 15px', boxShadow: CK.shadow }}>
            <h3 className="flex items-center" style={{ margin: 0, gap: 6, fontSize: 15, fontWeight: 800, color: CK.ink }}>
              <Send size={16} strokeWidth={1.5} aria-hidden style={{ color: CK.red }} />Your Answer
            </h3>
            {d.status === 'clarify' && d.reply && (
              <p style={{ margin: 0, fontSize: 12.5, color: CK.inkSoft }}>You asked for more detail: <i>{d.reply}</i></p>
            )}
            <div style={{ display: 'grid', gap: 6, gridTemplateColumns: 'repeat(auto-fit, minmax(104px, 1fr))' }} role="group" aria-label="Outcome">
              {OUTCOMES.map((o) => {
                const on = outcome === o;
                const st = OUTCOME_STYLE[o];
                return (
                  <button key={o} type="button" aria-pressed={on} onClick={() => toggleOutcome(o)} title={on ? 'Click again to clear' : undefined}
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
              <textarea value={text} onChange={(e) => setReply(e.target.value)} rows={5} maxLength={8000}
                aria-label="Reply to the delegate" placeholder={`Reply to ${who}`} style={{ ...fieldStyle, resize: 'vertical', background: CK.page, paddingBottom: 30 }} />
              {saved && (
                <span className="inline-flex items-center" aria-live="polite" style={{ position: 'absolute', right: 14, bottom: 10, gap: 4, fontSize: 11.5, fontWeight: 700, color: CK.muted }}>
                  <Check size={12} strokeWidth={2} aria-hidden />Draft saved
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom, fixed */}
      {(open || editing) && (
        <div className="flex items-center flex-wrap" style={{ flex: 'none', gap: 8, padding: '10px 18px 12px 22px', background: CK.card, boxShadow: `0 -1px 0 ${CK.hair}`, borderRadius: '0 0 var(--dp-r) var(--dp-r)' }}>
          {!mine && !!memberId && d.status !== 'clarify' && (
            <Btn tone="ghost" icon={<UserCheck size={15} strokeWidth={1.5} />} onClick={claim} disabled={claimBusy === 'claim'}>Claim</Btn>
          )}
          {staffOptions.length > 0 && (
            <div className="flex items-center" style={{ gap: 6 }}>
              <div style={{ width: 190 }}>
                <GSelect size="sm" value={handTo} onChange={setHandTo} options={staffOptions} placeholder="Choose a person" aria-label="Hand to" />
              </div>
              <Btn tone="ghost" onClick={hand} disabled={!handTo || claimBusy === 'assign'}>Hand to</Btn>
            </div>
          )}
          <span className="flex-1" />
          {effectsButton}
          {showForm && (
            <Btn tone="green" icon={<Send size={15} strokeWidth={1.5} />} onClick={send} disabled={!canSend}>{busy ? 'Sending' : 'Send reply'}</Btn>
          )}
        </div>
      )}
    </>
  );
}

/** The button that opens the changes panel on a narrow screen. */
export function EffectsStepButton({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <Btn tone="ghost" icon={<SlidersHorizontal size={15} strokeWidth={1.5} />} onClick={onClick}>
      {count > 0 ? `Changes (${count})` : 'Changes'}
    </Btn>
  );
}
