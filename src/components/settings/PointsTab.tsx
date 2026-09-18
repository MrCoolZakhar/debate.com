'use client';

import { useLayoutEffect, useRef } from 'react';
import { Blend, Calculator, Plus, Star, Trash2 } from 'lucide-react';
import type { RankingFactor, ScoreSource } from '@/lib/settingsStore';
import { factorName, sourceName } from '@/lib/scoringNames';
import { K, T, W, ACCENT_VAR, Section, SettingRow, GavelSwitch, NotchDial, TallyStepper } from './settingsKit';
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
    <div className="flex flex-col items-center" style={{ padding: '4px 0 4px' }}>
      <svg data-orbit-ring width="208" height="208" viewBox="0 0 116 116" role="img" aria-label={t('stg_blend_aria', { objective: 100 - blend, quality: blend })}>
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

/**
 * Sets the rows on either side of the blend ring along a circle around it.
 *
 * Every row on a side keeps one width (the column less `DEPTH`, less when the column is too
 * narrow to spare it) and slides across that `DEPTH` along an arc centred on the ring's
 * centre: the row level with the ring sits furthest out, where the ring is widest, and the
 * rows above and below lean in towards it as the ring narrows, so each list reads as a
 * crescent around the graph. The arc is sized to span the rows it finds, so a long list (the
 * score sources, any number of them) is a gentle curve and a short one (the quality factors)
 * a tight one. The shift is a pair of logical margins (RTL mirrors itself) written straight
 * to the node: no React state, nothing per frame, re-placed only when the orbit or a list
 * changes size. Stacked (a narrow page), every margin is cleared.
 */
const DEPTH = 76;
/** A row never gets narrower than this, whatever the arc asks for. */
const ROW_MIN = 236;
function useOrbitArc() {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const orbit = ref.current;
    if (!orbit) return;
    let raf = 0;
    const set = (row: HTMLElement, prop: 'marginInlineStart' | 'marginInlineEnd', px: number) => {
      const v = px > 0 ? `${px}px` : '';
      if (row.style[prop] !== v) row.style[prop] = v;
    };
    const place = () => {
      raf = 0;
      const ring = orbit.querySelector<SVGElement>('[data-orbit-ring]');
      const rows = Array.from(orbit.querySelectorAll<HTMLElement>('[data-orbit]'));
      const wide = !!ring && getComputedStyle(orbit).gridTemplateColumns.trim().split(/\s+/).length === 3;
      if (!wide) { rows.forEach((r) => { set(r, 'marginInlineStart', 0); set(r, 'marginInlineEnd', 0); }); return; }
      // FitToScreen draws the dialog inside scale(): rects are screen px, margins layout px.
      const scale = orbit.getBoundingClientRect().width / (orbit.offsetWidth || 1) || 1;
      const rr = ring.getBoundingClientRect();
      const cy = rr.top + rr.height / 2;
      (['start', 'end'] as const).forEach((side) => {
        const mine = rows.filter((r) => r.dataset.orbit === side);
        if (mine.length === 0) return;
        // `inner` faces the ring, `outer` the page edge.
        const inner = side === 'start' ? 'marginInlineEnd' : 'marginInlineStart';
        const outer = side === 'start' ? 'marginInlineStart' : 'marginInlineEnd';
        const colWidth = (mine[0].parentElement?.clientWidth ?? 0);
        const depth = Math.max(0, Math.min(DEPTH, colWidth - ROW_MIN));
        if (depth === 0) { mine.forEach((r) => { set(r, inner, 0); set(r, outer, 0); }); return; }
        const dys = mine.map((r) => { const b = r.getBoundingClientRect(); return (b.top + b.height / 2 - cy) / scale; });
        const span = Math.max(...dys.map(Math.abs), 1);
        // The circle through (span, 0) and (0, depth) in (dy, push-out) space.
        const radius = (span * span + depth * depth) / (2 * depth);
        mine.forEach((r, k) => {
          const dy = Math.min(Math.abs(dys[k]), radius);
          const out = Math.max(0, Math.min(depth, Math.round(Math.sqrt(radius * radius - dy * dy) - (radius - depth))));
          set(r, inner, out);
          set(r, outer, depth - out);
        });
      });
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(place); };
    place();
    const ro = new ResizeObserver(schedule);
    ro.observe(orbit);
    orbit.querySelectorAll('[data-orbit-list]').forEach((el) => ro.observe(el));
    // A row added or removed (a factor, a source) changes a list's children.
    const mo = new MutationObserver(() => {
      orbit.querySelectorAll('[data-orbit-list]').forEach((el) => ro.observe(el));
      schedule();
    });
    mo.observe(orbit, { childList: true, subtree: true });
    void document.fonts?.ready.then(schedule);
    return () => { ro.disconnect(); mo.disconnect(); if (raf) cancelAnimationFrame(raf); };
  }, []);
  return ref;
}

/** One row of the orbit: its own quiet plate, and a small bead on the edge that faces the
 *  ring, lit in the tab's hue while the row counts. */
function OrbitRow({ side, on, children, as = 'div' }: { side: 'start' | 'end'; on: boolean; children: React.ReactNode; as?: 'div' | 'li' }) {
  const Tag = as;
  return (
    <Tag data-orbit={side} className="relative" style={{
      padding: '8px 12px', borderRadius: 14,
      background: on ? K.surface : 'transparent',
      boxShadow: on ? '0 0 0 1px rgba(27,56,40,0.06), 0 1px 2px rgba(27,56,40,0.05), 0 6px 16px -12px rgba(27,56,40,0.22)' : 'inset 0 0 0 1px rgba(28,20,16,0.08)',
    }}>
      <span aria-hidden className="absolute" style={{
        top: '50%', marginTop: -3.5, width: 7, height: 7, borderRadius: 7,
        [side === 'start' ? 'insetInlineEnd' : 'insetInlineStart']: -3.5,
        background: on ? `var(${ACCENT_VAR}, ${K.deepGold})` : '#D8CFBE', boxShadow: `0 0 0 2px ${K.page}`,
      }} />
      {children}
    </Tag>
  );
}

export default function PointsTab({ scoring, updScoring, t, language, isViewOnly }: TabProps) {
  const dim = isViewOnly ? { opacity: 0.55, pointerEvents: 'none' as const } : undefined;
  const orbitRef = useOrbitArc();
  const setSource = (id: string, patch: Partial<ScoreSource>) =>
    updScoring({ ...scoring, sources: scoring.sources.map((x) => (x.id === id ? { ...x, ...patch } : x)) });
  const setFactor = (id: string, patch: Partial<RankingFactor>) =>
    updScoring({ ...scoring, factors: scoring.factors.map((x) => (x.id === id ? { ...x, ...patch } : x)) });
  const maxValue = Math.max(1, ...scoring.sources.filter((x) => x.enabled).map((x) => Math.abs(x.value)));

  return (
    <div ref={orbitRef} style={dim} aria-disabled={isViewOnly || undefined} className="stg-orbit">
      {/* The orbit (owner, 18 Sep 2026: "just the graph in the middle, and the score sources
          and quality factors surround it ... follow the curvature of the circle"). The blend
          ring is the centrepiece with no plate; the quantitative sources sit on its
          inline-start side and the qualitative factors on its inline-end side, each row bent
          along an arc around the ring by useOrbitArc. Narrow pages stack: ring, sources,
          factors. Any number of sources works: the arc is sized from the rows it finds.
          Custom sources a committee already stores still render (name, points, enable,
          remove); there is no way to create a new one. */}
      <Section bare icon={Calculator} title={t('settings_points_sources_heading')} hint={t('settings_points_sources_desc')} className="min-w-0">
        <ul data-orbit-list className="flex flex-col" style={{ listStyle: 'none', margin: 0, padding: 0, gap: 6 }}>
          {scoring.sources.map((src) => {
            const label = src.builtin ? sourceName(src, language) : src.name;
            return (
              <OrbitRow as="li" side="start" on={src.enabled} key={src.id}>
                <div style={{ opacity: src.enabled ? 1 : 0.6 }}>
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
                </div>
              </OrbitRow>
            );
          })}
        </ul>
      </Section>

      <Section bare icon={Blend} title={t('settings_points_blend_heading')} hint={t('stg_blend_hint')} lead delay={40} className="stg-orbit-core min-w-0">
        <BlendRing blend={scoring.scoreBlend} t={t} />
        <div style={{ padding: '14px 0 4px' }}>
          <NotchDial label={t('settings_points_blend_heading')} value={scoring.scoreBlend} min={0} max={100} notches={25} tone="split"
            onChange={(v) => updScoring({ ...scoring, scoreBlend: v })}
            valueText={(v) => `${100 - v} / ${v}`} startLabel={t('settings_points_blend_objective')} endLabel={t('settings_points_blend_quality')} />
        </div>
      </Section>

      <Section bare icon={Star} title={t('settings_points_factors_heading')} hint={t('settings_points_factors_desc', { max: scoring.factorScaleMax })} delay={80} className="stg-orbit-end min-w-0">
        <div data-orbit-list className="flex flex-col" style={{ gap: 6 }}>
          <OrbitRow side="end" on={scoring.factorRatingsEnabled}>
            <SettingRow first dense labelId="stg-rate" label={t('settings_points_rate_label')} hint={t('settings_points_rate_note')}
              control={<GavelSwitch size="sm" icon={Star} labelledBy="stg-rate" checked={scoring.factorRatingsEnabled} onChange={(v) => updScoring({ ...scoring, factorRatingsEnabled: v })} />} />
          </OrbitRow>
          {scoring.factorRatingsEnabled && (
            <>
              {scoring.factors.map((f) => (
                <OrbitRow side="end" on={f.enabled} key={f.id}>
                  <span className="flex items-center gap-1.5" style={{ margin: '-4px -6px -4px -2px' }}>
                    <input value={factorName(f, language)} aria-label={t('stg_factor_name')} onChange={(e) => setFactor(f.id, { name: e.target.value })}
                      className="stg-focus flex-1 min-w-0" style={{ fontSize: T.body, fontWeight: W.label, color: K.ink, background: 'transparent', border: 'none', borderRadius: 6, padding: '4px 2px', fontFamily: K.font, opacity: f.enabled ? 1 : 0.6 }} />
                    <GavelSwitch size="sm" label={t('stg_factor_enabled', { name: factorName(f, language) })} checked={f.enabled} onChange={(v) => setFactor(f.id, { enabled: v })} />
                    <button type="button" aria-label={t('stg_remove_named', { name: factorName(f, language) })} onClick={() => updScoring({ ...scoring, factors: scoring.factors.filter((x) => x.id !== f.id) })}
                      className="stg-focus stg-press inline-flex items-center justify-center shrink-0" style={{ width: 28, height: 28, borderRadius: 999, border: 'none', background: 'transparent', color: K.inkSoft, cursor: 'pointer' }}>
                      <Trash2 size={13} strokeWidth={2.2} />
                    </button>
                  </span>
                </OrbitRow>
              ))}
              <div data-orbit="end"><AddButton label={t('settings_points_add_factor')} onClick={() => updScoring({ ...scoring, factors: [...scoring.factors, { id: `factor-${Date.now()}`, name: 'New factor', enabled: true }] })} /></div>
              <OrbitRow side="end" on>
                <SettingRow first dense label={t('settings_points_scale_max')} hint={t('stg_scale_note')}>
                  {/* Floor of 2: a one-point scale is not a rating. */}
                  <NotchDial label={t('settings_points_scale_max')} value={scoring.factorScaleMax} min={2} max={100} notches={17}
                    onChange={(v) => updScoring({ ...scoring, factorScaleMax: v })} valueText={(v) => `0-${v}`} startLabel="2" endLabel="100" />
                </SettingRow>
              </OrbitRow>
            </>
          )}
        </div>
      </Section>
    </div>
  );
}
