'use client';

/**
 * authUi.tsx — shared layout + primitives for the auth surface
 * (/auth/signin, /auth/signup, /auth/forgot, /auth/reset).
 *
 * GAVELLING CONFERENCES branding: the split-screen brand panel keeps the
 * gavel mark ONLY in its corner (no wordmark text), and the glass card
 * carries the mark + "GAVELLING" with a gold, letter-spaced CONFERENCES
 * eyebrow underneath.
 */

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Globe2, CalendarCheck, MailCheck, RotateCw, Sparkles, Star } from 'lucide-react';
import DecorativeBleed from '@/components/DecorativeBleed';

export const OUTFIT = "'Outfit', sans-serif";

// ── Return-to (`?next=`) handling ────────────────────────────────────────────
// Shared by /auth/signin and /auth/signup so a logged-out visitor's intended
// destination (e.g. a conference's apply page) survives hopping between the
// two pages, not just a single page's own submit handler.

/** Reads and sanitizes `?next=` — only a same-origin relative path is honored
 *  (prevents open-redirect); anything else falls back to `fallback`. */
export function safeNext(searchParams: URLSearchParams, fallback: string): string {
  const raw = searchParams.get('next');
  return raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : fallback;
}

/** Appends the current page's `?next=` (only if one was actually supplied and
 *  valid) to a same-site auth link, so switching between sign-in and sign-up
 *  never drops the visitor's return-to destination. */
export function withNext(href: string, searchParams: URLSearchParams): string {
  const raw = searchParams.get('next');
  const valid = raw && raw.startsWith('/') && !raw.startsWith('//');
  const parts: string[] = [];
  if (valid) parts.push(`next=${encodeURIComponent(raw)}`);
  // Carry the apply context across sign-in <-> sign-up so the "continue your
  // application" banner survives the hop; losing it here is what made the
  // round trip look like the link had gone wrong.
  if (searchParams.get('apply') === '1') parts.push('apply=1');
  return parts.length ? `${href}?${parts.join('&')}` : href;
}

// ── Brand marks ────────────────────────────────────────────────────────────

/** Card header: the real GAVELLING CONFERENCES logo lockup (same mark the
 *  footer and SiteNav use), on the ivory glass card. */
export function ConferencesWordmark() {
  return (
    <Link href="/" className="flex flex-col items-center" style={{ textDecoration: 'none' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/Conferences.webp"
        alt="Gavelling Conferences"
        width={184}
        height={46}
        decoding="async"
        style={{ height: 46, width: 'auto', objectFit: 'contain' }}
        onError={(e) => {
          // .webp can intermittently fail to decode; fall back to the .png
          // once before giving up, never hide the brand outright.
          const img = e.currentTarget as HTMLImageElement;
          if (!img.src.endsWith('/Conferences.png')) img.src = '/Conferences.png';
          else img.style.display = 'none';
        }}
      />
    </Link>
  );
}

// ── Split-screen layout ────────────────────────────────────────────────────

export function AuthLayout({
  eyebrow,
  headline,
  sub,
  children,
}: {
  eyebrow: string;
  headline: string;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="min-h-dvh w-full flex flex-col lg:grid lg:h-dvh relative"
      style={{ backgroundColor: '#EDE7D8', gridTemplateColumns: '46% 54%' }}
    >
      <BrandPanel eyebrow={eyebrow} headline={headline} sub={sub} />

      {/* Freeze-the-frame: on lg+ the shell is exactly one viewport tall and
          THIS form column scrolls internally when the card is taller than the
          screen (short laptops, projectors, keyboard open). Vertical centering
          is done with my-auto on the card (below), NOT align-items:center —
          align-items:center would clip and make the overflowed top unreachable. */}
      <div className="relative flex justify-center px-5 py-10 md:px-8 lg:py-12 flex-1 lg:overflow-y-auto" style={{ overflowX: 'clip' }}>
        {/* Decorative-only layer: bleed icons, grain and the glow all sit in
            their own inset-0, overflow-clipped box. Clipping lives HERE, not
            on the flex-1 content wrapper, because the Sparkles bleed item
            below intentionally pokes past its box (bottom: -30px) — left
            unclipped that adds real scrollable page height even when the
            card fits. The real card content is a sibling outside this box so
            it keeps its natural ability to overflow and scroll on short
            viewports (mobile keyboard open, small laptops). */}
        <div className="absolute inset-0 pointer-events-none" style={{ overflow: 'clip' }}>
          {/* Decorative bleed — faded forest glyphs drifting off the edges,
              behind the z-10 glass card. */}
          <DecorativeBleed
            items={[
              { Icon: Globe2, size: 170, top: '-42px', left: '-40px', opacity: 0.05 },
              { Icon: Sparkles, size: 120, bottom: '-30px', right: '-24px', opacity: 0.045 },
              { Icon: Star, size: 90, top: '18%', right: '6%', opacity: 0.04, rotate: 12 },
            ]}
          />
          {/* Grain texture */}
          <div
            className="pointer-events-none absolute inset-0 z-0"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='1'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'repeat',
              backgroundSize: '300px 300px',
              mixBlendMode: 'multiply',
              opacity: 0.18,
            }}
          />
          {/* Soft gold radial glow behind the card, centered on the box */}
          <div
            className="pointer-events-none absolute z-0"
            style={{
              top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
              width: '520px', height: '520px', borderRadius: '9999px',
              background: 'radial-gradient(circle, rgba(238,217,138,0.30) 0%, rgba(238,217,138,0) 68%)',
              filter: 'blur(8px)',
            }}
          />
        </div>

        <div className="relative z-10 w-full max-w-md my-auto">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-semibold mb-5 focus:outline-none"
            style={{ color: '#9A8A78', fontFamily: OUTFIT, textDecoration: 'none' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#1B3828'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#9A8A78'; }}
          >
            <ArrowLeft size={15} /> Back
          </Link>

          {/* Glass card */}
          <div
            style={{
              backgroundColor: 'rgba(250,248,243,0.82)',
              backdropFilter: 'blur(14px) saturate(1.4)',
              WebkitBackdropFilter: 'blur(14px) saturate(1.4)',
              border: '1.5px solid #D8CDB6',
              borderRadius: '20px',
              boxShadow: '0 1px 3px rgba(27,56,40,0.07), 0 12px 32px rgba(27,56,40,0.10)',
              padding: '38px 34px',
            }}
          >
            <div className="flex justify-center mb-6">
              <ConferencesWordmark />
            </div>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function BrandPanel({ eyebrow, headline, sub }: { eyebrow: string; headline: string; sub: string }) {
  return (
    <div
      className="relative overflow-hidden h-[190px] sm:h-[230px] lg:h-auto lg:min-h-dvh flex-shrink-0"
      style={{ backgroundColor: '#14241B' }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/landing/podium-speaker.jpg"
        alt=""
        aria-hidden
        className="absolute inset-0 w-full h-full object-cover"
        style={{ objectPosition: 'center 30%' }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(160deg, rgba(20,36,27,0.62) 0%, rgba(18,32,24,0.78) 55%, rgba(10,22,16,0.94) 100%)',
        }}
      />
      <div
        className="absolute pointer-events-none"
        style={{
          top: '-120px', left: '-120px', width: '380px', height: '380px', borderRadius: '9999px',
          background: 'radial-gradient(circle, rgba(238,217,138,0.22) 0%, rgba(238,217,138,0) 70%)',
        }}
      />

      <div className="relative z-10 h-full flex flex-col justify-between p-7 sm:p-9 lg:p-12">
        {/* Corner logo: gavel mark ONLY, no text */}
        <div>
          <span
            className="inline-flex items-center justify-center rounded-2xl"
            style={{
              width: '52px', height: '52px',
              backgroundColor: 'rgba(250,248,243,0.92)',
              border: '1.5px solid rgba(238,217,138,0.5)',
              boxShadow: '0 4px 14px rgba(0,0,0,0.28)',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/gavel-mark.png" alt="Gavelling" className="h-9 w-9 object-contain" />
          </span>
        </div>

        <div className="hidden lg:block max-w-[420px]">
          <p
            className="mb-3"
            style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: '10.5px', letterSpacing: '0.14em', color: '#EED98A', textTransform: 'uppercase' }}
          >
            {eyebrow}
          </p>
          <h2
            className="font-black leading-[1.08] mb-4"
            style={{ color: '#FAF8F3', fontFamily: OUTFIT, fontSize: '40px', textShadow: '0 2px 20px rgba(0,0,0,0.4)' }}
          >
            {headline}
          </h2>
          <p
            className="text-sm leading-relaxed"
            style={{ color: 'rgba(237,231,216,0.86)', fontFamily: OUTFIT, maxWidth: '360px' }}
          >
            {sub}
          </p>
        </div>

        <div className="flex items-center gap-6 sm:gap-8">
          <BrandStat icon={<Globe2 size={15} color="#EED98A" />} value="120+" label="Countries" />
          <span className="hidden sm:block" style={{ width: '1px', height: '30px', backgroundColor: 'rgba(238,217,138,0.28)' }} />
          <BrandStat icon={<CalendarCheck size={15} color="#EED98A" />} value="Conferences" label="Run end-to-end" />
        </div>
      </div>
    </div>
  );
}

function BrandStat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className="flex items-center justify-center rounded-lg flex-shrink-0"
        style={{ width: '30px', height: '30px', backgroundColor: 'rgba(238,217,138,0.12)', border: '1px solid rgba(238,217,138,0.3)' }}
      >
        {icon}
      </span>
      <div className="leading-tight">
        <p className="font-bold text-sm" style={{ color: '#FAF8F3', fontFamily: OUTFIT }}>{value}</p>
        <p className="text-[11px]" style={{ color: 'rgba(237,231,216,0.66)', fontFamily: OUTFIT }}>{label}</p>
      </div>
    </div>
  );
}

// ── Form primitives ────────────────────────────────────────────────────────

export const inputStyle: React.CSSProperties = {
  backgroundColor: '#FAF8F3',
  border: '1.5px solid #DDD4C0',
  color: '#1C1410',
  fontFamily: OUTFIT,
};

export function focusInput(e: React.FocusEvent<HTMLElement>) {
  (e.currentTarget as HTMLElement).style.borderColor = '#1B3828';
}
export function blurInput(e: React.FocusEvent<HTMLElement>) {
  (e.currentTarget as HTMLElement).style.borderColor = '#DDD4C0';
}

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-sm font-semibold mb-1.5" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
      {children}
    </label>
  );
}

export function ErrorBanner({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mb-4 px-4 py-3 rounded-xl text-sm text-center"
      style={{
        backgroundColor: 'rgba(139, 32, 32, 0.08)',
        border: '1px solid rgba(139, 32, 32, 0.2)',
        color: '#8B2020',
        fontFamily: OUTFIT,
      }}
    >
      {children}
    </div>
  );
}

export function PrimaryButton({
  loading,
  children,
  loadingText,
}: {
  loading: boolean;
  children: React.ReactNode;
  loadingText: string;
}) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full rounded-xl py-3 font-bold text-sm tracking-widest transition-colors focus:outline-none"
      style={{
        backgroundColor: loading ? '#DDD4C0' : '#1B3828',
        color: loading ? '#9A8A78' : '#EED98A',
        fontFamily: OUTFIT,
        letterSpacing: '0.08em',
      }}
      onMouseEnter={(e) => { if (!loading) (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
      onMouseLeave={(e) => { if (!loading) (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
    >
      {loading ? loadingText : children}
    </button>
  );
}

/** Primary button driven by an onClick handler (vs. PrimaryButton's submit). */
export function PrimaryActionButton({
  children,
  loading,
  loadingText,
  onClick,
}: {
  children: React.ReactNode;
  loading?: boolean;
  loadingText?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="w-full rounded-xl py-3 font-bold text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      style={{
        backgroundColor: loading ? '#DDD4C0' : '#1B3828',
        color: loading ? '#9A8A78' : '#EED98A',
        fontFamily: OUTFIT,
        letterSpacing: '0.08em',
        outlineColor: '#1B3828',
      }}
      onMouseEnter={(e) => { if (!loading) (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
      onMouseLeave={(e) => { if (!loading) (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
    >
      {loading ? loadingText : children}
    </button>
  );
}

/** Primary-styled link (for CTA navigation like "Request a new link"). */
export function PrimaryLinkButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="w-full inline-flex items-center justify-center rounded-xl py-3 font-bold text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      style={{
        backgroundColor: '#1B3828',
        color: '#EED98A',
        fontFamily: OUTFIT,
        letterSpacing: '0.08em',
        textDecoration: 'none',
        outlineColor: '#1B3828',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
    >
      {children}
    </Link>
  );
}

export function GoogleButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-center justify-center gap-3 rounded-xl py-3 font-bold text-sm tracking-widest transition-colors focus:outline-none"
      style={{
        backgroundColor: '#1B3828',
        color: '#EED98A',
        fontFamily: OUTFIT,
        letterSpacing: '0.08em',
        opacity: disabled ? 0.6 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
      onMouseEnter={(e) => { if (!disabled) (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
      onMouseLeave={(e) => { if (!disabled) (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
    >
      <GoogleIcon />
      {label}
    </button>
  );
}

export function OrDivider() {
  return (
    <div className="flex items-center gap-3 my-5">
      <div className="flex-1 h-px" style={{ backgroundColor: '#DDD4C0' }} />
      <span className="text-xs font-medium" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>or</span>
      <div className="flex-1 h-px" style={{ backgroundColor: '#DDD4C0' }} />
    </div>
  );
}

export function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.2045C17.64 8.5663 17.5827 7.9527 17.4764 7.3636H9V10.845H13.8436C13.635 11.97 13.0009 12.9231 12.0477 13.5613V15.8195H14.9564C16.6582 14.2527 17.64 11.9454 17.64 9.2045Z" fill="#4285F4"/>
      <path d="M9 18C11.43 18 13.4673 17.1941 14.9564 15.8195L12.0477 13.5613C11.2418 14.1013 10.2109 14.4204 9 14.4204C6.65591 14.4204 4.67182 12.8372 3.96409 10.71H0.957275V13.0418C2.43818 15.9831 5.48182 18 9 18Z" fill="#34A853"/>
      <path d="M3.96409 10.71C3.78409 10.17 3.68182 9.5931 3.68182 9C3.68182 8.4068 3.78409 7.8299 3.96409 7.29V4.9581H0.957275C0.347727 6.1731 0 7.5477 0 9C0 10.4522 0.347727 11.8268 0.957275 13.0418L3.96409 10.71Z" fill="#FBBC05"/>
      <path d="M9 3.5795C10.3214 3.5795 11.5077 4.0336 12.4405 4.9254L15.0218 2.344C13.4632 0.8918 11.4259 0 9 0C5.48182 0 2.43818 2.0168 0.957275 4.9581L3.96409 7.29C4.67182 5.1627 6.65591 3.5795 9 3.5795Z" fill="#EA4335"/>
    </svg>
  );
}

/** Labelled text input with the shared focus/blur border treatment. */
export function TextField({
  label,
  hint,
  ...props
}: { label: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <input
        {...props}
        className="w-full rounded-xl px-4 py-3 text-sm transition-colors focus:outline-none"
        style={inputStyle}
        onFocus={focusInput}
        onBlur={blurInput}
      />
      {hint && (
        <p className="text-xs mt-1" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>{hint}</p>
      )}
    </div>
  );
}

/** Labelled password input with a show/hide eye toggle. */
export function PasswordField({
  label,
  value,
  onChange,
  placeholder,
  minLength,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  minLength?: number;
  autoComplete?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          required
          minLength={minLength}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          className="w-full rounded-xl px-4 py-3 text-sm transition-colors focus:outline-none pr-11"
          style={inputStyle}
          onFocus={focusInput}
          onBlur={blurInput}
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? 'Hide password' : 'Show password'}
          className="absolute right-3 top-1/2 -translate-y-1/2 focus:outline-none"
          style={{ color: '#9A8A78' }}
        >
          {show ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
    </div>
  );
}

export function CardHeading({ title, sub }: { title: string; sub: string }) {
  return (
    <>
      <h1 className="text-xl font-semibold text-center mb-1" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
        {title}
      </h1>
      <p className="text-sm text-center mb-6" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
        {sub}
      </p>
    </>
  );
}

export function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

// ── Email validation ───────────────────────────────────────────────────────

/**
 * Rejects junk like "dddddddd@gma" or "a@b". Requires a local part, an @,
 * a domain label, a dot, and a TLD of at least two letters. Intentionally
 * stricter than the browser's built-in type="email" check, which accepts
 * TLD-less addresses like "you@localhost".
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(email.trim());
}

// ── Cooldown + toast primitives ────────────────────────────────────────────

/**
 * Countdown timer for resend cooldowns. `start()` seeds `seconds`; the value
 * ticks to 0 and the interval cleans itself up (no leak — the effect re-runs
 * on every decrement and clears the previous interval).
 */
export function useCooldown(seconds = 60) {
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    if (remaining <= 0) return;
    const id = setInterval(() => {
      setRemaining((r) => (r <= 1 ? 0 : r - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [remaining]);
  const start = useCallback(() => setRemaining(seconds), [seconds]);
  return { remaining, start, active: remaining > 0 };
}

/** Ephemeral confirmation message that clears itself after `ms`. */
export function useToast(ms = 3500) {
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(''), ms);
    return () => clearTimeout(t);
  }, [message, ms]);
  const show = useCallback((m: string) => setMessage(m), []);
  return { message, show };
}

/**
 * Fixed, screen-reader-announced toast. The live region is always mounted so
 * assistive tech announces the message when it appears.
 */
export function Toast({ message }: { message: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed left-1/2 bottom-6 z-[60] -translate-x-1/2 px-1 pointer-events-none w-full max-w-xs"
      style={{ display: 'flex', justifyContent: 'center' }}
    >
      {message && (
        <div
          style={{
            backgroundColor: '#1B3828',
            color: '#EED98A',
            fontFamily: OUTFIT,
            fontSize: '13px',
            fontWeight: 600,
            padding: '10px 18px',
            borderRadius: '9999px',
            boxShadow: '0 8px 24px rgba(27,56,40,0.28)',
            border: '1px solid rgba(238,217,138,0.35)',
            animation: 'auth-toast-in 220ms ease',
          }}
        >
          {message}
        </div>
      )}
      <style>{`
        @keyframes auth-toast-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

// ── Notice / centred-state primitives ──────────────────────────────────────

/** Round icon badge used at the top of centred notice screens. */
export function IconBadge({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
      style={{ backgroundColor: 'rgba(27, 56, 40, 0.1)' }}
    >
      {children}
    </div>
  );
}

/** Secondary (outline) button — used for resend and other lower-emphasis actions. */
export function SecondaryButton({
  children,
  disabled,
  onClick,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-xl py-3 font-bold text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      style={{
        backgroundColor: 'transparent',
        color: disabled ? '#B6AC98' : '#1B3828',
        border: `1.5px solid ${disabled ? '#DDD4C0' : '#1B3828'}`,
        fontFamily: OUTFIT,
        letterSpacing: '0.06em',
        cursor: disabled ? 'default' : 'pointer',
        outlineColor: '#1B3828',
      }}
      onMouseEnter={(e) => { if (!disabled) (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.06)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
      {...rest}
    >
      {children}
    </button>
  );
}

/**
 * Generic centred notice (icon + title + body + action slot). Used for the
 * verified-success, expired-link and callback-error states.
 */
export function NoticeScreen({
  icon,
  title,
  children,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="text-center">
      <IconBadge>{icon}</IconBadge>
      <h1 className="text-lg font-semibold mb-2" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
        {title}
      </h1>
      <div className="text-sm leading-relaxed" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
        {children}
      </div>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

/** Green check mark used across success states. */
export function CheckMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#1B3828" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

/**
 * Shared "Check your email" screen with a resend button (60s cooldown + toast).
 * Used by both /auth/signup (awaiting verification) and /auth/forgot.
 *
 * `onResend` performs the actual resend and returns an error message to show
 * inline, or null on success. For the forgot-password flow the caller swallows
 * errors and always returns null so account existence is never revealed.
 */
export function CheckEmailScreen({
  email,
  intro,
  onResend,
  footer,
}: {
  email: string;
  intro: React.ReactNode;
  onResend: () => Promise<string | null>;
  footer?: React.ReactNode;
}) {
  const { remaining, active, start } = useCooldown(60);
  const { message: toast, show } = useToast();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function handleResend() {
    if (active || busy) return;
    setErr('');
    setBusy(true);
    const error = await onResend();
    setBusy(false);
    if (error) {
      setErr(error);
      return;
    }
    start();
    show('Sent — check your inbox');
  }

  return (
    <div className="text-center">
      <IconBadge>
        <MailCheck size={24} color="#1B3828" strokeWidth={2} />
      </IconBadge>
      <h1 className="text-xl font-semibold mb-2" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
        Check your email
      </h1>
      <p className="text-sm leading-relaxed mb-1" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
        {intro}
      </p>
      <p className="text-sm font-semibold mb-5 break-words" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
        {email}
      </p>

      {err && <div className="mb-4"><ErrorBanner>{err}</ErrorBanner></div>}

      <SecondaryButton onClick={handleResend} disabled={active || busy}>
        <span className="inline-flex items-center justify-center gap-2">
          <RotateCw size={15} className={busy ? 'animate-spin' : ''} />
          {busy ? 'SENDING…' : active ? `RESEND EMAIL (${remaining}s)` : 'RESEND EMAIL'}
        </span>
      </SecondaryButton>

      {/* Live region so screen readers hear the countdown / ready state. */}
      <p aria-live="polite" className="text-xs mt-2" style={{ color: '#B6AC98', fontFamily: OUTFIT, minHeight: '1.2em' }}>
        {active ? `You can resend in ${remaining} second${remaining === 1 ? '' : 's'}.` : 'Didn’t get it? Check spam, or resend.'}
      </p>

      {footer && <div className="mt-4">{footer}</div>}

      <Toast message={toast} />
    </div>
  );
}
