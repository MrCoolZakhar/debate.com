'use client';

// The Country / Region Spotlight pop-up on Explore (29 Sep 2026).
//
// When a visitor filters Explore by a country or a region, the conferences
// that booked that Country or Region Spotlight for today (0, 1 or 2, read by
// `spotlight_popups(p_placement, p_target)`) open in a pop-up, once per target
// per browser session. Bigger and more personal than a card: the banner with
// the logo over it, the full name (last word in gold italic), dates, place and
// format, the booking's short description, then the organiser's pitch and up
// to three highlights. Apply now and View conference.
//
// The organiser's editor (manage/[slug]/store/SpotlightPopupEditor.tsx)
// previews this exact component with `preview`, which records nothing and
// links nowhere.
//
// Two Spotlights sit side by side from 744px; on a phone they are a bottom
// sheet with two cards swiped sideways (scroll snap, no auto-rotation).

import { useEffect } from 'react';
import Link from 'next/link';
import { CheckCircle2, MapPin, CalendarDays, Globe2 } from 'lucide-react';
import { GoldWord } from '@/components/BrandHeading';
import { LogoDisc } from '@/components/LogoDisc';
import { PurchaseShell, PURCHASE_CSS } from '@/components/purchase/purchaseKit';
import { SpotlightTag } from '@/components/conferences/SpotlightTag';
import { formatConferenceDates } from '@/lib/conferenceDates';
import { recordSpotlightClick, recordSpotlightView } from '@/lib/spotlight';
import { supabase as anon } from '@/lib/supabase';

const FONT = "var(--font-brand), sans-serif";

export type PlacePopupPlacement = 'country' | 'region';

export interface PlacePopupRow {
  booking_id: string | null;
  conference_id: string;
  slug: string;
  acronym: string | null;
  full_name: string | null;
  banner_url: string | null;
  logo_url: string | null;
  city: string | null;
  country: string | null;
  start_date: string | null;
  end_date: string | null;
  format: string | null;
  description: string | null;
  pitch: string | null;
  highlights: string[] | null;
}

/** Today's Country or Region Spotlights for this target; [] on any failure. */
export async function fetchSpotlightPopups(placement: PlacePopupPlacement, target: string): Promise<PlacePopupRow[]> {
  try {
    const { data, error } = await anon.rpc('spotlight_popups', { p_placement: placement, p_target: target });
    if (error || !Array.isArray(data)) return [];
    return (data as PlacePopupRow[]).filter(r => !!r.conference_id && !!r.slug).slice(0, 2);
  } catch {
    return [];
  }
}

/** True once per target per browser session: the first call marks it seen. */
export function claimPlacePopup(placement: PlacePopupPlacement, target: string): boolean {
  const key = `gavelling-place-spotlight-seen:${placement}:${target}`;
  try {
    if (sessionStorage.getItem(key)) return false;
    sessionStorage.setItem(key, '1');
    return true;
  } catch {
    return false;
  }
}

const FORMAT_WORD: Record<string, string> = { 'in-person': 'In person', online: 'Online', virtual: 'Online', hybrid: 'Hybrid' };

/** The full name with its last word in gold italic. */
function TitleWithGold({ name }: { name: string }) {
  const trimmed = name.trim();
  const cut = trimmed.lastIndexOf(' ');
  if (cut < 0) return <GoldWord tone="light">{trimmed}</GoldWord>;
  return <>{trimmed.slice(0, cut)} <GoldWord tone="light">{trimmed.slice(cut + 1)}</GoldWord></>;
}

export default function SpotlightPlacePopup({ rows, placement, onClose, preview = false }: {
  rows: PlacePopupRow[];
  placement: PlacePopupPlacement;
  onClose: () => void;
  /** The organiser's preview: records nothing, the buttons do nothing. */
  preview?: boolean;
}) {
  const shown = rows.slice(0, 2);

  useEffect(() => {
    if (preview) return;
    for (const r of shown) recordSpotlightView(r.booking_id);
    // Once, for the rows shown at open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (shown.length === 0) return null;
  const tagLabel = placement === 'country' ? 'Country Spotlight' : 'Region Spotlight';

  return (
    <PurchaseShell
      tone="light"
      label={tagLabel}
      onClose={onClose}
      panelClass={`gv-sp gv-sp-n${shown.length}`}
      testId="place-spotlight"
    >
      <style>{PURCHASE_CSS}{CSS}</style>
      <div className="gv-sp-body">
        <div className="gv-sp-list">
          {shown.map(r => {
            const name = (r.full_name || r.acronym || '').trim();
            const initials = (r.acronym || r.full_name || '?').slice(0, 3).toUpperCase();
            const dates = formatConferenceDates(r.start_date, r.end_date, { style: 'dmy', fallback: '' });
            const place = [r.city, r.country].filter(Boolean).join(', ');
            const format = r.format ? FORMAT_WORD[r.format] ?? null : null;
            const highlights = (r.highlights ?? []).map(h => (h ?? '').trim()).filter(Boolean).slice(0, 3);
            const click = () => { if (!preview) { recordSpotlightClick(r.booking_id); onClose(); } };
            return (
              <article key={r.conference_id} className="gv-sp-card">
                <div className="gv-sp-banner">
                  {r.banner_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.banner_url} alt="" loading="lazy" decoding="async" />
                  ) : (
                    <div className="gv-sp-banner-fallback" aria-hidden />
                  )}
                  <span className="gv-sp-scrim" aria-hidden />
                  <span className="gv-sp-tag"><SpotlightTag size="sm" label={tagLabel} /></span>
                  <span className="gv-sp-logo">
                    <LogoDisc src={r.logo_url} alt={r.acronym ?? ''} size={64} fallbackText={initials} style={{ boxShadow: '0 8px 18px rgba(6,14,10,0.45)' }} />
                  </span>
                </div>
                <div className="gv-sp-text">
                  <h2 className="gv-sp-name"><TitleWithGold name={name} /></h2>
                  <p className="gv-sp-facts">
                    {dates ? <span><CalendarDays size={14} aria-hidden />{dates}</span> : null}
                    {place ? <span><MapPin size={14} aria-hidden />{place}</span> : null}
                    {format ? <span><Globe2 size={14} aria-hidden />{format}</span> : null}
                  </p>
                  {r.description ? <p className="gv-sp-desc">{r.description}</p> : null}
                  {r.pitch ? <p className="gv-sp-pitch">{r.pitch}</p> : null}
                  {highlights.length > 0 ? (
                    <ul className="gv-sp-hl">
                      {highlights.map((h, i) => (
                        <li key={i}><CheckCircle2 size={17} strokeWidth={2.4} aria-hidden />{h}</li>
                      ))}
                    </ul>
                  ) : null}
                  <div className="gv-sp-actions">
                    {preview ? (
                      <>
                        <span className="gv-sp-btn gv-sp-primary" aria-disabled="true">Apply now</span>
                        <span className="gv-sp-btn gv-sp-secondary" aria-disabled="true">View conference</span>
                      </>
                    ) : (
                      <>
                        <Link href={`/conferences/${r.slug}/apply`} className="gv-sp-btn gv-sp-primary" onClick={click}>Apply now</Link>
                        <Link href={`/conferences/${r.slug}`} className="gv-sp-btn gv-sp-secondary" onClick={click}>View conference</Link>
                      </>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </PurchaseShell>
  );
}

const CSS = `
.gv-buy-panel.gv-sp{max-width:600px;min-height:0;max-height:calc(100dvh - 48px);overflow-y:auto}
.gv-buy-panel.gv-sp.gv-sp-n2{max-width:1080px}
.gv-buy-panel.gv-sp .gv-buy-body{flex-direction:column}
.gv-sp-body{padding:22px;font-family:${FONT}}
.gv-sp-list{display:grid;grid-template-columns:1fr;gap:16px}
.gv-sp-card{display:flex;flex-direction:column;border-radius:20px;overflow:hidden;background:#FFFFFF;box-shadow:0 1px 0 rgba(27,56,40,0.08),0 22px 46px -34px rgba(27,56,40,0.4)}
.gv-sp-banner{position:relative;aspect-ratio:16/6;background:#14301F;flex-shrink:0}
.gv-sp-banner img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
.gv-sp-banner-fallback{position:absolute;inset:0;background:linear-gradient(135deg,#16301F 0%,#2A5A3C 100%)}
.gv-sp-scrim{position:absolute;inset:0;background:linear-gradient(to top,rgba(10,22,16,0.55) 0%,rgba(10,22,16,0) 60%)}
.gv-sp-tag{position:absolute;top:12px;left:12px;z-index:2}
.gv-sp-logo{position:absolute;left:18px;bottom:-28px;z-index:2}
.gv-sp-text{padding:36px 20px 18px;display:flex;flex-direction:column;gap:8px;flex:1;color:#1C1410}
.gv-sp-name{margin:0;font-size:26px;font-weight:800;letter-spacing:-0.015em;line-height:1.12;overflow-wrap:anywhere;text-wrap:balance}
.gv-sp-facts{margin:0;display:flex;flex-wrap:wrap;gap:6px 14px;font-size:13px;font-weight:600;color:#5A5046}
.gv-sp-facts span{display:inline-flex;align-items:center;gap:5px}
.gv-sp-facts svg{color:#2A5A3C;flex-shrink:0}
.gv-sp-desc{margin:4px 0 0;font-size:14.5px;font-weight:600;line-height:1.45;color:#1C1410;overflow-wrap:anywhere}
.gv-sp-pitch{margin:0;font-size:14px;line-height:1.55;color:#3D342C;overflow-wrap:anywhere;white-space:pre-line}
.gv-sp-hl{list-style:none;margin:2px 0 0;padding:0;display:flex;flex-direction:column;gap:6px}
.gv-sp-hl li{display:flex;align-items:flex-start;gap:8px;font-size:14px;font-weight:600;line-height:1.4;color:#1C1410;overflow-wrap:anywhere}
.gv-sp-hl svg{color:#2A5A3C;flex-shrink:0;margin-top:1px}
.gv-sp-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:auto;padding-top:10px}
.gv-sp-btn{flex:1 1 150px;display:inline-flex;align-items:center;justify-content:center;min-height:46px;padding:0 16px;border-radius:10px;font-family:${FONT};font-size:14px;font-weight:800;text-decoration:none;white-space:nowrap;transition:background-color 140ms ease,transform 120ms ease}
.gv-sp-btn:active{transform:scale(0.985)}
.gv-sp-btn:focus{outline:none}
.gv-sp-btn:focus-visible{outline:2px solid #1B3828;outline-offset:2px}
.gv-sp-primary{background:linear-gradient(90deg,#1B3828 0%,#2A5A3C 100%);color:#FFFFFF}
.gv-sp-primary:hover{background:linear-gradient(90deg,#234a35 0%,#33694a 100%)}
.gv-sp-secondary{background:#FFFFFF;color:#1C1410;box-shadow:inset 0 0 0 1.5px #1C1410}
.gv-sp-secondary:hover{background:#FAF8F3}
.gv-sp-btn[aria-disabled="true"]{cursor:default}
@media (min-width:744px){
  .gv-sp-n2 .gv-sp-list{grid-template-columns:repeat(2,minmax(0,1fr))}
}
/* A phone: a bottom sheet (not the full screen the purchase shell uses), two
   Spotlights swiped sideways with scroll snap, never rotated for them. */
@media (max-width:743px){
  .gv-buy-backdrop:has(.gv-sp){align-items:flex-end}
  .gv-buy-panel.gv-sp{height:auto;max-height:90dvh;border-radius:24px 24px 0 0;box-shadow:0 -12px 40px rgba(0,0,0,0.25)}
  .gv-sp-body{padding:22px 0 calc(18px + env(safe-area-inset-bottom))}
  .gv-sp-list{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;gap:12px;padding:0 16px;scrollbar-width:none}
  .gv-sp-list::-webkit-scrollbar{display:none}
  .gv-sp-card{flex:0 0 100%;scroll-snap-align:center}
  .gv-sp-n2 .gv-sp-card{flex-basis:88%}
  .gv-sp-name{font-size:22px}
}
`;
