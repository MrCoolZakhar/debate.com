'use client';

// A member's details on the leader card (owner, 20 Oct 2026: "Clicking on the
// person's circle, I should be able to see the details: what they filled out
// as part of their application"). Opened from the avatar or the name in the
// People table. Same frame as the committee pop-up (CommitteePopup PopupShell).
//   big avatar, name, role; email with a copy button; nationality with its
//   round flag; their seat (flag and country, committee emblem and acronym);
//   position paper and payment; then "Application": every question and answer
//   in order ("No answer" when empty).
// The email, nationality and answers come from delegation_member_details
// (member/memberDetails), read only while DELEGATIONS_V2_DB is on; while it is
// false the pop-up shows what the table already knows and no application block.
// Nothing here opens another pop-up: the committee is not a link inside it.

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, Copy } from 'lucide-react';
import { CircleFlag } from '@/components/CircleFlag';
import { SkeletonBlock } from '@/components/Skeleton';
import { getCountryByCode } from '@/lib/countries';
import { cvHref } from '@/lib/cvLink';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { PopupShell } from '../CommitteePopup';
import { DELEGATIONS_V2_DB } from '../v2';
import type { PersonRow } from '../PeopleTable';
import { CommitteeDisc, FONT, INK, INK_SOFT, LINE, RoundAvatar, STROKE } from '../leaderKit';
import { ROLE_WORD, ToneWord } from './memberKit';
import { useMemberDetails } from './memberDetails';

const label: React.CSSProperties = { fontFamily: FONT, fontSize: 12.5, fontWeight: 500, color: INK_SOFT, margin: 0 };
const value: React.CSSProperties = { fontFamily: FONT, fontSize: 14.5, color: INK, margin: 0, lineHeight: 1.4 };

function Field({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 min-w-0" style={{ padding: '12px 0', borderTop: `1px solid ${LINE}` }}>
      <p style={label}>{name}</p>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** A nationality as stored (a code or a name) in words, with what CircleFlag needs. */
function nationalityOf(raw: string): { name: string; code: string | null } {
  if (/^[A-Za-z]{2}$/.test(raw)) {
    const c = getCountryByCode(raw.toUpperCase());
    return { name: c?.name ?? raw.toUpperCase(), code: raw.toUpperCase() };
  }
  return { name: raw, code: null };
}

function CopyEmail({ email }: { email: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      notifyOk('Email copied.');
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1600);
    } catch {
      notifyErr('The email could not be copied. Select it and copy it instead.');
    }
  }, [email]);
  const Icon = copied ? Check : Copy;
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="flex-1 min-w-0 [overflow-wrap:anywhere] select-all" style={value}>{email}</span>
      <button
        type="button"
        onClick={() => { void copy(); }}
        aria-label="Copy email"
        title="Copy email"
        className="inline-flex items-center justify-center flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gv-main)] hover:bg-[#F1ECE1]"
        style={{ width: 40, height: 40, borderRadius: 9, border: 'none', background: 'transparent', color: INK_SOFT, cursor: 'pointer' }}
      >
        <Icon size={17} strokeWidth={STROKE} aria-hidden />
      </button>
    </div>
  );
}

export default function MemberDetailsPopup({ person, onClose }: { person: PersonRow; onClose: () => void }) {
  const state = useMemberDetails(person.application_id);
  const details = state?.kind === 'ok' ? state.details : null;
  const loading = DELEGATIONS_V2_DB && state === null;
  const cv = person.user_id ? cvHref(person.user_id, person.name) : null;
  const nat = details?.nationality ? nationalityOf(details.nationality) : null;
  const seat = person.seat;

  return (
    <PopupShell
      label={person.name}
      onClose={onClose}
      width={520}
      head={(
        <div className="flex items-center gap-4">
          <RoundAvatar name={person.name} url={person.avatar_url} size={88} seed={person.application_id} />
          <div className="min-w-0 flex-1 flex flex-col gap-1">
            <h2 className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 22, fontWeight: 600, color: INK, margin: 0, lineHeight: 1.2 }}>
              {person.name}
              {person.is_me && <span style={{ fontSize: 13, fontWeight: 600, color: 'color-mix(in srgb, var(--gv-accent) 72%, #1C1410)', marginLeft: 8 }}>You</span>}
            </h2>
            <p style={{ fontFamily: FONT, fontSize: 14, color: INK_SOFT, margin: 0 }}>{ROLE_WORD[person.role]}</p>
            {cv && (
              <Link
                href={cv}
                target="_blank"
                rel="noopener"
                className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gv-main)] rounded self-start"
                style={{ fontFamily: FONT, fontSize: 13.5, fontWeight: 700, color: 'var(--gv-main)', textDecoration: 'underline', textUnderlineOffset: 3 }}
              >
                View MUN CV
              </Link>
            )}
          </div>
        </div>
      )}
    >
      <div style={{ marginTop: 18 }}>
        {loading && (
          <Field name="Email"><SkeletonBlock width="70%" height={14} /></Field>
        )}
        {details?.email && (
          <Field name="Email"><CopyEmail email={details.email} /></Field>
        )}
        {loading && (
          <Field name="Nationality"><SkeletonBlock width="40%" height={14} /></Field>
        )}
        {nat && (
          <Field name="Nationality">
            <span className="inline-flex items-center gap-2 [overflow-wrap:anywhere]" style={value}>
              <CircleFlag code={nat.code} country={nat.code ? null : nat.name} label={nat.name} size={22} decorative />
              {nat.name}
            </span>
          </Field>
        )}
        <Field name="Seat">
          {seat ? (
            <div className="flex items-center flex-wrap gap-x-5 gap-y-2 min-w-0">
              <span className="inline-flex items-center gap-2 min-w-0 [overflow-wrap:anywhere]" style={{ ...value, fontWeight: 500 }}>
                <CircleFlag code={seat.country_code} logoUrl={seat.seatLogo} label={seat.country_name} size={32} decorative />
                {seat.country_name}
              </span>
              <span className="inline-flex items-center gap-2 min-w-0" style={value}>
                <CommitteeDisc src={seat.emblem} size={28} />
                <span className="flex flex-col min-w-0">
                  <span className="[overflow-wrap:anywhere]" style={{ fontWeight: 600 }}>{seat.committee_label}</span>
                  {seat.committee_full && seat.committee_full.trim() !== seat.committee_label.trim() && (
                    <span className="[overflow-wrap:anywhere]" style={{ fontSize: 12.5, color: INK_SOFT }}>{seat.committee_full}</span>
                  )}
                </span>
              </span>
            </div>
          ) : (
            <span style={{ ...value, color: INK_SOFT }}>{person.role === 'faculty-advisor' ? 'Advisors have no seat' : 'No seat yet'}</span>
          )}
        </Field>
        {person.paper && (
          <Field name="Position paper"><ToneWord word={person.paper.word} tone={person.paper.tone} /></Field>
        )}
        {person.pay && (
          <Field name="Payment"><ToneWord word={person.pay.word} tone={person.pay.tone} /></Field>
        )}
      </div>

      {DELEGATIONS_V2_DB && (
        <div style={{ marginTop: 14 }}>
          <h3 style={{ fontFamily: FONT, fontSize: 17, fontWeight: 600, color: INK, margin: '0 0 4px 0' }}>Application</h3>
          {state === null ? (
            <div className="flex flex-col gap-3" aria-busy="true" style={{ paddingTop: 8 }}>
              {[0, 1, 2].map(i => (
                <div key={i} className="flex flex-col gap-1.5">
                  <SkeletonBlock width="55%" height={12} />
                  <SkeletonBlock width="85%" height={14} />
                </div>
              ))}
            </div>
          ) : state.kind === 'error' ? (
            <p style={{ ...value, color: INK_SOFT, paddingTop: 6 }}>Their application could not be loaded. Try again later.</p>
          ) : state.details.answers.length === 0 ? (
            <p style={{ ...value, color: INK_SOFT, paddingTop: 6 }}>This application has no questions.</p>
          ) : (
            <div className="flex flex-col">
              {state.details.answers.map((a, i) => (
                <div key={i} className="flex flex-col gap-1 min-w-0" style={{ padding: '12px 0', borderTop: i > 0 ? `1px solid ${LINE}` : 'none' }}>
                  <p className="[overflow-wrap:anywhere]" style={{ ...label, fontSize: 13.5, lineHeight: 1.4 }}>{a.question}</p>
                  {a.answer ? (
                    <p className="[overflow-wrap:anywhere]" style={{ ...value, whiteSpace: 'pre-wrap' }}>{a.answer}</p>
                  ) : (
                    <p style={{ ...value, color: INK_SOFT }}>No answer</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </PopupShell>
  );
}
