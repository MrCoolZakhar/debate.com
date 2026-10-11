'use client';

// Conference Documents on the You tab (11 Oct 2026): the Rules of Procedure,
// logistics, schedules and the code of conduct the organisers added under
// Documents → For everyone. Only for an accepted / assigned / checked-in
// application; the database's RLS decides the same thing (migration
// `conference_documents`, applied 11 Oct 2026). Files open through a one-hour
// signed URL from the private bucket; links open as they are. A failed read
// draws nothing.

import { useCallback, useEffect, useState } from 'react';
import { FileText } from 'lucide-react';
import { DashCard as YouCard, CardHeading } from './dashboardKit';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { STORE_CSS } from '@/app/manage/[slug]/store/storeKit';
import { DASH_CSS, IconDisc, TINT_GOLD, TINT_GREEN, INK, INK_SOFT, FOREST } from '@/app/manage/[slug]/financials/dashboardKit';
import {
  formatDocSize, kindInfo, linkHost, loadConferenceDocs, openConferenceDoc, type ConferenceDoc,
} from '@/lib/conferenceDocuments';

/** Application statuses that can read conference documents. */
export const DOC_READER_STATUSES = new Set(['accepted', 'assigned', 'checked-in']);

/** The documents this person can read, one read per conference per account.
 *  `enabled` false (no accepted application) reads nothing. */
export function useConferenceDocs(conferenceId: string, enabled: boolean): ConferenceDoc[] {
  const { user, session } = useAuth();
  const userId = user?.id ?? null;
  const [docs, setDocs] = useState<{ key: string; docs: ConferenceDoc[] } | null>(null);
  const key = `${conferenceId}:${userId ?? ''}`;

  const read = useCallback(async () => {
    const token = session?.access_token;
    if (!enabled || !userId || !token) return;
    const res = await loadConferenceDocs(getAuthedClient(token), conferenceId);
    // A failed read shows nothing (participants never see an error for this).
    setDocs({ key, docs: res.kind === 'ok' ? res.docs : [] });
    // Keyed on the user id, never the token (CLAUDE.md: a token refresh must not refetch).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, userId, conferenceId, key]);

  // Started a microtask later so no state is set synchronously in the effect.
  useEffect(() => { void Promise.resolve().then(() => read()); }, [read]);

  return enabled && docs?.key === key ? docs.docs : [];
}

/** Whether a document is meant for the role on screen (empty = everyone).
 *  The same rule as the database's `can_read_conference_document`: the role is
 *  listed, OR the application is a head delegate (`is_head_delegate`) and
 *  'head-delegate' is listed, OR the person chairs a committee of this
 *  conference and 'chair' is listed. */
export function docForRole(
  doc: ConferenceDoc,
  role: string,
  who: { isHeadDelegate?: boolean; isChair?: boolean } = {},
): boolean {
  const v = doc.visible_to ?? [];
  if (v.length === 0) return true;
  if (v.includes(role)) return true;
  if (who.isHeadDelegate && v.includes('head-delegate')) return true;
  return !!who.isChair && v.includes('chair');
}

const CSS = `
.gv-cdp{display:flex;flex-direction:column;gap:10px}
.gv-cdp-row{display:flex;align-items:center;gap:14px;width:100%;min-height:72px;padding:12px 16px;border:none;border-radius:16px;background:#FAF8F3;text-align:left;cursor:pointer;font-family:inherit;box-shadow:inset 0 0 0 1px rgba(27,56,40,0.06);transition:transform 160ms cubic-bezier(0.22,1,0.36,1),background-color 160ms ease,box-shadow 160ms ease}
.gv-cdp-row:hover{transform:translateY(-2px);background:#FFFFFF;box-shadow:inset 0 0 0 1px rgba(27,56,40,0.08),0 14px 30px -24px rgba(27,56,40,0.45)}
.gv-cdp-row:active{transform:scale(0.99)}
.gv-cdp-row:focus{outline:none}
.gv-cdp-row:focus-visible{outline:2px solid ${FOREST};outline-offset:2px}
.gv-cdp-row:disabled{cursor:default;opacity:0.7;transform:none}
.gv-cdp-main{flex:1 1 auto;min-width:0}
.gv-cdp-title{margin:0;font-size:15.5px;font-weight:800;line-height:1.3;color:${INK};overflow-wrap:anywhere}
.gv-cdp-sub{margin:3px 0 0;font-size:13px;line-height:1.45;color:${INK_SOFT};overflow-wrap:anywhere}
.gv-cdp-open{flex-shrink:0;font-size:14px;font-weight:700;color:${FOREST};text-decoration:underline;text-underline-offset:3px}
@media (prefers-reduced-motion:reduce){.gv-cdp-row{transition:none}.gv-cdp-row:hover{transform:none}}
`;

export default function ConferenceDocsSection({ docs }: { docs: ConferenceDoc[] }) {
  const { session } = useAuth();
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [err, setErr] = useState('');

  async function open(doc: ConferenceDoc) {
    if (!session || openingId) return;
    setErr('');
    setOpeningId(doc.id);
    const ok = await openConferenceDoc(getAuthedClient(session.access_token), doc);
    setOpeningId(null);
    if (!ok) setErr("Couldn't open that document. Please try again.");
  }

  if (docs.length === 0) return null;

  return (
    <YouCard className="gv-st">
      <style>{STORE_CSS}</style>
      <style>{DASH_CSS}</style>
      <style>{CSS}</style>
      <CardHeading title="Conference Documents" stackedHide />
      <ul className="gv-cdp" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {docs.map(doc => {
          const info = kindInfo(doc.kind);
          const detail = doc.url
            ? linkHost(doc.url)
            : ['PDF', formatDocSize(doc.file_size_bytes)].filter(Boolean).join(', ');
          return (
            <li key={doc.id}>
              <button type="button" className="gv-cdp-row" onClick={() => open(doc)} disabled={openingId === doc.id} aria-label={`Open ${doc.title}`}>
                <IconDisc icon={{ emoji: info.emoji, lucide: info.lucide ?? FileText, tint: info.tint === 'green' ? TINT_GREEN : TINT_GOLD }} />
                <span className="gv-cdp-main">
                  <span className="gv-cdp-title" style={{ display: 'block' }}>{doc.title}</span>
                  <span className="gv-cdp-sub" style={{ display: 'block' }}>{info.label} · {detail}</span>
                </span>
                <span className="gv-cdp-open" aria-hidden>{openingId === doc.id ? 'Opening…' : 'Open'}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {err && <p className="gv-st-err" role="alert">{err}</p>}
    </YouCard>
  );
}
