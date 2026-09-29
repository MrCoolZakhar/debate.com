'use client';

// The organiser's Explore pop-up for a Country or Region Spotlight (29 Sep 2026).
//
// A purchase with has_popup (it holds a Country or Region booking) gets a
// pitch (up to 600 characters) and up to three highlights (60 each), shown in
// the pop-up Explore opens when a visitor filters by that country or region on
// the Spotlight's days. Preview opens the EXACT public pop-up
// (conferences/explore/SpotlightPlacePopup.tsx) with this content.
//
// Write: set_spotlight_popup(p_purchase, p_pitch, p_highlights) →
//   { ok, pitch, highlights, message } | { ok:false, message }. The server
//   refuses links and profanity with a plain sentence, shown as written.

import { useRef, useState } from 'react';
import { Eye } from 'lucide-react';
import { useManage } from '@/app/manage/[slug]/layout';
import { GoldWord } from '@/components/BrandHeading';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { friendlyError, plainOrFallback } from '@/lib/friendlyError';
import { notifyOk } from '@/lib/appNotify';
import SpotlightPlacePopup, { type PlacePopupPlacement } from '@/app/conferences/explore/SpotlightPlacePopup';
import { PurchaseShell, PURCHASE_CSS } from '@/components/purchase/purchaseKit';
import type { Placement, SpotlightPurchase } from './storeApi';

const FONT = "var(--font-brand), sans-serif";
const INK = '#1C1410';
const INK_SOFT = '#5A5046';
const DANGER = '#8B2020';
const PITCH_MAX = 600;
const HIGHLIGHT_MAX = 60;

/** The placement the pop-up belongs to: the purchase's Country booking, else its Region one. */
export function popupPlacementOf(p: Pick<SpotlightPurchase, 'bookings'>): PlacePopupPlacement {
  const b = p.bookings ?? [];
  return b.some(x => x.placement === 'country') ? 'country' : 'region';
}

export default function SpotlightPopupEditor({ purchase, description, onSaved }: {
  purchase: Pick<SpotlightPurchase, 'purchase_id' | 'bookings' | 'pitch' | 'highlights'>;
  /** The booking's short line, shown in the preview like the public pop-up. */
  description?: string | null;
  onSaved?: () => void;
}) {
  const { conference } = useManage();
  const [pitch, setPitch] = useState(purchase.pitch ?? '');
  const [highlights, setHighlights] = useState<string[]>(() => {
    const h = (purchase.highlights ?? []).slice(0, 3);
    while (h.length < 3) h.push('');
    return h;
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [preview, setPreview] = useState(false);
  const busyRef = useRef(false);

  const save = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setErr('');
    const fallback = 'The pop-up could not be saved. Try again in a moment.';
    try {
      const client = await getFreshAuthedClient();
      if (!client) { setErr('Your session has expired. Please sign in again.'); return; }
      const { data, error } = await client.rpc('set_spotlight_popup', {
        p_purchase: purchase.purchase_id,
        p_pitch: pitch,
        p_highlights: highlights.map(h => h.trim()).filter(Boolean),
      });
      if (error) { setErr(friendlyError(error, fallback)); return; }
      const a = data as { ok?: boolean; message?: string; pitch?: string | null; highlights?: string[] } | null;
      if (!a?.ok) { setErr(plainOrFallback(a?.message, fallback)); return; }
      notifyOk('Pop-up saved', 'store');
      onSaved?.();
    } catch (e) {
      setErr(friendlyError(e, fallback));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const placement = popupPlacementOf(purchase);

  return (
    <section className="gv-spe" aria-label="Explore pop-up">
      <style>{CSS}</style>
      <h3 className="gv-spe-title">Explore <GoldWord tone="light">Pop-up</GoldWord></h3>
      <p className="gv-spe-sub">Shown when a visitor filters Explore by your country or region on your Spotlight days</p>

      <label className="gv-spe-label" htmlFor={`spe-pitch-${purchase.purchase_id}`}>
        <span>Pitch</span>
        <span className="gv-spe-count" aria-live="polite">{pitch.length}/{PITCH_MAX}</span>
      </label>
      <textarea
        id={`spe-pitch-${purchase.purchase_id}`}
        className="gv-spe-input"
        rows={4}
        maxLength={PITCH_MAX}
        value={pitch}
        onChange={e => { setPitch(e.target.value); setErr(''); }}
        placeholder="Why should a delegate from this place come to your conference?"
      />

      {highlights.map((h, i) => (
        <div key={i}>
          <label className="gv-spe-label" htmlFor={`spe-hl-${purchase.purchase_id}-${i}`}>
            <span>Highlight</span>
            <span className="gv-spe-count">{h.length}/{HIGHLIGHT_MAX}</span>
          </label>
          <input
            id={`spe-hl-${purchase.purchase_id}-${i}`}
            className="gv-spe-input"
            maxLength={HIGHLIGHT_MAX}
            value={h}
            onChange={e => { const v = e.target.value; setHighlights(prev => prev.map((x, j) => (j === i ? v : x))); setErr(''); }}
            placeholder={i === 0 ? 'Crisis committee with a live press corps' : ''}
          />
        </div>
      ))}

      {err ? <p className="gv-spe-err" role="alert">{err}</p> : null}

      <div className="gv-spe-actions">
        <button type="button" className="gv-spe-btn gv-spe-secondary" onClick={() => setPreview(true)}>
          <Eye size={16} aria-hidden /> PREVIEW
        </button>
        <button type="button" className="gv-spe-btn gv-spe-primary" onClick={() => { void save(); }} disabled={busy}>
          {busy ? 'SAVING…' : 'SAVE POP-UP'}
        </button>
      </div>

      {preview && conference && (
        <SpotlightPlacePopup
          preview
          placement={placement}
          onClose={() => setPreview(false)}
          rows={[{
            booking_id: null,
            conference_id: conference.id,
            slug: conference.slug,
            acronym: conference.acronym,
            full_name: conference.full_name,
            banner_url: conference.banner_url,
            logo_url: conference.logo_url,
            city: conference.city,
            country: conference.country,
            start_date: conference.start_date,
            end_date: conference.end_date,
            format: conference.format,
            description: description ?? null,
            pitch: pitch.trim() || null,
            highlights: highlights.map(x => x.trim()).filter(Boolean),
          }]}
        />
      )}
    </section>
  );
}

const CSS = `
.gv-spe{display:flex;flex-direction:column;gap:6px;padding:16px;border-radius:16px;background:#FFFFFF;box-shadow:0 1px 3px rgba(27,56,40,0.08);font-family:${FONT};color:${INK}}
.gv-spe-title{margin:0;font-size:19px;font-weight:800;letter-spacing:-0.01em}
.gv-spe-sub{margin:0 0 6px;font-size:12.5px;line-height:1.45;color:${INK_SOFT}}
.gv-spe-label{display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-top:6px;font-size:12.5px;font-weight:700;color:${INK}}
.gv-spe-count{font-size:11.5px;font-weight:600;color:${INK_SOFT};font-variant-numeric:tabular-nums}
.gv-spe-input{width:100%;box-sizing:border-box;padding:10px 12px;border-radius:10px;border:1px solid #DDD4C0;background:#FFFFFF;font-family:${FONT};font-size:14px;line-height:1.45;color:${INK};resize:vertical}
.gv-spe-input:focus{outline:none;border-color:#1B3828;box-shadow:0 0 0 3px rgba(27,56,40,0.12)}
.gv-spe-err{margin:4px 0 0;font-size:13px;font-weight:600;color:${DANGER}}
.gv-spe-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
.gv-spe-btn{flex:1 1 140px;display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:42px;padding:0 14px;border:none;border-radius:10px;font-family:${FONT};font-size:13.5px;font-weight:800;letter-spacing:0.04em;cursor:pointer}
.gv-spe-btn:focus{outline:none}
.gv-spe-btn:focus-visible{outline:2px solid #1B3828;outline-offset:2px}
.gv-spe-btn:disabled{opacity:0.6;cursor:default}
.gv-spe-primary{background:linear-gradient(90deg,#1B3828 0%,#2A5A3C 100%);color:#FFFFFF}
.gv-spe-secondary{background:#FFFFFF;color:${INK};box-shadow:inset 0 0 0 1.5px ${INK}}
`;

/** Right after a Country or Region Spotlight (or a bundle holding one) is
 *  booked: "ADD YOUR POP-UP" opens the same editor. Booking is already done;
 *  this only offers the next step. */
export function PopupOfferDialog({ purchaseId, placements, onClose, onSaved }: {
  purchaseId: string;
  placements: Placement[];
  onClose: () => void;
  onSaved?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const bookings = placements.map(placement => ({ placement })) as unknown as SpotlightPurchase['bookings'];
  return (
    <PurchaseShell tone="light" label="Add your pop-up" onClose={onClose} panelClass="gv-spo" testId="spotlight-popup-offer">
      <style>{PURCHASE_CSS}{OFFER_CSS}</style>
      <div className="gv-spo-body">
        {editing ? (
          <SpotlightPopupEditor purchase={{ purchase_id: purchaseId, bookings, pitch: null, highlights: null }} onSaved={() => { onSaved?.(); onClose(); }} />
        ) : (
          <>
            <h2 className="gv-buy-title" style={{ fontSize: 28 }}>Spotlight <GoldWord tone="light">Booked</GoldWord></h2>
            <p className="gv-buy-sub" style={{ margin: 0 }}>Shown when a visitor filters Explore by your country or region on your Spotlight days</p>
            <div className="gv-spe-actions" style={{ marginTop: 6 }}>
              <button type="button" className="gv-spe-btn gv-spe-primary" onClick={() => setEditing(true)}>ADD YOUR POP-UP</button>
              <button type="button" className="gv-spe-btn gv-spe-secondary" onClick={onClose}>NOT NOW</button>
            </div>
            <style>{CSS}</style>
          </>
        )}
      </div>
    </PurchaseShell>
  );
}

const OFFER_CSS = `
.gv-buy-panel.gv-spo{max-width:560px;min-height:0}
.gv-buy-panel.gv-spo .gv-buy-body{flex-direction:column}
.gv-spo-body{padding:30px 26px 24px;display:flex;flex-direction:column;gap:12px;font-family:${FONT}}
@media (max-width:743px){.gv-spo-body{padding:calc(22px + env(safe-area-inset-top)) 20px calc(24px + env(safe-area-inset-bottom))}}
`;
