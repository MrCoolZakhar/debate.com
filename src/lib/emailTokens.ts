// Shared token resolver for the email template system (communications page).
// Used both to render a live preview against a real applicant and to resolve
// the final subject/body written into email_outbox rows at send time.

export const EMAIL_TOKEN_KEYS = [
  'delegate_name',
  'role',
  'delegation_name',
  'committee',
  'country',
  'payment_status',
  'conference_name',
  'conference_dates',
  'fee',
] as const;

export type EmailTokenKey = (typeof EMAIL_TOKEN_KEYS)[number];

export const EMAIL_TOKEN_LABELS: Record<EmailTokenKey, string> = {
  delegate_name: 'Delegate Name',
  role: 'Role',
  delegation_name: 'Delegation',
  committee: 'Committee',
  country: 'Allocation Country',
  payment_status: 'Payment Status',
  conference_name: 'Conference Name',
  conference_dates: 'Conference Dates',
  fee: 'Fee',
};

export type EmailTokenContext = Partial<Record<EmailTokenKey, string | null>>;

const TOKEN_PATTERN = /\{\{(\w+)\}\}/g;
export const UNRESOLVED_MARKER_PATTERN = /⚠(\w+)⚠/g;

/**
 * Replaces {{token}} placeholders with values from ctx. A token with no
 * value (missing key, null, or empty string) is left as ⚠token⚠ so it reads
 * clearly as unresolved wherever the string ends up — in a preview render or
 * in a queued outbox row.
 */
export function resolveTokens(template: string, ctx: EmailTokenContext): string {
  return template.replace(TOKEN_PATTERN, (match, rawKey: string) => {
    const value = ctx[rawKey as EmailTokenKey];
    if (value === null || value === undefined || value === '') {
      return `⚠${rawKey}⚠`;
    }
    return value;
  });
}

/** Splits resolved text into plain / unresolved-marker segments for highlighted rendering. */
export function splitResolvedText(resolved: string): { text: string; unresolved: boolean }[] {
  const segments: { text: string; unresolved: boolean }[] = [];
  let lastIndex = 0;
  const re = new RegExp(UNRESOLVED_MARKER_PATTERN);
  let m: RegExpExecArray | null;
  while ((m = re.exec(resolved))) {
    if (m.index > lastIndex) segments.push({ text: resolved.slice(lastIndex, m.index), unresolved: false });
    segments.push({ text: m[0], unresolved: true });
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < resolved.length) segments.push({ text: resolved.slice(lastIndex), unresolved: false });
  return segments;
}
