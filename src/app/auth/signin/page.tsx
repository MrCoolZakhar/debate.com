'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createAuthClient } from '@/lib/supabase-auth';

function SignInInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasCallbackError = searchParams.get('error') === 'auth_callback_failed';
  const rawNext = searchParams.get('next');
  // Only allow relative paths (must start with a single "/") to prevent open-redirect.
  const next = rawNext && rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const supabase = createAuthClient();

  async function handleGoogleSignIn() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
  }

  async function handleEmailSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setError(error.message);
    else router.push(next);
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-12 relative"
      style={{ backgroundColor: '#EDE7D8' }}
    >
      {/* Grain texture */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='1'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '300px 300px',
          mixBlendMode: 'multiply',
          opacity: 0.18,
        }}
      />

      {/* Back link */}
      <Link
        href="/"
        className="relative z-10 flex items-center gap-1.5 text-sm font-semibold mb-6 self-start focus:outline-none"
        style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif", textDecoration: 'none' }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#1B3828'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#9A8A78'; }}
      >
        ← Back
      </Link>

      {/* Card */}
      <div
        className="relative z-10 w-full max-w-md"
        style={{
          backgroundColor: '#FAF8F3',
          border: '1px solid #DDD4C0',
          borderRadius: '16px',
          boxShadow: '0 8px 40px rgba(28, 20, 16, 0.10), 0 2px 8px rgba(28, 20, 16, 0.06)',
          padding: '40px 36px',
        }}
      >
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <Link href="/">
            <img
              src="/GavellingLogo.png"
              alt="Gavelling"
              className="h-8 w-auto object-contain"
            />
          </Link>
        </div>

        {/* Heading */}
        <h1
          className="text-xl font-semibold text-center mb-1"
          style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}
        >
          Welcome to Gavelling
        </h1>
        <p
          className="text-sm text-center mb-6"
          style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}
        >
          Sign in to access conferences, track your MUN history, and more.
        </p>

        {/* Callback error banner */}
        {hasCallbackError && (
          <div
            className="mb-4 px-4 py-3 rounded-xl text-sm text-center"
            style={{
              backgroundColor: 'rgba(184, 132, 74, 0.12)',
              border: '1px solid rgba(184, 132, 74, 0.35)',
              color: '#7A5A20',
              fontFamily: "'Outfit', sans-serif",
            }}
          >
            Sign-in failed. Please try again.
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div
            className="mb-4 px-4 py-3 rounded-xl text-sm text-center"
            style={{
              backgroundColor: 'rgba(139, 32, 32, 0.08)',
              border: '1px solid rgba(139, 32, 32, 0.2)',
              color: '#8B2020',
              fontFamily: "'Outfit', sans-serif",
            }}
          >
            {error}
          </div>
        )}

        {/* Google sign-in */}
        <button
          onClick={handleGoogleSignIn}
          className="w-full flex items-center justify-center gap-3 rounded-xl py-3 font-bold text-sm tracking-widest transition-colors focus:outline-none"
          style={{
            backgroundColor: '#1B3828',
            color: '#EED98A',
            fontFamily: "'Outfit', sans-serif",
            letterSpacing: '0.08em',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
        >
          <GoogleIcon />
          SIGN IN WITH GOOGLE
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px" style={{ backgroundColor: '#DDD4C0' }} />
          <span className="text-xs font-medium" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>or</span>
          <div className="flex-1 h-px" style={{ backgroundColor: '#DDD4C0' }} />
        </div>

        {/* Email/password form */}
        <form onSubmit={handleEmailSignIn} className="space-y-4">
          <div>
            <label
              className="block text-sm font-semibold mb-1.5"
              style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}
            >
              Email address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl px-4 py-3 text-sm transition-colors focus:outline-none"
              style={{
                backgroundColor: '#FAF8F3',
                border: '1.5px solid #DDD4C0',
                color: '#1C1410',
                fontFamily: "'Outfit', sans-serif",
              }}
              onFocus={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#1B3828'; }}
              onBlur={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#DDD4C0'; }}
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label
              className="block text-sm font-semibold mb-1.5"
              style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}
            >
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl px-4 py-3 text-sm transition-colors focus:outline-none pr-11"
                style={{
                  backgroundColor: '#FAF8F3',
                  border: '1.5px solid #DDD4C0',
                  color: '#1C1410',
                  fontFamily: "'Outfit', sans-serif",
                }}
                onFocus={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#1B3828'; }}
                onBlur={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#DDD4C0'; }}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 focus:outline-none"
                style={{ color: '#9A8A78' }}
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl py-3 font-bold text-sm tracking-widest transition-colors focus:outline-none"
            style={{
              backgroundColor: loading ? '#DDD4C0' : '#1B3828',
              color: loading ? '#9A8A78' : '#EED98A',
              fontFamily: "'Outfit', sans-serif",
              letterSpacing: '0.08em',
            }}
            onMouseEnter={(e) => { if (!loading) (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
            onMouseLeave={(e) => { if (!loading) (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
          >
            {loading ? 'SIGNING IN...' : 'SIGN IN'}
          </button>
        </form>

        {/* Sign-up link */}
        <p
          className="text-sm text-center mt-5"
          style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}
        >
          Don&apos;t have an account?{' '}
          <Link
            href="/auth/signup"
            className="font-semibold transition-colors"
            style={{ color: '#1B3828' }}
          >
            Sign up
          </Link>
        </p>

        {/* Legal */}
        <p
          className="text-xs text-center mt-3"
          style={{ color: '#C0B4A4', fontFamily: "'Outfit', sans-serif" }}
        >
          By signing in you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.2045C17.64 8.5663 17.5827 7.9527 17.4764 7.3636H9V10.845H13.8436C13.635 11.97 13.0009 12.9231 12.0477 13.5613V15.8195H14.9564C16.6582 14.2527 17.64 11.9454 17.64 9.2045Z" fill="#4285F4"/>
      <path d="M9 18C11.43 18 13.4673 17.1941 14.9564 15.8195L12.0477 13.5613C11.2418 14.1013 10.2109 14.4204 9 14.4204C6.65591 14.4204 4.67182 12.8372 3.96409 10.71H0.957275V13.0418C2.43818 15.9831 5.48182 18 9 18Z" fill="#34A853"/>
      <path d="M3.96409 10.71C3.78409 10.17 3.68182 9.5931 3.68182 9C3.68182 8.4068 3.78409 7.8299 3.96409 7.29V4.9581H0.957275C0.347727 6.1731 0 7.5477 0 9C0 10.4522 0.347727 11.8268 0.957275 13.0418L3.96409 10.71Z" fill="#FBBC05"/>
      <path d="M9 3.5795C10.3214 3.5795 11.5077 4.0336 12.4405 4.9254L15.0218 2.344C13.4632 0.8918 11.4259 0 9 0C5.48182 0 2.43818 2.0168 0.957275 4.9581L3.96409 7.29C4.67182 5.1627 6.65591 3.5795 9 3.5795Z" fill="#EA4335"/>
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#EDE7D8' }}>
        <div className="w-5 h-5 border-2 border-[#1B3828] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <SignInInner />
    </Suspense>
  );
}
