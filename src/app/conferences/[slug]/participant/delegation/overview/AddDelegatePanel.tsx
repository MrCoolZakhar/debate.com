'use client';

// "Add a member" on the leader card, right below the People table (head
// delegates and faculty advisors; owner, 21 Oct 2026: it opens the EXACT same
// pop-up as "Import delegates").
//
//   Leader imports allowed   the button opens DelegationImportPopup (through
//                            the card's own onImport), whose rows take a
//                            name, an email and a role: Delegate always, Head
//                            Delegate and Faculty Advisor when the conference
//                            has that role open (my_delegation_import's
//                            import_roles, the same rule leader_import_delegates
//                            applies).
//   Not allowed              the invite link step only, opened in place (never
//                            a pop-up): the delegation's own link
//                            (DelegationInviteLink, the same short /i/<code>
//                            link as the card's header) with one plain line.
// The name and email form that used to live here is gone: the pop-up is the
// one place a leader adds people by name and email.
// DELEGATE_ADDED_EVENT is still the event DelegationPanel and the Overview
// listen to after an import.

import { useState } from 'react';
import { UserPlus, X } from 'lucide-react';
import DelegationInviteLink from '../../DelegationInviteLink';
import { BTN_CLASS, cardStyle, FONT, INK, INK_SOFT, secondaryBtn, STROKE } from '../leaderKit';

/** Fired on window after a leader adds someone by name and email. */
export const DELEGATE_ADDED_EVENT = 'gv-delegation-imported';

export default function AddDelegatePanel({ societyId, conferenceId, societyName, importAvailable, onImport }: {
  societyId: string;
  conferenceId: string;
  societyName: string | null;
  /** The conference lets leaders import (my_delegation_import's `enabled`). */
  importAvailable: boolean;
  /** Opens the Import delegates pop-up. */
  onImport: () => void;
}) {
  const [linkOpen, setLinkOpen] = useState(false);
  const delegation = societyName || 'your delegation';

  if (!linkOpen) {
    return (
      <div>
        <button
          type="button"
          onClick={() => { if (importAvailable) onImport(); else setLinkOpen(true); }}
          className={BTN_CLASS}
          style={secondaryBtn}
        >
          <UserPlus size={18} strokeWidth={STROKE} aria-hidden />
          Add a member
        </button>
      </div>
    );
  }

  return (
    <section aria-label="Add a member" className="flex flex-col gap-4 min-w-0" style={{ ...cardStyle, padding: '18px 22px' }}>
      <div className="flex items-center gap-3">
        <h2 className="flex-1 min-w-0" style={{ fontFamily: FONT, fontSize: 16, fontWeight: 600, color: INK, margin: 0 }}>
          Send an Invite Link
        </h2>
        <button type="button" onClick={() => setLinkOpen(false)} aria-label="Close" className={`${BTN_CLASS} rounded-lg`}
          style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: INK_SOFT, display: 'inline-flex' }}>
          <X size={20} strokeWidth={STROKE} aria-hidden />
        </button>
      </div>
      <div className="flex flex-col gap-2 min-w-0">
        <DelegationInviteLink societyId={societyId} conferenceId={conferenceId} />
        <p style={{ fontFamily: FONT, fontSize: 13.5, color: INK_SOFT, margin: 0, lineHeight: 1.5 }}>
          Whoever opens this link applies to <span className="[overflow-wrap:anywhere]" style={{ fontWeight: 600, color: INK }}>{delegation}</span>.
        </p>
      </div>
    </section>
  );
}
