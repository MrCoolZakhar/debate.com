// ── Help center content ──────────────────────────────────────────────────────
//
// The five sections of /help, in the order they are printed. Every entry is
// FaqEntry-shaped so the help center renders them with the same FaqList the
// pricing pages use. The Pricing section IS `PRICING_FAQ` (src/lib/pricingFaq.ts),
// never a copy of it.
//
// Every fact here is verifiable in CLAUDE.md or AGENTS.md at the repo root.
// Do not add an entry from memory: read the rulebook first, then write the
// plain sentence. Plain text only, no markup: links go in `actions`.

import { PRICING_FAQ, type FaqEntry } from '@/lib/pricingFaq';

export type HelpSectionId = 'sessions' | 'delegates' | 'chairs' | 'organizers' | 'pricing';

/** Lucide glyph drawn when the Fluent 3D emoji fails to load; mapped in HelpClient. */
export type HelpFallbackIcon = 'Landmark' | 'GraduationCap' | 'Gavel' | 'Briefcase' | 'Wallet';

export interface HelpSection {
  id: HelpSectionId;
  title: string;
  /** Fluent 3D emoji asset name, sentence case, e.g. "Classical building". */
  emoji: string;
  fallback: HelpFallbackIcon;
  entries: FaqEntry[];
}

const SESSIONS: FaqEntry[] = [
  {
    id: 'start-a-session',
    question: 'How do I start a committee session?',
    answer: 'Go to Create a committee. A session is free and needs no account. You get a 6-character session code for delegates and a chair code for the dais: the session code plus 4 digits, like ABC123-4821. Keep the chair code for chairs only.',
    actions: [{ kind: 'link', label: 'Create a committee', href: '/create' }],
    pages: [],
    keywords: ['create', 'new', 'room', 'session code', 'chair code', 'free', 'account'],
  },
  {
    id: 'join-a-session',
    question: 'How do delegates and chairs join?',
    answer: 'Everyone joins at Join a session. A delegate types the session code and picks their country. A chair types the chair code. If you type a chair code (CODE-1234) the page switches to the Chair tab by itself.',
    actions: [{ kind: 'link', label: 'Join a session', href: '/join' }],
    pages: [],
    keywords: ['join', 'code', 'country', 'seat', 'chair tab', 'phone'],
  },
  {
    id: 'advisor-board',
    question: 'I am a faculty advisor. How do I follow my students?',
    answer: 'Open the advisor board and add a room by its session code. The board is read-only: it shows where each student is in the speaking queue across every room you follow, and nothing you do there changes the session.',
    actions: [{ kind: 'link', label: 'Advisor board', href: '/advisor' }],
    pages: [],
    keywords: ['teacher', 'faculty', 'advisor', 'board', 'follow', 'students', 'observer'],
  },
  {
    id: 'session-deleted',
    question: 'How long is a room kept?',
    answer: 'A standalone room is deleted 1 to 2 hours after the chair ends debate. A suspended standalone room is kept for 36 hours, or 72 hours if debate was held. A room that belongs to a conference is never deleted automatically.',
    actions: [],
    pages: [],
    keywords: ['delete', 'deleted', 'expire', 'kept', 'suspend', 'end debate', 'how long', 'gone'],
  },
  {
    id: 'reserved-seats',
    question: 'Why does a seat say it is reserved?',
    answer: 'In a conference session, a seat with an allocated delegate is reserved for that person\'s account: they sign in and the seat is theirs. Every other seat is open to anyone with the session code.',
    actions: [{ kind: 'link', label: 'Join a session', href: '/join' }],
    pages: [],
    keywords: ['reserved', 'taken', 'allocated', 'sign in', 'open seat', 'conference session'],
  },
];

const DELEGATES: FaqEntry[] = [
  {
    id: 'apply-to-a-conference',
    question: 'How do I apply to a conference?',
    answer: 'Open the conference\'s page and press Apply. The application saves a draft as you go, so you can stop and come back. Your drafts and applications are under Needs your attention in the profile menu and in your account under Conferences.',
    actions: [
      { kind: 'link', label: 'Explore conferences', href: '/conferences/explore' },
      { kind: 'link', label: 'My conferences', href: '/account/conferences' },
    ],
    pages: [],
    keywords: ['apply', 'application', 'draft', 'resume', 'continue', 'come back', 'status'],
  },
  {
    id: 'delegate-credits',
    question: 'Do I need a credit to apply?',
    answer: 'Yes, one credit per conference, and your first credit is free. Editing or resubmitting the same application never costs another credit. If you are rejected or you withdraw, the credit comes back to your balance.',
    actions: [
      { kind: 'open-credits', label: 'Buy credits' },
      { kind: 'link', label: 'Pricing questions', href: '/help#pricing' },
    ],
    pages: [],
    keywords: ['credit', 'free', 'refund', 'rejected', 'withdraw', 'edit', 'resubmit'],
  },
  {
    id: 'pay-the-conference',
    question: 'How do I pay the conference fee?',
    answer: 'Once you are accepted, the conference\'s pay page shows what you owe. You pay by card, or by following the organiser\'s own instructions if they take payment manually. The fee goes to the conference. Gavelling adds no platform fee, so you pay exactly the amount on the invoice.',
    actions: [{ kind: 'link', label: 'My conferences', href: '/account/conferences' }],
    pages: [],
    keywords: ['pay', 'payment', 'fee', 'invoice', 'card', 'stripe', 'bank transfer', 'manual', 'platform fee'],
  },
  {
    id: 'mun-cv',
    question: 'What is my MUN CV?',
    answer: 'A record of your conferences, kept in your account and shown on a public page you can share. Awards published on Gavelling are added to it automatically, with a verified mark.',
    actions: [{ kind: 'link', label: 'My MUN CV', href: '/account/cv' }],
    pages: [],
    keywords: ['cv', 'resume', 'awards', 'share', 'public', 'verified', 'record'],
  },
  {
    id: 'room-is-live',
    question: 'How do I get into my committee room during the conference?',
    answer: 'When a room you are allocated to is live, a "Your room is live" pop-up appears as soon as you open Gavelling and takes you straight to your seat. The same rooms are listed under Live now in the profile menu.',
    actions: [{ kind: 'link', label: 'Join a session', href: '/join' }],
    pages: [],
    keywords: ['live', 'room', 'seat', 'pop-up', 'popup', 'live now', 'join', 'committee'],
  },
];

const CHAIRS: FaqEntry[] = [
  {
    id: 'chair-applications-free',
    question: 'Does applying to chair cost a credit?',
    answer: 'No. Chair applications are always free. Credits are only used by delegates, head delegates, faculty advisors and observers.',
    actions: [{ kind: 'link', label: 'Chair and staff roles', href: '/conferences/roles' }],
    pages: [],
    keywords: ['chair', 'credit', 'free', 'apply', 'job board', 'roles', 'staff'],
  },
  {
    id: 'chair-room-live',
    question: 'How do I get onto the dais when my room is live?',
    answer: 'Your conference page for the role is the chair page of that conference. When your room is live, a "Your room is live" pop-up (and Live now in the profile menu) puts you on the dais with no chair code. The first chair in starts the session; the next one joins as co-chair.',
    actions: [{ kind: 'link', label: 'My conferences', href: '/account/conferences' }],
    pages: [],
    keywords: ['dais', 'live', 'chair code', 'co-chair', 'start the session', 'role page'],
  },
  {
    id: 'chair-with-a-code',
    question: 'Nobody was assigned to chair my committee. How do I get in?',
    answer: 'Then the room works like a standalone session: the organiser gives you the chair code and you type it at Join a session. The page switches to the Chair tab when it sees a chair code.',
    actions: [{ kind: 'link', label: 'Join a session', href: '/join' }],
    pages: [],
    keywords: ['chair code', 'unassigned', 'open dais', 'join', 'organiser'],
  },
  {
    id: 'moderator-and-commenters',
    question: 'What is the difference between the Moderator and a Commenter?',
    answer: 'The Moderator holds the gavel and runs the room: the timers, the lists and the motions. Every other chair is a Commenter and writes notes on speeches from the comment dock. Any chair can take the gavel from the top bar of the chair page.',
    actions: [],
    pages: [],
    keywords: ['gavel', 'moderator', 'commenter', 'head chair', 'co-chair', 'notes', 'take the gavel'],
  },
];

const ORGANIZERS: FaqEntry[] = [
  {
    id: 'list-a-conference',
    question: 'What does it cost to list a conference?',
    answer: 'Nothing. Listing a conference, taking applications, allocating delegates and running every committee is free for organisers. Participants pay credits to Gavelling, and Gavelling takes no fee on your conference fees.',
    actions: [
      { kind: 'link', label: 'List your conference', href: '/conferences/new' },
      { kind: 'link', label: 'For organisers', href: '/organisers' },
    ],
    pages: [],
    keywords: ['list', 'create', 'cost', 'free', 'organiser', 'organizer', 'fee', 'commission'],
  },
  {
    id: 'setup-checklist',
    question: 'What is the set-up checklist and the blue checkmark?',
    answer: 'Your dashboard lists the stages: your page, committees with enough seats, chairs, emails, a secretariat (a second organiser, an invite, or telling us you run it alone), a payment method, then publish. Once every stage is done the conference gets its blue checkmark.',
    actions: [{ kind: 'link', label: 'My conferences', href: '/account/conferences' }],
    pages: [],
    keywords: ['checklist', 'checkmark', 'verified', 'dashboard', 'secretariat', 'publish', 'set up'],
  },
  {
    id: 'payment-method',
    question: 'Why must I set a payment method before applications open?',
    answer: 'Because delegates need a way to pay you, applications cannot open and the page cannot be published until a method is set. That is true for a free conference too: choose Manual and write "This conference is free" in the instructions. Card payments go to your own Stripe account. Manual payment, with proof you review, is a first-class option.',
    actions: [{ kind: 'link', label: 'List your conference', href: '/conferences/new' }],
    pages: [],
    keywords: ['payment method', 'stripe', 'manual', 'free conference', 'publish', 'applications open', 'proof'],
  },
  {
    id: 'live-rooms',
    question: 'How do I watch the committees on the day?',
    answer: 'Every committee mints its own live session. From your dashboard, Live shows every room at once, and the scoreboard brings the committees together in one ranking.',
    actions: [{ kind: 'link', label: 'My conferences', href: '/account/conferences' }],
    pages: [],
    keywords: ['live', 'rooms', 'scoreboard', 'committees', 'session', 'watch', 'status'],
  },
];

export const HELP_SECTIONS: HelpSection[] = [
  {
    id: 'sessions',
    title: 'Sessions',
    emoji: 'Classical building',
    fallback: 'Landmark',
    entries: SESSIONS,
  },
  {
    id: 'delegates',
    title: 'Delegates',
    emoji: 'Graduation cap',
    fallback: 'GraduationCap',
    entries: DELEGATES,
  },
  {
    id: 'chairs',
    title: 'Chairs',
    emoji: 'Balance scale',
    fallback: 'Gavel',
    entries: CHAIRS,
  },
  {
    id: 'organizers',
    title: 'Organizers',
    emoji: 'Briefcase',
    fallback: 'Briefcase',
    entries: ORGANIZERS,
  },
  {
    id: 'pricing',
    title: 'Pricing',
    emoji: 'Money bag',
    fallback: 'Wallet',
    entries: PRICING_FAQ,
  },
];

export interface HelpHit {
  section: HelpSection;
  entry: FaqEntry;
}

function words(s: string): string[] {
  return s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

/**
 * Every entry whose question, answer or keywords match the query, best first.
 * Word matching: each word of the query must appear somewhere in the entry
 * (a prefix match, so "pay" finds "payment"). Entries whose question contains
 * the whole query come first, then entries whose question holds every word,
 * then everything else, each group in page order.
 */
export function searchHelp(query: string): HelpHit[] {
  const q = query.trim().toLowerCase();
  const terms = words(q);
  if (terms.length === 0) return [];

  const ranked: { hit: HelpHit; rank: number; order: number }[] = [];
  let order = 0;
  for (const section of HELP_SECTIONS) {
    for (const entry of section.entries) {
      order += 1;
      const question = entry.question.toLowerCase();
      const questionWords = words(question);
      const otherWords = [...words(entry.answer), ...(entry.keywords ?? []).flatMap(words), ...words(section.title)];
      const inQuestion = (t: string) => questionWords.some((w) => w.startsWith(t));
      const anywhere = (t: string) => inQuestion(t) || otherWords.some((w) => w.startsWith(t));
      if (!terms.every(anywhere)) continue;
      const rank = question.includes(q) ? 0 : terms.every(inQuestion) ? 1 : 2;
      ranked.push({ hit: { section, entry }, rank, order });
    }
  }
  ranked.sort((a, b) => a.rank - b.rank || a.order - b.order);
  return ranked.map((r) => r.hit);
}

/** The section an entry id belongs to, for deep links like /help#cancel-unlimited. */
export function sectionForEntry(id: string): HelpSection | null {
  for (const section of HELP_SECTIONS) {
    if (section.entries.some((e) => e.id === id)) return section;
  }
  return null;
}
