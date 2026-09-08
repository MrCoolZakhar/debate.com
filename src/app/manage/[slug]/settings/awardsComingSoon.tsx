'use client';

// ── Settings → Awards: the holding screen ───────────────────────────────────
// Awards used to have their own destination in the manage rail. They are now a
// tab in Settings, and while the feature is being finished that tab shows this
// instead of the working configuration UI.
//
// HOW TO TURN AWARDS BACK ON (one line, in settings/page.tsx):
//   1. import { AwardsSettings } from './awardsUi';   (replaces this import)
//   2. render {activeTab === 'awards' && <AwardsSettings conference={conference} />}
// `awardsUi.tsx` is untouched on disk and still saves into
// `conferences.awards_config`. The secretariat desk is preserved the same way
// at manage/[slug]/awards/AwardsConsole.tsx. Nothing in the database changed:
// `conference_awards`, `awards_published_at` and every RPC are intact, and any
// award already published is still on its recipient's MUN CV and on the public
// honour roll.

import { Trophy } from 'lucide-react';

const OUTFIT = "'Outfit', sans-serif";

// What the finished tab will hold. Deliberately no date: this sets an
// expectation, not a promise.
const COMING = [
  'Choose which honours your conference gives, and how many of each per committee.',
  'Let chairs nominate from their own committee, with the session record beside every name.',
  'Ratify each slate as a secretariat, then publish the whole conference at the ceremony.',
  'Every published award lands on the delegate’s verified MUN CV automatically.',
];

export function AwardsComingSoon() {
  return (
    <div
      style={{
        backgroundColor: '#FFFDF9',
        border: '1.5px solid #D8CDB6',
        borderRadius: '16px',
        padding: '32px',
        boxShadow: '0 1px 2px rgba(27,56,40,0.04)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
        <div
          aria-hidden
          style={{
            width: 46,
            height: 46,
            borderRadius: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#F5EFDC',
            border: '1.5px solid #E4D8B4',
            boxShadow: 'inset 0 1px 2px rgba(27,56,40,0.06)',
            flexShrink: 0,
          }}
        >
          <Trophy size={22} strokeWidth={2} style={{ color: '#B6871F' }} />
        </div>
        <div style={{ minWidth: 0 }}>
          <p
            style={{
              fontFamily: OUTFIT,
              fontWeight: 700,
              fontSize: 10,
              letterSpacing: '0.14em',
              color: '#B6871F',
              marginBottom: 4,
            }}
          >
            COMING SOON
          </p>
          <h2 style={{ fontFamily: OUTFIT, fontWeight: 900, fontSize: 20, color: '#1C1410' }}>
            Awards
          </h2>
        </div>
      </div>

      <p style={{ fontFamily: OUTFIT, fontSize: 14, lineHeight: 1.6, color: '#5A4F42', marginBottom: 18 }}>
        Awards are being rebuilt, so there is nothing to set up here yet. You do not need to do
        anything, and your conference is not held back by this. We will turn the tab on for
        everyone once it is ready.
      </p>

      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10 }}>
        {COMING.map(line => (
          <li key={line} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span
              aria-hidden
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: '#EED98A',
                border: '1px solid #C9AE5E',
                marginTop: 7,
                flexShrink: 0,
              }}
            />
            <span style={{ fontFamily: OUTFIT, fontSize: 13.5, lineHeight: 1.55, color: '#5A4F42' }}>
              {line}
            </span>
          </li>
        ))}
      </ul>

      <p
        style={{
          fontFamily: OUTFIT,
          fontSize: 12.5,
          lineHeight: 1.55,
          color: '#5A4F42',
          marginTop: 20,
          paddingTop: 16,
          borderTop: '1px solid #E8DFCA',
        }}
      >
        Awards already published at a past conference are unaffected. They stay on the public
        honour roll and on every delegate&rsquo;s MUN CV.
      </p>
    </div>
  );
}
