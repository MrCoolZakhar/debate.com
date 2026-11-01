'use client';
// Gavelling Crisis map: the toolbar. One row of fixed buttons, each an icon with a word and its key: Select (V), Give land (G),
// Paint (B), Erase (E), Draw area (D), Zones (Z), Units (U). Next to them the owner chip ("Painting as ExComm"), the one
// place a cabinet is picked for Give land, Paint, Draw area and zone control; the brush size when a brush is in hand;
// and Undo and Redo, big and always there. One hint line says what the tool in hand does. The map's show-and-hide
// switches (fog, sight ranges, characters, cities, zones, water, regions) are tucked behind "Show on the map" so the
// main row stays plain. Single-key shortcuts work when no text field has the focus.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, Eraser, Flag, Hexagon, Maximize2, MousePointer2, Paintbrush, Pencil, Redo2, Shield, SlidersHorizontal, Undo2 } from 'lucide-react';
import GSelect from '@/components/GSelect';
import { CK } from '../../crisisKit';
import { BRUSH_MAX_KM, BRUSH_MIN_KM, kmFromSlider, sliderFromKm } from './brush';
import type { PanelCabinet } from './MapPanels';
import { kmText } from './sight';
import { safeColor } from './tokens';

export type Tool = 'select' | 'give' | 'paint' | 'erase' | 'draw' | 'zones' | 'unit';

const TOOLS: Array<{ tool: Tool; label: string; key: string; Icon: typeof Flag; title: string }> = [
  { tool: 'select', label: 'Select', key: 'V', Icon: MousePointer2, title: 'Select a unit, a country, a territory or a zone' },
  { tool: 'give', label: 'Give land', key: 'G', Icon: Flag, title: 'Click a country, province, territory or zone to give it to the cabinet in the chip' },
  { tool: 'paint', label: 'Paint', key: 'B', Icon: Paintbrush, title: 'Paint land for the cabinet in the chip with a round brush' },
  { tool: 'erase', label: 'Erase', key: 'E', Icon: Eraser, title: 'Erase drawn land with a round brush' },
  { tool: 'draw', label: 'Draw area', key: 'D', Icon: Pencil, title: 'Draw a new territory by dragging, or by clicking points' },
  { tool: 'zones', label: 'Zones', key: 'Z', Icon: Hexagon, title: 'Draw and reshape zones: blockade lines, no-fly zones and other areas that are not territory' },
  { tool: 'unit', label: 'Units', key: 'U', Icon: Shield, title: 'Add a unit to the map' },
];

const KEY_TOOL: Record<string, Tool> = { v: 'select', g: 'give', b: 'paint', e: 'erase', d: 'draw', z: 'zones', u: 'unit' };

/** Which cabinet word goes in front of the chip's name for each tool. */
const VERB: Record<Tool, string> = {
  select: 'Cabinet', give: 'Giving land to', paint: 'Painting as', erase: 'Cabinet', draw: 'Drawing for', zones: 'Cabinet', unit: 'Cabinet',
};

export interface MapToolbarProps {
  tool: Tool;
  onTool: (t: Tool) => void;
  /** The tools this person may use besides Select. */
  allowed: Partial<Record<Tool, boolean>>;
  cabinets: PanelCabinet[];
  /** The cabinet in the chip; null is Nobody. */
  owner: string | null;
  onOwner: (id: string | null) => void;
  brushKm: number;
  onBrushKm: (km: number) => void;
  /** Undo and Redo are shown (people who can change the map). */
  history: boolean;
  canUndo: boolean;
  canRedo: boolean;
  busy: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onFit: () => void;
  /** The map's show-and-hide switches, drawn behind "Show on the map". */
  viewTools: ReactNode;
  /** True when this person can change the map (otherwise the hint is the viewer's). */
  editable: boolean;
  /** The provinces layer is ready (Give land can hand one over). */
  provincesReady: boolean;
  /** Something is open that should take the keys (a pop-up over the map is handled here; this is for the map's own forms). */
  keysOff?: boolean;
}

export const TOOLBAR_CSS = `
.wm-tb-wrap{display:flex;flex-direction:column;gap:8px;margin-bottom:8px;min-width:0}
.wm-tb-row{display:flex;flex-wrap:wrap;align-items:stretch;gap:8px 12px}
.wm-tb-group{display:flex;flex-wrap:wrap;gap:3px;padding:4px;border-radius:16px;background:rgba(255,255,255,0.78);box-shadow:inset 0 1px 0 rgba(255,255,255,0.6),0 0 0 1px rgba(27,56,40,0.07),0 2px 6px rgba(27,56,40,0.08)}
.wm-tb{position:relative;display:inline-flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;min-width:68px;padding:7px 9px 6px;border:0;border-radius:12px;background:transparent;color:#4E463C;font:700 12px/1.15 var(--font-brand),Inter,system-ui,sans-serif;cursor:pointer;transition:background-color 120ms ease-out,color 120ms ease-out,transform 120ms ease-out}
.wm-tb:hover:not(:disabled){background:rgba(142,36,36,0.06);color:#1C1410}
.wm-tb:active:not(:disabled){transform:scale(0.97)}
.wm-tb[aria-pressed="true"]{background:#1B3828;color:#EED98A}
.wm-tb:disabled{opacity:.45;cursor:not-allowed}
.wm-tb:focus{outline:none}
.wm-tb:focus-visible{outline:2px solid #1B3828;outline-offset:2px}
.wm-tb-name{text-align:center;overflow-wrap:anywhere}
.wm-tb-key{position:absolute;top:3px;right:4px;font:700 9px/1 var(--font-brand),Inter,sans-serif;opacity:.6;border:1px solid currentColor;border-radius:4px;padding:1.5px 3px}
.wm-tb-ur{min-width:74px;background:#fff;color:#1B3828;box-shadow:inset 0 1px 0 rgba(255,255,255,0.6),0 0 0 1px rgba(27,56,40,0.12),0 2px 6px rgba(27,56,40,0.1);padding-top:8px;padding-bottom:7px}
.wm-tb-ur:hover:not(:disabled){background:#F6F0E6;color:#1B3828}
.wm-tb-view{flex-direction:row;gap:6px;min-width:0;padding:8px 11px}
.wm-tb-view svg:last-child{transition:transform 150ms ease-out}
.wm-tb-view[aria-expanded="true"] svg:last-child{transform:rotate(180deg)}
.wm-chip{display:inline-flex;align-items:center;gap:8px;max-width:100%;padding:6px 10px 6px 8px;border-radius:14px;background:#fff;font:700 13px/1.2 var(--font-brand),Inter,system-ui,sans-serif;color:#1C1410;border:2px solid;cursor:pointer;text-align:left}
.wm-chip small{display:block;font-size:10.5px;font-weight:700;color:#6B6256;line-height:1.1}
.wm-chip-name{display:block;overflow-wrap:anywhere}
.wm-chip-dot{width:18px;height:18px;border-radius:50%;flex:none;box-sizing:border-box}
.wm-tb-brush{display:inline-flex;align-items:center;gap:10px;padding:6px 12px;border-radius:14px;background:rgba(255,255,255,0.78);box-shadow:inset 0 1px 0 rgba(255,255,255,0.6),0 0 0 1px rgba(27,56,40,0.07);font:700 12.5px/1.2 var(--font-brand),Inter,system-ui,sans-serif;color:#4E463C}
.wm-tb-brush input[type=range]{width:150px;accent-color:#1B3828;cursor:pointer}
.wm-tb-brush b{min-width:66px;font-variant-numeric:tabular-nums;color:#1C1410}
.wm-tb-views{display:flex;flex-wrap:wrap;gap:4px;padding:4px 6px;border-radius:14px;background:rgba(255,255,255,0.6)}
.wm-tb-hint{margin:0;font-size:12.5px;line-height:1.4;color:#4E463C}
@media (prefers-reduced-motion:reduce){.wm-tb,.wm-tb-view svg:last-child{transition:none}.wm-tb:active:not(:disabled){transform:none}}
`;

function hintFor(p: MapToolbarProps, ownerName: string): string {
  if (!p.editable) return 'Click a unit, a country or a territory to see it.';
  switch (p.tool) {
    case 'give':
      return p.owner
        ? `Click a country, ${p.provincesReady ? 'a state or province, ' : ''}a territory or a zone to give it to ${ownerName}. Click land ${ownerName} already holds to give it back to nobody. Hold Alt to click through a zone${p.provincesReady ? ' or a province' : ''}.`
        : 'Click a country, a territory or a zone to take it away from whoever holds it, because Nobody is picked. Pick a cabinet in the chip to give land.';
    case 'paint':
      return p.owner
        ? `Press and drag to paint land for ${ownerName}. Land of another cabinet under the brush is taken from it. [ and ] change the brush size; hold Shift and drag to move the map.`
        : 'Pick a cabinet in the chip to paint with. To take land away, use Erase.';
    case 'erase':
      return 'Press and drag to erase drawn and painted land, whoever holds it. Whole countries stay as they are: use Give land for those. [ and ] change the brush size.';
    case 'draw':
      return `Press and drag to draw an outline: it stays open while you draw and letting go closes it. Or click points one by one. The land is ${p.owner ? `${ownerName}'s` : 'nobody\'s'} unless you change it before saving.`;
    case 'zones':
      return 'Click a zone to edit it: its details, its corners, or the Move handle to carry all of it. Or press Draw a new zone, then press and drag to draw it freehand. A zone never changes who holds the land.';
    case 'unit':
      return 'Choose a kind of unit, then click the map where it should go.';
    default:
      return 'Click a unit, a country, a territory or a zone to see it. Drag a unit to move it.';
  }
}

export default function MapToolbar(p: MapToolbarProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const [viewOpen, setViewOpen] = useState(!p.editable);
  const owner = p.owner ? p.cabinets.find((c) => c.id === p.owner) ?? null : null;
  const ownerName = owner ? owner.short : 'Nobody';
  const ownerColor = owner ? safeColor(owner.color) : '#6B6256';
  const live = useRef(p);
  useEffect(() => { live.current = p; });

  const usable = (t: Tool): boolean => t === 'select' || !!p.allowed[t];
  const showChip = !!(p.allowed.give || p.allowed.paint || p.allowed.draw);
  const brush = p.tool === 'paint' || p.tool === 'erase';

  // Single keys pick a tool when no text field has the focus; Cmd or Ctrl with Z undoes, with Shift redoes; [ and ] size the brush.
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const s = live.current;
      if (ev.defaultPrevented || s.keysOff) return;
      const t = ev.target as HTMLElement | null;
      if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable || t.closest('[role="combobox"],[role="listbox"],[data-gsel-popover]'))) return;
      const root = wrap.current;
      if (!root || !root.isConnected || root.offsetParent === null) return;
      // A pop-up over the map takes the keys, unless the map is inside that pop-up.
      const modal = document.querySelector('[aria-modal="true"]');
      if (modal && !modal.contains(root)) return;
      const k = ev.key.toLowerCase();
      if ((ev.metaKey || ev.ctrlKey) && !ev.altKey) {
        if (k === 'z' && !ev.shiftKey) { if (s.canUndo && !s.busy) { ev.preventDefault(); s.onUndo(); } return; }
        if ((k === 'z' && ev.shiftKey) || k === 'y') { if (s.canRedo && !s.busy) { ev.preventDefault(); s.onRedo(); } return; }
        return;
      }
      if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
      if ((k === '[' || k === ']') && (s.tool === 'paint' || s.tool === 'erase')) {
        ev.preventDefault();
        s.onBrushKm(kmFromSlider(Math.max(0, Math.min(100, sliderFromKm(s.brushKm) + (k === ']' ? 4 : -4)))));
        return;
      }
      const tool = KEY_TOOL[k];
      if (!tool || tool === s.tool) return;
      if (tool !== 'select' && !s.allowed[tool]) return;
      ev.preventDefault();
      s.onTool(tool);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const options = [
    ...p.cabinets.map((c) => ({
      value: c.id, label: c.name,
      icon: <i className="wm-chip-dot" aria-hidden style={{ background: safeColor(c.color) }} />,
    })),
    { value: '', label: 'Nobody', icon: <i className="wm-chip-dot" aria-hidden style={{ border: `2px dashed ${CK.inkSoft}` }} /> },
  ];

  return (
    <div ref={wrap} className="wm-tb-wrap">
      <div className="wm-tb-row">
        <div className="wm-tb-group" role="group" aria-label="Map tools">
          {TOOLS.filter((t) => usable(t.tool)).map(({ tool, label, key, Icon, title }) => (
            <button
              key={tool} type="button" className="wm-tb" aria-pressed={p.tool === tool} title={`${title} (${key})`}
              onClick={() => { if (p.tool !== tool) p.onTool(tool); }}
            >
              <Icon size={20} strokeWidth={1.5} aria-hidden />
              <span className="wm-tb-name">{label}</span>
              <kbd className="wm-tb-key" aria-hidden>{key}</kbd>
            </button>
          ))}
        </div>

        {showChip && (
          <GSelect
            bare value={p.owner ?? ''} options={options} onChange={(v) => p.onOwner(v || null)} panelMinWidth={230}
            aria-label={`${VERB[p.tool]} ${ownerName}. Choose another cabinet`}
            title="The cabinet that Give land, Paint, Draw area and zone control work for"
            triggerContent={(
              <span className="wm-chip" style={{ borderColor: ownerColor, background: owner ? `${ownerColor}14` : '#fff' }}>
                <i className="wm-chip-dot" aria-hidden style={owner ? { background: ownerColor } : { border: `2px dashed ${CK.inkSoft}` }} />
                <span>
                  <small>{VERB[p.tool]}</small>
                  <span className="wm-chip-name">{ownerName}</span>
                </span>
                <ChevronDown size={15} strokeWidth={1.5} aria-hidden />
              </span>
            )}
          />
        )}

        {brush && (
          <label className="wm-tb-brush">
            <span>Brush size</span>
            <input
              type="range" min={0} max={100} step={1} value={sliderFromKm(p.brushKm)} aria-label="Brush size"
              aria-valuemin={BRUSH_MIN_KM} aria-valuemax={BRUSH_MAX_KM} aria-valuetext={kmText(p.brushKm)}
              onChange={(e) => p.onBrushKm(kmFromSlider(Number(e.target.value)))}
            />
            <b>{kmText(p.brushKm)}</b>
          </label>
        )}

        {p.history && (
        <div className="wm-tb-group" role="group" aria-label="Undo and redo" style={{ marginLeft: 'auto' }}>
          <button type="button" className="wm-tb wm-tb-ur" disabled={!p.canUndo || p.busy} onClick={p.onUndo} title={p.canUndo ? 'Undo the last thing you did (Ctrl or Cmd with Z). Press again to go back further.' : 'Nothing to undo yet'}>
            <Undo2 size={20} strokeWidth={1.5} aria-hidden /><span className="wm-tb-name">Undo</span>
          </button>
          <button type="button" className="wm-tb wm-tb-ur" disabled={!p.canRedo || p.busy} onClick={p.onRedo} title={p.canRedo ? 'Do again what you just undid (Shift with Ctrl or Cmd with Z)' : 'Nothing to redo'}>
            <Redo2 size={20} strokeWidth={1.5} aria-hidden /><span className="wm-tb-name">Redo</span>
          </button>
        </div>
        )}

        <div className="wm-tb-group" role="group" aria-label="View" style={p.history ? undefined : { marginLeft: 'auto' }}>
          <button type="button" className="wm-tb wm-tb-view" aria-expanded={viewOpen} onClick={() => setViewOpen((v) => !v)} title="Show or hide fog, sight ranges, characters, cities, zones, water and regions">
            <SlidersHorizontal size={17} strokeWidth={1.5} aria-hidden /><span className="wm-tb-name">Show on the map</span><ChevronDown size={15} strokeWidth={1.5} aria-hidden />
          </button>
          <button type="button" className="wm-tb wm-tb-view" onClick={p.onFit} title="Zoom to fit all the units on screen">
            <Maximize2 size={17} strokeWidth={1.5} aria-hidden /><span className="wm-tb-name">Fit view</span>
          </button>
        </div>
      </div>

      {viewOpen && <div className="wm-tb-views" role="group" aria-label="Show on the map">{p.viewTools}</div>}

      <p className="wm-tb-hint" role="status">{hintFor(p, ownerName)}</p>
    </div>
  );
}
