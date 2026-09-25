// ── Pricing questions, answered once ────────────────────────────────────────
//
// ONE source for the FAQ on /pricing/credits, /pricing/subscription and the
// Pricing section of the help center (/help). Every answer says where the
// thing lives: a link to a page or tab, or an action (`open-credits` /
// `open-unlimited` open the purchase pop-ups). The facts here are the facts
// the owner approved on 24 Sep 2026; do not add to them.
//
// Plain text, no markup: renderers put the links after the answer as a row
// of small actions, so the sentence never breaks around an anchor.

export type FaqAction =
  | { kind: 'link'; label: string; href: string }
  | { kind: 'open-credits'; label: string }
  | { kind: 'open-unlimited'; label: string };

export interface FaqEntry {
  /** Stable id, also the URL fragment. */
  id: string;
  question: string;
  answer: string;
  actions: FaqAction[];
  /** Which pricing page(s) print it; the help center prints all of them. */
  pages: ('credits' | 'subscription')[];
  /** Extra words the help-center search should match. */
  keywords?: string[];
}

const MANAGE_SUBSCRIPTION = { kind: 'link', label: 'Manage account: Subscription', href: '/account/manage/subscription' } as const;
const MANAGE_PROMO = { kind: 'link', label: 'Manage account: Promo code', href: '/account/manage/promo' } as const;
const MANAGE_CREDITS = { kind: 'link', label: 'Manage account: Credits and usage', href: '/account/manage/credits' } as const;
const PRICING_CREDITS = { kind: 'link', label: 'Credits pricing', href: '/pricing/credits' } as const;
const PRICING_SUB = { kind: 'link', label: 'Unlimited pricing', href: '/pricing/subscription' } as const;

export const PRICING_FAQ: FaqEntry[] = [
  {
    id: 'what-is-a-credit',
    question: 'What is a Gavelling credit?',
    answer: 'A credit is Gavelling\'s own currency for applying to conferences. One credit covers one person\'s application to one conference, and it costs one US dollar. Your first credit is free when you create your account. It is separate from anything the conference itself charges: a registration fee goes to the organisers, a credit goes to Gavelling.',
    actions: [{ kind: 'open-credits', label: 'Buy credits' }, PRICING_CREDITS],
    pages: ['credits'],
    keywords: ['token', 'coin', 'currency', 'dollar'],
  },
  {
    id: 'how-much',
    question: 'How much does a credit cost?',
    answer: 'One US dollar each. Bundles from 10 credits up are discounted: 10 or more are 10% off, 25 or more 15% off, 50 or more 20% off, and 100 or more 25% off. Any quantity gets the discount of the highest step it reaches, so 12 credits cost $10.80 and 30 credits cost $25.50.',
    actions: [{ kind: 'open-credits', label: 'See the bundles' }],
    pages: ['credits'],
    keywords: ['price', 'discount', 'bundle', 'bulk', 'cheaper'],
  },
  {
    id: 'per-application-or-per-person',
    question: 'Is it one credit per application, or one per conference?',
    answer: 'One credit per person per conference. Editing your application, withdrawing and applying again, or being asked to resubmit never costs a second credit for the same conference.',
    actions: [MANAGE_CREDITS],
    pages: ['credits'],
    keywords: ['edit', 'resubmit', 'reapply', 'twice'],
  },
  {
    id: 'who-pays',
    question: 'Who needs a credit and who never does?',
    answer: 'Delegates, head delegates, faculty advisors and observers use one credit when they apply. Chairs, secretariat and staff never do: their applications are always free.',
    actions: [PRICING_CREDITS],
    pages: ['credits'],
    keywords: ['chair', 'secretariat', 'staff', 'advisor', 'observer', 'free', 'exempt'],
  },
  {
    id: 'refund',
    question: 'What happens to my credit if I am rejected or I withdraw?',
    answer: 'It comes straight back to your balance. A rejected application returns its credit, and so does one you withdraw yourself. You will see the refund in your credit history.',
    actions: [MANAGE_CREDITS],
    pages: ['credits'],
    keywords: ['rejected', 'withdraw', 'refund', 'money back', 'returned'],
  },
  {
    id: 'buy-credits',
    question: 'Where do I buy credits?',
    answer: 'From the credit counter in the header (the small plus beside your balance), from the pricing page, or from Manage account. Payment happens in a pop-up on the page you are on, so you never leave what you were doing. If you run out while submitting an application, the same pop-up opens there.',
    actions: [{ kind: 'open-credits', label: 'Buy credits' }, MANAGE_CREDITS],
    pages: ['credits'],
    keywords: ['purchase', 'top up', 'pay', 'card', 'stripe'],
  },
  {
    id: 'do-credits-expire',
    question: 'Do purchased credits run out or change while I am on Unlimited?',
    answer: 'Credits you already hold stay in your balance while you are on Unlimited, and they are still there if you cancel it later. Unlimited covers your applications while it is active, so your credits simply wait.',
    actions: [MANAGE_CREDITS, PRICING_SUB],
    pages: ['credits', 'subscription'],
    keywords: ['keep', 'lose', 'balance', 'cancel'],
  },
  {
    id: 'what-is-unlimited',
    question: 'What is Gavelling Unlimited?',
    answer: 'One plan that covers every application you make while it is active, so you never think about credits. It costs 3 US dollars a month or 30 US dollars a year, the same everywhere, and it renews until you cancel.',
    actions: [{ kind: 'open-unlimited', label: 'Go Unlimited' }, PRICING_SUB],
    pages: ['subscription'],
    keywords: ['subscription', 'plan', 'monthly', 'yearly', 'annual'],
  },
  {
    id: 'unlimited-renewal',
    question: 'Does Unlimited renew by itself?',
    answer: 'Yes. Monthly renews every month and yearly renews every year, until you cancel. If a renewal payment fails we email you a link to pay once for another year, with nothing automatic after that.',
    actions: [MANAGE_SUBSCRIPTION],
    pages: ['subscription'],
    keywords: ['renew', 'automatic', 'recurring', 'charge', 'failed payment'],
  },
  {
    id: 'cancel-unlimited',
    question: 'How do I cancel Unlimited?',
    answer: 'From Manage account, under Subscription: Manage or cancel opens your billing portal, where cancelling takes one click. You keep Unlimited until the end of the period you have already paid for, and nothing is charged after that.',
    actions: [MANAGE_SUBSCRIPTION],
    pages: ['subscription'],
    keywords: ['cancel', 'stop', 'end', 'billing portal', 'refund'],
  },
  {
    id: 'unlimited-vs-credits',
    question: 'Should I buy credits or go Unlimited?',
    answer: 'If you apply to a couple of conferences a year, credits are cheaper: each one is a dollar and your first is free. If you apply often, or you lead a delegation and apply for several people, Unlimited at 30 dollars a year costs less than 30 credits and never runs out.',
    actions: [{ kind: 'open-credits', label: 'Buy credits' }, { kind: 'open-unlimited', label: 'Go Unlimited' }],
    pages: ['credits', 'subscription'],
    keywords: ['compare', 'worth it', 'better', 'cheaper'],
  },
  {
    id: 'promo-code',
    question: 'I have a promo code. Where do I use it?',
    answer: 'In Manage account, under Promo code. Type it in and press Claim: a code adds credits or days of Unlimited to your account straight away, and the page tells you which.',
    actions: [MANAGE_PROMO],
    pages: ['credits', 'subscription'],
    keywords: ['voucher', 'coupon', 'discount code', 'redeem', 'claim'],
  },
  {
    id: 'organisers-pay',
    question: 'Do conference organisers pay anything?',
    answer: 'No. Listing a conference, taking applications, allocating delegates and running committees on Gavelling is free for organisers. Credits and Unlimited are paid by the people who apply.',
    actions: [{ kind: 'link', label: 'For organisers', href: '/organisers' }],
    pages: ['credits', 'subscription'],
    keywords: ['organiser', 'organizer', 'secretariat', 'fee', 'platform fee', 'commission'],
  },
];

export function faqForPage(page: 'credits' | 'subscription'): FaqEntry[] {
  return PRICING_FAQ.filter((f) => f.pages.includes(page));
}
