import { NextRequest, NextResponse } from 'next/server';

// Reads Vercel's edge geolocation headers (populated in production on Vercel).
// In local dev these headers are absent, so every field returns null and the
// client falls back to a keyless IP lookup. Never throws; never blocks render.
export const dynamic = 'force-dynamic';

export function GET(request: NextRequest) {
  const country = request.headers.get('x-vercel-ip-country');
  const city = request.headers.get('x-vercel-ip-city');
  const region = request.headers.get('x-vercel-ip-country-region');

  // Vercel URL-encodes city names that contain spaces (e.g. "San%20Salvador").
  const decode = (v: string | null): string | null => {
    if (!v) return null;
    try {
      return decodeURIComponent(v);
    } catch {
      return v;
    }
  };

  return NextResponse.json({
    country: decode(country),   // ISO 3166-1 alpha-2 (e.g. "GB") — resolved to a full name client-side
    city: decode(city),
    countryCode: country ?? null,
    region: decode(region),
  });
}
