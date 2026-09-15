'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Award, MonitorOff, Trophy, ScrollText, Crown } from 'lucide-react';
import { resolveChairAwardsHref } from '@/lib/sessionAwardsLink';
import { K, Section } from './settingsKit';
import type { ConfirmRequest } from './PeopleTab';
import type { TabProps } from './settingsTypes';

/**
 * Awards are a conference feature: the slate is chosen in the chair's conference portal and
 * published by the secretariat. This tab only signposts it, and SettingsPanel mounts it only
 * when `committee.sessionOrigin === 'conference'` (never in a standalone session). The link
 * is the chair's own conference page (`resolveChairAwardsHref`), never the secretariat
 * console, which is unrendered while awards sit behind the coming-soon screen (CLAUDE.md §5).
 */
export default function AwardsTab({ committee, t, requestConfirm }: TabProps & { requestConfirm: (req: ConfirmRequest) => void }) {
  const [href, setHref] = useState<string | null>(null);
  const hrefRef = useRef<string | null>(null);
  useEffect(() => {
    let alive = true;
    void resolveChairAwardsHref(committee.code).then((h) => { if (alive) { hrefRef.current = h; setHref(h); } });
    return () => { alive = false; };
  }, [committee.code]);

  const open = () => {
    requestConfirm({
      title: t('stg_awards_confirm_title'),
      body: t('stg_awards_confirm_body'),
      confirmLabel: t('stg_awards_confirm_go'),
      icon: MonitorOff,
      run: async () => {
        // Resolved on mount, so the new tab opens inside the click (no popup blocker). If the
        // lookup is still running, open a blank tab now and send it on when it lands.
        const target = hrefRef.current;
        if (target) {
          window.open(target, '_blank', 'noopener,noreferrer');
          return true;
        }
        const w = window.open('about:blank', '_blank');
        const resolved = await resolveChairAwardsHref(committee.code);
        if (w) { try { w.opener = null; w.location.href = resolved; } catch { window.open(resolved, '_blank', 'noopener,noreferrer'); } }
        else window.open(resolved, '_blank', 'noopener,noreferrer');
        return true;
      },
    });
  };

  const steps = [
    { icon: ScrollText, title: t('stg_awards_step1_title'), body: t('stg_awards_step1_body') },
    { icon: Crown, title: t('stg_awards_step2_title'), body: t('stg_awards_step2_body') },
    { icon: Award, title: t('stg_awards_step3_title'), body: t('stg_awards_step3_body') },
  ];

  return (
    <div>
      <div className="stg-rise relative overflow-hidden" style={{ borderRadius: 24, padding: '26px 26px 24px', marginBottom: 26, background: `linear-gradient(145deg, ${K.forest} 0%, #20452E 60%, #2B5A3B 100%)`, color: '#F3EAD0', boxShadow: '0 24px 44px -26px rgba(27,56,40,0.95)' }}>
        {/* A laurel of gold rings in the corner: decoration only. */}
        <svg aria-hidden width="220" height="220" viewBox="0 0 220 220" className="absolute" style={{ insetInlineEnd: -50, top: -60, opacity: 0.16 }}>
          {[96, 74, 52].map((r) => <circle key={r} cx="110" cy="110" r={r} fill="none" stroke={K.gold} strokeWidth="2" strokeDasharray="3 7" />)}
        </svg>
        <span aria-hidden className="inline-flex items-center justify-center" style={{ width: 58, height: 58, borderRadius: 18, color: K.forest, background: `radial-gradient(circle at 35% 30%, #F7EBB5, ${K.gold} 60%, ${K.deepGold})`, boxShadow: '0 10px 22px -10px rgba(0,0,0,0.6)' }}>
          <Trophy size={28} strokeWidth={2.2} />
        </span>
        <h3 className="stg-title" style={{ margin: '16px 0 0', fontSize: 24, fontWeight: 900, letterSpacing: '-0.01em', color: '#FFF8E4', maxWidth: 520 }}>{t('stg_awards_card_title')}</h3>
        <p className="stg-body" style={{ margin: '8px 0 0', fontSize: 14.5, lineHeight: 1.55, color: 'rgba(243,234,208,0.82)', maxWidth: 560 }}>{t('stg_awards_card_body')}</p>
        <button type="button" onClick={open} className="stg-focus stg-press inline-flex items-center gap-2"
          style={{ marginTop: 20, height: 46, padding: '0 20px', borderRadius: 14, border: 'none', background: K.gold, color: K.forest, fontSize: 15, fontWeight: 900, cursor: 'pointer', boxShadow: '0 10px 20px -10px rgba(0,0,0,0.55)' }}>
          {t('stg_awards_open')}
          <ArrowUpRight size={18} strokeWidth={2.6} aria-hidden />
        </button>
        <p style={{ margin: '10px 0 0', fontSize: 12, fontWeight: 600, color: 'rgba(243,234,208,0.6)' }}>
          {href ? t('stg_awards_new_tab') : t('stg_awards_resolving')}
        </p>
      </div>

      <Section icon={Award} title={t('stg_awards_how')} delay={60}>
        <ol className="grid gap-3" style={{ listStyle: 'none', margin: 0, padding: '14px 0', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          {steps.map((s, i) => (
            <li key={i} style={{ borderRadius: 16, padding: 14, background: K.surface, boxShadow: K.outSm }}>
              <span className="flex items-center gap-2">
                <span aria-hidden className="stg-num inline-flex items-center justify-center" style={{ width: 24, height: 24, borderRadius: 8, background: K.ivory, color: K.forest, fontSize: 12, fontWeight: 900, boxShadow: K.inSm }}>{i + 1}</span>
                <s.icon size={16} strokeWidth={2.3} aria-hidden style={{ color: K.deepGold }} />
              </span>
              <span className="block" style={{ marginTop: 10, fontSize: 14, fontWeight: 800, color: K.ink }}>{s.title}</span>
              <span className="block stg-body" style={{ marginTop: 3, fontSize: 12.5, lineHeight: 1.45, color: K.inkSoft }}>{s.body}</span>
            </li>
          ))}
        </ol>
      </Section>
    </div>
  );
}
