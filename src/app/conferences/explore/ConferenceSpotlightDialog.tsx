'use client';

// The Conference Spotlight pop-up on Explore (25 Sep 2026). Opens ONCE per
// site visit (sessionStorage) when at least one Explore Spotlight is booked
// today. "Conference Spotlight", "Our best picks of conferences for you", then
// every conference booked today (as many as spotlight_placements.explore's
// capacity allows, 4 since 25 Sep 2026; never a hardcoded count): the banner with the logo, the name (short form
// large, full name beneath, never cut off), the organiser's line, and two
// buttons: Apply and View conference. Nothing else. A view is recorded for
// each booking shown, a click for either button.
//
// The purchase pop-up shell (PurchaseShell) is the frame; its CSS is mounted
// here since PurchasePopupHost only mounts it while a purchase is open.

import { useEffect } from 'react';
import Link from 'next/link';
import { GoldWord } from '@/components/BrandHeading';
import { LogoDisc } from '@/components/LogoDisc';
import { PurchaseShell, PURCHASE_CSS } from '@/components/purchase/purchaseKit';
import { conferenceAcronymLabel } from '@/lib/conferenceLabels';
import { recordSpotlightClick, recordSpotlightView, type FeaturedRow } from '@/lib/spotlight';
import { SpotlightTag } from '@/components/conferences/SpotlightTag';

const SEEN_KEY = 'gavelling-explore-spotlight-seen';
const FONT = "var(--font-brand), sans-serif";

/** True once per site visit: the first call marks it seen. */
export function claimSpotlightDialog(): boolean {
  try {
    if (sessionStorage.getItem(SEEN_KEY)) return false;
    sessionStorage.setItem(SEEN_KEY, '1');
    return true;
  } catch {
    return false;
  }
}

export default function ConferenceSpotlightDialog({ rows, onClose }: { rows: FeaturedRow[]; onClose: () => void }) {
  // As many as the server returns: the capacity lives in spotlight_placements.
  const shown = rows.filter(r => r.is_spotlight);

  useEffect(() => {
    for (const r of shown) recordSpotlightView(r.booking_id);
    // Once, for the rows shown at open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (shown.length === 0) return null;

  return (
    <PurchaseShell tone="light" label="Conference Spotlight" onClose={onClose} panelClass={`gv-cs gv-cs-n${Math.min(shown.length, 4)}`} testId="conference-spotlight">
      <style>{PURCHASE_CSS}{CSS}</style>
      <div className="gv-cs-body">
        <div>
          <h2 className="gv-buy-title" style={{ fontSize: 30 }}>Conference <GoldWord tone="light">Spotlight</GoldWord></h2>
          <p className="gv-buy-sub">Our best picks of conferences for you</p>
        </div>
        <div className="gv-cs-list">
          {shown.map(r => {
            const label = conferenceAcronymLabel({ acronym: r.acronym ?? '', full_name: r.full_name ?? '', start_date: r.start_date });
            const showFull = (r.full_name ?? '').trim() && (r.full_name ?? '').trim() !== (r.acronym ?? '').trim();
            const initials = (r.acronym ?? r.full_name ?? '?').slice(0, 3).toUpperCase();
            return (
              <article key={r.conference_id} className="gv-cs-card">
                <div className="gv-cs-banner">
                  {r.banner_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.banner_url} alt="" loading="lazy" decoding="async" />
                  ) : (
                    <div className="gv-cs-banner-fallback" aria-hidden />
                  )}
                  <span className="gv-cs-scrim" aria-hidden />
                  <span className="gv-cs-tag"><SpotlightTag size="sm" /></span>
                  <span className="gv-cs-logo">
                    <LogoDisc src={r.logo_url} alt={r.acronym ?? ''} size={48} fallbackText={initials} style={{ boxShadow: '0 6px 14px rgba(6,14,10,0.45)' }} />
                  </span>
                </div>
                <div className="gv-cs-text">
                  <h3 className="gv-cs-name">{label}</h3>
                  {showFull ? <p className="gv-cs-full">{r.full_name}</p> : null}
                  {r.description ? <p className="gv-cs-desc" title={r.description}>{r.description}</p> : null}
                  <div className="gv-cs-actions">
                    <Link
                      href={`/conferences/${r.slug}/apply`}
                      className="gv-cs-btn gv-cs-primary"
                      onClick={() => { recordSpotlightClick(r.booking_id); onClose(); }}
                    >
                      Apply
                    </Link>
                    <Link
                      href={`/conferences/${r.slug}`}
                      className="gv-cs-btn gv-cs-secondary"
                      onClick={() => { recordSpotlightClick(r.booking_id); onClose(); }}
                    >
                      View conference
                    </Link>
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
/* One screen at 1280x800 and 1440x900 with up to four conferences side by
   side; the panel widens with the count. Phones stack and scroll. */
.gv-buy-panel.gv-cs{max-width:560px;min-height:0}
.gv-buy-panel.gv-cs.gv-cs-n2{max-width:780px}
.gv-buy-panel.gv-cs.gv-cs-n3{max-width:960px}
.gv-buy-panel.gv-cs.gv-cs-n4{max-width:1160px}
.gv-buy-panel.gv-cs .gv-buy-body{flex-direction:column}
.gv-cs-body{padding:26px 24px 22px;display:flex;flex-direction:column;gap:16px;font-family:${FONT}}
.gv-cs-list{display:grid;grid-template-columns:1fr;gap:14px}
.gv-cs-card{display:flex;flex-direction:column;border-radius:18px;overflow:hidden;background:#FFFFFF;box-shadow:0 1px 0 rgba(27,56,40,0.08),0 18px 40px -32px rgba(27,56,40,0.35)}
.gv-cs-banner{position:relative;aspect-ratio:16/7;background:#14301F}
.gv-cs-banner img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
.gv-cs-banner-fallback{position:absolute;inset:0;background:linear-gradient(135deg,#16301F 0%,#2A5A3C 100%)}
.gv-cs-scrim{position:absolute;inset:0;background:linear-gradient(to top,rgba(10,22,16,0.55) 0%,rgba(10,22,16,0) 55%)}
.gv-cs-tag{position:absolute;top:10px;right:10px;z-index:2}
.gv-cs-logo{position:absolute;left:12px;bottom:-20px;z-index:2}
.gv-cs-text{padding:26px 14px 14px;display:flex;flex-direction:column;gap:4px;flex:1}
.gv-cs-name{margin:0;font-size:20px;font-weight:800;letter-spacing:-0.012em;line-height:1.1;color:#1C1410;overflow-wrap:anywhere}
.gv-cs-full{margin:0;font-size:12px;line-height:1.35;color:#5A5046;overflow-wrap:anywhere}
.gv-cs-desc{margin:6px 0 0;font-size:13px;line-height:1.45;color:#1C1410;overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.gv-cs-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:auto;padding-top:12px}
.gv-cs-btn{flex:1 1 auto;display:inline-flex;align-items:center;justify-content:center;min-height:40px;padding:0 12px;border-radius:10px;font-family:${FONT};font-size:13.5px;font-weight:700;text-decoration:none;white-space:nowrap;transition:background-color 140ms ease,transform 120ms ease}
.gv-cs-btn:active{transform:scale(0.985)}
.gv-cs-primary{background:linear-gradient(90deg,#1B3828 0%,#2A5A3C 100%);color:#FFFFFF}
.gv-cs-primary:hover{background:linear-gradient(90deg,#234a35 0%,#33694a 100%)}
.gv-cs-secondary{background:#FFFFFF;color:#1C1410;box-shadow:inset 0 0 0 1.5px #1C1410}
.gv-cs-secondary:hover{background:#FAF8F3}
@media (min-width:744px){
  .gv-cs-n2 .gv-cs-list,.gv-cs-n3 .gv-cs-list,.gv-cs-n4 .gv-cs-list{grid-template-columns:repeat(2,minmax(0,1fr))}
}
@media (min-width:1024px){
  .gv-cs-n3 .gv-cs-list{grid-template-columns:repeat(3,minmax(0,1fr))}
  .gv-cs-n4 .gv-cs-list{grid-template-columns:repeat(4,minmax(0,1fr))}
}
@media (max-width:743px){
  .gv-cs-body{padding:calc(22px + env(safe-area-inset-top)) 20px calc(24px + env(safe-area-inset-bottom))}
}
`;
