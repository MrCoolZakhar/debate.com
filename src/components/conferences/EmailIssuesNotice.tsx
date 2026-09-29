'use client';

// Emails the database refused to send (29 Sep 2026).
//
// On 28 Sep 64 DIMUN delegates got a blank "study guide released" email: the
// template row was on with an empty subject and body, and that sender treated
// '' as real text. The server now falls back to Gavelling's default, and a
// guard blocks ANY email with an empty subject or body (status 'blocked') and
// logs it per conference. This notice tells the organiser, in the danger
// colour, with the server's own sentence, a way to their templates and a quiet
// Dismiss.
//
// Reads  conference_email_issues(p_conf)       { ok, issues: [{ id, message, ... }] }
// Writes dismiss_conference_email_issue(p_issue) { ok } | { ok:false, message }
//
// Mounted on the organiser dashboard (/manage/[slug]) and at the top of
// Communications. Renders nothing while there is no open issue.

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { friendlyError, plainOrFallback } from '@/lib/friendlyError';
import { notifyErr } from '@/lib/appNotify';

const FONT = "var(--font-brand), sans-serif";
const DANGER = '#8B2020';
const FOREST = '#1B3828';

interface EmailIssue {
  id: string;
  kind: string;
  subject: string | null;
  blocked_count: number;
  message: string;
}

const MESSAGE_FALLBACK = "Some emails were not sent because they were empty. Check your email templates in Communications: an empty template now uses Gavelling's default.";

export default function EmailIssuesNotice({
  conferenceId,
  slug,
  onCheckTemplates,
  compact = false,
}: {
  conferenceId: string | null | undefined;
  slug: string;
  /** Communications opens its own Automatic emails view instead of navigating. */
  onCheckTemplates?: () => void;
  /** The dashboard's tighter one-screen layout. */
  compact?: boolean;
}) {
  const [issues, setIssues] = useState<EmailIssue[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const busyRef = useRef(false);

  const load = useCallback(async () => {
    if (!conferenceId) return;
    try {
      const client = await getFreshAuthedClient();
      if (!client) return;
      const { data, error } = await client.rpc('conference_email_issues', { p_conf: conferenceId });
      if (error) { console.error('[EmailIssuesNotice] read failed:', error); return; }
      const res = data as { ok?: boolean; issues?: EmailIssue[] } | null;
      setIssues(res?.ok && Array.isArray(res.issues) ? res.issues : []);
    } catch (e) {
      // A failed read shows nothing: this notice must never block the page.
      console.error('[EmailIssuesNotice] read failed:', e);
    }
  }, [conferenceId]);

  useEffect(() => { void load(); }, [load]);

  async function dismiss(id: string) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusyId(id);
    const fallback = 'This notice could not be dismissed. Try again in a moment.';
    try {
      const client = await getFreshAuthedClient();
      if (!client) { notifyErr('Your session has expired. Please sign in again.'); return; }
      const { data, error } = await client.rpc('dismiss_conference_email_issue', { p_issue: id });
      const res = data as { ok?: boolean; message?: string } | null;
      if (error || !res?.ok) {
        notifyErr(error ? friendlyError(error, fallback) : plainOrFallback(res?.message, fallback));
        return;
      }
      await load();
    } catch (e) {
      notifyErr(friendlyError(e, fallback));
    } finally {
      busyRef.current = false;
      setBusyId(null);
    }
  }

  if (issues.length === 0) return null;

  const button: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    minHeight: compact ? 32 : 38, padding: compact ? '0 14px' : '0 16px', borderRadius: 10,
    background: `linear-gradient(90deg, ${FOREST}, #2A5A3C)`, color: '#FFFFFF',
    fontFamily: FONT, fontSize: compact ? 12.5 : 13.5, fontWeight: 700,
    textDecoration: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
  };

  return (
    <div className="flex flex-col gap-2 flex-shrink-0" style={{ marginBottom: compact ? 10 : 20 }}>
      {issues.map((issue) => (
        <div
          key={issue.id}
          role="alert"
          className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl"
          style={{
            padding: compact ? '10px 14px' : '14px 18px',
            backgroundColor: 'rgba(139,32,32,0.06)',
            boxShadow: 'inset 0 0 0 1px rgba(139,32,32,0.22)',
          }}
        >
          <div className="flex items-start gap-2.5 min-w-0" style={{ flex: '1 1 320px' }}>
            <AlertTriangle size={compact ? 16 : 18} strokeWidth={2.4} aria-hidden style={{ color: DANGER, flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontFamily: FONT, fontSize: compact ? 13 : 14, fontWeight: 600, color: DANGER, lineHeight: 1.45, margin: 0, textWrap: 'pretty' }}>
              {plainOrFallback(issue.message, MESSAGE_FALLBACK)}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {onCheckTemplates ? (
              <button type="button" onClick={onCheckTemplates} style={button} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] focus-visible:ring-offset-2">
                Check templates
              </button>
            ) : (
              <Link href={`/manage/${slug}/communications?view=automatic`} style={button} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] focus-visible:ring-offset-2">
                Check templates
              </Link>
            )}
            <button
              type="button"
              onClick={() => { void dismiss(issue.id); }}
              disabled={busyId !== null}
              className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] rounded"
              style={{
                background: 'none', border: 'none', padding: '4px 2px', cursor: busyId !== null ? 'default' : 'pointer',
                fontFamily: FONT, fontSize: compact ? 12.5 : 13, fontWeight: 700, color: '#5A5046',
                textDecoration: 'underline', textUnderlineOffset: 3, opacity: busyId !== null ? 0.55 : 1,
              }}
            >
              {busyId === issue.id ? 'Dismissing…' : 'Dismiss'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
