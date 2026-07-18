'use client';

// PREVIEW DEFAULT modal — shown from a Notifications registry row that has
// no drafted template yet, so the chair can see (and test-send) exactly what
// ships today via getDefaultEventEmail, rendered through the conference's
// own theme. Read-only: drafting a template (the existing DRAFT button)
// is still how you override the default, unchanged by this modal.

import { useMemo, useState } from 'react';
import { X, Send } from 'lucide-react';
import { resolveTokens, type EmailTokenContext } from '@/lib/emailTokens';
import { flattenBlocksToPlainText } from '@/lib/emailBlocks';
import { renderEmailHtml, type EmailRenderConference } from '@/lib/emailHtml';
import { getDefaultEventEmail } from '@/lib/defaultEmails';
import { getAuthedClient } from '@/lib/supabase-auth';
import { triggerEmailDelivery } from '@/lib/emailDelivery';
import { ModalOverlay } from '@/components/CommitteeEditorModal';
import type { PreviewCandidate } from '@/components/EmailComposer';

const OUTFIT = "'Outfit', sans-serif";
const BORDER = '#DDD4C0';
const INK = '#1C1410';

export interface DefaultEmailPreviewModalProps {
  eventKey: string;
  eventLabel: string;
  conference: EmailRenderConference;
  conferenceId: string;
  previewCandidates: PreviewCandidate[];
  accessToken: string | null;
  organizerEmail: string | null;
  testSendContext: EmailTokenContext;
  onClose: () => void;
}

export default function DefaultEmailPreviewModal({
  eventKey, eventLabel, conference, conferenceId, previewCandidates, accessToken, organizerEmail, testSendContext, onClose,
}: DefaultEmailPreviewModalProps) {
  const [search, setSearch] = useState('');
  const [candidateId, setCandidateId] = useState<string | null>(null);
  const [sendingTest, setSendingTest] = useState(false);
  const [testMessage, setTestMessage] = useState<string | null>(null);

  const def = getDefaultEventEmail(eventKey);
  const matches = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.trim().toLowerCase();
    return previewCandidates.filter(c => c.label.toLowerCase().includes(q)).slice(0, 6);
  }, [previewCandidates, search]);
  const candidate = candidateId ? previewCandidates.find(c => c.id === candidateId) ?? null : null;
  const ctx: EmailTokenContext = candidate?.ctx ?? testSendContext;

  const html = useMemo(
    () => (def ? renderEmailHtml({ blocks: def.blocks, conference, ctx }) : ''),
    [def, conference, ctx]
  );

  async function handleSendTest() {
    if (!def || !accessToken || !organizerEmail || sendingTest) return;
    setSendingTest(true);
    setTestMessage(null);
    const supabase = getAuthedClient(accessToken);
    const { error } = await supabase.from('email_outbox').insert({
      conference_id: conferenceId,
      template_id: null,
      recipient_application_id: null,
      recipient_email: organizerEmail,
      subject: '[TEST] ' + resolveTokens(def.subject, ctx),
      body: resolveTokens(flattenBlocksToPlainText(def.blocks, conference), ctx),
      body_html: html,
      status: 'pending',
    });
    setSendingTest(false);
    if (error) { setTestMessage(`Failed to send test: ${error.message}`); return; }
    triggerEmailDelivery(supabase);
    setTestMessage(`Test sent to ${organizerEmail}`);
    setTimeout(() => setTestMessage(m => (m?.startsWith('Test sent') ? null : m)), 4500);
  }

  if (!def) return null;

  return (
    <ModalOverlay onClose={onClose}>
      <div
        className="rounded-2xl p-6 flex flex-col"
        style={{ width: 'min(94vw, 680px)', maxHeight: '88vh', backgroundColor: '#FAF8F3', border: `1px solid ${BORDER}`, boxShadow: '0 20px 50px rgba(27,56,40,0.25)' }}
      >
        <div className="flex items-start justify-between gap-3 mb-1">
          <div className="min-w-0">
            <p className="text-xs font-bold" style={{ color: '#B6871F', fontFamily: OUTFIT, letterSpacing: '0.08em' }}>DEFAULT PREVIEW</p>
            <p className="font-black text-lg truncate" style={{ color: INK, fontFamily: OUTFIT }}>{eventLabel}</p>
          </div>
          <button onClick={onClose} className="flex-shrink-0 rounded-lg p-1.5 focus:outline-none" style={{ border: `1px solid ${BORDER}`, backgroundColor: 'transparent' }}>
            <X size={14} style={{ color: INK }} />
          </button>
        </div>
        <p className="text-xs mb-4" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
          This is what sends today — draft a template from this list to override it.
        </p>

        <div className="flex items-center gap-3 mb-3">
          <div className="relative flex-1 min-w-0">
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setCandidateId(null); }}
              placeholder="Preview as an applicant..."
              className="w-full rounded-xl px-3.5 py-2 text-sm focus:outline-none"
              style={{ border: `1px solid ${BORDER}`, color: INK, backgroundColor: '#FFFFFF', fontFamily: OUTFIT }}
            />
            {search.trim() && !candidate && matches.length > 0 && (
              <div
                className="absolute left-0 right-0 rounded-xl shadow-lg overflow-y-auto"
                style={{ top: 'calc(100% + 4px)', maxHeight: 200, backgroundColor: '#FFFFFF', border: `1px solid ${BORDER}`, zIndex: 10 }}
              >
                {matches.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => { setCandidateId(c.id); setSearch(c.label); }}
                    className="w-full text-left px-3.5 py-2 text-sm focus:outline-none"
                    style={{ color: INK, fontFamily: OUTFIT }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.05)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={handleSendTest}
            disabled={sendingTest || !accessToken || !organizerEmail}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold focus:outline-none transition-colors disabled:opacity-55 flex-shrink-0"
            style={{ border: `1px solid ${BORDER}`, color: INK, backgroundColor: 'transparent', fontFamily: OUTFIT }}
          >
            <Send size={12} /> {sendingTest ? 'SENDING...' : 'SEND TEST TO ME'}
          </button>
        </div>
        {testMessage && (
          <p className="text-xs font-semibold mb-2" style={{ color: testMessage.startsWith('Failed') ? '#8B2020' : '#3D7A52', fontFamily: OUTFIT }}>
            {testMessage}
          </p>
        )}
        {!candidate && (
          <p className="text-xs mb-2" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
            Search and select an applicant above to resolve fields, or preview unresolved.
          </p>
        )}

        <p className="font-semibold text-sm mb-2" style={{ color: INK, fontFamily: OUTFIT }}>
          {resolveTokens(def.subject, ctx)}
        </p>

        <div className="flex-1 min-h-0 flex justify-center">
          <iframe
            srcDoc={html}
            sandbox="allow-same-origin"
            title="Default email preview"
            style={{ width: 600, maxWidth: '100%', height: 520, border: `1px solid ${BORDER}`, borderRadius: 12, backgroundColor: '#FFFFFF' }}
          />
        </div>

        <button
          onClick={onClose}
          className="w-full mt-4 rounded-xl py-2.5 font-bold text-sm focus:outline-none transition-colors flex-shrink-0"
          style={{ border: `1px solid ${BORDER}`, color: INK, backgroundColor: 'transparent', fontFamily: OUTFIT }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.04)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
        >
          CLOSE
        </button>
      </div>
    </ModalOverlay>
  );
}
