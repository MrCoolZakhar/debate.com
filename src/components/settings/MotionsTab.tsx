'use client';

import { useRef, useState } from 'react';
import { ChevronDown, ChevronUp, FileText, Gavel, GripVertical, Hourglass, Infinity as InfinityIcon, ListOrdered, Sparkles, Timer } from 'lucide-react';
import { DEFAULT_DOCUMENT_NAMES, DEFAULT_MOTION_NAMES, type CommitteeSettings, type DocumentNames, type MotionNames } from '@/lib/settingsStore';
import { localizedMotionDefaults } from '@/lib/committeeFlags';
import { K, Section, SettingRow, GavelSwitch, ClockStepper, InlineRename, HoverHint, TallyStepper } from './settingsKit';
import type { TabProps } from './settingsTypes';

type OrderableType = 'moderated' | 'unmoderated' | 'consultation' | 'tour';

// Disruptiveness is NOT stored: it is purely the position in `motionOrder` (top = most
// disruptive). Custom motions have no position and always sit last (MotionsModal hard-codes
// their disruptiveness to 0), so their row sits outside the ranking.
const MOTION_META: Record<OrderableType, { enabledKey: keyof CommitteeSettings; namesKey: keyof MotionNames; defaultName: string }> = {
  moderated:    { enabledKey: 'motionModeratedCaucus',   namesKey: 'moderated',    defaultName: 'Moderated Caucus' },
  unmoderated:  { enabledKey: 'motionUnmoderatedCaucus', namesKey: 'unmoderated',  defaultName: 'Unmoderated Caucus' },
  consultation: { enabledKey: 'motionCoW',               namesKey: 'consultation', defaultName: 'Consultation of the Whole' },
  tour:         { enabledKey: 'motionTourDeTable',       namesKey: 'tour',         defaultName: 'Tour de Table' },
};

/** Four rising bars: how disruptive this rank is. Red-brown for the procedural motions. */
function HeatBars({ level, tone = 'gold' }: { level: number; tone?: 'gold' | 'red' | 'off' }) {
  return (
    <span aria-hidden className="inline-flex items-end gap-[3px]" style={{ height: 18 }}>
      {[1, 2, 3, 4].map((l) => (
        <span key={l} style={{
          width: 4, height: 5 + l * 3, borderRadius: 2,
          background: tone === 'off' ? 'rgba(28,20,16,0.12)' : l <= level ? (tone === 'red' ? K.danger : K.deepGold) : 'rgba(28,20,16,0.12)',
        }} />
      ))}
    </span>
  );
}

function LimitControl({ value, onChange, label, unlimitedLabel, limitLabel }: {
  value: number | null; onChange: (v: number | null) => void; label: string; unlimitedLabel: string; limitLabel: string;
}) {
  const unlimited = value === null;
  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" aria-pressed={unlimited} onClick={() => onChange(unlimited ? 3 : null)}
        className="stg-focus stg-press inline-flex items-center gap-1.5"
        title={unlimited ? limitLabel : unlimitedLabel}
        style={{ height: 32, padding: '0 11px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 800,
          background: unlimited ? K.forest : 'transparent', color: unlimited ? K.gold : K.inkSoft,
          boxShadow: unlimited ? K.outSm : 'inset 0 0 0 1px rgba(28,20,16,0.14)' }}>
        <InfinityIcon size={15} strokeWidth={2.6} aria-hidden />
        {unlimitedLabel}
      </button>
      {!unlimited && <TallyStepper label={label} value={value} min={0} max={999} onChange={(v) => onChange(v)} />}
    </span>
  );
}

export default function MotionsTab({ s, upd, t, language, isViewOnly }: TabProps) {
  const localizedDefaults = localizedMotionDefaults(language);
  const locName = (k: string, en: string) => localizedDefaults[k as keyof MotionNames] ?? en;
  const order: OrderableType[] = (s.motionOrder ?? ['consultation', 'tour', 'unmoderated', 'moderated']) as OrderableType[];
  const docNames: DocumentNames = { ...DEFAULT_DOCUMENT_NAMES, ...(s.documentNames ?? {}) };
  const dragItem = useRef<number | null>(null);
  const dragOver = useRef<number | null>(null);
  const [dragActive, setDragActive] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [announce, setAnnounce] = useState('');
  const dim = isViewOnly ? { opacity: 0.55, pointerEvents: 'none' as const } : undefined;

  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length || from === to) return;
    const next = [...order];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    upd('motionOrder', next);
    const meta = MOTION_META[m];
    setAnnounce(t('stg_motion_moved', { name: s.motionNames[meta.namesKey] ?? locName(meta.namesKey, meta.defaultName), n: to + 1 }));
  };

  const renameProps = { resetLabel: t('stg_reset_name'), editLabel: t('stg_rename') };

  return (
    <div style={dim} aria-disabled={isViewOnly || undefined}>
      <Section icon={ListOrdered} title={t('settings_motion_types_heading')} hint={t('stg_motion_types_hint')} lead>
        <p className="sr-only" aria-live="polite">{announce}</p>
        <ol style={{ listStyle: 'none', margin: 0, padding: '10px 0' }} className="flex flex-col gap-2">
          {order.map((type, i) => {
            const meta = MOTION_META[type];
            const enabled = s[meta.enabledKey] !== false;
            const name = s.motionNames[meta.namesKey] ?? meta.defaultName;
            const shown = name !== meta.defaultName ? name : locName(meta.namesKey, meta.defaultName);
            const dragging = dragActive === i;
            const over = overIndex === i && dragActive !== null && dragActive !== i;
            return (
              <li
                key={type}
                draggable
                onDragStart={(e) => { dragItem.current = i; setDragActive(i); e.dataTransfer.effectAllowed = 'move'; }}
                onDragEnter={() => { dragOver.current = i; setOverIndex(i); }}
                onDragOver={(e) => e.preventDefault()}
                onDragEnd={() => {
                  const from = dragItem.current; const to = dragOver.current;
                  setDragActive(null); setOverIndex(null); dragItem.current = null; dragOver.current = null;
                  if (from !== null && to !== null) move(from, to);
                }}
                className="flex items-center gap-3"
                style={{
                  borderRadius: 16, padding: '8px 10px 8px 6px', background: enabled ? K.surface : 'rgba(237,231,216,0.6)',
                  boxShadow: over ? `0 0 0 2px ${K.deepGold}` : K.outSm, opacity: dragging ? 0.5 : 1,
                  transitionProperty: 'box-shadow, opacity', transitionDuration: '150ms',
                }}
              >
                <span aria-hidden className="shrink-0 inline-flex items-center justify-center" style={{ width: 22, color: '#B9AC97', cursor: 'grab' }}>
                  <GripVertical size={16} strokeWidth={2.2} />
                </span>
                <span aria-hidden className="stg-num shrink-0 inline-flex items-center justify-center" style={{
                  width: 36, height: 36, borderRadius: 11, fontSize: 17, fontWeight: 900,
                  background: i === 0 ? K.forest : K.ivory, color: i === 0 ? K.gold : K.forest, boxShadow: i === 0 ? 'none' : K.inSm,
                }}>{i + 1}</span>
                <span className="flex-1 min-w-0" style={{ opacity: enabled ? 1 : 0.6 }}>
                  <InlineRename {...renameProps} defaultName={locName(meta.namesKey, meta.defaultName)} resetValue={meta.defaultName} value={name}
                    onChange={(v) => upd('motionNames', { ...s.motionNames, [meta.namesKey]: v })} />
                  <span className="flex items-center gap-2" style={{ marginTop: 1, paddingInlineStart: 2 }}>
                    <HeatBars level={4 - i} />
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: K.muted }}>{t('stg_disruptiveness', { n: 4 - i })}</span>
                  </span>
                </span>
                <span className="shrink-0 inline-flex flex-col">
                  <button type="button" aria-label={t('stg_move_up', { name: shown })} disabled={i === 0} onClick={() => move(i, i - 1)}
                    className="stg-focus stg-press inline-flex items-center justify-center" style={{ width: 28, height: 20, border: 'none', background: 'transparent', color: K.forest, opacity: i === 0 ? 0.25 : 0.8, cursor: 'pointer', borderRadius: 6 }}>
                    <ChevronUp size={15} strokeWidth={2.6} />
                  </button>
                  <button type="button" aria-label={t('stg_move_down', { name: shown })} disabled={i === order.length - 1} onClick={() => move(i, i + 1)}
                    className="stg-focus stg-press inline-flex items-center justify-center" style={{ width: 28, height: 20, border: 'none', background: 'transparent', color: K.forest, opacity: i === order.length - 1 ? 0.25 : 0.8, cursor: 'pointer', borderRadius: 6 }}>
                    <ChevronDown size={15} strokeWidth={2.6} />
                  </button>
                </span>
                <GavelSwitch size="sm" label={t('stg_motion_enabled', { name: shown })} checked={enabled}
                  onChange={(v) => upd(meta.enabledKey, v as CommitteeSettings[typeof meta.enabledKey])} />
              </li>
            );
          })}
        </ol>

        {/* Custom motions: outside the ranking on purpose (no motionOrder position). */}
        <div className="flex items-center gap-3" style={{ borderRadius: 16, padding: '8px 10px 8px 6px', marginBottom: 12, boxShadow: 'inset 0 0 0 1.5px rgba(28,20,16,0.10)', backgroundImage: 'repeating-linear-gradient(135deg, transparent 0 8px, rgba(27,56,40,0.025) 8px 16px)' }}>
          <span aria-hidden style={{ width: 22 }} />
          <span aria-hidden className="shrink-0 inline-flex items-center justify-center" style={{ width: 36, height: 36, borderRadius: 11, color: K.deepGold, boxShadow: 'inset 0 0 0 1.5px rgba(182,135,31,0.35)' }}>
            <Sparkles size={16} strokeWidth={2.3} />
          </span>
          <span className="flex-1 min-w-0">
            <InlineRename {...renameProps} defaultName={locName('custom', DEFAULT_MOTION_NAMES.custom)} resetValue={DEFAULT_MOTION_NAMES.custom}
              value={s.motionNames.custom ?? DEFAULT_MOTION_NAMES.custom} onChange={(v) => upd('motionNames', { ...s.motionNames, custom: v })} />
            <span className="flex items-center gap-2" style={{ marginTop: 1, paddingInlineStart: 2 }}>
              <HeatBars level={0} tone="off" />
              <HoverHint text={t('stg_custom_motion_hint')}><span style={{ fontSize: 11.5, fontWeight: 700, color: K.muted }}>{t('stg_unranked')}</span></HoverHint>
            </span>
          </span>
          <GavelSwitch size="sm" label={t('stg_motion_enabled', { name: locName('custom', DEFAULT_MOTION_NAMES.custom) })}
            checked={s.motionCustom !== false} onChange={(v) => upd('motionCustom', v)} />
        </div>

        {s.motionCoW !== false && (
          <>
            <SettingRow labelId="stg-cow" label={t('settings_cow_timer_label')} note={t('settings_cow_timer_note')}
              control={<GavelSwitch icon={Timer} labelledBy="stg-cow" checked={s.cowTimerEnabled === true} onChange={(v) => upd('cowTimerEnabled', v)} />} />
            {s.cowTimerEnabled === true && (
              <SettingRow label={t('stg_cow_duration_label')} note={t('stg_cow_duration_note')}
                control={<ClockStepper label={t('stg_cow_duration_label')} unit={t('motions_sec')} value={s.cowTimerSeconds || 60} min={5} max={3600} step={15} arcMax={300}
                  presets={[30, 45, 60, 90, 120]} onCommit={(v) => upd('cowTimerSeconds', v)} />} />
            )}
          </>
        )}
      </Section>

      <Section icon={Gavel} title={t('settings_procedural_motions_heading')} hint={t('settings_procedural_motions_desc')} delay={40}>
        <div className="flex flex-col gap-2" style={{ padding: '12px 0' }}>
          {([
            { key: 'suspendDebate' as keyof MotionNames, defaultName: 'Suspend Debate', icon: Hourglass },
            { key: 'endDebate' as keyof MotionNames, defaultName: 'End Debate', icon: Gavel },
          ]).map(({ key, defaultName, icon: Icon }) => (
            <div key={key} className="flex items-center gap-3" style={{ padding: '4px 0' }}>
              <span aria-hidden className="shrink-0 inline-flex items-center justify-center" style={{ width: 34, height: 34, borderRadius: 11, background: K.dangerTint, color: K.danger }}>
                <Icon size={16} strokeWidth={2.3} />
              </span>
              <span className="flex-1 min-w-0">
                <InlineRename {...renameProps} defaultName={locName(key, defaultName)} resetValue={defaultName} value={s.motionNames[key] ?? defaultName}
                  onChange={(v) => upd('motionNames', { ...s.motionNames, [key]: v })} />
              </span>
              <HeatBars level={4} tone="red" />
              <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: K.muted, minWidth: 64, textAlign: 'end' }}>{t('stg_always_on')}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section icon={FileText} title={t('settings_documents_heading')} hint={t('stg_documents_hint')} lead delay={80}>
        <SettingRow first labelId="stg-docappr" label={t('settings_require_doc_approval')} note={t('settings_require_doc_approval_note')}
          control={<GavelSwitch glyph="lock" labelledBy="stg-docappr" checked={s.requireDocApproval} onChange={(v) => upd('requireDocApproval', v)} />} />
        <SettingRow label={t('settings_doc_names_label')} note={t('settings_doc_names_desc')}>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))' }}>
            {([
              { singular: 'workingPaper' as keyof DocumentNames, plural: 'workingPapers' as keyof DocumentNames, sd: t('documents_working_paper'), pd: t('documents_working_papers_tab'), tag: 'WP' },
              { singular: 'draftResolution' as keyof DocumentNames, plural: 'draftResolutions' as keyof DocumentNames, sd: t('documents_draft_resolution'), pd: t('documents_draft_resolutions_tab'), tag: 'DR' },
            ]).map((g) => {
              const limitKey = g.tag === 'WP' ? 'wpSubmissionLimit' as const : 'drSubmissionLimit' as const;
              const limit = typeof s[limitKey] === 'number' ? (s[limitKey] as number) : null;
              const stored = docNames[g.plural];
              const plural = stored && stored !== DEFAULT_DOCUMENT_NAMES[g.plural] ? stored : g.pd;
              return (
                <div key={g.tag} style={{ borderRadius: 16, background: K.ivory, boxShadow: K.inSm, padding: '12px 14px' }}>
                  {/* A folded-corner document tag. */}
                  <div className="flex items-center gap-2" style={{ marginBottom: 6 }}>
                    <span aria-hidden className="stg-num inline-flex items-center justify-center" style={{ height: 22, padding: '0 8px', borderRadius: '6px 10px 6px 6px', background: K.forest, color: K.gold, fontSize: 11, fontWeight: 900, letterSpacing: '0.06em' }}>{g.tag}</span>
                  </div>
                  {([
                    { key: g.singular, label: t('settings_doc_name_singular'), loc: g.sd },
                    { key: g.plural, label: t('settings_doc_name_plural'), loc: g.pd },
                  ]).map(({ key, label, loc }) => (
                    <div key={key} className="flex items-center gap-2" style={{ padding: '2px 0' }}>
                      <span style={{ width: 62, fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: K.muted }}>{label}</span>
                      <span className="flex-1 min-w-0">
                        <InlineRename {...renameProps} size={14} defaultName={loc} resetValue={DEFAULT_DOCUMENT_NAMES[key]} value={docNames[key] ?? DEFAULT_DOCUMENT_NAMES[key]}
                          onChange={(v) => upd('documentNames', { ...docNames, [key]: v })} />
                      </span>
                    </div>
                  ))}
                  <div className="flex flex-wrap items-center justify-between gap-2" style={{ marginTop: 8, paddingTop: 10, borderTop: `1px solid ${K.hair}` }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: K.inkSoft }}>
                      {limit === null ? t('stg_limit_none', { docs: plural }) : t('stg_limit_some', { n: limit, docs: plural })}
                    </span>
                    <LimitControl label={t('stg_limit_label', { docs: plural })} unlimitedLabel={t('stg_unlimited')} limitLabel={t('stg_set_limit')}
                      value={limit} onChange={(v) => upd(limitKey, v)} />
                  </div>
                </div>
              );
            })}
          </div>
        </SettingRow>
      </Section>
    </div>
  );
}
