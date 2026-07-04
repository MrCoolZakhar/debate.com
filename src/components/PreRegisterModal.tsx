'use client';

import { useState, useEffect } from 'react';
import { useT, useLanguage } from '@/contexts/LanguageContext';
import { Dialog as RadixDialog } from 'radix-ui';
import { Dialog, DialogPortal, DialogOverlay, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Spinner } from '@/components/ui/spinner';
import { Field, FieldLabel } from '@/components/ui/field';
import { cn } from '@/lib/utils';
import { CalendarIcon, GiftIcon, CircleCheckIcon } from 'lucide-react';
import { markPreRegistered } from '@/lib/preregStatus';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SPOTS_TOTAL = 1000;

const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='1'/%3E%3C/svg%3E")`;

export default function PreRegisterModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { language } = useLanguage();
  const t = useT();
  const [email, setEmail]         = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [duplicate, setDuplicate] = useState(false);
  const [loading, setLoading]     = useState(false);
  const [invalid, setInvalid]     = useState(false);
  const [apiError, setApiError]   = useState<string | null>(null);
  const [spotsClaimed, setSpotsClaimed] = useState(123);

  const fetchCount = async () => {
    try {
      const res = await fetch('/api/pre-register');
      if (res.ok) {
        const data = await res.json();
        setSpotsClaimed(data.count ?? 123);
      }
    } catch { /* keep current value */ }
  };

  useEffect(() => {
    // Fetch the spots count once when the modal opens. (Previously polled every 15s, which
    // multiplied across every open modal and helped overwhelm the Supabase REST origin.)
    fetchCount();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!EMAIL_RE.test(email)) { setInvalid(true); return; }
    setInvalid(false);
    setApiError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/pre-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.duplicate) { markPreRegistered(); setDuplicate(true); setSubmitted(true); return; }
      if (!res.ok) { setApiError(data.error ?? 'Something went wrong'); return; }
      markPreRegistered();
      setSpotsClaimed((n) => n + 1);
      setSubmitted(true);
    } catch {
      setApiError('Network error — please try again');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogPortal>
        <DialogOverlay className="bg-black/40 backdrop-blur-sm" />
        <RadixDialog.Content
          onEscapeKeyDown={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          aria-describedby={undefined}
          className={cn(
            'fixed top-1/2 left-1/2 z-50 -translate-x-1/2 -translate-y-1/2 outline-none',
            'w-[1200px] h-[680px]',
            'rounded-2xl shadow-2xl overflow-hidden',
            'flex flex-col md:flex-row',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
            'duration-100'
          )}
        >
          <DialogTitle className="sr-only">Pre-register for Gavelling</DialogTitle>

          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-[#9A8A78] hover:text-[#1C1410] transition-colors z-10"
            aria-label="Close"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>

          {/* ── Left column ── */}
          <div
            className="flex flex-col md:w-[55%] overflow-y-auto"
            style={{ backgroundColor: '#EDE7D8' }}
          >
            {/* Green header band */}
            <div
              className="relative flex flex-col gap-4 px-8 pt-8 pb-7 shrink-0"
              style={{
                background: 'linear-gradient(150deg, #1B3828 0%, #142B1C 65%, #0E1E13 100%)',
              }}
            >
              {/* Grain on green */}
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  backgroundImage: GRAIN,
                  backgroundRepeat: 'repeat',
                  backgroundSize: '300px 300px',
                  mixBlendMode: 'overlay',
                  opacity: 0.07,
                }}
              />

              {/* Badge */}
              <div
                className="relative flex items-center gap-2 w-fit"
                style={{
                  backgroundColor: 'rgba(238, 217, 138, 0.15)',
                  border: '1px solid rgba(238, 217, 138, 0.3)',
                  borderRadius: 9999,
                  padding: '6px 16px',
                }}
              >
                <CalendarIcon size={14} style={{ color: '#EED98A' }} />
                <span
                  className="font-mono tracking-[0.18em] uppercase"
                  style={{ fontSize: 12, color: '#EED98A', fontWeight: 700 }}
                >
                  {t('prereg_badge')}
                </span>
              </div>

              {/* Heading */}
              <h2
                className="relative font-black text-white tracking-tight leading-[0.92]"
                style={{ fontSize: 'clamp(24px, 3vw, 38px)', whiteSpace: 'nowrap' }}
              >
                {t('prereg_heading_1')}{' '}
                <span
                  style={{
                    fontFamily: "'Playfair Display', serif",
                    fontStyle: 'italic',
                    fontWeight: 400,
                    color: '#EED98A',
                  }}
                >
                  {t('prereg_heading_2')}
                </span>
              </h2>
            </div>

            {/* Body */}
            <div className="flex flex-col flex-1 px-8 py-8" style={{ gap: 0 }}>
              <div className="flex flex-col gap-6">
                {/* Scarcity alert */}
                <Alert style={{ backgroundColor: 'rgba(27, 56, 40, 0.06)', border: '1px solid rgba(27, 56, 40, 0.18)' }}>
                  <GiftIcon size={16} style={{ color: '#1B3828' }} />
                  <AlertTitle style={{ color: '#1C1410' }}>
                    {t('prereg_alert_title_1')}{' '}
                    <span style={{ color: '#1B3828', fontWeight: 800 }}>{t('prereg_alert_title_free')}</span>
                    {' '}
                    <span style={{ color: '#B6871F', fontWeight: 800 }}>{t('prereg_alert_title_feefree')}</span>
                  </AlertTitle>
                  <AlertDescription style={{ color: '#6A5A4A' }}>
                    {t('prereg_alert_desc_1')}{' '}
                    <span
                      className="font-black tracking-wide"
                      style={{ color: '#1B3828', letterSpacing: '0.04em' }}
                    >
                      {t('prereg_alert_desc_product')}
                    </span>
                    {' '}{t('prereg_alert_desc_2')}
                  </AlertDescription>
                </Alert>

                {/* Progress */}
                <div className="flex flex-col gap-2">
                  <Progress value={(spotsClaimed / SPOTS_TOTAL) * 100} />
                  <p className="text-xs" style={{ color: '#9A8A78' }}>
                    {t('prereg_spots_claimed').replace('{n}', String(spotsClaimed)).replace('{total}', SPOTS_TOTAL.toLocaleString()).replace('{remaining}', String(SPOTS_TOTAL - spotsClaimed))}
                  </p>
                </div>
              </div>

              {/* Spacer */}
              <div className="flex-1" />

              {/* Form */}
              <div className="flex flex-col gap-3">
                {submitted ? (
                  <div
                    className="flex flex-col gap-2 rounded-xl px-5 py-4"
                    style={{
                      backgroundColor: duplicate ? 'rgba(182,135,31,0.08)' : 'rgba(27, 56, 40, 0.08)',
                      border: duplicate ? '1px solid rgba(182,135,31,0.3)' : '1px solid rgba(27, 56, 40, 0.2)',
                    }}
                  >
                    <div className="flex items-center gap-2.5" style={{ color: duplicate ? '#B6871F' : '#1B3828' }}>
                      <CircleCheckIcon size={20} className="shrink-0" />
                      <span className="font-bold text-sm">
                        {duplicate ? t('prereg_success_duplicate') : t('prereg_success_new')}
                      </span>
                    </div>
                    <p className="text-xs ps-[28px]" style={{ color: '#9A8A78' }}>{email}</p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
                    <Field>
                      <FieldLabel htmlFor="preregister-email" className="sr-only">
                        Email address
                      </FieldLabel>
                      <input
                        id="preregister-email"
                        type="email"
                        placeholder="your@email.com"
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); setInvalid(false); }}
                        aria-invalid={invalid || undefined}
                        autoComplete="email"
                        disabled={loading}
                        style={{
                          width: '100%',
                          padding: '13px 16px',
                          fontSize: 15,
                          borderRadius: 12,
                          border: invalid
                            ? '1.5px solid #dc2626'
                            : '1.5px solid rgba(28, 20, 16, 0.2)',
                          backgroundColor: 'rgba(255, 255, 255, 0.7)',
                          color: '#1C1410',
                          outline: 'none',
                          transition: 'border-color 150ms ease',
                        }}
                      />
                    </Field>

                    <button
                      type="submit"
                      disabled={loading}
                      aria-label={loading ? 'Submitting…' : undefined}
                      onMouseEnter={(e) => {
                        if (loading) return;
                        (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C';
                        (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
                        (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(27, 56, 40, 0.35)';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828';
                        (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                        (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 14px rgba(27, 56, 40, 0.25)';
                      }}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        backgroundColor: '#1B3828',
                        color: '#EED98A',
                        fontWeight: 800,
                        fontSize: 16,
                        letterSpacing: '0.04em',
                        padding: '14px 24px',
                        borderRadius: 12,
                        border: 'none',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        opacity: loading ? 0.7 : 1,
                        transition: 'all 200ms ease',
                        boxShadow: '0 4px 14px rgba(27, 56, 40, 0.25)',
                      }}
                    >
                      {loading ? <Spinner style={{ color: '#EED98A' }} /> : t('prereg_btn')}
                    </button>

                    {apiError && (
                      <p className="text-xs text-center text-red-500">{apiError}</p>
                    )}
                    <p className="text-xs text-center" style={{ color: '#9A8A78' }}>
                      {t('prereg_no_spam')}
                    </p>
                  </form>
                )}
              </div>
            </div>
          </div>

          {/* ── Right column ── */}
          <div
            className="flex flex-col md:w-[45%]"
            style={{ backgroundColor: '#EDE7D8' }}
          >
            {/* Desktop image — fills full column height */}
            <div className="hidden md:flex flex-1 relative overflow-hidden items-end justify-center">
              {/* Glass panel behind otter */}
              <div
                style={{
                  position: 'absolute',
                  inset: '5%',
                  borderRadius: 24,
                  background: 'rgba(255, 255, 255, 0.18)',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255, 255, 255, 0.35)',
                  boxShadow: '0 8px 32px rgba(27, 56, 40, 0.08)',
                }}
              />
              <img
                src="/Otter-Preregister.png"
                alt="Gavelling mascot"
                style={{
                  position: 'relative',
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  objectPosition: 'bottom center',
                  display: 'block',
                }}
              />
            </div>

            {/* Mobile image */}
            <div className="flex md:hidden relative overflow-hidden" style={{ aspectRatio: '16/9' }}>
              <img
                src="/Otter-Preregister.png"
                alt="Gavelling mascot"
                style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
            </div>

            {/* Mobile badge */}
            <div
              className="flex md:hidden items-center gap-2 px-6 py-4"
              style={{ borderTop: '1px solid rgba(28, 20, 16, 0.12)' }}
            >
              <CalendarIcon size={14} style={{ color: '#1B3828' }} />
              <span
                className="font-mono tracking-[0.16em] uppercase"
                style={{ fontSize: 11, color: '#1B3828', fontWeight: 700 }}
              >
                {t('prereg_badge')}
              </span>
            </div>
          </div>

        </RadixDialog.Content>
      </DialogPortal>
    </Dialog>
  );
}
