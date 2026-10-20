// The pieces the public conference page shows only on a Gavelling LISTING (a conference we list from
// its own public website; `conferences.listed_by = 'gavelling'`, src/lib/listings.ts). Owner,
// 19 Oct 2026: no Apply, the main button is "Visit their website"; claims are manual, by email to
// the team inbox; every listing says where it came from and how to correct or remove it.
// Pure presentation, no hooks: safe in the client view and in server components.

import { ExternalLink, Mail } from 'lucide-react';
import { normalizeSocialUrl } from '@/lib/socialLinks';
import type { BannerCredit, ListingMeta } from '@/lib/listings';

const FONT = "var(--font-brand), sans-serif";
const EASE = 'cubic-bezier(0.22,1,0.36,1)';

/** The team inbox. Claims, corrections and removals all come here and are handled by hand. */
export const LISTINGS_INBOX = 'wearegavelling@gmail.com';

function mailto(subject: string, body?: string): string {
  const q = [`subject=${encodeURIComponent(subject)}`, ...(body ? [`body=${encodeURIComponent(body)}`] : [])].join('&');
  return `mailto:${LISTINGS_INBOX}?${q}`;
}

/** "Is this your conference? Claim it free": an email to us, reviewed by a person every day. */
export function claimMailto(fullName: string, slug: string): string {
  return mailto(
    `Claim ${fullName} on Gavelling`,
    [
      'Hi Gavelling team,',
      '',
      `I help run ${fullName} and would like to manage its page: https://gavelling.com/conferences/${slug}`,
      '',
      'My role in the conference:',
      '',
      'How you can check it is me (for example, this email comes from the conference\'s own address, or I can message you from its official Instagram):',
      '',
      'The email address of my Gavelling account (sign up first if you have none):',
      '',
      'Thank you',
    ].join('\n'),
  );
}

/** "Not right? Ask us to correct or remove it". */
export function correctionMailto(fullName: string, slug: string): string {
  return mailto(
    `Listing: ${fullName}`,
    `Page: https://gavelling.com/conferences/${slug}\n\nWhat should we correct or remove?\n`,
  );
}

/** Where "Visit their website" goes: the website, else the Instagram profile. */
export function listingOutboundLink(c: { website_url?: string | null; instagram_url?: string | null }): { href: string; label: string } | null {
  const site = normalizeSocialUrl(c.website_url ?? null);
  if (site && /^https?:\/\//i.test(site)) return { href: site, label: 'Visit their website' };
  const ig = normalizeSocialUrl(c.instagram_url ?? null, 'instagram');
  if (ig && /^https?:\/\//i.test(ig)) return { href: ig, label: 'Visit their Instagram' };
  return null;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function formatCheckedDate(iso: string): string | null {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

const linkStyle: React.CSSProperties = { color: 'inherit', fontWeight: 700, textDecoration: 'underline', textUnderlineOffset: 3 };

/** The sidebar card that replaces Apply on a listing. */
export function ListingCta({ fullName, shortName, slug, website_url, instagram_url, past }: {
  fullName: string;
  shortName: string;
  slug: string;
  website_url: string | null;
  instagram_url: string | null;
  past: boolean;
}) {
  const out = listingOutboundLink({ website_url, instagram_url });
  return (
    <div
      className="relative rounded-[20px] p-6 overflow-hidden"
      style={{ backgroundColor: 'var(--gv-main)', boxShadow: '0 16px 40px color-mix(in srgb, var(--gv-main) 28%, transparent)' }}
    >
      <p className="font-bold" style={{ color: 'var(--gv-on-main)', fontFamily: FONT, margin: 0, fontSize: 19, lineHeight: 1.2 }}>
        {past ? 'This Edition Has Ended' : 'How to Apply'}
      </p>
      <p className="text-xs" style={{ color: 'color-mix(in srgb, var(--gv-on-main) 72%, transparent)', fontFamily: FONT, lineHeight: 1.55, margin: '6px 0 14px 0' }}>
        {past
          ? `See ${shortName}'s own website for the next edition.`
          : `${shortName} takes applications on its own website, not on Gavelling.`}
      </p>
      {out && (
        <a
          href={out.href}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full rounded-xl py-3 font-bold text-sm focus:outline-none"
          style={{
            backgroundColor: 'var(--gv-accent)', color: 'var(--gv-on-accent)', fontFamily: FONT,
            boxShadow: '0 4px 16px rgba(0,0,0,0.2)', textDecoration: 'none',
            transition: `background-color 200ms ${EASE}`,
          }}
        >
          <ExternalLink size={15} strokeWidth={2.2} aria-hidden />
          {out.label}
        </a>
      )}
      <a
        href={claimMailto(fullName, slug)}
        className="flex items-center justify-center gap-2 w-full rounded-xl py-2.5 mt-2.5 font-semibold text-[13px] text-center focus:outline-none"
        style={{
          color: 'var(--gv-on-main)', fontFamily: FONT, textDecoration: 'none',
          border: '1px solid color-mix(in srgb, var(--gv-on-main) 35%, transparent)',
          backgroundColor: 'color-mix(in srgb, var(--gv-accent-light) 6%, transparent)',
        }}
      >
        <Mail size={14} strokeWidth={2.2} aria-hidden className="shrink-0" />
        Is this your conference? Claim it free
      </a>
    </div>
  );
}

/** The overview's last line: where the facts came from, and how to fix them. */
export function ListingSourceNote({ meta, fullName, slug }: { meta: ListingMeta | null; fullName: string; slug: string }) {
  const checked = meta ? formatCheckedDate(meta.checked_at) : null;
  const sources = (meta?.sources ?? []).filter(s => /^https:\/\//i.test(s.url)).slice(0, 6);
  return (
    <div className="mt-8 text-[13px]" style={{ color: '#5A4E44', fontFamily: FONT, lineHeight: 1.6 }}>
      <p style={{ margin: 0 }}>
        Listed from the conference&apos;s public website{checked ? `, checked ${checked}` : ''}
        {sources.length > 0 && (
          <>
            {': '}
            {sources.map((s, i) => (
              <span key={s.url}>
                {i > 0 && ', '}
                <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="[overflow-wrap:anywhere] focus:outline-none" style={linkStyle}>
                  {hostOf(s.url)}
                </a>
              </span>
            ))}
          </>
        )}
      </p>
      {/* The free photo's licence needs a credit; it lives here, not on the banner (owner, 19 Oct 2026). */}
      {meta?.banner_credit && <BannerCreditLine credit={meta.banner_credit} style={{ fontSize: 13, marginTop: 4 }} />}
      <p style={{ margin: '4px 0 0 0' }}>
        Not right?{' '}
        <a href={correctionMailto(fullName, slug)} className="focus:outline-none" style={linkStyle}>
          Ask us to correct or remove it
        </a>
      </p>
    </div>
  );
}

/** "Photo: {author}, {license}", for a free city photo used as the banner. */
export function BannerCreditLine({ credit, style }: { credit: BannerCredit; style?: React.CSSProperties }) {
  const author = credit.author.trim();
  const license = credit.license.trim();
  if (!author && !license) return null;
  const sourceOk = /^https:\/\//i.test(credit.source_url ?? '');
  const licenseOk = !!credit.license_url && /^https:\/\//i.test(credit.license_url);
  return (
    <p style={{ fontFamily: FONT, fontSize: 10.5, lineHeight: 1.3, margin: 0, ...style }}>
      Banner photo:{' '}
      {sourceOk ? (
        <a href={credit.source_url} target="_blank" rel="noopener noreferrer nofollow" className="focus:outline-none" style={linkStyle}>{author || 'source'}</a>
      ) : author}
      {license && (
        <>
          {', '}
          {licenseOk ? (
            <a href={credit.license_url!} target="_blank" rel="noopener noreferrer nofollow license" className="focus:outline-none" style={linkStyle}>{license}</a>
          ) : license}
        </>
      )}
    </p>
  );
}
