// A special fee is never hidden (owner, 12 Nov 2026): wherever a person sees a
// ticket at a special price, it is named "Special {ticket name}" with an i that
// says the normal fee and why. One sentence, built here; the amounts go through
// the caller's own money formatter. The shape is what the database returns
// from special_fee_quote, special_fee_reason and special_fee_items.

export type SpecialFeeReasonData =
  | { kind: 'answer'; question?: string | null; answer?: string | null }
  | { kind: 'level'; answer?: string | null }
  | { kind: 'committee'; answer?: string | null }
  | { kind: 'delegation'; answer?: string | null }
  | { kind: 'person' };

export interface SpecialFeeInfo {
  normal: number;
  special: number | null;
  currency: string;
  reason: SpecialFeeReasonData | null;
}

/** The ticket name the server gives invoices (the database's _not_charged_info). */
export function ticketNameFor(role: string): string {
  switch (role) {
    case 'delegate':
    case 'head-delegate': return 'Delegate Ticket';
    case 'faculty-advisor': return 'Advisor Ticket';
    case 'chair': return 'Chair Ticket';
    case 'observer': return 'Observer Ticket';
    case 'secretariat': return 'Secretariat Ticket';
    case 'staff': return 'Staff Ticket';
    default: return 'Ticket';
  }
}

const LEVEL_WORD: Record<string, string> = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced', expert: 'Expert' };

/** "The normal fee for X is Y. Your organiser set Z for ...". */
export function specialFeeSentence(info: SpecialFeeInfo, conferenceName: string, money: (amount: number, currency: string) => string): string {
  const conf = conferenceName || 'this conference';
  const normal = money(info.normal, info.currency);
  const special = money(info.special ?? info.normal, info.currency);
  const start = `The normal fee for ${conf} is ${normal}. Your organiser set ${special}`;
  const r = info.reason;
  if (!r || r.kind === 'person') return `${start} for you.`;
  if (r.kind === 'answer') return `${start} for applicants who answer “${r.answer ?? ''}” to “${r.question ?? ''}”.`;
  if (r.kind === 'level') return `${start} for applicants whose MUN level is ${LEVEL_WORD[r.answer ?? ''] ?? r.answer ?? ''}.`;
  if (r.kind === 'committee') return `${start} for applicants who pick ${r.answer ?? 'a committee'} as a committee preference.`;
  return `${start} for members of ${r.answer ?? 'your delegation'}.`;
}

/** Reads one answer object from the database into SpecialFeeInfo (amounts in major units). */
export function toSpecialFeeInfo(raw: unknown): SpecialFeeInfo | null {
  const r = (raw ?? null) as { normal?: unknown; special?: unknown; currency?: unknown; reason?: unknown } | null;
  if (!r) return null;
  const normal = Number(r.normal ?? 0);
  const special = r.special === null || r.special === undefined ? null : Number(r.special);
  return {
    normal: Number.isFinite(normal) ? normal : 0,
    special: special !== null && Number.isFinite(special) ? special : null,
    currency: typeof r.currency === 'string' ? r.currency : 'USD',
    reason: (r.reason ?? null) as SpecialFeeReasonData | null,
  };
}
