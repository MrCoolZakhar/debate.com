'use client';

/**
 * The top of the Communications page, "Your messages" (redesign, 10 Oct 2026,
 * the owner's pick of three mockups: "Inbox first").
 *
 * One title, three tabs (Questions, Emails you sent, Automatic emails), the
 * main button "Write an email" and beside it the secondary "Marketing" (11 Oct
 * 2026, owner: it replaced the "Find new delegates" card), which opens the paid
 * announcements (AnnounceView). Under it, ONE slim line, and only when
 * something needs the organiser: emails that could not be delivered, or
 * session codes that have not gone out.
 *
 * Presentation only: every action is a callback the page already had.
 */

import type { ReactNode } from 'react';
import { Plus, AlertTriangle, KeyRound, X, Megaphone } from 'lucide-react';
import { GoldWord } from '@/components/BrandHeading';
import { CARD, FONT, INK, SOFT_INK, FOREST, DANGER, PRIMARY, SECONDARY, EASE_OUT, EmojiIcon } from './commsKit';

export type MessagesTab = 'questions' | 'sent' | 'automatic';

const TAB_GOLD = '#8A6512';

export default function MessagesHeader({
  tab, onTab, waitingCount, onWrite, onMarketing,
  failedCount, onSeeFailed, sessionCodesHint, onSessionCodes, onDismissSessionCodes,
}: {
  tab: MessagesTab;
  onTab: (t: MessagesTab) => void;
  waitingCount: number;
  onWrite: () => void;
  /** Opens the paid announcements ("Find new delegates"). */
  onMarketing: () => void;
  failedCount: number;
  onSeeFailed: () => void;
  sessionCodesHint: string | null;
  onSessionCodes: () => void;
  onDismissSessionCodes: () => void;
}) {
  const tabs: { key: MessagesTab; label: string; count?: number }[] = [
    { key: 'questions', label: 'Questions', count: waitingCount },
    { key: 'sent', label: 'Emails you sent' },
    { key: 'automatic', label: 'Automatic emails' },
  ];

  function onTabKey(e: React.KeyboardEvent, i: number) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    const rtl = typeof document !== 'undefined' && document.dir === 'rtl';
    const fwd = rtl ? 'ArrowLeft' : 'ArrowRight';
    const next = e.key === 'Home' ? 0
      : e.key === 'End' ? tabs.length - 1
      : e.key === fwd ? (i + 1) % tabs.length
      : (i - 1 + tabs.length) % tabs.length;
    onTab(tabs[next].key);
    const el = document.getElementById(`gv-msg-tab-${tabs[next].key}`);
    el?.focus();
  }

  return (
    <div className="mb-5">
      <div className="gv-msg-head">
        <h1 className="gv-msg-title" style={{ fontFamily: FONT, fontWeight: 800, color: INK, fontSize: 'clamp(28px, 3vw, 36px)', lineHeight: 1.1, letterSpacing: '-0.02em', margin: 0 }}>
          Your <GoldWord>Messages</GoldWord>
        </h1>

        <div role="tablist" aria-label="Messages" className="gv-msg-tabs" style={{ backgroundColor: 'rgba(27,56,40,0.07)', padding: 4, borderRadius: 12 }}>
          {tabs.map((t, i) => {
            const on = tab === t.key;
            return (
              <button
                key={t.key}
                id={`gv-msg-tab-${t.key}`}
                type="button"
                role="tab"
                aria-selected={on}
                tabIndex={on ? 0 : -1}
                onClick={() => onTab(t.key)}
                onKeyDown={e => onTabKey(e, i)}
                className="gv-msg-tab focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
                style={{
                  border: 'none', cursor: 'pointer', borderRadius: 9, padding: '8px 14px', minHeight: 38,
                  backgroundColor: on ? '#FFFFFF' : 'transparent',
                  boxShadow: on ? '0 1px 3px rgba(27,56,40,0.14)' : 'none',
                  fontFamily: FONT, fontSize: 14, fontWeight: on ? 700 : 500, color: on ? INK : '#3A2E24',
                  lineHeight: 1.2, textWrap: 'balance',
                  transitionProperty: 'background-color, box-shadow', transitionDuration: '160ms', transitionTimingFunction: EASE_OUT,
                }}
              >
                {t.label}
                {typeof t.count === 'number' && t.count > 0 && (
                  <b style={{ color: TAB_GOLD, marginInlineStart: 6, fontVariantNumeric: 'tabular-nums' }}>{t.count.toLocaleString()}</b>
                )}
              </button>
            );
          })}
        </div>

        <div className="gv-msg-actions">
          <button
            type="button"
            onClick={onMarketing}
            className="gv-msg-market inline-flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#1B3828]"
            style={{ ...SECONDARY, fontSize: 15, minHeight: 46, padding: '0 18px' }}
          >
            <EmojiIcon emoji="Megaphone" icon={Megaphone} size={30} />
            Marketing
          </button>
          <button
            type="button"
            onClick={onWrite}
            className="inline-flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#1B3828]"
            style={{ ...PRIMARY, fontSize: 15, minHeight: 46, padding: '0 20px' }}
          >
            <Plus size={17} strokeWidth={2.4} aria-hidden />
            Write an email
          </button>
        </div>
      </div>

      {(failedCount > 0 || sessionCodesHint) && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-4 px-4 py-2.5" style={{ ...CARD, borderRadius: 14 }}>
          {failedCount > 0 && (
            <SlimItem icon={<AlertTriangle size={17} style={{ color: DANGER }} aria-hidden />}>
              <strong style={{ color: DANGER }}>
                {failedCount.toLocaleString()} {failedCount === 1 ? 'email' : 'emails'} could not be delivered.
              </strong>{' '}
              <InlineLink onClick={onSeeFailed}>See who</InlineLink>
            </SlimItem>
          )}
          {sessionCodesHint && (
            <SlimItem icon={<KeyRound size={17} style={{ color: FOREST }} aria-hidden />}>
              <span style={{ color: INK }}>{sessionCodesHint}</span>{' '}
              <InlineLink onClick={onSessionCodes}>Send session codes</InlineLink>
              <button
                type="button"
                onClick={onDismissSessionCodes}
                aria-label="Hide for a day"
                title="Hide for a day"
                className="inline-flex items-center justify-center align-middle focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] rounded-full"
                style={{ width: 32, height: 32, marginInlineStart: 4, background: 'none', border: 'none', cursor: 'pointer', color: SOFT_INK }}
              >
                <X size={16} aria-hidden />
              </button>
            </SlimItem>
          )}
        </div>
      )}

      <style>{`
.gv-msg-head{display:flex;flex-wrap:wrap;align-items:center;gap:14px 24px}
.gv-msg-tabs{display:flex;gap:4px}
.gv-msg-actions{display:flex;align-items:center;gap:10px;margin-inline-start:auto}
.gv-msg-market:hover{background:#FAF8F3!important}
@media (max-width: 720px){
  .gv-msg-title{flex-basis:100%}
  .gv-msg-tabs{flex-basis:100%;display:grid;grid-template-columns:repeat(3,minmax(0,1fr))}
  .gv-msg-tab{padding:8px 6px!important;font-size:13.5px!important;text-align:center}
  .gv-msg-actions{flex-basis:100%;margin-inline-start:0}
  .gv-msg-actions > button{flex:1 1 0}
}
@media (prefers-reduced-motion: reduce){.gv-msg-tab{transition:none!important}}
`}</style>
    </div>
  );
}

function SlimItem({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 min-w-0" style={{ fontFamily: FONT, fontSize: 14, lineHeight: 1.45, margin: 0, textWrap: 'pretty' }}>
      <span className="flex-shrink-0" style={{ marginTop: 1 }}>{icon}</span>
      <span className="min-w-0">{children}</span>
    </p>
  );
}

function InlineLink({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] rounded"
      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: FONT, fontSize: 14, fontWeight: 700, color: FOREST, textDecoration: 'underline', textUnderlineOffset: 3 }}
    >
      {children}
    </button>
  );
}
