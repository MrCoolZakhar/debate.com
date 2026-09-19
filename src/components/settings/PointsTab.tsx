'use client';

import { useId, useLayoutEffect, useRef } from 'react';
import { Blend, Calculator, Plus, Star, Trash2 } from 'lucide-react';
import type { RankingFactor, ScoreSource } from '@/lib/settingsStore';
import { factorName, sourceName } from '@/lib/scoringNames';
import { K, T, W, LH, ACCENT_VAR, Section, SettingRow, GavelSwitch, NotchDial, TallyStepper, InfoHint } from './settingsKit';
import type { TabProps } from './settingsTypes';

// ── The ring ──────────────────────────────────────────────────────────────────
// viewBox 116: the ring's centre line at radius 50 with a 10-wide stroke, so its OUTER edge
// is at 55 of the 58 half-box. useOrbitArc reads the outer radius from this ratio.
const RING_VB = 116;
const RING_R = 50;
const RING_STROKE = 10;
const RING_OUTER = (RING_R + RING_STROKE / 2) / (RING_VB / 2);

/**
 * The blend as a split ring, the centrepiece of the tab: forest = objective points, gold =
 * quality ratings. The group's own heading and the two shares sit INSIDE the ring, so the
 * graph is the whole group; the dial and the worked example sit under the orbit.
 */
function BlendRing({ blend, t, headingId }: { blend: number; t: TabProps['t']; headingId: string }) {
  const C = 2 * Math.PI * RING_R;
  const q = blend / 100;
  const mid = RING_VB / 2;
  return (
    <div className="relative w-full" style={{ aspectRatio: '1 / 1' }}>
      <svg data-orbit-ring viewBox={`0 0 ${RING_VB} ${RING_VB}`} className="absolute inset-0 w-full h-full" role="img" aria-label={t('stg_blend_aria', { objective: 100 - blend, quality: blend })}>
        <circle cx={mid} cy={mid} r={RING_R} fill="none" stroke="rgba(27,56,40,0.08)" strokeWidth={RING_STROKE} />
        <circle cx={mid} cy={mid} r={RING_R} fill="none" stroke={K.forest} strokeWidth={RING_STROKE} strokeDasharray={`${C * (1 - q)} ${C}`} transform={`rotate(-90 ${mid} ${mid})`}
          style={{ transitionProperty: 'stroke-dasharray', transitionDuration: '220ms' }} />
        <circle cx={mid} cy={mid} r={RING_R} fill="none" stroke={K.deepGold} strokeWidth={RING_STROKE} strokeDasharray={`${C * q} ${C}`} strokeDashoffset={-C * (1 - q)} transform={`rotate(-90 ${mid} ${mid})`}
          style={{ transitionProperty: 'stroke-dasharray, stroke-dashoffset', transitionDuration: '220ms' }} />
      </svg>
      {/* The hole of the ring: heading, the two shares, the legend. */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center" style={{ padding: '18%' }}>
        <div className="flex items-center gap-1.5">
          <Blend aria-hidden size={19} strokeWidth={2.4} style={{ color: `var(${ACCENT_VAR}, ${K.forestLight})`, flexShrink: 0 }} />
          <h3 id={headingId} className="stg-title" style={{ margin: 0, fontSize: T.section, fontWeight: W.section, lineHeight: LH.section, letterSpacing: '-0.01em', color: K.forest }}>
            {t('settings_points_blend_heading')}
          </h3>
          <InfoHint text={t('stg_blend_hint')} />
        </div>
        <div aria-hidden className="flex items-baseline gap-2 stg-num" style={{ marginTop: 8 }}>
          <span style={{ fontSize: T.title, fontWeight: W.title, color: K.forest, lineHeight: LH.title }}>{100 - blend}</span>
          <span style={{ fontSize: T.section, fontWeight: W.section, color: K.inkSoft }}>/</span>
          <span style={{ fontSize: T.title, fontWeight: W.title, color: '#7A5812', lineHeight: LH.title }}>{blend}</span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5" style={{ marginTop: 8 }}>
          <span className="inline-flex items-center gap-1.5 stg-num" style={{ fontSize: T.caption, fontWeight: W.label, color: K.forest }}>
            <span aria-hidden style={{ width: 8, height: 8, borderRadius: 2, background: K.forest }} />{t('settings_points_blend_objective')} {100 - blend}%
          </span>
          <span className="inline-flex items-center gap-1.5 stg-num" style={{ fontSize: T.caption, fontWeight: W.label, color: '#7A5812' }}>
            <span aria-hidden style={{ width: 8, height: 8, borderRadius: 2, background: K.deepGold }} />{t('settings_points_blend_quality')} {blend}%
          </span>
        </div>
      </div>
    </div>
  );
}

/** Worked example as three bars: 80% of the top points total and a 6 out of 10 quality mark. */
function BlendExample({ blend, t }: { blend: number; t: TabProps['t'] }) {
  const q = blend / 100;
  const objective = 80;
  const quality = 60;
  const headline = Math.round(objective * (1 - q) + quality * q);
  return (
    <div className="w-full">
      {([
        { label: t('stg_blend_example_points'), v: objective, color: K.forest },
        { label: t('stg_blend_example_quality'), v: quality, color: K.deepGold },
        { label: t('stg_blend_example_headline'), v: headline, color: `linear-gradient(90deg, ${K.forest}, ${K.deepGold})`, strong: true },
      ]).map((b, i) => (
        <div key={b.label} className="flex items-center gap-2.5" style={{ marginTop: i === 0 ? 0 : 6 }}>
          <span className="truncate" style={{ width: 104, fontSize: T.caption, fontWeight: b.strong ? W.section : W.label, color: b.strong ? K.ink : K.inkSoft }}>{b.label}</span>
          <span className="flex-1 relative" style={{ height: 10, borderRadius: 999, background: 'rgba(27,56,40,0.08)' }}>
            <span className="absolute" style={{ insetBlock: 0, insetInlineStart: 0, width: `${b.v}%`, borderRadius: 999, background: b.color, transitionProperty: 'width', transitionDuration: '220ms' }} />
          </span>
          <span className="stg-num" style={{ width: 24, textAlign: 'end', fontSize: T.body, fontWeight: W.section, color: K.ink }}>{b.v}</span>
        </div>
      ))}
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

// ── The orbit ─────────────────────────────────────────────────────────────────
/** Clear space between the ring's outer edge and the nearest corner of any row. */
const ORBIT_CLEAR = 8;

/**
 * Puts the rows on either side of the blend ring ON a circle around it.
 *
 * Per side ([data-orbit="start"] / [data-orbit="end"]) the orbit is a circle centred on the
 * ring with radius A = ring radius + that side's typical (median) half-row + ORBIT_CLEAR, the
 * smallest circle on which a row of that height CENTRED on it can never touch the ring with a
 * corner (a taller row is held clear by a corner check). Each row's
 * inner edge is placed on that circle at the row's own height, so its bead (the dot on the
 * edge facing the ring) sits exactly on the orbit: the row level with the ring's centre is a
 * few px off the ring's edge and the rows above and below swing in over the empty space
 * above and below the ring. Rows beyond the circle's reach form a short straight tail,
 * never closer to the centre line than a fifth of A, so the two sides can never meet.
 *
 * Every row on a side keeps one width and moves by a pair of logical margins (inner, which
 * may be negative, and outer), so RTL mirrors itself. The orbit line itself is drawn as one
 * arc per side through the beads that lie on it ([data-orbit-arc]). All written straight to
 * the nodes: no React state, nothing per frame, re-placed only when the orbit or a list
 * changes size. Stacked (a narrow page), every margin is cleared and the arcs hidden.
 */
function useOrbitArc() {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const orbit = ref.current;
    if (!orbit) return;
    let raf = 0;
    const set = (row: HTMLElement, prop: 'marginInlineStart' | 'marginInlineEnd', px: number) => {
      const v = px !== 0 ? `${px}px` : '';
      if (row.style[prop] !== v) row.style[prop] = v;
    };
    const arcOf = (side: string) => orbit.querySelector<SVGPathElement>(`[data-orbit-arc="${side}"]`);
    const place = () => {
      raf = 0;
      const ring = orbit.querySelector<SVGElement>('[data-orbit-ring]');
      const rows = Array.from(orbit.querySelectorAll<HTMLElement>('[data-orbit]'));
      const wide = !!ring && getComputedStyle(orbit).gridTemplateColumns.trim().split(/\s+/).length === 3;
      if (!wide) {
        rows.forEach((r) => { set(r, 'marginInlineStart', 0); set(r, 'marginInlineEnd', 0); });
        (['start', 'end'] as const).forEach((side) => arcOf(side)?.setAttribute('d', ''));
        return;
      }
      // FitToScreen draws the dialog inside scale(): rects are screen px, margins layout px.
      const or = orbit.getBoundingClientRect();
      const scale = or.width / (orbit.offsetWidth || 1) || 1;
      const rr = ring.getBoundingClientRect();
      const cxS = rr.left + rr.width / 2;
      const cyS = rr.top + rr.height / 2;
      const cx = (cxS - or.left) / scale;
      const cy = (cyS - or.top) / scale;
      const ringR = (rr.width / 2 / scale) * RING_OUTER;
      (['start', 'end'] as const).forEach((side) => {
        const mine = rows.filter((r) => r.dataset.orbit === side);
        const arc = arcOf(side);
        if (mine.length === 0) { arc?.setAttribute('d', ''); return; }
        const inner = side === 'start' ? 'marginInlineEnd' : 'marginInlineStart';
        const outer = side === 'start' ? 'marginInlineStart' : 'marginInlineEnd';
        const list = mine[0].parentElement;
        if (!list) return;
        const lr = list.getBoundingClientRect();
        // Which way this side lies from the ring (RTL puts "start" on the right).
        const dir = (lr.left + lr.width / 2) < cxS ? -1 : 1;
        // Distance from the ring's centre to the list's edge that faces the ring.
        const edge = (dir < 0 ? cxS - lr.right : lr.left - cxS) / scale;
        const geo = mine.map((r) => {
          const b = r.getBoundingClientRect();
          return { dy: (b.top + b.height / 2 - cyS) / scale, h: b.height / 2 / scale };
        });
        // Sized for the side's TYPICAL row (the median half-height), so one tall row (the
        // rating scale) does not push the whole side away; that row is kept clear of the
        // ring by the corner check below instead.
        const hs = geo.map((g) => g.h).sort((a, b) => a - b);
        const A = ringR + ORBIT_CLEAR + hs[Math.floor((hs.length - 1) / 2)];
        const floor = A * 0.2;
        const ds = geo.map((g) => {
          const onArc = Math.abs(g.dy) < A ? Math.sqrt(A * A - g.dy * g.dy) : 0;
          // Never let a row's corner reach the ring, whatever its height.
          const v = Math.max(0, Math.abs(g.dy) - g.h);
          const safe = v < ringR + ORBIT_CLEAR ? Math.sqrt((ringR + ORBIT_CLEAR) ** 2 - v * v) : 0;
          const d = Math.max(onArc, safe, floor);
          return { d, onArc: d === onArc && onArc > 0 };
        });
        // Inner margin moves the edge from the list edge to the orbit (negative = into the
        // ring's column); the outer margin takes up the rest, so every row keeps one width.
        const innerPx = ds.map((x) => Math.round(x.d - edge));
        const keep = Math.max(0, ...innerPx);
        mine.forEach((r, k) => { set(r, inner, innerPx[k]); set(r, outer, keep - innerPx[k]); });
        // The orbit line through the beads that lie on it, a little past the first and last.
        if (arc) {
          const on = geo.filter((_, k) => ds[k].onArc).map((g) => g.dy);
          if (on.length === 0) { arc.setAttribute('d', ''); return; }
          const lim = A * 0.97;
          const y1 = Math.max(-lim, Math.min(...on) - 18);
          const y2 = Math.min(lim, Math.max(...on) + 18);
          const pt = (dy: number) => `${(cx + dir * Math.sqrt(A * A - dy * dy)).toFixed(1)} ${(cy + dy).toFixed(1)}`;
          const d = `M ${pt(y1)} A ${A.toFixed(1)} ${A.toFixed(1)} 0 0 ${dir < 0 ? 0 : 1} ${pt(y2)}`;
          if (arc.getAttribute('d') !== d) arc.setAttribute('d', d);
        }
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

/** One row of the orbit: its own plate, and a bead on the edge that faces the ring, lit in
 *  the tab's hue while the row counts. The bead is what sits on the orbit line. */
function OrbitRow({ side, on, children, as = 'div', pad = '6px 12px' }: {
  side: 'start' | 'end'; on: boolean; children: React.ReactNode; as?: 'div' | 'li'; pad?: string;
}) {
  const Tag = as;
  return (
    <Tag data-orbit={side} className="relative" style={{
      padding: pad, borderRadius: 14, zIndex: 1,
      background: on ? K.surface : K.page,
      boxShadow: on ? '0 0 0 1px rgba(27,56,40,0.06), 0 1px 2px rgba(27,56,40,0.05), 0 6px 16px -12px rgba(27,56,40,0.22)' : 'inset 0 0 0 1px rgba(28,20,16,0.08)',
    }}>
      <span aria-hidden className="absolute" style={{
        top: '50%', marginTop: -4, width: 8, height: 8, borderRadius: 8,
        [side === 'start' ? 'insetInlineEnd' : 'insetInlineStart']: -4,
        background: on ? `var(${ACCENT_VAR}, ${K.deepGold})` : '#D8CFBE', boxShadow: `0 0 0 2.5px ${K.page}`,
      }} />
      {children}
    </Tag>
  );
}

export default function PointsTab({ scoring, updScoring, t, language, isViewOnly }: TabProps) {
  const dim = isViewOnly ? { opacity: 0.55, pointerEvents: 'none' as const } : undefined;
  const orbitRef = useOrbitArc();
  const blendId = useId();
  const setSource = (id: string, patch: Partial<ScoreSource>) =>
    updScoring({ ...scoring, sources: scoring.sources.map((x) => (x.id === id ? { ...x, ...patch } : x)) });
  const setFactor = (id: string, patch: Partial<RankingFactor>) =>
    updScoring({ ...scoring, factors: scoring.factors.map((x) => (x.id === id ? { ...x, ...patch } : x)) });
  const maxValue = Math.max(1, ...scoring.sources.filter((x) => x.enabled).map((x) => Math.abs(x.value)));

  return (
    <div ref={orbitRef} style={dim} aria-disabled={isViewOnly || undefined} className="stg-orbit">
      {/* The orbit (owner, 18 Sep 2026: "just the graph in the middle, and the score sources
          and quality factors surround it ... follow the curvature of the circle"; then "hug
          the ring closely, no dead gap"). The blend ring is the centrepiece with its heading
          inside it; the quantitative sources sit on its inline-start side and the qualitative
          factors on its inline-end side, each row placed ON a circle around the ring by
          useOrbitArc, with the orbit line drawn through the beads. The dial and the worked
          example sit under the orbit. Narrow pages stack: ring, dial, sources, factors. Any
          number of sources works: the orbit is measured from the rows it finds. Custom
          sources a committee already stores still render (name, points, enable, remove);
          there is no way to create a new one. */}
      <svg aria-hidden className="stg-orbit-lines absolute inset-0 w-full h-full" style={{ pointerEvents: 'none', overflow: 'visible', zIndex: 0 }}>
        <path data-orbit-arc="start" fill="none" stroke="rgba(27,56,40,0.22)" strokeWidth={1.5} strokeDasharray="2 5" strokeLinecap="round" />
        <path data-orbit-arc="end" fill="none" stroke="rgba(27,56,40,0.22)" strokeWidth={1.5} strokeDasharray="2 5" strokeLinecap="round" />
      </svg>

      <Section bare icon={Calculator} title={t('settings_points_sources_heading')} hint={t('settings_points_sources_desc')} className="stg-orbit-side min-w-0" style={{ marginBottom: 0 }}>
        <ul data-orbit-list className="flex flex-col" style={{ listStyle: 'none', margin: 0, padding: 0, gap: 6 }}>
          {scoring.sources.map((src) => {
            const label = src.builtin ? sourceName(src, language) : src.name;
            return (
              <OrbitRow as="li" side="start" on={src.enabled} key={src.id} pad="6px 10px 9px">
                {/* One line: switch, name, points; the weight bar is the thin line under it. */}
                <div className="flex items-center gap-2" style={{ opacity: src.enabled ? 1 : 0.6 }}>
                  <GavelSwitch size="sm" label={t('stg_source_enabled', { name: label })} checked={src.enabled} onChange={(v) => setSource(src.id, { enabled: v })} />
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
                  <TallyStepper label={t('stg_points_for', { name: label })} suffix={t('settings_points_pts_suffix')} value={src.value} min={-99} max={999} onChange={(v) => setSource(src.id, { value: v })} />
                </div>
                {/* Relative weight: this source against the heaviest enabled one. */}
                <span aria-hidden className="absolute" style={{ insetInline: 12, bottom: 4, height: 3, borderRadius: 3, background: 'rgba(27,56,40,0.07)' }}>
                  <span className="absolute" style={{ insetBlock: 0, insetInlineStart: 0, borderRadius: 3, width: `${src.enabled ? Math.min(100, (Math.abs(src.value) / maxValue) * 100) : 0}%`, background: src.value < 0 ? K.danger : K.deepGold, transitionProperty: 'width', transitionDuration: '200ms' }} />
                </span>
              </OrbitRow>
            );
          })}
        </ul>
      </Section>

      <section aria-labelledby={blendId} className="stg-orbit-core stg-rise min-w-0" style={{ animationDelay: '40ms', position: 'relative', zIndex: 1 }}>
        <BlendRing blend={scoring.scoreBlend} t={t} headingId={blendId} />
      </section>

      <Section bare icon={Star} title={t('settings_points_factors_heading')} hint={t('settings_points_factors_desc', { max: scoring.factorScaleMax })} delay={80} className="stg-orbit-side stg-orbit-end min-w-0" style={{ marginBottom: 0 }}>
        <div data-orbit-list className="flex flex-col" style={{ gap: 6 }}>
          <OrbitRow side="end" on={scoring.factorRatingsEnabled} pad="0 12px">
            <SettingRow first dense labelId="stg-rate" label={t('settings_points_rate_label')} hint={t('settings_points_rate_note')}
              control={<GavelSwitch size="sm" icon={Star} labelledBy="stg-rate" checked={scoring.factorRatingsEnabled} onChange={(v) => updScoring({ ...scoring, factorRatingsEnabled: v })} />} />
          </OrbitRow>
          {scoring.factorRatingsEnabled && (
            <>
              {scoring.factors.map((f) => (
                <OrbitRow side="end" on={f.enabled} key={f.id} pad="4px 6px 4px 10px">
                  <span className="flex items-center gap-1.5">
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
              <div data-orbit="end" className="relative" style={{ zIndex: 1 }}>
                <AddButton label={t('settings_points_add_factor')} onClick={() => updScoring({ ...scoring, factors: [...scoring.factors, { id: `factor-${Date.now()}`, name: 'New factor', enabled: true }] })} />
              </div>
              <OrbitRow side="end" on pad="0 12px">
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

      {/* Under the orbit: the dial that sets the blend, and what it does to a real headline. */}
      <div role="group" aria-labelledby={blendId} className="stg-orbit-foot stg-rise" style={{ animationDelay: '60ms', position: 'relative', zIndex: 1 }}>
        <div style={{ flex: '1 1 280px', minWidth: 0 }}>
          <NotchDial label={t('settings_points_blend_heading')} value={scoring.scoreBlend} min={0} max={100} notches={25} tone="split"
            onChange={(v) => updScoring({ ...scoring, scoreBlend: v })}
            valueText={(v) => `${100 - v} / ${v}`} startLabel={t('settings_points_blend_objective')} endLabel={t('settings_points_blend_quality')} />
        </div>
        <div style={{ flex: '1 1 260px', minWidth: 0 }}>
          <BlendExample blend={scoring.scoreBlend} t={t} />
        </div>
      </div>
    </div>
  );
}
