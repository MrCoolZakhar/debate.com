import Link from 'next/link';
import { formatConferenceDates, hasNoDates, DATES_TO_BE_DECIDED } from '@/lib/conferenceDates';
import { delegatePriceLabel } from '@/lib/publicFees';
import type { ListedConference } from '@/lib/listedConferences';

// A server-rendered list of conferences as plain <a href> rows: logo, name,
// dates, city (or Online) and the public delegate price (publicFees.ts). Used
// by the hubs (/conferences/in/*) and /organisers, where the links must be in the raw HTML.

const SANS = "var(--font-brand), sans-serif";
const FOREST = '#1B3828';
const INK = '#1C1410';
const INK_SOFT = '#5C5140';

const WINDOW_LABEL: Record<ListedConference['window'], string | null> = {
  open: 'Applications open',
  not_open: 'Applications open soon',
  closed: 'Applications closed',
  disabled: null,
};

export function conferenceTitle(c: Pick<ListedConference, 'acronym' | 'full_name' | 'start_date'>): string {
  const base = (c.acronym || c.full_name || '').trim();
  const year = c.start_date ? c.start_date.slice(0, 4) : '';
  return year && /^\d{4}$/.test(year) && !base.includes(year) ? `${base} ${year}` : base;
}

export default function ConferenceLinkList({ conferences, wide = false }: { conferences: ListedConference[]; wide?: boolean }) {
  // `wide`: the hub pages run the full content width, so 3 and 4 columns there.
  return (
    <ul className={wide ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3' : 'grid grid-cols-1 md:grid-cols-2 gap-3'} style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      {conferences.map(c => {
        const dates = hasNoDates(c) ? DATES_TO_BE_DECIDED : formatConferenceDates(c.start_date, c.end_date, { style: 'dmy-end-year' });
        const place = c.format === 'online' ? ['Online', c.country].filter(Boolean).join(', ') : [c.city, c.country].filter(Boolean).join(', ');
        const windowLabel = WINDOW_LABEL[c.window];
        return (
          <li key={c.id}>
            <Link
              href={`/conferences/${c.slug}`}
              className="flex items-center gap-4 rounded-2xl px-4 py-3.5 transition-transform duration-200 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F]"
              style={{ backgroundColor: '#FFFDF8', boxShadow: '0 1px 2px rgba(27,56,40,0.06), 0 8px 22px rgba(27,56,40,0.07)', textDecoration: 'none' }}
            >
              <span
                className="flex shrink-0 items-center justify-center overflow-hidden rounded-full"
                style={{ width: 48, height: 48, backgroundColor: FOREST, color: '#EED98A', fontFamily: SANS, fontWeight: 800, fontSize: 13 }}
              >
                {c.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.logo_url} alt="" width={48} height={48} loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', backgroundColor: '#FFFFFF' }} />
                ) : (
                  (c.acronym || c.full_name).slice(0, 3).toUpperCase()
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block [overflow-wrap:anywhere]" style={{ fontFamily: SANS, fontWeight: 800, fontSize: 16, color: INK, lineHeight: 1.25 }}>
                  {conferenceTitle(c)}
                </span>
                {c.acronym && c.full_name && c.full_name !== c.acronym && (
                  <span className="block [overflow-wrap:anywhere]" style={{ fontFamily: SANS, fontSize: 12.5, color: INK_SOFT, lineHeight: 1.35 }}>
                    {c.full_name}
                  </span>
                )}
                <span className="block" style={{ fontFamily: SANS, fontSize: 13, color: INK_SOFT, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>
                  {[dates, place].filter(Boolean).join(' · ')}
                </span>
              </span>
              <span className="hidden sm:flex shrink-0 flex-col items-end gap-1 text-right">
                <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: 14, color: FOREST, fontVariantNumeric: 'tabular-nums' }}>
                  {delegatePriceLabel(c.delegate_price)}
                </span>
                {windowLabel && (
                  <span style={{ fontFamily: SANS, fontSize: 11.5, color: INK_SOFT }}>{windowLabel}</span>
                )}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
