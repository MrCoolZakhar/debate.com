// conferenceAbout.ts — the words of the server-rendered "About {short name}"
// section and the FAQ on a public conference page (/conferences/[slug]).
//
// WHY (owner, 19 Oct 2026): many organisers write no description or a single
// sentence, so the page is thin and Google leaves it out ("Crawled, currently
// not indexed", e.g. /conferences/asmun2027). When the organiser's description
// is under THIN_DESCRIPTION_WORDS words, the page adds a factual section built
// ONLY from the data the page already holds: place, dates, audience,
// committees and topics, the open roles with their fees and deadlines, how to
// apply on Gavelling. Every page (thin or not) gets the FAQ, whose questions
// and answers are also the page's FAQPage JSON-LD, word for word.
//
// Rules: never invent a fact (a sentence whose data is missing is left out);
// no em or en dashes (CLAUDE.md §8); names are never cut. Two conferences must
// not read as the same boilerplate, so the sentence shapes vary by a stable
// hash of the conference id as well as by which facts exist.
//
// Pure functions of their inputs: safe on the server, no React, no reads.

import { DATES_TO_BE_DECIDED, hasConcluded, hasNoDates } from '@/lib/conferenceDates';
import {
  conferenceDateText,
  conferenceShortName,
  delegateWindowSentence,
  nameForSentence,
  placeCase,
  windowDayText,
  type ConferenceSeoInput,
  type DelegateWindow,
} from '@/lib/conferenceSeo';
import { delegatePriceLabel, type DelegatePrice } from '@/lib/publicFees';
import { committeeDisplayName } from '@/lib/presetNames';

/** Under this many words (HTML and markdown stripped) the organiser's
 *  description counts as thin, and the About section is added. */
export const THIN_DESCRIPTION_WORDS = 80;

export interface FaqEntry {
  question: string;
  answer: string;
}

export interface AboutConference extends ConferenceSeoInput {
  id: string;
  slug: string;
  description: string | null;
  student_level?: string | null;
  expected_delegates?: number | null;
  min_age?: number | null;
  max_age?: number | null;
  /** Set on a Gavelling listing (src/lib/listings.ts): a conference we list from its own website.
   *  It takes no applications on Gavelling, so the section says how to apply on its own site
   *  (`outboundUrl`, its website or else its Instagram; null when neither is usable). */
  listing?: { outboundUrl: string | null } | null;
}

export interface AboutCommittee {
  name: string;
  abbreviation: string | null;
  topics: unknown;
  committee_type?: string | null;
}

/** One public role (a conference_public_fees row) as the page sees it. */
export interface AboutRole {
  role: string;
  price: DelegatePrice;
  window: DelegateWindow;
}

export interface AboutCommitteeItem {
  key: string;
  /** committeeDisplayName: the acronym for a long name, else the name. */
  title: string;
  /** The full name, only when the title is the acronym. */
  fullName: string | null;
  type: string | null;
  topics: string[];
}

export interface AboutRoleItem {
  label: string;
  price: string;
  window: string;
}

export interface ConferenceAboutContent {
  thin: boolean;
  shortName: string;
  heading: string;
  intro: string[];
  committees: AboutCommitteeItem[];
  /** Open (set-up) roles; empty with `rolesNote` when none is. */
  roles: AboutRoleItem[];
  rolesNote: string | null;
  /** The apply steps and the line about Gavelling; empty once it has ended. */
  steps: string[];
  /** "How to Apply on Gavelling", or "How to Apply" on a listing. */
  stepsHeading: string;
  gavellingLine: string;
  /** '' when there is nowhere to send the reader (a listing with no website). */
  applyHref: string;
  applyLabel: string;
  /** True when applyHref is the conference's own site (a listing), opened in a new tab. */
  applyExternal: boolean;
  concluded: boolean;
  faq: FaqEntry[];
}

const tidy = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();

/** "Model United Nations", "Model UN", "...MUN" already say what it is. */
const SAYS_MUN = /mun\b|model\s+u(nited\s+)?n(ations?)?\b/i;

/** Words in the organiser's description, with HTML, markdown and links removed. */
export function descriptionWordCount(raw: string | null | undefined): number {
  const text = (raw ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/&[a-z0-9#]+;/gi, ' ')
    .replace(/[#*_`>~|]+/g, ' ');
  return text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

export function isThinDescription(raw: string | null | undefined): boolean {
  return descriptionWordCount(raw) < THIN_DESCRIPTION_WORDS;
}

/** A small stable hash, so a conference always gets the same sentence shapes. */
function variantOf(id: string, n: number): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h) % n;
}

/** "A, B and C"; "A; B and C" when an item has a comma of its own
 *  ("Social, Humanitarian and Cultural Committee"), so the list stays readable. */
function listOf(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  const sep = items.some((it) => it.includes(',')) ? '; ' : ', ';
  return `${items.slice(0, -1).join(sep)} and ${items[items.length - 1]}`;
}

function capitalise(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

const ROLE_ORDER = ['delegate', 'head-delegate', 'faculty-advisor', 'observer', 'chair', 'press', 'crisis', 'secretariat', 'staff'];
const ROLE_LABELS: Record<string, string> = {
  delegate: 'Delegate',
  'head-delegate': 'Head Delegate',
  'faculty-advisor': 'Faculty Advisor',
  observer: 'Observer',
  chair: 'Chair',
  press: 'Press',
  crisis: 'Crisis Staff',
  secretariat: 'Secretariat',
  staff: 'Staff',
};
function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? capitalise(role.replace(/-/g, ' '));
}

const TYPE_LABELS: Record<string, string> = {
  'general-assembly': 'General Assembly',
  crisis: 'Crisis',
  specialised: 'Specialised',
  press: 'Press',
};

function topicsOf(c: AboutCommittee): string[] {
  return Array.isArray(c.topics) ? c.topics.map((t) => (typeof t === 'string' ? tidy(t) : '')).filter(Boolean) : [];
}

/** "UN Security Council (UNSC)", or the name alone when the acronym adds nothing. */
function committeeLabel(c: AboutCommittee): string {
  const name = tidy(c.name);
  const abbr = tidy(c.abbreviation);
  if (!name) return abbr;
  return abbr && abbr.toLowerCase() !== name.toLowerCase() ? `${name} (${abbr})` : name;
}

/** The short form a sentence uses after the committee was named: the acronym, else the name. */
function committeeShort(c: AboutCommittee): string {
  return tidy(c.abbreviation) || tidy(c.name);
}

/** "in Riga, Latvia", "online", "in Pune, India and online", or '' with no place. */
function wherePhrase(c: ConferenceSeoInput): string {
  const city = placeCase(c.city ?? '');
  const parts = [city, placeCase(c.country ?? '')].filter((p) => p && !/^online$/i.test(p));
  if (c.format === 'online' || (/^online$/i.test(city) && c.format !== 'hybrid')) return 'online';
  if (!parts.length) return c.format === 'hybrid' ? 'in person and online' : '';
  return `in ${parts.join(', ')}${c.format === 'hybrid' ? ' and online' : ''}`;
}

/** "from 8 to 10 Jan 2027" / "on 5 Dec 2026", or '' when undated. */
function whenPhrase(c: ConferenceSeoInput): string {
  const dates = conferenceDateText(c);
  if (!dates) return '';
  const single = !c.end_date || c.end_date === c.start_date;
  return `${single ? 'on' : 'from'} ${dates}`;
}

function levelText(level: string | null | undefined): string {
  const l = tidy(level).toLowerCase();
  if (l === 'school' || l === 'high_school' || l === 'high school') return 'high school students';
  if (l === 'university') return 'university students';
  if (l === 'both') return 'high school and university students';
  return '';
}

function ageText(min: number | null | undefined, max: number | null | undefined): string {
  const lo = min && min > 0 ? min : 0;
  const hi = max && max > 0 ? max : 0;
  if (lo && hi) return `aged ${lo} to ${hi}`;
  if (lo) return `aged ${lo} and over`;
  if (hi) return `aged up to ${hi}`;
  return '';
}

function priceText(p: DelegatePrice): string {
  if (p.kind === 'paid') return `${delegatePriceLabel(p)}${p.phase?.label ? ` (${tidy(p.phase.label)})` : ''}`;
  return delegatePriceLabel(p);
}

function windowText(w: DelegateWindow, timeZone: string | null | undefined): string {
  if (w.state === 'open') {
    const until = w.closeAt ? windowDayText(w.closeAt, timeZone) : '';
    return until ? `Applications open until ${until}` : 'Applications open';
  }
  if (w.state === 'not_open') {
    const from = w.openAt ? windowDayText(w.openAt, timeZone) : '';
    return from ? `Applications open on ${from}` : 'Applications open soon';
  }
  if (w.state === 'closed') return 'Applications closed';
  return '';
}

export function buildConferenceAbout(
  conf: AboutConference,
  committeesIn: readonly AboutCommittee[],
  rolesIn: readonly AboutRole[],
): ConferenceAboutContent {
  const thin = isThinDescription(conf.description);
  const short = conferenceShortName(conf);
  const name = nameForSentence(conf);
  const past = hasConcluded(conf);
  const tbd = hasNoDates(conf);
  const says = SAYS_MUN.test(`${tidy(conf.acronym)} ${tidy(conf.full_name)}`);
  const v = variantOf(conf.id || conf.slug, 3);
  const listing = conf.listing ?? null;
  const where = wherePhrase(conf);
  const when = whenPhrase(conf);

  const committees = committeesIn.filter((c) => tidy(c.name) || tidy(c.abbreviation));
  const roles = [...rolesIn]
    .filter((r) => r.window.state !== 'disabled')
    .sort((a, b) => {
      const ia = ROLE_ORDER.indexOf(a.role);
      const ib = ROLE_ORDER.indexOf(b.role);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
  const delegate = rolesIn.find((r) => r.role === 'delegate') ?? null;

  /* ── Intro ─────────────────────────────────────────────────────────── */
  const first: string[] = [];
  // 1. What, where, when, in one of three shapes.
  const kind = where === 'online' ? 'an online Model UN conference' : `a Model UN conference${where ? ` ${where}` : ''}`;
  const shape = v === 2 && !when ? 0 : v === 1 && !where && !when ? 0 : v;
  let identitySaid = true;
  if (shape === 2) {
    first.push(`${capitalise(when)}, ${name} ${past ? 'brought' : 'brings'} Model UN delegates together ${where || 'for debate'}.`);
  } else if (shape === 1) {
    // "in Riga, Latvia, from ..." takes a comma before the dates; "online from ..." does not.
    const gap = where.startsWith('in ') ? ', ' : ' ';
    first.push(`${name} ${past ? 'took' : 'takes'} place${where ? ` ${where}` : ''}${when ? `${where ? gap : ' '}${when}` : ''}.`);
    identitySaid = false;
  } else {
    first.push(`${name} ${past ? 'was' : 'is'} ${kind}${when ? `, ${when}` : ''}.`);
  }
  if (tbd) first.push(`${DATES_TO_BE_DECIDED}.`);

  // 2. Who it is for, and how many are expected.
  const level = levelText(conf.student_level);
  const age = ageText(conf.min_age, conf.max_age);
  const expected = conf.expected_delegates && conf.expected_delegates > 0 ? conf.expected_delegates : 0;
  const expectedText = expected ? expected.toLocaleString('en') : '';
  const who = [level, age].filter(Boolean).join(' ');
  if (!identitySaid) {
    const lead = says ? (past ? 'It was open to' : 'It is open to') : (past ? 'It was a Model UN conference for' : 'It is a Model UN conference for');
    if (who) {
      first.push(`${lead} ${who}${expected ? `, with about ${expectedText} delegates expected` : ''}.`);
    } else if (!says) {
      first.push(`It ${past ? 'was' : 'is'} a Model UN conference${expected ? ` for about ${expectedText} delegates` : ''}.`);
    } else if (expected) {
      first.push(`The organisers ${past ? 'expected' : 'expect'} about ${expectedText} delegates.`);
    }
  } else if (who) {
    first.push(`It ${past ? 'was' : 'is'} for ${who}${expected ? `, and the organisers ${past ? 'expected' : 'expect'} about ${expectedText} delegates` : ''}.`);
  } else if (expected) {
    first.push(`The organisers ${past ? 'expected' : 'expect'} about ${expectedText} delegates.`);
  }

  // 3. Committees: the count, two named, and up to two topics.
  if (committees.length) {
    const n = committees.length;
    const withTopic = committees.filter((c) => topicsOf(c).length);
    const named = (withTopic.length >= 2 ? withTopic : [...withTopic, ...committees.filter((c) => !topicsOf(c).length)]).slice(0, 2);
    const count = n === 1 ? 'one committee' : `${n} committees`;
    const lead = v === 1
      ? `Delegates ${past ? 'debated' : 'debate'} in ${count}`
      : v === 2
        ? `${past ? 'There were' : 'There are'} ${count}`
        : `It ${past ? 'ran' : 'runs'} ${count}`;
    if (n <= 3) first.push(`${lead}: ${listOf(committees.map(committeeLabel))}.`);
    else first.push(`${lead}, including ${listOf(named.map(committeeLabel))}.`);
    const topicLines = named
      .filter((c) => topicsOf(c).length)
      .map((c) => `${committeeShort(c)} ${past ? 'debated' : 'will debate'} “${topicsOf(c)[0].replace(/[.!?;:,\s]+$/, '')}”`);
    if (topicLines.length) first.push(`${topicLines.join(', and ')}.`);
  }

  // 4. Where you apply. A listing takes no applications on Gavelling: say where it does.
  if (!past && listing) {
    first.push(listing.outboundUrl
      ? (v === 1 ? `Applications for ${short} run on its own website.` : `You apply to ${short} on its own website.`)
      : `${short} takes applications through its organisers, not on Gavelling.`);
  } else if (!past && roles.length) {
    first.push(v === 1 ? `Applications for ${short} run on Gavelling.` : `You can apply to ${short} on Gavelling.`);
  }

  /* ── Committees list ───────────────────────────────────────────────── */
  const committeeItems: AboutCommitteeItem[] = committees.map((c, i) => {
    const fullName = tidy(c.name);
    const title = committeeDisplayName(fullName, c.abbreviation) || fullName;
    return {
      key: `${i}-${fullName}`,
      title,
      fullName: title !== fullName && fullName ? fullName : null,
      type: TYPE_LABELS[tidy(c.committee_type)] ?? null,
      topics: topicsOf(c),
    };
  });

  /* ── Roles, fees and deadlines ─────────────────────────────────────── */
  const roleItems: AboutRoleItem[] = past
    ? []
    : roles.map((r) => ({ label: roleLabel(r.role), price: priceText(r.price), window: windowText(r.window, conf.timezone) }));
  const rolesNote = past
    ? null
    : listing
      ? `${short} publishes its roles, fees and deadlines on its own website.`
      : !roles.length ? `The organisers have not opened applications to ${short} yet.` : null;

  /* ── How to apply ──────────────────────────────────────────────────── */
  const anyPaid = roles.some((r) => r.price.kind === 'paid');
  const steps = past
    ? []
    : listing
      ? [
          listing.outboundUrl ? `Visit the official website of ${short}.` : `Find the official pages of ${short}.`,
          'Follow the application steps, deadlines and fees the organisers publish there.',
        ]
      : [
        'Create a free Gavelling account, or sign in to yours.',
        `Open the Apply page for ${short}, choose your role and fill in the application.`,
        anyPaid || !roles.length
          ? 'Pay any fee the way the organisers set out on Gavelling. Some conferences ask for payment only after accepting you.'
          : 'The organisers review your application, and your conference dashboard shows their decision.',
      ];
  const gavellingLine = listing
    ? `Gavelling lists ${short} from its public website. If you run it, you can claim this page for free and take applications here.`
    : 'On Gavelling, committees can run as live sessions where you follow motions and the speakers list on your phone. Every conference you attend as a delegate is added to your MUN CV once it ends.';

  /* ── FAQ (also the FAQPage JSON-LD, word for word) ─────────────────── */
  const faq: FaqEntry[] = [];
  if (when) {
    faq.push({ question: `When is ${short}?`, answer: `${short} ${past ? 'took' : 'takes'} place ${when}.` });
  }
  if (where) {
    faq.push({
      question: `Where is ${short} held?`,
      answer: where === 'in person and online'
        ? `${short} ${past ? 'was' : 'is'} held in person and online.`
        : `${short} ${past ? 'was' : 'is'} held ${where}.`,
    });
  }
  if (!past && delegate && delegate.price.kind !== 'tbd') {
    const head = delegate.price.kind === 'free'
      ? `${short} charges delegates no fee.`
      : `The delegate fee for ${short} is ${delegatePriceLabel(delegate.price)}${delegate.price.phase?.label ? ` at the ${tidy(delegate.price.phase.label)} stage` : ''}.`;
    const others = roles.filter((r) => r.role !== 'delegate' && r.price.kind !== 'tbd');
    let tail = '';
    if (others.length && others.every((r) => r.price.kind === 'free')) {
      tail = ` ${others.length === 1 ? `The ${roleLabel(others[0].role)} role is` : `The other roles (${listOf(others.map((r) => roleLabel(r.role)))}) are`} free${delegate.price.kind === 'free' ? ' too' : ''}.`;
    } else if (others.length) {
      tail = ` Other roles: ${listOf(others.map((r) => `${roleLabel(r.role)} ${delegatePriceLabel(r.price, { tbd: 'to be announced', free: 'free' })}`))}.`;
    }
    faq.push({ question: `How much does ${short} cost?`, answer: `${head}${tail}` });
  }
  if (!past && listing && listing.outboundUrl) {
    faq.push({
      question: `How do I apply to ${short}?`,
      answer: `${short} takes applications on its own website. Its roles, fees and deadlines are published there.`,
    });
  } else if (!past && !listing && roles.length) {
    const window = delegate ? delegateWindowSentence(conf, delegate.window) : '';
    faq.push({
      question: `How do I apply to ${short}?`,
      answer: `Create a free Gavelling account, open the Apply page for ${short}, choose your role and fill in the application.${window ? ` ${window}` : ''}`,
    });
  }
  if (committees.length) {
    const n = committees.length;
    faq.push({
      question: `Which committees does ${short} have?`,
      answer: `${short} ${past ? 'had' : 'has'} ${n === 1 ? 'one committee' : `${n} committees`}: ${listOf(committees.map(committeeLabel))}.`,
    });
  }

  return {
    thin,
    shortName: short,
    heading: `About ${short}`,
    intro: [first.join(' ')],
    committees: committeeItems,
    roles: roleItems,
    rolesNote,
    steps,
    stepsHeading: listing ? 'How to Apply' : 'How to Apply on Gavelling',
    gavellingLine,
    applyHref: listing ? (listing.outboundUrl ?? '') : `/conferences/${conf.slug}/apply`,
    applyLabel: listing ? `Visit the ${short} website` : `Apply to ${short}`,
    applyExternal: !!listing,
    concluded: past,
    faq,
  };
}

/** The FAQPage JSON-LD for the same entries the page shows. */
export function conferenceFaqJsonLd(items: readonly FaqEntry[]): object | null {
  if (!items.length) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((it) => ({
      '@type': 'Question',
      name: it.question,
      acceptedAnswer: { '@type': 'Answer', text: it.answer },
    })),
  };
}
