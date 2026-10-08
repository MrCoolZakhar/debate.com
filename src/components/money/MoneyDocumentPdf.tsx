// MoneyDocumentPdf — the same invoice or receipt as MoneyDocumentView, as a
// PDF (prompt 98), drawn by @react-pdf/renderer in the browser. NEVER import
// this file statically: downloadMoneyDocument.ts loads it with a dynamic
// import when someone presses Download, so the renderer never weighs down a
// page. Sizes are the view's design pixels (an A4 page 794 wide) times 0.75,
// which is the same page in PDF points (595 wide).

import { Document, Font, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import {
  DOC_INK, DOC_RULE, DOC_SOFT, DOC_TINT, accentOf, accentText, billedLines, detailRows, docDate, docMoney,
  docShortDate, docTitle, issuerName, paidInFull, totalRows, type MoneyDoc,
} from './moneyDocument';

const p = (px: number) => px * 0.75;

let fontsReady = false;
function registerFonts() {
  if (fontsReady || typeof window === 'undefined') return;
  const base = `${window.location.origin}/fonts/money-docs`;
  // Two families: the Latin face first, then Latin Extended for names such as Türkiye or Łódź.
  Font.register({ family: 'Inter', fonts: [
    { src: `${base}/Inter-Regular.ttf`, fontWeight: 400 },
    { src: `${base}/Inter-Bold.ttf`, fontWeight: 700 },
    { src: `${base}/Inter-ExtraBold.ttf`, fontWeight: 800 },
  ] });
  Font.register({ family: 'InterExt', fonts: [
    { src: `${base}/Inter-Regular-LatinExt.ttf`, fontWeight: 400 },
    { src: `${base}/Inter-Bold-LatinExt.ttf`, fontWeight: 700 },
    { src: `${base}/Inter-ExtraBold-LatinExt.ttf`, fontWeight: 800 },
  ] });
  // Long words (emails, links) break anywhere rather than hyphenating.
  Font.registerHyphenationCallback(word => (word.length > 18 ? word.split('') : [word]));
  fontsReady = true;
}

const FONT = ['Inter', 'InterExt'];

const s = StyleSheet.create({
  page: { fontFamily: FONT, fontSize: p(11.5), lineHeight: 1.5, color: DOC_INK, paddingBottom: p(80) },
  body: { paddingTop: p(40), paddingHorizontal: p(56) },
  soft: { color: DOC_SOFT },
  label: { fontSize: p(9.5), fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: DOC_SOFT, marginBottom: p(6) },
  row: { flexDirection: 'row' },
});

/** `logoSrc` is the conference logo already turned into a PNG data URL (or null). */
export default function MoneyDocumentPdf({ doc, logoSrc }: { doc: MoneyDoc; logoSrc: string | null }) {
  registerFonts();
  const accent = accentOf(doc);
  const ink = accentText(accent);
  const billed = billedLines(doc.billed_to);
  const invoice = doc.kind === 'invoice';
  const name = issuerName(doc);
  const ed = doc.editable;

  return (
    <Document title={`${docTitle(doc)} ${doc.number}`} author={name} creator="Gavelling" producer="Gavelling">
      <Page size="A4" style={s.page}>
        <View fixed style={{ height: p(8), backgroundColor: accent }} />
        <View style={s.body}>
          {/* Issuer and title */}
          <View style={[s.row, { justifyContent: 'space-between', alignItems: 'flex-start' }]}>
            <View style={[s.row, { flex: 1, paddingRight: p(24) }]}>
              {logoSrc && (
                // eslint-disable-next-line jsx-a11y/alt-text
                <Image src={logoSrc} style={{ width: p(56), height: p(56), objectFit: 'contain', marginRight: p(14), borderRadius: p(8) }} />
              )}
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: p(15), fontWeight: 800, lineHeight: 1.25 }}>{name}</Text>
                {doc.issuer.address && doc.issuer.address.split(/\n+/).map((l, i) => <Text key={i} style={s.soft}>{l}</Text>)}
                {doc.issuer.website ? <Text style={s.soft}>{doc.issuer.website}</Text> : null}
                {doc.issuer.tax_id ? <Text style={s.soft}>Tax ID: {doc.issuer.tax_id}</Text> : null}
              </View>
            </View>
            <View style={{ maxWidth: '48%', alignItems: 'flex-end' }}>
              <Text style={{ fontSize: p(24), fontWeight: 800, lineHeight: 1.15, color: ink, textAlign: 'right' }}>{docTitle(doc)}</Text>
              <Text style={{ fontSize: p(12.5), fontWeight: 700, marginTop: p(6) }}>{doc.number}</Text>
              <Text style={s.soft}>{docDate(doc.created_at)}</Text>
            </View>
          </View>

          {/* Billed to and details */}
          <View style={[s.row, { marginTop: p(34), paddingTop: p(22), borderTopWidth: p(1), borderTopColor: DOC_RULE }]}>
            <View style={{ flex: 1, paddingRight: p(32) }}>
              <Text style={s.label}>Billed to</Text>
              {billed.strong ? <Text style={{ fontSize: p(13), fontWeight: 700 }}>{billed.strong}</Text> : null}
              {billed.rest.map((l, i) => <Text key={i} style={s.soft}>{l}</Text>)}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>{invoice ? 'Invoice details' : 'Receipt details'}</Text>
              {detailRows(doc).map(([k, v]) => (
                <View key={k} style={[s.row, { justifyContent: 'space-between' }]}>
                  <Text style={[s.soft, { paddingRight: p(12) }]}>{k}</Text>
                  <Text style={{ fontWeight: 700, textAlign: 'right', flexShrink: 1 }}>{v}</Text>
                </View>
              ))}
            </View>
          </View>

          {ed.intro?.trim() ? <Text style={{ marginTop: p(26), fontSize: p(12) }}>{ed.intro.trim()}</Text> : null}

          {/* Lines */}
          <View style={{ marginTop: p(26) }}>
            <View style={[s.row, { paddingVertical: p(8), paddingHorizontal: p(12), backgroundColor: DOC_TINT, borderRadius: p(4) }]}>
              <Text style={[s.label, { marginBottom: 0, width: p(96) }]}>Date</Text>
              <Text style={[s.label, { marginBottom: 0, flex: 1 }]}>Description</Text>
              {invoice && <Text style={[s.label, { marginBottom: 0, width: p(110), textAlign: 'right' }]}>Paid</Text>}
              <Text style={[s.label, { marginBottom: 0, width: p(120), textAlign: 'right' }]}>Amount</Text>
            </View>
            {doc.lines.map((l, i) => (
              <View key={i} wrap={false} style={[s.row, { paddingVertical: p(9), paddingHorizontal: p(12), borderBottomWidth: p(1), borderBottomColor: DOC_RULE }]}>
                <Text style={[s.soft, { width: p(96) }]}>{docShortDate(l.date)}</Text>
                <Text style={{ flex: 1, paddingRight: p(12) }}>{l.label}</Text>
                {invoice && <Text style={[s.soft, { width: p(110), textAlign: 'right' }]}>{docMoney(l.paid_cents ?? 0, doc.currency)}</Text>}
                <Text style={{ width: p(120), textAlign: 'right', fontWeight: 700 }}>{docMoney(l.amount_cents, doc.currency)}</Text>
              </View>
            ))}
          </View>

          {/* Stamp and totals */}
          <View wrap={false} style={[s.row, { alignItems: 'center', marginTop: p(18) }]}>
            <View style={{ flex: 1, alignItems: 'center' }}>
              {paidInFull(doc) && (
                <View style={{ transform: 'rotate(-8deg)', borderWidth: p(2.5), borderColor: ink, borderRadius: p(6), paddingVertical: p(8), paddingHorizontal: p(16), alignItems: 'center', opacity: 0.88 }}>
                  <Text style={{ fontSize: p(18), fontWeight: 800, letterSpacing: 2, lineHeight: 1.2, color: ink }}>PAID IN FULL</Text>
                  {doc.payment_date ? <Text style={{ fontSize: p(9.5), fontWeight: 700, lineHeight: 1.3, marginTop: p(3), color: ink }}>{docDate(doc.payment_date)}</Text> : null}
                </View>
              )}
            </View>
            <View style={{ width: p(300) }}>
              {totalRows(doc).map(r => (
                <View key={r.label} style={[s.row, { justifyContent: 'space-between', paddingVertical: p(5) },
                  r.strong ? { borderTopWidth: p(1.5), borderTopColor: accent, marginTop: p(4), paddingTop: p(9) } : {}]}>
                  <Text style={r.strong ? { fontSize: p(13.5), fontWeight: 800 } : s.soft}>{r.label}</Text>
                  <Text style={r.strong ? { fontSize: p(13.5), fontWeight: 800, color: ink } : { fontWeight: 700 }}>{r.value}</Text>
                </View>
              ))}
            </View>
          </View>

          {ed.receipt_paragraph?.trim() ? (
            <View wrap={false} style={{ marginTop: p(26), paddingVertical: p(12), paddingHorizontal: p(16), backgroundColor: DOC_TINT, borderLeftWidth: p(3), borderLeftColor: accent }}>
              <Text style={{ fontSize: p(12) }}>{ed.receipt_paragraph.trim()}</Text>
            </View>
          ) : null}
          {ed.notes?.trim() ? (
            <View style={{ marginTop: p(20) }}>
              <Text style={s.label}>Notes</Text>
              <Text>{ed.notes.trim()}</Text>
            </View>
          ) : null}
          {ed.tax_note?.trim() ? <Text style={[s.soft, { marginTop: p(18), fontSize: p(10.5) }]}>{ed.tax_note.trim()}</Text> : null}
        </View>

        {/* Footer on every page */}
        <View fixed style={{ position: 'absolute', left: p(56), right: p(56), bottom: p(28), borderTopWidth: p(1), borderTopColor: DOC_RULE, paddingTop: p(10) }}>
          {ed.footer?.trim() ? <Text style={[s.soft, { fontSize: p(10), textAlign: 'center' }]}>{ed.footer.trim()}</Text> : null}
          <Text style={[s.soft, { fontSize: p(10), textAlign: 'center' }]}>{[name, doc.issuer.website].filter(Boolean).join(' · ')}</Text>
          <Text style={[s.soft, { fontSize: p(9), textAlign: 'center' }]} render={({ pageNumber, totalPages }) => (totalPages > 1 ? `Page ${pageNumber} of ${totalPages}` : '')} />
        </View>
      </Page>
    </Document>
  );
}
