'use client';

// ── The Unlimited insights strip, directly under a listing's header card ────
//
// Members see three facts from job_listing_get's `insights`: how many applied
// (a big number with the word beside it), the closing day, and, only when the
// server says so, that organizers are actively reviewing. Everyone else sees
// the same strip as placeholder shapes under frosted glass with a lock and the
// gold button, which opens the Unlimited pop-up. The real numbers never reach
// a non-member: the server sends `insights: null` with `insights_locked`.
// Never drawn for a listing that applies on another site (the caller checks).

import { CalendarClock, Eye, Lock } from 'lucide-react';
import { GoldButton, GoldButtonStyles } from '@/components/GoldButton';
import { openUnlimitedPopup } from '@/lib/purchasePopup';

const FONT = "var(--font-brand), sans-serif";
const INK = '#1C1410';
const FOREST = '#1B3828';

export interface JobInsights { applicants: number; closes_at: string | null; reviewing: boolean }

/** The server's insights object, or null when it is missing or malformed. */
export function parseJobInsights(raw: unknown): JobInsights | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const n = Number(r.applicants);
  return {
    applicants: Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0,
    closes_at: typeof r.closes_at === 'string' && r.closes_at ? r.closes_at : null,
    reviewing: r.reviewing === true,
  };
}

function closesDay(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export default function InsightsStrip({ insights, locked }: { insights: unknown; locked: boolean }) {
  const data = parseJobInsights(insights);

  if (data) {
    const closes = closesDay(data.closes_at);
    return (
      <section className="gv-ins" aria-label="Unlimited insights" style={{ fontFamily: FONT }}>
        <style>{INSIGHTS_CSS}</style>
        <div className="gv-ins-row">
          <p className="gv-ins-item">
            <span className="gv-ins-num">{data.applicants.toLocaleString('en-GB')}</span>
            <span className="gv-ins-word">applied</span>
          </p>
          {closes && (
            <p className="gv-ins-item">
              <span className="gv-ins-icon" aria-hidden><CalendarClock size={17} strokeWidth={2.3} /></span>
              <span className="gv-ins-word">Closes {closes}</span>
            </p>
          )}
          {data.reviewing && (
            <p className="gv-ins-item">
              <span className="gv-ins-icon" aria-hidden><Eye size={17} strokeWidth={2.3} /></span>
              <span className="gv-ins-word">Organizers are actively reviewing</span>
            </p>
          )}
        </div>
      </section>
    );
  }

  if (!locked) return null;

  return (
    <section className="gv-ins gv-ins-locked" aria-label="Unlimited insights" style={{ fontFamily: FONT }}>
      <style>{INSIGHTS_CSS}</style>
      <GoldButtonStyles />
      {/* Placeholder shapes only: no real number is ever on this page. */}
      <div className="gv-ins-ghost" aria-hidden>
        <span className="gv-ins-ghost-num" />
        <span className="gv-ins-ghost-line" style={{ width: 120 }} />
        <span className="gv-ins-ghost-line" style={{ width: 210 }} />
      </div>
      <div className="gv-ins-frost" aria-hidden />
      <div className="gv-ins-lockrow">
        <span className="gv-ins-lock" aria-hidden><Lock size={18} strokeWidth={2.4} /></span>
        <p className="gv-ins-pitch">See who&apos;s applying, how fast it fills and whether organizers are reviewing</p>
        <GoldButton onClick={() => openUnlimitedPopup()} className="gv-ins-cta" style={{ textTransform: 'none', letterSpacing: '0.01em' }}>Get Unlimited</GoldButton>
      </div>
    </section>
  );
}

const INSIGHTS_CSS = `
.gv-ins{position:relative;overflow:hidden;background:#FFFFFF;border-radius:20px;padding:16px 24px;box-shadow:0 1px 2px rgba(27,56,40,0.05),0 8px 24px rgba(27,56,40,0.08);color:${INK}}
.gv-ins-row{display:flex;flex-wrap:wrap;align-items:center;column-gap:28px;row-gap:10px}
.gv-ins-item{margin:0;display:inline-flex;align-items:center;gap:9px;min-height:36px}
.gv-ins-num{font-size:26px;font-weight:800;letter-spacing:-0.02em;line-height:1;font-variant-numeric:tabular-nums;color:${INK}}
.gv-ins-word{font-size:15px;font-weight:600;line-height:1.35;color:${INK};overflow-wrap:anywhere}
.gv-ins-icon{width:34px;height:34px;border-radius:9999px;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;color:${FOREST};background:linear-gradient(180deg,#FFFFFF 0%,#F2EDE2 100%);border:1px solid rgba(27,56,40,0.16);box-shadow:inset 0 1px 0 #FFFFFF,0 2px 6px rgba(27,56,40,0.14)}
.gv-ins-locked{padding:18px 24px}
.gv-ins-ghost{position:absolute;inset:0;display:flex;align-items:center;gap:28px;padding:0 24px}
.gv-ins-ghost-num{width:44px;height:28px;border-radius:7px;background:rgba(27,56,40,0.22);flex-shrink:0}
.gv-ins-ghost-line{height:14px;border-radius:7px;background:rgba(27,56,40,0.16);flex-shrink:0}
.gv-ins-frost{position:absolute;inset:0;background:rgba(255,255,255,0.6);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)}
.gv-ins-lockrow{position:relative;display:flex;flex-wrap:wrap;align-items:center;gap:12px 16px}
.gv-ins-lock{width:38px;height:38px;border-radius:9999px;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;color:${INK};background:linear-gradient(135deg,#F4E4A6 0%,#EED98A 38%,#D6B24C 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,0.65),0 4px 12px -4px rgba(182,135,31,0.6)}
.gv-ins-pitch{margin:0;flex:1 1 240px;min-width:0;font-size:15px;font-weight:600;line-height:1.45;color:${INK}}
.gv-ins .gv-ins-cta{min-height:44px;padding:0 18px;font-size:13.5px}
@media (max-width:639px){.gv-ins,.gv-ins-locked{padding:16px 18px}.gv-ins-ghost{padding:0 18px}.gv-ins .gv-ins-cta{width:100%}}
.gv-ins-pitch + .gv-gold-cta{flex-shrink:0}
`;
