'use client';

/**
 * CustomizationCard — "give your conference its own colours", in
 * Settings → Conference.
 *
 * DRAFT AND PUBLISHED ARE DIFFERENT COLUMNS
 * Everything an organizer touches here writes conferences.theme_draft.
 * Nothing outside this card, and the organizer's own PREVIEW link, ever
 * reads it: the public conference page reads conferences.theme, the
 * PUBLISHED palette. "Save and publish" is the only thing that copies
 * draft into published (via the publish_conference_theme RPC), so an
 * organizer can experiment freely without ever risking what a visitor
 * currently sees.
 *
 * TEXT COLOUR IS CHOSEN, NOT LABELLED
 * The two text rows are called "Light text" and "Dark text" for the
 * organizer's own bookkeeping, but nothing here, or anywhere theme.ts is
 * read, ever trusts those labels. pickTextColor() always measures actual
 * WCAG contrast against whatever surface the colour would sit on and
 * returns the better of the two candidates. Two dark colours in means the
 * card still shows the better of the two, never guaranteed-unreadable text.
 */

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, Eye } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { useManage } from '@/app/manage/[slug]/layout';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { useConfirmModal } from '@/components/ConfirmModal';
import { InfoHint } from './applicationsUi';
import {
  type ConferenceTheme, GAVELLING_THEME, themeCssVars, themeWarnings,
} from '@/lib/theme';

const OUTFIT = "'Outfit', sans-serif";

type ThemeKey = 'background' | 'main' | 'accent' | 'text_light' | 'text_dark';

interface Preset {
  hex: string;
  name: string;
}

interface Row {
  key: ThemeKey;
  label: string;
  helper: string;
  presets: Preset[];
}

const ROWS: Row[] = [
  {
    key: 'background',
    label: 'Background',
    helper: 'The page behind everything.',
    presets: [
      { hex: '#EDE7D8', name: 'Ivory' },
      { hex: '#FFFFFF', name: 'White' },
      { hex: '#F2F0EB', name: 'Warm grey' },
      { hex: '#F1F3F5', name: 'Cool grey' },
      { hex: '#F5EFE2', name: 'Sand' },
      { hex: '#12211A', name: 'Deep forest' },
      { hex: '#14161A', name: 'Near black' },
      { hex: '#0F1A2E', name: 'Deep navy' },
    ],
  },
  {
    key: 'main',
    label: 'Main colour',
    helper: 'Buttons, headers and the progress rail.',
    presets: [
      { hex: '#1B3828', name: 'Forest' },
      { hex: '#14284B', name: 'Navy' },
      { hex: '#4B92DB', name: 'UN blue' },
      { hex: '#6E1B2E', name: 'Burgundy' },
      { hex: '#14554F', name: 'Teal' },
      { hex: '#4A2145', name: 'Plum' },
      { hex: '#3F4A52', name: 'Slate' },
      { hex: '#7A3E12', name: 'Rust' },
    ],
  },
  {
    key: 'accent',
    label: 'Accent',
    helper: 'Highlights, badges and featured partners.',
    presets: [
      { hex: '#B6871F', name: 'Gold' },
      { hex: '#C2703D', name: 'Copper' },
      { hex: '#8FA5B8', name: 'Silver' },
      { hex: '#2A7D6B', name: 'Jade' },
      { hex: '#A63D57', name: 'Rose' },
      { hex: '#5B6ABF', name: 'Periwinkle' },
      { hex: '#6F8F3B', name: 'Olive' },
      { hex: '#B8B8B8', name: 'Platinum' },
    ],
  },
  {
    key: 'text_light',
    label: 'Light text',
    helper: 'Used wherever the background behind it is dark.',
    presets: [
      { hex: '#FFFFFF', name: 'White' },
      { hex: '#EED98A', name: 'Gold' },
      { hex: '#F2EFE6', name: 'Warm white' },
      { hex: '#E8EDF2', name: 'Cool white' },
    ],
  },
  {
    key: 'text_dark',
    label: 'Dark text',
    helper: 'Used wherever the background behind it is light.',
    presets: [
      { hex: '#1C1410', name: 'Ink' },
      { hex: '#000000', name: 'Black' },
      { hex: '#22201C', name: 'Charcoal' },
      { hex: '#14284B', name: 'Navy' },
    ],
  },
];

const THEME_KEYS: ThemeKey[] = ['background', 'main', 'accent', 'text_light', 'text_dark'];

/** The Gavelling default for one theme key, keyed off the same object every
 *  unset field falls back to. */
function fieldDefault(key: ThemeKey): string {
  switch (key) {
    case 'background': return GAVELLING_THEME.background;
    case 'main': return GAVELLING_THEME.main;
    case 'accent': return GAVELLING_THEME.accent;
    case 'text_light': return GAVELLING_THEME.textLight;
    case 'text_dark': return GAVELLING_THEME.textDark;
  }
}

function fieldValue(theme: ConferenceTheme, key: ThemeKey): string {
  return theme[key] ?? fieldDefault(key);
}

function buildHexInputs(theme: ConferenceTheme): Record<ThemeKey, string> {
  const out = {} as Record<ThemeKey, string>;
  for (const key of THEME_KEYS) out[key] = fieldValue(theme, key);
  return out;
}

/** Two themes are equal when all five keys agree, missing and undefined
 *  treated the same — never a raw JSON.stringify, which would care about key
 *  order and about a key being absent vs explicitly undefined. */
function themesEqual(a: ConferenceTheme, b: ConferenceTheme): boolean {
  return THEME_KEYS.every((key) => (a[key] ?? null) === (b[key] ?? null));
}

/** `raw` with an optional leading `#` stripped and validated as exactly 6 hex
 *  digits; returns a canonical `#RRGGBB` (uppercase) or null when it does not
 *  parse yet. Never commits a partial or invalid value. */
function normalizeHexInput(raw: string): string | null {
  const stripped = raw.trim().replace(/^#/, '');
  return /^[0-9a-fA-F]{6}$/.test(stripped) ? `#${stripped.toUpperCase()}` : null;
}

// Standard failure copy for a verified-write save: an error OR zero affected
// rows (RLS silently filtered it, or the row vanished) is treated identically,
// never a silent false success.
function saveFailMessage(error?: { message: string } | null): string {
  return "Could not save, please refresh and try again." + (error?.message ? ' ' + error.message : '');
}

export interface CustomizationCardProps {
  conferenceId: string;
  conferenceSlug: string;
  initialDraft: ConferenceTheme;
  initialPublished: ConferenceTheme;
  cardStyle: React.CSSProperties;
}

export default function CustomizationCard({
  conferenceId, conferenceSlug, initialDraft, initialPublished, cardStyle,
}: CustomizationCardProps) {
  const { session } = useAuth();
  const { refreshConferenceQuiet } = useManage();
  const { confirm, modal: confirmModal } = useConfirmModal();

  const [draft, setDraft] = useState<ConferenceTheme>(initialDraft);
  const [published, setPublished] = useState<ConferenceTheme>(initialPublished);
  const [hexInputs, setHexInputs] = useState<Record<ThemeKey, string>>(() => buildHexInputs(initialDraft));

  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [draftError, setDraftError] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [justPublished, setJustPublished] = useState(false);
  const [publishError, setPublishError] = useState('');

  const isPublished = themesEqual(draft, published);

  // Debounced, serialized write path for theme_draft. Mirrors the pattern
  // already used for the question builder on this settings screen and for
  // the financial aid form editor: patch local state immediately, debounce
  // the write, and serialize writes through a promise chain so two of them
  // can never be in flight at once.
  const draftPendingRef = useRef<ConferenceTheme | null>(null);
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftChainRef = useRef<Promise<void>>(Promise.resolve());
  const flushDraftRef = useRef<() => void>(() => {});

  /** Writes the pending draft, appended to the serial chain so two writes can
   *  never race. Verified write: an error or a row count other than 1 is a
   *  failure, surfaced rather than swallowed. */
  function persistDraft() {
    const pending = draftPendingRef.current;
    if (!pending) return;
    draftPendingRef.current = null;
    draftChainRef.current = draftChainRef.current.then(async () => {
      if (!session) {
        setSaveState('idle');
        setDraftError('Your session has expired, please refresh and sign in again.');
        return;
      }
      const supabase = await getFreshAuthedClient();
      if (!supabase) {
        setSaveState('idle');
        setDraftError('Your session has expired, please refresh and sign in again.');
        return;
      }
      const { data, error } = await supabase
        .from('conferences')
        .update({ theme_draft: pending })
        .eq('id', conferenceId)
        .select('id');
      if (error || !data || data.length !== 1) {
        setSaveState('idle');
        setDraftError(saveFailMessage(error));
        return;
      }
      setDraftError('');
      setSaveState('saved');
      setTimeout(() => setSaveState((s) => (s === 'saved' ? 'idle' : s)), 2000);
      await refreshConferenceQuiet();
    });
  }

  /** Patch local state at once so the wheel/swatch/text field stays
   *  responsive, then debounce the write at 400ms — never one write per
   *  keystroke of the hex field. */
  function scheduleSave(next: ConferenceTheme) {
    draftPendingRef.current = next;
    setSaveState('saving');
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      draftTimerRef.current = null;
      persistDraft();
    }, 400);
  }

  /** Cancel the debounce and write now. Called on unmount and by Reset, which
   *  wants to feel instant rather than waiting out the debounce window. */
  function flushDraft() {
    if (draftTimerRef.current) {
      clearTimeout(draftTimerRef.current);
      draftTimerRef.current = null;
    }
    persistDraft();
  }
  flushDraftRef.current = flushDraft;

  useEffect(() => {
    return () => { flushDraftRef.current(); };
  }, []);

  /** The single path every input method (swatch, wheel, valid hex text)
   *  commits a colour change through, so the draft, the debounced write and
   *  the hex text field can never disagree with each other. */
  function setColor(key: ThemeKey, hex: string) {
    const normalized = hex.toUpperCase();
    setDraft((prev) => {
      const next = { ...prev, [key]: normalized };
      scheduleSave(next);
      return next;
    });
    setHexInputs((prev) => ({ ...prev, [key]: normalized }));
  }

  function handleHexInputChange(key: ThemeKey, raw: string) {
    setHexInputs((prev) => ({ ...prev, [key]: raw }));
    const normalized = normalizeHexInput(raw);
    if (normalized) setColor(key, normalized);
  }

  async function handleReset() {
    const { confirmed } = await confirm({
      title: 'Reset colours?',
      body: "This puts your conference back to Gavelling's colours. It does not publish until you press Save and publish.",
      confirmLabel: 'Reset',
      danger: true,
    });
    if (!confirmed) return;
    const empty: ConferenceTheme = {};
    setDraft(empty);
    setHexInputs(buildHexInputs(empty));
    if (draftTimerRef.current) {
      clearTimeout(draftTimerRef.current);
      draftTimerRef.current = null;
    }
    draftPendingRef.current = empty;
    setSaveState('saving');
    persistDraft();
  }

  async function handlePublish() {
    if (publishing || isPublished) return;
    setPublishing(true);
    setPublishError('');
    const supabase = await getFreshAuthedClient();
    if (!supabase) {
      setPublishing(false);
      setPublishError('Your session has expired, please refresh and sign in again.');
      return;
    }
    const { data, error } = await supabase.rpc('publish_conference_theme', { p_conference_id: conferenceId });
    setPublishing(false);
    if (error) {
      setPublishError(error.message);
      return;
    }
    setPublished((data as ConferenceTheme) ?? {});
    setJustPublished(true);
    setTimeout(() => setJustPublished(false), 2500);
    await refreshConferenceQuiet();
  }

  const warnings = themeWarnings(draft);
  const previewVars = themeCssVars(draft);

  return (
    <div style={cardStyle}>
      <div className="flex items-center justify-between gap-3 mb-1">
        <p className="font-semibold text-base" style={{ color: '#1C1410', fontFamily: OUTFIT }}>Conference colours</p>
        {saveState !== 'idle' && (
          <span className="flex items-center gap-1.5 text-xs flex-shrink-0" style={{ color: saveState === 'saved' ? '#3D7A52' : '#9A8A78', fontFamily: OUTFIT }}>
            {saveState === 'saving' && (
              <span className="w-3 h-3 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#9A8A78', borderTopColor: 'transparent' }} />
            )}
            {saveState === 'saving' ? 'Saving' : 'Saved'}
          </span>
        )}
      </div>
      <p className="text-sm mb-4" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
        Pick five colours. We derive the rest and choose every text colour for contrast.
      </p>

      {draftError && (
        <p className="text-xs mb-4" style={{ color: '#8B2020', fontFamily: OUTFIT }}>{draftError}</p>
      )}

      {ROWS.map((row) => {
        const value = fieldValue(draft, row.key);
        const activePreset = row.presets.find((p) => p.hex.toLowerCase() === value.toLowerCase());
        return (
          <div key={row.key} className="mb-5">
            <label className="block text-xs font-semibold" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
              {row.label}
            </label>
            <p className="text-xs mt-0.5" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
              {row.helper}
            </p>
            <div className="flex items-center gap-2 flex-wrap mt-2.5">
              {row.presets.map((preset) => {
                const active = activePreset?.hex === preset.hex;
                return (
                  <button
                    key={preset.hex}
                    type="button"
                    onClick={() => setColor(row.key, preset.hex)}
                    aria-label={preset.name}
                    title={preset.name}
                    className="flex-shrink-0 focus:outline-none"
                    style={{
                      width: 26, height: 26, borderRadius: '999px', padding: 0,
                      backgroundColor: preset.hex,
                      border: active ? '2px solid #1B3828' : '1.5px solid #DDD4C0',
                      boxShadow: active ? '0 0 0 2px rgba(27,56,40,0.18)' : 'none',
                      cursor: 'pointer',
                    }}
                  />
                );
              })}
              <input
                type="color"
                value={value}
                onChange={(e) => setColor(row.key, e.target.value)}
                aria-label={`${row.label} colour wheel`}
                className="flex-shrink-0"
                style={{
                  width: 30, height: 30, padding: 0, borderRadius: 8,
                  border: '1.5px solid #DDD4C0', cursor: 'pointer', backgroundColor: 'transparent',
                }}
              />
              <input
                type="text"
                value={hexInputs[row.key]}
                onChange={(e) => handleHexInputChange(row.key, e.target.value)}
                placeholder="#RRGGBB"
                aria-label={`${row.label} hex value`}
                className="focus:outline-none"
                style={{
                  width: 104, padding: '6px 10px', borderRadius: 8,
                  border: '1.5px solid #DDD4C0', fontFamily: OUTFIT, fontSize: 12,
                  color: '#1C1410', backgroundColor: '#FFFDF9',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#1B3828'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = '#DDD4C0'; }}
              />
            </div>
            <p className="text-xs mt-1.5" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
              {activePreset ? activePreset.name : value}
            </p>
          </div>
        );
      })}

      {/* Live preview: the SAME functions the real pages use, so this can
          never disagree with what an applicant or visitor actually sees. */}
      <div
        className="rounded-2xl p-5 mb-4"
        style={{ ...previewVars, backgroundColor: 'var(--gv-bg)', border: '1px solid var(--gv-border)' } as React.CSSProperties}
      >
        <div className="flex items-center gap-3 flex-wrap mb-3">
          <button
            type="button"
            className="rounded-xl font-bold text-xs focus:outline-none"
            style={{
              padding: '9px 18px', letterSpacing: '0.06em',
              backgroundColor: 'var(--gv-main)', color: 'var(--gv-on-main)',
              fontFamily: OUTFIT, border: 'none', cursor: 'default',
            }}
          >
            APPLY NOW
          </button>
          <span
            className="rounded-full font-bold text-[10px] inline-flex items-center"
            style={{
              padding: '5px 12px', letterSpacing: '0.06em',
              backgroundColor: 'var(--gv-accent)', color: 'var(--gv-on-accent)',
              fontFamily: OUTFIT,
            }}
          >
            FEATURED
          </span>
        </div>
        <div
          className="rounded-xl p-4"
          style={{ backgroundColor: 'var(--gv-surface)', border: '1px solid var(--gv-border)', color: 'var(--gv-on-surface)' }}
        >
          <p className="font-bold text-sm mb-1" style={{ fontFamily: OUTFIT }}>A card on your page</p>
          <p className="text-xs" style={{ fontFamily: OUTFIT, opacity: 0.85 }}>This is what body text looks like on a surface in your theme.</p>
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="mb-4 flex flex-col gap-1.5">
          {warnings.map((warning) => (
            <p key={warning} className="flex items-center gap-1.5 text-xs" style={{ color: '#B8844A', fontFamily: OUTFIT }}>
              <AlertTriangle size={13} strokeWidth={2.4} className="flex-shrink-0" />
              {warning}
            </p>
          ))}
        </div>
      )}

      {publishError && (
        <p className="text-xs mb-3" style={{ color: '#8B2020', fontFamily: OUTFIT }}>{publishError}</p>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <a
          href={`/conferences/${conferenceSlug}?preview=1`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-[10px] focus:outline-none transition-colors"
          style={{
            padding: '7px 12px',
            fontFamily: OUTFIT, fontSize: '11px', fontWeight: 800,
            letterSpacing: '0.06em',
            color: '#1B3828', backgroundColor: 'transparent',
            border: '1.5px solid #DDD4C0', cursor: 'pointer',
            textDecoration: 'none',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.06)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
        >
          <Eye size={13} strokeWidth={2.4} />
          PREVIEW
        </a>

        <div className="inline-flex items-center gap-1.5">
          <button
            type="button"
            onClick={handlePublish}
            disabled={publishing || isPublished}
            className="inline-flex items-center gap-2 rounded-[10px] font-bold focus:outline-none transition-colors"
            style={{
              padding: '8px 16px',
              fontFamily: OUTFIT, fontSize: '11px', fontWeight: 800, letterSpacing: '0.06em',
              backgroundColor: publishing || isPublished ? '#DDD4C0' : '#1B3828',
              color: publishing || isPublished ? '#9A8A78' : '#EED98A',
              border: 'none',
              cursor: publishing || isPublished ? 'default' : 'pointer',
            }}
          >
            {publishing && (
              <span className="w-3 h-3 rounded-full border-2 border-t-transparent animate-spin flex-shrink-0" style={{ borderColor: '#9A8A78', borderTopColor: 'transparent' }} />
            )}
            {justPublished && <Check size={13} strokeWidth={3} />}
            {publishing ? 'PUBLISHING…' : isPublished ? 'PUBLISHED' : 'SAVE AND PUBLISH'}
          </button>
          <InfoHint
            label="About publishing"
            text="Publishing makes these colours live on your public conference page."
          />
        </div>

        <button
          type="button"
          onClick={handleReset}
          className="text-xs font-semibold focus:outline-none transition-colors"
          style={{ color: '#8B2020', fontFamily: OUTFIT, background: 'none', border: 'none', cursor: 'pointer', marginLeft: 'auto' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.72'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
        >
          RESET TO DEFAULT
        </button>
      </div>

      {confirmModal}
    </div>
  );
}
