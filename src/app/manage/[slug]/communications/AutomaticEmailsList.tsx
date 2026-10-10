'use client';

/**
 * Automatic emails as a plain list of switches (redesign 9 Oct 2026, made
 * simpler 10 Oct 2026 under the 12-year-old rule).
 *
 * Grouped by the participant's journey (automaticEmails.ts). One row per
 * email: its name, one plain line on when it sends, a switch on the right,
 * and Preview / Edit as two small links. A reminder's repeat settings show
 * under it only while it is on. The always-on invite reminders fold into
 * their invite's row, and the four money emails Gavelling always sends are
 * one quiet line at the end. No counts, no badges, no decorative icons.
 *
 * The page keeps every write (the switch is the same handleToggleEnabled, the
 * editor the same builder, the reminder settings the same handleUpdateRecurring);
 * this file only draws.
 */

import type { ReactNode } from 'react';
import { CARD, FONT, INK, SOFT_INK, FOREST, BackLink, CommsTitle, OnOffSwitch } from './commsKit';

export interface AutoRow {
  key: string;
  label: string;
  /** One plain line: when this email goes out. */
  when: string;
  /** Sends itself and cannot be switched off (the functional invites). */
  alwaysOn: boolean;
  on: boolean;
  toggling: boolean;
  /** The organiser wrote their own subject and message. */
  ownWording: boolean;
  /** Repeat settings for a reminder, drawn by the page; shown only while on. */
  reminder?: ReactNode;
  /** Always-on reminders that chase this invite, previewable one by one. */
  followUps?: { key: string; label: string }[];
}

export interface AutoGroup { title: string; rows: AutoRow[] }

function SmallLink({ onClick, children, label }: { onClick: () => void; children: ReactNode; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] rounded"
      style={{ background: 'none', border: 'none', padding: '8px 2px', minHeight: 36, cursor: 'pointer', fontFamily: FONT, fontSize: 14, fontWeight: 700, color: FOREST, textDecoration: 'underline', textUnderlineOffset: 3 }}
    >
      {children}
    </button>
  );
}

export default function AutomaticEmailsList({
  groups, alwaysOnNames, onBack, onToggle, onPreview, onEdit, top, embedded,
}: {
  groups: AutoGroup[];
  alwaysOnNames: string[];
  onBack: () => void;
  /** Drawn as a tab of the Communications page ("Your messages"): the page
   *  carries the title and the tabs, so no back link and no title here. */
  embedded?: boolean;
  onToggle: (key: string) => void;
  onPreview: (key: string) => void;
  onEdit: (key: string) => void;
  top?: ReactNode;
}) {
  const intro = 'These send by themselves when something happens. Switch off any you do not want.';
  return (
    <div>
      {embedded ? (
        <p className="mb-6" style={{ fontFamily: FONT, color: SOFT_INK, fontSize: 15, maxWidth: 620, textWrap: 'pretty' }}>{intro}</p>
      ) : (
        <>
          <BackLink onClick={onBack} />
          <CommsTitle lead="Automatic" gold="Emails" sub={intro} />
        </>
      )}
      {top}

      <div className="flex flex-col gap-7" style={{ maxWidth: 820 }}>
        {groups.map(g => (
          <section key={g.title} aria-labelledby={`auto-${g.title}`}>
            <h2 id={`auto-${g.title}`} style={{ fontFamily: FONT, fontWeight: 800, fontSize: 18, color: INK, marginBottom: 8 }}>{g.title}</h2>
            <div className="overflow-hidden" style={CARD}>
              {g.rows.map((r, i) => (
                <div key={r.key} className="px-4 sm:px-5 py-3.5" style={{ borderTop: i === 0 ? 'none' : '1px solid rgba(27,56,40,0.08)' }}>
                  <div className="flex items-start gap-4">
                    <div className="min-w-0 flex-1">
                      <p style={{ fontFamily: FONT, fontWeight: 700, fontSize: 16, color: INK, overflowWrap: 'anywhere' }}>{r.label}</p>
                      <p style={{ fontFamily: FONT, fontSize: 14, color: SOFT_INK, marginTop: 1, lineHeight: 1.45, textWrap: 'pretty' }}>{r.when}</p>
                      <div className="flex flex-wrap items-center gap-x-4 -mb-1">
                        <SmallLink onClick={() => onPreview(r.key)} label={`Preview ${r.label}`}>Preview</SmallLink>
                        {!r.alwaysOn && (
                          <SmallLink onClick={() => onEdit(r.key)} label={`Edit ${r.label}`}>{r.ownWording ? 'Edit your wording' : 'Edit'}</SmallLink>
                        )}
                      </div>
                      {r.followUps && r.followUps.length > 0 && (
                        <p className="flex flex-wrap items-center gap-x-2" style={{ fontFamily: FONT, fontSize: 14, color: SOFT_INK }}>
                          <span>Reminders if not answered:</span>
                          {r.followUps.map((f, n) => (
                            <SmallLink key={f.key} onClick={() => onPreview(f.key)} label={`Preview ${f.label}`}>{n + 1}</SmallLink>
                          ))}
                        </p>
                      )}
                    </div>
                    {r.alwaysOn ? (
                      <span className="flex-shrink-0" style={{ fontFamily: FONT, fontSize: 13, fontWeight: 700, color: SOFT_INK, marginTop: 4 }}>
                        Always sends
                      </span>
                    ) : (
                      <OnOffSwitch on={r.on} disabled={r.toggling} onChange={() => onToggle(r.key)} label={`${r.label}: ${r.on ? 'on' : 'off'}`} />
                    )}
                  </div>
                  {r.on && r.reminder}
                </div>
              ))}
            </div>
          </section>
        ))}

        <p style={{ fontFamily: FONT, fontSize: 14, color: SOFT_INK, lineHeight: 1.5, textWrap: 'pretty' }}>
          Gavelling also always sends these, so the amounts are always right: {alwaysOnNames.join(', ')}.
        </p>
      </div>
    </div>
  );
}
