'use client';

/**
 * Communications home (redesign, 9 Oct 2026): one question, "What do you want
 * to do?", and one big card per answer, the way Luma's "send a blast" and
 * Kit's broadcasts open. Only facts that change what the organiser does next
 * are shown: people waiting for a reply, emails that failed, and session codes
 * that have not gone out. Everything else (stat wells, the issues console, the
 * "going out soon" rail, the receding inbox stack) is gone.
 */

import { PenLine, MessageCircleQuestion, Zap, Megaphone, Send, AlertTriangle, KeyRound, ChevronRight, X } from 'lucide-react';
import { GoldWord } from '@/components/BrandHeading';
import { ActionCard, CARD, FONT, INK, SOFT_INK, FOREST, DANGER, DuoIcon, PRIMARY } from './commsKit';

export default function CommsHome({
  conferenceName, waitingCount, failedCount, savedCount, sessionCodesHint,
  onSessionCodes, onDismissSessionCodes, onWrite, onInbox, onAutomatic, onSent, onAnnounce,
}: {
  conferenceName: string;
  waitingCount: number;
  failedCount: number;
  savedCount: number;
  sessionCodesHint: string | null;
  onSessionCodes: () => void;
  onDismissSessionCodes: () => void;
  onWrite: () => void;
  onInbox: () => void;
  onAutomatic: () => void;
  onSent: () => void;
  onAnnounce: () => void;
}) {
  return (
    <div style={{ maxWidth: 980 }}>
      <div className="mb-6">
        <p style={{ fontFamily: FONT, fontSize: 14, fontWeight: 600, color: SOFT_INK, overflowWrap: 'anywhere' }}>{conferenceName}</p>
        <h1 style={{ fontFamily: FONT, fontWeight: 800, color: INK, fontSize: 'clamp(28px, 3.4vw, 40px)', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
          What Do You Want to <GoldWord>Do?</GoldWord>
        </h1>
      </div>

      {/* Only what needs the organiser, in plain sentences. */}
      {(failedCount > 0 || sessionCodesHint) && (
        <div className="flex flex-col gap-3 mb-6">
          {failedCount > 0 && (
            <button
              type="button"
              onClick={onSent}
              className="w-full text-left flex items-center gap-3 px-4 py-3.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8B2020]"
              style={{ ...CARD, border: 'none', cursor: 'pointer' }}
            >
              <DuoIcon icon={AlertTriangle} size={40} tone="red" />
              <span className="flex-1 min-w-0" style={{ fontFamily: FONT, fontSize: 15, color: INK }}>
                <strong style={{ color: DANGER }}>{failedCount.toLocaleString()} {failedCount === 1 ? 'email' : 'emails'} could not be delivered.</strong>{' '}
                <span style={{ color: SOFT_INK }}>See who missed out.</span>
              </span>
              <ChevronRight size={18} style={{ color: SOFT_INK }} aria-hidden />
            </button>
          )}
          {sessionCodesHint && (
            <div className="flex flex-wrap items-center gap-3 px-4 py-3.5" style={CARD}>
              <DuoIcon icon={KeyRound} size={40} />
              <p className="flex-1" style={{ fontFamily: FONT, fontSize: 15, color: INK, minWidth: 200, textWrap: 'pretty' }}>{sessionCodesHint}</p>
              <div className="flex items-center gap-1">
                <button type="button" onClick={onSessionCodes} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#1B3828]" style={{ ...PRIMARY, minHeight: 40, fontSize: 14 }}>Send session codes</button>
                <button type="button" onClick={onDismissSessionCodes} aria-label="Hide for a day" title="Hide for a day" className="inline-flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] rounded-full" style={{ width: 40, height: 40, background: 'none', border: 'none', cursor: 'pointer', color: SOFT_INK }}>
                  <X size={18} aria-hidden />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ActionCard
          icon={PenLine}
          title="Send an email"
          line="Write to all your participants, or only some of them, like one committee or everyone who has not paid."
          onClick={onWrite}
        />
        <ActionCard
          icon={MessageCircleQuestion}
          title="Answer questions"
          line="Questions and swap requests from your participants."
          count={waitingCount}
          countWord={waitingCount === 1 ? 'person waiting for a reply' : 'people waiting for a reply'}
          onClick={onInbox}
        />
        <ActionCard
          icon={Zap}
          title="Automatic emails"
          line="Emails that send themselves, like when an application is accepted. Choose which ones are on."
          onClick={onAutomatic}
        />
        <ActionCard
          icon={Megaphone}
          title="Announce to Gavelling users"
          line="Tell students in your country, your continent or the whole world about your conference."
          onClick={onAnnounce}
          badge={(
            <span className="flex-shrink-0" style={{ fontFamily: FONT, fontSize: 12, fontWeight: 700, color: FOREST, backgroundColor: 'rgba(238,217,138,0.6)', borderRadius: 8, padding: '3px 8px' }}>
              Paid
            </span>
          )}
        />
      </div>

      <button
        type="button"
        onClick={onSent}
        className="mt-6 inline-flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] rounded"
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px 0', fontFamily: FONT, fontSize: 15, fontWeight: 700, color: FOREST, textDecoration: 'underline', textUnderlineOffset: 3 }}
      >
        <Send size={16} aria-hidden />
        Emails you have sent{savedCount > 0 ? `, and ${savedCount} saved ${savedCount === 1 ? 'draft' : 'drafts'}` : ''}
      </button>
    </div>
  );
}
