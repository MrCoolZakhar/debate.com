// CvPdf — the MUN CV as a print-friendly A4 PDF, drawn by @react-pdf/renderer
// in the browser. NEVER import this file statically: downloadCvPdf.ts loads it
// with a dynamic import when someone presses Download PDF, so the renderer
// never weighs down a page (the same pattern as MoneyDocumentPdf). It draws
// only the model it is given (cvPdfModel.ts builds that from the entries the
// page already holds), so it never reads anything and can never show an entry
// the page was not already showing.
//
// Sizes are PDF points (an A4 page is 595 x 842).

import { Document, Font, Image, Link, Page, Path, StyleSheet, Svg, Text, View, Defs, LinearGradient, Stop, Rect } from '@react-pdf/renderer';
import type { CvPdfModel, CvPdfEntry, CvPdfAssets } from './cvPdfModel';

const FOREST = '#1B3828';
const FOREST_MID = '#2A5A3C';
const GOLD = '#EED98A';
const GOLD_DEEP = '#B6871F';
const INK = '#1C1410';
const INK_SOFT = '#5A5046';
const RULE = '#E4DED2';
const VERIFIED_BLUE = '#1D9BF0';

const AWARD_TIERS = {
  gold: { bg: '#F6EAB4', border: '#D9BC62', text: '#6E5018' },
  silver: { bg: '#E7EAEF', border: '#B4BCC8', text: '#434C59' },
  bronze: { bg: '#F0DFD0', border: '#CFA27C', text: '#6E4226' },
  special: { bg: '#DDE8DF', border: '#9DB9A5', text: '#1B3828' },
} as const;

// Sixteen-point rosette on a 24x24 box (the same seal as VerifiedCheck).
const SEAL = (() => {
  const cx = 12, cy = 12, outer = 11, inner = 9.6, points = 16;
  let d = '';
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI * i) / points - Math.PI / 2;
    d += `${i === 0 ? 'M' : 'L'}${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)} `;
  }
  return d + 'Z';
})();

let fontBaseRegistered: string | null = null;
function registerFonts(base: string) {
  if (fontBaseRegistered === base) return;
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
  fontBaseRegistered = base;
}

const FONT = ['Inter', 'InterExt'];
const MARGIN = 40;
const HEADER_H = 150;
const AVATAR = 96;
const DATE_W = 74;

const s = StyleSheet.create({
  page: { fontFamily: FONT, fontSize: 10, lineHeight: 1.4, color: INK, backgroundColor: '#FFFFFF', paddingTop: 36, paddingBottom: 90 },
  row: { flexDirection: 'row' },
});

function Seal({ size = 11 }: { size?: number }) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size}>
      <Path d={SEAL} fill={VERIFIED_BLUE} stroke={VERIFIED_BLUE} strokeWidth={1.2} />
      <Path d="M7.4 12.4 L10.4 15.3 L16.8 8.9" fill="none" stroke="#FFFFFF" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** A small award glyph (a five-point star) for the award chips. */
function Star({ color, size = 9 }: { color: string; size?: number }) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size}>
      <Path d="M12 2.6 L14.9 8.9 L21.7 9.6 L16.6 14.2 L18.1 21 L12 17.5 L5.9 21 L7.4 14.2 L2.3 9.6 L9.1 8.9 Z" fill={color} />
    </Svg>
  );
}

function Header({ model, assets }: { model: CvPdfModel; assets: CvPdfAssets }) {
  const initial = (model.name.trim()[0] ?? '?').toUpperCase();
  // A long name steps its size down so it stays on one or two rows, never cut.
  const nameSize = model.name.length > 44 ? 17 : model.name.length > 30 ? 20 : model.name.length > 22 ? 23 : 25;
  return (
    <View style={{ position: 'relative', marginTop: -36 }}>
      {/* The photo band, with a forest wash so white text and the logo pill read on any picture */}
      <View style={{ height: HEADER_H, position: 'relative', backgroundColor: FOREST }}>
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <Image src={assets.header} style={{ position: 'absolute', top: 0, left: 0, width: 595, height: HEADER_H, objectFit: 'cover' }} />
        <Svg width={595} height={HEADER_H} style={{ position: 'absolute', top: 0, left: 0 }}>
          <Defs>
            <LinearGradient id="wash" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={FOREST} stopOpacity={0.62} />
              <Stop offset="1" stopColor={FOREST} stopOpacity={0.9} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="595" height={HEADER_H} fill="url(#wash)" />
        </Svg>
        <View style={{ position: 'absolute', top: 30, left: MARGIN, right: MARGIN, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ backgroundColor: '#FFFFFF', borderRadius: 9, paddingVertical: 6, paddingHorizontal: 10 }}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={assets.lockup} style={{ width: 92, height: 23 }} />
          </View>
          <Text style={{ fontSize: 10.5, fontWeight: 700, color: GOLD }}>Model UN CV</Text>
        </View>
      </View>

      {/* The avatar hangs over the band's bottom edge, half outside */}
      <View style={{ position: 'absolute', left: MARGIN, top: HEADER_H - AVATAR / 2, width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2, backgroundColor: '#FFFFFF', padding: 4 }}>
        {model.avatarSrc ? (
          // eslint-disable-next-line jsx-a11y/alt-text
          <Image src={model.avatarSrc} style={{ width: AVATAR - 8, height: AVATAR - 8, borderRadius: (AVATAR - 8) / 2, objectFit: 'cover' }} />
        ) : (
          <View style={{ width: AVATAR - 8, height: AVATAR - 8, borderRadius: (AVATAR - 8) / 2, backgroundColor: FOREST, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 36, fontWeight: 800, color: GOLD }}>{initial}</Text>
          </View>
        )}
      </View>

      {/* Name, nationality and the one-line summary, beside the avatar */}
      <View style={{ paddingLeft: MARGIN + AVATAR + 18, paddingRight: MARGIN, paddingTop: 14 }}>
        <Text style={{ fontSize: nameSize, fontWeight: 800, lineHeight: 1.15, color: INK }}>{model.name}</Text>
        {model.nationality ? (
          <View style={[s.row, { alignItems: 'center', marginTop: 6 }]}>
            {model.flagSrc ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image src={model.flagSrc} style={{ width: 14, height: 14, borderRadius: 7, marginRight: 6 }} />
            ) : null}
            <Text style={{ fontSize: 11, fontWeight: 700, color: INK_SOFT }}>{model.nationality}</Text>
          </View>
        ) : null}
        <Text style={{ fontSize: 10.5, color: INK_SOFT, marginTop: 5 }}>{model.summary}</Text>
      </View>
    </View>
  );
}

function AwardChip({ name, tier }: { name: string; tier: keyof typeof AWARD_TIERS }) {
  const t = AWARD_TIERS[tier];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: t.bg, borderWidth: 0.75, borderColor: t.border, borderRadius: 9, paddingVertical: 2.5, paddingHorizontal: 7, marginRight: 5, marginTop: 4 }}>
      <Star color={t.text} />
      <Text style={{ fontSize: 8.5, fontWeight: 700, color: t.text, marginLeft: 4 }}>{name}</Text>
    </View>
  );
}

function Entry({ e, last }: { e: CvPdfEntry; last: boolean }) {
  const sub = [e.committee, e.allocation].filter(Boolean);
  return (
    <View wrap={false} style={[s.row, { paddingVertical: 11, borderBottomWidth: last ? 0 : 0.75, borderBottomColor: RULE }]}>
      <View style={{ width: DATE_W, paddingRight: 8 }}>
        <Text style={{ fontSize: 9, fontWeight: 700, color: INK_SOFT }}>{e.dateLabel ?? 'No date'}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 8.5, fontWeight: 700, color: e.accent }}>{e.roleLabel}</Text>
        <View style={[s.row, { alignItems: 'center', marginTop: 1.5 }]}>
          <Text style={{ fontSize: 13, fontWeight: 800, lineHeight: 1.25, color: FOREST, flexShrink: 1 }}>{e.conference}</Text>
          {e.verified ? <View style={{ marginLeft: 5 }}><Seal size={11} /></View> : null}
        </View>
        {e.conferenceFull ? <Text style={{ fontSize: 8.5, color: INK_SOFT, marginTop: 1 }}>{e.conferenceFull}</Text> : null}
        {sub.length > 0 ? (
          <Text style={{ fontSize: 10.5, fontWeight: 700, color: FOREST, marginTop: 4 }}>
            {sub.map((part, i) => (
              <Text key={i} style={i === 0 ? undefined : { fontWeight: 400, color: INK_SOFT }}>{i === 0 ? part : `  ·  ${part}`}</Text>
            ))}
          </Text>
        ) : null}
        {e.description ? <Text style={{ fontSize: 9, color: '#4A4038', marginTop: 4, lineHeight: 1.5 }}>{e.description}</Text> : null}
        {e.awards.length > 0 || e.verified ? (
          <View style={[s.row, { flexWrap: 'wrap', alignItems: 'center' }]}>
            {e.awards.map(a => <AwardChip key={a.name} name={a.name} tier={a.tier} />)}
            {e.verified ? (
              <Text style={{ fontSize: 8, fontWeight: 700, color: VERIFIED_BLUE, marginTop: 4 }}>Verified by Gavelling</Text>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

function Empty({ name }: { name: string }) {
  return (
    <View style={{ marginTop: 6, paddingVertical: 26, alignItems: 'center', backgroundColor: '#F7F4EE', borderRadius: 12 }}>
      <Text style={{ fontSize: 12, fontWeight: 700, color: INK }}>No conferences yet</Text>
      <Text style={{ fontSize: 9.5, color: INK_SOFT, marginTop: 3 }}>{`${name} has not added any Model UN conferences to this record.`}</Text>
    </View>
  );
}

/** The CV document. `assets` are the header photo and logos (URLs in the browser, file paths in a script). */
export default function CvPdf({ model, assets, fontBase }: { model: CvPdfModel; assets: CvPdfAssets; fontBase?: string }) {
  registerFonts(fontBase ?? `${typeof window === 'undefined' ? '' : window.location.origin}/fonts/money-docs`);

  // Group the (already ordered) entries by year, keeping their order.
  const groups: { label: string; entries: CvPdfEntry[] }[] = [];
  for (const e of model.entries) {
    const label = e.year ?? 'Earlier';
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.entries.push(e); else groups.push({ label, entries: [e] });
  }

  return (
    <Document title={`${model.name} MUN CV`} author={model.name} subject="Model UN CV" creator="Gavelling" producer="Gavelling">
      <Page size="A4" style={s.page}>
        <Header model={model} assets={assets} />

        <View style={{ paddingHorizontal: MARGIN, marginTop: 30 }}>
          {groups.length === 0 ? <Empty name={model.name} /> : groups.map(g => (
            <View key={g.label} style={{ marginBottom: 6 }}>
              {/* The year heading never sits alone at the foot of a page */}
              <View minPresenceAhead={90} style={[s.row, { alignItems: 'center', marginBottom: 2 }]}>
                <Text style={{ fontSize: 14, fontWeight: 800, color: GOLD_DEEP }}>{g.label}</Text>
                <View style={{ flex: 1, height: 0.75, backgroundColor: RULE, marginLeft: 10 }} />
              </View>
              {g.entries.map((e, i) => <Entry key={e.id} e={e} last={i === g.entries.length - 1} />)}
            </View>
          ))}
        </View>

        {/* Footer on every page: the link to the live CV, the small logo and the page number.
            Two absolutely placed children: a flex row here made react-pdf drop its first child. */}
        <View fixed style={{ position: 'absolute', left: MARGIN, right: MARGIN, top: 762, height: 30, borderTopWidth: 0.75, borderTopColor: RULE }}>
          <View style={{ position: 'absolute', left: 0, top: 9, flexDirection: 'row', alignItems: 'center' }}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={assets.mark} style={{ width: 18, height: 18, marginRight: 7 }} />
            <Text style={{ fontSize: 9, fontWeight: 700, color: FOREST_MID }}>
              {model.shareUrl ? (
                <Link src={model.shareUrl.startsWith('http') ? model.shareUrl : `https://${model.shareUrl}`} style={{ color: FOREST_MID, textDecoration: 'underline' }}>
                  {model.shareUrl.replace(/^https?:\/\//, '')}
                </Link>
              ) : 'gavelling.com'}
            </Text>
          </View>
          <Text style={{ position: 'absolute', right: 0, top: 13, fontSize: 8.5, color: INK_SOFT }} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

