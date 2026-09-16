'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Award, MonitorOff, Trophy, ScrollText, Crown } from 'lucide-react';
import { resolveChairAwardsHref } from '@/lib/sessionAwardsLink';
import { K, T, W, LH, Section, InfoHint } from './settingsKit';
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
      <div className="stg-rise relative overflow-hidden" style={{ borderRadius: 20, padding: '20px 22px 18px', marginBottom: 18, background: `linear-gradient(145deg, ${K.forest} 0%, #20452E 60%, #2B5A3B 100%)`, color: '#F3EAD0', boxShadow: '0 24px 44px -26px rgba(27,56,40,0.95)' }}>
        {/* A laurel of gold rings in the corner: decoration only. */}
        <svg aria-hidden width="220" height="220" viewBox="0 0 220 220" className="absolute" style={{ insetInlineEnd: -50, top: -60, opacity: 0.16 }}>
          {[96, 74, 52].map((r) => <circle key={r} cx="110" cy="110" r={r} fill="none" stroke={K.gold} strokeWidth="2" strokeDasharray="3 7" />)}
        </svg>
        <h3 className="stg-title flex items-start gap-2.5" style={{ margin: 0, fontSize: T.section, fontWeight: W.section, lineHeight: LH.section, letterSpacing: '-0.01em', color: '#FFF8E4', maxWidth: 540 }}>
          <Trophy aria-hidden size={20} strokeWidth={2.3} style={{ color: K.gold, flexShrink: 0, marginTop: 2 }} />
          <span>{t('stg_awards_card_title')}</span>
        </h3>
        <p className="stg-body" style={{ margin: '8px 0 0', fontSize: T.body, fontWeight: W.body, lineHeight: LH.body, color: 'rgba(243,234,208,0.86)', maxWidth: 520 }}>{t('stg_awards_card_body')}</p>
        <button type="button" onClick={open} className="stg-focus stg-press inline-flex items-center gap-2"
          style={{ marginTop: 16, height: 42, padding: '0 18px', borderRadius: 12, border: 'none', background: K.gold, color: K.forest, fontSize: T.body, fontWeight: W.section, cursor: 'pointer', boxShadow: '0 10px 20px -10px rgba(0,0,0,0.55)' }}>
          {t('stg_awards_open')}
          <ArrowUpRight size={17} strokeWidth={2.6} aria-hidden />
        </button>
        <p style={{ margin: '8px 0 0', fontSize: T.caption, fontWeight: W.label, color: 'rgba(243,234,208,0.72)' }}>
          {href ? t('stg_awards_new_tab') : t('stg_awards_resolving')}
        </p>
      </div>

      <Section icon={Award} title={t('stg_awards_how')} delay={60}>
        <ol className="grid gap-2.5" style={{ listStyle: 'none', margin: 0, padding: '10px 0', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
          {steps.map((s, i) => (
            <li key={i} style={{ borderRadius: 13, padding: 12, background: K.surface, boxShadow: K.outSm }}>
              <span className="flex items-center gap-2">
                <span aria-hidden className="stg-num" style={{ fontSize: T.section, fontWeight: W.section, lineHeight: 1, color: K.deepGold }}>{i + 1}</span>
                <s.icon size={16} strokeWidth={2.3} aria-hidden style={{ color: K.forestLight }} />
                <span style={{ fontSize: T.body, fontWeight: W.section, color: K.ink }}>{s.title}</span>
                <InfoHint text={s.body} />
              </span>
            </li>
          ))}
        </ol>
      </Section>
    </div>
  );
}
