'use client';

// The review pop-up (owner, 21 Oct 2026): a clean centred card, the
// conference's logo and name on top, "How Was <ACR>?", Overall stars
// (required), the five REVIEW_CRITERIA rows once the database has the column
// (REVIEW_CRITERIA_DB), an optional written review, "Not now" and "Submit
// review". Accents read the conference theme (var(--gv-main), var(--gv-accent))
// with Gavelling's forest and gold as the fallback, so the same pop-up works on
// the conference page (pass `themeStyle`, the page's themeCssVars, because it
// is portaled out of the themed wrapper) and on Gavelling's own pages.
//
// It never decides WHETHER to show: ConferenceReviewGate and the profile page
// do that through `reviewWindowOpen`. It only saves, through
// `submitConferenceReview`, and reports with notifyOk / notifyErr.

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Star } from 'lucide-react';
import Portal from '@/components/Portal';
import { LogoDisc } from '@/components/LogoDisc';
import { useAuth } from '@/components/AuthProvider';
import { useScrollLock } from '@/hooks/useScrollLock';
import { conferenceAcronymLabel, conferenceFullNameLabel } from '@/lib/conferenceLabels';
import { friendlyError } from '@/lib/friendlyError';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import {
  REVIEW_CRITERIA, REVIEW_CRITERIA_DB, submitConferenceReview,
  type ReviewConference, type ReviewCriteria, type ReviewCriterionKey,
} from '@/lib/conferenceReviews';

const FONT = 'var(--font-brand), sans-serif';
const INK = '#1C1410';
const INK_SOFT = '#5C4A3A';
const MAIN = 'var(--gv-main, #1B3828)';
const ON_MAIN = 'var(--gv-on-main, #FFFFFF)';
const STAR_ON = 'var(--gv-accent, #B6871F)';
const STAR_OFF = 'rgba(154,138,120,0.45)';

export const REVIEW_DIALOG_ATTR = 'data-conference-review-dialog';

type ConferenceForReview = Pick<ReviewConference, 'id' | 'acronym' | 'full_name' | 'logo_url' | 'start_date'>;

function StarPicker({
  value, onChange, size, label, target,
}: { value: number; onChange: (n: number) => void; size: number; label: string; target: number }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex items-center"
      style={{ marginInlineEnd: -(target - size) / 2 }}
      onMouseLeave={() => setHover(0)}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          role="radio"
          aria-checked={value === i}
          aria-label={`${label}: ${i} out of 5`}
          onClick={() => onChange(i)}
          onMouseEnter={() => setHover(i)}
          className="inline-flex items-center justify-center focus:outline-none transition-transform active:scale-[0.92]"
          style={{ width: target, height: target, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
        >
          <Star
            size={size}
            strokeWidth={1.5}
            style={{
              color: i <= shown ? STAR_ON : STAR_OFF,
              fill: i <= shown ? STAR_ON : 'none',
              transition: 'color 120ms ease, fill 120ms ease',
            }}
          />
        </button>
      ))}
    </div>
  );
}

export default function ConferenceReviewDialog({
  conference, onClose, onSubmitted, themeStyle,
}: {
  conference: ConferenceForReview;
  /** "Not now", Escape or the backdrop. */
  onClose: () => void;
  /** The review landed. */
  onSubmitted: () => void;
  /** The conference's theme variables (themeCssVars) when shown on its page. */
  themeStyle?: CSSProperties;
}) {
  const { user, session, profile } = useAuth();
  const [overall, setOverall] = useState(0);
  const [criteria, setCriteria] = useState<ReviewCriteria>({});
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  useScrollLock(true);

  const acronym = conferenceAcronymLabel(conference);
  const fullName = conferenceFullNameLabel(conference);
  const titleName = acronym || fullName || 'Your Conference';

  useEffect(() => {
    cardRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !saving) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  async function submit() {
    if (overall < 1 || saving) return;
    const token = session?.access_token;
    if (!user || !token) {
      notifyErr('Sign in again to send your review', 'review');
      return;
    }
    setSaving(true);
    try {
      await submitConferenceReview(token, {
        conferenceId: conference.id,
        userId: user.id,
        rating: overall,
        text,
        displayName: profile?.display_name ?? null,
        criteria: REVIEW_CRITERIA_DB ? criteria : undefined,
      });
      notifyOk('Thanks, your review is live', 'review');
      onSubmitted();
    } catch (e) {
      notifyErr(friendlyError(e, 'Your review could not be saved. Please try again'), 'review');
      setSaving(false);
    }
  }

  const ready = overall >= 1 && !saving;

  return (
    <Portal>
      <div
        className="fixed inset-0 flex items-center justify-center px-4 py-6"
        style={{ ...themeStyle, zIndex: 1000, backgroundColor: 'rgba(28,20,16,0.36)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
        onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}
        {...{ [REVIEW_DIALOG_ATTR]: '' }}
      >
        <div
          ref={cardRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="conference-review-title"
          tabIndex={-1}
          className="w-full max-w-[460px] max-h-full overflow-y-auto focus:outline-none"
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 28,
            padding: 'clamp(22px, 4vw, 32px)',
            boxShadow: '0 28px 70px rgba(27,56,40,0.22), 0 6px 18px rgba(27,56,40,0.10)',
            fontFamily: FONT,
          }}
        >
          <div className="flex flex-col items-center text-center">
            <LogoDisc src={conference.logo_url} alt="" size={64} fallbackText={(conference.acronym ?? '').slice(0, 3)} />
            <h2
              id="conference-review-title"
              className="[overflow-wrap:anywhere]"
              style={{ margin: '14px 0 0 0', fontSize: 24, fontWeight: 700, color: INK, lineHeight: 1.2, textWrap: 'balance' }}
            >
              How Was {titleName}?
            </h2>
            {acronym && fullName && fullName !== acronym && (
              <p className="[overflow-wrap:anywhere]" style={{ margin: '4px 0 0 0', fontSize: 14, color: INK_SOFT, lineHeight: 1.45 }}>
                {fullName}
              </p>
            )}
          </div>

          <div className="mt-6 flex flex-col items-center">
            <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: INK }}>Overall</p>
            <div className="mt-1">
              <StarPicker value={overall} onChange={setOverall} size={34} target={52} label="Overall" />
            </div>
          </div>

          {REVIEW_CRITERIA_DB && (
            <div className="mt-4 flex flex-col">
              {REVIEW_CRITERIA.map(({ key, label }) => (
                <div
                  key={key}
                  className="flex flex-wrap items-center justify-between gap-x-3"
                  style={{ borderTop: '1px solid rgba(221,212,192,0.55)', padding: '2px 0' }}
                >
                  <span style={{ fontSize: 14, color: INK, fontWeight: 500 }}>{label}</span>
                  <StarPicker
                    value={criteria[key as ReviewCriterionKey] ?? 0}
                    onChange={(n) => setCriteria((prev) => ({ ...prev, [key]: n }))}
                    size={22}
                    target={40}
                    label={label}
                  />
                </div>
              ))}
            </div>
          )}

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="What should future delegates know? (optional)"
            aria-label="Your review (optional)"
            className="mt-5 w-full rounded-2xl px-4 py-3 focus:outline-none resize-none"
            style={{
              fontSize: 14, lineHeight: 1.6, color: INK, fontFamily: FONT,
              border: '1px solid rgba(221,212,192,0.9)', backgroundColor: '#FBF9F4',
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = MAIN; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(221,212,192,0.9)'; }}
          />

          <div className="mt-5 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl px-4 focus:outline-none transition-colors hover:bg-black/[0.04]"
              style={{ minHeight: 44, fontSize: 14, fontWeight: 600, color: INK_SOFT, background: 'transparent', border: 'none', cursor: saving ? 'default' : 'pointer' }}
            >
              Not now
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={!ready}
              className="rounded-xl px-5 focus:outline-none transition-[transform,opacity] active:scale-[0.97]"
              style={{
                minHeight: 44, fontSize: 14, fontWeight: 600, border: 'none',
                backgroundColor: MAIN, color: ON_MAIN,
                opacity: ready ? 1 : 0.45, cursor: ready ? 'pointer' : 'default',
              }}
            >
              {saving ? 'Saving' : 'Submit review'}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
