'use client';

/**
 * Questions as a messages app (redesign, 10 Oct 2026, mockup "Inbox first").
 *
 * One white card, split: the conversations on the left (search, the ones
 * waiting on a reply first, then "Answered"), the open conversation on the
 * right (who it is, bubbles, day separators, the swap decision as quick
 * actions, the reply box). Below 900px of CARD width (a container query, so
 * the manage rail is taken into account) it is one pane at a time: the list,
 * then the conversation full width with a back button.
 *
 * Draws only. Every write (open + mark seen, reply, mark as done, reopen,
 * delete, swap approve / decline) is the page's own handler, passed in.
 */

import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowUp, Search, Trash2, Repeat, Check, X, MessageCircleQuestion, CheckCheck } from 'lucide-react';
import ProfileLink from '@/components/ProfileLink';
import { CircleFlag, flagMonogram } from '@/components/CircleFlag';
import { waitAgeLabel } from './waitingOnReply';
import { FONT, INK, SOFT_INK, FOREST, DANGER, PRIMARY, SECONDARY, EASE_OUT } from './commsKit';

const WAIT_INK = '#8A5A00';
const RULE = 'rgba(27,56,40,0.08)';

export interface SplitThread {
  id: string;
  userId: string;
  name: string;
  avatarUrl: string | null;
  /** Their allocated country, drawn as a small round flag on the avatar. */
  country: string | null;
  subject: string;
  kind: string;
  status: string;
  /** When they started waiting on a reply (waitingOnReply.ts), else null. */
  waitingSince: string | null;
  lastActivity: string;
  preview: { mine: boolean; body: string } | null;
  unread: boolean;
  fromContactForm: boolean;
}

export interface SplitMessage {
  id: string;
  mine: boolean;
  senderName: string;
  senderUserId: string | null;
  /** Show the sender above the bubble (someone other than the thread's author). */
  showSender: boolean;
  body: string;
  createdAt: string;
}

export interface SplitDetail {
  /** "Delegate · UNHRC · Kenya" */
  roleLine: string;
  applicationHref: string | null;
  messages: SplitMessage[];
  /** Swap details, and whether Approve / Decline are offered. */
  swap: { lines: string[]; canDecide: boolean } | null;
}

const AVATAR_TONES: { bg: string; fg: string }[] = [
  { bg: '#C9DCCB', fg: '#1B3828' },
  { bg: '#F1E2B4', fg: '#5E450E' },
  { bg: '#D8E3EC', fg: '#2F4F66' },
  { bg: '#E9D6CF', fg: '#6E3524' },
  { bg: '#E3DDF0', fg: '#45386B' },
];

function toneFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[h % AVATAR_TONES.length];
}

function Avatar({ t, size = 44, muted }: { t: Pick<SplitThread, 'id' | 'name' | 'avatarUrl' | 'country'>; size?: number; muted?: boolean }) {
  const tone = muted ? { bg: '#EEE9DE', fg: SOFT_INK } : toneFor(t.id);
  const badge = Math.round(size * 0.42);
  return (
    <span className="relative flex-shrink-0" style={{ width: size, height: size }} aria-hidden>
      {t.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={t.avatarUrl} alt="" className="rounded-full object-cover" style={{ width: size, height: size, outline: '1px solid rgba(0,0,0,0.08)', outlineOffset: -1 }} />
      ) : (
        <span className="flex items-center justify-center rounded-full" style={{ width: size, height: size, backgroundColor: tone.bg, color: tone.fg, fontFamily: FONT, fontWeight: 700, fontSize: Math.round(size * 0.34) }}>
          {flagMonogram(t.name)}
        </span>
      )}
      {t.country && (
        <span className="absolute rounded-full" style={{ insetInlineEnd: -2, bottom: -2, width: badge, height: badge, boxShadow: '0 0 0 2px #FFFFFF', borderRadius: 999, backgroundColor: '#FFFFFF' }}>
          <CircleFlag country={t.country} size={badge} decorative />
        </span>
      )}
    </span>
  );
}

function dayKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const that = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((today - that) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString(undefined, {
    weekday: diff < 7 ? 'long' : undefined,
    day: 'numeric', month: 'long',
    year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  });
}

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

/** "10:12" today, "Yesterday", "6 Oct" for older answered threads. */
function shortWhen(iso: string) {
  const label = dayLabel(iso);
  if (label === 'Today') return timeLabel(iso);
  if (label === 'Yesterday') return label;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export default function InboxSplit({
  threads, selected, detail, search, onSearch, onOpen, onBack,
  replyText, onReplyText, onReply, onMarkDone, onReopen, onDelete, deleting,
  onSwap, swapActing, onWrite, children,
}: {
  threads: SplitThread[];
  selected: SplitThread | null;
  detail: SplitDetail | null;
  search: string;
  onSearch: (v: string) => void;
  onOpen: (id: string) => void;
  onBack: () => void;
  replyText: string;
  onReplyText: (v: string) => void;
  onReply: () => void;
  onMarkDone: () => void;
  onReopen: () => void;
  onDelete: () => void;
  deleting: boolean;
  onSwap: (approve: boolean) => void;
  swapActing: boolean;
  onWrite: () => void;
  /** Rendered after the card (the close confirmation). */
  children?: ReactNode;
}) {
  const q = search.trim().toLowerCase();
  const shown = q
    ? threads.filter(t => `${t.name} ${t.subject} ${t.preview?.body ?? ''}`.toLowerCase().includes(q))
    : threads;
  const waiting = shown.filter(t => t.waitingSince).sort((a, b) => b.lastActivity.localeCompare(a.lastActivity));
  const answered = shown.filter(t => !t.waitingSince).sort((a, b) => b.lastActivity.localeCompare(a.lastActivity));

  // ── The conversation scrolls to its newest message on open and on a new one.
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const msgCount = detail?.messages.length ?? 0;
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [selected?.id, msgCount]);

  // ── The reply box grows with what is typed, up to 6 lines (written to the node).
  const replyRef = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    const el = replyRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 168)}px`;
  }, [replyText, selected?.id]);

  if (threads.length === 0) {
    return (
      <div className="flex flex-col items-center text-center px-6 py-14" style={{ backgroundColor: '#FFFFFF', borderRadius: 22, boxShadow: '0 0 0 1px rgba(27,56,40,0.06), 0 10px 30px rgba(27,56,40,0.10)' }}>
        <p style={{ fontFamily: FONT, fontSize: 16, color: INK, marginBottom: 16, textWrap: 'balance' }}>
          No questions yet. When a participant asks something, it shows up here.
        </p>
        <button type="button" onClick={onWrite} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#1B3828]" style={PRIMARY}>
          Write an email
        </button>
      </div>
    );
  }

  const canReply = !!selected && selected.status === 'open';

  return (
    <>
      <div className="gv-split-wrap">
        <div className={`gv-split${selected ? ' has-sel' : ''}`}>
          {/* ── Conversations ── */}
          <section aria-label="Conversations" className="gv-split-list">
            <div style={{ padding: '16px 16px 10px' }}>
              <label className="relative block">
                <span className="sr-only">Search people or questions</span>
                <Search size={16} aria-hidden className="absolute" style={{ insetInlineStart: 13, top: '50%', transform: 'translateY(-50%)', color: SOFT_INK }} />
                <input
                  type="search"
                  value={search}
                  onChange={e => onSearch(e.target.value)}
                  placeholder="Search people or questions"
                  className="w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
                  style={{ fontFamily: FONT, fontSize: 16, padding: '10px 14px', paddingInlineStart: 38, borderRadius: 12, border: 'none', backgroundColor: '#F4EFE4', color: INK }}
                />
              </label>
            </div>
            <div className="gv-split-scroll" style={{ paddingBottom: 10 }}>
              {shown.length === 0 && (
                <p style={{ fontFamily: FONT, fontSize: 14, color: SOFT_INK, padding: '14px 18px' }}>Nobody matches that search.</p>
              )}
              {waiting.map(t => (
                <ThreadRow key={t.id} t={t} active={selected?.id === t.id} onOpen={onOpen} />
              ))}
              {answered.length > 0 && (
                <>
                  <p style={{ fontFamily: FONT, fontSize: 12, fontWeight: 700, color: SOFT_INK, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '14px 18px 6px', margin: 0 }}>
                    Answered
                  </p>
                  {answered.map(t => (
                    <ThreadRow key={t.id} t={t} active={selected?.id === t.id} onOpen={onOpen} muted />
                  ))}
                </>
              )}
            </div>
          </section>

          {/* ── The open conversation ── */}
          <section aria-label={selected ? selected.name : 'Conversation'} className="gv-split-thread">
            {!selected || !detail ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-6" style={{ backgroundColor: '#FBF8F1' }}>
                <MessageCircleQuestion size={34} style={{ color: 'rgba(27,56,40,0.35)', marginBottom: 10 }} aria-hidden />
                <p style={{ fontFamily: FONT, fontSize: 15, color: SOFT_INK }}>Choose a conversation to read it.</p>
              </div>
            ) : (
              <>
                {/* Who it is */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2" style={{ padding: '14px 20px', boxShadow: `inset 0 -1px 0 ${RULE}` }}>
                  <button
                    type="button"
                    onClick={onBack}
                    aria-label="All questions"
                    className="gv-split-back inline-flex items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
                    style={{ width: 40, height: 40, marginInlineStart: -8, border: 'none', background: 'none', cursor: 'pointer', color: FOREST }}
                  >
                    <ArrowLeft size={20} strokeWidth={2.3} aria-hidden />
                  </button>
                  <Avatar t={selected} size={40} />
                  <div className="min-w-0 flex-1" style={{ minWidth: 150 }}>
                    <p style={{ fontFamily: FONT, fontWeight: 700, fontSize: 17, color: INK, margin: 0, overflowWrap: 'anywhere', lineHeight: 1.25 }}>
                      <ProfileLink userId={selected.userId} name={selected.name}>{selected.name}</ProfileLink>
                    </p>
                    {(detail.roleLine || selected.fromContactForm) && (
                      <p style={{ fontFamily: FONT, fontSize: 13, color: SOFT_INK, margin: 0, overflowWrap: 'anywhere' }}>
                        {detail.roleLine}
                        {selected.fromContactForm && (
                          <span title="Sent through the gavelling.com contact form. The form does not verify the address.">
                            {detail.roleLine ? ' · ' : ''}Contact form
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap" style={{ marginInlineStart: 'auto' }}>
                    {detail.applicationHref && (
                      <Link
                        href={detail.applicationHref}
                        className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] rounded"
                        style={{ fontFamily: FONT, fontSize: 14, fontWeight: 700, color: FOREST, textDecoration: 'underline', textUnderlineOffset: 3, padding: '6px 4px' }}
                      >
                        Open application
                      </Link>
                    )}
                    {selected.status === 'open' ? (
                      <button type="button" onClick={onMarkDone} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]" style={{ ...SECONDARY, minHeight: 38, padding: '0 14px' }}>
                        Mark as done
                      </button>
                    ) : (
                      <button type="button" onClick={onReopen} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]" style={{ ...SECONDARY, minHeight: 38, padding: '0 14px' }}>
                        Reopen
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={onDelete}
                      disabled={deleting}
                      aria-label="Delete this conversation"
                      title="Delete this conversation"
                      className="inline-flex items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8B2020]"
                      style={{ width: 38, height: 38, border: 'none', background: 'none', cursor: deleting ? 'default' : 'pointer', color: DANGER, opacity: deleting ? 0.5 : 1 }}
                    >
                      <Trash2 size={17} aria-hidden />
                    </button>
                  </div>
                </div>

                {/* Bubbles */}
                <div ref={scrollRef} className="gv-split-scroll flex flex-col gap-2.5" style={{ padding: '18px 20px', backgroundColor: '#FBF8F1' }}>
                  <p style={{ alignSelf: 'center', textAlign: 'center', fontFamily: FONT, fontWeight: 700, fontSize: 14, color: INK, margin: '0 0 4px', maxWidth: 520, overflowWrap: 'anywhere', textWrap: 'balance' }}>
                    {selected.kind !== 'question' && <Repeat size={14} aria-hidden style={{ display: 'inline', verticalAlign: '-2px', marginInlineEnd: 6, color: FOREST }} />}
                    {selected.subject}
                  </p>
                  {detail.swap && (
                    <div style={{ alignSelf: 'center', width: '100%', maxWidth: 520, backgroundColor: '#FFFFFF', borderRadius: 14, padding: '12px 14px', boxShadow: '0 1px 3px rgba(27,56,40,0.10)' }}>
                      <p style={{ fontFamily: FONT, fontSize: 12, fontWeight: 700, color: SOFT_INK, letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 6px' }}>The swap</p>
                      {detail.swap.lines.map((l, i) => (
                        <p key={i} style={{ fontFamily: FONT, fontSize: 14, color: INK, margin: i ? '4px 0 0' : 0, overflowWrap: 'anywhere' }}>{l}</p>
                      ))}
                    </div>
                  )}
                  {detail.messages.map((m, i) => {
                    const prev = detail.messages[i - 1];
                    const newDay = !prev || dayKey(prev.createdAt) !== dayKey(m.createdAt);
                    return (
                      <div key={m.id} className="flex flex-col">
                        {newDay && (
                          <span style={{ alignSelf: 'center', fontFamily: FONT, fontSize: 12, color: SOFT_INK, backgroundColor: '#FFFFFF', padding: '4px 10px', borderRadius: 99, margin: '6px 0 8px' }}>
                            {dayLabel(m.createdAt)}
                          </span>
                        )}
                        {m.showSender && !m.mine && (
                          <span style={{ fontFamily: FONT, fontSize: 12, fontWeight: 700, color: SOFT_INK, margin: '0 0 3px 6px', overflowWrap: 'anywhere' }}>
                            <ProfileLink userId={m.senderUserId} name={m.senderName}>{m.senderName}</ProfileLink>
                          </span>
                        )}
                        <div
                          style={{
                            alignSelf: m.mine ? 'flex-end' : 'flex-start',
                            maxWidth: 'min(78%, 560px)',
                            background: m.mine ? 'linear-gradient(90deg,#1B3828,#2A5A3C)' : '#FFFFFF',
                            color: m.mine ? '#FFFFFF' : INK,
                            borderRadius: m.mine ? '18px 18px 6px 18px' : '18px 18px 18px 6px',
                            padding: '10px 14px 8px',
                            boxShadow: m.mine ? 'none' : '0 1px 3px rgba(27,56,40,0.10)',
                          }}
                        >
                          <p style={{ fontFamily: FONT, fontSize: 15, lineHeight: 1.5, margin: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{m.body}</p>
                          <span className="block" style={{ fontFamily: FONT, fontSize: 11.5, marginTop: 3, textAlign: 'end', color: m.mine ? 'rgba(255,255,255,0.72)' : SOFT_INK, fontVariantNumeric: 'tabular-nums' }}>
                            {timeLabel(m.createdAt)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Quick actions + reply */}
                {(canReply || (detail.swap?.canDecide ?? false)) ? (
                  <div className="flex flex-col gap-2.5" style={{ padding: '12px 16px 14px', boxShadow: `inset 0 1px 0 ${RULE}` }}>
                    {detail.swap?.canDecide && (
                      <div className="flex flex-wrap gap-2">
                        <Chip onClick={() => onSwap(true)} disabled={swapActing} icon={<Check size={14} strokeWidth={2.6} aria-hidden />}>
                          {swapActing ? 'Swapping…' : 'Approve the swap'}
                        </Chip>
                        <Chip onClick={() => onSwap(false)} disabled={swapActing} icon={<X size={14} strokeWidth={2.6} aria-hidden />}>
                          Decline the swap
                        </Chip>
                      </div>
                    )}
                    {canReply && (
                      <div className="flex items-end gap-2.5">
                        <textarea
                          ref={replyRef}
                          rows={1}
                          value={replyText}
                          onChange={e => onReplyText(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); onReply(); }
                          }}
                          placeholder="Write a reply"
                          aria-label={`Reply to ${selected.name}`}
                          className="flex-1 min-w-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
                          style={{ fontFamily: FONT, fontSize: 16, lineHeight: 1.45, padding: '11px 14px', borderRadius: 14, border: '1.5px solid rgba(27,56,40,0.16)', resize: 'none', backgroundColor: '#FFFFFF', color: INK, minHeight: 48 }}
                        />
                        <button
                          type="button"
                          onClick={onReply}
                          disabled={!replyText.trim()}
                          aria-label="Send reply"
                          title="Send reply"
                          className="flex-shrink-0 inline-flex items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#1B3828]"
                          style={{
                            width: 48, height: 48, border: 'none',
                            background: replyText.trim() ? 'linear-gradient(90deg,#1B3828,#2A5A3C)' : '#DDD4C0',
                            color: replyText.trim() ? '#FFFFFF' : SOFT_INK,
                            cursor: replyText.trim() ? 'pointer' : 'default',
                            transitionProperty: 'background-color', transitionDuration: '160ms', transitionTimingFunction: EASE_OUT,
                          }}
                        >
                          <ArrowUp size={21} strokeWidth={2.5} aria-hidden />
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="flex items-center gap-2" style={{ margin: 0, padding: '14px 20px', boxShadow: `inset 0 1px 0 ${RULE}`, fontFamily: FONT, fontSize: 14, color: SOFT_INK }}>
                    <CheckCheck size={16} aria-hidden style={{ color: FOREST }} />
                    Marked as done. Reopen it to reply.
                  </p>
                )}
              </>
            )}
          </section>
        </div>
      </div>
      {children}

      <style>{`
.gv-split-wrap{container-type:inline-size}
.gv-split{display:flex;background:#FFFFFF;border-radius:22px;overflow:hidden;
  box-shadow:0 0 0 1px rgba(27,56,40,0.06),0 10px 30px rgba(27,56,40,0.10);
  height:clamp(520px, calc(100dvh - 250px), 860px)}
.gv-split-list{width:360px;flex-shrink:0;display:flex;flex-direction:column;min-height:0;box-shadow:inset -1px 0 0 ${RULE}}
.gv-split-thread{flex:1;min-width:0;display:flex;flex-direction:column;min-height:0}
.gv-split-scroll{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain}
.gv-split-back{display:none!important}
.gv-thread-row:hover{background:#FAF6EC}
@container (max-width: 899px){
  .gv-split-list{width:100%;box-shadow:none}
  .gv-split.has-sel .gv-split-list{display:none}
  .gv-split:not(.has-sel) .gv-split-thread{display:none}
  .gv-split-back{display:inline-flex!important}
  .gv-split{height:clamp(480px, calc(100dvh - 210px), 860px)}
}
`}</style>
    </>
  );
}

function ThreadRow({ t, active, onOpen, muted }: { t: SplitThread; active: boolean; onOpen: (id: string) => void; muted?: boolean }) {
  const preview = t.preview ? `${t.preview.mine ? 'You: ' : ''}${t.preview.body}` : t.subject;
  return (
    <button
      type="button"
      onClick={() => onOpen(t.id)}
      aria-current={active ? 'true' : undefined}
      className="gv-thread-row w-full text-left flex gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#1B3828]"
      style={{
        padding: '12px 18px', border: 'none', cursor: 'pointer',
        backgroundColor: active ? '#F7F2E6' : 'transparent',
        boxShadow: active ? `inset 3px 0 0 ${FOREST}` : 'none',
      }}
    >
      <Avatar t={t} muted={muted && !active} />
      <span className="flex-1 min-w-0 flex flex-col" style={{ gap: 2 }}>
        <span className="flex items-start justify-between gap-2">
          <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 15, color: muted ? '#3A2E24' : INK, overflowWrap: 'anywhere', lineHeight: 1.3 }}>
            {t.name}
          </span>
          {t.waitingSince ? (
            <span className="flex-shrink-0" title={`Waiting on your reply since ${new Date(t.waitingSince).toLocaleString()}`} style={{ fontFamily: FONT, fontSize: 12.5, fontWeight: 600, color: WAIT_INK, fontVariantNumeric: 'tabular-nums', marginTop: 1 }}>
              Waiting {waitAgeLabel(t.waitingSince)}
            </span>
          ) : (
            <span className="flex-shrink-0" style={{ fontFamily: FONT, fontSize: 12.5, color: SOFT_INK, fontVariantNumeric: 'tabular-nums', marginTop: 1 }}>
              {shortWhen(t.lastActivity)}
            </span>
          )}
        </span>
        <span
          className="flex items-center gap-1.5 min-w-0"
          title={preview}
          style={{ fontFamily: FONT, fontSize: 13.5, color: t.unread ? INK : (muted ? SOFT_INK : '#3A2E24'), fontWeight: t.unread ? 600 : 400 }}
        >
          {t.kind !== 'question' && <Repeat size={13} aria-label={t.kind === 'swap_request' ? 'Swap request' : 'Swap'} style={{ flexShrink: 0, color: FOREST }} />}
          {t.status === 'closed' && <CheckCheck size={13} aria-label="Done" style={{ flexShrink: 0, color: FOREST }} />}
          <span className="truncate">{preview}</span>
        </span>
      </span>
    </button>
  );
}

function Chip({ onClick, disabled, icon, children }: { onClick: () => void; disabled?: boolean; icon?: ReactNode; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
      style={{ border: 'none', borderRadius: 99, padding: '8px 13px', backgroundColor: '#F4EFE4', fontFamily: FONT, fontSize: 13.5, fontWeight: 600, color: INK, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.6 : 1 }}
    >
      {icon}
      {children}
    </button>
  );
}
