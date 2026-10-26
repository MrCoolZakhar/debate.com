'use client';
// Gavelling Crisis: the main panel of an opened directive (the left side of DirectivePopup).
// Top, fixed: a red band with the kind, the wait and the TITLE (the biggest text, wraps, never cut)
// under the "No. 13" badge that overlaps the pop-up's top edge, then the character: a portrait
// overhanging the band, the name in two rows, their title and cabinet. Middle, scrolls: tags, then the
// conversation as a chat (DirectiveThread: the directive, every note, internal notes marked "Only
// staff", the answer). Bottom, fixed: the composer (DirectiveComposer: the answer status chips, the text
// box, Add internal note, Send reply, Claim and Hand to). Staff only: it shows the author's secret goals.

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ChevronDown, Clock, FileText, Landmark, Lock, MessageCircle, Package, Target,
  VenetianMask, X, Zap, ArrowRight, SlidersHorizontal,
} from 'lucide-react';
import { listNotes, loadSecrets } from '@/lib/crisis/api';
import { getCrisisClient } from '@/lib/crisis/client';
import { dirNumber } from '@/lib/crisis/format';
import { KIND_LABEL, type Directive, type DirectiveNote } from '@/lib/crisis/types';
import { Avatar, Btn, CK, ThemeTag, cabinetTint, waitLabel } from '../../crisisKit';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import { CabinetLogo, NameStack, NumberBadge, StaffPic, Tag } from './directiveParts';
import { KIND_ICON, authorName, buildNames, listDirectiveCoauthors, memberName } from './directiveKit';
import DirectiveComposer from './DirectiveComposer';
import DirectiveThread from './DirectiveThread';
import type { DirectiveReply } from './useDirectiveReply';

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

  const [notes, setNotes] = useState<DirectiveNote[] | null>(null);
  const [coIds, setCoIds] = useState<string[]>([]);
  const [goals, setGoals] = useState<string | null | undefined>(undefined);
  const [goalsOpen, setGoalsOpen] = useState(false);
  const [lastHeard, setLastHeard] = useState<string | null | undefined>(undefined);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(t); }, []);

  const loadNotes = useCallback(async () => {
    try { setNotes(await listNotes(ref, d.id)); } catch { setNotes((prev) => prev ?? []); }
  }, [ref, d.id]);
  useEffect(() => {
    let cancelled = false;
    listNotes(ref, d.id).then((rows) => { if (!cancelled) setNotes(rows); }).catch(() => { if (!cancelled) setNotes((prev) => prev ?? []); });
    return () => { cancelled = true; };
  }, [ref, d.id, notesVersion, d.updated_at]);

  useEffect(() => {
    let cancelled = false;
    if (d.kind !== 'joint') return;
    listDirectiveCoauthors(ref, d.id).then((ids) => { if (!cancelled) setCoIds(ids); }).catch(() => { if (!cancelled) setCoIds([]); });
    return () => { cancelled = true; };
  }, [ref, d.id, d.kind]);

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

  const KindIcon = KIND_ICON[d.kind];
  const accent = cabinet?.color ?? CK.red;
  const coChars = (d.kind === 'joint' ? coIds : []).map((id) => names.characters.get(id)).filter((c): c is NonNullable<typeof c> => !!c);
  const hasLegacy = !!(d.resources_used || d.goal || d.affects);
  const waitText = d.status === 'answered' ? `Answered ${waitLabel(d.answered_at, now)} ago` : d.status === 'clarify' ? 'Waiting for the delegate' : `Waiting ${waitLabel(d.waiting_since, now)}`;
  const hasGoals = !!(d.author_character_id && goals && goals.trim());
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
            {(d.author_member_id ? lastHeard : null) === undefined ? 'Last heard back: loading' : lastHeard ? `Last heard back ${waitLabel(lastHeard, now)} ago` : 'Not heard back yet'}
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

        {/* The conversation */}
        <DirectiveThread d={d} notes={notes} names={names} who={who} character={character} accent={accent} />
      </div>

      {/* Bottom, fixed: the composer */}
      <DirectiveComposer
        crisisRef={ref} d={d} reply={reply} names={names} memberId={memberId} members={core.members} who={who}
        onNoteAdded={loadNotes} onChanged={onChanged} effectsButton={effectsButton}
      />
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
