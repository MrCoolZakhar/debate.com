'use client';

import { useRef, useState } from 'react';
import { ChevronDown, ChevronUp, FileText, Gavel, GripVertical, Hourglass, Infinity as InfinityIcon, ListOrdered, Sparkles, Timer } from 'lucide-react';
import { DEFAULT_DOCUMENT_NAMES, DEFAULT_MOTION_NAMES, type CommitteeSettings, type DocumentNames, type MotionNames } from '@/lib/settingsStore';
import { localizedMotionDefaults } from '@/lib/committeeFlags';
import { K, T, W, GLYPH, Section, SettingRow, GavelSwitch, ClockStepper, InlineRename, HoverHint, InfoHint, TallyStepper } from './settingsKit';
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

/** Four rising bars: how disruptive this rank is. Red-brown for the procedural motions. The
 *  words ("Disruptiveness 3 of 4") are its tooltip, not a printed caption. */
function HeatBars({ level, tone = 'gold', title, big = false }: { level: number; tone?: 'gold' | 'red' | 'off'; title?: string; big?: boolean }) {
  return (
    <span aria-hidden title={title} className="inline-flex items-end gap-[3px] shrink-0" style={{ height: big ? 22 : 18 }}>
      {[1, 2, 3, 4].map((l) => (
        <span key={l} style={{
          width: big ? 5 : 4, height: big ? 6 + l * 4 : 5 + l * 3, borderRadius: 2,
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
        style={{ height: 32, padding: '0 11px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: T.body, fontWeight: W.label,
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
      {/* Top: two columns (stacked when the dialog is narrow), the ranking alone on one side,
          the unranked motions on the other. Below: Documents across the whole page, its
          three parts side by side, so the tab fits on one screen (17 Sep 2026). */}
      <div className="stg-cols-2">
      <div className="min-w-0">
      <Section icon={ListOrdered} title={t('settings_motion_types_heading')} hint={t('stg_motion_types_hint')} lead>
        <p className="sr-only" aria-live="polite">{announce}</p>
        <ol style={{ listStyle: 'none', margin: 0, padding: '8px 0' }} className="flex flex-col gap-2">
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
                className="flex items-center gap-2"
                style={{
                  minHeight: 54, borderRadius: 14, padding: '6px 12px 6px 4px', background: enabled ? K.surface : 'rgba(237,231,216,0.6)',
                  boxShadow: over ? `0 0 0 2px ${K.deepGold}` : K.outSm, opacity: dragging ? 0.5 : 1,
                  transitionProperty: 'box-shadow, opacity', transitionDuration: '150ms',
                }}
              >
                <span aria-hidden className="shrink-0 inline-flex items-center justify-center" style={{ width: 20, color: '#B9AC97', cursor: 'grab' }}>
                  <GripVertical size={16} strokeWidth={2.2} />
                </span>
                {/* The rank, as a number and nothing else: no tile behind it. */}
                <span aria-hidden className="stg-num shrink-0 text-center" style={{
                  width: 24, fontSize: T.section, fontWeight: W.title, lineHeight: 1, color: i === 0 ? K.deepGold : 'rgba(27,56,40,0.55)',
                }}>{i + 1}</span>
                <span className="flex-1 min-w-0" style={{ opacity: enabled ? 1 : 0.6 }}>
                  <InlineRename {...renameProps} defaultName={locName(meta.namesKey, meta.defaultName)} resetValue={meta.defaultName} value={name}
                    onChange={(v) => upd('motionNames', { ...s.motionNames, [meta.namesKey]: v })} />
                </span>
                <HeatBars big level={4 - i} title={t('stg_disruptiveness', { n: 4 - i })} />
                <span className="shrink-0 inline-flex flex-col">
                  <button type="button" aria-label={t('stg_move_up', { name: shown })} disabled={i === 0} onClick={() => move(i, i - 1)}
                    className="stg-focus stg-press inline-flex items-center justify-center" style={{ width: 28, height: 20, border: 'none', background: 'transparent', color: K.forest, opacity: i === 0 ? 0.25 : 0.8, cursor: 'pointer', borderRadius: 6 }}>
                    <ChevronUp size={16} strokeWidth={2.6} />
                  </button>
                  <button type="button" aria-label={t('stg_move_down', { name: shown })} disabled={i === order.length - 1} onClick={() => move(i, i + 1)}
                    className="stg-focus stg-press inline-flex items-center justify-center" style={{ width: 28, height: 20, border: 'none', background: 'transparent', color: K.forest, opacity: i === order.length - 1 ? 0.25 : 0.8, cursor: 'pointer', borderRadius: 6 }}>
                    <ChevronDown size={16} strokeWidth={2.6} />
                  </button>
                </span>
                <GavelSwitch label={t('stg_motion_enabled', { name: shown })} checked={enabled}
                  onChange={(v) => upd(meta.enabledKey, v as CommitteeSettings[typeof meta.enabledKey])} />
              </li>
            );
          })}
        </ol>
      </Section>
      </div>

      <div className="min-w-0">
      <Section icon={Gavel} title={t('stg_other_motions')} hint={t('settings_procedural_motions_desc')} delay={40}>
        {/* Custom motions: outside the ranking on purpose (no motionOrder position). */}
        <div className="flex items-center gap-3" style={{ minHeight: 58, padding: '8px 0' }}>
          <Sparkles aria-hidden size={18} strokeWidth={2.3} className="shrink-0" style={{ color: GLYPH.amber }} />
          <span className="flex-1 min-w-0">
            <InlineRename {...renameProps} defaultName={locName('custom', DEFAULT_MOTION_NAMES.custom)} resetValue={DEFAULT_MOTION_NAMES.custom}
              value={s.motionNames.custom ?? DEFAULT_MOTION_NAMES.custom} onChange={(v) => upd('motionNames', { ...s.motionNames, custom: v })} />
          </span>
          <HoverHint text={t('stg_custom_motion_hint')}><span style={{ fontSize: T.caption, fontWeight: W.label, color: K.inkSoft }}>{t('stg_unranked')}</span></HoverHint>
          <GavelSwitch label={t('stg_motion_enabled', { name: locName('custom', DEFAULT_MOTION_NAMES.custom) })}
            checked={s.motionCustom !== false} onChange={(v) => upd('motionCustom', v)} />
        </div>

        {([
          { key: 'suspendDebate' as keyof MotionNames, defaultName: 'Suspend Debate', icon: Hourglass },
          { key: 'endDebate' as keyof MotionNames, defaultName: 'End Debate', icon: Gavel },
        ]).map(({ key, defaultName, icon: Icon }) => (
          <div key={key} className="flex items-center gap-3" style={{ minHeight: 58, padding: '8px 0', borderTop: `1px solid ${K.hair}` }}>
            <Icon aria-hidden size={18} strokeWidth={2.3} className="shrink-0" style={{ color: GLYPH.danger }} />
            <span className="flex-1 min-w-0">
              <InlineRename {...renameProps} defaultName={locName(key, defaultName)} resetValue={defaultName} value={s.motionNames[key] ?? defaultName}
                onChange={(v) => upd('motionNames', { ...s.motionNames, [key]: v })} />
            </span>
            <HeatBars big level={4} tone="red" />
            <span style={{ fontSize: T.caption, fontWeight: W.label, color: K.inkSoft, minWidth: 56, textAlign: 'end' }}>{t('stg_always_on')}</span>
          </div>
        ))}

        {s.motionCoW !== false && (
          <>
            <SettingRow labelId="stg-cow" label={t('settings_cow_timer_label')} hint={t('settings_cow_timer_note')}
              control={<GavelSwitch icon={Timer} labelledBy="stg-cow" checked={s.cowTimerEnabled === true} onChange={(v) => upd('cowTimerEnabled', v)} />} />
            {s.cowTimerEnabled === true && (
              <SettingRow dense label={t('stg_cow_duration_label')} hint={t('stg_cow_duration_note')}>
                <ClockStepper label={t('stg_cow_duration_label')} unit={t('motions_sec')} value={s.cowTimerSeconds || 60} min={5} max={3600} step={15} arcMax={300}
                  presets={[30, 45, 60, 90, 120]} onCommit={(v) => upd('cowTimerSeconds', v)} />
              </SettingRow>
            )}
          </>
        )}
      </Section>
      </div>
      </div>

      <Section icon={FileText} title={t('settings_documents_heading')} hint={t('stg_documents_hint')} lead delay={80}
        aside={(
          <span className="inline-flex items-center gap-1.5 shrink-0">
            <span style={{ fontSize: T.caption, fontWeight: W.label, color: K.inkSoft }}>{t('settings_doc_names_label')}</span>
            <InfoHint text={t('settings_doc_names_desc')} />
          </span>
        )}>
        <div className="stg-docs" style={{ padding: '12px 0' }}>
          {([
            { singular: 'workingPaper' as keyof DocumentNames, plural: 'workingPapers' as keyof DocumentNames, sd: t('documents_working_paper'), pd: t('documents_working_papers_tab'), tag: 'WP' },
            { singular: 'draftResolution' as keyof DocumentNames, plural: 'draftResolutions' as keyof DocumentNames, sd: t('documents_draft_resolution'), pd: t('documents_draft_resolutions_tab'), tag: 'DR' },
          ]).map((g) => {
            const limitKey = g.tag === 'WP' ? 'wpSubmissionLimit' as const : 'drSubmissionLimit' as const;
            const limit = typeof s[limitKey] === 'number' ? (s[limitKey] as number) : null;
            const stored = docNames[g.plural];
            const plural = stored && stored !== DEFAULT_DOCUMENT_NAMES[g.plural] ? stored : g.pd;
            return (
              <div key={g.tag} className="flex flex-col min-w-0" style={{ borderRadius: 14, background: K.ivory, boxShadow: K.inSm, padding: '10px 12px' }}>
                {/* A folded-corner document tag beside the two names, not on a row of its own. */}
                <div className="flex items-start gap-2.5">
                <span aria-hidden className="stg-num inline-flex items-center justify-center shrink-0" style={{ marginTop: 5, height: 20, padding: '0 7px', borderRadius: '6px 10px 6px 6px', background: K.forest, color: K.gold, fontSize: T.caption, fontWeight: W.section, letterSpacing: '0.06em' }}>{g.tag}</span>
                <div className="flex-1 min-w-0">
                {([
                  { key: g.singular, label: t('settings_doc_name_singular'), loc: g.sd },
                  { key: g.plural, label: t('settings_doc_name_plural'), loc: g.pd },
                ]).map(({ key, label, loc }) => (
                  <div key={key} className="flex items-center gap-2" style={{ padding: '2px 0' }}>
                    <span className="shrink-0" style={{ width: 58, fontSize: T.caption, fontWeight: W.label, color: K.inkSoft }}>{label}</span>
                    <span className="flex-1 min-w-0">
                      <InlineRename {...renameProps} defaultName={loc} resetValue={DEFAULT_DOCUMENT_NAMES[key]} value={docNames[key] ?? DEFAULT_DOCUMENT_NAMES[key]}
                        onChange={(v) => upd('documentNames', { ...docNames, [key]: v })} />
                    </span>
                  </div>
                ))}
                </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 mt-auto" style={{ paddingTop: 8, borderTop: `1px solid ${K.hair}` }}>
                  <span className="min-w-0" style={{ fontSize: T.caption, fontWeight: W.label, color: K.inkSoft }}>{t('stg_limit_label', { docs: plural })}</span>
                  <LimitControl label={t('stg_limit_label', { docs: plural })} unlimitedLabel={t('stg_unlimited')} limitLabel={t('stg_set_limit')}
                    value={limit} onChange={(v) => upd(limitKey, v)} />
                </div>
              </div>
            );
          })}
          <div className="min-w-0">
            <SettingRow first dense labelId="stg-docappr" label={t('settings_require_doc_approval')} hint={t('settings_require_doc_approval_note')}
              control={<GavelSwitch glyph="lock" labelledBy="stg-docappr" checked={s.requireDocApproval} onChange={(v) => upd('requireDocApproval', v)} />} />
            {/* The word for the delegations behind a paper (moved here from Access: it is a
                documents word). Read everywhere through sponsorLabel(committee, fallback). */}
            <SettingRow dense htmlFor="stg-sponsor" label={t('stg_sponsor_label')} hint={t('stg_sponsor_note')}>
              <input
                id="stg-sponsor"
                type="text"
                value={s.sponsorLabel}
                placeholder={t('stg_sponsor_placeholder')}
                onChange={(e) => upd('sponsorLabel', e.target.value)}
                className="stg-focus"
                style={{ height: 34, width: '100%', borderRadius: 10, border: 'none', padding: '0 12px', fontSize: T.body, fontWeight: W.label, color: K.ink, background: K.ivory, boxShadow: K.inSm, fontFamily: K.font }}
              />
            </SettingRow>
          </div>
        </div>
      </Section>
    </div>
  );
}
