import Link from 'next/link';
import { CalendarDays, Globe } from 'lucide-react';
import SiteNav from '@/components/SiteNav';
import SiteFooter from '@/components/SiteFooter';
import { getFlagUrl } from '@/lib/countries';
import { hubPath, type Hub } from '@/lib/countryHubs';

// The shared server-rendered pieces of the hub pages: /conferences/in (the
// country list) and /conferences/in/<hub> (a country, online, a year, a
// month). Every link is a plain <a href> in the raw HTML: these pages are the
// crawl path from /conferences/all to the hubs and back to the conferences.
// Flags here are RECTANGLES (getFlagUrl) only, never mixed with round flags.

export const SANS = 'var(--font-brand), sans-serif';
export const FOREST = '#1B3828';
export const INK = '#1C1410';
export const INK_SOFT = '#5C5140';

export const INLINE_LINK: React.CSSProperties = {
  color: FOREST,
  fontWeight: 700,
  textDecoration: 'underline',
  textUnderlineOffset: 3,
};

export const H2: React.CSSProperties = {
  fontFamily: SANS,
  fontWeight: 800,
  fontSize: 'clamp(20px, 1.6vw, 26px)',
  lineHeight: 1.2,
  color: INK,
  margin: '0 0 16px',
};

/** JSON-LD, with `<` escaped so a conference name can never close the tag. */
export function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }} />;
}

/** The page frame: ivory ground, nav, a main column that fills wide screens
 *  (lists go to 3 or 4 columns rather than leaving empty bands), footer. */
export function HubShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ backgroundColor: '#FAF8F3', minHeight: '100vh' }}>
      <SiteNav brand="conferences" />
      <main
        className="mx-auto w-full max-w-[1760px] px-4 sm:px-8 lg:px-12"
        style={{ paddingTop: 40, paddingBottom: 72, fontFamily: SANS }}
      >
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}

export function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" style={{ fontSize: 13, color: INK_SOFT }}>
      {items.map((it, i) => (
        <span key={it.label}>
          {i > 0 && <span aria-hidden="true"> / </span>}
          {it.href ? (
            <Link href={it.href} className="hover:underline focus:outline-none" style={{ color: FOREST, fontWeight: 600, textDecoration: 'none' }}>
              {it.label}
            </Link>
          ) : (
            <span>{it.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

export function breadcrumbSchema(items: { name: string; url: string }[]): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: it.url })),
  };
}

export function HubTitle({ children }: { children: React.ReactNode }) {
  return (
    <h1
      style={{
        fontWeight: 900,
        fontSize: 'clamp(30px, 4.4vw, 52px)',
        letterSpacing: '-0.02em',
        lineHeight: 1.05,
        color: INK,
        margin: '14px 0 12px',
        textWrap: 'balance',
      }}
    >
      {children}
    </h1>
  );
}

export function Lead({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 'clamp(15px, 1.1vw, 18px)', lineHeight: 1.6, color: '#4A4238', maxWidth: 760, margin: 0, textWrap: 'pretty' }}>
      {children}
    </p>
  );
}

/** A rectangle flag, the same artwork as the conference hero's. */
export function RectFlag({ code, name, size = 22 }: { code: string; name: string; size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={getFlagUrl(code)}
      alt={`Flag of ${name}`}
      width={size}
      height={Math.round(size * 0.7)}
      loading="lazy"
      decoding="async"
      style={{ width: size, height: Math.round(size * 0.7), borderRadius: 3, objectFit: 'cover', flexShrink: 0, boxShadow: '0 1px 2px rgba(27,56,40,0.25)' }}
    />
  );
}

/** The short label a hub link carries. */
export function hubLabel(h: Hub): string {
  if (h.kind === 'online') return 'Online';
  return h.name;
}

/** The count a hub link shows: upcoming when there are any, else held. */
export function hubCountLabel(h: Hub): { n: number; word: string } {
  if (h.count > 0) return { n: h.count, word: 'upcoming' };
  if (h.kind === 'country' || h.kind === 'online') return { n: h.recent || h.total, word: h.recent ? 'recently held' : 'held' };
  return { n: h.total, word: 'held' };
}

/** One hub as a white soft card link: flag or icon, the name, the count
 *  beside it as a number and a word. */
export function HubCard({ hub }: { hub: Hub }) {
  const { n, word } = hubCountLabel(hub);
  return (
    <Link
      href={hubPath(hub.slug)}
      className="flex items-center gap-3 rounded-2xl px-4 py-3 transition-transform duration-200 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F]"
      style={{ backgroundColor: '#FFFFFF', boxShadow: '0 1px 2px rgba(27,56,40,0.06), 0 8px 22px rgba(27,56,40,0.07)', textDecoration: 'none' }}
    >
      {hub.kind === 'country' && hub.code ? (
        <RectFlag code={hub.code} name={hub.name} />
      ) : hub.kind === 'online' ? (
        <Globe size={20} aria-hidden="true" style={{ color: FOREST, flexShrink: 0 }} />
      ) : (
        <CalendarDays size={20} aria-hidden="true" style={{ color: FOREST, flexShrink: 0 }} />
      )}
      <span className="min-w-0 flex-1 [overflow-wrap:anywhere]" style={{ fontWeight: 700, fontSize: 15, color: INK, lineHeight: 1.3 }}>
        {hubLabel(hub)}
      </span>
      <span className="shrink-0 text-right" style={{ lineHeight: 1.1 }}>
        <span style={{ fontWeight: 800, fontSize: 18, color: FOREST, fontVariantNumeric: 'tabular-nums' }}>{n}</span>
        <span style={{ fontSize: 12, color: INK_SOFT, marginLeft: 5 }}>{word}</span>
      </span>
    </Link>
  );
}

export function HubGrid({ hubs }: { hubs: Hub[] }) {
  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      {hubs.map(h => (
        <li key={h.slug}>
          <HubCard hub={h} />
        </li>
      ))}
    </ul>
  );
}

/** "Mumbai, Delhi and Bangalore", or "…, Pune and 6 more". */
export function sayList(items: string[], max = 4): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length <= max) return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
  return `${items.slice(0, max).join(', ')} and ${items.length - max} more`;
}

/** "is" / "are" with the number written out for one. */
export function countPhrase(n: number, one: string, many: string): string {
  return n === 1 ? `One ${one}` : `${n} ${many}`;
}
