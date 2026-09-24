'use client';

/**
 * "Needs your attention": the top section of the profile menu (ProfileDropdown)
 * and of the SiteNav phone sheet. Every row is a link straight to the place the
 * thing is done: pay, read the reply, finish the draft, review the
 * applications. Data and rules: src/lib/myActivity.ts.
 *
 * Invitations are answered IN PLACE (24 Sep 2026, owner: "inviting a chair that
 * already has an account shows up there with an accept or reject, with their
 * committee"). A chair invite row shows the committee (acronym over the full
 * name, its emblem with the conference logo on the corner) and Accept /
 * Decline, calling the SAME RPC as /invites/chair/<token>
 * (`respond_chair_invite`); a co-organiser invite does the same with
 * `respond_organizer_invite`. "Details" opens the full invite page. Decline asks
 * once more first. Neither RPC queues any email.
 *
 * Each row that feeds the avatar's counts carries a small dot in its colour
 * (red = messages and drafts, orange = everything else new); an organiser's
 * applications row says how many are new in orange.
 *
 * Renders nothing when there is nothing (or when the read failed). At most six
 * rows, then a quiet "N more" line to /my-conferences.
 */

import Link from 'next/link';
import { useState } from 'react';
import {
  Gavel, UserPlus, Ticket, CreditCard, FileWarning, MessageSquareText, FileClock, MapPin, BadgeCheck,
  ClipboardList, Receipt, Inbox, HandCoins, ChevronRight, Check, X, type LucideIcon,
} from 'lucide-react';
import { CircleFlag } from '@/components/CircleFlag';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { friendlyError } from '@/lib/friendlyError';
import { reportBlocked } from '@/lib/reportCrash';
import {
  removeActivityItem, activityWeight, useOpenSeenState,
  type ActivityItem, type ActivityKind,
} from '@/lib/myActivity';

const FONT = "'Outfit', sans-serif";
const INK = '#1C1410';
const INK_SOFT = '#5C4A3A';
const FOREST = '#1B3828';
const RED_DOT = '#C81E1E';
const ORANGE_DOT = '#EA6A12';
const ORANGE_TEXT = '#A8440A';

interface KindLook { icon: LucideIcon; fg: string; bg: string }
const LOOK: Record<ActivityKind, KindLook> = {
  chair_invite: { icon: Gavel, fg: '#2A5A3C', bg: 'rgba(61,122,82,0.14)' },
  organiser_invite: { icon: UserPlus, fg: '#2A5A3C', bg: 'rgba(61,122,82,0.14)' },
  import_invite: { icon: Ticket, fg: '#2A5A3C', bg: 'rgba(61,122,82,0.14)' },
  proof_rejected: { icon: FileWarning, fg: '#8B2020', bg: 'rgba(139,32,32,0.10)' },
  payment_due: { icon: CreditCard, fg: '#8B2020', bg: 'rgba(139,32,32,0.10)' },
  reply: { icon: MessageSquareText, fg: '#2F6076', bg: 'rgba(47,96,118,0.12)' },
  draft: { icon: FileClock, fg: '#8A6614', bg: 'rgba(182,135,31,0.16)' },
  allocation: { icon: MapPin, fg: '#2A5A3C', bg: 'rgba(61,122,82,0.14)' },
  accepted: { icon: BadgeCheck, fg: '#2A5A3C', bg: 'rgba(61,122,82,0.14)' },
  org_applications: { icon: ClipboardList, fg: '#1B3828', bg: 'rgba(27,56,40,0.10)' },
  org_proofs: { icon: Receipt, fg: '#1B3828', bg: 'rgba(27,56,40,0.10)' },
  org_inbox: { icon: Inbox, fg: '#1B3828', bg: 'rgba(27,56,40,0.10)' },
  org_aid: { icon: HandCoins, fg: '#1B3828', bg: 'rgba(27,56,40,0.10)' },
};

function RoundPicture({ src, size, onFail }: { src: string; size: number; onFail: () => void }) {
  return (
    <span
      className="flex items-center justify-center overflow-hidden rounded-full"
      style={{ width: size, height: size, backgroundColor: '#FFFEFA', boxShadow: 'inset 0 0 0 0.5px #E7E0CF' }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" onError={onFail} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 3 }} />
    </span>
  );
}

/** Conference logo (or the allocated flag, or the invited committee's emblem)
 *  with a small corner mark; the kind's icon on its tinted disc otherwise. */
function Mark({ item, size }: { item: ActivityItem; size: number }) {
  const look = LOOK[item.kind];
  const Icon = look.icon;
  const [logoFailed, setLogoFailed] = useState(false);
  const [committeeFailed, setCommitteeFailed] = useState(false);
  const badge = Math.round(size * 0.52);

  if (item.kind === 'allocation' && (item.countryCode || item.countryName)) {
    return (
      <span className="relative shrink-0" style={{ width: size, height: size }}>
        <CircleFlag code={item.countryCode} country={item.countryName} size={size} decorative />
      </span>
    );
  }

  // Chair invite: the committee's emblem, the conference logo on its corner.
  if (item.kind === 'chair_invite' && item.committeeLogo && !committeeFailed) {
    return (
      <span className="relative shrink-0" style={{ width: size, height: size }}>
        <RoundPicture src={item.committeeLogo} size={size} onFail={() => setCommitteeFailed(true)} />
        <span
          aria-hidden
          className="absolute flex items-center justify-center overflow-hidden rounded-full"
          style={{ width: badge, height: badge, right: -3, bottom: -3, backgroundColor: '#FFFEFA', boxShadow: '0 0 0 1.5px #FAF8F3' }}
        >
          {item.logoUrl && !logoFailed ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={item.logoUrl} alt="" onError={() => setLogoFailed(true)}
              style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 1.5 }} />
          ) : (
            <span className="flex items-center justify-center rounded-full" style={{ width: badge, height: badge, backgroundColor: look.bg }}>
              <Icon size={Math.round(badge * 0.62)} strokeWidth={2.4} style={{ color: look.fg }} />
            </span>
          )}
        </span>
      </span>
    );
  }

  if (item.logoUrl && !logoFailed) {
    return (
      <span className="relative shrink-0" style={{ width: size, height: size }}>
        <RoundPicture src={item.logoUrl} size={size} onFail={() => setLogoFailed(true)} />
        <span
          aria-hidden
          className="absolute flex items-center justify-center rounded-full"
          style={{ width: badge, height: badge, right: -3, bottom: -3, backgroundColor: '#FAF8F3', boxShadow: '0 0 0 1.5px #FAF8F3' }}
        >
          <span className="flex items-center justify-center rounded-full" style={{ width: badge, height: badge, backgroundColor: look.bg }}>
            <Icon size={Math.round(badge * 0.62)} strokeWidth={2.4} style={{ color: look.fg }} />
          </span>
        </span>
      </span>
    );
  }

  return (
    <span className="flex shrink-0 items-center justify-center rounded-full" style={{ width: size, height: size, backgroundColor: look.bg }}>
      <Icon size={Math.round(size * 0.5)} strokeWidth={2.2} style={{ color: look.fg }} />
    </span>
  );
}

/** The colour dot of a row that feeds the avatar's counts. */
function ToneDot({ item, counts }: { item: ActivityItem; counts: boolean }) {
  if (!counts) return null;
  const red = item.tone === 'red';
  return (
    <span
      aria-hidden
      className="inline-block shrink-0 rounded-full"
      style={{ width: 7, height: 7, backgroundColor: red ? RED_DOT : ORANGE_DOT }}
    />
  );
}

const MAX_ROWS = 6;

/** A chair or co-organiser invitation, answered in place. */
function InviteRow({ item, sheet, onNavigate }: { item: ActivityItem; sheet: boolean; onNavigate: () => void }) {
  const { user, session } = useAuth();
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null);
  const [confirmDecline, setConfirmDecline] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<null | 'accepted' | 'declined'>(null);
  const [doneHref, setDoneHref] = useState<string | null>(null);
  const chair = item.kind === 'chair_invite';

  async function respond(accept: boolean) {
    if (!session || !user || !item.token || busy) return;
    setBusy(accept ? 'accept' : 'decline');
    setError('');
    const rpc = chair ? 'respond_chair_invite' : 'respond_organizer_invite';
    const { data, error: rpcErr } = await getAuthedClient(session.access_token)
      .rpc(rpc, { p_token: item.token, p_accept: accept });
    setBusy(null);
    const result = data as { ok: boolean; error?: string; slug?: string } | null;
    if (rpcErr || !result?.ok) {
      const wrongAccount = !rpcErr && !!result?.error && /Sign in with that email|different account/i.test(result.error);
      if (accept && !wrongAccount) {
        reportBlocked(chair ? 'accept chair invite (menu)' : 'accept organizer invite (menu)',
          rpcErr ?? new Error(result?.error ?? 'rpc returned ok:false'), { conference: item.conference });
      }
      // result.error is a sentence written by the RPC for people.
      setError((rpcErr ? friendlyError(rpcErr, 'Could not answer this invitation. Try again, or open it.') : result?.error)
        || 'Could not answer this invitation. Try again, or open it.');
      return;
    }
    setDone(accept ? 'accepted' : 'declined');
    if (accept) setDoneHref(chair ? '/my-conferences?tab=chair&chairInvite=accepted' : result.slug ? `/manage/${result.slug}` : null);
    // The row stays with its answer for a moment, then the list re-reads.
    window.setTimeout(() => removeActivityItem(user.id, item.id), accept ? 6000 : 2500);
  }

  const who = chair ? (item.committeeAbbr ?? item.committeeName) : null;
  const titleSize = sheet ? 13.5 : 12.5;
  const detailSize = sheet ? 12 : 11;
  const btnH = sheet ? 40 : 30;

  return (
    <div className="px-4" style={{ paddingTop: 8, paddingBottom: 8 }}>
      <div className="flex items-start gap-2.5">
        <Mark item={item} size={sheet ? 34 : 32} />
        <div className="min-w-0 flex-1">
          <p className="m-0 font-semibold" style={{ color: INK, fontSize: titleSize, lineHeight: 1.25 }}>
            {chair ? (
              <>
                {who ? <>Chair <span style={{ color: FOREST }}>{who}</span></> : 'Chair invitation'}
                <span style={{ color: INK_SOFT, fontWeight: 500 }}> at {item.conference}</span>
              </>
            ) : item.title}
          </p>
          <p className="m-0" style={{ color: INK_SOFT, fontSize: detailSize, lineHeight: 1.3 }}>
            {chair
              ? [item.committeeName && item.committeeName !== who ? item.committeeName : null, item.roleTitle ? `As ${item.roleTitle}` : null]
                  .filter(Boolean).join('. ') || 'You are invited to chair this committee.'
              : item.detail}
          </p>
        </div>
        <ToneDot item={item} counts={!done} />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5" style={{ paddingInlineStart: (sheet ? 34 : 32) + 10 }}>
        {done ? (
          <p role="status" className="m-0 flex items-center gap-1.5 font-semibold" style={{ color: done === 'accepted' ? '#2A5A3C' : INK_SOFT, fontSize: detailSize + 0.5 }}>
            {done === 'accepted' ? <Check size={14} strokeWidth={2.6} aria-hidden /> : <X size={14} strokeWidth={2.4} aria-hidden />}
            {done === 'accepted' ? (chair ? `You chair ${who ?? 'this committee'}.` : 'You joined the secretariat.') : 'Invitation declined.'}
            {done === 'accepted' && doneHref && (
              <Link href={doneHref} onClick={onNavigate} className="ms-1 underline focus:outline-none" style={{ color: FOREST }}>
                {chair ? 'My conferences' : 'Open dashboard'}
              </Link>
            )}
          </p>
        ) : confirmDecline ? (
          <>
            <span style={{ color: INK, fontSize: detailSize + 0.5, fontWeight: 600 }}>Decline this invitation?</span>
            <button
              type="button"
              onClick={() => void respond(false)}
              disabled={!!busy}
              className="rounded-full px-3 font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] disabled:opacity-60"
              style={{ height: btnH, fontSize: detailSize + 0.5, backgroundColor: '#8B2020', color: '#FFF6EC', border: 'none', cursor: 'pointer' }}
            >
              {busy === 'decline' ? 'Declining' : 'Decline'}
            </button>
            <button
              type="button"
              onClick={() => setConfirmDecline(false)}
              disabled={!!busy}
              className="rounded-full px-3 font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F]"
              style={{ height: btnH, fontSize: detailSize + 0.5, backgroundColor: 'transparent', color: INK, border: 'none', boxShadow: 'inset 0 0 0 1px #D6CCB6', cursor: 'pointer' }}
            >
              Keep it
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => void respond(true)}
              disabled={!!busy}
              className="inline-flex items-center gap-1 rounded-full px-3 font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] disabled:opacity-60 active:scale-[0.97]"
              style={{ height: btnH, fontSize: detailSize + 0.5, backgroundColor: FOREST, color: '#EED98A', border: 'none', cursor: 'pointer', transitionProperty: 'transform', transitionDuration: '120ms' }}
            >
              <Check size={13} strokeWidth={2.6} aria-hidden />
              {busy === 'accept' ? 'Accepting' : 'Accept'}
            </button>
            <button
              type="button"
              onClick={() => { setError(''); setConfirmDecline(true); }}
              disabled={!!busy}
              className="inline-flex items-center gap-1 rounded-full px-3 font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] disabled:opacity-60"
              style={{ height: btnH, fontSize: detailSize + 0.5, backgroundColor: 'transparent', color: INK, border: 'none', boxShadow: 'inset 0 0 0 1px #D6CCB6', cursor: 'pointer' }}
            >
              <X size={13} strokeWidth={2.4} aria-hidden />
              Decline
            </button>
            <Link
              href={item.href}
              onClick={onNavigate}
              className="ms-auto inline-flex items-center gap-0.5 font-semibold focus:outline-none focus-visible:underline hover:underline"
              style={{ color: FOREST, fontSize: detailSize, textDecoration: 'none' }}
            >
              Details
              <ChevronRight aria-hidden size={13} strokeWidth={2.2} className="rtl:rotate-180" />
            </Link>
          </>
        )}
      </div>
      {error && (
        <p role="alert" className="m-0 mt-1.5" style={{ color: '#8B2020', fontSize: detailSize, lineHeight: 1.35, paddingInlineStart: (sheet ? 34 : 32) + 10 }}>
          {error}
        </p>
      )}
    </div>
  );
}

export default function ActivityNotices({
  items,
  onNavigate,
  variant = 'menu',
}: {
  /** Already filtered to what should show (isVisibleActivity). */
  items: ActivityItem[];
  onNavigate: () => void;
  /** `sheet` = the SiteNav phone sheet: 44px rows, no own background band. */
  variant?: 'menu' | 'sheet';
}) {
  const { user } = useAuth();
  // The seen state before this opening's stamp decides which rows still carry a dot.
  const seen = useOpenSeenState(user?.id ?? null);
  if (items.length === 0) return null;
  const sheet = variant === 'sheet';
  const shown = items.slice(0, MAX_ROWS);
  const more = items.length - shown.length;

  return (
    <section
      aria-label="Needs your attention"
      className={sheet ? 'pb-1' : 'pt-2.5 pb-1.5'}
      style={{ fontFamily: FONT, backgroundColor: sheet ? 'transparent' : 'rgba(182,135,31,0.06)' }}
    >
      <p
        className="flex items-center gap-1.5 px-4 pb-1.5 font-bold"
        style={{ color: '#8A6614', fontSize: 10, letterSpacing: '0.08em' }}
      >
        <span aria-hidden className="inline-block rounded-full" style={{ width: 7, height: 7, backgroundColor: '#B6871F', boxShadow: '0 0 0 3px rgba(182,135,31,0.18)' }} />
        NEEDS YOUR ATTENTION
        <span className="ms-auto" style={{ color: '#8A6614', fontVariantNumeric: 'tabular-nums' }}>{items.length}</span>
      </p>
      <ul className="m-0 list-none p-0">
        {shown.map((item) => {
          if ((item.kind === 'chair_invite' || item.kind === 'organiser_invite') && item.token) {
            return (
              <li key={item.id}>
                <InviteRow item={item} sheet={sheet} onNavigate={onNavigate} />
              </li>
            );
          }
          // What made this row count: the open menu stamps news as seen, but the
          // dot should still say why it is here, so it reads the stamp from BEFORE
          // this opening via openShown (the item was unseen when the menu opened).
          const counts = item.action
            ? (item.kind === 'org_applications' ? item.newCount > 0 && (activityWeight(item, seen) > 0 || seen.openShown.has(item.id)) : true)
            : true;
          const fresh = item.kind === 'org_applications' && item.newCount > 0 && counts;
          return (
            <li key={item.id}>
              <Link
                href={item.href}
                onClick={onNavigate}
                className="group flex items-center gap-2.5 px-4 focus:outline-none focus-visible:bg-[rgba(27,56,40,0.07)] hover:bg-[rgba(27,56,40,0.05)] transition-colors"
                style={{ textDecoration: 'none', minHeight: sheet ? 48 : 44, paddingTop: 6, paddingBottom: 6 }}
              >
                <Mark item={item} size={sheet ? 30 : 28} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold" style={{ color: INK, fontSize: sheet ? 13.5 : 12.5, lineHeight: 1.25 }}>
                    {item.title}
                  </span>
                  <span className="block truncate" title={item.detail} style={{ color: INK_SOFT, fontSize: sheet ? 12 : 11, lineHeight: 1.3 }}>
                    {fresh && (
                      <span className="font-semibold" style={{ color: ORANGE_TEXT }}>{item.newCount} new · </span>
                    )}
                    {item.detail}
                  </span>
                </span>
                <ToneDot item={item} counts={counts} />
                <ChevronRight
                  aria-hidden
                  size={14}
                  strokeWidth={2.2}
                  className="shrink-0 transition-transform group-hover:translate-x-0.5 rtl:rotate-180"
                  style={{ color: '#9A8A78' }}
                />
              </Link>
            </li>
          );
        })}
      </ul>
      {more > 0 && (
        <Link
          href="/my-conferences"
          onClick={onNavigate}
          className="block px-4 py-1.5 font-semibold focus:outline-none hover:underline"
          style={{ color: '#1B3828', fontSize: 11, textDecoration: 'none' }}
        >
          {more} more in My conferences
        </Link>
      )}
    </section>
  );
}
