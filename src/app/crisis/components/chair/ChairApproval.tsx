'use client';
// Gavelling Crisis: "Cabinet Directives For You", the chair's approval card (docs/crisis/sql/017).
// A cabinet directive waits here (status awaiting_chair) until the chair sends it on to the backroom or
// turns it back. "Send back" asks for an optional note in place, inside the card (no pop-up on a pop-up).
// Below the waiting ones: the cabinet's directives already sent on, with their status.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Gavel, Send, Undo2 } from 'lucide-react';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { crisisError, reviewDirectiveAsChair, type CrisisRef } from '@/lib/crisis/api';
import { dirNumber } from '@/lib/crisis/format';
import type { Cabinet, Character, Directive, Member } from '@/lib/crisis/types';
import { Avatar, Btn, Card, CardTitle, CK, fieldStyle, OverhangCard, Skeleton } from '../../crisisKit';
import { NumberBadge } from '../directives/directiveParts';
import DirectiveDeepLink from '../notifications/DirectiveDeepLink';
import { StatusLine, whenLabel, whenTitle, OutcomeLine } from '../delegate/directiveUi';

const PORTRAIT = 44;
const LONG = 260; // characters; a longer text starts folded

function surname(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1] || name;
}

interface Author { name: string; picture_url: string | null; color: string }

function authorOf(d: Directive, characters: Character[], members: Member[], cabinets: Cabinet[]): Author {
  const ch = d.author_character_id ? characters.find((c) => c.id === d.author_character_id) : undefined;
  const cab = cabinets.find((c) => c.id === (ch?.cabinet_id ?? d.cabinet_id));
  const color = cab?.color ?? CK.red;
  if (ch) return { name: ch.name, picture_url: ch.picture_url, color };
  const m = d.author_member_id ? members.find((x) => x.id === d.author_member_id) : undefined;
  return { name: m?.display_name ?? 'A delegate', picture_url: m?.picture_url ?? null, color };
}

function Waiting({ d, author, cref, cabinetName, focused, onDone }: {
  d: Directive; author: Author; cref: CrisisRef; cabinetName: string | null; focused: boolean; onDone: () => void;
}) {
  const [open, setOpen] = useState(focused);
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<'send' | 'back' | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const long = d.body.length > LONG || d.body.split('\n').length > 4;

  useEffect(() => {
    if (focused) root.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [focused]);

  const decide = async (approve: boolean) => {
    if (busy) return;
    setBusy(approve ? 'send' : 'back');
    try {
      const landed = await reviewDirectiveAsChair(cref, d.id, approve, approve ? null : note);
      if (landed) notifyOk(approve ? 'Sent to the backroom' : 'Sent back to the author', 'crisis-chair');
      else notifyErr('This directive was already dealt with.', 'crisis-chair');
      onDone();
    } catch (e) {
      notifyErr(crisisError(e, 'Could not save that decision. Try again.'), 'crisis-chair');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div ref={root}>
      <OverhangCard name={author.name} src={author.picture_url} color={author.color} size={PORTRAIT} style={{ boxShadow: focused ? `${CK.shadow}, 0 0 0 2px ${CK.red}` : CK.shadow }}>
        <div className="flex items-start gap-2 flex-wrap">
          <b style={{ flex: '1 1 200px', minWidth: 0, fontSize: 18, lineHeight: 1.28, fontWeight: 800, color: CK.ink, overflowWrap: 'anywhere' }}>{d.title}</b>
          <NumberBadge n={dirNumber(d)} style={{ marginTop: 4 }} />
        </div>
        <p style={{ margin: '3px 0 0', fontSize: 12.5, fontWeight: 700, color: CK.inkSoft, overflowWrap: 'anywhere' }}>
          <span title={author.name}>From {surname(author.name)}</span>
          {cabinetName ? ` · ${cabinetName}` : ''}
          <span title={whenTitle(d.created_at)}>{` · ${whenLabel(d.created_at)}`}</span>
        </p>
        <p
          className={long && !open ? 'line-clamp-3' : undefined}
          style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.55, color: CK.ink, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
        >
          {d.body}
        </p>
        {long && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="inline-flex items-center gap-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
            style={{ marginTop: 4, border: 0, background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: CK.font, fontSize: 13, fontWeight: 800, color: CK.forest, textDecoration: 'underline' }}
          >
            {open ? <ChevronUp size={14} strokeWidth={1.6} aria-hidden /> : <ChevronDown size={14} strokeWidth={1.6} aria-hidden />}
            {open ? 'Show less' : 'Read all'}
          </button>
        )}

        {asking ? (
          <div style={{ marginTop: 12 }}>
            <label htmlFor={`back-${d.id}`} style={{ display: 'block', margin: '0 0 5px', fontSize: 13, fontWeight: 700, color: CK.ink }}>Note for the author (optional)</label>
            <textarea
              id={`back-${d.id}`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="Say what to change"
              style={{ ...fieldStyle, resize: 'vertical' }}
            />
            <div className="flex flex-wrap" style={{ gap: 8, marginTop: 8 }}>
              <Btn tone="red" icon={<Undo2 size={15} strokeWidth={1.5} />} disabled={!!busy} onClick={() => decide(false)}>{busy === 'back' ? 'Sending back' : 'Send back'}</Btn>
              <Btn tone="ghost" disabled={!!busy} onClick={() => { setAsking(false); setNote(''); }}>Cancel</Btn>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap" style={{ gap: 8, marginTop: 12 }}>
            <Btn tone="green" icon={<Send size={15} strokeWidth={1.5} />} disabled={!!busy} onClick={() => decide(true)}>{busy === 'send' ? 'Sending' : 'Send to the backroom'}</Btn>
            <Btn tone="ghost" icon={<Undo2 size={15} strokeWidth={1.5} />} disabled={!!busy} onClick={() => setAsking(true)}>Send back</Btn>
          </div>
        )}
      </OverhangCard>
    </div>
  );
}

function SentRow({ d, author }: { d: Directive; author: Author }) {
  return (
    <div className="flex items-start gap-3" style={{ padding: '10px 0', borderTop: `1px solid ${CK.hair}` }}>
      <Avatar name={author.name} src={author.picture_url} size={32} color={author.color} />
      <div className="min-w-0" style={{ flex: 1 }}>
        <div className="flex items-start gap-2 flex-wrap">
          <b style={{ flex: '1 1 180px', minWidth: 0, fontSize: 15, lineHeight: 1.3, fontWeight: 800, color: CK.ink, overflowWrap: 'anywhere' }}>{d.title}</b>
          <NumberBadge n={dirNumber(d)} style={{ marginTop: 2 }} />
        </div>
        <p style={{ margin: '2px 0 0', fontSize: 12, fontWeight: 700, color: CK.muted }}>
          <span title={author.name}>{surname(author.name)}</span>
          <span title={whenTitle(d.created_at)}>{` · ${whenLabel(d.created_at)}`}</span>
        </p>
        <div className="flex items-center flex-wrap" style={{ gap: '2px 12px', marginTop: 3 }}>
          <StatusLine s={d.status} />
          <OutcomeLine d={d} />
        </div>
      </div>
    </div>
  );
}

export default function ChairApproval({ cref, directives, cabinetId, characters, members, cabinets, onChanged }: {
  cref: CrisisRef;
  directives: Directive[] | null;
  cabinetId: string | null;
  characters: Character[];
  members: Member[];
  cabinets: Cabinet[];
  onChanged: () => void;
}) {
  const [focusId, setFocusId] = useState<string | null>(null);
  const onId = useCallback((id: string) => setFocusId(id), []);

  const mine = useMemo(
    () => (directives ?? []).filter((d) => d.kind === 'committee' && (!cabinetId || d.cabinet_id === cabinetId)),
    [directives, cabinetId],
  );
  const waiting = mine.filter((d) => d.status === 'awaiting_chair').sort((a, b) => b.created_at.localeCompare(a.created_at));
  const sentOn = mine.filter((d) => d.status !== 'awaiting_chair').sort((a, b) => b.created_at.localeCompare(a.created_at));
  const cabName = (d: Directive) => (cabinets.length > 1 ? cabinets.find((c) => c.id === d.cabinet_id)?.name ?? null : null);

  return (
    <section aria-labelledby="chair-approval-title">
      <DirectiveDeepLink onId={onId} />
      <Card warm style={{ paddingTop: 14 }}>
        <CardTitle icon={<Gavel size={18} strokeWidth={1.5} />} sub={waiting.length ? 'Read each one. Send it on to the backroom, or send it back.' : undefined}>
          <span id="chair-approval-title">Cabinet Directives For You</span>
        </CardTitle>
        {directives === null ? (
          <div className="grid gap-4"><Skeleton h={90} r={18} /></div>
        ) : waiting.length === 0 ? (
          <p style={{ margin: 0, fontSize: 14, color: CK.inkSoft }}>Nothing is waiting for you.</p>
        ) : (
          <div className="grid" style={{ gap: 22, paddingTop: 6 }}>
            {waiting.map((d) => (
              <Waiting
                key={d.id}
                d={d}
                author={authorOf(d, characters, members, cabinets)}
                cref={cref}
                cabinetName={cabName(d)}
                focused={focusId === d.id}
                onDone={onChanged}
              />
            ))}
          </div>
        )}

        {sentOn.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <h3 style={{ margin: '0 0 2px', fontSize: 14, fontWeight: 800, color: CK.ink }}>Already Sent On</h3>
            {sentOn.map((d) => <SentRow key={d.id} d={d} author={authorOf(d, characters, members, cabinets)} />)}
          </div>
        )}
      </Card>
    </section>
  );
}
