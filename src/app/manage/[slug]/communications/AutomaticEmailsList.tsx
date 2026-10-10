'use client';

/**
 * Automatic emails as a plain list of switches (redesign, 9 Oct 2026).
 *
 * One row per email: its name, one sentence on when it goes out, a switch,
 * "See what it says" and "Change the wording". The page keeps every write
 * (the switch is the same handleToggleEnabled, the editor the same builder);
 * this file only draws. Indicators that changed no decision (per-stage
 * "N of M on" counts, "sent N times", emoji discs per stage) are gone.
 */

import type { ReactNode } from 'react';
import { Lock } from 'lucide-react';
import { CARD, FONT, INK, SOFT_INK, FOREST, BackLink, CommsTitle, OnOffSwitch, TextLink } from './commsKit';

export interface AutoRow {
  key: string;
  label: string;
  description: string;
  /** Sends itself and cannot be switched off (the functional emails). */
  alwaysOn: boolean;
  on: boolean;
  toggling: boolean;
  /** The organiser wrote their own subject and message. */
  ownWording: boolean;
  /** Repeat settings for a reminder, drawn by the page when on. */
  reminder?: ReactNode;
}

export interface AutoGroup { title: string; rows: AutoRow[] }

/** The first sentence only: the rest is detail a 12-year-old does not need. */
function firstSentence(s: string): string {
  const m = s.match(/^.*?[.!?](\s|$)/);
  return (m ? m[0] : s).trim();
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
  return (
    <div>
      {embedded ? (
        <p className="mb-5" style={{ fontFamily: FONT, color: SOFT_INK, fontSize: 15, maxWidth: 620, textWrap: 'pretty' }}>
          These send themselves when something happens, like an application being accepted. Switch on the ones you want.
        </p>
      ) : (
        <>
          <BackLink onClick={onBack} />
          <CommsTitle lead="Automatic" gold="Emails" sub="These send themselves when something happens, like an application being accepted. Switch on the ones you want." />
        </>
      )}
      {top}

      <div className="flex flex-col gap-8" style={{ maxWidth: 860 }}>
        {groups.map(g => (
          <section key={g.title}>
            <h2 style={{ fontFamily: FONT, fontWeight: 800, fontSize: 19, color: INK, marginBottom: 10 }}>{g.title}</h2>
            <div className="overflow-hidden" style={CARD}>
              {g.rows.map((r, i) => (
                <div key={r.key} className="px-4 sm:px-5 py-4" style={{ borderTop: i === 0 ? 'none' : '1px solid rgba(27,56,40,0.08)' }}>
                  <div className="flex items-start gap-4">
                    <div className="min-w-0 flex-1">
                      <p style={{ fontFamily: FONT, fontWeight: 700, fontSize: 16, color: INK, overflowWrap: 'anywhere' }}>{r.label}</p>
                      <p title={r.description} style={{ fontFamily: FONT, fontSize: 14, color: SOFT_INK, marginTop: 2, lineHeight: 1.45, textWrap: 'pretty' }}>
                        {firstSentence(r.description)}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-0 mt-1">
                        <TextLink onClick={() => onPreview(r.key)}>See what it says</TextLink>
                        {!r.alwaysOn && (
                          <TextLink onClick={() => onEdit(r.key)}>{r.ownWording ? 'Edit your wording' : 'Write your own'}</TextLink>
                        )}
                        {r.on && !r.alwaysOn && (
                          <span style={{ fontFamily: FONT, fontSize: 13, color: SOFT_INK }}>
                            {r.ownWording ? 'Sends your wording' : 'Sends our wording'}
                          </span>
                        )}
                      </div>
                    </div>
                    {r.alwaysOn ? (
                      <span className="flex-shrink-0 inline-flex items-center gap-1.5" style={{ fontFamily: FONT, fontSize: 13, fontWeight: 700, color: FOREST, marginTop: 4 }}>
                        <Lock size={14} aria-hidden /> Always on
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

        <section>
          <h2 style={{ fontFamily: FONT, fontWeight: 800, fontSize: 19, color: INK, marginBottom: 10 }}>Always sent by Gavelling</h2>
          <div className="px-5 py-4 flex items-start gap-3" style={CARD}>
            <Lock size={16} style={{ color: FOREST, marginTop: 3, flexShrink: 0 }} aria-hidden />
            <p style={{ fontFamily: FONT, fontSize: 14, color: INK, lineHeight: 1.5, textWrap: 'pretty' }}>
              {alwaysOnNames.join(', ')}. We write these so the amounts are always right.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
