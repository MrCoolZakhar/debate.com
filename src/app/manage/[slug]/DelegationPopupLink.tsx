'use client';

// DelegationPopupLink: a delegation's name or crest an organiser can click,
// anywhere outside Applications › Delegations (Assignment, Give seats,
// Financials, the Applications People list). The click opens the ONE
// delegation pop-up (applications/delegations/DelegationPopup.tsx) in place,
// on the page the organiser is on (docs/conferences/delegations.md).
//
// A pop-up never opens another pop-up (CLAUDE.md, Owner Decisions): when a
// modal is already open at the moment of the click, nothing new opens.
//
// The pop-up is portaled to the body, but React events still bubble through
// the React tree; the wrapper around it stops them, so a click or a key inside
// the pop-up never reaches the card, row or drag source the link sits in.
//
// Pass `societyId` when the screen has it. `societyName` is for screens whose
// rows carry only the name (Financials › Documents): the pop-up reads the
// conference's delegations and opens the one with exactly that name.

import { useState } from 'react';
import { useManage } from '@/app/manage/[slug]/layout';
import DelegationPopup, { type DelegationPopupConference, type DelegationTab } from '@/app/manage/[slug]/applications/delegations/DelegationPopup';
import { useDelegationsData } from '@/app/manage/[slug]/applications/delegations/useDelegationsData';

const LINK_CLASS = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] focus-visible:rounded-md hover:underline cursor-pointer';

const LINK_RESET: React.CSSProperties = {
  background: 'none', border: 'none', padding: 0, margin: 0, cursor: 'pointer',
  color: 'inherit', fontFamily: 'inherit', fontSize: 'inherit', fontWeight: 'inherit', lineHeight: 'inherit',
  textAlign: 'inherit', textDecorationThickness: 1, textUnderlineOffset: 3,
};

function anotherModalOpen(): boolean {
  return typeof document !== 'undefined' && !!document.querySelector('[aria-modal="true"]');
}

function stop(e: React.SyntheticEvent) {
  e.stopPropagation();
}

export interface DelegationPopupLinkProps {
  /** The delegation (societies.id). */
  societyId?: string | null;
  /** Only when the screen has no id: the delegation's exact name. */
  societyName?: string | null;
  /** The tab the pop-up opens on. */
  tab?: DelegationTab;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
  /** A write in the pop-up changed applications. */
  onChanged?: () => void;
  /** The pop-up closed (the page may re-read what the pop-up can change). */
  onClosed?: () => void;
}

export default function DelegationPopupLink({
  societyId, societyName, tab = 'people', children, className, style, title, onChanged, onClosed,
}: DelegationPopupLinkProps) {
  const { conference } = useManage();
  const [open, setOpen] = useState(false);

  const target = societyId || societyName;
  if (!conference || !target) return <>{children}</>;
  const conf: DelegationPopupConference = { id: conference.id, slug: conference.slug, fee_currency: conference.fee_currency };
  const label = societyName ?? (typeof children === 'string' ? children : null);

  function close() {
    setOpen(false);
    onClosed?.();
  }

  return (
    <>
      <button
        type="button"
        draggable={false}
        className={className ? `${LINK_CLASS} ${className}` : LINK_CLASS}
        style={{ ...LINK_RESET, ...style }}
        title={title ?? (label ? `Open ${label}` : 'Open this delegation')}
        onClick={e => {
          e.stopPropagation();
          e.preventDefault();
          if (anotherModalOpen()) return;
          setOpen(true);
        }}
        onKeyDown={stop}
        onPointerDown={stop}
        onMouseDown={stop}
      >
        {children}
      </button>
      {open && (
        <span
          style={{ display: 'contents' }}
          onClick={stop}
          onDoubleClick={stop}
          onKeyDown={stop}
          onKeyUp={stop}
          onPointerDown={stop}
          onPointerUp={stop}
          onMouseDown={stop}
          onMouseUp={stop}
          onDragStart={stop}
          onDragEnd={stop}
          onContextMenu={stop}
          onFocus={stop}
          onBlur={stop}
        >
          {societyId ? (
            <DelegationPopup conference={conf} societyId={societyId} initialTab={tab} onClose={close} onChanged={onChanged} />
          ) : (
            <PopupByName conference={conf} name={societyName ?? ''} tab={tab} onClose={close} onChanged={onChanged} />
          )}
        </span>
      )}
    </>
  );
}

/** The pop-up for a row that carries only the delegation's name. */
function PopupByName({ conference, name, tab, onClose, onChanged }: {
  conference: DelegationPopupConference;
  name: string;
  tab: DelegationTab;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const data = useDelegationsData({ conferenceId: conference.id, currency: conference.fee_currency });
  const id = data.rows.find(r => r.name === name)?.id ?? '';
  return <DelegationPopup conference={conference} societyId={id} initialTab={tab} data={data} onClose={onClose} onChanged={onChanged} />;
}
