'use client';

import { useState, useEffect, useRef } from 'react';
import { useT } from '@/contexts/LanguageContext';
import { CalendarIcon, GiftIcon, CircleCheckIcon } from 'lucide-react';
import { markPreRegistered } from '@/lib/preregStatus';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SPOTS_TOTAL = 1000;
const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='1'/%3E%3C/svg%3E")`;

export default function PreRegisterNudge({ onClose }: { onClose: () => void }) {
  const t = useT();
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [duplicate, setDuplicate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [spots, setSpots] = useState(123);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch('/api/pre-register').then((r) => r.ok ? r.json() : null).then((d) => { if (d?.count != null) setSpots(d.count); }).catch(() => {});
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); if (closeTimer.current) clearTimeout(closeTimer.current); };
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!EMAIL_RE.test(email)) { setInvalid(true); return; }
    setInvalid(false); setLoading(true);
    try {
      const res = await fetch('/api/pre-register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
      const data = await res.json();
      if (data.duplicate) { setDuplicate(true); }
      else if (res.ok) { setSpots((n) => n + 1); }
      else { setLoading(false); return; }
      markPreRegistered();
      setSubmitted(true);
      closeTimer.current = setTimeout(onClose, 2200);
    } catch { /* allow retry */ } finally { setLoading(false); }
  };

  const pct = Math.min(100, (spots / SPOTS_TOTAL) * 100);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      style={{ background: 'rgba(5,4,3,0.55)', backdropFilter: 'blur(4px)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="relative w-full max-w-[420px] rounded-2xl shadow-2xl overflow-hidden" style={{ backgroundColor: '#EDE7D8' }}>

        {/* Close */}
        <button onClick={onClose} aria-label={t('prereg_nudge_close')}
          className="absolute top-3 right-3 z-10 text-white/70 hover:text-white transition-colors">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>

        {/* Green header band */}
        <div className="relative px-7 pt-6 pb-5 flex flex-col items-center gap-3"
          style={{ background: 'linear-gradient(150deg, #1B3828 0%, #142B1C 65%, #0E1E13 100%)' }}>
          <div className="pointer-events-none absolute inset-0"
            style={{ backgroundImage: GRAIN, backgroundRepeat: 'repeat', backgroundSize: '300px 300px', mixBlendMode: 'overlay', opacity: 0.08 }} />
          <div className="relative flex items-center gap-2"
            style={{ backgroundColor: 'rgba(238,217,138,0.15)', border: '1px solid rgba(238,217,138,0.3)', borderRadius: 9999, padding: '5px 14px' }}>
            <CalendarIcon size={13} style={{ color: '#EED98A' }} />
            <span className="font-mono uppercase" style={{ fontSize: 11, letterSpacing: '0.18em', color: '#EED98A', fontWeight: 700 }}>{t('prereg_badge')}</span>
          </div>
          <h2 className="relative text-center font-black text-white tracking-tight leading-[0.95]" style={{ fontSize: 26 }}>
            {t('prereg_heading_1')}{' '}
            <span style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontWeight: 400, color: '#EED98A' }}>{t('prereg_heading_2')}</span>
          </h2>
        </div>

        {/* Body */}
        <div className="px-7 pt-5 pb-6 flex flex-col gap-4">
          {/* Logo mark floats over the band seam */}
          <div className="flex justify-center -mt-12 mb-1">
            <img src="/GAVELLING__1_.png" alt="Gavelling"
              width={84} height={84}
              style={{ width: 84, height: 84, objectFit: 'contain', filter: 'drop-shadow(0 6px 14px rgba(27,56,40,0.25))' }}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} />
          </div>

          {submitted ? (
            <div className="flex flex-col items-center gap-2 rounded-xl px-5 py-5 text-center"
              style={{ backgroundColor: duplicate ? 'rgba(182,135,31,0.08)' : 'rgba(27,56,40,0.08)', border: duplicate ? '1px solid rgba(182,135,31,0.3)' : '1px solid rgba(27,56,40,0.2)' }}>
              <CircleCheckIcon size={22} style={{ color: duplicate ? '#B6871F' : '#1B3828' }} />
              <span className="font-bold text-sm" style={{ color: duplicate ? '#B6871F' : '#1B3828' }}>
                {duplicate ? t('prereg_success_duplicate') : t('prereg_success_new')}
              </span>
            </div>
          ) : (
            <>
              {/* Scarcity alert */}
              <div className="flex items-start gap-2.5 rounded-xl px-4 py-3"
                style={{ backgroundColor: 'rgba(27,56,40,0.06)', border: '1px solid rgba(27,56,40,0.18)' }}>
                <GiftIcon size={16} className="shrink-0 mt-0.5" style={{ color: '#1B3828' }} />
                <p className="text-[13px] leading-snug" style={{ color: '#3A2E22' }}>
                  {t('prereg_alert_title_1')}{' '}
                  <span style={{ color: '#1B3828', fontWeight: 800 }}>{t('prereg_alert_title_free')}</span>{' '}
                  <span style={{ color: '#B6871F', fontWeight: 800 }}>{t('prereg_alert_title_feefree')}</span>.
                </p>
              </div>

              {/* Spots progress */}
              <div className="flex flex-col gap-1.5">
                <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(27,56,40,0.12)' }}>
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #1B3828, #2A5A3C)' }} />
                </div>
                <p className="text-[11px]" style={{ color: '#9A8A78' }}>
                  {t('prereg_spots_claimed').replace('{n}', String(spots)).replace('{total}', SPOTS_TOTAL.toLocaleString()).replace('{remaining}', String(SPOTS_TOTAL - spots))}
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
                <label htmlFor="nudge-email" className="sr-only">Email address</label>
                <input
                  id="nudge-email" type="email" placeholder="your@email.com"
                  value={email} autoComplete="email" disabled={loading}
                  onChange={(e) => { setEmail(e.target.value); setInvalid(false); }}
                  aria-invalid={invalid || undefined}
                  style={{ width: '100%', padding: '12px 15px', fontSize: 15, borderRadius: 12, border: invalid ? '1.5px solid #dc2626' : '1.5px solid rgba(28,20,16,0.2)', backgroundColor: 'rgba(255,255,255,0.7)', color: '#1C1410', outline: 'none', boxSizing: 'border-box' }}
                />
                <button type="submit" disabled={loading}
                  onMouseEnter={(e) => { if (!loading) (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#1B3828', color: '#EED98A', fontWeight: 800, fontSize: 15, letterSpacing: '0.04em', padding: '13px 24px', borderRadius: 12, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, transition: 'all 200ms ease', boxShadow: '0 4px 14px rgba(27,56,40,0.25)' }}>
                  {loading ? '…' : t('prereg_btn')}
                </button>
                <p className="text-[11px] text-center" style={{ color: '#9A8A78' }}>{t('prereg_no_spam')}</p>
                <button type="button" onClick={onClose}
                  className="text-[11px] underline mx-auto mt-0.5 transition-colors"
                  style={{ color: '#9A8A78', background: 'none', border: 'none', cursor: 'pointer' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#1C1410'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#9A8A78'; }}>
                  {t('prereg_nudge_close')}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
