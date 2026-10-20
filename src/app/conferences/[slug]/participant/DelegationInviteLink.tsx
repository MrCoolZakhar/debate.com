'use client';

// The delegation's invite link on the leader card, for its head delegates and
// faculty advisors (owners, 11 Oct 2026: brought back after the /delegation
// portal went, so a leader can always bring people in, whether or not the
// conference allows imports).
//
// Owner, 20 Oct 2026: "should always be there", short and not ugly. The link
// itself is shown as text in a small field with a Copy button, read when the
// card opens (no press needed to reveal it):
//   - DELEGATIONS_V2_DB on: the short form https://gavelling.com/i/<code>
//     (delegation_invite_short_code; src/app/i/[code] resolves it and sends the
//     visitor on to /invites/delegation/<token>)
//   - otherwise, or when the short read fails: today's long link,
//     /invites/delegation/<token>, from create_delegation_invite (leader-checked
//     in the database, the same token every time)
// The link starts from this site's own origin, which is https://gavelling.com
// in production. /invites/delegation/<token> decides everything: no
// application yet → the delegate application with this delegation filled in;
// an existing application → added to the delegation; another delegation →
// asked before moving; leaders, chairs and observers are never moved.

import { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { friendlyError, plainOrFallback } from '@/lib/friendlyError';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { OUTFIT } from '@/components/neu';
import { DELEGATIONS_V2_DB, readInviteShortCode } from './delegation/v2';

const FALLBACK = 'The invite link could not be made. Try again.';

async function readInviteLink(societyId: string, conferenceId: string): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const origin = window.location.origin;
  if (DELEGATIONS_V2_DB) {
    const code = await readInviteShortCode(societyId);
    if (code) return { ok: true, url: `${origin}/i/${encodeURIComponent(code)}` };
  }
  try {
    const client = await getFreshAuthedClient();
    if (!client) return { ok: false, error: 'Your session has expired. Refresh the page and sign in again.' };
    const { data, error } = await client.rpc('create_delegation_invite', { p_society_id: societyId, p_conference_id: conferenceId });
    if (error) return { ok: false, error: friendlyError(error, FALLBACK) };
    const r = (data ?? {}) as { ok?: boolean; token?: string; error?: string };
    if (r.ok !== true || !r.token) return { ok: false, error: plainOrFallback(r.error, FALLBACK) };
    return { ok: true, url: `${origin}/invites/delegation/${r.token}` };
  } catch (e) {
    return { ok: false, error: friendlyError(e, FALLBACK) };
  }
}

export default function DelegationInviteLink({ societyId, conferenceId }: {
  societyId: string;
  conferenceId: string;
}) {
  const [link, setLink] = useState<{ key: string; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const key = `${societyId}|${conferenceId}`;

  // Read once per delegation (and on Try again). Keyed on ids, never a token;
  // a re-read never blanks a link already shown.
  useEffect(() => {
    let alive = true;
    void readInviteLink(societyId, conferenceId).then(r => {
      if (!alive) return;
      if (r.ok) { setLink({ key: `${societyId}|${conferenceId}`, url: r.url }); setError(null); }
      else setError(r.error);
    });
    return () => { alive = false; };
  }, [societyId, conferenceId, attempt]);

  const url = link?.key === key ? link.url : null;
  // Shown without the scheme; copied whole.
  const shown = url ? url.replace(/^https?:\/\//, '') : null;

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      notifyOk('Invite link copied');
      window.setTimeout(() => setCopied(false), 2400);
    } catch {
      notifyErr('Copying did not work. Select the link and copy it.');
    }
  };

  return (
    <div className="flex flex-col gap-1.5 min-w-0" style={{ width: 'min(100%, 400px)' }}>
      <span style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 600, color: '#6B5F52' }}>Invite link</span>
      <div className="flex items-stretch gap-2 min-w-0">
        <div
          className="flex-1 min-w-0 flex items-center"
          title={url ?? undefined}
          style={{
            minHeight: 44, padding: '8px 12px', borderRadius: 10, background: '#FBF9F4',
            border: '1px solid color-mix(in srgb, var(--gv-main) 14%, transparent)',
          }}
        >
          {shown ? (
            <span className="[overflow-wrap:anywhere]" style={{ fontFamily: OUTFIT, fontSize: 13.5, fontWeight: 600, color: 'var(--gv-main)', userSelect: 'all', lineHeight: 1.35 }}>
              {shown}
            </span>
          ) : (
            <span aria-hidden className="animate-pulse" style={{ display: 'block', width: '78%', height: 12, borderRadius: 6, background: 'rgba(28,20,16,0.08)' }} />
          )}
        </div>
        <button
          type="button"
          onClick={() => { void copy(); }}
          disabled={!url}
          aria-label={copied ? 'Invite link copied' : 'Copy invite link'}
          className="inline-flex items-center justify-center gap-1.5 flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--gv-accent)]"
          style={{
            minHeight: 44, padding: '0 14px', borderRadius: 10,
            border: '1px solid color-mix(in srgb, var(--gv-main) 16%, transparent)', background: '#FFFFFF', color: 'var(--gv-main)',
            fontFamily: OUTFIT, fontSize: 14, fontWeight: 600, cursor: url ? 'pointer' : 'default', opacity: url ? 1 : 0.5,
          }}
        >
          {copied ? <Check size={16} strokeWidth={1.8} aria-hidden /> : <Copy size={16} strokeWidth={1.8} aria-hidden />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      {error && !url && (
        <p role="alert" style={{ fontFamily: OUTFIT, fontSize: 13, color: '#8B2020', margin: 0 }}>
          {error}{' '}
          <button
            type="button"
            onClick={() => { setError(null); setAttempt(n => n + 1); }}
            className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gv-accent)] rounded"
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: OUTFIT, fontSize: 13, fontWeight: 700, color: 'var(--gv-main)', textDecoration: 'underline', textUnderlineOffset: 3 }}
          >
            Try again
          </button>
        </p>
      )}
    </div>
  );
}
