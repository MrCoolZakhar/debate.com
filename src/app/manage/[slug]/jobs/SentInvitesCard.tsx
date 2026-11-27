'use client';

// ── Your Invites: who this conference invited from Find people ─────────────
//
// job_conference_invites (newest first). Since prompt 76 (26 Nov 2026) a
// compact card in the right column, under Applicant Emails: how many were
// sent, how many applied and how many are waiting, and "Check invite status",
// which opens every invite in InvitesPopup. No invites: one line and Find
// people. A failed read draws nothing (the card is a record, not a step).

import { useEffect, useState } from 'react';
import { Send } from 'lucide-react';
import type { JobRole } from '@/lib/jobBoard';
import { CARD_ACCENT, BoardCard, JobCount } from './jobKit';
import InvitesPopup from './InvitesPopup';
import { conferenceInvites, type SentInvite } from './jobsApi';

const FONT = "var(--font-brand), sans-serif";
const INK_SOFT = '#5C5140';
const FOREST = '#1B3828';


export function initialsOf(name: string | null | undefined): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  return (words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export function PersonAvatar({ name, url, size = 40 }: { name: string | null; url: string | null; size?: number }) {
  const [broken, setBroken] = useState(false);
  const box: React.CSSProperties = {
    width: size, height: size, borderRadius: 9999, flexShrink: 0, overflow: 'hidden',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    background: '#EDE7D8', color: FOREST, fontFamily: FONT, fontWeight: 800, fontSize: Math.round(size * 0.36),
    boxShadow: 'inset 0 0 0 1px rgba(28,20,16,0.08)',
  };
  if (url && !broken) {
    return (
      <span style={box} aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" width={size} height={size} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={() => setBroken(true)} />
      </span>
    );
  }
  return <span style={box} aria-hidden>{initialsOf(name)}</span>;
}

export default function SentInvitesCard({ confId, refreshKey, listings, onFindPeople }: {
  confId: string;
  refreshKey: number;
  listings: { id: string; title: string; role: JobRole }[];
  onFindPeople: () => void;
}) {
  const [invites, setInvites] = useState<SentInvite[] | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void conferenceInvites(confId).then((r) => {
      if (cancelled || !r.ok) return;
      setInvites([...r.invites].sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0)));
    });
    return () => { cancelled = true; };
  }, [confId, refreshKey]);

  if (!invites) return null;
  const applied = invites.filter((i) => i.status === 'applied').length;
  const waiting = invites.filter((i) => i.status === 'sent' || i.status === 'queued' || (i.status as string) === 'opened').length;

  return (
    <BoardCard
      title="Your Invites"
      hint="People you invited from Find people to apply to one of your listings. An invite reaches them by email and on Gavelling"
      icon={Send}
      accent={CARD_ACCENT.blue}
    >
      <style>{INVITES_CSS}</style>
      {invites.length === 0 ? (
        <div className="gv-si-empty">
          <p className="gv-si-line">No invites yet. Use Find people to invite someone</p>
          <button type="button" className="gv-st-btn gv-st-outline" onClick={onFindPeople}>Find people</button>
        </div>
      ) : (
        <div className="gv-si-empty">
          <JobCount n={invites.length} word={invites.length === 1 ? 'invite' : 'invites'} icon={Send} />
          <p className="gv-si-line">{applied.toLocaleString('en-US')} applied, {waiting.toLocaleString('en-US')} waiting</p>
          <button type="button" className="gv-st-btn gv-st-outline" onClick={() => setOpen(true)}>Check invite status</button>
        </div>
      )}
      {open && (
        <InvitesPopup
          invites={invites}
          listings={listings}
          onClose={() => setOpen(false)}
          onFindPeople={() => { setOpen(false); onFindPeople(); }}
        />
      )}
    </BoardCard>
  );
}

const INVITES_CSS = `
.gv-si-empty{display:flex;flex-direction:column;align-items:flex-start;gap:10px}
.gv-si-line{margin:0;font-family:${FONT};font-size:14.5px;line-height:1.45;color:${INK_SOFT}}
`;
