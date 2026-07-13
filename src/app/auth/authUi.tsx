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
import { useState } from 'react';
import { ArrowLeft, Globe2, CalendarCheck } from 'lucide-react';

export const OUTFIT = "'Outfit', sans-serif";

// ── Brand marks ────────────────────────────────────────────────────────────

/** Card header: gavel mark + GAVELLING / CONFERENCES lockup. */
export function ConferencesWordmark() {
  return (
    <Link href="/" className="flex flex-col items-center gap-2" style={{ textDecoration: 'none' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/gavel-mark.png" alt="" aria-hidden className="h-12 w-12 object-contain" />
      <span className="flex flex-col items-center leading-none">
        <span
          style={{
            fontFamily: OUTFIT,
            fontWeight: 900,
            fontSize: '21px',
            letterSpacing: '0.04em',
            color: '#1B3828',
          }}
        >
          GAVELLING
        </span>
        <span
          style={{
            fontFamily: OUTFIT,
            fontWeight: 700,
            fontSize: '10px',
            letterSpacing: '0.34em',
            color: '#B6871F',
            marginTop: '5px',
            textIndent: '0.34em', // visually recentres the tracked-out text
          }}
        >
          CONFERENCES
        </span>
      </span>
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
      className="min-h-screen w-full lg:grid relative"
      style={{ backgroundColor: '#EDE7D8', gridTemplateColumns: '46% 54%' }}
    >
      <BrandPanel eyebrow={eyebrow} headline={headline} sub={sub} />

      <div className="relative flex items-center justify-center px-5 py-10 md:px-8 lg:py-12 min-h-screen lg:min-h-0">
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
        {/* Soft gold radial glow behind the card */}
        <div
          className="pointer-events-none absolute z-0"
          style={{
            width: '520px', height: '520px', borderRadius: '9999px',
            background: 'radial-gradient(circle, rgba(238,217,138,0.30) 0%, rgba(238,217,138,0) 68%)',
            filter: 'blur(8px)',
          }}
        />

        <div className="relative z-10 w-full max-w-md">
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
      className="relative overflow-hidden h-[190px] sm:h-[230px] lg:h-auto lg:min-h-screen"
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

export function GoogleButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-center gap-3 rounded-xl py-3 font-bold text-sm tracking-widest transition-colors focus:outline-none"
      style={{
        backgroundColor: '#1B3828',
        color: '#EED98A',
        fontFamily: OUTFIT,
        letterSpacing: '0.08em',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
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
