'use client';

import { Blend, Coins, Plus, Star, Trash2 } from 'lucide-react';
import type { RankingFactor, ScoreSource } from '@/lib/settingsStore';
import { factorName, sourceName } from '@/lib/scoringNames';
import { K, Section, SettingRow, GavelSwitch, NotchDial, TallyStepper } from './settingsKit';
import type { TabProps } from './settingsTypes';

/** The blend as a split ring: forest = objective points, gold = quality ratings, with a
 *  worked example underneath so a chair sees what the number does to a real headline. */
function BlendRing({ blend, t }: { blend: number; t: TabProps['t'] }) {
  const R = 44;
  const C = 2 * Math.PI * R;
  const q = blend / 100;
  // Worked example: 80% of the committee's top points total, and a 6 out of 10 quality mark.
  const objective = 80;
  const quality = 60;
  const headline = Math.round(objective * (1 - q) + quality * q);
  return (
    <div className="flex flex-wrap items-center gap-5" style={{ padding: '10px 0 2px' }}>
      <svg width="96" height="96" viewBox="0 0 116 116" role="img" aria-label={t('stg_blend_aria', { objective: 100 - blend, quality: blend })}>
        <circle cx="58" cy="58" r={R} fill="none" stroke="rgba(27,56,40,0.08)" strokeWidth="14" />
        <circle cx="58" cy="58" r={R} fill="none" stroke={K.forest} strokeWidth="14" strokeDasharray={`${C * (1 - q)} ${C}`} transform="rotate(-90 58 58)"
          style={{ transitionProperty: 'stroke-dasharray', transitionDuration: '220ms' }} />
        <circle cx="58" cy="58" r={R} fill="none" stroke={K.deepGold} strokeWidth="14" strokeDasharray={`${C * q} ${C}`} strokeDashoffset={-C * (1 - q)} transform="rotate(-90 58 58)"
          style={{ transitionProperty: 'stroke-dasharray, stroke-dashoffset', transitionDuration: '220ms' }} />
        <text x="58" y="55" textAnchor="middle" style={{ fontFamily: K.font, fontSize: 22, fontWeight: 900, fill: K.ink, fontVariantNumeric: 'tabular-nums' }}>{100 - blend}</text>
        <text x="58" y="73" textAnchor="middle" style={{ fontFamily: K.font, fontSize: 11, fontWeight: 800, fill: K.deepGold, fontVariantNumeric: 'tabular-nums' }}>{blend}</text>
      </svg>
      <div className="flex-1" style={{ minWidth: 220 }}>
        <div className="flex items-center gap-4" style={{ marginBottom: 10 }}>
          <span className="inline-flex items-center gap-1.5" style={{ fontSize: 12.5, fontWeight: 800, color: K.forest }}>
            <span aria-hidden style={{ width: 10, height: 10, borderRadius: 3, background: K.forest }} />{t('settings_points_blend_objective')} {100 - blend}%
          </span>
          <span className="inline-flex items-center gap-1.5" style={{ fontSize: 12.5, fontWeight: 800, color: '#8A6415' }}>
            <span aria-hidden style={{ width: 10, height: 10, borderRadius: 3, background: K.deepGold }} />{t('settings_points_blend_quality')} {blend}%
          </span>
        </div>
        {/* Worked example as three bars. */}
        {([
          { label: t('stg_blend_example_points'), v: objective, color: K.forest },
          { label: t('stg_blend_example_quality'), v: quality, color: K.deepGold },
          { label: t('stg_blend_example_headline'), v: headline, color: `linear-gradient(90deg, ${K.forest}, ${K.deepGold})`, strong: true },
        ]).map((b) => (
          <div key={b.label} className="flex items-center gap-3" style={{ marginTop: 6 }}>
            <span style={{ width: 118, fontSize: 12, fontWeight: b.strong ? 800 : 600, color: b.strong ? K.ink : K.inkSoft }}>{b.label}</span>
            <span className="flex-1 relative" style={{ height: 10, borderRadius: 999, background: 'rgba(27,56,40,0.08)' }}>
              <span className="absolute" style={{ insetBlock: 0, insetInlineStart: 0, width: `${b.v}%`, borderRadius: 999, background: b.color, transitionProperty: 'width', transitionDuration: '220ms' }} />
            </span>
            <span className="stg-num" style={{ width: 28, textAlign: 'end', fontSize: 12.5, fontWeight: 800, color: K.ink }}>{b.v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="stg-focus stg-press inline-flex items-center gap-1.5"
      style={{ height: 34, padding: '0 12px', borderRadius: 10, border: 'none', background: 'transparent', color: K.forest, fontSize: 12.5, fontWeight: 800, cursor: 'pointer', boxShadow: 'inset 0 0 0 1.5px rgba(27,56,40,0.22)' }}>
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
    <div style={dim} aria-disabled={isViewOnly || undefined}>
      {/* Two columns: the nine built-in sources are a long list and a chair needs to see the
          shape of the ledger, not scroll it. Custom sources a committee already stores still
          render here (name, points, enable, remove); there is no way to create a new one, and
          nothing stored was migrated - CREATING one only ever produced a source no session
          surface could award, so the ledger row could never be written. */}
      <Section icon={Coins} title={t('settings_points_sources_heading')} hint={t('settings_points_sources_desc')} lead>
        <ul className="grid" style={{ listStyle: 'none', margin: 0, padding: '6px 0', gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))', columnGap: 24 }}>
          {scoring.sources.map((src) => {
            const label = src.builtin ? sourceName(src, language) : src.name;
            return (
              <li key={src.id} className="flex flex-wrap items-center gap-2.5" style={{ padding: '7px 0', borderTop: `1px solid ${K.hair}`, opacity: src.enabled ? 1 : 0.55 }}>
                <span className="min-w-0" style={{ flex: '1 1 140px' }}>
                  {src.builtin ? (
                    <span className="block truncate" style={{ fontSize: 13.5, fontWeight: 700, color: K.ink }}>{label}</span>
                  ) : (
                    <input value={src.name} aria-label={t('stg_source_name')} onChange={(e) => setSource(src.id, { name: e.target.value })}
                      className="stg-focus w-full" style={{ fontSize: 13.5, fontWeight: 700, color: K.ink, background: K.ivory, border: 'none', borderRadius: 8, padding: '4px 8px', boxShadow: K.inSm, fontFamily: K.font }} />
                  )}
                  {/* Relative weight bar: this source against the heaviest enabled one. */}
                  <span aria-hidden className="block relative" style={{ marginTop: 4, height: 4, borderRadius: 4, background: 'rgba(27,56,40,0.07)', maxWidth: 200 }}>
                    <span className="absolute" style={{ insetBlock: 0, insetInlineStart: 0, borderRadius: 4, width: `${src.enabled ? Math.min(100, (Math.abs(src.value) / maxValue) * 100) : 0}%`, background: src.value < 0 ? K.danger : K.deepGold, transitionProperty: 'width', transitionDuration: '200ms' }} />
                  </span>
                </span>
                <TallyStepper label={t('stg_points_for', { name: label })} suffix={t('settings_points_pts_suffix')} value={src.value} min={-99} max={999} onChange={(v) => setSource(src.id, { value: v })} />
                <GavelSwitch size="sm" label={t('stg_source_enabled', { name: label })} checked={src.enabled} onChange={(v) => setSource(src.id, { enabled: v })} />
                {!src.builtin ? (
                  <button type="button" aria-label={t('stg_remove_named', { name: label })} onClick={() => updScoring({ ...scoring, sources: scoring.sources.filter((x) => x.id !== src.id) })}
                    className="stg-focus stg-press inline-flex items-center justify-center" style={{ width: 28, height: 28, borderRadius: 9, border: 'none', background: 'transparent', color: K.muted, cursor: 'pointer' }}>
                    <Trash2 size={14} strokeWidth={2.2} />
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      </Section>

      <Section icon={Star} title={t('settings_points_factors_heading')} delay={40}>
        <SettingRow first labelId="stg-rate" label={t('settings_points_rate_label')} note={t('settings_points_rate_note')}
          control={<GavelSwitch icon={Star} labelledBy="stg-rate" checked={scoring.factorRatingsEnabled} onChange={(v) => updScoring({ ...scoring, factorRatingsEnabled: v })} />} />
        {scoring.factorRatingsEnabled && (
          <>
            <div style={{ padding: '2px 0 10px', borderTop: `1px solid ${K.hair}` }}>
              <p className="stg-body" style={{ margin: '8px 0 8px', fontSize: 12, color: K.inkSoft }}>{t('settings_points_factors_desc', { max: scoring.factorScaleMax })}</p>
              <div className="flex flex-wrap gap-2">
                {scoring.factors.map((f) => (
                  <span key={f.id} className="inline-flex items-center gap-2" style={{ padding: '4px 4px 4px 12px', borderRadius: 999, background: f.enabled ? K.surface : 'transparent', boxShadow: f.enabled ? K.outSm : 'inset 0 0 0 1px rgba(28,20,16,0.12)' }}>
                    <input value={factorName(f, language)} aria-label={t('stg_factor_name')} onChange={(e) => setFactor(f.id, { name: e.target.value })}
                      className="stg-focus" style={{ width: `${Math.max(6, factorName(f, language).length + 1)}ch`, maxWidth: 200, fontSize: 13.5, fontWeight: 700, color: K.ink, background: 'transparent', border: 'none', borderRadius: 6, fontFamily: K.font }} />
                    <GavelSwitch size="sm" label={t('stg_factor_enabled', { name: factorName(f, language) })} checked={f.enabled} onChange={(v) => setFactor(f.id, { enabled: v })} />
                    <button type="button" aria-label={t('stg_remove_named', { name: factorName(f, language) })} onClick={() => updScoring({ ...scoring, factors: scoring.factors.filter((x) => x.id !== f.id) })}
                      className="stg-focus stg-press inline-flex items-center justify-center" style={{ width: 28, height: 28, borderRadius: 999, border: 'none', background: 'transparent', color: K.muted, cursor: 'pointer' }}>
                      <Trash2 size={13} strokeWidth={2.2} />
                    </button>
                  </span>
                ))}
                <AddButton label={t('settings_points_add_factor')} onClick={() => updScoring({ ...scoring, factors: [...scoring.factors, { id: `factor-${Date.now()}`, name: 'New factor', enabled: true }] })} />
              </div>
            </div>
            <SettingRow label={t('settings_points_scale_max')} note={t('stg_scale_note')}>
              {/* Floor of 2: a one-point scale is not a rating. */}
              <NotchDial label={t('settings_points_scale_max')} value={scoring.factorScaleMax} min={2} max={100} notches={33}
                onChange={(v) => updScoring({ ...scoring, factorScaleMax: v })} valueText={(v) => `0-${v}`} startLabel="2" endLabel="100" />
            </SettingRow>
          </>
        )}
      </Section>

      <Section icon={Blend} title={t('settings_points_blend_heading')} hint={t('stg_blend_hint')} lead delay={80}>
        <BlendRing blend={scoring.scoreBlend} t={t} />
        <div style={{ padding: '0 0 12px' }}>
          <NotchDial label={t('settings_points_blend_heading')} value={scoring.scoreBlend} min={0} max={100} notches={41} tone="split"
            onChange={(v) => updScoring({ ...scoring, scoreBlend: v })}
            valueText={(v) => `${100 - v} / ${v}`} startLabel={t('settings_points_blend_objective')} endLabel={t('settings_points_blend_quality')} />
        </div>
      </Section>
    </div>
  );
}
