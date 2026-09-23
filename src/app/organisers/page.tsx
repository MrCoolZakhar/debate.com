import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowRight, ClipboardCheck, LayoutGrid, Landmark, MonitorPlay, Mail, Check, Minus,
} from 'lucide-react';
import { pageMetadata, SITE_URL, JSONLD_PUBLISHER } from '@/lib/seo';
import SiteNav from '@/components/SiteNav';
import { LabFooter } from '@/app/conferences/landing-lab/shared';
import { fetchListedConferences, fetchPlatformStats, isUpcoming } from '@/lib/listedConferences';
import { conferenceTitle } from '@/app/conferences/in/ConferenceLinkList';

// /organisers — the landing page for secretariats. Server-rendered, self
// canonical, in the sitemap, linked from every footer ("List your
// conference") and from the homepage's organiser CTA.
//
// Every claim on this page is true of the product as built (CLAUDE.md §3):
// organisers are never charged; participants pay exactly the conference's own
// fee (there is no platform fee on it any more, 24 Sep 2026); the
// allocation, ledger, live wall and email tools are the ones under
// /manage/[slug]. The comparison describes per-participant pricing in general
// and names no competitor.

export const revalidate = 3600;

export const metadata: Metadata = pageMetadata({
  title: { absolute: 'Run your Model UN conference free · For organisers | Gavelling' },
  description:
    'List and run your Model UN conference on Gavelling and pay nothing: applications, fit-scored allocations, a payments ledger, a live wall of every committee, and emails. Free for organisers.',
  path: '/organisers',
  ogTitle: 'Run your Model UN conference on Gavelling. Organisers pay nothing.',
});

const SANS = "'Outfit', sans-serif";
const FOREST = '#1B3828';
const GOLD = '#B6871F';
const PALE_GOLD = '#EED98A';
const CREAM = '#FAF8F3';
const IVORY = '#EDE7D8';
const INK = '#1C1410';
const INK_70 = '#4A4238';

const FEATURES = [
  {
    icon: ClipboardCheck,
    title: 'Applications',
    body: 'Delegates, delegations, chairs and faculty advisors apply with one Gavelling profile. You review from a To-Do queue built for the thousandth application, not the first.',
  },
  {
    icon: LayoutGrid,
    title: 'Allocation engine',
    body: 'Countries and committees assigned by fit, from each applicant’s preferences and record. Adjust by hand, then send every allocation in one go.',
  },
  {
    icon: Landmark,
    title: 'Payments ledger',
    body: 'Participants pay your fee online or you record payments made offline, with invoices per participant. Money received, money paid offline and money still owed are shown apart, so the numbers add up.',
  },
  {
    icon: MonitorPlay,
    title: 'Live committee wall',
    body: 'Every committee room runs on Gavelling’s free session software, and the secretariat watches all of them live from one page, with a cross-committee scoreboard.',
  },
  {
    icon: Mail,
    title: 'Emails',
    body: 'Acceptances, allocations, payment reminders and announcements from ready-made templates, sent to the right people in one click.',
  },
];

const COMPARISON: { label: string; typical: string; ours: string }[] = [
  { label: 'Cost to the organiser', typical: 'A fee per participant, often per day', ours: 'Nothing. No set-up fee, no subscription' },
  { label: 'What participants pay', typical: 'Often your fee plus a platform charge', ours: 'Exactly your conference fee' },
  { label: 'Committee session software', typical: 'Often a separate tool', ours: 'Included, free for every room' },
];

export default async function OrganisersPage() {
  const [all, stats] = await Promise.all([fetchListedConferences(), fetchPlatformStats()]);
  // Named conferences: real public ones, verified first, then those with a
  // logo, upcoming before past.
  const named = [...all]
    .filter(c => c.logo_url)
    .sort((a, b) =>
      Number(!a.is_verified) - Number(!b.is_verified)
      || Number(!isUpcoming(a)) - Number(!isUpcoming(b))
      || (a.start_date ?? '').localeCompare(b.start_date ?? ''))
    .slice(0, 12);
  const countries = stats?.countries ?? new Set(all.map(c => c.country)).size;
  const total = stats?.total_conferences ?? all.length;

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Gavelling for Model UN organisers',
    url: `${SITE_URL}/organisers`,
    description: 'Run a Model UN conference on Gavelling for free: applications, allocations, payments, live committees and emails.',
    publisher: JSONLD_PUBLISHER,
  };

  return (
    <div style={{ backgroundColor: CREAM, fontFamily: SANS, color: INK }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden" style={{ backgroundColor: FOREST }}>
        <div className="absolute inset-0" aria-hidden="true">
          <Image src="/landing/organiser-desk.jpg" alt="" fill priority sizes="100vw" style={{ objectFit: 'cover', opacity: 0.28 }} />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(100deg, rgba(18,39,24,0.96) 0%, rgba(27,56,40,0.85) 55%, rgba(27,56,40,0.55) 100%)' }} />
        </div>
        <div className="relative">
          <SiteNav overlay brand="conferences" />
          <div className="mx-auto max-w-6xl px-4 sm:px-6" style={{ paddingTop: 'clamp(104px, 12vw, 150px)', paddingBottom: 'clamp(64px, 8vw, 110px)' }}>
            <p style={{ fontWeight: 700, fontSize: 12.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: PALE_GOLD, margin: '0 0 16px' }}>
              For organisers
            </p>
            <h1 style={{ fontWeight: 900, fontSize: 'clamp(38px, 6vw, 84px)', lineHeight: 1, letterSpacing: '-0.025em', color: CREAM, margin: 0, maxWidth: 900, textWrap: 'balance' }}>
              Run your whole conference here. You pay{' '}
              <span style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontWeight: 400, color: PALE_GOLD }}>nothing</span>.
            </h1>
            <p style={{ fontSize: 'clamp(16px, 1.35vw, 20px)', lineHeight: 1.6, color: 'rgba(237,231,216,0.85)', margin: '22px 0 0', maxWidth: 640, textWrap: 'pretty' }}>
              Applications, allocations, payments, live committees and emails in one place. No set-up fee, no subscription and no fee per delegate for the secretariat.
            </p>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-4" style={{ marginTop: 34 }}>
              <Link
                href="/conferences/new"
                className="inline-flex items-center gap-2.5 rounded-full focus:outline-none transition-transform duration-150 active:scale-[0.97]"
                style={{ backgroundColor: PALE_GOLD, color: FOREST, fontWeight: 800, fontSize: 15, padding: '15px 28px', textDecoration: 'none', boxShadow: '0 14px 30px rgba(0,0,0,0.25)' }}
              >
                List your conference free <ArrowRight size={17} strokeWidth={2.5} aria-hidden="true" />
              </Link>
              <Link href="/conferences/explore" style={{ color: 'rgba(237,231,216,0.85)', fontWeight: 600, fontSize: 14.5 }}>
                See conferences already here
              </Link>
            </div>
            <dl className="grid grid-cols-3 gap-4" style={{ marginTop: 'clamp(40px, 5vw, 64px)', maxWidth: 560 }}>
              {[
                { n: total.toLocaleString('en'), l: 'Conferences' },
                { n: countries.toLocaleString('en'), l: 'Countries' },
                { n: '0', l: 'Paid by organisers' },
              ].map(s => (
                <div key={s.l} className="flex flex-col-reverse justify-end">
                  <dt style={{ marginTop: 8, fontWeight: 700, fontSize: 11.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(237,231,216,0.75)' }}>{s.l}</dt>
                  <dd style={{ margin: 0, fontWeight: 900, fontSize: 'clamp(28px, 3vw, 42px)', lineHeight: 1, color: PALE_GOLD, fontVariantNumeric: 'tabular-nums' }}>{s.n}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6" style={{ paddingTop: 'clamp(64px, 7vw, 104px)', paddingBottom: 'clamp(48px, 5vw, 72px)' }}>
        <p style={{ fontWeight: 700, fontSize: 12.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: GOLD, margin: '0 0 10px' }}>How it works</p>
        <h2 style={{ fontWeight: 900, fontSize: 'clamp(28px, 3.4vw, 48px)', letterSpacing: '-0.02em', lineHeight: 1.05, margin: 0, maxWidth: 720, textWrap: 'balance' }}>
          From the first application to the closing ceremony.
        </h2>
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" style={{ listStyle: 'none', padding: 0, margin: '36px 0 0' }}>
          {FEATURES.map(f => (
            <li key={f.title} className="rounded-3xl" style={{ backgroundColor: '#FFFDF8', padding: '26px 24px', boxShadow: '0 1px 2px rgba(27,56,40,0.06), 0 12px 30px rgba(27,56,40,0.07)' }}>
              <span className="inline-flex items-center justify-center rounded-2xl" style={{ width: 46, height: 46, backgroundColor: 'rgba(27,56,40,0.08)', color: FOREST }}>
                <f.icon size={23} strokeWidth={2} aria-hidden="true" />
              </span>
              <h3 style={{ fontWeight: 800, fontSize: 19, margin: '16px 0 8px' }}>{f.title}</h3>
              <p style={{ fontSize: 15, lineHeight: 1.6, color: INK_70, margin: 0, textWrap: 'pretty' }}>{f.body}</p>
            </li>
          ))}
          <li className="rounded-3xl flex flex-col justify-between" style={{ backgroundColor: FOREST, padding: '26px 24px', color: CREAM }}>
            <p style={{ fontWeight: 800, fontSize: 19, margin: 0, lineHeight: 1.3 }}>
              Your conference page goes live the moment you publish it.
            </p>
            <Link href="/conferences/new" className="inline-flex items-center gap-2 focus:outline-none" style={{ marginTop: 20, color: PALE_GOLD, fontWeight: 800, fontSize: 15, textDecoration: 'none' }}>
              List your conference free <ArrowRight size={16} strokeWidth={2.5} aria-hidden="true" />
            </Link>
          </li>
        </ul>
      </section>

      {/* ── Conferences already on Gavelling ────────────────────────────── */}
      {named.length > 0 && (
        <section style={{ backgroundColor: IVORY }}>
          <div className="mx-auto max-w-6xl px-4 sm:px-6" style={{ paddingTop: 'clamp(56px, 6vw, 88px)', paddingBottom: 'clamp(56px, 6vw, 88px)' }}>
            <h2 style={{ fontWeight: 900, fontSize: 'clamp(26px, 3vw, 42px)', letterSpacing: '-0.02em', margin: 0, textWrap: 'balance' }}>
              Conferences already on Gavelling
            </h2>
            <p style={{ fontSize: 16, lineHeight: 1.6, color: INK_70, margin: '10px 0 0', maxWidth: 620 }}>
              {total.toLocaleString('en')} conferences in {countries.toLocaleString('en')} countries, from school conferences to university circuits.
            </p>
            <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3" style={{ listStyle: 'none', padding: 0, margin: '30px 0 0' }}>
              {named.map(c => (
                <li key={c.id}>
                  <Link
                    href={`/conferences/${c.slug}`}
                    className="flex h-full items-center gap-3 rounded-2xl focus:outline-none transition-transform duration-200 hover:-translate-y-0.5"
                    style={{ backgroundColor: '#FFFDF8', padding: '12px 14px', textDecoration: 'none', boxShadow: '0 1px 2px rgba(27,56,40,0.06), 0 8px 20px rgba(27,56,40,0.06)' }}
                  >
                    <span className="shrink-0 overflow-hidden rounded-full" style={{ width: 44, height: 44, backgroundColor: '#FFFFFF', boxShadow: '0 0 0 1px rgba(27,56,40,0.08)' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={c.logo_url!} alt="" width={44} height={44} loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate" style={{ fontWeight: 800, fontSize: 14.5, color: INK }}>{conferenceTitle(c)}</span>
                      <span className="block truncate" style={{ fontSize: 12.5, color: INK_70 }}>{[c.city, c.country].filter(Boolean).join(', ')}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ── Pricing, compared ───────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-4 sm:px-6" style={{ paddingTop: 'clamp(64px, 7vw, 104px)', paddingBottom: 'clamp(40px, 5vw, 64px)' }}>
        <p style={{ fontWeight: 700, fontSize: 12.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: GOLD, margin: '0 0 10px' }}>Pricing</p>
        <h2 style={{ fontWeight: 900, fontSize: 'clamp(26px, 3vw, 42px)', letterSpacing: '-0.02em', margin: 0, textWrap: 'balance' }}>
          Per-participant pricing, compared.
        </h2>
        <p style={{ fontSize: 16, lineHeight: 1.65, color: INK_70, margin: '12px 0 0', maxWidth: 680, textWrap: 'pretty' }}>
          Many conference platforms bill the organiser for every participant, and some for every day. At one unit of currency per participant per day, a three-day conference of 300 delegates costs the secretariat 900 before a single committee sits. On Gavelling that line is zero.
        </p>
        <div className="overflow-x-auto" style={{ marginTop: 28 }}>
          <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0, minWidth: 520, fontSize: 15 }}>
            <thead>
              <tr>
                <th scope="col" style={{ textAlign: 'left', padding: '12px 14px', fontWeight: 700, fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: INK_70 }}><span className="sr-only">Question</span></th>
                <th scope="col" style={{ textAlign: 'left', padding: '12px 14px', fontWeight: 700, fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: INK_70 }}>Per-participant pricing</th>
                <th scope="col" style={{ textAlign: 'left', padding: '12px 14px', fontWeight: 800, fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: FOREST, backgroundColor: 'rgba(238,217,138,0.35)', borderTopLeftRadius: 14, borderTopRightRadius: 14 }}>Gavelling</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map((r, i) => (
                <tr key={r.label}>
                  <th scope="row" style={{ textAlign: 'left', padding: '14px', fontWeight: 700, borderTop: '1px solid #DDD4C0', verticalAlign: 'top' }}>{r.label}</th>
                  <td style={{ padding: '14px', color: INK_70, borderTop: '1px solid #DDD4C0', verticalAlign: 'top' }}>
                    <span className="inline-flex items-start gap-2"><Minus size={16} strokeWidth={2.5} aria-hidden="true" style={{ marginTop: 3, flexShrink: 0, color: '#9A8A78' }} />{r.typical}</span>
                  </td>
                  <td style={{ padding: '14px', fontWeight: 700, color: FOREST, borderTop: '1px solid #DDD4C0', backgroundColor: 'rgba(238,217,138,0.35)', verticalAlign: 'top', ...(i === COMPARISON.length - 1 ? { borderBottomLeftRadius: 14, borderBottomRightRadius: 14 } : {}) }}>
                    <span className="inline-flex items-start gap-2"><Check size={16} strokeWidth={3} aria-hidden="true" style={{ marginTop: 3, flexShrink: 0 }} />{r.ours}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 13.5, lineHeight: 1.6, color: INK_70, margin: '16px 0 0', maxWidth: 680 }}>
          How Gavelling is paid for: applicants use one credit per application. Participants pay exactly your conference fee, and the organiser is never charged.
        </p>
      </section>

      {/* ── Closing CTA ─────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-4 sm:px-6" style={{ paddingBottom: 'clamp(72px, 8vw, 112px)' }}>
        <div className="rounded-[28px] flex flex-col md:flex-row md:items-center md:justify-between gap-6" style={{ backgroundColor: FOREST, padding: 'clamp(28px, 4vw, 48px)' }}>
          <div>
            <h2 style={{ fontWeight: 900, fontSize: 'clamp(24px, 2.6vw, 36px)', letterSpacing: '-0.015em', color: CREAM, margin: 0, textWrap: 'balance' }}>
              Your conference, listed today.
            </h2>
            <p style={{ fontSize: 16, color: 'rgba(237,231,216,0.8)', margin: '8px 0 0' }}>
              Free for organisers, now and later.
            </p>
          </div>
          <Link
            href="/conferences/new"
            className="inline-flex shrink-0 items-center gap-2.5 self-start md:self-auto rounded-full focus:outline-none transition-transform duration-150 active:scale-[0.97]"
            style={{ backgroundColor: PALE_GOLD, color: FOREST, fontWeight: 800, fontSize: 15, padding: '15px 28px', textDecoration: 'none' }}
          >
            List your conference free <ArrowRight size={17} strokeWidth={2.5} aria-hidden="true" />
          </Link>
        </div>
      </section>

      <LabFooter />
    </div>
  );
}
