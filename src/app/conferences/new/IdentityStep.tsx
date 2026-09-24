'use client';

/**
 * Step 1 of /conferences/new, "Your conference" (24 Sep 2026, owner: "make the
 * first wizard have more information in one page and better looking ... you
 * should do name, logo, banner and dates in that first step").
 *
 * One page instead of four (name, logo, banner, dates used to be separate
 * steps). A live preview of the conference card on one side, the fields on the
 * other, from 1024px; below that they stack, preview first.
 *
 * PRESENTATIONAL ONLY. Every value and every handler belongs to the wizard
 * page, which owns the uploads (storage, under the id it minted at mount), the
 * validation and the insert. Nothing here writes anywhere.
 *
 * What stays exactly as it was on the old steps: the full name and a valid
 * acronym are required (acronymProblem), the logo and banner are optional, the
 * dates are optional (or "to be decided") and the last day may not be before
 * the first.
 */

import { useRef, useState } from 'react';
import {
  AlertTriangle, CalendarDays, CalendarClock, Camera, Check, ImagePlus, Loader2, Upload,
} from 'lucide-react';
import { NEU, OUTFIT, EASE } from '@/components/neu';
import { DatePicker } from '@/components/DatePicker';

export interface IdentityStepProps {
  fullName: string;
  acronym: string;
  /** acronymProblem(acronym) when an acronym is typed, else ''. */
  acronymError: string;
  onFullName: (v: string) => void;
  onAcronym: (v: string) => void;

  logoUrl: string;
  logoUploading: boolean;
  logoError: string;
  /** A picked file. The page crops it (LogoCropModal) and uploads. */
  onPickLogo: (file: File) => void;

  bannerUrl: string;
  bannerUploading: boolean;
  bannerError: string;
  onPickBanner: (file: File) => void;
  onBannerPreset: (src: string) => void;
  bannerPresets: string[];

  startDate: string;
  endDate: string;
  datesTbd: boolean;
  todayISO: string;
  onStartDate: (iso: string) => void;
  onEndDate: (iso: string) => void;
  onToggleTbd: () => void;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  backgroundColor: NEU.base,
  border: '1.5px solid transparent',
  borderRadius: 16,
  padding: '14px 16px',
  fontSize: 16,
  fontWeight: 600,
  color: NEU.ink,
  fontFamily: OUTFIT,
  outline: 'none',
  boxShadow: NEU.inSm,
  transition: `border-color 180ms ${EASE}`,
};

function Label({ htmlFor, children, aside }: { htmlFor?: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3" style={{ marginBottom: 7 }}>
      <label
        htmlFor={htmlFor}
        style={{
          fontFamily: OUTFIT, fontSize: 11, fontWeight: 800, letterSpacing: '0.12em',
          color: NEU.inkSoft, textTransform: 'uppercase',
        }}
      >
        {children}
      </label>
      {aside}
    </div>
  );
}

function Optional() {
  return (
    <span style={{ fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 600, color: NEU.inkSoft }}>Optional</span>
  );
}

function Problem({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="flex items-center gap-1.5" style={{ color: '#8A5A1E', fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 600, marginTop: 7 }}>
      <AlertTriangle size={13} className="flex-shrink-0" />
      {children}
    </p>
  );
}

function formatDay(iso: string, withYear: boolean): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}),
  });
}

/** "12 – 14 Mar 2027", "30 Mar – 2 Apr 2027", "12 Mar 2027". */
function datesLine(start: string, end: string, tbd: boolean): string | null {
  if (tbd) return 'Dates to be decided';
  if (!start) return null;
  if (!end || end === start) return formatDay(start, true);
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  if (s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth()) {
    return `${s.getDate()} to ${formatDay(end, true)}`;
  }
  if (s.getFullYear() === e.getFullYear()) return `${formatDay(start, false)} to ${formatDay(end, true)}`;
  return `${formatDay(start, true)} to ${formatDay(end, true)}`;
}

export function IdentityStep(p: IdentityStepProps) {
  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const [logoHover, setLogoHover] = useState(false);
  const [bannerHover, setBannerHover] = useState(false);

  const acronymShown = p.acronym.trim();
  const nameShown = p.fullName.trim();
  const when = datesLine(p.startDate, p.endDate, p.datesTbd);
  const datesBackwards = !p.datesTbd && !!p.startDate && !!p.endDate && p.endDate < p.startDate;

  const focus = (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.style.borderColor = NEU.forest; };
  const blur = (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.style.borderColor = 'transparent'; };

  return (
    <div className="gv-idstep">
      <style>{`
        .gv-idstep { display: grid; grid-template-columns: minmax(0, 1fr); gap: 22px; }
        @media (min-width: 1024px) {
          .gv-idstep { grid-template-columns: minmax(0, 1.08fr) minmax(0, 1fr); gap: 34px; align-items: start; }
        }
        .gv-idstep-banner { height: 150px; }
        @media (min-width: 640px) { .gv-idstep-banner { height: 156px; } }
      `}</style>

      <input
        ref={logoInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) p.onPickLogo(f); }}
      />
      <input
        ref={bannerInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) p.onPickBanner(f); }}
      />

      {/* ── The live preview: the conference as its page will show it ───── */}
      <div className="flex flex-col" style={{ gap: 14 }}>
        <section
          aria-label="Preview of your conference"
          style={{
            backgroundColor: NEU.surface, borderRadius: 26, boxShadow: NEU.out,
            overflow: 'hidden', position: 'relative',
          }}
        >
          {/* Banner. The whole strip is the button: click to upload your own. */}
          <button
            type="button"
            onClick={() => bannerInputRef.current?.click()}
            onMouseEnter={() => setBannerHover(true)}
            onMouseLeave={() => setBannerHover(false)}
            aria-label={p.bannerUrl ? 'Replace the banner' : 'Upload a banner'}
            className="gv-idstep-banner relative block w-full focus:outline-none focus-visible:shadow-[inset_0_0_0_3px_#EED98A]"
            style={{
              border: 'none', padding: 0, cursor: 'pointer',
              background: p.bannerUrl
                ? `center / cover no-repeat url(${JSON.stringify(p.bannerUrl)})`
                : 'linear-gradient(135deg, #1B3828 0%, #2A5A3C 55%, #3D7A52 100%)',
            }}
          >
            {!p.bannerUrl && (
              <span
                aria-hidden
                className="absolute inset-0"
                style={{
                  backgroundImage: 'radial-gradient(circle at 18% 120%, rgba(238,217,138,0.22), transparent 55%), radial-gradient(circle at 92% -20%, rgba(255,255,255,0.10), transparent 50%)',
                }}
              />
            )}
            {p.bannerUrl && (
              <span aria-hidden className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0) 55%, rgba(0,0,0,0.18) 100%)' }} />
            )}
            <span
              className="absolute flex items-center gap-1.5"
              style={{
                top: 12, right: 12, padding: '7px 12px 7px 10px', borderRadius: 999,
                backgroundColor: p.bannerUrl ? 'rgba(20,32,24,0.62)' : 'rgba(255,255,255,0.14)',
                color: '#FFFDF6', fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 700,
                boxShadow: bannerHover ? '0 4px 14px rgba(0,0,0,0.25)' : 'none',
                transform: bannerHover ? 'translateY(-1px)' : 'none',
                transition: `transform 200ms ${EASE}, box-shadow 200ms ${EASE}`,
              }}
            >
              {p.bannerUploading ? <Loader2 size={15} className="animate-spin" /> : <ImagePlus size={15} strokeWidth={2.2} />}
              {p.bannerUploading ? 'Uploading' : p.bannerUrl ? 'Change banner' : 'Add a banner'}
            </span>
          </button>

          {/* Logo, a round disc over the banner's lower edge. */}
          <div className="relative" style={{ padding: '0 22px 20px' }}>
            <button
              type="button"
              onClick={() => logoInputRef.current?.click()}
              onMouseEnter={() => setLogoHover(true)}
              onMouseLeave={() => setLogoHover(false)}
              aria-label={p.logoUrl ? 'Replace the logo' : 'Upload a logo'}
              className="relative flex items-center justify-center focus:outline-none focus-visible:shadow-[0_0_0_3px_#1B3828]"
              style={{
                width: 104, height: 104, marginTop: -54, borderRadius: 999,
                backgroundColor: '#FDFCF9', border: `4px solid ${NEU.surface}`,
                boxShadow: logoHover ? '0 10px 26px rgba(27,56,40,0.28)' : '0 6px 18px rgba(27,56,40,0.20)',
                cursor: 'pointer', overflow: 'visible', padding: 0,
                transform: logoHover ? 'translateY(-2px)' : 'none',
                transition: `transform 220ms ${EASE}, box-shadow 220ms ${EASE}`,
              }}
            >
              <span className="absolute inset-0 flex items-center justify-center" style={{ borderRadius: 999, overflow: 'hidden' }}>
                {p.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.logoUrl} alt="Conference logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                ) : p.logoUploading ? (
                  <Loader2 size={26} className="animate-spin" style={{ color: NEU.forest }} />
                ) : (
                  <span className="flex flex-col items-center" style={{ gap: 3, color: NEU.forest }}>
                    <Upload size={22} strokeWidth={2.2} />
                    <span style={{ fontFamily: OUTFIT, fontSize: 11, fontWeight: 800 }}>Logo</span>
                  </span>
                )}
              </span>
              {/* The camera badge says the disc is a button. */}
              <span
                aria-hidden
                className="absolute flex items-center justify-center"
                style={{
                  right: -2, bottom: 2, width: 30, height: 30, borderRadius: 999,
                  background: 'linear-gradient(135deg, #EED98A, #C9A54A)', color: '#1B3828',
                  border: `2.5px solid ${NEU.surface}`,
                }}
              >
                {p.logoUploading && p.logoUrl ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} strokeWidth={2.4} />}
              </span>
            </button>

            <div style={{ marginTop: 12 }}>
              <p
                style={{
                  margin: 0, fontFamily: OUTFIT, fontWeight: 900, fontSize: 'clamp(24px, 3.2vw, 30px)',
                  lineHeight: 1.1, letterSpacing: '-0.01em',
                  color: acronymShown ? NEU.ink : 'color-mix(in srgb, var(--gv-on-surface) 32%, transparent)',
                  overflowWrap: 'anywhere',
                }}
              >
                {acronymShown || 'ACRONYM'}
              </p>
              <p
                style={{
                  margin: '5px 0 0', fontFamily: OUTFIT, fontSize: 15, fontWeight: 600, lineHeight: 1.35,
                  color: nameShown ? NEU.inkSoft : 'color-mix(in srgb, var(--gv-on-surface) 32%, transparent)',
                  textWrap: 'balance', overflowWrap: 'anywhere',
                }}
              >
                {nameShown || 'Your conference’s full name'}
              </p>
              <p
                className="flex items-center gap-1.5"
                style={{
                  margin: '10px 0 0', fontFamily: OUTFIT, fontSize: 13.5, fontWeight: 700,
                  color: when ? NEU.forest : 'color-mix(in srgb, var(--gv-on-surface) 38%, transparent)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {p.datesTbd ? <CalendarClock size={15} strokeWidth={2.3} /> : <CalendarDays size={15} strokeWidth={2.3} />}
                {when ?? 'Add your dates'}
              </p>
            </div>
          </div>
        </section>

        {p.logoError && <Problem>{p.logoError}</Problem>}

        {/* Banner presets, and an upload of your own as the last tile. */}
        <div>
          <Label aside={p.bannerUrl ? (
            // A banner is optional, so a picked one can always be taken off again.
            <button
              type="button"
              onClick={() => p.onBannerPreset('')}
              className="focus:outline-none focus-visible:underline hover:underline"
              style={{ fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 700, color: NEU.inkSoft, background: 'none', border: 0, padding: 0, cursor: 'pointer' }}
            >
              Remove banner
            </button>
          ) : <Optional />}>Banner</Label>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 8 }}>
            {p.bannerPresets.map((src) => {
              const on = p.bannerUrl === src;
              return (
                <button
                  key={src}
                  type="button"
                  onClick={() => p.onBannerPreset(src)}
                  aria-label="Use this banner"
                  aria-pressed={on}
                  className="relative focus:outline-none focus-visible:shadow-[0_0_0_2px_#1B3828] transition-transform duration-200 hover:-translate-y-0.5 active:scale-[0.97]"
                  style={{
                    height: 42, borderRadius: 12, padding: 0, cursor: 'pointer',
                    border: on ? `2px solid ${NEU.forest}` : '2px solid transparent',
                    background: `center / cover no-repeat url(${src})`,
                    boxShadow: NEU.outSm,
                  }}
                >
                  {on && (
                    <span
                      className="absolute flex items-center justify-center"
                      style={{ top: 3, right: 3, width: 17, height: 17, borderRadius: 999, background: 'linear-gradient(135deg, #EED98A, #C9A54A)' }}
                    >
                      <Check size={11} strokeWidth={3.2} style={{ color: '#1B3828' }} />
                    </span>
                  )}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => bannerInputRef.current?.click()}
              aria-label="Upload your own banner"
              title="Upload your own banner"
              className="flex items-center justify-center focus:outline-none focus-visible:shadow-[0_0_0_2px_#1B3828] transition-colors duration-200 hover:bg-[#1B3828]/[0.06]"
              style={{
                height: 42, borderRadius: 12, cursor: 'pointer', color: NEU.forest,
                border: '1.5px dashed rgba(27,56,40,0.30)', backgroundColor: 'transparent',
              }}
            >
              {p.bannerUploading ? <Loader2 size={17} className="animate-spin" /> : <Upload size={17} strokeWidth={2.3} />}
            </button>
          </div>
          {p.bannerError && <Problem>{p.bannerError}</Problem>}
        </div>
      </div>

      {/* ── The fields ───────────────────────────────────────────────── */}
      <div className="flex flex-col" style={{ gap: 18 }}>
        <div>
          <Label htmlFor="wiz-conf-name">Full name</Label>
          <input
            id="wiz-conf-name"
            type="text"
            value={p.fullName}
            autoFocus
            onChange={(e) => p.onFullName(e.target.value)}
            placeholder="e.g. The European International Model United Nations"
            style={inputStyle}
            onFocus={focus}
            onBlur={blur}
          />
        </div>

        <div>
          <Label htmlFor="wiz-conf-acronym">Acronym</Label>
          <input
            id="wiz-conf-acronym"
            type="text"
            value={p.acronym}
            onChange={(e) => p.onAcronym(e.target.value)}
            placeholder="e.g. TEIMUN, or Model NATO Germany"
            aria-invalid={!!p.acronymError}
            aria-describedby="wiz-conf-acronym-note"
            style={{ ...inputStyle, letterSpacing: '0.06em', fontVariantNumeric: 'tabular-nums' }}
            onFocus={focus}
            onBlur={blur}
          />
          <div id="wiz-conf-acronym-note">
            {p.acronymError ? (
              <Problem>{p.acronymError}</Problem>
            ) : (
              <p style={{ fontFamily: OUTFIT, fontSize: 12.5, lineHeight: 1.5, color: NEU.inkSoft, margin: '7px 0 0' }}>
                Suggested from the name. Use whatever your conference goes by. The edition year is added for you.
              </p>
            )}
          </div>
        </div>

        <div>
          <Label aside={<Optional />}>Dates</Label>
          <div
            className="grid grid-cols-2"
            style={{ gap: 10, ...(p.datesTbd ? { opacity: 0.4, pointerEvents: 'none' } : {}) }}
            aria-disabled={p.datesTbd || undefined}
          >
            <div>
              <p style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 700, color: NEU.inkSoft, margin: '0 0 5px' }}>First day</p>
              <DatePicker
                value={p.startDate}
                min={p.todayISO}
                onChange={p.onStartDate}
                placeholder="First day"
                variant="well"
                invalid={datesBackwards}
              />
            </div>
            <div>
              <p style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 700, color: NEU.inkSoft, margin: '0 0 5px' }}>Last day</p>
              <DatePicker
                value={p.endDate}
                min={p.startDate || p.todayISO}
                onChange={p.onEndDate}
                placeholder="Last day"
                variant="well"
                invalid={datesBackwards}
              />
            </div>
          </div>
          {datesBackwards && <Problem>The end date cannot be before the start date.</Problem>}

          {/* Dates TBD: create now, decide later. A TBD conference stays
              private (no public listing) until dates are set, but can still
              open delegate applications. */}
          <button
            type="button"
            role="checkbox"
            aria-checked={p.datesTbd}
            onClick={p.onToggleTbd}
            className="mt-3 flex w-full items-start gap-2.5 text-left focus:outline-none focus-visible:[&>span:first-child]:shadow-[0_0_0_2px_#1B3828]"
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
          >
            <span
              className="mt-0.5 flex flex-shrink-0 items-center justify-center"
              style={{
                width: 20, height: 20, borderRadius: 6,
                border: `1.5px solid ${p.datesTbd ? '#1B3828' : 'rgba(27,56,40,0.32)'}`,
                backgroundColor: p.datesTbd ? '#1B3828' : 'transparent',
                transition: `background-color 180ms ${EASE}, border-color 180ms ${EASE}`,
              }}
            >
              {p.datesTbd && <Check size={13} strokeWidth={3} style={{ color: '#EED98A' }} />}
            </span>
            <span>
              <span className="block" style={{ fontFamily: OUTFIT, fontSize: 14, fontWeight: 700, color: NEU.ink }}>
                Dates are to be decided
              </span>
              <span className="block" style={{ fontFamily: OUTFIT, fontSize: 12.5, lineHeight: 1.45, color: NEU.inkSoft, marginTop: 1 }}>
                It stays private until you add dates. You can still open applications.
              </span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
