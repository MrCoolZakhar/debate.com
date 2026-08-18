'use client';

import { useState, useEffect, useRef } from 'react';
import Portal from '@/components/Portal';
import { portalFrame } from '@/components/chat/chatTokens';
import { Globe } from 'lucide-react';
import { useSettingsStore, CommitteeSettings, MotionNames, DEFAULT_SCORING, DEFAULT_MOTION_NAMES, DEFAULT_DOCUMENT_NAMES, type DocumentNames, type ScoringConfig, type ScoreSource, type RankingFactor } from '@/lib/settingsStore';
import { Committee } from '@/lib/types';
import { updateCommitteeChairSuffixInDB, saveCommitteeSettings, updateCommitteeScoringInDB } from '@/lib/committeeService';
import { useT, useLanguage } from '@/contexts/LanguageContext';
import { getCountryByName, getCountryDisplayName, getFlagUrl } from '@/lib/countries';
import { localizedMotionDefaults } from '@/lib/committeeFlags';

type SettingsTab = 'voting' | 'motions' | 'access' | 'points';

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-black tracking-wider uppercase mb-1 mt-5 first:mt-0" style={{ color: '#1B3828', letterSpacing: '0.08em' }}>{children}</p>;
}

function CodeCopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="w-full flex items-center justify-center gap-2 rounded-xl py-3 font-mono text-xl tracking-widest font-black transition-all focus:outline-none"
      style={{ backgroundColor: '#1B3828', color: '#EED98A', letterSpacing: '0.12em' }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
    >
      {copied
        ? <><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg> Copied</>
        : <>{code} <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.6"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></>
      }
    </button>
  );
}

function ChairPasswordDisplay({ password }: { password: string }) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  return (
    <button
      onClick={() => { navigator.clipboard.writeText(password); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      onMouseEnter={() => setRevealed(true)}
      onMouseLeave={() => { setRevealed(false); }}
      className="w-full flex items-center justify-between rounded-xl px-4 py-2.5 font-mono text-sm font-bold tracking-widest transition-all focus:outline-none group"
      style={{ backgroundColor: '#EDE7D8', border: '1px solid #DDD4C0', color: '#1B3828' }}
    >
      <span style={{ letterSpacing: revealed ? '0.12em' : '0.05em', filter: revealed ? 'none' : 'blur(4px)', transition: 'filter 0.2s ease', userSelect: revealed ? 'text' : 'none' }}>
        {password}
      </span>
      {copied
        ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3D7A52" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" opacity={revealed ? 1 : 0.4}><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
      }
    </button>
  );
}

// Informational hover explainer. Opens on hover AND on keyboard focus, closes on
// a short delay so the pointer can travel into the panel. The panel itself is
// rendered through <Portal> at fixed viewport coordinates computed from the
// trigger rect, so a scrollable settings body or a rounded card with
// overflow:hidden can never clip it, and it flips above / clamps horizontally
// near the viewport edges.
function HoverHint({ text, children }: { text: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; flipUp: boolean } | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const WIDTH = 236;

  // Portal mounts into `#fit-root`, which FitToScreen transforms — a transformed ancestor is
  // the containing block for `position: fixed`, so the layer lives in that element's local
  // units. portalFrame() converts the trigger box AND the usable bounds into that same space;
  // mixing a converted anchor with raw window.inner* would flip against the wrong edges.
  const place = () => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const f = portalFrame();
    const M = 8;
    const top0 = f.toLocalY(r.top);
    const bottom0 = f.toLocalY(r.bottom);
    const left0 = f.toLocalX(r.left);
    const right0 = f.toLocalX(r.right);
    const maxLeft = Math.max(f.minX + M, f.maxX - WIDTH - M);
    const left = Math.min(Math.max(f.minX + M, left0 + (right0 - left0) / 2 - WIDTH / 2), maxLeft);
    const spaceBelow = f.maxY - bottom0;
    const spaceAbove = top0 - f.minY;
    const flipUp = spaceBelow < 130 && spaceAbove > spaceBelow;
    setPos({ top: flipUp ? top0 - 8 : bottom0 + 8, left, flipUp });
  };

  const show = () => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
    place();
    setOpen(true);
  };
  const hide = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 140);
  };

  useEffect(() => {
    if (!open) return;
    const onMove = () => place();
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    return () => {
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
    };
  }, [open]);

  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);

  return (
    <>
      <span
        ref={triggerRef}
        tabIndex={0}
        role="note"
        aria-label={text}
        className="inline-flex items-center gap-1.5 focus:outline-none"
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
      >
        {children}
        <span
          aria-hidden
          className="inline-flex items-center justify-center w-[13px] h-[13px] rounded-full text-[9px] font-black shrink-0"
          style={{ border: '1px solid #C5B9A8', color: '#9A8A78', lineHeight: 1 }}
        >i</span>
      </span>
      {open && pos && (
        <Portal>
          <div
            role="tooltip"
            onMouseEnter={show}
            onMouseLeave={hide}
            className="fixed z-[80] rounded-xl px-3 py-2 text-[11px] leading-snug shadow-xl"
            style={{
              top: pos.top, left: pos.left, width: WIDTH,
              transform: pos.flipUp ? 'translateY(-100%)' : undefined,
              backgroundColor: '#1B3828', color: '#EED98A',
              border: '1px solid rgba(238,217,138,0.22)',
            }}
          >
            {text}
          </div>
        </Portal>
      )}
    </>
  );
}

function RenameRow({ label, defaultName, value, onChange, resetValue }: {
  label?: string; defaultName: string; value: string; onChange: (v: string) => void; resetValue?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  // `defaultName` is the localized label shown when no custom name is set.
  // `baseValue` is the canonical value written back to the store (always English)
  // so localized display text never gets persisted and leak into other locales.
  const baseValue = resetValue ?? defaultName;
  const isCustom = value !== baseValue && value !== defaultName;

  const startEdit = () => {
    setDraft(isCustom ? value : '');
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };
  const commit = () => {
    const trimmed = draft.trim();
    onChange(trimmed || baseValue);
    setEditing(false);
  };

  return (
    <div className="flex items-center justify-between gap-4 py-3 group" style={{ borderBottom: '1px solid #DDD4C0' }}>
      <div className="flex-1 min-w-0">
        {label && <div className="text-xs mb-0.5" style={{ color: '#9A8A78' }}>{label}</div>}
        {editing ? (
          <input
            ref={inputRef}
            type="text"
            value={draft}
            placeholder={defaultName}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setEditing(false); } }}
            className="w-full text-sm font-semibold focus:outline-none bg-transparent border-b"
            style={{ color: '#1C1410', borderColor: '#1B3828', borderBottomWidth: '1.5px', paddingBottom: '1px' }}
          />
        ) : (
          <button
            onClick={startEdit}
            className="text-sm font-semibold text-start w-full truncate flex items-center gap-1.5"
            style={{ color: '#1C1410' }}
          >
            <span>{isCustom ? value : defaultName}</span>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#9A8A78" strokeWidth="2.5" className="opacity-0 group-hover:opacity-100 shrink-0 transition-opacity"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
        )}
      </div>
      {isCustom && !editing && (
        <button
          onClick={() => onChange(baseValue)}
          className="text-[10px] font-mono shrink-0 px-1.5 py-0.5 rounded transition-colors"
          style={{ color: '#9A8A78', border: '1px solid #DDD4C0' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#8B2020'; (e.currentTarget as HTMLElement).style.borderColor = '#8B2020'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#9A8A78'; (e.currentTarget as HTMLElement).style.borderColor = '#DDD4C0'; }}
          title="Reset to default"
        >reset</button>
      )}
    </div>
  );
}

// ── Motion order drag-and-rename tab ──────────────────────────────────────────
type OrderableType = 'moderated' | 'unmoderated' | 'consultation' | 'tour';

// Note: disruptiveness ordering is NOT stored here, it is purely the position
// in `motionOrder` (top = most disruptive). The pip bar below renders from `4 - i`.
const MOTION_META: Record<OrderableType, {
  enabledKey: keyof CommitteeSettings;
  namesKey: keyof MotionNames;
  defaultName: string;
}> = {
  moderated:    { enabledKey: 'motionModeratedCaucus',   namesKey: 'moderated',    defaultName: 'Moderated Caucus' },
  unmoderated:  { enabledKey: 'motionUnmoderatedCaucus', namesKey: 'unmoderated',  defaultName: 'Unmoderated Caucus' },
  consultation: { enabledKey: 'motionCoW',               namesKey: 'consultation', defaultName: 'Consultation of the Whole' },
  tour:         { enabledKey: 'motionTourDeTable',       namesKey: 'tour',         defaultName: 'Tour de Table' },
};

// Localized display names for the default (un-renamed) motions come from the one
// shared table in lib/committeeFlags — the same one the delegate and advisor
// pages resolve against, so a default never reads differently on the dais than
// on the floor. The English values stay the canonical STORE values (see
// MOTION_META.defaultName); only the display default is localized.

// Accepting a Custom motion is a deliberate no-op on the floor, so it has no
// `motionOrder` position and is permanently the least disruptive motion there is
// (MotionsModal.tsx:1058 hard-codes its disruptiveness to 0). That is why the row
// below sits OUTSIDE the draggable list and renders its pips all-inactive.
// The P5 is a real-world constant, not a per-committee preference: it is exactly
// the five permanent members of the Security Council. Making the list editable
// would produce a second, redundant custom-veto path with a misleading name — and
// the voting screen resolves veto holders by country identity against this
// canonical set. So the list stays fixed and the panel instead answers the
// question a non-UNSC chair actually has: does this apply to my committee, and
// what do I use instead?
const P5_FIXED_HINT =
  'The P5 are the five permanent members of the UN Security Council, so this list is fixed and cannot be edited. To give veto power to any other delegation, choose Custom veto members instead.';

const CUSTOM_MOTION_HINT =
  'Custom motions have no disruptiveness ranking. Accepting one changes nothing about the session, so it always sits last on the floor and cannot be reordered.';

function MotionsTab({ s, upd }: {
  s: CommitteeSettings;
  upd: <K extends keyof CommitteeSettings>(key: K, value: CommitteeSettings[K]) => void;
}) {
  const t = useT();
  const { language } = useLanguage();
  const localizedDefaults = localizedMotionDefaults(language);
  const locName = (k: string, en: string) => localizedDefaults[k as keyof MotionNames] ?? en;
  const order: OrderableType[] = (s.motionOrder ?? ['consultation', 'tour', 'unmoderated', 'moderated']) as OrderableType[];
  const docNames: DocumentNames = { ...DEFAULT_DOCUMENT_NAMES, ...(s.documentNames ?? {}) };
  const dragItem = useRef<number | null>(null);
  const dragOver = useRef<number | null>(null);
  const [dragActive, setDragActive] = useState<number | null>(null);

  function handleDragStart(i: number) { dragItem.current = i; setDragActive(i); }
  function handleDragEnter(i: number) { dragOver.current = i; }
  function handleDragEnd() {
    setDragActive(null);
    if (dragItem.current === null || dragOver.current === null || dragItem.current === dragOver.current) return;
    const newOrder = [...order];
    const [moved] = newOrder.splice(dragItem.current, 1);
    newOrder.splice(dragOver.current, 0, moved);
    upd('motionOrder', newOrder);
    dragItem.current = null;
    dragOver.current = null;
  }

  return (
    <div>
      <SectionLabel>{t('settings_motion_types_heading')}</SectionLabel>
      <p className="text-xs mb-3 leading-snug" style={{ color: '#9A8A78' }}>
        {t('settings_motion_types_desc')}
      </p>
      <div className="space-y-1">
        {order.map((motionType, i) => {
          const meta = MOTION_META[motionType];
          const enabled = s[meta.enabledKey] !== false;
          const currentName = s.motionNames[meta.namesKey] ?? meta.defaultName;
          const localizedDefault = locName(meta.namesKey, meta.defaultName);
          const isDragging = dragActive === i;
          return (
            <div
              key={motionType}
              draggable
              onDragStart={() => handleDragStart(i)}
              onDragEnter={() => handleDragEnter(i)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => e.preventDefault()}
              className="flex items-center gap-2 px-2 rounded-xl transition-all select-none"
              style={{
                border: '1px solid #DDD4C0',
                backgroundColor: isDragging ? '#EDE7D8' : '#FAF8F3',
                opacity: isDragging ? 0.5 : 1,
                cursor: 'grab',
              }}
            >
              {/* Drag handle */}
              <div className="shrink-0 flex flex-col gap-[3px] px-1 py-2">
                {[0,1,2].map(r => (
                  <div key={r} className="flex gap-[3px]">
                    {[0,1].map(c => <div key={c} className="w-[3px] h-[3px] rounded-full" style={{ backgroundColor: '#C5B9A8' }} />)}
                  </div>
                ))}
              </div>
              {/* Name (click to rename inline), flex-1 */}
              <div className="flex-1 min-w-0">
                <RenameRow
                  defaultName={localizedDefault}
                  resetValue={meta.defaultName}
                  value={currentName}
                  onChange={(v) => upd('motionNames', { ...s.motionNames, [meta.namesKey]: v })}
                />
              </div>
              {/* Disruptiveness pip bar, live: top position = 4 pips, bottom = 1 */}
              <div className="shrink-0 flex gap-[2px] items-center" title={`Disruptiveness: ${4 - i}/4`}>
                {[1,2,3,4].map((level) => (
                  <div key={level} className="w-[4px] h-[10px] rounded-sm"
                    style={{ backgroundColor: level <= (4 - i) ? '#B6871F' : '#DDD4C0' }} />
                ))}
              </div>
              {/* Enable/disable toggle */}
              <button
                onClick={() => upd(meta.enabledKey as keyof CommitteeSettings, (!enabled) as CommitteeSettings[typeof meta.enabledKey])}
                className="relative shrink-0 w-8 h-[18px] rounded-full transition-colors focus:outline-none"
                style={{ backgroundColor: enabled ? '#1B3828' : '#DDD4C0' }}
              >
                <span className={`absolute top-[2px] left-[2px] w-[14px] h-[14px] rounded-full bg-white transition-transform shadow-sm ${enabled ? 'translate-x-[14px]' : 'translate-x-0'}`} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Custom motion. Sits outside the draggable list on purpose: it has no
          motionOrder position, so it can never be dragged into the ranking. */}
      <div className="space-y-1 mt-1 mb-4">
        <div className="flex items-center gap-2 px-2 rounded-xl"
          style={{ border: '1px solid #DDD4C0', backgroundColor: '#FAF8F3' }}>
          {/* Invisible grip placeholder keeps the row aligned with the draggable ones */}
          <div className="shrink-0 flex flex-col gap-[3px] px-1 py-2 opacity-0 pointer-events-none">
            {[0,1,2].map(r => (
              <div key={r} className="flex gap-[3px]">
                {[0,1].map(c => <div key={c} className="w-[3px] h-[3px] rounded-full bg-transparent" />)}
              </div>
            ))}
          </div>
          <div className="flex-1 min-w-0">
            <RenameRow
              defaultName={locName('custom', DEFAULT_MOTION_NAMES.custom)}
              resetValue={DEFAULT_MOTION_NAMES.custom}
              value={s.motionNames.custom ?? DEFAULT_MOTION_NAMES.custom}
              onChange={(v) => upd('motionNames', { ...s.motionNames, custom: v })}
            />
          </div>
          {/* All pips inactive: no disruptiveness ranking at all */}
          <HoverHint text={CUSTOM_MOTION_HINT}>
            <span className="flex gap-[2px] items-center">
              {[1,2,3,4].map((level) => (
                <span key={level} className="w-[4px] h-[10px] rounded-sm block" style={{ backgroundColor: '#DDD4C0' }} />
              ))}
            </span>
          </HoverHint>
          <button
            onClick={() => upd('motionCustom', !(s.motionCustom !== false))}
            className="relative shrink-0 w-8 h-[18px] rounded-full transition-colors focus:outline-none"
            style={{ backgroundColor: s.motionCustom !== false ? '#1B3828' : '#DDD4C0' }}
          >
            <span className={`absolute top-[2px] left-[2px] w-[14px] h-[14px] rounded-full bg-white transition-transform shadow-sm ${s.motionCustom !== false ? 'translate-x-[14px]' : 'translate-x-0'}`} />
          </button>
        </div>
      </div>

      {s.motionCoW !== false && (
        <>
          <Toggle
            label={t('settings_cow_timer_label')}
            note={t('settings_cow_timer_note')}
            value={s.cowTimerEnabled === true}
            onChange={(v) => upd('cowTimerEnabled', v)}
          />
          {/* The duration the CoW timer starts at. Without this control
              cowTimerSeconds was pinned at its 60s default forever — the chair
              page reads it (`cowSettings.cowTimerSeconds || 60`) but nothing
              wrote it. Presets cover the common cases; the field takes anything. */}
          {s.cowTimerEnabled === true && (
            <div className="flex items-start justify-between gap-4 py-3" style={{ borderBottom: '1px solid #DDD4C0' }}>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold" style={{ color: '#1C1410' }}>Timer duration</div>
                <div className="text-xs mt-0.5 leading-snug" style={{ color: '#9A8A78' }}>
                  How long the Consultation timer starts at. Chairs can still adjust it live.
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {[30, 45, 60, 90, 120].map((secs) => {
                    const active = (s.cowTimerSeconds || 60) === secs;
                    return (
                      <button
                        key={secs}
                        onClick={() => upd('cowTimerSeconds', secs)}
                        className="px-2 py-1 rounded-lg text-[11px] font-bold transition-colors focus:outline-none"
                        style={{
                          backgroundColor: active ? '#1B3828' : '#FAF8F3',
                          border: `1px solid ${active ? '#1B3828' : '#DDD4C0'}`,
                          color: active ? '#EED98A' : '#6A5A4A',
                        }}
                      >
                        {secs < 60 ? `${secs}s` : secs % 60 === 0 ? `${secs / 60}m` : `${Math.floor(secs / 60)}m ${secs % 60}s`}
                      </button>
                    );
                  })}
                </div>
              </div>
              <NumberField
                value={s.cowTimerSeconds || 60}
                min={5}
                max={3600}
                suffix="sec"
                onCommit={(v) => upd('cowTimerSeconds', v ?? 60)}
              />
            </div>
          )}
        </>
      )}

      {/* Suspend/End debate, always at bottom, always enabled, rename only */}
      <SectionLabel>{t('settings_procedural_motions_heading')}</SectionLabel>
      <p className="text-xs mb-2 leading-snug" style={{ color: '#9A8A78' }}>{t('settings_procedural_motions_desc')}</p>
      <div className="space-y-1">
        {([
          { key: 'suspendDebate' as keyof MotionNames, defaultName: 'Suspend Debate' },
          { key: 'endDebate' as keyof MotionNames, defaultName: 'End Debate' },
        ]).map(({ key, defaultName }) => (
          <div key={key} className="flex items-center gap-2 px-2 rounded-xl"
            style={{ border: '1px solid #DDD4C0', backgroundColor: '#FAF8F3' }}>
            {/* Invisible grip placeholder for alignment */}
            <div className="shrink-0 flex flex-col gap-[3px] px-1 py-2 opacity-0 pointer-events-none">
              {[0,1,2].map(r => (
                <div key={r} className="flex gap-[3px]">
                  {[0,1].map(c => <div key={c} className="w-[3px] h-[3px] rounded-full bg-transparent" />)}
                </div>
              ))}
            </div>
            <div className="flex-1 min-w-0">
              <RenameRow
                defaultName={locName(key, defaultName)}
                resetValue={defaultName}
                value={s.motionNames[key] ?? defaultName}
                onChange={(v) => upd('motionNames', { ...s.motionNames, [key]: v })}
              />
            </div>
            {/* All 4 pips filled in red, max disruptiveness */}
            <div className="shrink-0 flex gap-[2px] items-center" title="High disruptiveness">
              {[1,2,3,4].map((level) => (
                <div key={level} className="w-[4px] h-[10px] rounded-sm" style={{ backgroundColor: '#8B2020' }} />
              ))}
            </div>
            {/* No toggle, always on, spacer for alignment */}
            <div className="w-8 shrink-0" />
          </div>
        ))}
      </div>

      <SectionLabel>{t('settings_documents_heading')}</SectionLabel>
      <Toggle
        label={t('settings_require_doc_approval')}
        note={t('settings_require_doc_approval_note')}
        value={s.requireDocApproval}
        onChange={(v) => upd('requireDocApproval', v)}
      />

      {/* Rename the two document types for this committee. Same storage shape and
          same RenameRow treatment as the motion names above. */}
      <p className="text-sm font-semibold mt-4 mb-0.5" style={{ color: '#1C1410' }}>{t('settings_doc_names_label')}</p>
      <p className="text-xs mb-2 leading-snug" style={{ color: '#9A8A78' }}>{t('settings_doc_names_desc')}</p>
      <div className="space-y-1">
        {([
          { singular: 'workingPaper' as keyof DocumentNames, plural: 'workingPapers' as keyof DocumentNames,
            singularDefault: t('documents_working_paper'), pluralDefault: t('documents_working_papers_tab') },
          { singular: 'draftResolution' as keyof DocumentNames, plural: 'draftResolutions' as keyof DocumentNames,
            singularDefault: t('documents_draft_resolution'), pluralDefault: t('documents_draft_resolutions_tab') },
        ]).map((group) => (
          <div key={group.singular} className="px-3 rounded-xl" style={{ border: '1px solid #DDD4C0', backgroundColor: '#FAF8F3' }}>
            {([
              { key: group.singular, label: t('settings_doc_name_singular'), localized: group.singularDefault },
              { key: group.plural,   label: t('settings_doc_name_plural'),   localized: group.pluralDefault },
            ]).map(({ key, label, localized }) => (
              <RenameRow
                key={key}
                label={label}
                defaultName={localized}
                resetValue={DEFAULT_DOCUMENT_NAMES[key]}
                value={docNames[key] ?? DEFAULT_DOCUMENT_NAMES[key]}
                onChange={(v) => upd('documentNames', { ...docNames, [key]: v })}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Submission limits. `wpSubmissionLimit` / `drSubmissionLimit` have always
          been enforced on submit, but no Settings control ever wrote them, so in
          practice every committee ran unlimited. Empty field = unlimited.
          SEMANTICS: the cap counts documents PER COMMITTEE, not per delegation —
          that matches `docLimitReached()` in lib/docNames and the existing
          four-locale "no more … can be submitted" copy. */}
      <p className="text-sm font-semibold mt-4 mb-0.5" style={{ color: '#1C1410' }}>Submission limits</p>
      <p className="text-xs mb-2 leading-snug" style={{ color: '#9A8A78' }}>
        How many of each document this committee accepts in total. Leave blank for unlimited.
      </p>
      <div className="rounded-xl px-3" style={{ border: '1px solid #DDD4C0', backgroundColor: '#FAF8F3' }}>
        {([
          { key: 'wpSubmissionLimit' as const, nameKey: 'workingPapers' as keyof DocumentNames, fallback: t('documents_working_papers_tab') },
          { key: 'drSubmissionLimit' as const, nameKey: 'draftResolutions' as keyof DocumentNames, fallback: t('documents_draft_resolutions_tab') },
        ]).map(({ key, nameKey, fallback }, i) => {
          const stored = docNames[nameKey];
          const displayName = stored && stored !== DEFAULT_DOCUMENT_NAMES[nameKey] ? stored : fallback;
          const limit = typeof s[key] === 'number' ? (s[key] as number) : null;
          return (
            <div
              key={key}
              className="flex items-center justify-between gap-4 py-3"
              style={i === 0 ? { borderBottom: '1px solid #DDD4C0' } : undefined}
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate" style={{ color: '#1C1410' }}>{displayName}</div>
                <div className="text-xs mt-0.5" style={{ color: '#9A8A78' }}>
                  {limit === null ? 'Unlimited' : `Maximum ${limit} per committee`}
                </div>
              </div>
              <NumberField
                value={limit}
                min={0}
                max={999}
                allowEmpty
                placeholder="∞"
                onCommit={(v) => upd(key, v)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Toggle({ value, onChange, label, note }: {
  value: boolean; onChange: (v: boolean) => void; label: string; note?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 last:border-0" style={{ borderBottom: '1px solid #DDD4C0' }}>
      <div className="flex-1">
        <div className="text-sm font-semibold" style={{ color: '#1C1410' }}>{label}</div>
        {note && <div className="text-xs mt-0.5 leading-snug" style={{ color: '#9A8A78' }}>{note}</div>}
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`relative shrink-0 w-10 h-[22px] rounded-full transition-colors mt-0.5 focus:outline-none`}
        style={{ backgroundColor: value ? '#1B3828' : '#DDD4C0' }}
      >
        <span className={`absolute top-[2px] left-[2px] w-[18px] h-[18px] rounded-full bg-white transition-transform shadow-sm ${value ? 'translate-x-[18px]' : 'translate-x-0'}`} />
      </button>
    </div>
  );
}

function SelectRow({ value, onChange, label, options, note }: {
  value: string; onChange: (v: string) => void; label: string;
  options: { value: string; label: string }[]; note?: string;
}) {
  return (
    <div className="py-3 last:border-0" style={{ borderBottom: '1px solid #DDD4C0' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="text-sm font-semibold" style={{ color: '#1C1410' }}>{label}</div>
          {note && <div className="text-xs mt-0.5 leading-snug" style={{ color: '#9A8A78' }}>{note}</div>}
        </div>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none shrink-0 cursor-pointer max-w-[180px]"
          style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', color: '#1C1410' }}
        >
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
    </div>
  );
}

// Compact numeric field that commits on blur / Enter, never per keystroke.
// `upd` is a read-modify-write of the whole committees.settings JSONB (debounced
// at the write layer), and a half-typed "1" on the way to "10" is a real value
// that would briefly become the committee's setting. Holding a local draft and
// committing once keeps intermediate states out of the store entirely.
// `allowEmpty` maps an empty field to null — that is how "unlimited" is spelled
// for the document limits. Escape reverts.
function NumberField({ value, onCommit, min, max, allowEmpty = false, placeholder, suffix, widthClass = 'w-16' }: {
  value: number | null;
  onCommit: (v: number | null) => void;
  min: number;
  max: number;
  allowEmpty?: boolean;
  placeholder?: string;
  suffix?: string;
  widthClass?: string;
}) {
  const canonical = value === null ? '' : String(value);
  const [draft, setDraft] = useState(canonical);
  useEffect(() => { setDraft(value === null ? '' : String(value)); }, [value]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed === '') {
      if (allowEmpty) { onCommit(null); return; }
      setDraft(canonical);
      return;
    }
    const n = parseInt(trimmed, 10);
    if (!Number.isFinite(n)) { setDraft(canonical); return; }
    onCommit(Math.min(max, Math.max(min, n)));
  };

  return (
    <span className="inline-flex items-center gap-1.5 shrink-0">
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); (e.currentTarget as HTMLInputElement).blur(); }
          if (e.key === 'Escape') { setDraft(canonical); (e.currentTarget as HTMLInputElement).blur(); }
        }}
        className={`${widthClass} text-sm text-center rounded-lg px-1.5 py-1 outline-none focus:border-[#1B3828]`}
        style={{ backgroundColor: '#FFFFFF', border: '1px solid #DDD4C0', color: '#1C1410' }}
      />
      {suffix && <span className="text-[10px]" style={{ color: '#9A8A78' }}>{suffix}</span>}
    </span>
  );
}

// Wraps a region that a view-only co-chair may look at but not touch. The write
// helpers are already no-ops for them; this is the matching visual/interaction
// affordance so nothing looks live when it is not.
function ReadOnlyRegion({ on, children }: { on: boolean; children: React.ReactNode }) {
  if (!on) return <>{children}</>;
  return (
    <div aria-disabled className="select-none" style={{ opacity: 0.55, pointerEvents: 'none' }}>
      {children}
    </div>
  );
}

export function SettingsPanel({ committee, onClose, myChairName, isViewOnly = false }: {
  committee: Committee;
  onClose: () => void;
  myChairName?: string;
  // UI GATE ONLY. RLS authenticates the SESSION (anyone holding the chair suffix
  // can write anything to it), never the chair's role, so this hides and disables
  // the write affordances for a view-only co-chair. It is NOT enforcement, and
  // must never be treated as a security boundary. See AGENTS.md rule 15.
  isViewOnly?: boolean;
}) {
  const t = useT();
  const { language, setLanguage } = useLanguage();
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [tab, setTab] = useState<SettingsTab>('access');
  const { getSettings, updateSetting } = useSettingsStore();
  const s = getSettings(committee.code);
  const headChairName = committee.dbHeadChair || committee.chairNames?.[0] || '';

  // ── Debounced DB writes ───────────────────────────────────────────────────
  // saveCommitteeSettings and updateCommitteeScoringInDB are each a
  // read-modify-write of the whole committees.settings JSONB. Firing one per
  // keystroke (sponsor label, custom score-source/factor names) or per slider
  // tick interleaves those round-trips, and a late-landing stale read silently
  // reverts a concurrent chair's change. The Zustand store is still updated
  // synchronously so the UI stays instant; only the network write is coalesced.
  const WRITE_DEBOUNCE_MS = 400;
  const pendingSettings = useRef<Partial<CommitteeSettings> | null>(null);
  const pendingScoring = useRef<ScoringConfig | null>(null);
  const writeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushWrites = () => {
    if (writeTimer.current) { clearTimeout(writeTimer.current); writeTimer.current = null; }
    const settingsPatch = pendingSettings.current;
    const scoringPatch = pendingScoring.current;
    pendingSettings.current = null;
    pendingScoring.current = null;
    const suffix = committee.dbChairJoinSuffix ?? undefined;
    if (settingsPatch) {
      // `headChair` is not a CommitteeSettings field, but it rides along in the
      // dbSettings blob the chair/voting loaders hydrate into the store. Writing
      // it back would silently revert the gavel to whoever held it at page load
      // (AGENTS.md rule 12), so it never leaves this component.
      const { headChair: _headChair, ...rest } =
        { ...getSettings(committee.code), ...settingsPatch } as Record<string, unknown>;
      void _headChair;
      saveCommitteeSettings(committee.id, rest, committee.code, suffix);
    }
    if (scoringPatch) updateCommitteeScoringInDB(committee.id, scoringPatch, committee.code, suffix);
  };
  const flushRef = useRef(flushWrites);
  flushRef.current = flushWrites;

  const scheduleWrite = () => {
    if (writeTimer.current) clearTimeout(writeTimer.current);
    writeTimer.current = setTimeout(() => flushRef.current(), WRITE_DEBOUNCE_MS);
  };

  // Flush on unmount (panel close / navigation) and on pagehide so a debounced
  // change is never dropped just because the chair closed the panel quickly.
  useEffect(() => {
    const onHide = () => flushRef.current();
    window.addEventListener('pagehide', onHide);
    return () => { window.removeEventListener('pagehide', onHide); flushRef.current(); };
  }, []);

  const upd = <K extends keyof CommitteeSettings>(key: K, value: CommitteeSettings[K]) => {
    if (isViewOnly) return;   // UI gate — see the isViewOnly prop note above
    updateSetting(committee.code, key, value);
    pendingSettings.current = { ...(pendingSettings.current ?? {}), [key]: value };
    scheduleWrite();
  };

  // Scoring config, local store + DB jsonb (so delegates/FAs on other devices see it)
  const scoring: ScoringConfig = s.scoring ?? DEFAULT_SCORING;
  const updScoring = (next: ScoringConfig) => {
    if (isViewOnly) return;   // UI gate — see the isViewOnly prop note above
    updateSetting(committee.code, 'scoring', next);
    pendingScoring.current = next;
    scheduleWrite();
  };
  const setSource = (id: string, patch: Partial<ScoreSource>) =>
    updScoring({ ...scoring, sources: scoring.sources.map((x) => (x.id === id ? { ...x, ...patch } : x)) });
  const removeSource = (id: string) =>
    updScoring({ ...scoring, sources: scoring.sources.filter((x) => x.id !== id) });
  const addSource = () =>
    updScoring({ ...scoring, sources: [...scoring.sources, { id: `custom-${Date.now()}`, name: 'Custom source', value: 5, enabled: true, builtin: false }] });
  const setFactor = (id: string, patch: Partial<RankingFactor>) =>
    updScoring({ ...scoring, factors: scoring.factors.map((x) => (x.id === id ? { ...x, ...patch } : x)) });
  const removeFactor = (id: string) =>
    updScoring({ ...scoring, factors: scoring.factors.filter((x) => x.id !== id) });
  const addFactor = () =>
    updScoring({ ...scoring, factors: [...scoring.factors, { id: `factor-${Date.now()}`, name: 'New factor', enabled: true }] });

  // ── Chair code. THE DB IS THE SOURCE OF TRUTH. ────────────────────────────
  // The chair suffix is the only write credential (x-chair-suffix → is_session_chair)
  // AND the code every chair typed on the join page, so minting a new one for a
  // live committee locks every one of them out with no error surfaced anywhere.
  // localStorage is a per-device mirror, not authority: on a fresh browser,
  // incognito, a cleared cache, or a co-chair arriving by link it is simply empty,
  // and the voting page never hydrates it at all. So a new suffix may be minted
  // ONLY when the DB genuinely has none. When the DB has one we adopt it locally
  // and write nothing back.
  const dbChairSuffix = committee.dbChairJoinSuffix ?? '';
  useEffect(() => {
    if (dbChairSuffix) {
      // Store-only adoption. Never writes to the DB, so an empty or stale local
      // copy can no longer overwrite the live code.
      if (s.chairJoinSuffix !== dbChairSuffix) updateSetting(committee.code, 'chairJoinSuffix', dbChairSuffix);
      return;
    }
    if (isViewOnly) return;                    // only the acting chair mints a code
    if (s.chairJoinSuffix) {
      // Legacy committee with no suffix in the DB but one remembered on this
      // device: restore that one rather than inventing a different code.
      updateCommitteeChairSuffixInDB(committee.id, s.chairJoinSuffix, committee.code, s.chairJoinSuffix);
      return;
    }
    const newSuffix = Math.floor(1000 + Math.random() * 9000).toString();
    updateSetting(committee.code, 'chairJoinSuffix', newSuffix);
    updateCommitteeChairSuffixInDB(committee.id, newSuffix, committee.code, newSuffix);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [committee.id, dbChairSuffix, s.chairJoinSuffix, isViewOnly]);

  // Always prefer the DB value on screen so a chair never reads a phantom code
  // off a stale local store.
  const displayChairSuffix = dbChairSuffix || s.chairJoinSuffix || '????';

  const tabs: { id: SettingsTab; label: string }[] = [
    { id: 'access', label: t('settings_tab_access') },
    { id: 'motions', label: t('settings_tab_motions') },
    { id: 'voting', label: t('settings_tab_voting') },
    { id: 'points', label: t('settings_tab_points') },
  ];

  return (
    <Portal><div
      className="fixed inset-0 z-[60] bg-black/40 flex justify-end"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md flex flex-col h-full shadow-2xl overflow-hidden" style={{ backgroundColor: '#FAF8F3', borderLeft: '1px solid #DDD4C0' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: '1px solid #DDD4C0', backgroundColor: '#1B3828' }}>
          <h2 className="text-xl font-black" style={{ color: '#EED98A' }}>{t('settings_session_settings')}</h2>
          <div className="flex items-center gap-2.5">
            {/* Compact language toggle in header */}
            <div className="relative">
              <button
                onClick={() => setShowLangMenu((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl transition-colors focus:outline-none"
                style={{ color: '#EED98A', backgroundColor: showLangMenu ? 'rgba(238,217,138,0.12)' : 'transparent' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(238,217,138,0.12)'; }}
                onMouseLeave={(e) => { if (!showLangMenu) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
              >
                <Globe size={14} strokeWidth={2} />
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '11px', fontWeight: 700 }}>{language.toUpperCase()}</span>
              </button>
              {showLangMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowLangMenu(false)} />
                  <div className="absolute right-0 top-full mt-2 z-50 rounded-xl overflow-hidden shadow-xl" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', minWidth: '140px' }}>
                    {([['en', t('settings_english')], ['es', t('settings_spanish')], ['fr', t('settings_french')], ['ar', 'العربية']] as [string, string][]).map(([code, label], i) => (
                      <div key={code}>
                        {i > 0 && <div style={{ height: '1px', backgroundColor: '#DDD4C0' }} />}
                        <button
                          onClick={() => { setLanguage(code as 'en' | 'es' | 'fr' | 'ar'); setShowLangMenu(false); }}
                          className="w-full flex items-center gap-2.5 px-4 py-3 text-start transition-colors focus:outline-none"
                          style={{ color: language === code ? '#1B3828' : '#6A5A4A', fontWeight: language === code ? 800 : 600, fontSize: '13px', backgroundColor: language === code ? 'rgba(27,56,40,0.07)' : 'transparent' }}
                          onMouseEnter={(e) => { if (language !== code) (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.04)'; }}
                          onMouseLeave={(e) => { if (language !== code) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                        >
                          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '11px', color: '#9A8A78' }}>{code.toUpperCase()}</span>
                          <span>{label}</span>
                          {language === code && <span className="ms-auto" style={{ color: '#B6871F' }}>✓</span>}
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
            <button onClick={onClose} className="text-xl leading-none transition-colors focus:outline-none" style={{ color: 'rgba(238,217,138,0.6)' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#EED98A'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'rgba(238,217,138,0.6)'; }}>✕</button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex shrink-0" style={{ borderBottom: '1px solid #DDD4C0', backgroundColor: '#FAF8F3' }}>
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex-1 py-2.5 text-xs font-bold transition-colors focus:outline-none"
              style={{
                color: tab === t.id ? '#1B3828' : '#9A8A78',
                borderBottom: tab === t.id ? '2px solid #1B3828' : '2px solid transparent',
                marginBottom: '-1px',
              }}
            >
              {t.label.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">

          {/* View-only co-chair notice. Matches the chair page's view-only pill.
              This is a UI gate, not enforcement — see the isViewOnly prop note. */}
          {isViewOnly && (
            <div
              className="flex items-start gap-2 px-3.5 py-2.5 rounded-xl mb-4"
              style={{
                backgroundColor: 'rgba(139,32,32,0.10)',
                border: '1px solid rgba(139,32,32,0.28)',
                color: '#8B2020', fontFamily: "'Poppins','Outfit',sans-serif",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="shrink-0 mt-[2px]">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
              </svg>
              <div className="text-xs leading-snug">
                <span className="font-black">{t('settings_view_only')}</span>
                {headChairName ? <> &middot; {t('settings_view_only_chairing', { name: headChairName })}</> : null}
                <div className="mt-0.5 font-semibold" style={{ opacity: 0.85 }}>
                  {t('settings_view_only_note')}
                </div>
              </div>
            </div>
          )}

          {/* ── Voting & Majorities ── */}
          {tab === 'voting' && (
            <ReadOnlyRegion on={isViewOnly}><div>
              <SectionLabel>{t('settings_section_voting')}</SectionLabel>
              <SelectRow
                label={t('settings_substantive_threshold')}
                value={s.substantiveThreshold}
                onChange={(v) => upd('substantiveThreshold', v as CommitteeSettings['substantiveThreshold'])}
                options={[
                  { value: 'simple', label: t('settings_majority_simple') },
                  { value: 'supermajority-2-3', label: t('settings_majority_supermajority') },
                  { value: 'consensus', label: t('settings_majority_consensus') },
                ]}
              />

              <SectionLabel>{t('settings_section_abstentions')}</SectionLabel>
              <Toggle
                label={t('settings_allow_abstentions_label')}
                note={t('settings_allow_abstentions_note')}
                value={s.allowAbstentions}
                onChange={(v) => upd('allowAbstentions', v)}
              />

              <SectionLabel>{t('settings_section_veto')}</SectionLabel>
              <div className="space-y-3 py-3" style={{ borderBottom: '1px solid #DDD4C0' }}>
                {([
                  { id: 'none', label: t('settings_veto_none_label'), desc: t('settings_veto_none_desc') },
                  { id: 'p5', label: t('settings_veto_p5_label'), desc: t('settings_veto_p5_desc') },
                  { id: 'unanimous', label: t('settings_veto_unanimous_label'), desc: t('settings_veto_unanimous_desc') },
                  { id: 'custom', label: t('settings_veto_custom_label'), desc: t('settings_veto_custom_desc') },
                ] as const).map((option) => (
                  <label key={option.id} className="flex items-start gap-3 cursor-pointer" onClick={() => upd('vetoMode', option.id)}>
                    <div className="mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors"
                      style={{ borderColor: s.vetoMode === option.id ? '#1B3828' : '#DDD4C0', backgroundColor: s.vetoMode === option.id ? '#1B3828' : 'transparent' }}>
                      {s.vetoMode === option.id && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                    <div>
                      <div className="text-sm font-semibold" style={{ color: '#1C1410' }}>{option.label}</div>
                      <div className="text-xs mt-0.5 leading-snug" style={{ color: '#9A8A78' }}>{option.desc}</div>
                    </div>
                  </label>
                ))}
              </div>

              {/* P5 veto. The list itself is deliberately NOT editable — see
                  P5_FIXED_HINT. What this panel adds is the answer a non-UNSC chair
                  needs: which of the five actually hold a seat here (matched by
                  country identity, not raw string), and a one-click move to Custom
                  veto seeded with whichever of them are seated. */}
              {s.vetoMode === 'p5' && (() => {
                const identity = (name: string) => getCountryByName(name)?.code ?? name.trim().toLowerCase();
                const p5 = s.p5Delegations ?? [];
                const p5Ids = new Set(p5.map(identity));
                // Seat names as spelled on THIS roster, so seeding vetoCountries
                // matches what the custom picker compares against (d.country).
                const seatedNames = committee.delegates.filter((d) => p5Ids.has(identity(d.country))).map((d) => d.country);
                const seatedIds = new Set(seatedNames.map(identity));
                return (
                  <div className="mt-2 p-3 rounded-xl" style={{ backgroundColor: '#EDE7D8', border: '1px solid #DDD4C0' }}>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <HoverHint text={P5_FIXED_HINT}>
                        <span className="text-xs font-semibold" style={{ color: '#1B3828' }}>{t('settings_p5_delegations')}</span>
                      </HoverHint>
                      <span className="text-[10px] font-mono shrink-0" style={{ color: seatedIds.size === p5.length ? '#3D7A52' : '#B8844A' }}>
                        {seatedIds.size}/{p5.length} seated
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      {p5.map((name) => {
                        const found = getCountryByName(name);
                        const seated = seatedIds.has(identity(name));
                        return (
                          <div key={name} className="flex items-center gap-2.5 py-0.5" style={{ opacity: seated ? 1 : 0.45 }}>
                            {found && <img src={getFlagUrl(found.code)} alt={found.code} width={18} height={18} loading="eager" className="w-[18px] h-[18px] object-contain shrink-0" onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} />}
                            <span className="text-sm truncate" style={{ color: '#1C1410' }}>{getCountryDisplayName(name, language)}</span>
                            {!seated && <span className="text-[10px] ms-auto shrink-0" style={{ color: '#9A8A78' }}>not in this committee</span>}
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-xs mt-2" style={{ color: '#9A8A78' }}>{t('settings_p5_note')}</p>
                    {seatedIds.size < p5.length && (
                      <div className="mt-2.5 pt-2.5" style={{ borderTop: '1px solid #DDD4C0' }}>
                        <p className="text-xs leading-snug" style={{ color: '#B8844A' }}>
                          {seatedIds.size === 0
                            ? 'None of the P5 sit in this committee, so P5 veto currently has no effect.'
                            : `Only ${seatedIds.size} of the P5 sit in this committee — the rest have no effect here.`}
                          {' '}Use custom veto members to give the veto to other delegations.
                        </p>
                        <button
                          onClick={() => { upd('vetoCountries', seatedNames); upd('vetoMode', 'custom'); }}
                          className="mt-2 text-[11px] font-bold px-2.5 py-1.5 rounded-lg transition-colors focus:outline-none"
                          style={{ border: '1px solid #DDD4C0', color: '#1B3828', backgroundColor: '#FAF8F3' }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#1B3828'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#DDD4C0'; }}
                        >
                          Switch to custom veto members
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}

              {s.vetoMode === 'custom' && (
                <div className="mt-2 p-3 rounded-xl" style={{ backgroundColor: '#EDE7D8', border: '1px solid #DDD4C0' }}>
                  <p className="text-xs font-semibold mb-2" style={{ color: '#1B3828' }}>{t('settings_veto_custom_members')}</p>
                  <div className="max-h-44 overflow-y-auto flex flex-col gap-1">
                    {[...committee.delegates]
                      .sort((a, b) => getCountryDisplayName(a.country, language).localeCompare(getCountryDisplayName(b.country, language), language, { sensitivity: 'base' }))
                      .map((d) => {
                        const checked = (s.vetoCountries ?? []).includes(d.country);
                        const found = getCountryByName(d.country);
                        return (
                          <label key={d.id} className="flex items-center gap-2.5 cursor-pointer py-1" onClick={() => {
                            const cur = s.vetoCountries ?? [];
                            upd('vetoCountries', checked ? cur.filter((c) => c !== d.country) : [...cur, d.country]);
                          }}>
                            <div className="w-4 h-4 rounded border flex items-center justify-center shrink-0"
                              style={{ borderColor: checked ? '#1B3828' : '#DDD4C0', backgroundColor: checked ? '#1B3828' : 'transparent' }}>
                              {checked && <span className="text-white text-[10px] leading-none">✓</span>}
                            </div>
                            {found && <img src={getFlagUrl(found.code)} alt={found.code} width={18} height={18} loading="eager" className="w-[18px] h-[18px] object-contain shrink-0" onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} />}
                            <span className="text-sm" style={{ color: '#1C1410' }}>{getCountryDisplayName(d.country, language)}</span>
                          </label>
                        );
                      })}
                  </div>
                  <p className="text-xs mt-2" style={{ color: '#9A8A78' }}>{t('settings_veto_custom_note')}</p>
                </div>
              )}

              <SectionLabel>{t('settings_section_quorum')}</SectionLabel>
              <SelectRow
                label={t('settings_quorum_label')}
                note={t('settings_quorum_note')}
                value={s.quorumThreshold}
                onChange={(v) => upd('quorumThreshold', v as CommitteeSettings['quorumThreshold'])}
                options={[
                  { value: 'none', label: t('settings_quorum_none') },
                  { value: '1-4', label: t('settings_quorum_1_4') },
                  { value: '1-3', label: t('settings_quorum_1_3') },
                  { value: '1-2', label: t('settings_quorum_1_2') },
                ]}
              />
            </div></ReadOnlyRegion>
          )}

          {/* ── Motions ── */}
          {tab === 'motions' && <ReadOnlyRegion on={isViewOnly}><MotionsTab s={s} upd={upd} /></ReadOnlyRegion>}

          {/* ── Access & Identity ── */}
          {tab === 'access' && (
            <div>
              <SectionLabel>{t('settings_section_codes')}</SectionLabel>
              <div className="py-3" style={{ borderBottom: '1px solid #DDD4C0' }}>
                <div className="text-xs mb-1.5" style={{ color: '#9A8A78' }}>{t('settings_session_code_label')}</div>
                <CodeCopyButton code={committee.code} />
              </div>
              <div className="py-3" style={{ borderBottom: '1px solid #DDD4C0' }}>
                <div className="text-xs mb-1.5" style={{ color: '#9A8A78' }}>{t('settings_chair_code_label')}</div>
                <ChairPasswordDisplay password={displayChairSuffix} />
              </div>
              {/* Read-only "who is chairing?" answer. Switching chairs lives in exactly one
                  place — the gavel chip on the session header — so this deliberately has no
                  button; duplicating it here hid the action where nobody looked. Stays
                  OUTSIDE the view-only gate below so a co-chair can still read it. */}
              {(() => {
                const headChair = committee.dbHeadChair || committee.chairNames?.[0] || '';
                const isHead = !myChairName || headChair === myChairName;
                return (
                  <div className="py-3" style={{ borderBottom: '1px solid #DDD4C0' }}>
                    <div className="text-xs mb-1.5" style={{ color: '#9A8A78' }}>{t('settings_head_chair_label')}</div>
                    <div className="text-sm font-semibold" style={{ color: '#1C1410' }}>
                      {headChair || '—'}{isHead && myChairName ? ' (you)' : ''}
                    </div>
                    <div className="text-[11px] mt-1.5" style={{ color: '#9A8A78' }}>
                      {t('settings_head_chair_note')}
                    </div>
                  </div>
                );
              })()}
              {/* Everything below writes committee state, so it is gated for a
                  view-only co-chair. The session/chair codes and the head-chair
                  row above stay live on purpose. */}
              <ReadOnlyRegion on={isViewOnly}>
              <Toggle
                label={t('settings_chair_approval_label')}
                note={t('settings_chair_approval_note')}
                value={s.requireChairApproval}
                onChange={(v) => upd('requireChairApproval', v)}
              />

              <SectionLabel>Committee display &amp; permissions</SectionLabel>
              <div className="py-3" style={{ borderBottom: '1px solid #DDD4C0' }}>
                <div className="text-xs mb-1.5" style={{ color: '#9A8A78' }}>Sponsors label</div>
                <input
                  type="text"
                  value={s.sponsorLabel}
                  placeholder="Sponsors"
                  onChange={(e) => upd('sponsorLabel', e.target.value)}
                  className="w-full text-sm bg-[#FAF8F3] border border-[#DDD4C0] rounded-lg px-3 py-2 outline-none focus:border-[#1B3828]"
                  style={{ color: '#1C1410' }}
                />
              </div>
              <Toggle
                label="Lock delegate roll call"
                note="Delegates can't change their own Present/Voting status"
                value={s.lockDelegateRollCall}
                onChange={(v) => upd('lockDelegateRollCall', v)}
              />
              <Toggle
                label="Disable chat"
                note="Hides chat for delegates and chairs"
                value={s.disableChat}
                onChange={(v) => upd('disableChat', v)}
              />

              <SectionLabel>GSL</SectionLabel>
              <Toggle
                label={t('settings_gsl_require_next_label')}
                note={t('settings_gsl_require_next_note')}
                value={s.gslRequireNextSpeaker}
                onChange={(v) => upd('gslRequireNextSpeaker', v)}
              />
              </ReadOnlyRegion>
            </div>
          )}

          {/* ── Points / Scoring config ── */}
          {tab === 'points' && (
            <ReadOnlyRegion on={isViewOnly}><div style={{ fontFamily: "'Poppins', 'Outfit', sans-serif" }}>
              {/* Score sources */}
              <SectionLabel>Score sources</SectionLabel>
              <p className="text-xs mb-3 leading-snug" style={{ color: '#9A8A78' }}>
                Points awarded automatically as delegates act. Toggle off any you don&apos;t use, or add your own.
              </p>
              <div className="space-y-1.5 mb-3">
                {scoring.sources.map((src) => (
                  <div key={src.id} className="flex items-center gap-2 px-2 py-2 rounded-xl" style={{ border: '1px solid #DDD4C0', backgroundColor: '#FAF8F3' }}>
                    {src.builtin ? (
                      <span className="flex-1 text-sm font-semibold truncate" style={{ color: '#1C1410' }}>{src.name}</span>
                    ) : (
                      <input value={src.name} onChange={(e) => setSource(src.id, { name: e.target.value })}
                        className="flex-1 min-w-0 text-sm font-semibold bg-transparent border-b border-[#DDD4C0] focus:border-[#1B3828] outline-none" style={{ color: '#1C1410' }} />
                    )}
                    <div className="flex items-center gap-1 shrink-0">
                      <input type="number" value={src.value} onChange={(e) => setSource(src.id, { value: parseInt(e.target.value) || 0 })}
                        className="w-14 text-sm text-center bg-white border border-[#DDD4C0] rounded-lg px-1.5 py-1 focus:border-[#1B3828] outline-none" style={{ color: '#1C1410' }} />
                      <span className="text-[10px]" style={{ color: '#9A8A78' }}>pts</span>
                    </div>
                    <button onClick={() => setSource(src.id, { enabled: !src.enabled })}
                      className="relative shrink-0 w-8 h-[18px] rounded-full transition-colors focus:outline-none"
                      style={{ backgroundColor: src.enabled ? '#1B3828' : '#DDD4C0' }}>
                      <span className={`absolute top-[2px] left-[2px] w-[14px] h-[14px] rounded-full bg-white transition-transform shadow-sm ${src.enabled ? 'translate-x-[14px]' : 'translate-x-0'}`} />
                    </button>
                    {!src.builtin && (
                      <button onClick={() => removeSource(src.id)} className="shrink-0 text-[#9A8A78] hover:text-[#8B2020] text-sm">✕</button>
                    )}
                  </div>
                ))}
              </div>
              <button onClick={addSource} className="text-xs font-bold px-3 py-2 rounded-lg transition-colors" style={{ border: '1px solid #DDD4C0', color: '#1B3828', backgroundColor: '#FAF8F3' }}>+ Add source</button>

              {/* Ranking factors */}
              <div className="mt-6 pt-6" style={{ borderTop: '1px solid #DDD4C0' }}>
                <SectionLabel>Quality factors</SectionLabel>
                <p className="text-xs mb-3 leading-snug" style={{ color: '#9A8A78' }}>
                  Subjective factors chairs rate per speech (0–{scoring.factorScaleMax}).
                </p>
                <div className="space-y-1.5 mb-3">
                  {scoring.factors.map((f) => (
                    <div key={f.id} className="flex items-center gap-2 px-2 py-2 rounded-xl" style={{ border: '1px solid #DDD4C0', backgroundColor: '#FAF8F3' }}>
                      <input value={f.name} onChange={(e) => setFactor(f.id, { name: e.target.value })}
                        className="flex-1 min-w-0 text-sm font-semibold bg-transparent border-b border-[#DDD4C0] focus:border-[#1B3828] outline-none" style={{ color: '#1C1410' }} />
                      <button onClick={() => setFactor(f.id, { enabled: !f.enabled })}
                        className="relative shrink-0 w-8 h-[18px] rounded-full transition-colors focus:outline-none"
                        style={{ backgroundColor: f.enabled ? '#1B3828' : '#DDD4C0' }}>
                        <span className={`absolute top-[2px] left-[2px] w-[14px] h-[14px] rounded-full bg-white transition-transform shadow-sm ${f.enabled ? 'translate-x-[14px]' : 'translate-x-0'}`} />
                      </button>
                      <button onClick={() => removeFactor(f.id)} className="shrink-0 text-[#9A8A78] hover:text-[#8B2020] text-sm">✕</button>
                    </div>
                  ))}
                </div>
                <button onClick={addFactor} className="text-xs font-bold px-3 py-2 rounded-lg transition-colors" style={{ border: '1px solid #DDD4C0', color: '#1B3828', backgroundColor: '#FAF8F3' }}>+ Add factor</button>
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs" style={{ color: '#6A5A4A' }}>Rating scale max</span>
                    <span className="text-xs font-bold" style={{ color: '#1B3828' }}>{scoring.factorScaleMax}</span>
                  </div>
                  <input type="range" min={0} max={100} step={1} value={scoring.factorScaleMax}
                    onChange={(e) => updScoring({ ...scoring, factorScaleMax: parseInt(e.target.value) })}
                    className="w-full" style={{ accentColor: '#1B3828' }} />
                  <div className="flex items-center justify-between text-[10px] font-mono mt-0.5" style={{ color: '#9A8A78' }}>
                    <span>0</span><span>100</span>
                  </div>
                </div>
              </div>

              {/* Blend + hide */}
              <div className="mt-6 pt-6" style={{ borderTop: '1px solid #DDD4C0' }}>
                <SectionLabel>Ranking blend</SectionLabel>
                <div className="flex items-center justify-between text-[10px] font-mono mb-1" style={{ color: '#9A8A78' }}>
                  <span>Objective</span><span>{scoring.scoreBlend}%</span><span>Quality</span>
                </div>
                <input type="range" min={0} max={100} value={scoring.scoreBlend}
                  onChange={(e) => updScoring({ ...scoring, scoreBlend: parseInt(e.target.value) })}
                  className="w-full accent-[#1B3828]" />
                <div className="mt-4">
                  <Toggle
                    label="Hide scores from delegates"
                    note="Delegates keep their speaking recap but won't see point totals or the leaderboard."
                    value={scoring.hideScoresFromDelegates}
                    onChange={(v) => updScoring({ ...scoring, hideScoresFromDelegates: v })}
                  />
                </div>
              </div>
            </div></ReadOnlyRegion>
          )}
        </div>

        <div className="px-5 py-3 shrink-0" style={{ borderTop: '1px solid #DDD4C0' }}>
          <p className="text-[10px] text-center font-mono" style={{ color: '#9A8A78' }}>
            {isViewOnly ? t('settings_view_only') : t('settings_changes_apply')}
          </p>
        </div>
      </div>
    </div></Portal>
  );
}
