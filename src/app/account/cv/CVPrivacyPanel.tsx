'use client';

// Who can read your MUN CV (24 Sep 2026).
//
// Three settings, all enforced in the DATABASE, not here:
//   • profiles.cv_private           the whole public page (/cv/[id]) is gone
//   • profiles.cv_hide_nationality  the flag and country leave the page
//   • mun_cv_entries.is_private     one conference leaves the page (the eye
//                                   on each timeline card, CVTimeline.tsx)
// get_public_cv() honours all three, and the table's SELECT policy
// (cv_entry_visible) stops a private entry being read straight from the API.
// The owner, platform admins and the organisers of a conference the owner
// applied to (application or job-board application) still see everything,
// because they review the record; the copy below says so.

import { Globe2, Lock, Flag, ExternalLink } from 'lucide-react';
import { GlassCard, OUTFIT, T } from '../accountUi';

export interface CvPrivacy {
  cvPrivate: boolean;
  hideNationality: boolean;
}

export default function CVPrivacyPanel({
  value,
  onChange,
  saving,
  error,
  publicHref,
  hiddenCount,
}: {
  value: CvPrivacy;
  onChange: (next: Partial<CvPrivacy>) => void;
  saving: boolean;
  error: string | null;
  publicHref: string | null;
  hiddenCount: number;
}) {
  const { cvPrivate, hideNationality } = value;

  const choice = (isPrivate: boolean) => {
    const on = cvPrivate === isPrivate;
    const Icon = isPrivate ? Lock : Globe2;
    return (
      <button
        type="button"
        role="radio"
        aria-checked={on}
        disabled={saving}
        onClick={() => { if (!on) onChange({ cvPrivate: isPrivate }); }}
        className="flex-1 flex items-center gap-2.5 rounded-2xl text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F]"
        style={{
          padding: '12px 14px',
          background: on ? '#1B3828' : 'transparent',
          color: on ? '#FAF8F3' : '#1C1410',
          border: on ? '1.5px solid #1B3828' : '1.5px solid rgba(221,212,192,0.95)',
          cursor: saving ? 'default' : 'pointer',
          transition: 'background-color 180ms ease, color 180ms ease, border-color 180ms ease',
        }}
      >
        <Icon size={20} strokeWidth={2.2} style={{ color: on ? '#EED98A' : '#5C5140', flexShrink: 0 }} aria-hidden />
        <span className="min-w-0">
          <span className="block" style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: T.body }}>
            {isPrivate ? 'Private' : 'Public'}
          </span>
          <span className="block" style={{ fontFamily: OUTFIT, fontSize: T.caption, lineHeight: 1.4, color: on ? 'rgba(250,248,243,0.78)' : '#6E5F4E' }}>
            {isPrivate ? 'Only you, and organisers you apply to' : 'Anyone with the link'}
          </span>
        </span>
      </button>
    );
  };

  return (
    <GlassCard className="!p-5 mb-8">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-3">
        <h2 style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 17, color: '#1C1410', margin: 0 }}>
          Who Can See Your CV
        </h2>
        {!cvPrivate && publicHref && (
          <a
            href={publicHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5"
            style={{ fontFamily: OUTFIT, fontSize: T.caption, fontWeight: 700, color: '#1B3828', textDecoration: 'underline', textUnderlineOffset: 3, paddingBlock: 6 }}
          >
            See what visitors see <ExternalLink size={13} strokeWidth={2.3} aria-hidden />
          </a>
        )}
      </div>

      <div role="radiogroup" aria-label="Who can see your CV" className="flex flex-col sm:flex-row gap-2">
        {choice(false)}
        {choice(true)}
      </div>

      {!cvPrivate && (
        <label
          className="mt-3 flex items-center justify-between gap-3 rounded-2xl"
          style={{ padding: '10px 14px', border: '1.5px solid rgba(221,212,192,0.95)', cursor: saving ? 'default' : 'pointer' }}
        >
          <span className="inline-flex items-center gap-2.5" style={{ fontFamily: OUTFIT, fontSize: T.body, fontWeight: 600, color: '#1C1410' }}>
            <Flag size={17} strokeWidth={2.2} style={{ color: '#5C5140' }} aria-hidden />
            Show my nationality
          </span>
          <input
            type="checkbox"
            role="switch"
            className="sr-only peer"
            checked={!hideNationality}
            disabled={saving}
            onChange={(e) => onChange({ hideNationality: !e.target.checked })}
          />
          <span
            aria-hidden
            className="relative flex-shrink-0 rounded-full peer-focus-visible:ring-2 peer-focus-visible:ring-[#B6871F]"
            style={{ width: 44, height: 26, background: hideNationality ? 'rgba(154,138,120,0.45)' : '#1B3828', transition: 'background-color 180ms ease' }}
          >
            <span
              className="absolute rounded-full"
              style={{ top: 3, left: 3, width: 20, height: 20, background: '#FAF8F3', transform: hideNationality ? 'none' : 'translateX(18px)', transition: 'transform 180ms cubic-bezier(0.22,1,0.36,1)', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}
            />
          </span>
        </label>
      )}

      <p style={{ fontFamily: OUTFIT, fontSize: T.caption, color: '#6E5F4E', lineHeight: 1.6, margin: '12px 0 0' }}>
        {cvPrivate
          ? 'Your CV link shows nothing to visitors. Organisers of conferences you apply to still see your record, because they review it.'
          : hiddenCount > 0
            ? `${hiddenCount} ${hiddenCount === 1 ? 'conference is' : 'conferences are'} hidden from your public CV. Organisers of conferences you apply to still see them.`
            : 'Hide a single conference with the eye on its card. Organisers of conferences you apply to always see your full record.'}
      </p>

      {error && (
        <p role="alert" style={{ fontFamily: OUTFIT, fontSize: T.caption, fontWeight: 700, color: '#8B2020', margin: '8px 0 0' }}>
          {error}
        </p>
      )}
    </GlassCard>
  );
}
