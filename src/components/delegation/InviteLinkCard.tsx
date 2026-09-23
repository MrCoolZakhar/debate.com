'use client';

// The invite link, at the top of the delegation portal.
//
// One stable link per delegation (`create_delegation_invite` is idempotent). The
// link opens /invites/delegation/<token>: somebody who has not applied yet lands
// on the delegate application with this delegation filled in; somebody who
// already applied to the conference is added to the delegation
// (`delegation_join_via_invite`).

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Copy, Link2, Share2 } from 'lucide-react';
import { NEU, OUTFIT } from '@/components/neu';
import { getAuthedClient } from '@/lib/supabase-auth';
import { friendlyError } from '@/lib/friendlyError';
import { Panel, PrimaryButton, QuietButton, DANGER } from './portalUi';

export function InviteLinkCard({ accessToken, societyId, conferenceId, societyName, conferenceName, initialToken }: {
  accessToken: string;
  societyId: string;
  conferenceId: string;
  societyName: string;
  conferenceName: string;
  initialToken: string | null;
}) {
  const [token, setToken] = useState<string | null>(initialToken);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const tried = useRef(false);

  useEffect(() => {
    const t = window.setTimeout(() => setCanShare(typeof navigator.share === 'function'), 0);
    return () => window.clearTimeout(t);
  }, []);

  const create = useCallback(async () => {
    setBusy(true);
    setError('');
    const { data, error: e } = await getAuthedClient(accessToken).rpc('create_delegation_invite', {
      p_society_id: societyId, p_conference_id: conferenceId,
    });
    setBusy(false);
    const r = data as { ok: boolean; error?: string; token?: string } | null;
    if (e || !r?.ok || !r.token) {
      setError(r?.error ?? friendlyError(e, 'We could not make your invite link. Try again.'));
      return;
    }
    setToken(r.token);
  }, [accessToken, societyId, conferenceId]);

  // Make the link on arrival, so the leader never has to press a button to get it.
  useEffect(() => {
    if (token || tried.current) return;
    tried.current = true;
    void Promise.resolve().then(create);
  }, [token, create]);

  const url = token ? `${typeof window !== 'undefined' ? window.location.origin : 'https://gavelling.com'}/invites/delegation/${token}` : '';

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const share = async () => {
    if (!url) return;
    try {
      await navigator.share({ title: `Join ${societyName} at ${conferenceName}`, text: `Apply to ${conferenceName} as a delegate of ${societyName}:`, url });
    } catch { /* closed by the user */ }
  };

  return (
    <Panel tone="gold" style={{ padding: '16px 16px 18px' }}>
      <div className="flex items-start gap-3">
        <span className="inline-flex items-center justify-center flex-shrink-0" style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: NEU.forest, color: NEU.gold }}>
          <Link2 size={19} strokeWidth={2.3} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 style={{ fontFamily: OUTFIT, fontSize: 16, fontWeight: 800, color: NEU.ink }}>Invite delegates</h2>
          <p style={{ fontFamily: OUTFIT, fontSize: 13, color: NEU.inkSoft, marginTop: 2, lineHeight: 1.45 }}>
            Share this link. New people apply as a delegate of {societyName}. People who already applied are added to it.
          </p>
        </div>
      </div>

      <div className="mt-3.5 flex flex-col sm:flex-row gap-2">
        <div
          className="flex-1 min-w-0 flex items-center gap-2"
          style={{ padding: '10px 12px', borderRadius: 12, backgroundColor: NEU.base, boxShadow: NEU.inSm }}
        >
          <p className="truncate" style={{ fontFamily: OUTFIT, fontSize: 13.5, color: token ? NEU.ink : NEU.inkSoft }} title={url || undefined}>
            {token ? url.replace(/^https?:\/\//, '') : busy ? 'Making your link…' : 'No link yet'}
          </p>
        </div>
        <div className="flex gap-2">
          {token ? (
            <>
              <PrimaryButton onClick={copy} icon={copied ? Check : Copy} style={{ flex: 1 }}>
                {copied ? 'Copied' : 'Copy link'}
              </PrimaryButton>
              {canShare && <QuietButton onClick={share} icon={Share2}>Share</QuietButton>}
            </>
          ) : (
            <PrimaryButton onClick={create} disabled={busy} icon={Link2}>{busy ? 'Making…' : 'Make link'}</PrimaryButton>
          )}
        </div>
      </div>
      {error && <p role="alert" style={{ fontFamily: OUTFIT, fontSize: 13, color: DANGER, marginTop: 8 }}>{error}</p>}
    </Panel>
  );
}
