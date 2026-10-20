'use client';

// ── Invites: who this conference invited from Find people ──────────────────
//
// job_conference_invites (newest first). Drawn only when there is at least
// one invite; a failed read draws nothing (the card is a record, not a step).
// Status is an icon and a word, never a pill (CLAUDE.md §8 rule 9).

import { useEffect, useState } from 'react';
import { Ban, CheckCircle2, Clock, Send, XCircle } from 'lucide-react';
import { DashCard, TINT_GREEN } from '../financials/dashboardKit';
import { conferenceInvites, dayLabel, type InviteStatus, type SentInvite } from './jobsApi';

const FONT = "var(--font-brand), sans-serif";
const INK = '#1C1410';
const INK_SOFT = '#5C5140';
const FOREST = '#1B3828';

const STATUS: Record<InviteStatus, { label: string; icon: typeof Send; color: string }> = {
  queued: { label: 'Waiting to be delivered', icon: Clock, color: INK_SOFT },
  sent: { label: 'Sent', icon: Send, color: FOREST },
  applied: { label: 'Applied', icon: CheckCircle2, color: FOREST },
  not_interested: { label: 'Not interested', icon: XCircle, color: INK_SOFT },
  cancelled: { label: 'Cancelled', icon: Ban, color: INK_SOFT },
};

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

export default function SentInvitesCard({ confId, refreshKey }: { confId: string; refreshKey: number }) {
  const [invites, setInvites] = useState<SentInvite[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void conferenceInvites(confId).then((r) => {
      if (cancelled || !r.ok) return;
      setInvites([...r.invites].sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0)));
    });
    return () => { cancelled = true; };
  }, [confId, refreshKey]);

  if (!invites || invites.length === 0) return null;

  return (
    <DashCard
      title="Invites"
      hint="People you invited from Find people to apply to one of your listings. An invite reaches them by email and on Gavelling"
      icon={{ emoji: 'Envelope with arrow', lucide: Send, tint: TINT_GREEN }}
      hang="start"
    >
      <style>{INVITES_CSS}</style>
      <ul className="gv-si-list">
        {invites.map((i) => {
          const s = STATUS[i.status] ?? STATUS.sent;
          const Icon = s.icon;
          return (
            <li key={i.id} className="gv-si-row">
              <PersonAvatar name={i.name} url={i.avatar_url} size={40} />
              <div className="gv-si-who">
                <p className="gv-si-name">{i.name || 'A Gavelling member'}</p>
                <p className="gv-si-sub">{i.title || 'A listing'}</p>
              </div>
              <div className="gv-si-meta">
                <span className="gv-si-status" style={{ color: s.color }}>
                  <Icon size={15} strokeWidth={2.4} aria-hidden /> {s.label}
                </span>
                <span className="gv-si-sub">
                  {dayLabel(i.created_at)}{i.invited_by ? ` · by ${i.invited_by}` : ''}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </DashCard>
  );
}

const INVITES_CSS = `
.gv-si-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column}
.gv-si-row{display:flex;align-items:center;gap:12px;padding:12px 0;border-top:1px solid rgba(28,20,16,0.08)}
.gv-si-row:first-child{border-top:none;padding-top:4px}
.gv-si-who{flex:1 1 auto;min-width:0}
.gv-si-name{margin:0;font-family:${FONT};font-size:15px;font-weight:700;line-height:1.3;color:${INK};overflow-wrap:anywhere}
.gv-si-sub{margin:2px 0 0;font-family:${FONT};font-size:13px;line-height:1.4;color:${INK_SOFT};overflow-wrap:anywhere}
.gv-si-meta{display:flex;flex-direction:column;align-items:flex-end;text-align:right;flex-shrink:0;max-width:45%}
.gv-si-status{display:inline-flex;align-items:center;gap:6px;font-family:${FONT};font-size:13.5px;font-weight:700}
@media (max-width:600px){.gv-si-row{flex-wrap:wrap}.gv-si-meta{align-items:flex-start;text-align:left;max-width:none;padding-left:52px}}
`;
