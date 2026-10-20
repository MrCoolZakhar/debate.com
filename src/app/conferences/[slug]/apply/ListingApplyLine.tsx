'use client';

// ── The apply flow knows which Job Board listing sent the person here ──────
//
// /conferences/[slug]/apply?role=chair&listing=<id> reads the listing once and,
// only when it belongs to THIS conference and THIS role, shows a slim
// "Applying for ..." line and (for a committees-only preference role) offers
// the listing's committee as the first preference while the ranking is still
// empty. Nothing here writes job data: a database trigger links the
// application to the listing. A failed or mismatched read shows nothing.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Briefcase } from 'lucide-react';
import { claimJobScreening, clearJobAnswers, fetchJobListing, readJobAnswers } from '@/lib/jobBoard';
import { reportBlocked } from '@/lib/reportCrash';

export interface ApplyListing {
  id: string;
  title: string;
  committee: string | null;
  committeeId: string | null;
}

/** The listing behind ?listing=<id>, or null (no param, failed read, or a
 *  listing for another conference or role). */
export function useListingForApply(listingId: string | null, slug: string, role: string): ApplyListing | null {
  // Keyed by the request, so a changed param never shows the old listing.
  const key = listingId ? `${listingId}|${slug}|${role}` : null;
  const [found, setFound] = useState<{ key: string; listing: ApplyListing } | null>(null);
  useEffect(() => {
    if (!listingId || !key) return;
    let cancelled = false;
    fetchJobListing(listingId).then(res => {
      if (cancelled || !res.ok) return;
      const l = res.listing;
      if (!l || l.conference?.slug !== slug || l.role !== role) return;
      setFound({ key, listing: { id: l.id, title: l.title, committee: l.committee, committeeId: l.committee_id } });
    }).catch(() => { /* silent: the line is a courtesy */ });
    return () => { cancelled = true; };
  }, [listingId, slug, role, key]);
  return found && found.key === key ? found.listing : null;
}

/**
 * Puts the listing's committee in as the 1st preference ONCE, when:
 * `ready` (the form has loaded and any draft restore has been settled),
 * `enabled` (a committees-only preference role, not edit mode, no saved
 * draft), the committee is one of the offered committees, and the ranking is
 * still empty. The ref is set the first time the decision is made, whatever
 * it is, so clearing the preference never brings it back.
 */
export function useListingCommitteePrefill<C extends { id: string; name: string }>(
  listing: ApplyListing | null,
  opts: { ready: boolean; enabled: boolean; committees: C[]; prefillIfEmpty: (committee: C) => void },
): void {
  const doneRef = useRef(false);
  const { ready, enabled, committees, prefillIfEmpty } = opts;
  useEffect(() => {
    if (doneRef.current || !listing || !ready) return;
    doneRef.current = true;
    if (!enabled || !listing.committeeId) return;
    const c = committees.find(x => x.id === listing.committeeId);
    if (c) prefillIfEmpty(c);
  }, [listing, ready, enabled, committees, prefillIfEmpty]);
}

/** The slim line at the top of the form, in the conference's own colours. */
export function ListingApplyLine({ listing }: { listing: ApplyListing | null }) {
  if (!listing) return null;
  return (
    <div className="w-full mx-auto mb-4" style={{ maxWidth: 720 }}>
      <div
        className="flex items-start gap-2.5 rounded-xl px-4 py-2.5"
        style={{
          backgroundColor: 'color-mix(in srgb, var(--gv-main) 7%, transparent)',
          border: '1px solid color-mix(in srgb, var(--gv-main) 18%, transparent)',
        }}
        role="status"
      >
        <Briefcase size={15} strokeWidth={2.2} style={{ color: 'var(--gv-main)', flexShrink: 0, marginTop: 2 }} aria-hidden />
        <p
          className="[overflow-wrap:anywhere]"
          style={{ margin: 0, fontFamily: 'var(--font-brand), sans-serif', fontSize: 13, lineHeight: 1.45, color: 'var(--gv-on-surface)' }}
        >
          Applying for <strong style={{ fontWeight: 700, color: 'var(--gv-main)' }}>{listing.title}</strong>
          {listing.committee && (
            <span style={{ color: 'var(--gv-muted)' }}> in {listing.committee}</span>
          )}
        </p>
      </div>
    </div>
  );
}

// ── Answers given signed out (Job Board prompt 5) ───────────────────────────
//
// /jobs lets people answer a listing's questions signed out; the answers wait
// on this device (readJobAnswers). Once the person is signed in and has an
// application for the listing's role, job_claim_screening saves them and adds
// the listing as their next ranked pick, with no email:
//   - right after a NEW application is submitted (claimAfterSubmit, awaited
//     in handleSubmit before the confirmation redirect; it never throws and
//     never blocks the submission, a failure is reported with reportBlocked);
//   - once, when they already have one (edit mode or "You've Already Applied"):
//     its sentence shows in the ListingApplyLine spot (ListingClaimNote).
// The stored answers are cleared on ok or stopped. Without stored answers, or
// signed out, nothing happens: the trigger links people who answered signed in.

export type ListingClaimNoteValue = { text: string; good: boolean } | null;

export function useListingClaim(
  listing: ApplyListing | null,
  opts: { signedIn: boolean; hasApplication: boolean },
): { note: ListingClaimNoteValue; claimAfterSubmit: () => Promise<void> } {
  const [note, setNote] = useState<ListingClaimNoteValue>(null);
  const doneRef = useRef(false);
  const { signedIn, hasApplication } = opts;

  const run = useCallback(async (): Promise<ListingClaimNoteValue> => {
    if (!listing || doneRef.current) return null;
    const answers = readJobAnswers(listing.id);
    if (!answers) return null;
    doneRef.current = true;
    const res = await claimJobScreening(listing.id, answers);
    if (res.ok) {
      clearJobAnswers(listing.id);
      return res.unchanged || !res.message ? null : { text: res.message, good: true };
    }
    if (res.stopped) {
      clearJobAnswers(listing.id);
      return { text: res.message, good: false };
    }
    // no_application, a field problem or a failed call: keep the answers for a later try.
    doneRef.current = false;
    if (res.code !== 'no_application') reportBlocked('claim job screening', new Error(res.message), { listingId: listing.id });
    return null;
  }, [listing]);

  // Already applied: claim once and say what happened.
  useEffect(() => {
    if (!signedIn || !hasApplication || !listing) return;
    let cancelled = false;
    void run().then((n) => { if (!cancelled && n) setNote(n); });
    return () => { cancelled = true; };
  }, [signedIn, hasApplication, listing, run]);

  const claimAfterSubmit = useCallback(async () => {
    if (!signedIn) return;
    try { await run(); } catch (e) { reportBlocked('claim job screening', e, { listingId: listing?.id ?? null }); }
  }, [signedIn, run, listing]);

  return { note, claimAfterSubmit };
}

/** The claim's sentence, in the conference's colours ("Added to your chair application at LIMUN"). */
export function ListingClaimNote({ note, center = false }: { note: ListingClaimNoteValue; center?: boolean }) {
  if (!note) return null;
  return (
    <p
      role="status"
      className="[overflow-wrap:anywhere]"
      style={{
        margin: center ? '0 0 16px' : '0 auto 16px', maxWidth: center ? undefined : 720, padding: '10px 14px', borderRadius: 12,
        fontFamily: 'var(--font-brand), sans-serif', fontSize: 13.5, lineHeight: 1.45,
        color: 'var(--gv-on-surface)',
        backgroundColor: note.good ? 'color-mix(in srgb, var(--gv-main) 8%, transparent)' : 'color-mix(in srgb, var(--gv-accent) 18%, transparent)',
        border: `1px solid ${note.good ? 'color-mix(in srgb, var(--gv-main) 20%, transparent)' : 'color-mix(in srgb, var(--gv-accent) 40%, transparent)'}`,
      }}
    >
      {note.text}
    </p>
  );
}
