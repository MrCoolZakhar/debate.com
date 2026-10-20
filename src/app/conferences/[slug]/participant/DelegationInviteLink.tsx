'use client';

// "Invite link" on the delegation card, for the delegation's head delegates
// and faculty advisors (owners, 11 Oct 2026: brought back after the /delegation
// portal went, so a leader can always bring people in, whether or not the
// conference allows imports).
//
// The link is the delegation's one invite token from create_delegation_invite
// (leader-checked in the database, the same token every time). It opens
// /invites/delegation/<token>, which already decides everything: no
// application yet → the delegate application with this delegation filled in;
// an existing application → added to the delegation; another delegation →
// asked before moving; leaders, chairs and observers are never moved.

import { useState } from 'react';
import { Check, Link2 } from 'lucide-react';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { friendlyError, plainOrFallback } from '@/lib/friendlyError';
import { OUTFIT } from '@/components/neu';

export default function DelegationInviteLink({ societyId, conferenceId, buttonStyle, iconStroke = 2.4 }: {
  societyId: string;
  conferenceId: string;
  /** The leader card's own button look, laid over the default. */
  buttonStyle?: React.CSSProperties;
  iconStroke?: number;
}) {
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2400);
    } catch {
      // Clipboard blocked: the link is shown below to copy by hand.
    }
  };

  const onPress = async () => {
    setError(null);
    if (link) { void copy(link); return; }
    setBusy(true);
    try {
      const client = await getFreshAuthedClient();
      if (!client) throw new Error('signed out');
      const { data, error: rpcError } = await client.rpc('create_delegation_invite', {
        p_society_id: societyId,
        p_conference_id: conferenceId,
      });
      if (rpcError) throw rpcError;
      const r = (data ?? {}) as { ok?: boolean; token?: string; error?: string };
      if (r.ok !== true || !r.token) {
        setError(plainOrFallback(r.error, 'The invite link could not be made. Try again.'));
        return;
      }
      const url = `${window.location.origin}/invites/delegation/${r.token}`;
      setLink(url);
      void copy(url);
    } catch (e) {
      setError(friendlyError(e, 'The invite link could not be made. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-start gap-1.5" style={{ maxWidth: '100%' }}>
      <button
        type="button"
        onClick={onPress}
        disabled={busy}
        aria-live="polite"
        className="inline-flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--gv-accent)]"
        style={{
          minHeight: 44, padding: '0 16px', borderRadius: 10,
          border: '1.5px solid color-mix(in srgb, var(--gv-main) 55%, transparent)', background: '#FFFFFF', color: 'var(--gv-main)',
          fontFamily: OUTFIT, fontSize: 14, fontWeight: 700,
          ...buttonStyle,
          cursor: busy ? 'wait' : 'pointer',
        }}
      >
        {copied ? <Check size={16} strokeWidth={iconStroke} aria-hidden /> : <Link2 size={16} strokeWidth={iconStroke} aria-hidden />}
        {copied ? 'Link copied' : busy ? 'Making your link' : 'Copy invite link'}
      </button>
      {link && (
        <p style={{ fontFamily: OUTFIT, fontSize: 13, lineHeight: 1.45, color: '#5A4A3C', margin: 0, maxWidth: 340, overflowWrap: 'anywhere' }}>
          Send it to your delegates. They apply with your delegation already chosen, or join it if they applied already.
          <br />
          <span style={{ color: 'var(--gv-main)', fontWeight: 600, userSelect: 'all' }}>{link}</span>
        </p>
      )}
      {error && (
        <p role="alert" style={{ fontFamily: OUTFIT, fontSize: 13, color: '#8B2020', margin: 0 }}>{error}</p>
      )}
    </div>
  );
}
