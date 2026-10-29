'use client';
// Gavelling Crisis: the facts of an opened directive, pinned at the TOP of the pop-up (outside the
// conversation): how long it has waited (or when it was answered), when the author last heard back,
// the length in words, the secret goals (staff only), the themes, who it is for, and who is
// responsible with a picture and a compact picker to hand it to another backroomer.
// Handing over is the one thing here that writes at once (it is who the directive is with, not part
// of the reply); the reply itself, with its outcome and every change, goes out only on Send reply.

import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ChevronDown, Clock, FileText, Landmark, Lock, MessageCircle, VenetianMask } from 'lucide-react';
import GSelect from '@/components/GSelect';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { assignDirective, crisisError, loadSecrets } from '@/lib/crisis/api';
import { getCrisisClient } from '@/lib/crisis/client';
import { ROLE_LABEL, type Directive } from '@/lib/crisis/types';
import { CK, ThemeTag, cabinetTint, waitLabel, waitSeverity } from '../../crisisKit';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import { StaffPic, Tag } from './directiveParts';
import { memberName, type Names } from './directiveKit';

const SEV_COLOR = { ok: CK.inkSoft, late: CK.goldDeep, very: CK.danger } as const;

export default function DirectiveFacts({ d, names, editing, onChanged }: {
  d: Directive;
  names: Names;
  /** An answered directive being answered again counts as open for handing over. */
  editing: boolean;
  onChanged?: (what: 'claimed' | 'assigned' | 'answered') => void;
}) {
  const { ref, core, memberId } = useCrisis();
  const cabinet = d.cabinet_id ? names.cabinets.get(d.cabinet_id) : undefined;
  const character = d.author_character_id ? names.characters.get(d.author_character_id) : undefined;
  const ownerId = character?.owner_member_id ?? null;

  const [goals, setGoals] = useState<string | null>(null);
  const [goalsOpen, setGoalsOpen] = useState(false);
  const [lastHeard, setLastHeard] = useState<string | null | undefined>(undefined);
  const [now, setNow] = useState(() => Date.now());
  const [handing, setHanding] = useState(false);

  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(t); }, []);

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

  const wait = d.status === 'answered' ? `Answered ${waitLabel(d.answered_at, now)} ago`
    : d.status === 'clarify' ? 'Waiting for the delegate' : `Waiting since ${waitLabel(d.waiting_since, now)}`;
  const sev = d.status === 'queued' || d.status === 'claimed' ? waitSeverity(d.waiting_since, now) : 'ok';
  const heard = !d.author_member_id ? null
    : lastHeard === undefined ? 'Last heard back: loading'
    : lastHeard ? `Last heard back ${waitLabel(lastHeard, now)} ago` : 'Not heard back yet';

  const staffOptions = useMemo(
    () => core.members
      .filter((m) => m.role === 'director' || m.role === 'assistant_director' || m.role === 'backroomer')
      .map((m) => ({ value: m.id, label: m.id === memberId ? `${m.display_name} (you)` : m.display_name, hint: ROLE_LABEL[m.role], icon: <StaffPic member={m} size={24} /> })),
    [core.members, memberId],
  );

  const hand = async (to: string) => {
    if (!to || handing) return;
    setHanding(true);
    try {
      if (to === memberId) { await assignDirective(ref, d.id); notifyOk('Directive is yours', 'crisis-directive'); onChanged?.('claimed'); }
      else { await assignDirective(ref, d.id, to); notifyOk(`Handed to ${memberName(to, names)}`, 'crisis-directive'); onChanged?.('assigned'); }
    } catch (e) { notifyErr(crisisError(e), 'crisis-directive'); }
    finally { setHanding(false); }
  };

  return (
    <div className="flex flex-col" style={{ flex: 'none', gap: 8, padding: '9px 22px 10px', background: CK.surface, boxShadow: `0 1px 0 ${CK.hair}` }}>
      <div className="flex flex-wrap items-center" style={{ gap: '6px 8px' }}>
        <Tag icon={<Clock size={13} strokeWidth={1.6} />} color={SEV_COLOR[sev]}>{wait}</Tag>
        {heard && <Tag icon={<MessageCircle size={13} strokeWidth={1.6} />}>{heard}</Tag>}
        <Tag icon={<FileText size={13} strokeWidth={1.6} />}>{d.word_count} words</Tag>
        {hasGoals && (
          <button type="button" onClick={() => setGoalsOpen((v) => !v)} aria-expanded={goalsOpen}
            className="inline-flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
            style={{ gap: 5, border: 0, cursor: 'pointer', fontFamily: CK.font, fontSize: 12, fontWeight: 700, color: CK.goldDeep, background: cabinetTint(CK.gold, 0.45), borderRadius: 9, padding: '3px 9px', boxShadow: `inset 0 0 0 1px ${cabinetTint(CK.goldDeep, 0.25)}` }}>
            <Lock size={12} strokeWidth={1.6} aria-hidden />Goals
            <ChevronDown size={13} strokeWidth={1.8} aria-hidden style={{ transform: goalsOpen ? 'rotate(180deg)' : 'none', transition: 'transform 160ms' }} />
          </button>
        )}
        {d.themes.map((t) => <ThemeTag key={t} theme={t} size="md" />)}
        {d.covert && !d.themes.some((t) => t.toLowerCase() === 'covert') && (
          <Tag icon={<VenetianMask size={13} strokeWidth={1.6} />} color={CK.redDeep}>Covert</Tag>
        )}
        {d.receiver && d.receiver.trim() && (
          <Tag icon={<ArrowRight size={13} strokeWidth={1.6} />}><span style={{ color: CK.muted, fontWeight: 600 }}>To </span>{d.receiver}</Tag>
        )}
        {d.kind === 'committee' && cabinet && (
          <Tag icon={<Landmark size={13} strokeWidth={1.6} />} color={cabinet.color}>On behalf of {cabinet.name}</Tag>
        )}
      </div>

      {hasGoals && goalsOpen && (
        <div style={{ maxHeight: 130, overflowY: 'auto', background: `linear-gradient(180deg, ${cabinetTint(CK.gold, 0.5)}, ${cabinetTint(CK.gold, 0.26)})`, borderRadius: 14, padding: '9px 12px', boxShadow: `inset 0 0 0 1px ${cabinetTint(CK.goldDeep, 0.25)}` }}>
          <span style={{ display: 'block', fontSize: 11.5, fontWeight: 800, color: CK.goldDeep }}>Secret goals, only staff see this</span>
          <b style={{ display: 'block', fontSize: 13.5, marginTop: 3, fontWeight: 600, lineHeight: 1.5, whiteSpace: 'pre-wrap', overflowWrap: 'break-word', color: CK.ink }}>{goals}</b>
        </div>
      )}

      <div className="flex flex-wrap items-center" style={{ gap: '6px 10px' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: CK.muted }}>Responsible</span>
        {open && staffOptions.length > 0 ? (
          <div style={{ width: 215 }}>
            <GSelect size="sm" value={d.assigned_member_id ?? ''} onChange={(v) => { void hand(v); }} options={staffOptions}
              placeholder="Unclaimed, choose a person" aria-label="Responsible backroomer" disabled={handing} />
          </div>
        ) : (
          <span className="inline-flex items-center" style={{ gap: 7, fontSize: 13, fontWeight: 700, color: CK.ink }}>
            <StaffPic member={d.assigned_member_id ? names.members.get(d.assigned_member_id) : null} size={24} />
            {memberName(d.assigned_member_id, names, 'Unclaimed')}
          </span>
        )}
        {ownerId && ownerId !== d.assigned_member_id && (
          <span className="inline-flex items-center" title="The backroomer set for this character" style={{ gap: 6, fontSize: 12, fontWeight: 600, color: CK.inkSoft }}>
            <StaffPic member={names.members.get(ownerId)} size={18} />
            Usually {memberName(ownerId, names)}
          </span>
        )}
      </div>
    </div>
  );
}
