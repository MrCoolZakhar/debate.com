// ─────────────────────────────────────────────────────────────────────────────
// WHAT A TOKEN LOOKS LIKE.
//
// A token used to render as an outlined pill with a form-label inside it
// ("Delegate Name", "Committee", "Session Code"), which reads as a field you
// have to fill in rather than as an object you drop into a sentence. Every
// token now carries an IDENTITY: a 3D emoji on the palette and in the
// suggestion list, a unicode glyph inside the in-text pill (no network fetch
// in a contentEditable), a lucide fallback, and a short name that fits.
//
// The glyph is the important half. It is what survives at 12px inside a
// paragraph, and it is what makes {{committee}} and {{country}} tell each
// other apart at a glance in the middle of a sentence.
//
// SERIALISATION SAFETY: the glyph lives INSIDE the pill node, which is a
// `contenteditable=false` atom carrying `data-token`. `serializeChildren` in
// paragraphDom.ts short-circuits on `dataset.token` and emits `{{key}}`
// without ever looking at the node's text, so decorating the pill cannot
// change a single stored byte.
// ─────────────────────────────────────────────────────────────────────────────

import {
  UserRound, BadgeCheck, Users, Landmark, Globe, Wallet, Building2, CalendarDays,
  CreditCard, Mail, MessageSquare, KeyRound, Link2, Ban, Trophy,
} from 'lucide-react';
import { EMAIL_TOKEN_LABELS, type EmailTokenKey } from '@/lib/emailTokens';

/** How the Details rail groups them, so fourteen pills read as four families. */
export type TokenFamily = 'person' | 'place' | 'money' | 'conference' | 'thread' | 'link';

export interface TokenIdentity {
  /** Fluent 3D emoji asset name, for the palette and the suggestion list. */
  emoji: string;
  /** Unicode glyph for the in-text pill. Must be one grapheme. */
  glyph: string;
  /** Lucide fallback for when the emoji CDN is unreachable. */
  icon: typeof UserRound;
  /** Short enough to sit in a pill mid-sentence. Falls back to the long label. */
  short: string;
  family: TokenFamily;
  /** Plain words for the hover card: what this actually becomes when sent. */
  becomes: string;
}

export const TOKEN_IDENTITY: Record<EmailTokenKey, TokenIdentity> = {
  delegate_name: { emoji: 'Bust in silhouette', glyph: '🧑', icon: UserRound, short: 'Their name', family: 'person', becomes: 'The name of whoever opens the email.' },
  role: { emoji: 'Identification card', glyph: '🪪', icon: BadgeCheck, short: 'Their role', family: 'person', becomes: 'Delegate, Chair, Faculty Advisor, and so on.' },
  /* NOT 'People holding hands': Fluent files skin-tone emoji under a per-tone
     subfolder, so that name 404s on the flat asset path and silently falls back
     to the lucide glyph. Verified: 'People holding hands' 404, 'Family' 404,
     'Busts in silhouette' 200. */
  delegation_name: { emoji: 'Busts in silhouette', glyph: '🧑‍🤝‍🧑', icon: Users, short: 'Delegation', family: 'place', becomes: 'The school or society they came with.' },
  committee: { emoji: 'Ballot box with ballot', glyph: '🗳️', icon: Landmark, short: 'Committee', family: 'place', becomes: 'The committee they were allocated to.' },
  country: { emoji: 'Globe showing Europe-Africa', glyph: '🌍', icon: Globe, short: 'Country', family: 'place', becomes: 'The country or seat they represent.' },
  payment_status: { emoji: 'Money bag', glyph: '💰', icon: Wallet, short: 'Paid or not', family: 'money', becomes: 'Paid, Unpaid, Waived, and so on.' },
  fee: { emoji: 'Credit card', glyph: '💳', icon: CreditCard, short: 'Their fee', family: 'money', becomes: 'The amount owed for their role, at the current phase.' },
  conference_name: { emoji: 'Classical building', glyph: '🏛️', icon: Building2, short: 'Conference', family: 'conference', becomes: 'This conference, spelled out in full.' },
  conference_dates: { emoji: 'Calendar', glyph: '📅', icon: CalendarDays, short: 'The dates', family: 'conference', becomes: 'The conference dates, written out.' },
  session_code: { emoji: 'Key', glyph: '🔑', icon: KeyRound, short: 'Session code', family: 'conference', becomes: 'The six-character code for their committee room.' },
  award: { emoji: 'Trophy', glyph: '🏆', icon: Trophy, short: 'Their award', family: 'conference', becomes: 'The award they received, such as Best Delegate.' },
  request_subject: { emoji: 'Envelope', glyph: '✉️', icon: Mail, short: 'Their subject', family: 'thread', becomes: 'The subject line of the message you are replying to.' },
  request_body: { emoji: 'Speech balloon', glyph: '💬', icon: MessageSquare, short: 'Their message', family: 'thread', becomes: 'The message you are replying to, quoted back.' },
  draft_link: { emoji: 'Link', glyph: '🔗', icon: Link2, short: 'Draft link', family: 'link', becomes: 'A private link back to their unfinished application.' },
  draft_stop_link: { emoji: 'Stop sign', glyph: '🛑', icon: Ban, short: 'Stop link', family: 'link', becomes: 'A one-click way for them to turn these reminders off.' },
};

export const TOKEN_FAMILY_LABEL: Record<TokenFamily, string> = {
  person: 'The person',
  place: 'Where they sit',
  money: 'Money',
  conference: 'This conference',
  thread: 'The message you are answering',
  link: 'Private links',
};

export const TOKEN_FAMILY_ORDER: TokenFamily[] = ['person', 'place', 'money', 'conference', 'thread', 'link'];

/** Never throws on an unknown key: an old template can carry a token this
 *  build does not know about, and it still has to render as something. */
export function tokenIdentity(key: string): TokenIdentity {
  return TOKEN_IDENTITY[key as EmailTokenKey] ?? {
    emoji: 'Label',
    glyph: '🏷️',
    icon: BadgeCheck,
    short: key,
    family: 'person',
    becomes: 'A value filled in for each person.',
  };
}

export function tokenLabel(key: string): string {
  return EMAIL_TOKEN_LABELS[key as EmailTokenKey] ?? key;
}

/** The pill's own text: short name where we have one, long label otherwise. */
export function tokenShort(key: string): string {
  return TOKEN_IDENTITY[key as EmailTokenKey]?.short ?? tokenLabel(key);
}

// ── In-context suggestion matching ───────────────────────────────────────────
// Typing "{{" opens the list; the letters after it filter it. Matching is
// against the key, the long label and the short name, so "name", "delegate"
// and "their" all find {{delegate_name}}.

export interface TokenMatch { key: EmailTokenKey; score: number }

export function matchTokens(query: string, keys: readonly EmailTokenKey[]): EmailTokenKey[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...keys];
  const scored: TokenMatch[] = [];
  for (const key of keys) {
    const id = TOKEN_IDENTITY[key];
    const haystacks = [key.replace(/_/g, ' '), tokenLabel(key), id?.short ?? ''].map(s => s.toLowerCase());
    let best = -1;
    for (const h of haystacks) {
      if (h.startsWith(q)) { best = Math.max(best, 2); continue; }
      if (h.includes(q)) best = Math.max(best, 1);
    }
    if (best >= 0) scored.push({ key, score: best });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.map(s => s.key);
}
