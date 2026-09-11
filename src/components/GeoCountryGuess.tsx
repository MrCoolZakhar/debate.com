'use client';

// ── A nationality GUESS from the visitor's location ───────────────────────────
//
// Used to prefill an EMPTY nationality field on sign-up, onboarding and the
// CompleteBasicsGate. Two rules make this acceptable under the no-tracking
// privacy policy, and neither may be relaxed:
//
//   • The only source is our own /api/geo, which reads Vercel's edge header
//     (x-vercel-ip-country). No third-party IP lookup, ever. CurrencyPicker's
//     loader falls back to ipapi.co; this one deliberately does not, which is
//     why it is a separate module rather than a reuse. In local dev the header
//     is absent and the guess is simply null.
//   • Location is not nationality. The guess only fills the field; the caller
//     must show GeoGuessNote beside it and write NOTHING until the user presses
//     their own save button.

import { useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import { NEU, OUTFIT } from '@/components/neu';
import { getCountryByCode, type Country } from '@/lib/countries';

let guessPromise: Promise<Country | null> | null = null;

/** Cached per page load: every caller shares one /api/geo request. */
export function loadGeoCountryGuess(): Promise<Country | null> {
  if (guessPromise) return guessPromise;
  guessPromise = (async () => {
    try {
      const res = await fetch('/api/geo');
      if (!res.ok) return null;
      const data = await res.json();
      const cc = data?.countryCode;
      if (typeof cc !== 'string' || !/^[A-Za-z]{2}$/.test(cc)) return null;
      // Only a country in our list counts. An unmapped code (a territory we
      // do not list) gives no guess rather than a wrong one.
      return getCountryByCode(cc) ?? null;
    } catch {
      return null;
    }
  })();
  return guessPromise;
}

/**
 * Prefill an empty nationality field with the guess, once. Returns the name
 * that was prefilled (or null), so the caller can show GeoGuessNote only while
 * the field still holds exactly that guess. Never overwrites anything typed or
 * loaded, and never writes to the database.
 *
 * The fill happens in the geo promise's callback, not in the effect body: the
 * field's current value is read through a ref at that moment, so a value the
 * person typed (or the page loaded) while the request was in flight wins.
 */
export function useNationalityPrefill(
  value: string,
  setValue: (v: string) => void,
  enabled: boolean = true,
): string | null {
  const [prefilled, setPrefilled] = useState<string | null>(null);
  const valueRef = useRef(value);
  const setValueRef = useRef(setValue);
  useEffect(() => {
    valueRef.current = value;
    setValueRef.current = setValue;
  });
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    loadGeoCountryGuess().then((country) => {
      if (cancelled || !country) return;
      if (valueRef.current.trim() !== '') return;
      setValueRef.current(country.name);
      setPrefilled(country.name);
    });
    return () => { cancelled = true; };
  }, [enabled]);
  return prefilled !== null && value === prefilled ? prefilled : null;
}

/** "We guessed X from your location" line, shown under a prefilled field. */
export function GeoGuessNote({ countryName, id }: { countryName: string; id?: string }) {
  return (
    <p
      id={id}
      className="flex items-start gap-1.5 text-xs mt-1.5"
      style={{ color: NEU.inkSoft, fontFamily: OUTFIT, lineHeight: 1.45 }}
    >
      <MapPin size={13} strokeWidth={2.3} className="flex-shrink-0" style={{ marginTop: 1, color: NEU.deepGold }} aria-hidden />
      <span>
        We guessed <strong style={{ color: NEU.ink, fontWeight: 700 }}>{countryName}</strong> from your location.
        Change it if that isn&apos;t your nationality.
      </span>
    </p>
  );
}
