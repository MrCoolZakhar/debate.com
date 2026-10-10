'use client';

// EMAIL PREVIEW pop-up for an automatic email (Communications → Automatic
// emails → Preview, and the builder's "Preview default").
//
// It shows the email exactly as it ships today: the organiser's own wording
// when they wrote some (and, for an always-on invite, switched it on), else
// our default copy, rendered through the same card design, variant, event and
// subject rule as queueEventEmail. Read-only: editing happens in the builder.
//
// Fixed 10 Oct 2026 ("the previews of the emails is broken"):
//  • the iframe had a fixed 520px height inside a panel capped at 88dvh, so on
//    a laptop window it ran past the panel's bottom and covered the Close
//    button (measured at 1456x835: iframe bottom 777, Close 718..760);
//  • the iframe did not pin its colour scheme, so on a Mac in dark mode the
//    email's own dark styles kicked in and the preview turned black with
//    unreadable merge-field highlights;
//  • it always rendered OUR default, so an email with the organiser's own
//    wording previewed words that never send;
//  • it rendered with no `event` / `isDefault`, so the card's status icon and
//    the seat-led allocation layout differed from the real email, and the
//    subject skipped emailCardSubject;
//  • an email with no default copy (Position paper due) rendered nothing at
//    all: the button did nothing.

import { useMemo, useState } from 'react';
import { X, Send, PenLine } from 'lucide-react';
import { resolveTokens, type EmailTokenContext } from '@/lib/emailTokens';
import { flattenBlocksToPlainText, normalizeBlocks, type EmailBlock } from '@/lib/emailBlocks';
import { renderEmailHtml, type EmailRenderConference } from '@/lib/emailHtml';
import { emailCardSubject } from '@/lib/emailCard';
import { getDefaultEventEmail } from '@/lib/defaultEmails';
import { hasDraftContent } from '@/lib/emailEvents';
import { getAuthedClient } from '@/lib/supabase-auth';
import { triggerEmailDelivery } from '@/lib/emailDelivery';
import { ModalOverlay, MODAL_PANEL_MAX_HEIGHT } from '@/components/CommitteeEditorModal';
import type { PreviewCandidate } from '@/components/EmailComposer';
import { friendlyError } from '@/lib/friendlyError';

const FONT = 'var(--font-brand), sans-serif';
const INK = '#1C1410';
const SOFT = '#5A4A3C';
const FOREST = '#1B3828';
const HAIR = 'rgba(27,56,40,0.12)';

export interface PreviewTemplate {
  subject: string;
  body: string;
  body_blocks: unknown;
  enabled: boolean;
}

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
  /** The organiser's template row for this event, when there is one. */
  template?: PreviewTemplate | null;
  /** Always-on invites use the organiser's wording only while it is switched on. */
  functional?: boolean;
  /** Force our default even when the organiser has their own wording. */
  forceDefault?: boolean;
  /** Opens the builder for this email. */
  onEdit?: () => void;
}

export default function DefaultEmailPreviewModal({
  eventKey, eventLabel, conference, conferenceId, previewCandidates, accessToken, organizerEmail, testSendContext, onClose,
  template, functional, forceDefault, onEdit,
}: DefaultEmailPreviewModalProps) {
  const [search, setSearch] = useState('');
  const [candidateId, setCandidateId] = useState<string | null>(null);
  const [sendingTest, setSendingTest] = useState(false);
  const [testMessage, setTestMessage] = useState<string | null>(null);

  const def = getDefaultEventEmail(eventKey);
  // The same choice queueEventEmail makes: written words win, an always-on
  // invite's words only while that row is on.
  const own = !forceDefault && !!template && hasDraftContent(template) && (!functional || template.enabled);
  const blocks: EmailBlock[] | null = own
    ? normalizeBlocks(template!.body_blocks, template!.body ?? '')
    : def?.blocks ?? null;
  const subjectSource = own ? template!.subject : def?.subject ?? '';

  const matches = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.trim().toLowerCase();
    return previewCandidates.filter(c => c.label.toLowerCase().includes(q)).slice(0, 6);
  }, [previewCandidates, search]);
  const candidate = candidateId ? previewCandidates.find(c => c.id === candidateId) ?? null : null;
  const ctx: EmailTokenContext = candidate?.ctx ?? testSendContext;

  const html = useMemo(
    () => (blocks ? renderEmailHtml({ blocks, conference, ctx, variant: 'transactional', event: eventKey, isDefault: !own }) : ''),
    // blocks is derived from template / def, both stable for this render
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [template, def, own, conference, ctx, eventKey]
  );
  const subject = blocks ? emailCardSubject(resolveTokens(subjectSource, ctx), conference, !own) : '';

  async function handleSendTest() {
    if (!blocks || !accessToken || !organizerEmail || sendingTest) return;
    setSendingTest(true);
    setTestMessage(null);
    const supabase = getAuthedClient(accessToken);
    const { error } = await supabase.from('email_outbox').insert({
      conference_id: conferenceId,
      template_id: null,
      recipient_application_id: null,
      recipient_email: organizerEmail,
      subject: '[TEST] ' + subject,
      body: resolveTokens(flattenBlocksToPlainText(blocks, conference), ctx),
      body_html: html,
      status: 'pending',
    });
    setSendingTest(false);
    if (error) { setTestMessage(friendlyError(error, "Couldn't send the test email. Please try again.")); return; }
    triggerEmailDelivery(supabase);
    setTestMessage(`Test sent to ${organizerEmail}`);
    setTimeout(() => setTestMessage(m => (m?.startsWith('Test sent') ? null : m)), 4500);
  }

  const linkBtn = {
    background: 'none', border: 'none', padding: '6px 2px', cursor: 'pointer', fontFamily: FONT, fontSize: 14,
    fontWeight: 700, color: FOREST, textDecoration: 'underline', textUnderlineOffset: 3,
  } as const;

  return (
    <ModalOverlay onClose={onClose} label={`${eventLabel} preview`} scrimColor="rgba(27,20,16,0.42)">
      <div
        className="flex flex-col"
        style={{
          width: 'min(94vw, 700px)',
          // A definite height, so the iframe below can fill what is left and
          // never runs over the buttons. Short when there is nothing to show.
          height: blocks ? `min(${MODAL_PANEL_MAX_HEIGHT}, 900px)` : undefined,
          backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20,
          boxShadow: '0 0 0 1px rgba(27,56,40,0.07), 0 24px 60px -12px rgba(27,56,40,0.35)',
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p style={{ fontFamily: FONT, fontWeight: 800, fontSize: 20, color: INK, overflowWrap: 'anywhere', lineHeight: 1.2 }}>{eventLabel}</p>
            <p style={{ fontFamily: FONT, fontSize: 14, color: SOFT, marginTop: 2 }}>
              {!blocks ? 'Nothing written yet' : own ? 'Your wording, as it sends today' : 'Our wording, as it sends today'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="flex-shrink-0 inline-flex items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
            style={{ width: 40, height: 40, border: 'none', backgroundColor: 'rgba(27,56,40,0.06)', cursor: 'pointer' }}
          >
            <X size={18} style={{ color: INK }} />
          </button>
        </div>

        {!blocks ? (
          <div className="mt-5">
            <p style={{ fontFamily: FONT, fontSize: 15, color: INK, lineHeight: 1.5, textWrap: 'pretty' }}>
              We have no wording for this one. Write your own and it will use that.
            </p>
            <div className="flex items-center gap-4 mt-5">
              {onEdit && (
                <button
                  type="button"
                  onClick={onEdit}
                  className="inline-flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
                  style={{ background: 'linear-gradient(90deg,#1B3828 0%,#2A5A3C 55%,#1E4A31 100%)', color: '#FFFFFF', border: 'none', borderRadius: 11, cursor: 'pointer', fontFamily: FONT, fontWeight: 700, fontSize: 14, minHeight: 44, padding: '0 18px' }}
                >
                  <PenLine size={16} aria-hidden /> Write it
                </button>
              )}
              <button type="button" onClick={onClose} style={linkBtn}>Close</button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 mt-4">
              <div className="relative flex-1" style={{ minWidth: 200 }}>
                <input
                  value={search}
                  onChange={e => { setSearch(e.target.value); setCandidateId(null); }}
                  placeholder="See it as one of your applicants"
                  aria-label="See it as one of your applicants"
                  className="w-full rounded-xl px-3.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
                  style={{ border: `1px solid ${HAIR}`, color: INK, backgroundColor: '#FFFFFF', fontFamily: FONT, fontSize: 16, minHeight: 44 }}
                />
                {search.trim() && !candidate && matches.length > 0 && (
                  <div
                    className="absolute left-0 right-0 rounded-xl overflow-y-auto"
                    style={{ top: 'calc(100% + 4px)', maxHeight: 220, backgroundColor: '#FFFFFF', boxShadow: '0 0 0 1px rgba(27,56,40,0.08), 0 12px 28px -8px rgba(27,56,40,0.3)', zIndex: 10 }}
                  >
                    {matches.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => { setCandidateId(c.id); setSearch(c.label); }}
                        className="w-full text-left px-3.5 py-2.5 focus:outline-none hover:bg-[rgba(27,56,40,0.05)] focus-visible:bg-[rgba(27,56,40,0.05)]"
                        style={{ color: INK, fontFamily: FONT, fontSize: 14, overflowWrap: 'anywhere', background: 'none', border: 'none', cursor: 'pointer' }}
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
                className="inline-flex items-center gap-1.5 rounded-xl px-3.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] disabled:opacity-55 flex-shrink-0"
                style={{ border: `1.5px solid ${INK}`, color: INK, backgroundColor: '#FFFFFF', fontFamily: FONT, fontWeight: 700, fontSize: 14, minHeight: 44, cursor: 'pointer' }}
              >
                <Send size={14} aria-hidden /> {sendingTest ? 'Sending' : 'Send me a test'}
              </button>
            </div>
            {testMessage && (
              <p role="status" className="mt-2" style={{ fontFamily: FONT, fontSize: 13, fontWeight: 600, color: testMessage.startsWith('Test sent') ? '#2F6B45' : '#8B2020' }}>
                {testMessage}
              </p>
            )}

            <p className="mt-4 mb-2" style={{ fontFamily: FONT, fontSize: 14, color: INK, overflowWrap: 'anywhere' }}>
              <span style={{ color: SOFT }}>Subject: </span><strong>{subject}</strong>
            </p>

            <div className="flex-1 min-h-0 rounded-2xl overflow-hidden" style={{ boxShadow: `0 0 0 1px ${HAIR}`, minHeight: 240 }}>
              <iframe
                srcDoc={html}
                sandbox="allow-same-origin"
                title={`${eventLabel} preview`}
                style={{
                  display: 'block', width: '100%', height: '100%', border: 'none', backgroundColor: '#FFFFFF',
                  // Pinned light, like the composer's default view: inherited,
                  // a dark-mode reader saw the email in its dark styles.
                  colorScheme: 'light',
                }}
              />
            </div>

            <div className="flex items-center justify-end gap-4 mt-4 flex-shrink-0">
              <button type="button" onClick={onClose} style={linkBtn}>Close</button>
              {onEdit && (
                <button
                  type="button"
                  onClick={onEdit}
                  className="inline-flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
                  style={{ background: 'linear-gradient(90deg,#1B3828 0%,#2A5A3C 55%,#1E4A31 100%)', color: '#FFFFFF', border: 'none', borderRadius: 11, cursor: 'pointer', fontFamily: FONT, fontWeight: 700, fontSize: 14, minHeight: 44, padding: '0 18px' }}
                >
                  <PenLine size={16} aria-hidden /> {own ? 'Edit your wording' : 'Change the wording'}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </ModalOverlay>
  );
}
