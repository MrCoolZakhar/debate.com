'use client';
// Gavelling Crisis: the facts of an opened directive, in the white band beside the character at the top of the
// pop-up (their own grid, then who is responsible in a column of its own on the same row), as a tidy grid of small labelled cells: how long it has waited (or when it was answered), when the author
// last heard back, the length in words, who it is for, the themes, the secret goals (staff only), and who is
// responsible with a picture and a compact picker to hand it to another backroomer. While someone is writing the
// reply it says so, and handing the directive to somebody else then asks first, in place.
// Handing over is the one thing here that writes at once (it is who the directive is with, not part of the reply);
// the reply itself, with its outcome and every change, goes out only on Send reply.

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ChevronDown, Clock, FileText, Lock, MessageCircle, Pencil, Send, UserRound, VenetianMask } from 'lucide-react';
import GSelect from '@/components/GSelect';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { assignDirective, crisisError, loadSecrets } from '@/lib/crisis/api';
import { getCrisisClient } from '@/lib/crisis/client';
import { ROLE_LABEL, type Directive } from '@/lib/crisis/types';
import { Btn, CK, ThemeTag, agoLabel, cabinetTint, waitLabel, waitSeverity } from '../../crisisKit';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import { StaffPic } from './directiveParts';
import { isBeingWritten, memberName, type Names } from './directiveKit';
import { useNow } from './useNow';

const SEV_COLOR = { ok: CK.ink, late: CK.goldDeep, very: CK.danger } as const;

/** One cell of the grid: a small label over its value. */
function Fact({ icon, label, children, span }: { icon: ReactNode; label: string; children: ReactNode; span?: number }) {
  return (
    <div style={{ minWidth: 0, gridColumn: span ? `span ${span}` : undefined }}>
      <p className="flex items-center" style={{ margin: 0, gap: 5, fontSize: 11.5, fontWeight: 700, color: CK.muted }}>
        <span aria-hidden style={{ lineHeight: 0, color: CK.red, flex: 'none' }}>{icon}</span>{label}
      </p>
      <div style={{ marginTop: 2, fontSize: 13.5, fontWeight: 800, color: CK.ink, lineHeight: 1.3, overflowWrap: 'anywhere' }}>{children}</div>
    </div>
  );
}

export default function DirectiveFacts({ d, names, editing, onChanged }: {
  d: Directive;
  names: Names;
  /** An answered directive being answered again counts as open for handing over. */
  editing: boolean;
  onChanged?: (what: 'claimed' | 'assigned' | 'answered') => void;
}) {
  const { ref, core, memberId } = useCrisis();
  const character = d.author_character_id ? names.characters.get(d.author_character_id) : undefined;
  const ownerId = character?.owner_member_id ?? null;

  const [goals, setGoals] = useState<string | null>(null);
  const [goalsOpen, setGoalsOpen] = useState(false);
  const [lastHeard, setLastHeard] = useState<string | null | undefined>(undefined);
  const now = useNow();
  const [handing, setHanding] = useState(false);
  /** A hand-over waiting for "Move it anyway?" because somebody is writing the reply. */
  const [confirmTo, setConfirmTo] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!d.author_character_id) return;
    loadSecrets(ref).then((rows) => {
      if (!cancelled) setGoals(rows.find((r) => r.character_id === d.author_character_id)?.goals ?? null);
    }).catch(() => { if (!cancelled) setGoals(null); });
    return () => { cancelled = true; };
  }, [ref, d.author_character_id]);

  useEffect(() => {
    let cancelled = false;
    if (!d.author_member_id) return;
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

  const hasGoals = !!(d.author_character_id && goals && goals.trim());
  const open = d.status === 'queued' || d.status === 'claimed' || d.status === 'clarify' || editing;

  const answered = d.status === 'answered';
  const waitLabelText = answered ? 'Answered' : d.status === 'clarify' ? 'Status' : 'Waiting since';
  const waitValue = answered ? agoLabel(d.answered_at, now) : d.status === 'clarify' ? 'Waiting for the delegate' : waitLabel(d.waiting_since, now);
  const sev = d.status === 'queued' || d.status === 'claimed' ? waitSeverity(d.waiting_since, now) : 'ok';
  const heard = lastHeard === undefined ? 'Loading' : lastHeard ? agoLabel(lastHeard, now) : 'Not heard back yet';
  const covertShown = d.covert && !d.themes.some((t) => t.toLowerCase() === 'covert');

  const staffOptions = useMemo(
    () => core.members
      .filter((m) => m.role === 'director' || m.role === 'assistant_director' || m.role === 'backroomer')
      .map((m) => ({ value: m.id, label: m.id === memberId ? `${m.display_name} (you)` : m.display_name, hint: ROLE_LABEL[m.role], icon: <StaffPic member={m} size={24} /> })),
    [core.members, memberId],
  );

  // Somebody else is writing the reply right now.
  const writer = isBeingWritten(d, now) && d.drafting_member && d.drafting_member !== memberId ? d.drafting_member : null;

  const doHand = async (to: string) => {
    if (!to || handing) return;
    setHanding(true);
    setConfirmTo(null);
    try {
      if (to === memberId) { await assignDirective(ref, d.id); notifyOk('Directive is yours', 'crisis-directive'); onChanged?.('claimed'); }
      else { await assignDirective(ref, d.id, to); notifyOk(`Handed to ${memberName(to, names)}`, 'crisis-directive'); onChanged?.('assigned'); }
    } catch (e) { notifyErr(crisisError(e), 'crisis-directive'); }
    finally { setHanding(false); }
  };
  const hand = (to: string) => {
    if (!to || to === d.assigned_member_id) return;
    if (writer && to !== writer) { setConfirmTo(to); return; }
    void doHand(to);
  };

  return (
    // Three pieces that sit in the pop-up's white band beside the character, on ONE row when there is room (owner,
    // 30 Oct 2026): the small facts in a grid, then who is responsible in its own column, then the secret goals full width.
    <>
    <div className="dp-facts" style={{ flex: '1 1 250px', display: 'grid', gap: '8px 14px', gridTemplateColumns: 'repeat(auto-fill, minmax(104px, 1fr))', alignContent: 'start', minWidth: 0, paddingTop: 12 }}>
      <Fact icon={<Clock size={13} strokeWidth={1.6} />} label={waitLabelText}><span style={{ color: SEV_COLOR[sev] }}>{waitValue}</span></Fact>
      {d.author_member_id && <Fact icon={<MessageCircle size={13} strokeWidth={1.6} />} label="Last heard back">{heard}</Fact>}
      <Fact icon={<FileText size={13} strokeWidth={1.6} />} label="Length">{d.word_count} words</Fact>
      {d.receiver && d.receiver.trim() && <Fact icon={<Send size={13} strokeWidth={1.6} />} label="To">{d.receiver}</Fact>}
      {(d.themes.length > 0 || covertShown) && (
        <Fact icon={<VenetianMask size={13} strokeWidth={1.6} />} label={covertShown && d.themes.length === 0 ? 'Covert' : 'Themes'} span={d.themes.length + (covertShown ? 1 : 0) > 2 ? 2 : undefined}>
          <span className="flex flex-wrap" style={{ gap: 5 }}>
            {d.themes.map((t) => <ThemeTag key={t} theme={t} size="md" />)}
            {covertShown && <span style={{ fontSize: 12, fontWeight: 800, color: CK.redDeep, background: cabinetTint(CK.redDeep, 0.08), borderRadius: 8, padding: '2px 9px' }}>Covert</span>}
          </span>
        </Fact>
      )}
      {hasGoals && (
        <Fact icon={<Lock size={13} strokeWidth={1.6} />} label="Secret goals">
          <button type="button" onClick={() => setGoalsOpen((v) => !v)} aria-expanded={goalsOpen}
            className="inline-flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
            style={{ gap: 5, border: 0, cursor: 'pointer', fontFamily: CK.font, fontSize: 12.5, fontWeight: 700, color: CK.goldDeep, background: cabinetTint(CK.gold, 0.45), borderRadius: 9, padding: '3px 9px', boxShadow: `inset 0 0 0 1px ${cabinetTint(CK.goldDeep, 0.25)}` }}>
            {goalsOpen ? 'Hide' : 'Show'}
            <ChevronDown size={13} strokeWidth={1.8} aria-hidden style={{ transform: goalsOpen ? 'rotate(180deg)' : 'none', transition: 'transform 160ms' }} />
          </button>
        </Fact>
      )}

    </div>
    <div className="dp-resp flex flex-col" style={{ flex: '0 1 215px', gap: 8, minWidth: 180, paddingTop: 12 }}>
      <Fact icon={<UserRound size={13} strokeWidth={1.6} />} label="Responsible">
        {confirmTo ? (
          <div className="flex flex-col" role="alertdialog" aria-label="Move it anyway?" style={{ gap: 6 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: CK.goldDeep, lineHeight: 1.35 }}>
              {memberName(writer, names)} is writing a reply. Move it anyway?
            </p>
            <div className="flex flex-wrap" style={{ gap: 6 }}>
              <Btn tone="green" size="sm" onClick={() => { void doHand(confirmTo); }}>Move it</Btn>
              <Btn tone="ghost" size="sm" onClick={() => setConfirmTo(null)}>Keep it</Btn>
            </div>
          </div>
        ) : open && staffOptions.length > 0 ? (
          <GSelect size="sm" value={d.assigned_member_id ?? ''} onChange={(v) => hand(v)} options={staffOptions}
            placeholder="Unclaimed, choose a person" aria-label="Responsible" disabled={handing} />
        ) : (
          <span className="inline-flex items-center" style={{ gap: 7 }}>
            <StaffPic member={d.assigned_member_id ? names.members.get(d.assigned_member_id) : null} size={24} />
            {memberName(d.assigned_member_id, names, 'Unclaimed')}
          </span>
        )}
        {!confirmTo && ownerId && ownerId !== d.assigned_member_id && (
          <span className="inline-flex items-center" title="The backroomer for this character" style={{ gap: 6, marginTop: 4, fontSize: 12, fontWeight: 600, color: CK.inkSoft }}>
            <StaffPic member={names.members.get(ownerId)} size={18} />
            Usually {memberName(ownerId, names)}
          </span>
        )}
      </Fact>
      {writer && !confirmTo && (
        <Fact icon={<Pencil size={13} strokeWidth={1.6} />} label="Being written">
          <span className="inline-flex items-center" style={{ gap: 7, color: CK.goldDeep }}>
            <StaffPic member={names.members.get(writer)} size={22} />
            {memberName(writer, names)} is writing a reply
          </span>
        </Fact>
      )}

    </div>
      {hasGoals && goalsOpen && (
        <div style={{ flex: '1 1 100%', maxHeight: 120, overflowY: 'auto', background: `linear-gradient(180deg, ${cabinetTint(CK.gold, 0.5)}, ${cabinetTint(CK.gold, 0.26)})`, borderRadius: 14, padding: '9px 12px', boxShadow: `inset 0 0 0 1px ${cabinetTint(CK.goldDeep, 0.25)}` }}>
          <span style={{ display: 'block', fontSize: 11.5, fontWeight: 800, color: CK.goldDeep }}>Secret goals, only staff see this</span>
          <b style={{ display: 'block', fontSize: 13.5, marginTop: 3, fontWeight: 600, lineHeight: 1.5, whiteSpace: 'pre-wrap', overflowWrap: 'break-word', color: CK.ink }}>{goals}</b>
        </div>
      )}
    </>
  );
}
