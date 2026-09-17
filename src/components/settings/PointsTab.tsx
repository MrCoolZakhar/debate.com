'use client';

import { Blend, Coins, Plus, Star, Trash2 } from 'lucide-react';
import type { RankingFactor, ScoreSource } from '@/lib/settingsStore';
import { factorName, sourceName } from '@/lib/scoringNames';
import { K, T, W, Section, SettingRow, GavelSwitch, NotchDial, TallyStepper } from './settingsKit';
import type { TabProps } from './settingsTypes';

/** The blend as a split ring: forest = objective points, gold = quality ratings, with a
 *  worked example underneath so a chair sees what the number does to a real headline. */
function BlendRing({ blend, t }: { blend: number; t: TabProps['t'] }) {
  const R = 46;
  const C = 2 * Math.PI * R;
  const q = blend / 100;
  // Worked example: 80% of the committee's top points total, and a 6 out of 10 quality mark.
  const objective = 80;
  const quality = 60;
  const headline = Math.round(objective * (1 - q) + quality * q);
  return (
    <div className="flex flex-col items-center" style={{ padding: '14px 0 4px' }}>
      <svg width="168" height="168" viewBox="0 0 116 116" role="img" aria-label={t('stg_blend_aria', { objective: 100 - blend, quality: blend })}>
        <circle cx="58" cy="58" r={R} fill="none" stroke="rgba(27,56,40,0.08)" strokeWidth="12" />
        <circle cx="58" cy="58" r={R} fill="none" stroke={K.forest} strokeWidth="12" strokeDasharray={`${C * (1 - q)} ${C}`} transform="rotate(-90 58 58)"
          style={{ transitionProperty: 'stroke-dasharray', transitionDuration: '220ms' }} />
        <circle cx="58" cy="58" r={R} fill="none" stroke={K.deepGold} strokeWidth="12" strokeDasharray={`${C * q} ${C}`} strokeDashoffset={-C * (1 - q)} transform="rotate(-90 58 58)"
          style={{ transitionProperty: 'stroke-dasharray, stroke-dashoffset', transitionDuration: '220ms' }} />
        <text x="58" y="58" textAnchor="middle" style={{ fontFamily: K.font, fontSize: T.section, fontWeight: W.title, fill: K.forest, fontVariantNumeric: 'tabular-nums' }}>{100 - blend}</text>
        <text x="58" y="76" textAnchor="middle" style={{ fontFamily: K.font, fontSize: T.body, fontWeight: W.section, fill: '#7A5812', fontVariantNumeric: 'tabular-nums' }}>{blend}</text>
      </svg>
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1" style={{ marginTop: 8 }}>
        <span className="inline-flex items-center gap-1.5 stg-num" style={{ fontSize: T.body, fontWeight: W.label, color: K.forest }}>
          <span aria-hidden style={{ width: 10, height: 10, borderRadius: 3, background: K.forest }} />{t('settings_points_blend_objective')} {100 - blend}%
        </span>
        <span className="inline-flex items-center gap-1.5 stg-num" style={{ fontSize: T.body, fontWeight: W.label, color: '#7A5812' }}>
          <span aria-hidden style={{ width: 10, height: 10, borderRadius: 3, background: K.deepGold }} />{t('settings_points_blend_quality')} {blend}%
        </span>
      </div>
      {/* Worked example as three bars. */}
      <div className="w-full" style={{ marginTop: 12 }}>
        {([
          { label: t('stg_blend_example_points'), v: objective, color: K.forest },
          { label: t('stg_blend_example_quality'), v: quality, color: K.deepGold },
          { label: t('stg_blend_example_headline'), v: headline, color: `linear-gradient(90deg, ${K.forest}, ${K.deepGold})`, strong: true },
        ]).map((b) => (
          <div key={b.label} className="flex items-center gap-2.5" style={{ marginTop: 6 }}>
            <span className="truncate" style={{ width: 96, fontSize: T.caption, fontWeight: b.strong ? W.section : W.label, color: b.strong ? K.ink : K.inkSoft }}>{b.label}</span>
            <span className="flex-1 relative" style={{ height: 10, borderRadius: 999, background: 'rgba(27,56,40,0.08)' }}>
              <span className="absolute" style={{ insetBlock: 0, insetInlineStart: 0, width: `${b.v}%`, borderRadius: 999, background: b.color, transitionProperty: 'width', transitionDuration: '220ms' }} />
            </span>
            <span className="stg-num" style={{ width: 24, textAlign: 'end', fontSize: T.body, fontWeight: W.section, color: K.ink }}>{b.v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="stg-focus stg-press inline-flex items-center gap-1.5"
      style={{ height: 34, padding: '0 12px', borderRadius: 10, border: 'none', background: 'transparent', color: K.forest, fontSize: T.body, fontWeight: W.label, cursor: 'pointer', boxShadow: 'inset 0 0 0 1.5px rgba(27,56,40,0.22)' }}>
      <Plus size={14} strokeWidth={2.6} aria-hidden />{label.replace(/^\+\s*/, '')}
    </button>
  );
}

export default function PointsTab({ scoring, updScoring, t, language, isViewOnly }: TabProps) {
  const dim = isViewOnly ? { opacity: 0.55, pointerEvents: 'none' as const } : undefined;
  const setSource = (id: string, patch: Partial<ScoreSource>) =>
    updScoring({ ...scoring, sources: scoring.sources.map((x) => (x.id === id ? { ...x, ...patch } : x)) });
  const setFactor = (id: string, patch: Partial<RankingFactor>) =>
    updScoring({ ...scoring, factors: scoring.factors.map((x) => (x.id === id ? { ...x, ...patch } : x)) });
  const maxValue = Math.max(1, ...scoring.sources.filter((x) => x.enabled).map((x) => Math.abs(x.value)));

  return (
    <div style={dim} aria-disabled={isViewOnly || undefined} className="stg-cols-3">
      {/* Three columns (stacked when the page is narrow): the quantitative ledger on one
          side, the qualitative ratings on the other, and the blend that decides how the two
          make a headline score in the middle, where it is the first thing a chair reads.
          Custom sources a committee already stores still render (name, points, enable,
          remove); there is no way to create a new one. */}
      <div className="min-w-0">
      <Section icon={Coins} title={t('settings_points_sources_heading')} hint={t('settings_points_sources_desc')}>
        <ul style={{ listStyle: 'none', margin: 0, padding: '4px 0' }}>
          {scoring.sources.map((src, i) => {
            const label = src.builtin ? sourceName(src, language) : src.name;
            return (
              <li key={src.id} style={{ padding: '8px 0', borderTop: i === 0 ? 'none' : `1px solid ${K.hair}`, opacity: src.enabled ? 1 : 0.55 }}>
                <div className="flex items-center gap-2">
                  {src.builtin ? (
                    <span className="flex-1 min-w-0 truncate" title={label} style={{ fontSize: T.body, fontWeight: W.label, color: K.ink }}>{label}</span>
                  ) : (
                    <input value={src.name} aria-label={t('stg_source_name')} onChange={(e) => setSource(src.id, { name: e.target.value })}
                      className="stg-focus flex-1 min-w-0" style={{ fontSize: T.body, fontWeight: W.label, color: K.ink, background: K.ivory, border: 'none', borderRadius: 8, padding: '4px 8px', boxShadow: K.inSm, fontFamily: K.font }} />
                  )}
                  {!src.builtin && (
                    <button type="button" aria-label={t('stg_remove_named', { name: label })} onClick={() => updScoring({ ...scoring, sources: scoring.sources.filter((x) => x.id !== src.id) })}
                      className="stg-focus stg-press inline-flex items-center justify-center shrink-0" style={{ width: 26, height: 26, borderRadius: 8, border: 'none', background: 'transparent', color: K.inkSoft, cursor: 'pointer' }}>
                      <Trash2 size={13} strokeWidth={2.2} />
                    </button>
                  )}
                  <GavelSwitch size="sm" label={t('stg_source_enabled', { name: label })} checked={src.enabled} onChange={(v) => setSource(src.id, { enabled: v })} />
                </div>
                <div className="flex items-center gap-2.5" style={{ marginTop: 5 }}>
                  {/* Relative weight bar: this source against the heaviest enabled one. */}
                  <span aria-hidden className="flex-1 relative" style={{ height: 4, borderRadius: 4, background: 'rgba(27,56,40,0.07)' }}>
                    <span className="absolute" style={{ insetBlock: 0, insetInlineStart: 0, borderRadius: 4, width: `${src.enabled ? Math.min(100, (Math.abs(src.value) / maxValue) * 100) : 0}%`, background: src.value < 0 ? K.danger : K.deepGold, transitionProperty: 'width', transitionDuration: '200ms' }} />
                  </span>
                  <TallyStepper label={t('stg_points_for', { name: label })} suffix={t('settings_points_pts_suffix')} value={src.value} min={-99} max={999} onChange={(v) => setSource(src.id, { value: v })} />
                </div>
              </li>
            );
          })}
        </ul>
      </Section>
      </div>

      <div className="min-w-0">
      <Section icon={Blend} title={t('settings_points_blend_heading')} hint={t('stg_blend_hint')} lead delay={40}>
        <BlendRing blend={scoring.scoreBlend} t={t} />
        <div style={{ padding: '0 0 14px' }}>
          <NotchDial label={t('settings_points_blend_heading')} value={scoring.scoreBlend} min={0} max={100} notches={25} tone="split"
            onChange={(v) => updScoring({ ...scoring, scoreBlend: v })}
            valueText={(v) => `${100 - v} / ${v}`} startLabel={t('settings_points_blend_objective')} endLabel={t('settings_points_blend_quality')} />
        </div>
      </Section>
      </div>

      <div className="min-w-0">
      <Section icon={Star} title={t('settings_points_factors_heading')} hint={t('settings_points_factors_desc', { max: scoring.factorScaleMax })} delay={80}>
        <SettingRow first dense labelId="stg-rate" label={t('settings_points_rate_label')} hint={t('settings_points_rate_note')}
          control={<GavelSwitch size="sm" icon={Star} labelledBy="stg-rate" checked={scoring.factorRatingsEnabled} onChange={(v) => updScoring({ ...scoring, factorRatingsEnabled: v })} />} />
        {scoring.factorRatingsEnabled && (
          <>
            <div style={{ padding: '2px 0 10px', borderTop: `1px solid ${K.hair}` }}>
              <div className="flex flex-col gap-1.5" style={{ paddingTop: 10 }}>
                {scoring.factors.map((f) => (
                  <span key={f.id} className="flex items-center gap-1.5" style={{ padding: '3px 3px 3px 10px', borderRadius: 12, background: f.enabled ? K.surface : 'transparent', boxShadow: f.enabled ? K.outSm : 'inset 0 0 0 1px rgba(28,20,16,0.12)' }}>
                    <input value={factorName(f, language)} aria-label={t('stg_factor_name')} onChange={(e) => setFactor(f.id, { name: e.target.value })}
                      className="stg-focus flex-1 min-w-0" style={{ fontSize: T.body, fontWeight: W.label, color: K.ink, background: 'transparent', border: 'none', borderRadius: 6, padding: '4px 2px', fontFamily: K.font }} />
                    <GavelSwitch size="sm" label={t('stg_factor_enabled', { name: factorName(f, language) })} checked={f.enabled} onChange={(v) => setFactor(f.id, { enabled: v })} />
                    <button type="button" aria-label={t('stg_remove_named', { name: factorName(f, language) })} onClick={() => updScoring({ ...scoring, factors: scoring.factors.filter((x) => x.id !== f.id) })}
                      className="stg-focus stg-press inline-flex items-center justify-center shrink-0" style={{ width: 28, height: 28, borderRadius: 999, border: 'none', background: 'transparent', color: K.inkSoft, cursor: 'pointer' }}>
                      <Trash2 size={13} strokeWidth={2.2} />
                    </button>
                  </span>
                ))}
                <span><AddButton label={t('settings_points_add_factor')} onClick={() => updScoring({ ...scoring, factors: [...scoring.factors, { id: `factor-${Date.now()}`, name: 'New factor', enabled: true }] })} /></span>
              </div>
            </div>
            <SettingRow label={t('settings_points_scale_max')} hint={t('stg_scale_note')}>
              {/* Floor of 2: a one-point scale is not a rating. */}
              <NotchDial label={t('settings_points_scale_max')} value={scoring.factorScaleMax} min={2} max={100} notches={17}
                onChange={(v) => updScoring({ ...scoring, factorScaleMax: v })} valueText={(v) => `0-${v}`} startLabel="2" endLabel="100" />
            </SettingRow>
          </>
        )}
      </Section>
      </div>
    </div>
  );
}
