'use client';

// MoneyDocumentView — an invoice or receipt drawn on screen (prompt 98), the
// preview in the editor, the Invoice Details pop-up and /pay. It is the same
// layout as MoneyDocumentPdf, from the same MoneyDoc and the same helpers in
// moneyDocument.ts. Every size is in "design pixels" of an A4 page 794 wide
// and scales with the width it is given (container query units), so a narrow
// preview is the PDF made smaller, not a different layout.

import {
  DOC_INK, DOC_RULE, DOC_SOFT, DOC_TINT, accentOf, accentText, billedLines, detailRows, docDate, docMoney,
  docShortDate, docTitle, issuerName, paidInFull, totalRows, type MoneyDoc,
} from './moneyDocument';

/** A design pixel of the 794-wide page, as a CSS length. */
const u = (px: number) => `calc(${px} * 100cqw / 794)`;

export default function MoneyDocumentView({ doc, className, style }: { doc: MoneyDoc; className?: string; style?: React.CSSProperties }) {
  const accent = accentOf(doc);
  const ink = accentText(accent);
  const billed = billedLines(doc.billed_to);
  const invoice = doc.kind === 'invoice';
  const logo = doc.conference.logo_url;
  const name = issuerName(doc);
  const ed = doc.editable;

  return (
    <div className={className} style={{ containerType: 'inline-size', width: '100%', ...style }}>
      <article
        aria-label={`${docTitle(doc)} ${doc.number}`}
        style={{
          position: 'relative', background: '#FFFFFF', color: DOC_INK, minHeight: u(1123), display: 'flex', flexDirection: 'column',
          fontFamily: 'var(--font-brand), Inter, sans-serif', fontSize: u(11.5), lineHeight: 1.5,
          boxShadow: '0 1px 2px rgba(27,56,40,0.08), 0 24px 48px -28px rgba(27,56,40,0.45)', borderRadius: u(4), overflow: 'hidden',
        }}
      >
        <div style={{ height: u(8), background: accent }} aria-hidden />
        <div style={{ padding: `${u(40)} ${u(56)} ${u(28)}`, display: 'flex', flexDirection: 'column', flex: 1 }}>
          {/* Issuer and title */}
          <header style={{ display: 'flex', justifyContent: 'space-between', gap: u(24), alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', gap: u(14), alignItems: 'flex-start', minWidth: 0, flex: '1 1 0' }}>
              {logo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo} alt="" style={{ width: u(56), height: u(56), objectFit: 'contain', borderRadius: u(8), flexShrink: 0 }} />
              )}
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: u(15), fontWeight: 800, lineHeight: 1.25, overflowWrap: 'anywhere' }}>{name}</p>
                {doc.issuer.address && doc.issuer.address.split(/\n+/).map((l, i) => (
                  <p key={i} style={{ margin: 0, color: DOC_SOFT, overflowWrap: 'anywhere' }}>{l}</p>
                ))}
                {doc.issuer.website && <p style={{ margin: 0, color: DOC_SOFT, overflowWrap: 'anywhere' }}>{doc.issuer.website}</p>}
                {doc.issuer.tax_id && <p style={{ margin: 0, color: DOC_SOFT }}>Tax ID: {doc.issuer.tax_id}</p>}
              </div>
            </div>
            <div style={{ textAlign: 'right', flex: '0 1 auto', maxWidth: '48%' }}>
              <p style={{ margin: 0, fontSize: u(24), fontWeight: 800, letterSpacing: '-0.01em', lineHeight: 1.15, color: ink, overflowWrap: 'anywhere' }}>{docTitle(doc)}</p>
              <p style={{ margin: `${u(6)} 0 0`, fontSize: u(12.5), fontWeight: 700 }}>{doc.number}</p>
              <p style={{ margin: 0, color: DOC_SOFT }}>{docDate(doc.created_at)}</p>
            </div>
          </header>

          {/* Billed to and details */}
          <section style={{ display: 'flex', gap: u(32), marginTop: u(34), paddingTop: u(22), borderTop: `${u(1)} solid ${DOC_RULE}` }}>
            <div style={{ flex: '1 1 0', minWidth: 0 }}>
              <Label>Billed to</Label>
              {billed.strong && <p style={{ margin: 0, fontSize: u(13), fontWeight: 700, overflowWrap: 'anywhere' }}>{billed.strong}</p>}
              {billed.rest.map((l, i) => <p key={i} style={{ margin: 0, color: DOC_SOFT, overflowWrap: 'anywhere' }}>{l}</p>)}
            </div>
            <div style={{ flex: '1 1 0', minWidth: 0 }}>
              <Label>{invoice ? 'Invoice details' : 'Receipt details'}</Label>
              {detailRows(doc).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', gap: u(12), justifyContent: 'space-between' }}>
                  <span style={{ color: DOC_SOFT }}>{k}</span>
                  <span style={{ fontWeight: 600, textAlign: 'right', overflowWrap: 'anywhere' }}>{v}</span>
                </div>
              ))}
            </div>
          </section>

          {ed.intro?.trim() && <p style={{ margin: `${u(26)} 0 0`, fontSize: u(12), whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{ed.intro.trim()}</p>}

          {/* Lines */}
          <div role="table" aria-label="Items" style={{ marginTop: u(26) }}>
            <div role="row" style={{ display: 'flex', gap: u(12), padding: `${u(8)} ${u(12)}`, background: DOC_TINT, borderRadius: u(4), fontSize: u(9.5), fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: DOC_SOFT }}>
              <span role="columnheader" style={{ width: u(96), flexShrink: 0 }}>Date</span>
              <span role="columnheader" style={{ flex: 1 }}>Description</span>
              {invoice && <span role="columnheader" style={{ width: u(110), textAlign: 'right', flexShrink: 0 }}>Paid</span>}
              <span role="columnheader" style={{ width: u(120), textAlign: 'right', flexShrink: 0 }}>Amount</span>
            </div>
            {doc.lines.map((l, i) => (
              <div key={i} role="row" style={{ display: 'flex', gap: u(12), padding: `${u(9)} ${u(12)}`, borderBottom: `${u(1)} solid ${DOC_RULE}` }}>
                <span role="cell" style={{ width: u(96), flexShrink: 0, color: DOC_SOFT }}>{docShortDate(l.date)}</span>
                <span role="cell" style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{l.label}</span>
                {invoice && <span role="cell" style={{ width: u(110), textAlign: 'right', flexShrink: 0, fontVariantNumeric: 'tabular-nums', color: DOC_SOFT }}>{docMoney(l.paid_cents ?? 0, doc.currency)}</span>}
                <span role="cell" style={{ width: u(120), textAlign: 'right', flexShrink: 0, fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{docMoney(l.amount_cents, doc.currency)}</span>
              </div>
            ))}
          </div>

          {/* Stamp and totals */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: u(24), marginTop: u(18) }}>
            <div style={{ flex: '1 1 0', display: 'flex', justifyContent: 'center' }}>
              {paidInFull(doc) && (
                <div aria-label="Paid in full" style={{ transform: 'rotate(-8deg)', border: `${u(2.5)} solid ${ink}`, borderRadius: u(6), padding: `${u(8)} ${u(16)}`, color: ink, textAlign: 'center', opacity: 0.88 }}>
                  <p style={{ margin: 0, fontSize: u(18), fontWeight: 800, letterSpacing: '0.12em', lineHeight: 1.2 }}>PAID IN FULL</p>
                  {doc.payment_date && <p style={{ margin: `${u(3)} 0 0`, fontSize: u(9.5), fontWeight: 600, letterSpacing: '0.04em', lineHeight: 1.3 }}>{docDate(doc.payment_date)}</p>}
                </div>
              )}
            </div>
            <div style={{ width: u(300), flexShrink: 0 }}>
              {totalRows(doc).map(r => (
                <div key={r.label} style={{
                  display: 'flex', justifyContent: 'space-between', gap: u(12), padding: `${u(5)} 0`,
                  ...(r.strong ? { borderTop: `${u(1.5)} solid ${accent}`, marginTop: u(4), paddingTop: u(9), fontSize: u(13.5), fontWeight: 800 } : {}),
                }}>
                  <span style={{ color: r.strong ? DOC_INK : DOC_SOFT }}>{r.label}</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: r.strong ? 800 : 600, textAlign: 'right', overflowWrap: 'anywhere', color: r.strong ? ink : DOC_INK }}>{r.value}</span>
                </div>
              ))}
            </div>
          </div>

          {ed.receipt_paragraph?.trim() && (
            <p style={{ margin: `${u(26)} 0 0`, padding: `${u(12)} ${u(16)}`, background: DOC_TINT, borderLeft: `${u(3)} solid ${accent}`, fontSize: u(12), whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
              {ed.receipt_paragraph.trim()}
            </p>
          )}
          {ed.notes?.trim() && (
            <div style={{ marginTop: u(20) }}>
              <Label>Notes</Label>
              <p style={{ margin: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{ed.notes.trim()}</p>
            </div>
          )}
          {ed.tax_note?.trim() && <p style={{ margin: `${u(18)} 0 0`, fontSize: u(10.5), color: DOC_SOFT, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{ed.tax_note.trim()}</p>}

          <footer style={{ marginTop: 'auto', paddingTop: u(28) }}>
            <div style={{ borderTop: `${u(1)} solid ${DOC_RULE}`, paddingTop: u(12), textAlign: 'center', fontSize: u(10), color: DOC_SOFT }}>
              {ed.footer?.trim() && <p style={{ margin: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{ed.footer.trim()}</p>}
              <p style={{ margin: 0 }}>{[name, doc.issuer.website].filter(Boolean).join(' · ')}</p>
            </div>
          </footer>
        </div>
      </article>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <p style={{ margin: `0 0 ${u(6)}`, fontSize: u(9.5), fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: DOC_SOFT }}>{children}</p>;
}
