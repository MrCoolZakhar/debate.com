'use client';

import { useState } from 'react';
import { Dialog as RadixDialog } from 'radix-ui';
import { Dialog, DialogPortal, DialogOverlay, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Spinner } from '@/components/ui/spinner';
import { Field, FieldLabel } from '@/components/ui/field';
import { cn } from '@/lib/utils';
import { CalendarIcon, GiftIcon, CircleCheckIcon } from 'lucide-react';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SPOTS_CLAIMED = 153;
const SPOTS_TOTAL = 1000;
const PROGRESS_VALUE = (SPOTS_CLAIMED / SPOTS_TOTAL) * 100;

const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='1'/%3E%3C/svg%3E")`;

export default function PreRegisterModal({ open = true }: { open?: boolean }) {
  const [email, setEmail]         = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading]     = useState(false);
  const [invalid, setInvalid]     = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!EMAIL_RE.test(email)) { setInvalid(true); return; }
    setInvalid(false);
    setLoading(true);
    setTimeout(() => { setLoading(false); setSubmitted(true); }, 800);
  };

  return (
    <Dialog open={open}>
      <DialogPortal>
        <DialogOverlay className="bg-black/40 backdrop-blur-sm" />
        <RadixDialog.Content
          onEscapeKeyDown={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          aria-describedby={undefined}
          className={cn(
            'fixed top-1/2 left-1/2 z-50 -translate-x-1/2 -translate-y-1/2 outline-none',
            'w-[95vw] max-w-[95vw] max-h-[90vh]',
            'rounded-2xl shadow-2xl overflow-hidden',
            'flex flex-col md:flex-row',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
            'duration-100'
          )}
        >
          <DialogTitle className="sr-only">Pre-register for Gavelling</DialogTitle>

          {/* ── Left column ── */}
          <div
            className="flex flex-col md:w-[55%] overflow-y-auto"
            style={{ backgroundColor: '#EDE7D8' }}
          >
            {/* Green header band */}
            <div
              className="relative flex flex-col gap-5 px-8 pt-10 pb-8 shrink-0"
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
                  Coming August 2026
                </span>
              </div>

              {/* Heading */}
              <h2
                className="relative font-black text-white tracking-tight leading-[0.92]"
                style={{ fontSize: 'clamp(32px, 4vw, 52px)' }}
              >
                The committee room,{' '}
                <span
                  style={{
                    fontFamily: "'Playfair Display', serif",
                    fontStyle: 'italic',
                    fontWeight: 400,
                    color: '#EED98A',
                  }}
                >
                  reimagined.
                </span>
              </h2>
            </div>

            {/* Body */}
            <div className="flex flex-col justify-between gap-6 flex-1 px-8 py-8">
              <div className="flex flex-col gap-6">
                {/* Subheading */}
                <p className="text-base leading-relaxed" style={{ color: '#6A5A4A' }}>
                  Gavelling brings professional MUN committee management to every conference — chair tools, delegate flows, live voting, and more.
                </p>

                {/* Scarcity alert */}
                <Alert style={{ backgroundColor: 'rgba(27, 56, 40, 0.06)', border: '1px solid rgba(27, 56, 40, 0.18)' }}>
                  <GiftIcon size={16} style={{ color: '#1B3828' }} />
                  <AlertTitle style={{ color: '#1C1410' }}>
                    First 1,000 users get 6 months free
                  </AlertTitle>
                  <AlertDescription style={{ color: '#6A5A4A' }}>
                    Pre-register now to unlock{' '}
                    <span
                      className="font-black tracking-wide"
                      style={{ color: '#1B3828', letterSpacing: '0.04em' }}
                    >
                      GAVELLING UNLIMITED
                    </span>
                    {' '}before accounts open in August 2026.
                  </AlertDescription>
                </Alert>

                {/* Progress */}
                <div className="flex flex-col gap-2">
                  <Progress value={PROGRESS_VALUE} />
                  <p className="text-xs" style={{ color: '#9A8A78' }}>
                    <span className="font-semibold" style={{ color: '#1C1410' }}>{SPOTS_CLAIMED}</span>
                    {' '}of{' '}
                    <span className="font-semibold" style={{ color: '#1C1410' }}>{SPOTS_TOTAL.toLocaleString()}</span>
                    {' '}spots claimed ·{' '}
                    <span className="font-semibold" style={{ color: '#1B3828' }}>{SPOTS_TOTAL - SPOTS_CLAIMED} remaining</span>
                  </p>
                </div>
              </div>

              {/* Form */}
              <div className="flex flex-col gap-3">
                {submitted ? (
                  <div
                    className="flex flex-col gap-2 rounded-xl px-5 py-4"
                    style={{ backgroundColor: 'rgba(27, 56, 40, 0.08)', border: '1px solid rgba(27, 56, 40, 0.2)' }}
                  >
                    <div className="flex items-center gap-2.5" style={{ color: '#1B3828' }}>
                      <CircleCheckIcon size={20} className="shrink-0" />
                      <span className="font-bold text-sm">You're on the list. See you in August.</span>
                    </div>
                    <p className="text-xs pl-[28px]" style={{ color: '#9A8A78' }}>{email}</p>
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
                      {loading ? <Spinner style={{ color: '#EED98A' }} /> : 'Pre-register →'}
                    </button>

                    <p className="text-xs text-center" style={{ color: '#9A8A78' }}>
                      No spam. We'll only email you when accounts open.
                    </p>
                  </form>
                )}
              </div>
            </div>
          </div>

          {/* ── Right column ── */}
          <div
            className="flex flex-col md:w-[45%]"
            style={{ backgroundColor: '#DDD4C0' }}
          >
            {/* Desktop image — fills full column height */}
            <div className="hidden md:flex flex-1 relative overflow-hidden">
              <img
                src="/GavelHero.png"
                alt="Golden gavel on podium with floating flag icons"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                }}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                  const placeholder = e.currentTarget.nextElementSibling as HTMLElement;
                  if (placeholder) placeholder.style.display = 'flex';
                }}
              />
              {/* Fallback placeholder shown until GavelHero.png is added */}
              <div
                className="absolute inset-0 items-center justify-center"
                style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '0 32px' }}
              >
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: '50%',
                    border: '2px dashed rgba(27, 56, 40, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <GiftIcon size={24} style={{ color: 'rgba(27, 56, 40, 0.4)' }} />
                </div>
                <p
                  className="text-center text-sm italic leading-relaxed"
                  style={{ color: 'rgba(27, 56, 40, 0.45)' }}
                >
                  Add <strong style={{ fontStyle: 'normal' }}>GavelHero.png</strong> to{' '}
                  <code style={{ fontSize: 11 }}>/public</code> to show the illustration here
                </p>
              </div>
            </div>

            {/* Mobile image */}
            <div className="flex md:hidden relative overflow-hidden" style={{ aspectRatio: '16/9' }}>
              <img
                src="/GavelHero.png"
                alt="Golden gavel on podium with floating flag icons"
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
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
                Coming August 2026
              </span>
            </div>
          </div>

        </RadixDialog.Content>
      </DialogPortal>
    </Dialog>
  );
}
