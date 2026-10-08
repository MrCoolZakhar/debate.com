// moneyDocument.ts — the one shape of an invoice or receipt (prompt 98).
//
// get_money_document answers { document, issuer, conference }; toMoneyDoc()
// turns that into a MoneyDoc, which both MoneyDocumentView (the preview on
// screen) and MoneyDocumentPdf (the PDF) draw. Both read ONLY this shape and
// the helpers below, so the preview and the PDF can never disagree.
//
// Lines and every amount are a snapshot of the ledger made by the server; the
// client never computes or edits money here. It only formats it.

export type MoneyDocKind = 'receipt' | 'invoice';

export interface MoneyDocLine { date: string | null; label: string; amount_cents: number; paid_cents?: number | null }

export interface BilledTo {
  institution?: string | null; address?: string | null; phone?: string | null;
  tax_number?: string | null; attn?: string | null; email?: string | null;
}

export interface Editable {
  title?: string | null; intro?: string | null; receipt_paragraph?: string | null;
  tax_note?: string | null; tax_line?: string | null; footer?: string | null; notes?: string | null;
}

export const EDITABLE_KEYS = ['title', 'intro', 'receipt_paragraph', 'tax_note', 'tax_line', 'footer', 'notes'] as const;
export const BILLED_KEYS = ['institution', 'address', 'phone', 'tax_number', 'attn', 'email'] as const;

export interface Issuer {
  legal_name: string; address: string; website?: string | null; tax_id?: string | null;
  number_prefix?: string | null; tax_note?: string | null; accent_color?: string | null;
}

export interface DocConference {
  full_name: string | null; acronym: string | null; logo_url: string | null; website?: string | null;
  email_theme?: { accentColor?: string; buttonColor?: string } | null;
}

export interface MoneyDoc {
  id: string;
  kind: MoneyDocKind;
  number: string;
  created_at: string;
  currency: string;
  lines: MoneyDocLine[];
  subtotal_cents: number;
  paid_cents: number;
  balance_cents: number;
  payment_date: string | null;
  payment_method: string | null;
  billed_to: BilledTo;
  editable: Editable;
  sent_to_payer_at: string | null;
  payer_user_id: string | null;
  application_id: string | null;
  issuer: Issuer;
  conference: DocConference;
}

/** get_money_document's answer, made safe to draw. */
export function toMoneyDoc(a: Record<string, unknown>): MoneyDoc {
  const d = (a.document ?? {}) as Record<string, unknown>;
  const issuer = (a.issuer ?? {}) as Partial<Issuer>;
  const conf = (a.conference ?? {}) as Partial<DocConference>;
  return {
    id: String(d.id ?? ''),
    kind: d.kind === 'invoice' ? 'invoice' : 'receipt',
    number: String(d.number ?? ''),
    created_at: String(d.created_at ?? new Date().toISOString()),
    currency: String(d.currency ?? 'USD').toUpperCase(),
    lines: Array.isArray(d.lines) ? (d.lines as MoneyDocLine[]) : [],
    subtotal_cents: Number(d.subtotal_cents ?? 0),
    paid_cents: Number(d.paid_cents ?? 0),
    balance_cents: Number(d.balance_cents ?? 0),
    payment_date: (d.payment_date as string | null) ?? null,
    payment_method: (d.payment_method as string | null) ?? null,
    billed_to: (d.billed_to as BilledTo) ?? {},
    editable: (d.editable as Editable) ?? {},
    sent_to_payer_at: (d.sent_to_payer_at as string | null) ?? null,
    payer_user_id: (d.payer_user_id as string | null) ?? null,
    application_id: (d.application_id as string | null) ?? null,
    issuer: {
      legal_name: issuer.legal_name ?? '', address: issuer.address ?? '', website: issuer.website ?? null,
      tax_id: issuer.tax_id ?? null, number_prefix: issuer.number_prefix ?? null, tax_note: issuer.tax_note ?? null,
      accent_color: issuer.accent_color ?? null,
    },
    conference: {
      full_name: conf.full_name ?? null, acronym: conf.acronym ?? null, logo_url: conf.logo_url ?? null,
      website: conf.website ?? null, email_theme: conf.email_theme ?? null,
    },
  };
}

export const DOC_FOREST = '#1B3828';
export const DOC_INK = '#1C1410';
export const DOC_SOFT = '#5A5046';
export const DOC_RULE = '#E4DED2';
export const DOC_TINT = '#F7F4EE';

/** The issuer's colour, or Gavelling forest. */
export function accentOf(doc: Pick<MoneyDoc, 'issuer'>): string {
  const c = doc.issuer.accent_color;
  return c && /^#[0-9a-f]{6}$/i.test(c) ? c : DOC_FOREST;
}

function luminance(hex: string): number {
  const ch = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

/** The accent when it reads on white (4.5:1), else ink: a pale gold never becomes unreadable text. */
export function accentText(accent: string): string {
  const ratio = 1.05 / (luminance(accent) + 0.05);
  return ratio >= 4.5 ? accent : DOC_INK;
}

/** "USD 1,200.00": an invoice always states the code and two decimals. */
export function docMoney(cents: number, currency: string): string {
  const v = Math.abs(cents || 0) / 100;
  const n = v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${cents < 0 ? '−' : ''}${(currency || 'USD').toUpperCase()} ${n}`;
}

export function docDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function docShortDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function docTitle(doc: Pick<MoneyDoc, 'kind' | 'editable'>): string {
  const t = doc.editable.title?.trim();
  return t || (doc.kind === 'receipt' ? 'Invoice and Official Receipt' : 'Invoice');
}

export function paidInFull(doc: Pick<MoneyDoc, 'kind' | 'balance_cents' | 'paid_cents'>): boolean {
  return doc.kind === 'receipt' && doc.balance_cents === 0 && doc.paid_cents > 0;
}

/** The issuer's name for the header: the legal name, else the conference. */
export function issuerName(doc: MoneyDoc): string {
  return doc.issuer.legal_name || doc.conference.full_name || doc.conference.acronym || '';
}

/** The "Billed to" lines, in order, without empties. */
export function billedLines(b: BilledTo): { strong: string | null; rest: string[] } {
  const strong = b.institution?.trim() || b.attn?.trim() || null;
  const rest: string[] = [];
  if (b.institution?.trim() && b.attn?.trim()) rest.push(`Attn: ${b.attn.trim()}`);
  if (b.address?.trim()) rest.push(...b.address.trim().split(/\n+/));
  if (b.phone?.trim()) rest.push(b.phone.trim());
  if (b.email?.trim()) rest.push(b.email.trim());
  if (b.tax_number?.trim()) rest.push(`Tax number: ${b.tax_number.trim()}`);
  return { strong, rest };
}

/** The details block beside "Billed to". */
export function detailRows(doc: MoneyDoc): [string, string][] {
  const rows: [string, string][] = [
    [doc.kind === 'receipt' ? 'Receipt number' : 'Invoice number', doc.number],
    ['Date issued', docDate(doc.created_at)],
  ];
  if (doc.kind === 'receipt' && doc.payment_date) rows.push(['Payment date', docDate(doc.payment_date)]);
  if (doc.kind === 'receipt' && doc.payment_method) rows.push(['Paid by', doc.payment_method]);
  const conf = doc.conference.full_name || doc.conference.acronym;
  if (conf) rows.push(['Conference', conf]);
  rows.push(['Currency', doc.currency]);
  return rows;
}

/** The totals under the table. The tax row reads the tax line, or "None". */
export function totalRows(doc: MoneyDoc): { label: string; value: string; strong?: boolean }[] {
  const rows: { label: string; value: string; strong?: boolean }[] = [
    { label: 'Subtotal', value: docMoney(doc.subtotal_cents, doc.currency) },
    { label: 'Tax', value: doc.editable.tax_line?.trim() || 'None' },
    { label: 'Amount paid', value: docMoney(doc.paid_cents, doc.currency) },
    { label: 'Balance due', value: docMoney(doc.balance_cents, doc.currency), strong: true },
  ];
  return rows;
}

/** A believable sample for the Invoice Details preview, before any real document exists. */
export function sampleDoc(issuer: Issuer, conference: DocConference): MoneyDoc {
  const year = new Date().getFullYear();
  const prefix = (issuer.number_prefix || 'CONF').toUpperCase();
  const now = new Date().toISOString();
  return {
    id: 'sample', kind: 'receipt', number: `${prefix}-${year}-RCT-0001`, created_at: now, currency: 'USD',
    lines: [
      { date: now, label: 'Delegate ticket', amount_cents: 12000 },
      { date: now, label: 'Registration fee', amount_cents: 2500 },
    ],
    subtotal_cents: 14500, paid_cents: 14500, balance_cents: 0, payment_date: now, payment_method: 'Card',
    billed_to: { institution: 'Example High School', attn: 'Alex Morgan', address: '12 Example Street\nSpringfield', email: 'alex@example.org' },
    editable: {
      title: 'Invoice and Official Receipt',
      receipt_paragraph: 'Received from Example High School the sum of USD 145.00 by card.',
      tax_note: issuer.tax_note, footer: 'This document serves as both an invoice and an official receipt.',
    },
    sent_to_payer_at: null, payer_user_id: null, application_id: null, issuer, conference,
  };
}

/** The file name a download gets: "WM-2026-RCT-0001.pdf". */
export function docFileName(doc: Pick<MoneyDoc, 'number' | 'kind'>): string {
  const safe = (doc.number || doc.kind).replace(/[^A-Za-z0-9._-]+/g, '-');
  return `${safe}.pdf`;
}
