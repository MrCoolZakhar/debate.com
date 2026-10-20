'use client';

// ── The apply flow knows which Job Board listing sent the person here ──────
//
// /conferences/[slug]/apply?role=chair&listing=<id> reads the listing once and,
// only when it belongs to THIS conference and THIS role, shows a slim
// "Applying for ..." line and (for a committees-only preference role) offers
// the listing's committee as the first preference while the ranking is still
// empty. Nothing here writes job data: a database trigger links the
// application to the listing. A failed or mismatched read shows nothing.

import { useEffect, useRef, useState } from 'react';
import { Briefcase } from 'lucide-react';
import { fetchJobListing } from '@/lib/jobBoard';

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
