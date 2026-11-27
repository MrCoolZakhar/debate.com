'use client';

// ── Import Your MUN CV (prompt 70, 26 Nov 2026) ─────────────────────────────
//
// One pop-up, two steps that replace each other (never a pop-up on a pop-up):
//   1  Download the template, or drop / choose a filled one (.xlsx or .csv).
//      A file the parser refuses says why in the drop zone and is not kept.
//   2  Check Your Conferences: every new row, its problem in red and edited in
//      place (the same checks as adding one by hand), Edit and Remove on any
//      row; rows already on the CV are only counted. "Add {n} conferences"
//      hands the clean rows to the page (onImport), which writes them.
// The rules live in src/lib/cvImport.ts. theme 'conference' draws in the
// conference's own colours (its theme variables), 'gavelling' in the house
// tokens. Escape and the scrim close it unless it is saving.

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Download, Upload, X } from 'lucide-react';
import { ModalOverlay } from '@/components/ModalOverlay';
import GSelect from '@/components/GSelect';
import { NEU, OUTFIT } from '@/components/neu';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { friendlyError } from '@/lib/friendlyError';
import {
  CV_ROLE_LABEL, CV_IMPORT_MAX_ROWS, checkRow, downloadCvTemplate, makeDraft, parseCvFile, splitDuplicates,
  type CvDraft,
} from '@/lib/cvImport';
import type { EntryType } from '@/components/CVEntryModal';

const RED = '#8B2020';
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const ROLE_OPTIONS = (Object.keys(CV_ROLE_LABEL) as EntryType[]).map(k => ({ value: k, label: CV_ROLE_LABEL[k] }));

export interface CvImportExisting { conference_name: string; entry_type: string | null; event_date: string | null }

export default function CvImportPopup({ existing, onImport, onClose, theme }: {
  existing: CvImportExisting[];
  /** Writes the rows; resolves to the number saved, or throws. */
  onImport: (drafts: CvDraft[]) => Promise<number>;
  onClose: () => void;
  theme: 'gavelling' | 'conference';
}) {
  const conf = theme === 'conference';
  const main = conf ? 'var(--gv-main)' : NEU.forest;
  const onMain = conf ? 'var(--gv-on-main)' : NEU.gold;

  const [step, setStep] = useState<1 | 2>(1);
  const [templateBusy, setTemplateBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [fileErr, setFileErr] = useState('');
  const [over, setOver] = useState(false);
  const [drafts, setDrafts] = useState<CvDraft[]>([]);
  const [skipped, setSkipped] = useState(0);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const busyRef = useRef(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const close = () => { if (!busyRef.current) onClose(); };

  // Focus stays inside the pop-up.
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const first = panel.querySelector<HTMLElement>('button, [href], input, [tabindex]:not([tabindex="-1"])');
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const items = [...panel.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
        .filter(el => el.offsetParent !== null);
      if (items.length === 0) return;
      const a = items[0], b = items[items.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); b.focus(); }
      else if (!e.shiftKey && document.activeElement === b) { e.preventDefault(); a.focus(); }
    };
    panel.addEventListener('keydown', onKey);
    return () => panel.removeEventListener('keydown', onKey);
  }, [step]);

  const problems = useMemo(() => new Map(drafts.map(d => [d.key, checkRow(d)] as const)), [drafts]);
  const needFix = [...problems.values()].filter(Boolean).length;
  const n = drafts.length;

  async function getTemplate() {
    if (templateBusy) return;
    setTemplateBusy(true);
    try { await downloadCvTemplate(); } catch (e) { notifyErr(friendlyError(e, 'Could not make the template. Please try again')); }
    finally { setTemplateBusy(false); }
  }

  async function readFile(file: File | null | undefined) {
    if (!file || reading) return;
    setFileErr('');
    setReading(true);
    const res = await parseCvFile(file);
    setReading(false);
    if (inputRef.current) inputRef.current.value = '';
    if (!res.ok) { setFileErr(res.message); return; }
    const { fresh, duplicates } = splitDuplicates(res.drafts, existing);
    setDrafts(fresh);
    setSkipped(duplicates);
    setOpenKey(null);
    setStep(2);
  }

  function back() {
    if (busyRef.current) return;
    setDrafts([]); setSkipped(0); setOpenKey(null); setFileErr(''); setStep(1);
  }

  function update(key: string, patch: Partial<Record<'conference' | 'role' | 'month' | 'committee' | 'position' | 'awards' | 'description', string>>) {
    setDrafts(prev => prev.map(d => {
      if (d.key !== key) return d;
      const f = {
        conference: d.conference_name, role: d.entry_type ? CV_ROLE_LABEL[d.entry_type] : d.role_text,
        month: d.event_date ? d.event_date.slice(0, 7) : d.month_text, committee: d.committee, position: d.allocation,
        awards: d.awards.join(', '), description: d.description ?? '', ...patch,
      };
      return makeDraft(f, d.key);
    }));
  }

  async function add() {
    if (busyRef.current || needFix > 0 || n === 0) return;
    busyRef.current = true;
    setSaving(true);
    try {
      const saved = await onImport(drafts);
      notifyOk(`Added ${saved} ${saved === 1 ? 'conference' : 'conferences'} to your MUN CV`);
      busyRef.current = false;
      onClose();
      return;
    } catch (e) {
      notifyErr(friendlyError(e, 'Could not add your conferences. Please try again'));
    } finally {
      busyRef.current = false;
      setSaving(false);
    }
  }

  const btnMain: React.CSSProperties = {
    minHeight: 44, padding: '0 18px', borderRadius: 12, border: 'none', fontFamily: OUTFIT, fontSize: 14, fontWeight: 700,
    background: main, color: onMain, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  };
  const btnQuiet: React.CSSProperties = {
    minHeight: 40, padding: '0 14px', borderRadius: 12, fontFamily: OUTFIT, fontSize: 14, fontWeight: 700,
    background: 'transparent', color: NEU.ink, border: `1.5px solid color-mix(in srgb, ${NEU.ink} 18%, transparent)`, cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', gap: 6,
  };
  const linkBtn: React.CSSProperties = {
    background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: OUTFIT, fontSize: 13, fontWeight: 700,
    color: main, textDecoration: 'underline', textUnderlineOffset: 3,
  };

  return (
    <ModalOverlay onClose={close} closeOnEscape={!saving} label="Import Your MUN CV" scrimColor="rgba(27,20,16,0.42)">
      <div
        ref={panelRef}
        className="gv-cvi"
        style={{
          width: 'min(880px, calc(100vw - 32px))', maxHeight: 'calc(100dvh - 64px)', display: 'flex', flexDirection: 'column',
          background: NEU.surface, borderRadius: 24, boxShadow: '0 26px 70px rgba(27,56,40,0.30)', fontFamily: OUTFIT, color: NEU.ink, overflow: 'hidden',
        }}
      >
        <style>{`
          .gv-cvi :focus{outline:none}
          .gv-cvi :focus-visible{outline:2px solid ${main};outline-offset:2px}
          .gv-cvi-halves{display:grid;grid-template-columns:1fr;gap:16px}
          @media (min-width:720px){.gv-cvi-halves{grid-template-columns:1fr 1fr}}
          .gv-cvi-input{width:100%;min-height:42px;padding:0 12px;border-radius:12px;border:1.5px solid color-mix(in srgb, ${NEU.ink} 18%, transparent);background:#FFFFFF;font-family:${OUTFIT};font-size:14px;color:${NEU.ink}}
          .gv-cvi-area{min-height:72px;padding:10px 12px;resize:vertical}
          .gv-cvi-label{display:block;font-size:12.5px;font-weight:700;color:${NEU.inkSoft};margin-bottom:4px}
          .gv-cvi-skel{display:block;height:12px;border-radius:6px;background:color-mix(in srgb, ${NEU.ink} 9%, transparent);animation:gvCviPulse 1.2s ease-in-out infinite}
          @keyframes gvCviPulse{0%,100%{opacity:1}50%{opacity:0.5}}
          @media (prefers-reduced-motion:reduce){.gv-cvi-skel{animation:none}}
        `}</style>

        {/* Head */}
        <div className="flex items-start gap-3" style={{ padding: '22px 24px 12px' }}>
          {step === 2 && (
            <button type="button" onClick={back} disabled={saving} style={btnQuiet} aria-label="Back to the upload">
              <ArrowLeft size={16} strokeWidth={1.5} aria-hidden /> Back
            </button>
          )}
          <div className="min-w-0 flex-1">
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: '-0.01em' }}>
              {step === 1 ? 'Import Your MUN CV' : 'Check Your Conferences'}
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 14, color: NEU.inkSoft }}>
              {step === 1 ? 'Add all your past conferences at once' : (
                <>
                  {n} ready to add
                  {skipped > 0 ? `, ${skipped} already on your CV will be skipped` : ''}
                  {needFix > 0 ? <span style={{ color: RED, fontWeight: 700 }}>{`, ${needFix} need a fix`}</span> : null}
                </>
              )}
            </p>
          </div>
          <button type="button" onClick={close} disabled={saving} aria-label="Close" style={{ ...btnQuiet, width: 40, padding: 0, justifyContent: 'center', borderRadius: 999 }}>
            <X size={18} strokeWidth={1.5} aria-hidden />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '8px 24px 20px', overflowY: 'auto', flex: '1 1 auto', minHeight: 0 }}>
          {step === 1 ? (
            <div className="gv-cvi-halves">
              <section style={{ padding: 18, borderRadius: 18, background: '#FFFFFF', boxShadow: '0 1px 3px rgba(27,56,40,0.08)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Download the Template</h3>
                <p style={{ margin: 0, fontSize: 14, color: NEU.inkSoft, lineHeight: 1.5 }}>Fill in one conference per row. The second sheet explains each column.</p>
                <div style={{ marginTop: 'auto' }}>
                  <button type="button" onClick={() => { void getTemplate(); }} disabled={templateBusy} aria-busy={templateBusy || undefined} style={{ ...btnMain, opacity: templateBusy ? 0.7 : 1 }}>
                    <Download size={16} strokeWidth={1.5} aria-hidden /> {templateBusy ? 'Preparing' : 'Download template'}
                  </button>
                </div>
              </section>
              <section style={{ padding: 18, borderRadius: 18, background: '#FFFFFF', boxShadow: '0 1px 3px rgba(27,56,40,0.08)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Upload Your File</h3>
                <div
                  onDragOver={(e) => { e.preventDefault(); if (!over) setOver(true); }}
                  onDragEnter={(e) => { e.preventDefault(); setOver(true); }}
                  onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false); }}
                  onDrop={(e) => { e.preventDefault(); setOver(false); void readFile(e.dataTransfer.files?.[0]); }}
                  style={{
                    minHeight: 132, borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, textAlign: 'center',
                    border: `2px dashed ${over ? main : `color-mix(in srgb, ${NEU.ink} 22%, transparent)`}`,
                    background: over ? `color-mix(in srgb, ${main} 7%, transparent)` : 'transparent',
                  }}
                >
                  {reading ? (
                    <div aria-busy="true" aria-label="Reading your file" style={{ width: '80%', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <span className="gv-cvi-skel" /><span className="gv-cvi-skel" style={{ width: '70%' }} /><span className="gv-cvi-skel" style={{ width: '85%' }} />
                    </div>
                  ) : (
                    <>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Drop your filled template here</p>
                      <button type="button" onClick={() => inputRef.current?.click()} style={btnQuiet}>
                        <Upload size={16} strokeWidth={1.5} aria-hidden /> Choose a file
                      </button>
                      {fileErr ? <p role="alert" style={{ margin: 0, fontSize: 13, fontWeight: 600, color: RED }}>{fileErr}</p> : null}
                    </>
                  )}
                  <input ref={inputRef} type="file" accept=".xlsx,.csv" hidden onChange={(e) => { void readFile(e.target.files?.[0]); }} />
                </div>
                <p style={{ margin: 0, fontSize: 12.5, color: NEU.inkSoft }}>Excel or CSV, up to {CV_IMPORT_MAX_ROWS} conferences</p>
              </section>
            </div>
          ) : n === 0 ? (
            <p style={{ margin: 0, fontSize: 14, color: NEU.inkSoft }}>Every conference in this file is already on your CV</p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {drafts.map(d => {
                const problem = problems.get(d.key) ?? null;
                const open = openKey === d.key || !!problem;
                const role = d.entry_type ? CV_ROLE_LABEL[d.entry_type] : d.role_text;
                const facts = [role, d.committee, d.allocation, d.event_date ? `${MONTHS[Number(d.event_date.slice(5, 7)) - 1]} ${d.event_date.slice(0, 4)}` : '', d.awards.join(', ')].filter(Boolean).join(' · ');
                return (
                  <li key={d.key} style={{
                    padding: '12px 14px', borderRadius: 14, background: '#FFFFFF', boxShadow: problem ? `inset 3px 0 0 ${RED}, 0 1px 3px rgba(27,56,40,0.08)` : '0 1px 3px rgba(27,56,40,0.08)',
                  }}>
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <p style={{ margin: 0, fontSize: 16, fontWeight: 800, overflowWrap: 'break-word' }}>{d.conference_name || 'No conference name'}</p>
                        {facts ? <p style={{ margin: '2px 0 0', fontSize: 13, color: NEU.inkSoft, overflowWrap: 'break-word' }}>{facts}</p> : null}
                        {problem ? <p role="alert" style={{ margin: '4px 0 0', fontSize: 13, fontWeight: 700, color: RED }}>{problem}</p> : null}
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {!problem && <button type="button" style={linkBtn} onClick={() => setOpenKey(openKey === d.key ? null : d.key)}>{openKey === d.key ? 'Done' : 'Edit'}</button>}
                        <button type="button" style={{ ...linkBtn, color: RED }} disabled={saving} onClick={() => setDrafts(prev => prev.filter(x => x.key !== d.key))}>Remove</button>
                      </div>
                    </div>
                    {open && <RowEditor draft={d} onChange={(p) => update(d.key, p)} />}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer (step 2) */}
        {step === 2 && (
          <div className="flex flex-wrap items-center justify-end gap-2" style={{ padding: '14px 24px 18px', borderTop: `1px solid color-mix(in srgb, ${NEU.ink} 10%, transparent)` }}>
            <button
              type="button"
              onClick={() => { void add(); }}
              disabled={saving || needFix > 0 || n === 0}
              aria-busy={saving || undefined}
              style={{ ...btnMain, opacity: saving || needFix > 0 || n === 0 ? 0.55 : 1, cursor: saving || needFix > 0 || n === 0 ? 'default' : 'pointer'}}
            >
              {saving ? 'Adding' : `Add ${n} ${n === 1 ? 'conference' : 'conferences'}`}
            </button>
          </div>
        )}
      </div>
    </ModalOverlay>
  );
}

/** One row's fields, edited in place; every change re-runs the check. */
function RowEditor({ draft: d, onChange }: {
  draft: CvDraft;
  onChange: (patch: Partial<Record<'conference' | 'role' | 'month' | 'committee' | 'position' | 'awards' | 'description', string>>) => void;
}) {
  const id = (f: string) => `cvi-${d.key}-${f}`;
  const positionLabel = d.entry_type === 'chair' ? 'Dais position (optional)'
    : d.entry_type === 'faculty-advisor' ? 'Delegation you advised'
    : d.entry_type === 'secretariat' ? 'Secretariat position'
    : d.entry_type === 'other' ? 'Role title' : 'Country or allocation';
  return (
    <div className="grid gap-3 mt-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
      <div><label className="gv-cvi-label" htmlFor={id('c')}>Conference</label>
        <input id={id('c')} className="gv-cvi-input" value={d.conference_name} onChange={e => onChange({ conference: e.target.value })} /></div>
      <div><span className="gv-cvi-label">Role</span>
        <GSelect aria-label="Role" value={(d.entry_type ?? '') as string} onChange={v => onChange({ role: CV_ROLE_LABEL[v as EntryType] })}
          options={[...(d.entry_type ? [] : [{ value: '', label: 'Pick a role' }]), ...ROLE_OPTIONS]} /></div>
      <div><label className="gv-cvi-label" htmlFor={id('m')}>Committee</label>
        <input id={id('m')} className="gv-cvi-input" value={d.committee} onChange={e => onChange({ committee: e.target.value })} /></div>
      <div><label className="gv-cvi-label" htmlFor={id('p')}>{positionLabel}</label>
        <input id={id('p')} className="gv-cvi-input" value={d.allocation} onChange={e => onChange({ position: e.target.value })} /></div>
      <div><span className="gv-cvi-label">Month</span>
        <MonthYear value={d.event_date ?? ''} onChange={iso => onChange({ month: iso ? iso.slice(0, 7) : '' })} /></div>
      <div><label className="gv-cvi-label" htmlFor={id('a')}>Awards (comma separated)</label>
        <input id={id('a')} className="gv-cvi-input" value={d.awards.join(', ')} onChange={e => onChange({ awards: e.target.value })} /></div>
      <div style={{ gridColumn: '1 / -1' }}><label className="gv-cvi-label" htmlFor={id('d')}>Description</label>
        <textarea id={id('d')} className="gv-cvi-input gv-cvi-area" value={d.description ?? ''} onChange={e => onChange({ description: e.target.value })} /></div>
    </div>
  );
}

/** The month and year picker CVEntryModal uses (two GSelects, the 1st of the month), rebuilt here because it is not exported. */
function MonthYear({ value, onChange }: { value: string; onChange: (iso: string) => void }) {
  const currentYear = new Date().getFullYear();
  const selMonth = value ? Number(value.slice(5, 7)) - 1 : -1;
  const selYear = value ? Number(value.slice(0, 4)) : -1;
  const years: number[] = [];
  for (let y = currentYear; y >= currentYear - 30; y--) years.push(y);
  const emit = (m: number, y: number) => {
    if (m < 0 || y < 0) { onChange(''); return; }
    onChange(`${y}-${String(m + 1).padStart(2, '0')}-01`);
  };
  return (
    <div className="grid grid-cols-2 gap-2">
      <GSelect aria-label="Month" value={String(selMonth)} onChange={v => emit(Number(v), selYear >= 0 ? selYear : currentYear)}
        options={[{ value: '-1', label: 'Month' }, ...MONTHS.map((m, i) => ({ value: String(i), label: m }))]} />
      <GSelect aria-label="Year" value={String(selYear)} searchable={false} onChange={v => emit(selMonth >= 0 ? selMonth : 0, Number(v))}
        options={[{ value: '-1', label: 'Year' }, ...years.map(y => ({ value: String(y), label: String(y) }))]} />
    </div>
  );
}
