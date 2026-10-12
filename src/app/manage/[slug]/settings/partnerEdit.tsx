'use client';

/**
 * Edit a partner in place (Settings → Partners, 12 Oct 2026; owner: you could
 * only add or remove a partner, never change one).
 *
 * A partner row is one of two shapes (`conference_partners_one_shape`):
 *   - a linked Gavelling conference: `partner_conference_id` set, every
 *     `company_*` column null; the other team approves it;
 *   - a company typed in here: `partner_conference_id` null, a non-blank
 *     `company_name`, optional logo, description and https:// website.
 * Editing can change the fields of either shape, change which conference is
 * linked, or switch a row between the two kinds. The page writes the whole
 * shape in ONE update (so the check constraint never sees half of each), and
 * the `guard_partner_approval` trigger re-arms approval when the linked
 * conference changes (a new conference must approve again; a company is
 * approved at once). Presentation and its own search box only: every write and
 * upload is the page's, passed in.
 */

import { useEffect, useRef, useState } from 'react';
import { Briefcase, Building2, Check, Search, Trash2, Upload } from 'lucide-react';
import { LogoDisc } from '@/components/LogoDisc';
import { conferenceAcronymLabel } from '@/lib/conferenceLabels';
import { F, INK, INK_SOFT, FOREST, DANGER, AMBER, INPUT, TYPE, TYPE_PX, FieldLabel } from './panelKit';

export interface PartnerConfLite {
  id: string;
  slug: string;
  full_name: string;
  acronym: string;
  logo_url: string | null;
  city: string | null;
  country: string | null;
  start_date: string | null;
}

export interface EditablePartner {
  id: string;
  partner_conference_id: string | null;
  company_name: string | null;
  company_logo_url: string | null;
  company_description: string | null;
  company_url: string | null;
  conf: PartnerConfLite | null;
}

export type PartnerEditPatch =
  | { kind: 'conference'; conf: PartnerConfLite }
  | { kind: 'company'; name: string; logoUrl: string | null; description: string | null; url: string | null };

export function PartnerEditPanel({ link, searchConferences, uploadLogo, onSave, onCancel }: {
  link: EditablePartner;
  /** Public conferences matching the text, this one and linked ones left out. */
  searchConferences: (q: string) => Promise<PartnerConfLite[]>;
  /** Uploads a logo and returns its public URL, or null (the page says why). */
  uploadLogo: (file: File) => Promise<string | null>;
  /** One verified write; resolves true when it landed. */
  onSave: (patch: PartnerEditPatch) => Promise<boolean>;
  onCancel: () => void;
}) {
  const wasCompany = link.partner_conference_id === null;
  const [kind, setKind] = useState<'conference' | 'company'>(wasCompany ? 'company' : 'conference');
  const [conf, setConf] = useState<PartnerConfLite | null>(link.conf);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PartnerConfLite[]>([]);
  const [name, setName] = useState(link.company_name ?? '');
  const [description, setDescription] = useState(link.company_description ?? '');
  const [url, setUrl] = useState(link.company_url ?? '');
  const [logoUrl, setLogoUrl] = useState<string | null>(link.company_logo_url);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);

  // Debounced search; the last answer wins.
  useEffect(() => {
    const q = query.trim();
    if (kind !== 'conference' || q.length < 2) return;
    let live = true;
    const t = window.setTimeout(async () => {
      const found = await searchConferences(q);
      if (live) setResults(found);
    }, 300);
    return () => { live = false; window.clearTimeout(t); };
  }, [query, kind, searchConferences]);

  useEffect(() => {
    const t = window.setTimeout(() => boxRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus({ preventScroll: true }), 30);
    return () => window.clearTimeout(t);
  }, []);

  const shownResults = kind === 'conference' && query.trim().length >= 2 ? results : [];
  const urlTrim = url.trim();
  const urlProblem = urlTrim === '' ? '' : urlTrim.startsWith('http://') ? 'Links must start with https:// to be secure.' : !urlTrim.startsWith('https://') ? 'The website must start with https://' : '';
  const conferenceChanged = kind === 'conference' && conf !== null && conf.id !== link.partner_conference_id;
  const canSave = !saving && !uploading && (kind === 'conference' ? conf !== null : name.trim() !== '' && !urlProblem);

  async function save() {
    if (!canSave) return;
    setSaving(true);
    const ok = await onSave(kind === 'conference' && conf
      ? { kind: 'conference', conf }
      : { kind: 'company', name: name.trim(), logoUrl, description: description.trim() || null, url: urlTrim || null });
    setSaving(false);
    if (ok) onCancel();
  }

  async function pickLogo(file: File) {
    setUploading(true);
    const next = await uploadLogo(file);
    setUploading(false);
    if (next) setLogoUrl(next);
  }

  const label: React.CSSProperties = { fontFamily: F, fontSize: TYPE_PX.hint, color: INK_SOFT };

  return (
    <div
      ref={boxRef}
      className="mt-3 rounded-2xl"
      style={{ padding: 'clamp(12px, 2.4vw, 18px)', background: '#FAF8F3', boxShadow: 'inset 0 0 0 1.5px rgba(27,56,40,0.12)' }}
      onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onCancel(); } }}
    >
      <p style={{ ...TYPE.label, fontWeight: 700, marginBottom: 10 }}>Edit Partner</p>

      {/* Kind: two segments, sentence case. Switching keeps both drafts. */}
      <div role="radiogroup" aria-label="Kind of partner" className="inline-flex gap-1 p-1 rounded-xl mb-4" style={{ background: '#FFFFFF', boxShadow: 'inset 0 0 0 1px rgba(27,56,40,0.10)' }}>
        {([
          { key: 'conference' as const, word: 'Conference', Icon: Building2 },
          { key: 'company' as const, word: 'Company', Icon: Briefcase },
        ]).map(({ key, word, Icon }) => {
          const on = kind === key;
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setKind(key)}
              className="inline-flex items-center gap-1.5 rounded-lg focus:outline-none focus-visible:ring-2"
              style={{ minHeight: 36, padding: '0 14px', border: 'none', cursor: 'pointer', fontFamily: F, fontSize: TYPE_PX.body, fontWeight: 700, background: on ? FOREST : 'transparent', color: on ? '#EED98A' : INK }}
            >
              <Icon size={15} strokeWidth={2.3} aria-hidden />
              {word}
            </button>
          );
        })}
      </div>

      {kind === 'conference' ? (
        <div>
          {conf && (
            <div className="flex items-center gap-3 mb-3 rounded-xl" style={{ padding: 10, background: '#FFFFFF' }}>
              <LogoDisc src={conf.logo_url} alt={conf.acronym} size={40} fallbackText={conf.acronym?.[0] ?? '?'} />
              <span className="min-w-0 flex-1">
                <span className="block" style={{ fontFamily: F, fontSize: TYPE_PX.body, fontWeight: 800, color: INK, overflowWrap: 'anywhere' }}>{conferenceAcronymLabel(conf) || conf.full_name}</span>
                <span className="block" style={{ ...label, overflowWrap: 'anywhere' }}>{[conf.city, conf.country].filter(Boolean).join(', ') || conf.full_name}</span>
              </span>
              <Check size={18} strokeWidth={2.6} color={FOREST} aria-hidden />
            </div>
          )}
          <FieldLabel htmlFor={`partner-search-${link.id}`}>{conf ? 'Link a different conference' : 'Find the conference'}</FieldLabel>
          <div className="relative">
            <Search size={16} strokeWidth={2.3} aria-hidden style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: INK_SOFT }} />
            <input
              id={`partner-search-${link.id}`}
              data-autofocus={wasCompany ? undefined : ''}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search public conferences by acronym or name"
              style={{ ...INPUT, fontSize: 16, paddingLeft: 36 }}
            />
          </div>
          {/* Inline, not floating: nothing here can be clipped. */}
          {shownResults.length > 0 && (
            <div className="mt-2 flex flex-col gap-1">
              {shownResults.map(r => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => { setConf(r); setQuery(''); setResults([]); }}
                  className="flex items-center gap-3 text-left rounded-xl focus:outline-none focus-visible:ring-2 hover:bg-white"
                  style={{ padding: '8px 10px', border: 'none', background: 'transparent', cursor: 'pointer' }}
                >
                  <LogoDisc src={r.logo_url} alt={r.acronym} size={32} fallbackText={r.acronym?.[0] ?? '?'} />
                  <span className="min-w-0">
                    <span className="block" style={{ fontFamily: F, fontSize: TYPE_PX.body, fontWeight: 700, color: INK, overflowWrap: 'anywhere' }}>{conferenceAcronymLabel(r) || r.full_name}</span>
                    <span className="block" style={{ ...label, overflowWrap: 'anywhere' }}>{[r.city, r.country].filter(Boolean).join(', ') || r.full_name}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
          {(conferenceChanged || wasCompany) && (
            <p className="mt-2" style={{ ...label, color: AMBER }}>
              {wasCompany ? 'The company details go. ' : ''}It shows on your page once that conference&apos;s team approves it.
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <LogoDisc src={logoUrl} alt={name || 'Logo'} size={48} fallbackText={(name || '?')[0]} />
            <label
              className="gv-st-btn gv-st-outline"
              style={{ minHeight: 38, padding: '0 12px', cursor: uploading ? 'default' : 'pointer', opacity: uploading ? 0.6 : 1 }}
            >
              <Upload size={15} strokeWidth={2.3} aria-hidden />
              {uploading ? 'Uploading' : logoUrl ? 'Replace logo' : 'Upload logo'}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (file) void pickLogo(file);
                }}
              />
            </label>
            {logoUrl && (
              <button type="button" onClick={() => setLogoUrl(null)} className="inline-flex items-center gap-1 focus:outline-none focus-visible:ring-2 rounded" style={{ fontFamily: F, fontSize: TYPE_PX.hint, fontWeight: 700, color: DANGER, background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                <Trash2 size={14} strokeWidth={2.3} aria-hidden />
                Remove logo
              </button>
            )}
          </div>
          <div>
            <FieldLabel htmlFor={`partner-name-${link.id}`}>Name</FieldLabel>
            <input id={`partner-name-${link.id}`} data-autofocus={wasCompany ? '' : undefined} type="text" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} placeholder="Company name" style={{ ...INPUT, fontSize: 16 }} />
          </div>
          <div>
            <FieldLabel htmlFor={`partner-desc-${link.id}`}>What they do</FieldLabel>
            <textarea id={`partner-desc-${link.id}`} rows={3} maxLength={600} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Shown when a visitor opens this partner" style={{ ...INPUT, fontSize: 16, resize: 'vertical', lineHeight: 1.55 }} />
          </div>
          <div>
            <FieldLabel htmlFor={`partner-url-${link.id}`}>Website</FieldLabel>
            <input id={`partner-url-${link.id}`} type="text" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" style={{ ...INPUT, fontSize: 16 }} />
            {urlProblem && <p className="mt-1" role="alert" style={{ ...label, color: DANGER }}>{urlProblem}</p>}
          </div>
          {!wasCompany && <p style={{ ...label, color: AMBER }}>The link to the conference goes, and the company shows on your page straight away.</p>}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => void save()} disabled={!canSave} className="gv-st-btn gv-st-forest" style={{ minHeight: 38, opacity: canSave ? 1 : 0.5, cursor: canSave ? 'pointer' : 'default' }}>
          {saving ? 'Saving' : 'Save changes'}
        </button>
        <button type="button" onClick={onCancel} disabled={saving} className="gv-st-btn gv-st-outline" style={{ minHeight: 38 }}>
          Cancel
        </button>
      </div>
    </div>
  );
}
