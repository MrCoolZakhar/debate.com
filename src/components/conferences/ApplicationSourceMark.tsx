'use client';

// Where one application came from, as ONE small mark (owner, 25 Sep 2026:
// "just the logo of where it came from if there is logo, if not then just
// text"). Reads `applications.traffic_source` (category) and `traffic_detail`
// (one word: instagram, whatsapp, bing, gmail, a host ...), written when the
// applicant submitted (src/lib/trafficSource.ts).
//
// Logos are inline SVG in each platform's own shape and colour, drawn locally:
// no request ever leaves for a third party. Everything without a logo is plain
// text. The full sentence is the tooltip and the accessible name.

import { Mail, UsersRound } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import type { TrafficSource } from '@/lib/trafficSource';

type Logo = (size: number) => ReactNode;

const svg = (size: number, children: ReactNode) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable="false" style={{ display: 'block', flexShrink: 0 }}>
    {children}
  </svg>
);

const LOGOS: Record<string, { name: string; logo: Logo }> = {
  google: {
    name: 'Google',
    logo: s => svg(s, <>
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z" />
      <path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z" />
    </>),
  },
  instagram: {
    name: 'Instagram',
    logo: s => svg(s, <>
      <defs>
        <radialGradient id="gv-ig-grad" cx="0.3" cy="1.07" r="1.15">
          <stop offset="0" stopColor="#FFDD55" />
          <stop offset="0.12" stopColor="#FFDD55" />
          <stop offset="0.5" stopColor="#FF543E" />
          <stop offset="1" stopColor="#C837AB" />
        </radialGradient>
      </defs>
      <rect x="1" y="1" width="22" height="22" rx="6.2" fill="url(#gv-ig-grad)" />
      <rect x="5.4" y="5.4" width="13.2" height="13.2" rx="4" fill="none" stroke="#fff" strokeWidth="1.9" />
      <circle cx="12" cy="12" r="3.2" fill="none" stroke="#fff" strokeWidth="1.9" />
      <circle cx="16.4" cy="7.6" r="1.05" fill="#fff" />
    </>),
  },
  whatsapp: {
    name: 'WhatsApp',
    logo: s => svg(s, <path fill="#25D366" d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.945C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 0 1 8.413 3.488 11.824 11.824 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24Zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 0 0 1.51 5.262l-.999 3.648 3.978-1.209Zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.767.967-.94 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414Z" />),
  },
  facebook: {
    name: 'Facebook',
    logo: s => svg(s, <>
      <circle cx="12" cy="12" r="12" fill="#0866FF" />
      <path fill="#fff" d="M13.4 24v-8.6h2.9l.45-3.35H13.4V9.9c0-.97.27-1.63 1.66-1.63h1.77V5.28a23 23 0 0 0-2.58-.13c-2.56 0-4.31 1.56-4.31 4.43v2.47H7.05v3.35h2.89V24z" />
    </>),
  },
  linkedin: {
    name: 'LinkedIn',
    logo: s => svg(s, <path fill="#0A66C2" d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286ZM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065Zm1.782 13.019H3.555V9h3.564v11.452ZM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0Z" />),
  },
  x: {
    name: 'X',
    logo: s => svg(s, <path fill="#000" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.653l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />),
  },
  tiktok: {
    name: 'TikTok',
    logo: s => svg(s, <>
      <rect x="0" y="0" width="24" height="24" rx="5.5" fill="#000" />
      <path fill="#25F4EE" d="M15.7 4.6c.3 1.9 1.6 3.3 3.5 3.5v2.6a6 6 0 0 1-3.5-1.1v5.2a4.7 4.7 0 1 1-4.1-4.7v2.7a2.1 2.1 0 1 0 1.5 2V4.6z" transform="translate(-0.6 -0.5)" />
      <path fill="#FE2C55" d="M15.7 4.6c.3 1.9 1.6 3.3 3.5 3.5v2.6a6 6 0 0 1-3.5-1.1v5.2a4.7 4.7 0 1 1-4.1-4.7v2.7a2.1 2.1 0 1 0 1.5 2V4.6z" transform="translate(0.6 0.5)" />
      <path fill="#fff" d="M15.7 4.6c.3 1.9 1.6 3.3 3.5 3.5v2.6a6 6 0 0 1-3.5-1.1v5.2a4.7 4.7 0 1 1-4.1-4.7v2.7a2.1 2.1 0 1 0 1.5 2V4.6z" />
    </>),
  },
  telegram: {
    name: 'Telegram',
    logo: s => svg(s, <>
      <circle cx="12" cy="12" r="12" fill="#26A5E4" />
      <path fill="#fff" d="M5.4 11.7l11.9-4.6c.55-.2 1.03.13.85.97l-2.03 9.55c-.15.68-.55.84-1.12.52l-3.1-2.28-1.49 1.44c-.17.17-.3.3-.62.3l.22-3.15 5.73-5.18c.25-.22-.05-.34-.39-.12l-7.08 4.46-3.05-.95c-.66-.21-.67-.66.14-.97Z" />
    </>),
  },
  discord: {
    name: 'Discord',
    logo: s => svg(s, <>
      <rect x="0" y="0" width="24" height="24" rx="6" fill="#5865F2" />
      <path fill="#fff" d="M17.3 7.2a13 13 0 0 0-3.2-1l-.4.8a12 12 0 0 0-3.4 0l-.4-.8a13 13 0 0 0-3.2 1C4.7 10.2 4.1 13.1 4.4 16a13 13 0 0 0 3.9 2l.8-1.3a8.4 8.4 0 0 1-1.3-.6l.3-.25a9.3 9.3 0 0 0 7.8 0l.3.25-1.3.6.8 1.3a13 13 0 0 0 3.9-2c.35-3.4-.55-6.3-2.3-8.8ZM9.7 14.3c-.75 0-1.37-.7-1.37-1.55s.6-1.55 1.37-1.55 1.38.7 1.37 1.55c0 .85-.6 1.55-1.37 1.55Zm4.6 0c-.75 0-1.37-.7-1.37-1.55s.6-1.55 1.37-1.55 1.38.7 1.37 1.55c0 .85-.6 1.55-1.37 1.55Z" />
    </>),
  },
  youtube: {
    name: 'YouTube',
    logo: s => svg(s, <>
      <rect x="0.5" y="4" width="23" height="16" rx="4.6" fill="#FF0000" />
      <path fill="#fff" d="M9.6 8.6v6.8l5.9-3.4z" />
    </>),
  },
  reddit: {
    name: 'Reddit',
    logo: s => svg(s, <>
      <circle cx="12" cy="12" r="12" fill="#FF4500" />
      <ellipse cx="12" cy="14" rx="6.4" ry="4.3" fill="#fff" />
      <circle cx="17.6" cy="10.4" r="1.5" fill="#fff" />
      <circle cx="6.4" cy="10.4" r="1.5" fill="#fff" />
      <circle cx="15.8" cy="5.7" r="1.2" fill="#fff" />
      <path d="M12 9.7l1-4 2.8.6" fill="none" stroke="#fff" strokeWidth="0.9" strokeLinecap="round" />
      <circle cx="9.7" cy="13.3" r="1" fill="#FF4500" />
      <circle cx="14.3" cy="13.3" r="1" fill="#FF4500" />
      <path d="M9.6 15.9c1.4.9 3.4.9 4.8 0" fill="none" stroke="#FF4500" strokeWidth="0.8" strokeLinecap="round" />
    </>),
  },
  bing: {
    name: 'Bing',
    logo: s => svg(s, <path fill="#0C8484" d="M5.2 2.2l4.3 1.5v13.6l5.9-3.4-2.9-1.36-1.8-4.46 9.1 3.2v4.7L9.5 21.8 5.2 19.4z" />),
  },
  gmail: {
    name: 'Gmail',
    logo: s => svg(s, <>
      <path fill="#4285F4" d="M1.6 20.5h3.8v-9.2L0 7.3v11.6c0 .9.7 1.6 1.6 1.6z" />
      <path fill="#34A853" d="M18.6 20.5h3.8c.9 0 1.6-.7 1.6-1.6V7.3l-5.4 4z" />
      <path fill="#FBBC04" d="M18.6 4.4v6.9L24 7.3V5.1c0-2-2.3-3.1-3.9-1.9z" />
      <path fill="#EA4335" d="M5.4 11.3V4.4L12 9.4l6.6-5v6.9L12 16.2z" />
      <path fill="#C5221F" d="M0 5.1v2.2l5.4 4V4.4L3.9 3.2C2.3 2 0 3.1 0 5.1z" />
    </>),
  },
  outlook: {
    name: 'Outlook',
    logo: s => svg(s, <>
      <rect x="7" y="4" width="16" height="16" rx="2" fill="#28A8EA" />
      <rect x="1" y="6" width="12" height="12" rx="1.6" fill="#0078D4" />
      <ellipse cx="7" cy="12" rx="2.6" ry="3.2" fill="none" stroke="#fff" strokeWidth="1.6" />
    </>),
  },
};

const WORD_NAMES: Record<string, string> = {
  threads: 'Threads', snapchat: 'Snapchat', pinterest: 'Pinterest', duckduckgo: 'DuckDuckGo',
  yahoo: 'Yahoo', ecosia: 'Ecosia', yandex: 'Yandex', baidu: 'Baidu', brave: 'Brave Search',
  qwant: 'Qwant', startpage: 'Startpage', naver: 'Naver', 'yahoo-mail': 'Yahoo Mail',
  proton: 'Proton Mail', aol: 'AOL Mail', zoho: 'Zoho Mail',
};

export interface SourceInfo {
  /** Short visible text when there is no logo. */
  text: string;
  /** The full sentence (tooltip + accessible name). */
  title: string;
  logo: Logo | null;
}

/** How one application's source reads (category + detail word). */
export function describeApplicationSource(source: string | null, detail: string | null): SourceInfo {
  const d = detail?.toLowerCase() ?? null;
  const known = d ? LOGOS[d] : undefined;
  switch (source as TrafficSource | null) {
    case 'gavelling':
      return {
        text: 'Gavelling',
        title: 'Found the conference on Gavelling (Explore, the map, the homepage or another Gavelling page)',
        logo: s => (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/gavelling-mark.png" alt="" width={s} height={s} style={{ display: 'block', width: s, height: s, objectFit: 'contain', flexShrink: 0 }} />
        ),
      };
    case 'google':
      return { text: 'Google', title: 'Came from a Google search', logo: LOGOS.google.logo };
    case 'social': {
      const name = known?.name ?? (d ? WORD_NAMES[d] ?? d : 'Social media');
      return { text: name, title: `Came from ${d ? name : 'social media'}`, logo: known?.logo ?? null };
    }
    case 'other_search': {
      const name = known?.name ?? (d ? WORD_NAMES[d] ?? d : 'another search engine');
      return { text: d ? name : 'Other search', title: `Came from a search on ${name}`, logo: known?.logo ?? null };
    }
    case 'email': {
      const name = known?.name ?? (d ? WORD_NAMES[d] ?? d : null);
      return {
        text: name ?? 'Email',
        title: name ? `Came from an email (${name})` : 'Came from a link in an email',
        logo: known?.logo ?? (name ? null : (s => <Mail size={s} strokeWidth={2} aria-hidden style={{ flexShrink: 0, color: '#1B3828' }} />)),
      };
    }
    case 'direct':
      return { text: 'Direct link', title: 'Opened a shared link with no referring site (for example WhatsApp on iPhone, a typed or bookmarked address)', logo: null };
    case 'other':
      return { text: d ?? 'Another website', title: d ? `Came from ${d}` : 'Came from another website', logo: known?.logo ?? null };
    default:
      return { text: 'Not tracked', title: 'Where this applicant came from was not recorded (applied before 18 Sep 2026, or the browser kept nothing)', logo: null };
  }
}

export default function ApplicationSourceMark({
  source,
  detail,
  invited,
  importedBy,
  size = 16,
  style,
}: {
  source: string | null;
  detail: string | null;
  /** Organiser-added rows (imports, invites) have no source of their own. */
  invited?: boolean;
  /** The delegation whose leader imported this applicant
   *  (conference_leader_imports). Shown instead of the traffic source, and
   *  still after the delegate claims (claiming clears invited_email). */
  importedBy?: string | null;
  size?: number;
  style?: CSSProperties;
}) {
  if (importedBy) {
    const text = `Imported by ${importedBy}`;
    return (
      <span
        role="img"
        aria-label={text}
        title={text}
        className="inline-flex items-center justify-center"
        style={{ width: size, height: size, flexShrink: 0, color: '#1B3828', ...style }}
      >
        <UsersRound size={size} strokeWidth={2.2} aria-hidden />
      </span>
    );
  }
  if (invited) return null;
  const info = describeApplicationSource(source, detail);
  if (info.logo) {
    return (
      <span
        role="img"
        aria-label={info.title}
        title={info.title}
        className="inline-flex items-center justify-center"
        style={{ width: size, height: size, flexShrink: 0, ...style }}
      >
        {info.logo(size)}
      </span>
    );
  }
  return (
    <span
      title={info.title}
      aria-label={info.title}
      style={{
        fontFamily: 'var(--font-brand), sans-serif', fontSize: 11, fontWeight: 600, color: '#5C4F42',
        overflowWrap: 'anywhere', maxWidth: 180, lineHeight: 1.2,
        ...style,
      }}
    >
      {info.text}
    </span>
  );
}

/**
 * The same mark for the applicant pop-up's hero (a dark forest band): the logo
 * on a small ivory disc so dark marks (X, TikTok) stay visible, or the text in
 * the hero's light ink. Nothing for rows an organiser added.
 */
export function ApplicationSourceChip({
  source,
  detail,
  invited,
  importedBy,
}: {
  source: string | null;
  detail: string | null;
  invited?: boolean;
  /** See ApplicationSourceMark: a leader import names the delegation. */
  importedBy?: string | null;
}) {
  if (importedBy) {
    return (
      <span
        style={{
          fontFamily: 'var(--font-brand), sans-serif', fontSize: 11, fontWeight: 600, color: 'rgba(250,248,243,0.82)',
          overflowWrap: 'anywhere', maxWidth: 260, lineHeight: 1.2,
        }}
      >
        Imported by {importedBy}
      </span>
    );
  }
  if (invited) return null;
  const info = describeApplicationSource(source, detail);
  if (info.logo) {
    return (
      <span
        role="img"
        aria-label={info.title}
        title={info.title}
        className="inline-flex items-center justify-center rounded-full"
        style={{ width: 24, height: 24, backgroundColor: '#FAF8F3', boxShadow: '0 1px 3px rgba(16,28,21,0.35)', flexShrink: 0 }}
      >
        {info.logo(15)}
      </span>
    );
  }
  return (
    <span
      title={info.title}
      aria-label={info.title}
      style={{
        fontFamily: 'var(--font-brand), sans-serif', fontSize: 11, fontWeight: 600, color: 'rgba(250,248,243,0.82)',
        overflowWrap: 'anywhere', maxWidth: 200, lineHeight: 1.2,
      }}
    >
      {info.text}
    </span>
  );
}
