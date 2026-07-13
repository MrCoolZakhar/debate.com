'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { Brand } from '@/components/Brand';

// ─────────────────────────────────────────────────────────────────────────────
// KILL SWITCH — set to false at public launch to disable the demo gate
// entirely (no gate is ever rendered, no storage is read).
// ─────────────────────────────────────────────────────────────────────────────
const DEMO_GATE_ENABLED = true;

// Only the conferences + accounts layer is gated. The live committee-session
// product (/, /join, /create, /chair, /delegate, /advisor, /voting, …) must
// remain fully open for production users.
const GATED_PREFIXES = ['/conferences', '/manage', '/account', '/auth'];

const STORAGE_KEY = 'gavelling-demo-access';
const GRANTED = 'granted';
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

function isGatedPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return GATED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

function hasCookieAccess(): boolean {
  try {
    return document.cookie
      .split(';')
      .some((c) => c.trim() === `${STORAGE_KEY}=${GRANTED}`);
  } catch {
    return false;
  }
}

function hasStoredAccess(): boolean {
  // Check BOTH localStorage and the cookie — some in-app browsers clear one
  // but not the other.
  try {
    if (localStorage.getItem(STORAGE_KEY) === GRANTED) return true;
  } catch {}
  return hasCookieAccess();
}

function persistAccess(): void {
  try {
    localStorage.setItem(STORAGE_KEY, GRANTED);
  } catch {}
  try {
    document.cookie = `${STORAGE_KEY}=${GRANTED}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
  } catch {}
}

// Normalization: lowercase → trim → collapse all internal whitespace runs to a
// single space. Accepts "gavelling demo" (any casing / extra spaces) and the
// no-space variant "gavellingdemo".
function isCorrectCode(raw: string): boolean {
  const normalized = raw.toLowerCase().trim().replace(/\s+/g, ' ');
  return normalized === 'gavelling demo' || normalized === 'gavellingdemo';
}

export default function DemoGate() {
  const pathname = usePathname();
  const gated = DEMO_GATE_ENABLED && isGatedPath(pathname);

  // Default LOCKED on gated paths until the client-side storage check passes.
  // A brief flash of the gate for authorized users is acceptable; a flash of
  // the underlying content for unauthorized users is not.
  const [unlocked, setUnlocked] = useState(false);
  const [fading, setFading] = useState(false);
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);
  const [shaking, setShaking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!gated) return;
    if (hasStoredAccess()) {
      setUnlocked(true);
      persistAccess(); // re-mirror to whichever store was cleared
    }
  }, [gated]);

  // Keep the underlying page from scrolling while the gate is up.
  useEffect(() => {
    if (!gated || unlocked) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [gated, unlocked]);

  const handleSubmit = useCallback(() => {
    if (isCorrectCode(value)) {
      persistAccess();
      setError(false);
      setFading(true);
      window.setTimeout(() => setUnlocked(true), 220);
    } else {
      setError(true);
      setShaking(true);
      setValue('');
      window.setTimeout(() => setShaking(false), 450);
      inputRef.current?.focus();
    }
  }, [value]);

  if (!gated || unlocked) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Private demo access"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483000,
        backgroundColor: '#EDE7D8',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: fading ? 0 : 1,
        transition: 'opacity 200ms ease',
        pointerEvents: fading ? 'none' : 'auto',
      }}
    >
      <style>{`
        @keyframes demo-gate-shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-7px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(3px); }
        }
      `}</style>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 18,
          width: '100%',
          maxWidth: 320,
          padding: '0 24px',
        }}
      >
        <span style={{ marginBottom: 10 }}>
          <Brand variant="conferences" tone="light" size={40} />
        </span>
        <p
          style={{
            fontSize: 12.5,
            letterSpacing: '0.04em',
            color: 'rgba(28, 20, 16, 0.5)',
            textAlign: 'center',
            margin: 0,
          }}
        >
          Private demo — enter the access code
        </p>
        <div
          style={{
            width: '100%',
            animation: shaking ? 'demo-gate-shake 0.45s ease' : undefined,
          }}
        >
          <input
            ref={inputRef}
            type="password"
            autoFocus
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              if (error) setError(false);
            }}
            placeholder="Access code"
            autoComplete="off"
            spellCheck={false}
            aria-label="Access code"
            aria-invalid={error}
            style={{
              width: '100%',
              backgroundColor: '#FAF8F3',
              border: `1px solid ${error ? '#8B2020' : '#DDD4C0'}`,
              borderRadius: 12,
              padding: '12px 16px',
              fontSize: 15,
              textAlign: 'center',
              color: '#1C1410',
              outline: 'none',
            }}
          />
        </div>
        {error && (
          <p
            style={{
              fontSize: 12.5,
              color: '#8B2020',
              margin: '-8px 0 0',
              textAlign: 'center',
            }}
          >
            Incorrect code
          </p>
        )}
        <button
          type="submit"
          style={{
            width: '100%',
            backgroundColor: '#1B3828',
            color: '#EED98A',
            border: 'none',
            borderRadius: 12,
            padding: '12px 16px',
            fontSize: 13.5,
            fontWeight: 700,
            letterSpacing: '0.12em',
            cursor: 'pointer',
          }}
        >
          ENTER
        </button>
      </form>
    </div>
  );
}
