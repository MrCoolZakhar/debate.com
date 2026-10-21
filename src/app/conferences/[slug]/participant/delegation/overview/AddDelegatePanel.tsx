'use client';

// "Add delegate" on a leader's Overview (head delegates and faculty advisors;
// Peter, 21 Oct 2026: "right below the existing delegates there should be an
// Add delegate button ... by an invitation, or, if the conference allows it,
// the faculty advisor or head delegate simply puts in their name and email").
//
// Opens IN PLACE (never a pop-up), and a second step replaces the content with
// a back button:
//   Send an invite link    the delegation's own link (DelegationInviteLink, the
//                          same short /i/<code> link as the leader card).
//   Add by name and email  only while the conference allows leader imports
//                          (my_delegation_import's `enabled`, read through
//                          useDelegationImport). One row to
//                          leader_import_delegates: an application with status
//                          'submitted' in this delegation, shown to the
//                          organisers like any other, and an invite email to
//                          that address. Called ONLY from the in-place confirm.
// Leader imports are free while LEADER_IMPORTS_PAID_LAUNCH is off; the credits
// branch below (the import card's) only runs once both switches are on. A
// delegate or head delegate needs an open delegate ticket; with none left the
// form says so and points to the delegation card's "Buy another ticket".
// After an import, DELEGATE_ADDED_EVENT tells DelegationPanel to read again.

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Link2, Mail, UserPlus, X } from 'lucide-react';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { friendlyError, plainOrFallback } from '@/lib/friendlyError';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { nameProblem, tidyName, type NameProblem } from '@/lib/personName';
import { triggerEmailDelivery } from '@/lib/emailDelivery';
import { openCreditsPopup } from '@/lib/purchasePopup';
import { refreshCreditsEverywhere } from '@/hooks/useCredits';
import { leaderImportsArePaid } from '@/app/manage/[slug]/import/importQuote';
import DelegationInviteLink from '../../DelegationInviteLink';
import { IMPORT_ROLE_LABEL, useDelegationImport } from '../../DelegationImportCard';
import { BTN_CLASS, cardStyle, DANGER, FONT, INK, INK_SOFT, secondaryBtn, STROKE } from '../leaderKit';

/** Fired on window after a leader adds someone by name and email. */
export const DELEGATE_ADDED_EVENT = 'gv-delegation-imported';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FIELD_LINE = 'color-mix(in srgb, var(--gv-main) 18%, transparent)';
const FALLBACK = 'This person could not be added. Try again in a moment.';

type View = 'choose' | 'link' | 'form';
type AddRole = 'delegate' | 'head-delegate';

const NAME_SENTENCE: Record<NameProblem, string> = {
  email: 'That looks like an email address. Put their name here.',
  too_short: 'Enter their name. It needs at least 2 letters.',
  digits: "Names don't have numbers in them.",
  role: 'Use their own name, not a role.',
  org: "Use their own name, the way they'd sign a certificate.",
};

const INVALID_SENTENCE: Record<string, string> = {
  name: 'Check their name.',
  email: 'Check this email address.',
  duplicate: 'This email is already on your list.',
  self: 'That is your own email.',
  already_applied: 'This person has already applied to this conference.',
  role: 'This role is not open at this conference.',
};

const mainBtn: React.CSSProperties = {
  ...secondaryBtn, border: 'none', background: 'var(--gv-main)', color: 'var(--gv-on-main)',
};

export default function AddDelegatePanel({ societyId, conferenceId, societyName, onAdded, onOpenSection }: {
  societyId: string;
  conferenceId: string;
  societyName: string | null;
  /** Re-reads the Overview after someone was added. */
  onAdded: () => void;
  onOpenSection: (key: string) => void;
}) {
  const { leader, reload: reloadImport } = useDelegationImport(societyId);
  const importOn = !!leader?.enabled;
  const headOpen = !!leader?.import_roles.includes('head-delegate');
  const paid = leaderImportsArePaid(leader?.charged);
  const delegation = societyName || 'your delegation';

  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>('choose');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AddRole>('delegate');
  const [tried, setTried] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const aliveRef = useRef(true);
  const retryRef = useRef<{ name: string; email: string; role: AddRole } | null>(null);

  useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; };
  }, []);

  const resetForm = useCallback(() => {
    setName(''); setEmail(''); setRole('delegate'); setTried(false); setConfirming(false);
  }, []);

  const close = () => { if (busyRef.current) return; setOpen(false); setView('choose'); resetForm(); };
  const back = () => { if (busyRef.current) return; setView('choose'); setConfirming(false); };

  const cleanName = tidyName(name);
  const cleanEmail = email.trim().toLowerCase();
  const nameIssue = nameProblem(cleanName);
  const nameErr = nameIssue ? NAME_SENTENCE[nameIssue] : null;
  const emailErr = !EMAIL_RE.test(cleanEmail) ? 'Check this email address.' : null;
  const noTicket = !!leader && leader.free_spots < 1;

  const run = useCallback(async (row: { name: string; email: string; role: AddRole }) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const client = await getFreshAuthedClient();
      if (!client) { notifyErr('Your session has expired. Refresh the page and sign in again.'); return; }
      const { data, error } = await client.rpc('leader_import_delegates', { p_society: societyId, p_rows: [row] });
      if (error) throw error;
      const a = (data ?? {}) as {
        ok?: boolean; message?: string; need_credits?: number;
        invalid?: { reason?: string }[];
      };
      if (a.ok === true) {
        notifyOk(`${row.name} added. We emailed them an invitation`);
        refreshCreditsEverywhere();
        void triggerEmailDelivery(client);
        void reloadImport();
        onAdded();
        window.dispatchEvent(new CustomEvent(DELEGATE_ADDED_EVENT));
        if (aliveRef.current) { resetForm(); setOpen(false); setView('choose'); }
        return;
      }
      if (aliveRef.current) setConfirming(false);
      const reason = Array.isArray(a.invalid) ? a.invalid[0]?.reason : undefined;
      if (reason) { notifyErr(INVALID_SENTENCE[reason] ?? INVALID_SENTENCE.email); return; }
      // Only a paid import can be short of credits (LEADER_IMPORTS_PAID_LAUNCH):
      // buy, then the SAME row runs again once.
      if (paid && typeof a.need_credits === 'number' && a.need_credits > 0) {
        retryRef.current = row;
        openCreditsPopup({
          context: 'pay',
          preselect: a.need_credits,
          purpose: 'import',
          onComplete: () => {
            const again = retryRef.current;
            retryRef.current = null;
            if (again && aliveRef.current) void runRef.current?.(again);
          },
        });
        return;
      }
      notifyErr(plainOrFallback(a.message, FALLBACK));
      if (a.message) void reloadImport();
    } catch (e) {
      if (aliveRef.current) setConfirming(false);
      notifyErr(friendlyError(e, FALLBACK));
    } finally {
      busyRef.current = false;
      if (aliveRef.current) setBusy(false);
    }
  }, [societyId, paid, reloadImport, onAdded, resetForm]);
  const runRef = useRef(run);
  runRef.current = run;

  const askConfirm = () => {
    setTried(true);
    if (nameErr || emailErr || noTicket) return;
    setConfirming(true);
  };

  if (!open) {
    return (
      <div>
        <button type="button" onClick={() => { setOpen(true); setView(importOn ? 'choose' : 'link'); }} className={BTN_CLASS} style={secondaryBtn}>
          <UserPlus size={18} strokeWidth={STROKE} aria-hidden />
          Add delegate
        </button>
      </div>
    );
  }

  const field: React.CSSProperties = {
    height: 46, width: '100%', padding: '0 12px', fontFamily: FONT, fontSize: 16, color: INK,
    background: '#FFFFFF', borderRadius: 10, border: `1px solid ${FIELD_LINE}`,
  };
  const label: React.CSSProperties = { fontFamily: FONT, fontSize: 12.5, fontWeight: 600, color: INK_SOFT };
  const errLine: React.CSSProperties = { fontFamily: FONT, fontSize: 12.5, color: DANGER, margin: '4px 0 0 2px' };
  const showChooser = importOn;

  return (
    <section aria-label="Add a delegate" className="flex flex-col gap-4 min-w-0" style={{ ...cardStyle, padding: '18px 22px' }}>
      <div className="flex items-center gap-3">
        {view !== 'choose' && showChooser && (
          <button type="button" onClick={back} aria-label="Back" className={`${BTN_CLASS} rounded-lg`}
            style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: INK, display: 'inline-flex' }}>
            <ArrowLeft size={20} strokeWidth={STROKE} aria-hidden />
          </button>
        )}
        <h2 className="flex-1 min-w-0" style={{ fontFamily: FONT, fontSize: 16, fontWeight: 600, color: INK, margin: 0 }}>
          {view === 'link' ? 'Send an Invite Link' : view === 'form' ? 'Add by Name and Email' : 'Add a Delegate'}
        </h2>
        <button type="button" onClick={close} aria-label="Close" className={`${BTN_CLASS} rounded-lg`}
          style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: INK_SOFT, display: 'inline-flex' }}>
          <X size={20} strokeWidth={STROKE} aria-hidden />
        </button>
      </div>

      {view === 'choose' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Choice Icon={Link2} title="Send an invite link" line="They apply to your delegation themselves" onClick={() => setView('link')} />
          <Choice Icon={Mail} title="Add by name and email" line="They join with no application questions" onClick={() => setView('form')} />
        </div>
      )}

      {view === 'link' && (
        <div className="flex flex-col gap-2 min-w-0">
          <DelegationInviteLink societyId={societyId} conferenceId={conferenceId} />
          <p style={{ fontFamily: FONT, fontSize: 13.5, color: INK_SOFT, margin: 0, lineHeight: 1.5 }}>
            Whoever opens this link applies to <span className="[overflow-wrap:anywhere]" style={{ fontWeight: 600, color: INK }}>{delegation}</span>.
          </p>
        </div>
      )}

      {view === 'form' && (
        <div className="flex flex-col gap-3 min-w-0">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 min-w-0">
              <span style={label}>Name</span>
              <input type="text" value={name} disabled={confirming || busy} autoComplete="off"
                onChange={e => setName(e.target.value)} aria-invalid={tried && !!nameErr}
                className={BTN_CLASS} style={{ ...field, border: `1px solid ${tried && nameErr ? DANGER : FIELD_LINE}` }} />
              {tried && nameErr && <span role="alert" style={errLine}>{nameErr}</span>}
            </label>
            <label className="flex flex-col gap-1.5 min-w-0">
              <span style={label}>Email</span>
              <input type="email" inputMode="email" value={email} disabled={confirming || busy} autoComplete="off"
                autoCapitalize="none" spellCheck={false}
                onChange={e => setEmail(e.target.value)} aria-invalid={tried && !!emailErr}
                className={BTN_CLASS} style={{ ...field, border: `1px solid ${tried && emailErr ? DANGER : FIELD_LINE}` }} />
              {tried && emailErr && <span role="alert" style={errLine}>{emailErr}</span>}
            </label>
          </div>

          {headOpen && (
            <div role="radiogroup" aria-label="Role" className="flex flex-wrap gap-2">
              {(['delegate', 'head-delegate'] as AddRole[]).map(r => {
                const on = role === r;
                return (
                  <button key={r} type="button" role="radio" aria-checked={on} disabled={confirming || busy}
                    onClick={() => setRole(r)} className={BTN_CLASS}
                    style={{
                      ...secondaryBtn, minHeight: 38, padding: '0 14px',
                      background: on ? 'color-mix(in srgb, var(--gv-main) 10%, #FFFFFF)' : '#FFFFFF',
                      border: `1px solid ${on ? 'var(--gv-main)' : 'color-mix(in srgb, var(--gv-main) 16%, transparent)'}`,
                    }}>
                    {IMPORT_ROLE_LABEL[r]}
                  </button>
                );
              })}
            </div>
          )}

          {noTicket && (
            <p style={{ fontFamily: FONT, fontSize: 13.5, color: INK, margin: 0, lineHeight: 1.5 }}>
              Your delegate tickets are all taken. Buy another ticket on your delegation card first.{' '}
              <button type="button" onClick={() => onOpenSection('delegation')} className={`${BTN_CLASS} rounded`}
                style={{ fontFamily: FONT, fontSize: 13.5, fontWeight: 700, color: 'var(--gv-main)', textDecoration: 'underline', textUnderlineOffset: 3, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                Open delegation
              </button>
            </p>
          )}

          {confirming ? (
            <div className="flex flex-col gap-3 pt-1">
              <p className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 14, color: INK, margin: 0, lineHeight: 1.5 }}>
                <span style={{ fontWeight: 600 }}>Add {cleanName}?</span>{' '}
                We email {cleanEmail} an invitation to join {delegation}. They appear in the organiser&apos;s applications as submitted.
              </p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => { void run({ name: cleanName, email: cleanEmail, role: headOpen ? role : 'delegate' }); }}
                  disabled={busy} aria-busy={busy} className={BTN_CLASS} style={{ ...mainBtn, opacity: busy ? 0.7 : 1, cursor: busy ? 'wait' : 'pointer' }}>
                  {busy ? 'Adding' : 'Add and email'}
                </button>
                <button type="button" onClick={() => setConfirming(false)} disabled={busy} className={BTN_CLASS} style={secondaryBtn}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div>
              <button type="button" onClick={askConfirm} disabled={noTicket} className={BTN_CLASS}
                style={{ ...mainBtn, opacity: noTicket ? 0.5 : 1, cursor: noTicket ? 'not-allowed' : 'pointer' }}>
                <UserPlus size={18} strokeWidth={STROKE} aria-hidden />
                Add delegate
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function Choice({ Icon, title, line, onClick }: { Icon: typeof Mail; title: string; line: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`${BTN_CLASS} flex items-start gap-3 text-left min-w-0`}
      style={{
        padding: '14px 16px', borderRadius: 14, cursor: 'pointer', background: '#FFFFFF',
        border: '1px solid color-mix(in srgb, var(--gv-main) 16%, transparent)',
      }}>
      <Icon size={22} strokeWidth={STROKE} aria-hidden style={{ color: 'var(--gv-main)', flexShrink: 0, marginTop: 1 }} />
      <span className="flex flex-col gap-0.5 min-w-0">
        <span style={{ fontFamily: FONT, fontSize: 14.5, fontWeight: 600, color: INK }}>{title}</span>
        <span style={{ fontFamily: FONT, fontSize: 13, color: INK_SOFT, lineHeight: 1.4 }}>{line}</span>
      </span>
    </button>
  );
}
