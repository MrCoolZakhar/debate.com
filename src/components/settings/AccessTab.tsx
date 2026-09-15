'use client';

import { useState } from 'react';
import { BellRing, Check, Copy, Eye, Gavel, KeyRound, Lock, MessageSquareOff, ShieldCheck, Tag, Users, Volume2, ListOrdered, DoorOpen } from 'lucide-react';
import { clampGavelSeconds, primeGavelAudio, playGavelKnock, GAVEL_MIN_SECONDS, GAVEL_MAX_SECONDS, GAVEL_DEFAULT_SECONDS } from '@/lib/gavelSound';
import { K, Section, SettingRow, GavelSwitch, ClockStepper } from './settingsKit';
import type { TabProps } from './settingsTypes';

/** A ticket stub for a code: perforated edge, big tabular letters, copy on press. */
function CodeTicket({ label, code, caption, secret = false, tone, copiedLabel, copyLabel, revealLabel }: {
  label: string; code: string; caption: string; secret?: boolean; tone: 'forest' | 'ivory';
  copiedLabel: string; copyLabel: string; revealLabel: string;
}) {
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const dark = tone === 'forest';
  const hidden = secret && !revealed;
  const copy = () => {
    try { void navigator.clipboard.writeText(code); } catch { /* clipboard blocked */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <button
      type="button"
      onClick={copy}
      onMouseEnter={() => setRevealed(true)}
      onMouseLeave={() => setRevealed(false)}
      onFocus={() => setRevealed(true)}
      onBlur={() => setRevealed(false)}
      aria-label={`${label}: ${copyLabel}`}
      className="stg-focus stg-press relative text-start overflow-hidden"
      style={{
        flex: '1 1 240px', minWidth: 0, border: 'none', cursor: 'pointer', borderRadius: 18, padding: '16px 18px 16px 22px',
        background: dark ? `linear-gradient(140deg, ${K.forest}, #244A33)` : K.surface,
        color: dark ? K.gold : K.forest,
        boxShadow: dark ? '0 14px 30px -18px rgba(27,56,40,0.9)' : K.out,
      }}
    >
      {/* Perforation along the inline-start edge. */}
      <span aria-hidden className="absolute flex flex-col justify-around" style={{ insetInlineStart: 8, top: 10, bottom: 10 }}>
        {Array.from({ length: 7 }, (_, i) => <span key={i} style={{ width: 5, height: 5, borderRadius: 5, background: dark ? 'rgba(238,217,138,0.22)' : 'rgba(27,56,40,0.12)' }} />)}
      </span>
      <span className="flex items-center gap-2" style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', opacity: dark ? 0.8 : 0.7 }}>
        {secret ? <Lock size={12} strokeWidth={2.6} aria-hidden /> : <KeyRound size={12} strokeWidth={2.6} aria-hidden />}
        {label}
      </span>
      <span className="stg-num flex items-center justify-between gap-3" style={{ marginTop: 8 }}>
        <span dir="ltr" style={{
          fontSize: 30, fontWeight: 900, letterSpacing: '0.14em', lineHeight: 1,
          filter: hidden ? 'blur(7px)' : 'none', transitionProperty: 'filter', transitionDuration: '200ms',
          userSelect: hidden ? 'none' : 'text',
        }}>{code}</span>
        <span aria-hidden className="inline-flex items-center justify-center shrink-0" style={{
          width: 34, height: 34, borderRadius: 11, background: dark ? 'rgba(238,217,138,0.14)' : K.ivory, boxShadow: dark ? 'none' : K.inSm,
        }}>
          {copied ? <Check size={16} strokeWidth={3} /> : hidden ? <Eye size={15} strokeWidth={2.4} /> : <Copy size={15} strokeWidth={2.4} />}
        </span>
      </span>
      <span className="stg-body" aria-live="polite" style={{ display: 'block', marginTop: 8, fontSize: 12, lineHeight: 1.4, color: dark ? 'rgba(243,234,208,0.72)' : K.inkSoft }}>
        {copied ? copiedLabel : hidden ? revealLabel : caption}
      </span>
    </button>
  );
}

export default function AccessTab({ committee, s, upd, isViewOnly, myChairName, t, onOpenPeople, displayChairSuffix }: TabProps & {
  onOpenPeople: () => void;
  displayChairSuffix: string;
}) {
  const headChair = committee.dbHeadChair || committee.chairNames?.[0] || '';
  const isHead = !myChairName || (headChair === myChairName && !isViewOnly);
  const gavelAt = clampGavelSeconds(s.gavelSoundAtSeconds ?? GAVEL_DEFAULT_SECONDS);
  const [knocking, setKnocking] = useState(false);
  const dim = isViewOnly ? { opacity: 0.55, pointerEvents: 'none' as const } : undefined;

  return (
    <div>
      <Section icon={KeyRound} title={t('stg_access_codes')} hint={t('stg_access_codes_hint')} lead>
        <div className="flex flex-wrap gap-3" style={{ padding: '14px 0' }}>
          <CodeTicket tone="forest" label={t('settings_session_code_label')} code={committee.code} caption={t('stg_session_code_caption')}
            copiedLabel={t('stg_copied')} copyLabel={t('stg_copy')} revealLabel={t('stg_hover_reveal')} />
          <CodeTicket tone="ivory" secret label={t('settings_chair_code_label')} code={displayChairSuffix} caption={t('stg_chair_code_caption')}
            copiedLabel={t('stg_copied')} copyLabel={t('stg_copy')} revealLabel={t('stg_hover_reveal')} />
        </div>
      </Section>

      {/* Read-only on purpose: taking the gavel lives in one place, the gavel chip in the top bar. */}
      <Section icon={Gavel} title={t('settings_head_chair_label')} delay={40}>
        <div className="flex flex-wrap items-center gap-4" style={{ padding: '14px 0' }}>
          <span aria-hidden className="inline-flex items-center justify-center shrink-0" style={{
            width: 48, height: 48, borderRadius: 16, color: K.forest,
            background: `radial-gradient(circle at 35% 30%, #F7EBB5, ${K.gold} 60%, ${K.deepGold})`, boxShadow: '0 8px 18px -10px rgba(182,135,31,0.9)',
          }}>
            <Gavel size={22} strokeWidth={2.3} />
          </span>
          <div className="flex-1 min-w-0">
            <div style={{ fontSize: 18, fontWeight: 900, color: K.ink }}>
              {headChair || '-'}{isHead && myChairName ? <span style={{ marginInlineStart: 6, fontSize: 13, fontWeight: 700, color: K.forestLight }}>{t('gavel_you')}</span> : null}
            </div>
            <div className="stg-body" style={{ fontSize: 12.5, color: K.inkSoft, marginTop: 2 }}>{t('settings_head_chair_note')}</div>
          </div>
          <button type="button" onClick={onOpenPeople} className="stg-focus stg-press inline-flex items-center gap-2"
            style={{ height: 38, padding: '0 14px', borderRadius: 12, border: 'none', background: K.ivory, color: K.forest, fontSize: 13, fontWeight: 800, cursor: 'pointer', boxShadow: K.outSm }}>
            <Users size={15} strokeWidth={2.4} aria-hidden />
            {t('stg_see_people')}
          </button>
        </div>
      </Section>

      <div style={dim} aria-disabled={isViewOnly || undefined}>
        <Section icon={ShieldCheck} title={t('stg_access_floor')} hint={t('stg_access_floor_hint')} lead delay={80}>
          <SettingRow first labelId="stg-appr" label={t('settings_chair_approval_label')} note={t('settings_chair_approval_note')}
            control={<GavelSwitch glyph="lock" icon={DoorOpen} labelledBy="stg-appr" checked={s.requireChairApproval} onChange={(v) => upd('requireChairApproval', v)} />} />
          <SettingRow labelId="stg-lockrc" label={t('stg_lock_rollcall_label')} note={t('stg_lock_rollcall_note')}
            control={<GavelSwitch glyph="lock" labelledBy="stg-lockrc" checked={s.lockDelegateRollCall} onChange={(v) => upd('lockDelegateRollCall', v)} />} />
          <SettingRow labelId="stg-gsl" label={t('settings_gsl_require_next_label')} note={t('settings_gsl_require_next_note')}
            control={<GavelSwitch icon={ListOrdered} labelledBy="stg-gsl" checked={s.gslRequireNextSpeaker} onChange={(v) => upd('gslRequireNextSpeaker', v)} />} />
          <SettingRow labelId="stg-chat" label={t('stg_disable_chat_label')} note={t('stg_disable_chat_note')}
            control={<GavelSwitch icon={MessageSquareOff} labelledBy="stg-chat" checked={s.disableChat} onChange={(v) => upd('disableChat', v)} />} />
        </Section>

        {/* Gavel knock, played only on the Moderator's device by src/lib/useGavelCue.ts. The
            Test button is a user gesture, so it also unlocks audio for the timer knocks. */}
        <Section icon={BellRing} title={t('settings_section_timer_sound')} delay={120}>
          <SettingRow first labelId="stg-knock" label={t('settings_gavel_sound_label')} note={t('settings_gavel_sound_note')}
            control={<GavelSwitch icon={BellRing} labelledBy="stg-knock" checked={s.gavelSoundEnabled !== false} onChange={(v) => upd('gavelSoundEnabled', v)} />} />
          {s.gavelSoundEnabled !== false && (
            <SettingRow label={t('settings_gavel_at_label')} note={t('settings_gavel_at_note')}
              control={<ClockStepper label={t('settings_gavel_at_label')} unit={t('motions_sec')} value={gavelAt} min={GAVEL_MIN_SECONDS} max={GAVEL_MAX_SECONDS} step={5} arcMax={60}
                presets={[5, 10, 15, 30, 60]} onCommit={(v) => upd('gavelSoundAtSeconds', clampGavelSeconds(v))} />}>
              <button type="button"
                onClick={() => { primeGavelAudio(); playGavelKnock(); setKnocking(true); setTimeout(() => setKnocking(false), 500); }}
                className="stg-focus stg-press inline-flex items-center gap-2"
                style={{ height: 36, padding: '0 14px', borderRadius: 11, border: 'none', background: knocking ? K.gold : K.ivory, color: K.forest, fontSize: 13, fontWeight: 800, cursor: 'pointer', boxShadow: K.outSm }}>
                <Volume2 size={15} strokeWidth={2.4} aria-hidden />
                {t('settings_gavel_test')}
              </button>
            </SettingRow>
          )}
        </Section>

        <Section icon={Tag} title={t('stg_labels')} delay={160}>
          <SettingRow first htmlFor="stg-sponsor" label={t('stg_sponsor_label')} note={t('stg_sponsor_note')}>
            <input
              id="stg-sponsor"
              type="text"
              value={s.sponsorLabel}
              placeholder={t('stg_sponsor_placeholder')}
              onChange={(e) => upd('sponsorLabel', e.target.value)}
              className="stg-focus w-full"
              style={{ height: 42, maxWidth: 360, borderRadius: 12, border: 'none', padding: '0 14px', fontSize: 15, fontWeight: 600, color: K.ink, background: K.ivory, boxShadow: K.inSm, fontFamily: K.font }}
            />
          </SettingRow>
        </Section>
      </div>
    </div>
  );
}
