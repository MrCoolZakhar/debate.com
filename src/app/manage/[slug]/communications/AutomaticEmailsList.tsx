'use client';

/**
 * Automatic emails (redesign 11 Oct 2026, owner: "needs more work in terms of
 * design"). Built on the organiser kits the owner approved on the Store and
 * Financials (STORE_CSS, DASH_CSS: white cards on ivory, gold and green
 * washes, big tabular numbers), with Fluent 3D emoji on a soft gold disc
 * (EmojiDisc below).
 *
 * Top to bottom:
 *  - ONE focal card (gold wash, gold ring): "23 on of 31 emails", and the
 *    participant's journey as a strip of emoji discs, each with how many of
 *    its emails are on. A disc jumps to its group.
 *  - One group per journey moment: a 44px emoji disc, the title, "4 of 5 on".
 *  - Each email is its own card (two columns from 720px of list width): a
 *    small thumbnail of the real email (the same HTML the preview pop-up
 *    renders, drawn lazily into a sandboxed iframe when the card scrolls into
 *    view), the name, one "sends when" line, Preview and Edit, the switch.
 *    On = a forest edge, a green "On" with a check and the thumbnail in full
 *    colour. Off = no edge, a flatter card and a grey thumbnail, the words in
 *    full ink. Always sends = a gold edge and a lock.
 *  - The invite reminders as three numbered gold discs under their invite.
 *  - The four money emails Gavelling always sends as the last group card.
 *
 * Every write stays on the page: the switch is handleToggleEnabled, Edit the
 * builder, the reminder settings handleUpdateRecurring, Preview the preview
 * pop-up. This file only draws; a thumbnail never writes anything.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Armchair, BadgeCheck, CalendarDays, Check, Inbox, Lock, Mail, PenLine, Trophy, Users, Wallet, type LucideIcon,
} from 'lucide-react';
import { STORE_CSS, INK, INK_SOFT, FOREST, GOLD, IVORY } from '../store/storeKit';
import { DASH_CSS, OWED } from '../financials/dashboardKit';
import { Emoji3D } from '@/components/neu';
import { BackLink, CommsTitle, OnOffSwitch } from './commsKit';

export interface AutoRow {
  key: string;
  label: string;
  /** One plain line: when this email goes out. */
  when: string;
  /** Sends itself and cannot be switched off (the functional invites). */
  alwaysOn: boolean;
  on: boolean;
  toggling: boolean;
  /** The organiser wrote their own subject and message. */
  ownWording: boolean;
  /** Repeat settings for a reminder, drawn by the page; shown only while on. */
  reminder?: ReactNode;
  /** Always-on reminders that chase this invite, previewable one by one. */
  followUps?: { key: string; label: string }[];
  /** The email's HTML as it sends today (the preview pop-up's own render).
   *  Called only once the card is on screen; '' draws the sketch instead. */
  thumbHtml?: () => string;
  /** Changes whenever what thumbHtml returns would change. */
  thumbKey?: string;
}

export interface AutoGroup { title: string; rows: AutoRow[] }

export interface AlwaysSentEmail { key: string; label: string; description: string }

/** One Fluent 3D emoji (Lucide fallback) and one short word per journey moment. */
const JOURNEY_LOOK: Record<string, { emoji: string; icon: LucideIcon; short: string }> = {
  'When They Apply': { emoji: 'Inbox tray', icon: Inbox, short: 'Apply' },
  'When You Decide': { emoji: 'Check mark button', icon: BadgeCheck, short: 'Decide' },
  'When They Get a Seat': { emoji: 'Chair', icon: Armchair, short: 'Seat' },
  'When They Pay': { emoji: 'Money bag', icon: Wallet, short: 'Pay' },
  'Before the Conference': { emoji: 'Spiral calendar', icon: CalendarDays, short: 'Before' },
  'After the Conference': { emoji: 'Trophy', icon: Trophy, short: 'After' },
  'Your Team and Questions': { emoji: 'Busts in silhouette', icon: Users, short: 'Team' },
};
const lookOf = (title: string) => JOURNEY_LOOK[title] ?? { emoji: 'Envelope', icon: Mail, short: title };
const groupId = (title: string) => `gv-ae-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

const GREEN = '#2A6B45';

const AE_CSS = `
.gv-ae{container-type:inline-size;container-name:gvae}
.gv-ae-duo{display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;background:linear-gradient(160deg,#FFF9E6 0%,#F6EAC2 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,0.95),inset 0 0 0 1px rgba(182,135,31,0.22),0 6px 14px -10px rgba(122,90,16,0.55)}
.gv-ae-hero{padding:26px 26px 22px!important}
.gv-ae-hero-top{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:10px 28px}
.gv-ae-count{display:flex;align-items:baseline;flex-wrap:wrap;gap:4px 14px;margin:0}
.gv-ae-num{font-size:60px;font-weight:900;letter-spacing:-0.045em;line-height:0.95;font-variant-numeric:tabular-nums;color:${FOREST}}
.gv-ae-num small{font-size:0.62em;letter-spacing:-0.02em;margin-left:10px}
.gv-ae-of{font-size:19px;font-weight:700;color:${INK}}
.gv-ae-line{margin:0;max-width:340px;font-size:14.5px;line-height:1.45;color:${INK_SOFT};text-wrap:pretty}
.gv-ae-strip{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:22px}
.gv-ae-stage{display:flex;flex-direction:column;align-items:center;gap:6px;padding:12px 6px 10px;border:none;border-radius:16px;background:rgba(255,255,255,0.72);box-shadow:0 1px 0 rgba(27,56,40,0.06),0 10px 22px -18px rgba(27,56,40,0.5);cursor:pointer;font-family:inherit;transition:transform 180ms cubic-bezier(0.22,1,0.36,1),background-color 140ms ease}
.gv-ae-stage:hover{transform:translateY(-2px);background:#FFFFFF}
.gv-ae-stage:active{transform:scale(0.98)}
.gv-ae-stage:focus{outline:none}
.gv-ae-stage:focus-visible{outline:2px solid ${FOREST};outline-offset:2px}
.gv-ae-stage-n{font-size:20px;font-weight:900;line-height:1;font-variant-numeric:tabular-nums;color:${FOREST}}
.gv-ae-stage-n small{font-size:12px;font-weight:700;color:${INK_SOFT};margin-left:2px}
.gv-ae-stage-w{font-size:12.5px;font-weight:700;color:${INK};line-height:1.2;text-align:center}
@container gvae (min-width:620px){.gv-ae-strip{grid-template-columns:repeat(7,minmax(0,1fr))}}

.gv-ae-groups{display:flex;flex-direction:column;gap:34px;margin-top:34px}
.gv-ae-ghead{display:flex;align-items:center;flex-wrap:wrap;gap:6px 14px;margin:0 0 14px;scroll-margin-top:90px}
.gv-ae-gtitle{margin:0;font-size:22px;font-weight:800;letter-spacing:-0.02em;line-height:1.15;color:${INK}}
.gv-ae-gcount{font-size:15px;color:${INK_SOFT};font-variant-numeric:tabular-nums}
.gv-ae-gcount b{font-weight:800;color:${INK}}

.gv-ae-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:14px}
@container gvae (min-width:720px){.gv-ae-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}

/* One email = one card. State by colour and depth: on is raised white with a
   forest edge, off is flatter and a touch ivory, always is a gold edge. */
.gv-ae-mail{position:relative;container-type:inline-size;display:flex;flex-direction:column;gap:12px;padding:14px 16px 14px 18px;border-radius:18px;background:#FFFFFF;box-shadow:0 1px 0 rgba(27,56,40,0.08),0 18px 36px -28px rgba(27,56,40,0.5);transition:box-shadow 200ms ease,background-color 200ms ease}
.gv-ae-mail::before{content:"";position:absolute;inset-inline-start:0;top:16px;bottom:16px;width:3px;border-radius:0 3px 3px 0;background:transparent;transition:background-color 200ms ease}
.gv-ae-mail[data-state="on"]::before{background:${FOREST}}
.gv-ae-mail[data-state="always"]::before{background:linear-gradient(180deg,${GOLD},#C9A13C)}
.gv-ae-mail[data-state="off"]{background:#FCFAF5;box-shadow:0 0 0 1px rgba(27,56,40,0.06),0 6px 14px -12px rgba(27,56,40,0.35)}
.gv-ae-inner .gv-ae-mail{background:${IVORY}}
.gv-ae-main{display:flex;align-items:flex-start;gap:14px}
.gv-ae-body{flex:1 1 auto;min-width:0;display:flex;flex-direction:column}
.gv-ae-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
.gv-ae-name{margin:0;font-size:17px;font-weight:700;line-height:1.25;color:${INK};overflow-wrap:anywhere}
.gv-ae-when{margin:3px 0 0;font-size:14px;line-height:1.45;color:${INK_SOFT};text-wrap:pretty}
.gv-ae-meta{display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px;margin-top:8px}
.gv-ae-state{display:inline-flex;align-items:center;gap:5px;font-size:13.5px;font-weight:800}
.gv-ae-state[data-s="on"]{color:${GREEN}}
.gv-ae-state[data-s="off"]{color:${INK_SOFT};font-weight:700}
.gv-ae-state[data-s="always"]{color:${OWED}}
.gv-ae-mine{display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:8px;background:rgba(238,217,138,0.5);color:#5E440C;font-size:12.5px;font-weight:700}
.gv-ae-links{display:flex;flex-wrap:wrap;align-items:center;gap:0 16px;margin-top:2px}
.gv-ae-link{background:none;border:none;padding:8px 0;min-height:40px;font-family:inherit;font-size:14px;font-weight:700;color:${FOREST};text-decoration:underline;text-underline-offset:3px;cursor:pointer}
.gv-ae-link:focus{outline:none}
.gv-ae-link:focus-visible{outline:2px solid ${FOREST};outline-offset:2px;border-radius:4px}
.gv-ae-always{flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:11px;background:rgba(238,217,138,0.55);color:${FOREST}}

/* The thumbnail: the real email at about a fifth of its size */
.gv-ae-thumb{--tw:112;position:relative;flex-shrink:0;width:calc(var(--tw) * 1px);height:calc(var(--tw) * 1.36px);padding:0;border:none;border-radius:12px;overflow:hidden;background:#F1ECE1;cursor:pointer;box-shadow:0 0 0 1px rgba(27,56,40,0.08),0 8px 18px -12px rgba(27,56,40,0.5);transition:transform 180ms cubic-bezier(0.22,1,0.36,1),filter 200ms ease}
.gv-ae-thumb:hover{transform:translateY(-2px)}
.gv-ae-thumb:focus{outline:none}
.gv-ae-thumb:focus-visible{outline:2px solid ${FOREST};outline-offset:2px}
.gv-ae-thumb[data-off]{filter:grayscale(1);opacity:0.82}
.gv-ae-thumb[data-static]{cursor:default}
.gv-ae-thumb[data-static]:hover{transform:none}
.gv-ae-thumb iframe{position:absolute;top:0;left:0;width:640px;height:870px;border:0;background:#FFFFFF;color-scheme:light;pointer-events:none;transform-origin:0 0;transform:scale(calc(var(--tw) / 640))}
@container (max-width:360px){.gv-ae-thumb{--tw:86}}

/* The drawn sketch when there is no HTML to show (money emails, no wording yet) */
.gv-ae-mini{position:absolute;inset:0;display:flex;flex-direction:column;align-items:flex-start;gap:5px;padding:0 10px 10px;background:#FFFFFF;text-align:left}
.gv-ae-mini-band{align-self:stretch;height:26px;margin:0 -10px 4px}
.gv-ae-mini-logo{width:22px;height:22px;margin-top:-16px;border-radius:999px;background:#FFFFFF;box-shadow:0 0 0 2px #FFFFFF,0 2px 4px rgba(0,0,0,0.15);font-size:7px;font-weight:900;display:flex;align-items:center;justify-content:center;color:${FOREST};overflow:hidden}
.gv-ae-mini-t{font-size:10px;font-weight:800;line-height:1.2;color:${INK};overflow-wrap:anywhere}
.gv-ae-mini-bar{display:block;height:4px;border-radius:3px;background:rgba(27,56,40,0.12)}
.gv-ae-mini-btn{display:block;width:46%;height:10px;border-radius:4px;margin-top:3px}

/* Invite reminders: three gold discs */
.gv-ae-follow{display:flex;flex-wrap:wrap;align-items:center;gap:8px 10px;padding-top:10px;border-top:1px dashed rgba(27,56,40,0.14)}
.gv-ae-follow-w{font-size:13.5px;font-weight:600;color:${INK_SOFT}}
.gv-ae-disc{display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:999px;border:none;cursor:pointer;background:linear-gradient(160deg,#F6E7AE,${GOLD});color:${FOREST};font-family:inherit;font-size:15px;font-weight:900;font-variant-numeric:tabular-nums;box-shadow:inset 0 1px 0 rgba(255,255,255,0.7),0 6px 12px -8px rgba(122,90,16,0.7);transition:transform 160ms cubic-bezier(0.22,1,0.36,1)}
.gv-ae-disc:hover{transform:translateY(-2px)}
.gv-ae-disc:active{transform:scale(0.95)}
.gv-ae-disc:focus{outline:none}
.gv-ae-disc:focus-visible{outline:2px solid ${FOREST};outline-offset:2px}

/* The four money emails, the last group card */
.gv-ae-money{padding:24px 22px 22px!important}
.gv-ae-money .gv-ae-ghead{margin-bottom:6px}
.gv-ae-money-line{margin:0 0 16px;font-size:14px;color:${INK_SOFT}}

@media (prefers-reduced-motion:reduce){.gv-ae-stage,.gv-ae-thumb,.gv-ae-disc,.gv-ae-mail,.gv-ae-mail::before{transition:none}.gv-ae-stage:hover,.gv-ae-thumb:hover,.gv-ae-disc:hover{transform:none}}
`;

/** A Fluent 3D emoji in a soft gold disc with a lighter top highlight and a
 *  slightly darker rim; `icon` is drawn in forest if the image cannot load. */
function EmojiDisc({ emoji, icon, size = 44 }: { emoji: string; icon: LucideIcon; size?: number }) {
  return (
    <span className="gv-ae-duo" aria-hidden style={{ width: size, height: size, borderRadius: Math.round(size * 0.34) }}>
      <Emoji3D name={emoji} size={Math.round(size * 0.62)} fallback={icon} fallbackColor={FOREST} />
    </span>
  );
}

/** Draws the email only once its card is near the screen, then keeps it. */
function useSeen<T extends Element>(): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    if (typeof IntersectionObserver === 'undefined') return; // every supported browser has it
    const io = new IntersectionObserver((entries) => {
      if (entries.some(e => e.isIntersecting)) { setSeen(true); io.disconnect(); }
    }, { rootMargin: '300px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);
  return [ref, seen];
}

function MiniSketch({ label, accent, acronym }: { label: string; accent: string; acronym?: string }) {
  return (
    <span className="gv-ae-mini" aria-hidden>
      <span className="gv-ae-mini-band" style={{ background: accent }} />
      <span className="gv-ae-mini-logo">{(acronym ?? '').slice(0, 4)}</span>
      <span className="gv-ae-mini-t">{label}</span>
      <span className="gv-ae-mini-bar" style={{ width: '92%' }} />
      <span className="gv-ae-mini-bar" style={{ width: '80%' }} />
      <span className="gv-ae-mini-bar" style={{ width: '86%' }} />
      <span className="gv-ae-mini-bar" style={{ width: '52%' }} />
      <span className="gv-ae-mini-btn" style={{ background: accent }} />
    </span>
  );
}

function Thumb({ label, getHtml, thumbKey, off, accent, acronym, onOpen }: {
  label: string;
  getHtml?: () => string;
  thumbKey?: string;
  off?: boolean;
  accent: string;
  acronym?: string;
  onOpen?: () => void;
}) {
  const [ref, seen] = useSeen<HTMLSpanElement>();
  // Always the light email, like the preview pop-up: the email's own dark
  // styles would otherwise follow the organiser's system theme. thumbKey
  // stands in for getHtml, whose identity changes every page render.
  const html = useMemo(
    () => (seen && getHtml ? getHtml().replace(/prefers-color-scheme\s*:\s*dark/g, 'prefers-color-scheme: never') : ''),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [seen, thumbKey],
  );
  // The sketch sits underneath the real email, so a card is never empty.
  const inner = (
    <span ref={ref} style={{ position: 'absolute', inset: 0 }}>
      <MiniSketch label={label} accent={accent} acronym={acronym} />
      {html ? (
        <iframe
          key={thumbKey}
          srcDoc={html}
          sandbox="allow-same-origin"
          style={{ colorScheme: 'light' }}
          tabIndex={-1}
          aria-hidden
          title={`${label} thumbnail`}
        />
      ) : null}
    </span>
  );
  if (!onOpen) {
    return <span className="gv-ae-thumb" data-static="" data-off={off ? '' : undefined} aria-hidden>{inner}</span>;
  }
  return (
    <button type="button" className="gv-ae-thumb" data-off={off ? '' : undefined} onClick={onOpen} aria-label={`Preview ${label}`}>
      {inner}
    </button>
  );
}

function StateWord({ state }: { state: 'on' | 'off' | 'always' }) {
  if (state === 'always') return <span className="gv-ae-state" data-s="always"><Lock size={14} strokeWidth={2.6} aria-hidden /> Always sends</span>;
  if (state === 'on') return <span className="gv-ae-state" data-s="on"><Check size={15} strokeWidth={3} aria-hidden /> On</span>;
  return <span className="gv-ae-state" data-s="off">Off</span>;
}

function MailCard({ row, accent, acronym, onToggle, onPreview, onEdit }: {
  row: AutoRow; accent: string; acronym?: string;
  onToggle: (key: string) => void; onPreview: (key: string) => void; onEdit: (key: string) => void;
}) {
  const state: 'on' | 'off' | 'always' = row.alwaysOn ? 'always' : row.on ? 'on' : 'off';
  return (
    <article className="gv-ae-mail" data-state={state} aria-label={row.label}>
      <div className="gv-ae-main">
        <Thumb
          label={row.label}
          getHtml={row.thumbHtml}
          thumbKey={row.thumbKey}
          off={state === 'off'}
          accent={accent}
          acronym={acronym}
          onOpen={() => onPreview(row.key)}
        />
        <div className="gv-ae-body">
          <div className="gv-ae-top">
            <h3 className="gv-ae-name">{row.label}</h3>
            {row.alwaysOn ? (
              <span className="gv-ae-always" title="Always sends" aria-hidden><Lock size={16} strokeWidth={2.4} style={{ fill: 'rgba(238,217,138,0.95)' }} /></span>
            ) : (
              <OnOffSwitch on={row.on} disabled={row.toggling} onChange={() => onToggle(row.key)} label={`${row.label}: ${row.on ? 'on' : 'off'}`} />
            )}
          </div>
          <p className="gv-ae-when">{row.when}</p>
          <div className="gv-ae-meta">
            <StateWord state={state} />
            {row.ownWording && (
              <span className="gv-ae-mine"><PenLine size={13} strokeWidth={2.4} aria-hidden /> Your wording</span>
            )}
          </div>
          <div className="gv-ae-links">
            <button type="button" className="gv-ae-link" onClick={() => onPreview(row.key)} aria-label={`Preview ${row.label}`}>Preview</button>
            {!row.alwaysOn && (
              <button type="button" className="gv-ae-link" onClick={() => onEdit(row.key)} aria-label={`Edit ${row.label}`}>
                {row.ownWording ? 'Edit your wording' : 'Edit'}
              </button>
            )}
          </div>
        </div>
      </div>
      {row.on && row.reminder}
      {row.followUps && row.followUps.length > 0 && (
        <div className="gv-ae-follow">
          <span className="gv-ae-follow-w">Reminders if not answered</span>
          {row.followUps.map((f, n) => (
            <button key={f.key} type="button" className="gv-ae-disc" onClick={() => onPreview(f.key)} aria-label={`Preview ${f.label}`} title={f.label}>
              {n + 1}
            </button>
          ))}
        </div>
      )}
    </article>
  );
}

function scrollToGroup(title: string) {
  const el = typeof document !== 'undefined' ? document.getElementById(groupId(title)) : null;
  if (!el) return;
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
}

export default function AutomaticEmailsList({
  groups, alwaysSent, accent = FOREST, acronym, onBack, onToggle, onPreview, onEdit, top, embedded,
}: {
  groups: AutoGroup[];
  /** The money emails Gavelling always sends (alwaysOnEmails.ts). */
  alwaysSent: AlwaysSentEmail[];
  /** The conference's email colour, for the drawn thumbnails. */
  accent?: string;
  acronym?: string;
  onBack: () => void;
  /** Drawn as a tab of the Communications page ("Your messages"): the page
   *  carries the title and the tabs, so no back link and no title here. */
  embedded?: boolean;
  onToggle: (key: string) => void;
  onPreview: (key: string) => void;
  onEdit: (key: string) => void;
  top?: ReactNode;
}) {
  const stats = groups.map(g => ({ title: g.title, on: g.rows.filter(r => r.on).length, total: g.rows.length }));
  const onCount = stats.reduce((n, s) => n + s.on, 0);
  const total = stats.reduce((n, s) => n + s.total, 0);
  const line = 'They send by themselves when something happens. Switch off any you do not want.';

  return (
    <div className="gv-st gv-ae">
      <style>{STORE_CSS}</style>
      <style>{DASH_CSS}</style>
      <style>{AE_CSS}</style>
      {!embedded && (
        <>
          <BackLink onClick={onBack} />
          <CommsTitle lead="Automatic" gold="Emails" />
        </>
      )}
      {top}

      {/* The one focal card */}
      <section className="gv-st-card gv-fd-card gv-fd-wash-gold gv-fd-todo gv-ae-hero" aria-label="Automatic emails on">
        <div className="gv-ae-hero-top">
          <p className="gv-ae-count">
            <span className="gv-ae-num">{onCount}<small>on</small></span>
            <span className="gv-ae-of">of {total} emails</span>
          </p>
          <p className="gv-ae-line">{line}</p>
        </div>
        <nav className="gv-ae-strip" aria-label="Jump to a moment">
          {stats.map(s => {
            const look = lookOf(s.title);
            return (
              <button
                key={s.title}
                type="button"
                className="gv-ae-stage"
                onClick={() => scrollToGroup(s.title)}
                aria-label={`${s.title}: ${s.on} of ${s.total} on`}
              >
                <EmojiDisc emoji={look.emoji} icon={look.icon} size={40} />
                <span className="gv-ae-stage-n" aria-hidden>{s.on}<small>/{s.total}</small></span>
                <span className="gv-ae-stage-w" aria-hidden>{look.short}</span>
              </button>
            );
          })}
        </nav>
      </section>

      <div className="gv-ae-groups">
        {groups.map((g, gi) => {
          const s = stats[gi];
          const look = lookOf(g.title);
          return (
            <section key={g.title} aria-labelledby={`${groupId(g.title)}-t`}>
              <div className="gv-ae-ghead" id={groupId(g.title)}>
                <EmojiDisc emoji={look.emoji} icon={look.icon} size={44} />
                <h2 className="gv-ae-gtitle" id={`${groupId(g.title)}-t`}>{g.title}</h2>
                <span className="gv-ae-gcount"><b>{s.on}</b> of {s.total} on</span>
              </div>
              <div className="gv-ae-grid">
                {g.rows.map(r => (
                  <MailCard key={r.key} row={r} accent={accent} acronym={acronym} onToggle={onToggle} onPreview={onPreview} onEdit={onEdit} />
                ))}
              </div>
            </section>
          );
        })}

        {alwaysSent.length > 0 && (
          <section className="gv-st-card gv-fd-card gv-fd-wash-gold gv-ae-money" aria-labelledby="gv-ae-money-t">
            <div className="gv-ae-ghead">
              <EmojiDisc emoji="Locked" icon={Lock} size={44} />
              <h2 className="gv-ae-gtitle" id="gv-ae-money-t">Always Sent by Gavelling</h2>
            </div>
            <p className="gv-ae-money-line">These four always go out, so the amounts are always right</p>
            <div className="gv-ae-grid gv-ae-inner">
              {alwaysSent.map(e => (
                <article key={e.key} className="gv-ae-mail" data-state="always" aria-label={e.label}>
                  <div className="gv-ae-main">
                    <Thumb label={e.label} accent={accent} acronym={acronym} />
                    <div className="gv-ae-body">
                      <h3 className="gv-ae-name">{e.label}</h3>
                      <p className="gv-ae-when">{e.description}</p>
                      <div className="gv-ae-meta"><StateWord state="always" /></div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
