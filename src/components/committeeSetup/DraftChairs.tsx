'use client';

/**
 * The chairs section of the committee pop-up in DRAFT MODE (owner, 22 Nov 2026:
 * "chairs can be invited while creating"). ChairsDock (CommitteeEditorModal.tsx)
 * needs a committee id, which does not exist while the conference wizard is
 * still collecting answers, so this is its draft-mode twin: the same step
 * heading, the same "invite by email" field and title chips, but it only
 * COLLECTS. Nothing here touches the database. The wizard sends each invite
 * with sendChairInvite once the conference and its committees exist
 * (src/app/conferences/new/page.tsx, handleCreate).
 *
 * No applicants list: a conference that is not created yet has none.
 */

import { useEffect, useState } from 'react';
import { UserPlus, X } from 'lucide-react';
import { OUTFIT } from '@/components/neu';
import { SetupStep, SETUP_INPUT_CLS } from '@/components/committeeSetupKit';
import { ChairTitleChips, ChairTitleSelect } from '@/components/conferences/ChairTitlePicker';
import { isValidEmail } from '@/lib/languageRequests';
import type { ChairTitle } from '@/lib/chairTitles';

/** One chair to invite once the conference exists. Display-only title. */
export interface DraftChairInvite {
  email: string;
  /** Full name, optional. Used until the invitee has an account of their own. */
  name?: string;
  title?: ChairTitle | null;
}

export function DraftChairsSection({ invites, onChange, onTyping }: {
  invites: DraftChairInvite[];
  onChange: (next: DraftChairInvite[]) => void;
  /** True while the email field holds text that was not added yet, so the
   *  pop-up can refuse to save over it. */
  onTyping?: (typing: boolean) => void;
}) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [title, setTitle] = useState<ChairTitle | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => { onTyping?.(email.trim().length > 0); }, [email, onTyping]);

  function add() {
    const em = email.trim();
    if (!em) return;
    if (!isValidEmail(em)) { setErr('That email address does not look right.'); return; }
    if (invites.some((i) => i.email.toLowerCase() === em.toLowerCase())) {
      setErr(`${em} is already on this committee's list.`);
      return;
    }
    onChange([...invites, { email: em, name: name.trim() || undefined, title }]);
    setEmail(''); setName(''); setTitle(null); setErr('');
  }

  return (
    <div className="mt-4 flex flex-col pt-3" style={{ boxShadow: 'inset 0 1px 0 rgba(27,56,40,0.08)' }}>
      <SetupStep step={3} id="ced-draft-chairs" title="Chairs" />

      <div className="flex flex-col gap-2 pb-3">
        {invites.length === 0 ? (
          <p className="text-[11px]" style={{ color: '#9A8A78', fontFamily: OUTFIT, lineHeight: 1.45 }}>No chairs invited yet.</p>
        ) : (
          invites.map((inv) => {
            const label = inv.name || inv.email;
            return (
              <div key={inv.email.toLowerCase()} className="flex items-center gap-2">
                <span className="relative flex-shrink-0" style={{ lineHeight: 0 }}>
                  <span className="flex items-center justify-center" style={{ width: 28, height: 28, borderRadius: '9999px', backgroundColor: 'rgba(27,56,40,0.10)', color: '#7A5A10', fontSize: 11, fontWeight: 700, fontFamily: OUTFIT }}>{label.charAt(0).toUpperCase()}</span>
                  <span aria-hidden className="absolute inset-0 pointer-events-none" style={{ borderRadius: 9999, border: '1.5px dashed #B6871F' }} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-[12px] [overflow-wrap:anywhere]" style={{ display: 'block', color: '#1C1410', fontFamily: OUTFIT, fontWeight: 600 }}>{label}</span>
                  {inv.name && (
                    <span className="text-[10.5px] [overflow-wrap:anywhere]" style={{ display: 'block', color: '#6B5F52', fontFamily: OUTFIT }}>{inv.email}</span>
                  )}
                </span>
                <ChairTitleSelect
                  value={inv.title}
                  label={`Title for ${label}`}
                  onChange={(t) => onChange(invites.map((i) => (i.email === inv.email ? { ...i, title: t } : i)))}
                />
                <button
                  type="button"
                  onClick={() => onChange(invites.filter((i) => i.email !== inv.email))}
                  title={`Remove ${label}`}
                  aria-label={`Remove ${label}`}
                  className="focus:outline-none flex-shrink-0"
                  style={{ color: '#9A8A78', background: 'none', border: 'none', cursor: 'pointer', lineHeight: 0 }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#8B2020'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#9A8A78'; }}
                >
                  <X size={13} strokeWidth={2.4} />
                </button>
              </div>
            );
          })
        )}
      </div>

      <div className="flex flex-col gap-2 pt-3" style={{ borderTop: '1px solid #EDE7D8' }}>
        <p style={{ margin: 0, fontFamily: OUTFIT, fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: '#6B5F52' }}>INVITE BY EMAIL</p>
        <div className="flex gap-1.5">
          <input
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setErr(''); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
            placeholder="chair@example.com"
            aria-label="Chair email"
            className={SETUP_INPUT_CLS}
            style={{ flex: 1, minWidth: 0 }}
          />
          <button
            type="button"
            onClick={add}
            disabled={!email.trim()}
            className="gv-lift rounded-lg px-2.5 flex items-center justify-center focus:outline-none flex-shrink-0"
            style={{ backgroundColor: !email.trim() ? '#DDD4C0' : '#1B3828', color: !email.trim() ? '#9A8A78' : '#EED98A', cursor: email.trim() ? 'pointer' : 'default' }}
            title="Add this chair"
            aria-label="Add this chair"
          >
            <UserPlus size={14} />
          </button>
        </div>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder="Their name (optional)"
          aria-label="Chair name (optional)"
          className={SETUP_INPUT_CLS}
        />
        <p style={{ margin: '2px 0 0 0', fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 600, color: '#6B5F52' }}>
          Title on the dais <span style={{ fontWeight: 400, color: '#9A8A78' }}>(optional, display only)</span>
        </p>
        <ChairTitleChips value={title} onChange={setTitle} />
        <p className="text-[10.5px]" style={{ margin: 0, color: '#9A8A78', fontFamily: OUTFIT, lineHeight: 1.45 }}>
          We email each invite as soon as your conference is created. No Gavelling account yet? They can make one from the email.
        </p>
        {err && <p className="text-[10.5px]" style={{ margin: 0, color: '#8B2020', fontFamily: OUTFIT }} role="alert">{err}</p>}
      </div>
    </div>
  );
}
