'use client';

// ─────────────────────────────────────────────────────────────────────────────
// THE ROSTER, who is actually getting this, as a panel rather than a scroll.
//
// This list used to live at the BOTTOM of the "who gets this email?" dialog,
// under the dot field, the six role tiles and the filter stack. To read it you
// opened a modal, scrolled past every control that could change it, and read
// it inside a layer you then had to dismiss to get back to your email.
//
// The modal keeps the CHOOSING. This panel is the RESULT, and it lives in the
// builder's own rail: one click, no layer, no page scroll, and it does not
// move the canvas by a pixel.
//
// Each row answers the four questions an organiser actually asks about a
// recipient before pressing send: who is this, what address will it hit, who
// did they come with, and what are they doing at the conference. The committee
// is drawn once per group as a LogoDisc monogram rather than repeated on every
// row, which is both less ink and how a delegation list is normally read.
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useState } from 'react';
import { Search, AlertTriangle } from 'lucide-react';
import { LogoDisc } from '@/components/LogoDisc';
import ProfileLink from '@/components/ProfileLink';
import { NEU, OUTFIT, EASE } from '@/components/neu';
import { SOFT, AMBER_INK, CARD_BORDER } from '@/app/manage/[slug]/live/tokens';
import type { ReachGroup, ReachPerson } from './AudienceReach';

const FOREST = '#1B3828';
const INK = '#1C1410';

/** Group keys are dimension-prefixed by the page (`com:`, `del:`, `role:`…).
 *  Only a committee group earns a logo disc; a payment-status group would
 *  render a monogram of the word "Paid", which is noise. */
function isCommitteeGroup(key: string): boolean {
  return key.startsWith('com:') && key !== 'com:none';
}

/** Initials for the monogram: an acronym is used whole (up to 3), a spelled
 *  out name collapses to its own initials. */
function monogram(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) return '?';
  if (/^[A-Z0-9]{2,5}$/.test(trimmed)) return trimmed.slice(0, 3);
  const words = trimmed.split(/\s+/).filter(w => /[a-z0-9]/i.test(w));
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return words.slice(0, 3).map(w => w[0]).join('').toUpperCase();
}

/** The detail line, built from whatever the row actually carries. Falls back
 *  to the page's pre-joined `sub` string, so this panel renders correctly
 *  whether or not the structured fields have been wired up yet. */
function detailOf(p: ReachPerson): string {
  const parts = [p.delegation, p.country].filter((s): s is string => !!s && !!s.trim());
  if (parts.length > 0) return parts.join(' · ');
  return p.sub;
}

function emailOf(p: ReachPerson): string | null {
  const e = p.email?.trim();
  if (e) return e;
  // Older callers put the address into `sub` when there was no other detail.
  return p.sub.includes('@') ? p.sub : null;
}

export default function RecipientRoster({
  groups, reachCount, wide,
}: {
  groups: ReachGroup[];
  reachCount: number;
  wide: boolean;
}) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map(g => ({ ...g, members: g.members.filter(m => `${m.name} ${m.sub} ${m.email ?? ''}`.toLowerCase().includes(q)) }))
      .filter(g => g.members.length > 0);
  }, [groups, query]);

  const shown = filtered.reduce((n, g) => n + g.members.length, 0);

  return (
    <div>
      <p className="mb-2" style={{ fontFamily: OUTFIT, fontSize: 11.5, color: SOFT, lineHeight: 1.5, textWrap: 'pretty' }}>
        <span style={{ fontWeight: 800, color: INK, fontVariantNumeric: 'tabular-nums' }}>{reachCount.toLocaleString()}</span>
        {reachCount === 1 ? ' person is' : ' people are'} getting this. Change who with the button at the top.
      </p>

      <div className="relative mb-2">
        <Search size={13} strokeWidth={2.4} style={{ position: 'absolute', left: 11, top: 12, color: SOFT, pointerEvents: 'none' }} />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Find someone…"
          aria-label="Find someone in the list"
          className="w-full focus:outline-none"
          style={{
            minHeight: 38, borderRadius: 999, padding: '9px 12px 9px 31px',
            fontFamily: OUTFIT, fontSize: 12, color: INK,
            backgroundColor: '#FFFDF8', border: '1px solid rgba(27,56,40,0.13)', boxShadow: NEU.inSm,
          }}
        />
      </div>

      {groups.length === 0 && (
        <p style={{ fontFamily: OUTFIT, fontSize: 11.5, color: SOFT, lineHeight: 1.5, textWrap: 'pretty' }}>
          Nobody yet. Pick an audience with CHANGE WHO above.
        </p>
      )}
      {groups.length > 0 && shown === 0 && (
        <p style={{ fontFamily: OUTFIT, fontSize: 11.5, color: SOFT, lineHeight: 1.5, textWrap: 'pretty' }}>
          Nobody here matches &ldquo;{query.trim()}&rdquo;.
        </p>
      )}

      <div
        className="flex flex-col gap-2.5"
        style={{ maxHeight: wide ? 'calc(100vh - 260px)' : 320, overflowY: 'auto', overflowX: 'hidden' }}
      >
        {filtered.map(g => (
          <div key={g.key}>
            <div className="flex items-center gap-2 mb-1.5">
              {isCommitteeGroup(g.key) ? (
                <LogoDisc src={null} size={24} fallbackText={monogram(g.label)} />
              ) : (
                <span
                  className="inline-flex items-center justify-center flex-shrink-0"
                  style={{ width: 24, height: 24, borderRadius: 999, backgroundColor: 'rgba(27,56,40,0.07)' }}
                />
              )}
              <span className="min-w-0 flex-1 truncate" title={g.label} style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 800, color: INK }}>
                {g.label}
              </span>
              <span className="flex-shrink-0" style={{ fontFamily: OUTFIT, fontSize: 11, fontWeight: 700, color: SOFT, fontVariantNumeric: 'tabular-nums' }}>
                {g.members.length}
              </span>
            </div>

            <div className="flex flex-col gap-1">
              {g.members.map(p => {
                const email = emailOf(p);
                const detail = detailOf(p);
                return (
                  <div
                    key={p.id}
                    className="flex items-center gap-2"
                    style={{
                      minHeight: 44, padding: '6px 9px', borderRadius: 13,
                      backgroundColor: '#FFFDF8', border: CARD_BORDER,
                      transitionProperty: 'background-color',
                      transitionDuration: '160ms',
                      transitionTimingFunction: EASE,
                    }}
                  >
                    <ProfileLink userId={p.userId} name={p.name}>
                      <span className="flex items-center gap-2 min-w-0">
                        {p.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={p.avatarUrl}
                            alt=""
                            className="rounded-full object-cover flex-shrink-0"
                            style={{ width: 26, height: 26, outline: '1px solid rgba(0,0,0,0.1)', outlineOffset: -1 }}
                          />
                        ) : (
                          <span
                            className="flex items-center justify-center rounded-full flex-shrink-0"
                            style={{ width: 26, height: 26, backgroundColor: 'rgba(27,56,40,0.1)', color: FOREST, fontSize: 11, fontWeight: 800, fontFamily: OUTFIT }}
                          >
                            {p.name.charAt(0).toUpperCase()}
                          </span>
                        )}
                        {/* THREE LINES, IN ORDER OF WHAT IS ASKED FIRST: who,
                            what address, then what they are doing here. The
                            name gets a line to ITSELF, a role chip beside it
                            in a 180px rail pushed "Tobias Lindqvist" onto its
                            own wrapped line under a floating DELEGATE badge,
                            which read as a broken row. The badges sit on the
                            third line, where they are next to the delegation
                            they qualify anyway. */}
                        <span className="min-w-0">
                          <span className="block truncate" title={p.name} style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 800, color: p.optedOut ? SOFT : INK }}>
                            {p.name}
                          </span>
                          {email && (
                            <span className="block truncate" title={email} style={{ fontFamily: OUTFIT, fontSize: 10.5, color: SOFT }}>
                              {email}
                            </span>
                          )}
                          <span className="flex items-center gap-1 min-w-0">
                            {p.roleLabel && (
                              <span
                                className="flex-shrink-0"
                                style={{
                                  fontFamily: OUTFIT, fontSize: 8.5, fontWeight: 800, letterSpacing: '0.04em',
                                  padding: '1px 5px', borderRadius: 999,
                                  backgroundColor: 'rgba(27,56,40,0.08)', color: FOREST,
                                }}
                              >
                                {p.roleLabel.toUpperCase()}
                              </span>
                            )}
                            {p.optedOut && (
                              <span
                                className="flex-shrink-0 inline-flex items-center gap-1"
                                title="This person turned off marketing emails, so they are left off automatically."
                                style={{
                                  fontFamily: OUTFIT, fontSize: 8.5, fontWeight: 800,
                                  padding: '1px 5px', borderRadius: 999,
                                  backgroundColor: 'rgba(126,81,40,0.10)', color: AMBER_INK,
                                  border: '1px solid rgba(126,81,40,0.28)',
                                }}
                              >
                                <AlertTriangle size={9} strokeWidth={2.8} />
                                SAID NO
                              </span>
                            )}
                            {detail && detail !== email && (
                              <span className="truncate" title={detail} style={{ fontFamily: OUTFIT, fontSize: 10.5, color: SOFT }}>
                                {detail}
                              </span>
                            )}
                          </span>
                        </span>
                      </span>
                    </ProfileLink>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
