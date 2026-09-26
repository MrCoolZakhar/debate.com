'use client';

/**
 * NewDelegationCard: shown on the "Your delegation" step when a Head Delegate
 * (or Faculty Advisor) typed a delegation name that does not exist yet at this
 * conference, i.e. submitting will CREATE it.
 *
 * Layout (owner, 23 Sep 2026): the delegation's picture on the left, its
 * details on the right: the name, then where it is based (city and country,
 * the country with a round flag). City and country are required; the picture
 * is optional. On a phone the two columns stay side by side with a smaller
 * picture tile, so the card reads like the delegation's own card.
 *
 * Nothing is written to `societies` here. The picture is uploaded when chosen
 * (so Submit is not held up by an upload), and the row is created at submit
 * by ConferenceApplyClient with societyInsertRow() from src/lib/delegationCreate.ts.
 */

import { useId, useRef, useState } from 'react';
import { ImagePlus, Loader2, MapPin, X } from 'lucide-react';
import { NEU, OUTFIT } from '@/components/neu';
import { CountryField } from '@/components/CountryField';
import { CircleFlag } from '@/components/CircleFlag';
import { LogoCropModal } from '@/components/LogoCropModal';
import { getAuthedClient } from '@/lib/supabase-auth';
import { getCountryByName } from '@/lib/countries';
import {
  DELEGATION_CITY_MAX, DELEGATION_LOGO_TYPES, uploadDelegationLogo,
  type NewDelegationDetails, type NewDelegationProblems,
} from '@/lib/delegationCreate';

const DANGER = '#8B2020';
const FOCUS = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gv-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--gv-surface)]';

function monogram(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function NewDelegationCard({
  name, details, onChange, problems, conferenceId, userId, accessToken, previewing,
}: {
  name: string;
  details: NewDelegationDetails;
  onChange: (next: NewDelegationDetails) => void;
  /** Shown only after Continue was pressed with something missing. */
  problems: NewDelegationProblems;
  conferenceId: string;
  userId: string | null;
  accessToken: string | null;
  /** Organiser preview: the picture button does nothing (nothing is written). */
  previewing: boolean;
}) {
  const cityId = useId();
  const countryId = useId();
  const cityErrId = useId();
  const countryErrId = useId();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [logoError, setLogoError] = useState('');

  const country = getCountryByName(details.countryName);
  const canUpload = !previewing && !!userId && !!accessToken;

  function pickFile(file: File | undefined) {
    setLogoError('');
    if (!file) return;
    if (!DELEGATION_LOGO_TYPES.includes(file.type)) {
      setLogoError('Use a JPEG, PNG, WebP or GIF picture.');
      return;
    }
    setCropFile(file);
  }

  async function saveCropped(blob: Blob) {
    setCropFile(null);
    if (!canUpload || !userId || !accessToken) return;
    setUploading(true);
    const res = await uploadDelegationLogo(getAuthedClient(accessToken), conferenceId, userId, blob);
    setUploading(false);
    if ('error' in res) { setLogoError(res.error); return; }
    onChange({ ...details, logoUrl: res.url });
  }

  const inputSkin: React.CSSProperties = {
    backgroundColor: 'var(--gv-surface)',
    borderRadius: 12,
    color: 'var(--gv-on-surface)',
    fontFamily: OUTFIT,
    fontSize: 16,
    paddingTop: 11,
    paddingBottom: 11,
  };

  return (
    <section
      aria-label="Your new delegation"
      className="mt-4 rounded-2xl"
      style={{
        padding: 14,
        backgroundColor: 'color-mix(in srgb, var(--gv-main) 4%, var(--gv-surface))',
        border: '1px solid color-mix(in srgb, var(--gv-main) 16%, transparent)',
      }}
    >
      <p style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 10, letterSpacing: '0.16em', color: NEU.inkSoft, marginBottom: 10 }}>
        NEW DELEGATION
      </p>
      <div className="grid gap-3.5 sm:gap-5" style={{ gridTemplateColumns: 'clamp(88px, 26vw, 132px) minmax(0, 1fr)' }}>
        {/* ── Picture ───────────────────────────────────────────────────── */}
        <div className="flex flex-col items-stretch gap-1.5">
          <button
            type="button"
            onClick={() => { if (canUpload && !uploading) fileRef.current?.click(); }}
            disabled={!canUpload || uploading}
            aria-label={details.logoUrl ? 'Change the delegation picture' : 'Add a delegation picture'}
            className={`relative w-full flex flex-col items-center justify-center rounded-2xl overflow-hidden ${FOCUS}`}
            style={{
              aspectRatio: '1 / 1',
              cursor: canUpload && !uploading ? 'pointer' : 'default',
              backgroundColor: details.logoUrl ? 'var(--gv-surface)' : 'color-mix(in srgb, var(--gv-main) 6%, transparent)',
              border: details.logoUrl ? '1px solid var(--gv-border)' : '1.5px dashed color-mix(in srgb, var(--gv-main) 26%, transparent)',
              color: 'var(--gv-main)',
            }}
          >
            {details.logoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={details.logoUrl} alt="" className="absolute inset-0 w-full h-full" style={{ objectFit: 'contain', padding: '4%' }} />
            ) : name.trim() ? (
              <span aria-hidden style={{ fontFamily: OUTFIT, fontWeight: 900, fontSize: 26, color: 'color-mix(in srgb, var(--gv-main) 45%, transparent)' }}>
                {monogram(name)}
              </span>
            ) : null}
            {uploading ? (
              <span className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: 'color-mix(in srgb, var(--gv-surface) 70%, transparent)' }}>
                <Loader2 size={20} className="animate-spin motion-reduce:animate-none" />
              </span>
            ) : !details.logoUrl && (
              <span className="absolute bottom-2 flex flex-col items-center gap-0.5" style={{ fontFamily: OUTFIT }}>
                <ImagePlus size={18} strokeWidth={2.2} />
              </span>
            )}
          </button>
          <p className="text-center" style={{ fontFamily: OUTFIT, fontWeight: 600, fontSize: 11.5, lineHeight: 1.3, color: NEU.inkSoft }}>
            {details.logoUrl ? 'Tap to change' : 'Logo (optional)'}
          </p>
          {details.logoUrl && !uploading && (
            <button
              type="button"
              onClick={() => onChange({ ...details, logoUrl: null })}
              className={`self-center inline-flex items-center gap-1 rounded-full ${FOCUS}`}
              style={{ minHeight: 32, padding: '0 10px', border: 'none', background: 'none', cursor: 'pointer', fontFamily: OUTFIT, fontWeight: 700, fontSize: 11.5, color: NEU.inkSoft }}
            >
              <X size={12} strokeWidth={2.6} /> Remove
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept={DELEGATION_LOGO_TYPES.join(',')}
            className="hidden"
            onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = ''; }}
          />
        </div>

        {/* ── Details ───────────────────────────────────────────────────── */}
        <div className="min-w-0">
          <p
            className="min-w-0"
            style={{ fontFamily: OUTFIT, fontWeight: 900, fontSize: 18, lineHeight: 1.25, color: NEU.ink, overflowWrap: 'anywhere' }}
          >
            {name.trim()}
          </p>
          {(details.city.trim() || country) && (
            <p className="mt-1 flex items-start gap-1.5 min-w-0" style={{ fontFamily: OUTFIT, fontWeight: 600, fontSize: 12.5, lineHeight: 1.3, color: NEU.inkSoft }}>
              {country ? <CircleFlag code={country.code} size={16} decorative /> : <MapPin size={14} strokeWidth={2.4} style={{ flexShrink: 0 }} />}
              <span className="min-w-0 [overflow-wrap:anywhere]">
                {[details.city.trim(), country?.name].filter(Boolean).join(', ')}
              </span>
            </p>
          )}

          <label htmlFor={cityId} className="block mt-3 mb-1" style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: 12.5, color: 'var(--gv-on-surface)' }}>
            City
          </label>
          <input
            id={cityId}
            type="text"
            value={details.city}
            maxLength={DELEGATION_CITY_MAX}
            autoComplete="address-level2"
            aria-invalid={!!problems.city}
            aria-describedby={problems.city ? cityErrId : undefined}
            onChange={(e) => onChange({ ...details, city: e.target.value })}
            placeholder="e.g. Madrid"
            className="w-full px-3.5 focus:outline-none"
            style={{ ...inputSkin, border: problems.city ? `1.5px solid ${DANGER}` : '1px solid var(--gv-border)' }}
          />
          {problems.city && (
            <p id={cityErrId} className="mt-1" style={{ fontFamily: OUTFIT, fontWeight: 600, fontSize: 12, color: DANGER }}>{problems.city}</p>
          )}

          <label htmlFor={countryId} className="block mt-3 mb-1" style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: 12.5, color: 'var(--gv-on-surface)' }}>
            Country
          </label>
          <CountryField
            id={countryId}
            value={details.countryName}
            onChange={(v) => onChange({ ...details, countryName: v })}
            placeholder="Search"
            ariaLabel="Country"
            circleFlag
            invalid={!!problems.country}
            describedBy={problems.country ? countryErrId : undefined}
            inputStyle={{ ...inputSkin, border: problems.country ? `1.5px solid ${DANGER}` : '1px solid var(--gv-border)' }}
          />
          {problems.country && (
            <p id={countryErrId} className="mt-1" style={{ fontFamily: OUTFIT, fontWeight: 600, fontSize: 12, color: DANGER }}>{problems.country}</p>
          )}
        </div>
      </div>
      {logoError && (
        <p role="alert" className="mt-2" style={{ fontFamily: OUTFIT, fontWeight: 600, fontSize: 12, color: DANGER }}>{logoError}</p>
      )}

      {cropFile && (
        <LogoCropModal file={cropFile} onCancel={() => setCropFile(null)} onSave={saveCropped} />
      )}
    </section>
  );
}
