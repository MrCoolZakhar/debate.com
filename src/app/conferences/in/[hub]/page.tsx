import type { Metadata } from 'next';
import { cache } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { pageMetadata, SITE_URL } from '@/lib/seo';
import { fetchListedConferences, type ListedConference } from '@/lib/listedConferences';
import { hubPath, HUB_INDEX_PATH, isRecentOn, isUpcomingOn, MONTH_NAMES, resolveHub, todayUtc, type Hub } from '@/lib/countryHubs';
import { getCountryByName } from '@/lib/countries';
import ConferenceLinkList, { conferenceTitle } from '../ConferenceLinkList';
import {
  Breadcrumbs, breadcrumbSchema, countPhrase, H2, HubGrid, HubShell, HubTitle, INLINE_LINK, INK_SOFT, JsonLd, Lead, RectFlag, sayList,
} from '../hubKit';

// /conferences/in/<hub>: one hub page, a country (/in/india), online
// conferences (/in/online), a year (/in/2026) or a month (/in/november-2026).
// Which hubs exist, and which are indexable, is decided ONCE in
// src/lib/countryHubs.ts; the sitemap, the country list and /conferences/all
// read the same function. A hub with no upcoming conference still answers
// (its past conferences, noindex, follow) so a conference page's place link
// never 404s; an unknown slug 404s. Every hub, however small, carries a
// server-written paragraph of facts (cities, months, online, open
// applications) and links to its neighbours, so a one-conference hub is
// never a thin page. Never linked from the footer (CLAUDE.md §3).

// ISR: rendered on first visit, then served from the cache and re-rendered
// at most hourly. `generateStaticParams` returning [] is what makes the
// dynamic segment cacheable at all (without it Next renders on every
// request). Nothing here is per visitor.
export const revalidate = 3600;
export function generateStaticParams() {
  return [];
}

const load = cache(async (slug: string) => {
  const all = await fetchListedConferences();
  // An empty list means the read failed (it degrades to []). Throw rather
  // than render a 404 that ISR would then cache for an hour: on a failed
  // re-render Next keeps serving the last good copy.
  if (all.length === 0) throw new Error('Listed conferences could not be read');
  const today = todayUtc();
  const resolved = resolveHub(slug, all, today);
  return resolved ? { ...resolved, all, today } : null;
});

const PLACEHOLDER_CITY = /^(online|virtual|-+|n\/?a|tbd|tba|not specific|demo city)$/i;

/** Cities as people would write them, deduplicated, busiest first. */
function citiesOf(confs: ListedConference[]): string[] {
  const counts = new Map<string, { label: string; n: number }>();
  for (const c of confs) {
    if (c.format === 'online') continue;
    const raw = (c.city ?? '').replace(/\s+/g, ' ').trim();
    if (!raw || PLACEHOLDER_CITY.test(raw) || getCountryByName(raw)) continue;
    const label = raw === raw.toUpperCase() || raw === raw.toLowerCase()
      ? raw.toLowerCase().replace(/(^|[\s-])\p{L}/gu, m => m.toUpperCase())
      : raw;
    const key = raw.toLowerCase();
    const hit = counts.get(key);
    if (hit) hit.n += 1;
    else counts.set(key, { label, n: 1 });
  }
  return [...counts.values()].sort((a, b) => b.n - a.n || a.label.localeCompare(b.label)).map(x => x.label);
}

/** Country names, busiest first. */
function countriesOf(confs: ListedConference[]): string[] {
  const counts = new Map<string, number>();
  for (const c of confs) {
    const name = c.country ? getCountryByName(c.country.trim())?.name : undefined;
    if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([n]) => n);
}

/** Month names the dated conferences start in, busiest first. */
function monthsOf(confs: ListedConference[]): string[] {
  const counts = new Map<number, number>();
  for (const c of confs) {
    if (c.dates_tbd || !/^\d{4}-\d{2}/.test(c.start_date ?? '')) continue;
    const m = Number(c.start_date.slice(5, 7));
    counts.set(m, (counts.get(m) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]).map(([m]) => MONTH_NAMES[m - 1]);
}

/** "2026" or "2026–2027" from the upcoming dated conferences. */
function yearSpan(confs: ListedConference[], today: string): string {
  const years = confs.map(c => Number((c.start_date ?? '').slice(0, 4))).filter(y => y >= 2000 && y <= 2100);
  const lo = years.length ? Math.min(...years) : Number(today.slice(0, 4));
  const hi = years.length ? Math.max(...years) : lo;
  return lo === hi ? String(lo) : `${lo}–${hi}`;
}

/** The <title> (the root template adds "| Gavelling"): a country or the
 *  online hub carries the years it has upcoming conferences in. */
function pageTitle(hub: Hub, upcoming: ListedConference[], today: string): string {
  if ((hub.kind === 'country' || hub.kind === 'online') && hub.count > 0) return `${hub.heading} ${yearSpan(upcoming, today)}`;
  return hub.heading;
}

/** The server-written paragraph of facts. Plain sentences, no em dashes. */
function intro(hub: Hub, upcoming: ListedConference[], past: ListedConference[]): string[] {
  const out: string[] = [];
  const open = upcoming.filter(c => c.window === 'open').length;
  const free = upcoming.filter(c => c.delegate_price.kind === 'free').length;
  const online = upcoming.filter(c => c.format === 'online').length;
  const hybrid = upcoming.filter(c => c.format === 'hybrid').length;
  const months = monthsOf(upcoming);
  const openLine = open > 0 ? `${open === 1 ? 'One is' : `${open} are`} taking delegate applications now.` : '';
  const freeLine = free > 0 ? `${free === 1 ? 'One is' : `${free} are`} free for delegates.` : '';

  if (hub.kind === 'country') {
    if (upcoming.length === 0) {
      const cities = citiesOf(past);
      out.push(`No upcoming Model UN conferences in ${hub.name} are listed on Gavelling right now.`);
      if (past.length) out.push(`${countPhrase(past.length, 'conference was', 'conferences were')} held here${cities.length ? `, in ${sayList(cities)}` : ''}, and their pages stay up with the committees they ran.`);
      return out;
    }
    const cities = citiesOf(upcoming);
    out.push(`${countPhrase(upcoming.length, 'upcoming Model UN conference', 'upcoming Model UN conferences')} in ${hub.name}${cities.length ? `, in ${sayList(cities)}` : ''}.`);
    if (months.length) out.push(`${upcoming.length === 1 ? 'It starts' : months.length === 1 ? 'They start' : 'Most start'} in ${sayList(months.slice(0, 3), 3)}.`);
    if (online || hybrid) {
      if (upcoming.length === 1) {
        out.push(online ? 'It runs online.' : 'It is hybrid, in person and online.');
      } else {
        const parts = [
          online ? `${online === 1 ? 'One runs' : `${online} run`} online` : '',
          hybrid ? `${hybrid === 1 ? (online ? 'one is' : 'One is') : `${hybrid} are`} hybrid` : '',
        ].filter(Boolean);
        out.push(`${sayList(parts)}.`);
      }
    }
  } else if (hub.kind === 'online') {
    const countries = countriesOf(upcoming.length ? upcoming : past);
    if (upcoming.length === 0) {
      out.push('No upcoming online Model UN conferences are listed on Gavelling right now.');
      if (past.length) out.push(`${countPhrase(past.length, 'online conference was', 'online conferences were')} held${countries.length ? `, run from ${sayList(countries)}` : ''}.`);
      return out;
    }
    out.push(`${countPhrase(upcoming.length, 'upcoming online Model UN conference', 'upcoming online Model UN conferences')} you can join from anywhere${countries.length ? `, run from ${sayList(countries)}` : ''}.`);
    if (months.length) out.push(`${upcoming.length === 1 ? 'It starts' : 'Most start'} in ${sayList(months.slice(0, 3), 3)}.`);
  } else {
    // year or month: every conference that starts in it, past ones included.
    const all = [...upcoming, ...past];
    const countries = countriesOf(all);
    out.push(`${countPhrase(all.length, 'Model UN conference starts', 'Model UN conferences start')} in ${hub.name} on Gavelling${countries.length ? `, in ${countries.length === 1 ? countries[0] : `${countries.length} countries including ${sayList(countries.slice(0, 4), 4)}`}` : ''}.`);
    if (upcoming.length === 0) out.push('All of them have been held; their pages stay up with the committees they ran.');
    else if (past.length) out.push(`${upcoming.length === 1 ? 'One is' : `${upcoming.length} are`} still to come and ${past.length} already held.`);
    if (hub.kind === 'year' && months.length && upcoming.length) out.push(`The busiest months are ${sayList(monthsOf(all).slice(0, 3), 3)}.`);
    if (online) out.push(`${online === 1 ? 'One of the upcoming ones is' : `${online} of the upcoming ones are`} online.`);
  }
  if (openLine) out.push(openLine);
  if (freeLine) out.push(freeLine);
  out.push('Each conference page has the committees, dates and delegate fees, and you apply as a delegate, chair or faculty advisor with one Gavelling profile.');
  return out;
}

/** The hubs this one links to: neighbours first, then the date and online hubs. */
function relatedHubs(hub: Hub, hubs: Hub[]): Hub[] {
  const indexable = hubs.filter(h => h.indexable && h.slug !== hub.slug);
  const countries = indexable.filter(h => h.kind === 'country');
  const near = hub.kind === 'country' && hub.continent
    ? countries.filter(h => h.continent === hub.continent)
    : [];
  const pickCountries = (near.length >= 4 ? near : [...near, ...countries.filter(h => !near.includes(h))]).slice(0, 8);
  const online = indexable.filter(h => h.kind === 'online');
  const years = indexable.filter(h => h.kind === 'year');
  const months = indexable.filter(h => h.kind === 'month' && (hub.kind !== 'month' || h.year === hub.year || h.year === (hub.year ?? 0) + 1));
  if (hub.kind === 'country') return [...pickCountries, ...online, ...years];
  if (hub.kind === 'online') return [...pickCountries, ...years, ...months.slice(0, 4)];
  return [...months.slice(0, 8), ...years, ...online, ...pickCountries.slice(0, 4)];
}

export async function generateMetadata({ params }: { params: Promise<{ hub: string }> }): Promise<Metadata> {
  const { hub: slug } = await params;
  const data = await load(slug);
  if (!data) {
    return pageMetadata({
      title: 'Model UN Conferences',
      description: 'Model UN conferences on Gavelling.',
      path: hubPath(slug),
      robots: { index: false, follow: true },
    });
  }
  const { hub, upcoming, past, today } = data;
  const lines = intro(hub, upcoming, past);
  return pageMetadata({
    title: pageTitle(hub, upcoming, today),
    description: `${(lines[0] + (lines[1] && lines[0].length + lines[1].length < 200 ? ` ${lines[1]}` : ''))} See dates, cities and delegate fees, then apply on Gavelling.`,
    path: hubPath(hub.slug),
    // A hub with nothing upcoming answers, but stays out of search.
    ...(hub.indexable ? {} : { robots: { index: false, follow: true } }),
  });
}

export default async function HubPage({ params }: { params: Promise<{ hub: string }> }) {
  const { hub: slug } = await params;
  const data = await load(slug);
  if (!data) notFound();
  const { hub, hubs, upcoming, past, all, today } = data;
  const url = `${SITE_URL}${hubPath(hub.slug)}`;
  const lines = intro(hub, upcoming, past);

  // Past conferences shown: a country or online hub shows the last year's
  // (or, when nothing is upcoming, its most recent ones); a year or month
  // hub shows every conference that started in it.
  const shownPast = hub.kind === 'year' || hub.kind === 'month'
    ? past
    : (upcoming.length ? past.filter(c => isRecentOn(c, today)) : past).slice(0, 24);
  const pastHeading = hub.kind === 'year' || hub.kind === 'month'
    ? `Already Held in ${hub.name}`
    : upcoming.length ? 'Recently Held' : 'Held Before';
  // The online hub also lists the hybrid conferences (they have online seats).
  const hybrid = hub.kind === 'online'
    ? all.filter(c => c.format === 'hybrid' && isUpcomingOn(c, today))
    : [];
  const yearMonths = hub.kind === 'year' ? hubs.filter(h => h.kind === 'month' && h.year === hub.year) : [];
  const related = relatedHubs(hub, hubs);

  const listed = [...upcoming, ...shownPast];
  const collection = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: hub.heading,
    url,
    description: lines.slice(0, 2).join(' '),
    isPartOf: { '@type': 'WebSite', name: 'Gavelling', url: SITE_URL },
    mainEntity: {
      '@type': 'ItemList',
      name: hub.heading,
      numberOfItems: listed.length,
      itemListElement: listed.map((c, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `${SITE_URL}/conferences/${c.slug}`,
        name: conferenceTitle(c),
      })),
    },
  };
  const crumbs = breadcrumbSchema([
    { name: 'Home', url: SITE_URL },
    { name: 'Conferences', url: `${SITE_URL}/conferences/explore` },
    { name: 'By country', url: `${SITE_URL}${HUB_INDEX_PATH}` },
    { name: hub.name, url },
  ]);

  return (
    <HubShell>
      <JsonLd data={collection} />
      <JsonLd data={crumbs} />
      <Breadcrumbs items={[{ label: 'Conferences', href: '/conferences/explore' }, { label: 'By country', href: HUB_INDEX_PATH }, { label: hub.name }]} />
      <div className="flex items-center gap-3">
        {hub.kind === 'country' && hub.code && <RectFlag code={hub.code} name={hub.name} size={40} />}
        <HubTitle>{hub.heading}</HubTitle>
      </div>
      <Lead>{lines.join(' ')}</Lead>

      {yearMonths.length > 0 && (
        <section aria-labelledby="hub-months" style={{ marginTop: 32 }}>
          <h2 id="hub-months" style={H2}>By Month</h2>
          <HubGrid hubs={yearMonths} />
        </section>
      )}

      {upcoming.length > 0 && (
        <section aria-labelledby="hub-upcoming" style={{ marginTop: 36 }}>
          <h2 id="hub-upcoming" style={H2}>Upcoming Conferences</h2>
          <ConferenceLinkList conferences={upcoming} wide />
        </section>
      )}

      {hybrid.length > 0 && (
        <section aria-labelledby="hub-hybrid" style={{ marginTop: 40 }}>
          <h2 id="hub-hybrid" style={H2}>Hybrid Conferences</h2>
          <p style={{ fontSize: 14, color: INK_SOFT, margin: '-6px 0 16px' }}>In person, with seats for delegates who join online.</p>
          <ConferenceLinkList conferences={hybrid} wide />
        </section>
      )}

      {shownPast.length > 0 && (
        <section aria-labelledby="hub-past" style={{ marginTop: 40 }}>
          <h2 id="hub-past" style={H2}>{pastHeading}</h2>
          <ConferenceLinkList conferences={shownPast} wide />
        </section>
      )}

      {related.length > 0 && (
        <section aria-labelledby="hub-related" style={{ marginTop: 48 }}>
          <h2 id="hub-related" style={H2}>{hub.kind === 'country' ? 'Nearby and Online' : 'More Places and Dates'}</h2>
          <HubGrid hubs={related} />
        </section>
      )}

      <p style={{ marginTop: 32, fontSize: 14, color: INK_SOFT }}>
        See{' '}
        <Link href={HUB_INDEX_PATH} className="focus:outline-none" style={INLINE_LINK}>every country</Link>,{' '}
        <Link href="/conferences/all" className="focus:outline-none" style={INLINE_LINK}>all Model UN conferences A to Z</Link>{' '}
        or{' '}
        <Link href="/conferences/explore" className="focus:outline-none" style={INLINE_LINK}>explore by date, fee and level</Link>.
      </p>
    </HubShell>
  );
}
