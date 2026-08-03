/**
 * Registered company details for Gavelling.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *  ⚠️  THESE MUST ONLY EVER BE FILLED IN WITH *VERIFIED* COMPANIES HOUSE VALUES.
 *
 *  Do NOT guess, approximate, or place a "close enough" value here. A registered
 *  company name, company number, registered office address or VAT number shown
 *  on a public website is a legal statement — publishing an incorrect one is
 *  worse than publishing none at all.
 *
 *  Look each value up on the official register before entering it:
 *    Companies House  →  https://find-and-update.company-information.service.gov.uk/
 *    VAT number       →  https://www.gov.uk/check-uk-vat-number
 *
 *  Every field below is intentionally `null`. The footer renders each line ONLY
 *  when its value is non-null, so nothing fake or half-filled can ever ship.
 *  Fill them in (or leave them null) — never invent them.
 * ─────────────────────────────────────────────────────────────────────────────
 */
// Verified 2 Aug 2026 against the official register:
// https://find-and-update.company-information.service.gov.uk/company/17337652
// Sole match on the register for "Gavelling" (advanced search, incl. dissolved).
// Active · private limited company · incorporated 13 July 2026 · SIC 82302
// (activities of conference organisers).
export const COMPANY = {
  /** Registered company name exactly as it appears on Companies House, e.g. 'GAVELLING LTD'. */
  name: 'GAVELLING LTD' as string | null,
  /** Companies House registration number, e.g. '12345678'. */
  number: '17337652' as string | null,
  /** Registered office address, single line, e.g. '1 Example St, London, EC1A 1AA'. */
  address: 'Flat 33 Doughty Court, Prusom Street, London, England, E1W 3RT' as string | null,
  /**
   * VAT registration number, e.g. 'GB123456789'. Leave null if not VAT registered.
   * Deliberately null: no VAT number could be verified (Companies House does not
   * publish them and none is stated anywhere official). Never fill this in from
   * memory — check https://www.gov.uk/check-uk-vat-number first.
   */
  vat: null as string | null,
};

/** Where the company is registered — required alongside the number on UK
 *  business websites (Companies (Trading Disclosures) Regulations). */
export const PLACE_OF_REGISTRATION = 'Registered in England & Wales';

/** Public-facing trading name. Safe to show — it is not a registered-entity claim. */
export const TRADING_NAME = 'Gavelling';

/**
 * Builds the company detail lines to render in a footer.
 * Returns an empty array while the values above are unverified/null, so callers
 * can simply skip the block: `const lines = companyLegalLines(); if (!lines.length) ...`
 */
export function companyLegalLines(): string[] {
  const lines: string[] = [];

  const registered = [
    COMPANY.name,
    // Place of registration must accompany the number, not just the number.
    COMPANY.number ? `${PLACE_OF_REGISTRATION} no. ${COMPANY.number}` : null,
  ].filter(Boolean).join(' · ');
  if (registered) lines.push(registered);

  if (COMPANY.address) lines.push(`Registered office: ${COMPANY.address}`);
  if (COMPANY.vat) lines.push(`VAT No. ${COMPANY.vat}`);

  return lines;
}

/** True once at least one verified company detail has been filled in above. */
export const HAS_COMPANY_DETAILS = companyLegalLines().length > 0;
