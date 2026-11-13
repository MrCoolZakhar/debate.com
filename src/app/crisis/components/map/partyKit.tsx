'use client';
// Gavelling Crisis map: third parties (an owner that is neither a cabinet nor a delegate, for example "Austria").
// The map hands the pickers a PartyApi through a context (only when the person may change the map). Everything a picker
// needs lives here: the inline "Someone else" form, rename and recolour, remove with an in-place confirm, and the owner
// dropdown used by the toolbar chip and the unit card. Nothing here opens a second pop-up: forms and confirms replace
// the content of the menu or sit under the row of choices.

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Check, Pencil, Plus, Trash2 } from 'lucide-react';
import Portal from '@/components/Portal';
import { Btn, CK } from '../../crisisKit';
import type { PanelCabinet } from './MapPanels';

export const PARTY_NAME_MAX = 60;
/** Eight colours that read on the pale land and sea and apart from each other. */
export const PARTY_COLORS = ['#C0392B', '#E67E22', '#D4AC0D', '#27AE60', '#00897B', '#2980B9', '#5E35B1', '#AD1457'];

/** What the map lets a picker do with third parties. Each call says why itself when it fails and returns null or false. */
export interface PartyApi {
  create: (name: string, color: string) => Promise<string | null>;
  edit: (id: string, name: string, color: string) => Promise<boolean>;
  remove: (id: string) => Promise<boolean>;
}
export const PartyContext = createContext<PartyApi | null>(null);
export const useParty = () => useContext(PartyContext);

export type PartyMode = null | { kind: 'new' } | { kind: 'edit'; id: string } | { kind: 'remove'; id: string };

function Dot({ color, dashed }: { color: string; dashed?: boolean }) {
  return (
    <i
      aria-hidden
      style={{ display: 'inline-block', width: 11, height: 11, borderRadius: '50%', flex: 'none', background: dashed ? 'transparent' : color, border: dashed ? `1.5px dashed ${CK.inkSoft}` : 'none' }}
    />
  );
}

const smallIcon: CSSProperties = { border: 0, background: 'transparent', cursor: 'pointer', color: CK.inkSoft, lineHeight: 0, padding: 4, borderRadius: 7, flex: 'none' };

/** Name and colour, in place. */
export function PartyForm({ title, initial, submitLabel, busy, onSubmit, onCancel }: {
  title: string; initial: { name: string; color: string }; submitLabel: string; busy: boolean;
  onSubmit: (name: string, color: string) => void; onCancel: () => void;
}) {
  const [name, setName] = useState(initial.name);
  const [color, setColor] = useState(initial.color);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus({ preventScroll: true }); }, []);
  const ok = name.trim().length > 0 && name.trim().length <= PARTY_NAME_MAX;
  const submit = () => { if (ok && !busy) onSubmit(name.trim(), color); };
  return (
    <div style={{ fontFamily: CK.font }} onKeyDown={(e) => { e.stopPropagation(); }}>
      <b style={{ display: 'block', fontSize: 13, color: CK.ink, marginBottom: 6 }}>{title}</b>
      <input
        ref={input} value={name} maxLength={PARTY_NAME_MAX} aria-label="Name" placeholder="For example Austria"
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
        style={{ width: '100%', boxSizing: 'border-box', border: `1px solid ${CK.hair}`, borderRadius: 9, padding: '7px 9px', fontSize: 14, fontFamily: CK.font, color: CK.ink, background: '#fff' }}
      />
      <div role="radiogroup" aria-label="Colour" className="flex flex-wrap" style={{ gap: 6, margin: '8px 0 10px' }}>
        {PARTY_COLORS.map((c) => {
          const on = c === color;
          return (
            <button
              key={c} type="button" role="radio" aria-checked={on} aria-label={c} onClick={() => setColor(c)}
              className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] inline-flex items-center justify-center"
              style={{ width: 24, height: 24, borderRadius: '50%', border: 0, cursor: 'pointer', background: c, boxShadow: on ? `0 0 0 2px #fff, 0 0 0 4px ${CK.forest}` : `0 0 0 1px ${CK.hair}`, color: '#fff' }}
            >
              {on && <Check size={13} strokeWidth={2} aria-hidden />}
            </button>
          );
        })}
      </div>
      <div className="flex" style={{ gap: 6 }}>
        <Btn size="sm" disabled={!ok || busy} onClick={submit}>{submitLabel}</Btn>
        <Btn size="sm" tone="ghost" disabled={busy} onClick={onCancel}>Cancel</Btn>
      </div>
    </div>
  );
}

/** The form or the confirm for one mode. Calls onDone(newId) after a party was added, onDone() after a rename or a remove. */
export function PartyInline({ mode, parties, api, onDone, onCancel }: {
  mode: NonNullable<PartyMode>; parties: PanelCabinet[]; api: PartyApi; onDone: (r?: { added?: string; removed?: string }) => void; onCancel: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const target = mode.kind === 'new' ? null : parties.find((p) => p.id === mode.id) ?? null;
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); } finally { if (alive.current) setBusy(false); }
  };
  if (mode.kind === 'new') {
    return (
      <PartyForm
        title="Someone else" initial={{ name: '', color: PARTY_COLORS[0] }} submitLabel="Add" busy={busy} onCancel={onCancel}
        onSubmit={(name, color) => void run(async () => { const id = await api.create(name, color); if (id) onDone({ added: id }); })}
      />
    );
  }
  if (!target) return null;
  if (mode.kind === 'edit') {
    return (
      <PartyForm
        title={`Change ${target.name}`} initial={{ name: target.name, color: target.color }} submitLabel="Save" busy={busy} onCancel={onCancel}
        onSubmit={(name, color) => void run(async () => { if (await api.edit(target.id, name, color)) onDone(); })}
      />
    );
  }
  return (
    <div style={{ fontFamily: CK.font }}>
      <p style={{ margin: '0 0 8px', fontSize: 13, color: CK.ink, overflowWrap: 'anywhere' }}>Remove {target.name}? Its land becomes nobody&apos;s.</p>
      <div className="flex" style={{ gap: 6 }}>
        <Btn size="sm" tone="danger" disabled={busy} onClick={() => void run(async () => { if (await api.remove(target.id)) onDone({ removed: target.id }); })}>Remove</Btn>
        <Btn size="sm" tone="ghost" disabled={busy} onClick={onCancel}>Keep</Btn>
      </div>
    </div>
  );
}

/** A dropdown of who can own something: each cabinet, each third party, Nobody and (with the map power) "Someone else...". */
export function OwnerMenu({ value, choices, ariaLabel, title, disabled, onChange, trigger, triggerStyle, triggerClassName, panelMinWidth = 250 }: {
  value: string | null; choices: PanelCabinet[]; ariaLabel: string; title?: string; disabled?: boolean; onChange: (id: string | null) => void;
  trigger: ReactNode; triggerStyle?: CSSProperties; triggerClassName?: string; panelMinWidth?: number;
}) {
  const api = useParty();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<PartyMode>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const cabinets = choices.filter((c) => !c.party);
  const parties = choices.filter((c) => c.party);

  const close = useCallback((refocus: boolean) => {
    setOpen(false); setMode(null);
    if (refocus) btn.current?.focus({ preventScroll: true });
  }, []);

  // The panel is placed by writing its style straight to the node (no state): under the button, or above it when there is no room.
  const place = useCallback(() => {
    const b = btn.current; const el = panel.current;
    if (!b || !el) return;
    const r = b.getBoundingClientRect();
    const vw = window.innerWidth; const vh = window.innerHeight;
    const width = Math.min(Math.max(r.width, panelMinWidth), vw - 16);
    const below = vh - r.bottom - 14; const above = r.top - 14;
    const up = below < 260 && above > below;
    el.style.width = `${width}px`;
    el.style.left = `${Math.min(Math.max(8, r.left), Math.max(8, vw - width - 8))}px`;
    el.style.maxHeight = `${Math.max(160, Math.min(460, up ? above : below))}px`;
    el.style.top = up ? '' : `${r.bottom + 6}px`;
    el.style.bottom = up ? `${vh - r.top + 6}px` : '';
  }, [panelMinWidth]);
  const panelMounted = useCallback((el: HTMLDivElement | null) => { panel.current = el; if (el) place(); }, [place]);

  useLayoutEffect(() => {
    if (!open) return;
    let raf = 0;
    const onMove = (e: Event) => {
      const t = e.target;
      if (t instanceof Node && panel.current?.contains(t)) return;
      cancelAnimationFrame(raf); raf = requestAnimationFrame(place);
    };
    const onDown = (e: Event) => {
      const t = e.target;
      if (!(t instanceof Node)) return;
      if (btn.current?.contains(t) || panel.current?.contains(t)) return;
      close(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); } };
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open, place, close]);
  // The panel grows when a form opens inside it.
  useLayoutEffect(() => { if (open) place(); }, [mode, open, place]);
  const shown = open && !disabled;

  const pick = (id: string | null) => { close(true); if (id !== value) onChange(id); };
  const row = (id: string | null, label: string, color: string, dashed = false) => {
    const on = id === value;
    return (
      <button
        type="button" role="option" aria-selected={on} onClick={() => pick(id)}
        className="focus:outline-none focus-visible:bg-[rgba(27,56,40,0.07)] hover:bg-[rgba(27,56,40,0.05)] flex items-center text-left"
        style={{ flex: 1, minWidth: 0, gap: 9, border: 0, background: 'transparent', padding: '8px 9px', borderRadius: 9, cursor: 'pointer', fontSize: 14, fontWeight: on ? 700 : 500, color: on ? CK.forest : CK.ink, fontFamily: CK.font }}
      >
        <Dot color={color} dashed={dashed} />
        <span style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{label}</span>
        {on && <Check size={15} strokeWidth={1.8} aria-hidden style={{ color: CK.forest, flex: 'none' }} />}
      </button>
    );
  };
  const divider = <div aria-hidden style={{ height: 1, background: CK.hair, margin: '4px 6px' }} />;

  return (
    <>
      <button
        ref={btn} type="button" aria-haspopup="listbox" aria-expanded={open} aria-label={ariaLabel} title={title} disabled={disabled}
        onClick={() => { if (open) close(false); else { setMode(null); setOpen(true); } }}
        className={`focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] ${triggerClassName ?? ''}`}
        style={triggerStyle}
      >
        {trigger}
      </button>
      {shown && (
        <Portal>
          <div
            ref={panelMounted} data-gsel-popover role="presentation"
            style={{
              position: 'fixed', zIndex: 10050, overflowY: 'auto',
              boxSizing: 'border-box', background: '#fff', borderRadius: 14, padding: 6, fontFamily: CK.font, color: CK.ink,
              boxShadow: '0 18px 44px rgba(27,56,40,0.18), 0 2px 8px rgba(27,56,40,0.08), 0 0 0 1px rgba(27,56,40,0.08)',
            }}
          >
            {mode ? (
              <div style={{ padding: 6 }}>
                {api && (
                  <PartyInline
                    mode={mode} parties={parties} api={api} onCancel={() => setMode(null)}
                    onDone={(r) => {
                      if (r?.added) { pick(r.added); return; }
                      if (r?.removed && r.removed === value) { pick(null); return; }
                      setMode(null);
                    }}
                  />
                )}
              </div>
            ) : (
              <div role="listbox" aria-label={ariaLabel}>
                {cabinets.map((c) => <div key={c.id} className="flex items-center">{row(c.id, c.name, c.color)}</div>)}
                {parties.length > 0 && divider}
                {parties.map((p) => (
                  <div key={p.id} className="flex items-center">
                    {row(p.id, p.name, p.color)}
                    {api && (
                      <>
                        <button type="button" aria-label={`Change ${p.name}`} title="Rename or recolour" onClick={() => setMode({ kind: 'edit', id: p.id })} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]" style={smallIcon}>
                          <Pencil size={14} strokeWidth={1.5} aria-hidden />
                        </button>
                        <button type="button" aria-label={`Remove ${p.name}`} title="Remove" onClick={() => setMode({ kind: 'remove', id: p.id })} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]" style={smallIcon}>
                          <Trash2 size={14} strokeWidth={1.5} aria-hidden />
                        </button>
                      </>
                    )}
                  </div>
                ))}
                {divider}
                <div className="flex items-center">{row(null, 'Nobody', CK.inkSoft, true)}</div>
                {api && (
                  <button
                    type="button" onClick={() => setMode({ kind: 'new' })}
                    className="focus:outline-none focus-visible:bg-[rgba(27,56,40,0.07)] hover:bg-[rgba(27,56,40,0.05)] flex items-center text-left w-full"
                    style={{ gap: 9, border: 0, background: 'transparent', padding: '8px 9px', borderRadius: 9, cursor: 'pointer', fontSize: 14, fontWeight: 600, color: CK.forest, fontFamily: CK.font }}
                  >
                    <Plus size={14} strokeWidth={1.5} aria-hidden style={{ flex: 'none' }} />
                    <span>Someone else…</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </Portal>
      )}
    </>
  );
}
