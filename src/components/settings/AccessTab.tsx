'use client';

import { useState } from 'react';
import { BellRing, Check, Copy, Eye, Gavel, KeyRound, Lock, MessageSquareText, MessageSquareOff, ShieldCheck, Tag, Volume2, ListOrdered, DoorOpen, Users } from 'lucide-react';
import { clampGavelSeconds, primeGavelAudio, playGavelKnock, GAVEL_MIN_SECONDS, GAVEL_MAX_SECONDS, GAVEL_DEFAULT_SECONDS } from '@/lib/gavelSound';
import { getCountryByName } from '@/lib/countries';
import { CircleFlag, flagMonogram } from '@/components/CircleFlag';
import { K, T, W, LH, Section, SectionPair, SettingRow, RowGrid, GavelSwitch, SecondsDial, formatSeconds } from './settingsKit';
import type { TabProps } from './settingsTypes';

/** A ticket stub for a code: perforated edge, the code at T.section, copy on press. What the
 *  code is for (`caption`) is the ticket's tooltip, not a printed line. */
function CodeTicket({ label, code, caption, secret = false, tone, copiedLabel, copyLabel }: {
  label: string; code: string; caption: string; secret?: boolean; tone: 'forest' | 'ivory';
  copiedLabel: string; copyLabel: string;
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
      title={`${caption} ${copyLabel}.`}
      className="stg-focus stg-press relative text-start overflow-hidden"
      style={{
        flex: '1 1 220px', minWidth: 0, border: 'none', cursor: 'pointer', borderRadius: 14, padding: '11px 14px 11px 20px',
        background: dark ? `linear-gradient(140deg, ${K.forest}, #244A33)` : K.surface,
        color: dark ? K.gold : K.forest,
        boxShadow: dark ? '0 14px 30px -18px rgba(27,56,40,0.9)' : K.out,
      }}
    >
      {/* Perforation along the inline-start edge. */}
      <span aria-hidden className="absolute flex flex-col justify-around" style={{ insetInlineStart: 7, top: 9, bottom: 9 }}>
        {Array.from({ length: 6 }, (_, i) => <span key={i} style={{ width: 4, height: 4, borderRadius: 4, background: dark ? 'rgba(238,217,138,0.22)' : 'rgba(27,56,40,0.12)' }} />)}
      </span>
      <span className="flex items-center gap-1.5" aria-live="polite" style={{ fontSize: T.caption, fontWeight: W.label, color: dark ? 'rgba(243,234,208,0.8)' : K.inkSoft }}>
        {copied ? <Check size={12} strokeWidth={2.8} aria-hidden /> : secret ? <Lock size={12} strokeWidth={2.4} aria-hidden /> : <KeyRound size={12} strokeWidth={2.4} aria-hidden />}
        {copied ? copiedLabel : label}
      </span>
      <span className="stg-num flex items-center justify-between gap-3" style={{ marginTop: 4 }}>
        <span dir="ltr" style={{
          fontSize: T.section, fontWeight: W.title, letterSpacing: '0.12em', lineHeight: LH.section,
          filter: hidden ? 'blur(7px)' : 'none', transitionProperty: 'filter', transitionDuration: '200ms',
          userSelect: hidden ? 'none' : 'text',
        }}>{code}</span>
        {/* A crisp glyph, not a tiled button: the whole ticket is the control. */}
        {copied ? <Check aria-hidden size={17} strokeWidth={3} className="shrink-0" /> : hidden ? <Eye aria-hidden size={16} strokeWidth={2.4} className="shrink-0" /> : <Copy aria-hidden size={16} strokeWidth={2.4} className="shrink-0" style={{ opacity: 0.75 }} />}
      </span>
    </button>
  );
}

type ChairState = 'moderator' | 'commenting' | 'viewing' | 'offline';

/**
 * One chair on the dais, as a round avatar with what they are doing right now.
 *
 * The state is derived from facts this page already holds, never guessed: the gavel is
 * `committee.dbHeadChair` (persisted), and liveness is the chair-presence channel the chair
 * page passes down. The voting page mounts SettingsPanel without presence, so a Commenter
 * there reads "Viewing" - all we honestly know is that they hold a read-only dais view.
 */
function ChairAvatar({ name, state, isMe, youLabel, stateLabel }: {
  name: string; state: ChairState; isMe: boolean; youLabel: string; stateLabel: string;
}) {
  const country = getCountryByName(name);
  const moderator = state === 'moderator';
  const live = state === 'moderator' || state === 'commenting';
  const dot = state === 'commenting' ? '#3FA268' : state === 'moderator' ? K.deepGold : '#C9BDA9';
  return (
    <li className="flex items-center gap-2.5 min-w-0" style={{ padding: '8px 10px 8px 8px', borderRadius: 14, background: moderator ? K.surface : 'transparent', boxShadow: moderator ? K.outSm : 'inset 0 0 0 1px rgba(28,20,16,0.07)' }}>
      <span className="relative inline-flex shrink-0">
        {country
          ? <CircleFlag country={name} size={38} decorative ring={moderator ? K.gold : true} />
          : (
            <span aria-hidden className="inline-flex items-center justify-center" style={{
              width: 38, height: 38, borderRadius: 999, fontSize: T.body, fontWeight: W.section,
              background: moderator ? `radial-gradient(circle at 35% 30%, #F7EBB5, ${K.gold} 60%, ${K.deepGold})` : K.ivory,
              color: K.forest, boxShadow: moderator ? '0 4px 10px -5px rgba(182,135,31,0.9)' : K.inSm,
              opacity: live ? 1 : 0.6,
            }}>{flagMonogram(name)}</span>
          )}
        <span aria-hidden style={{ position: 'absolute', bottom: -1, insetInlineEnd: -1, width: 11, height: 11, borderRadius: 11, background: dot, boxShadow: `0 0 0 2px ${moderator ? K.surface : K.page}` }} />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block truncate" style={{ fontSize: T.body, fontWeight: W.label, color: live ? K.ink : K.inkSoft }}>
          {name}{isMe && <span style={{ marginInlineStart: 5, fontSize: T.caption, fontWeight: W.label, color: K.forestMid }}>{youLabel}</span>}
        </span>
        <span className="flex items-center gap-1" style={{ marginTop: 1, fontSize: T.caption, fontWeight: W.label, color: moderator ? '#7A5812' : K.inkSoft }}>
          {moderator ? <Gavel size={11} strokeWidth={2.6} aria-hidden /> : state === 'commenting' ? <MessageSquareText size={11} strokeWidth={2.4} aria-hidden /> : <Eye size={11} strokeWidth={2.4} aria-hidden />}
          {stateLabel}
        </span>
      </span>
    </li>
  );
}

export default function AccessTab({ committee, s, upd, isViewOnly, myChairName, t, displayChairSuffix, onlineChairs }: TabProps & {
  displayChairSuffix: string;
  /** Chair names on the chair-presence channel. Undefined on the voting page (no channel). */
  onlineChairs?: ReadonlySet<string>;
}) {
  const headChair = committee.dbHeadChair || committee.chairNames?.[0] || '';
  const gavelAt = clampGavelSeconds(s.gavelSoundAtSeconds ?? GAVEL_DEFAULT_SECONDS);
  const [knocking, setKnocking] = useState(false);
  const dim = isViewOnly ? { opacity: 0.55, pointerEvents: 'none' as const } : undefined;

  // chair_names plus anyone on the presence channel who opened the link without the join page.
  const listed = committee.chairNames ?? [];
  const chairs = [...listed, ...[...(onlineChairs ?? [])].filter((n) => n && !listed.includes(n))];
  if (myChairName && !chairs.includes(myChairName)) chairs.push(myChairName);
  const stateOf = (name: string): ChairState => {
    if (name === headChair) return 'moderator';
    if (!onlineChairs) return 'viewing';
    return onlineChairs.has(name) ? 'commenting' : 'offline';
  };
  const stateLabel: Record<ChairState, string> = {
    moderator: t('stg_role_moderator'),
    commenting: t('stg_chair_state_commenting'),
    viewing: t('stg_chair_state_viewing'),
    offline: t('stg_chair_state_offline'),
  };

  return (
    <div>
      <Section icon={KeyRound} title={t('stg_access_codes')} hint={t('stg_access_codes_hint')} lead>
        <div className="flex flex-wrap gap-2.5" style={{ padding: '10px 0' }}>
          <CodeTicket tone="forest" label={t('settings_session_code_label')} code={committee.code} caption={t('stg_session_code_caption')}
            copiedLabel={t('stg_copied')} copyLabel={t('stg_copy')} />
          <CodeTicket tone="ivory" secret label={t('settings_chair_code_label')} code={displayChairSuffix} caption={t('stg_chair_code_caption')}
            copiedLabel={t('stg_copied')} copyLabel={t('stg_copy')} />
        </div>
      </Section>

      {/* The dais at a glance. Taking the gavel still lives in one place, the top-bar chip;
          the full roster with devices and removals is the People tab. */}
      <Section icon={Users} title={t('stg_people_chairs')} hint={t('stg_dais_hint')} delay={40}>
        <ul className="grid gap-1.5" style={{ listStyle: 'none', margin: 0, padding: '10px 0', gridTemplateColumns: 'repeat(auto-fill, minmax(196px, 1fr))' }}>
          {chairs.map((name) => (
            <ChairAvatar key={name} name={name} state={stateOf(name)} isMe={!!myChairName && name === myChairName}
              youLabel={t('gavel_you')} stateLabel={stateLabel[stateOf(name)]} />
          ))}
          {chairs.length === 0 && <li style={{ fontSize: T.body, color: K.inkSoft, padding: '4px 2px' }}>{t('stg_dais_empty')}</li>}
        </ul>
      </Section>

      <div style={dim} aria-disabled={isViewOnly || undefined}>
        <Section icon={ShieldCheck} title={t('stg_access_floor')} hint={t('stg_access_floor_hint')} lead delay={80}>
          <RowGrid min={290}>
            <SettingRow dense labelId="stg-appr" label={t('settings_chair_approval_label')} hint={t('settings_chair_approval_note')}
              control={<GavelSwitch size="sm" glyph="lock" icon={DoorOpen} labelledBy="stg-appr" checked={s.requireChairApproval} onChange={(v) => upd('requireChairApproval', v)} />} />
            <SettingRow dense labelId="stg-lockrc" label={t('stg_lock_rollcall_label')} hint={t('stg_lock_rollcall_note')}
              control={<GavelSwitch size="sm" glyph="lock" labelledBy="stg-lockrc" checked={s.lockDelegateRollCall} onChange={(v) => upd('lockDelegateRollCall', v)} />} />
            <SettingRow dense labelId="stg-gsl" label={t('settings_gsl_require_next_label')} hint={t('settings_gsl_require_next_note')}
              control={<GavelSwitch size="sm" icon={ListOrdered} labelledBy="stg-gsl" checked={s.gslRequireNextSpeaker} onChange={(v) => upd('gslRequireNextSpeaker', v)} />} />
            <SettingRow dense labelId="stg-chat" label={t('stg_disable_chat_label')} hint={t('stg_disable_chat_note')}
              control={<GavelSwitch size="sm" icon={MessageSquareOff} labelledBy="stg-chat" checked={s.disableChat} onChange={(v) => upd('disableChat', v)} />} />
          </RowGrid>
        </Section>

        <SectionPair>
          {/* Gavel knock, played only on the Moderator's device by src/lib/useGavelCue.ts. The
              Test button is a user gesture, so it also unlocks audio for the timer knocks. */}
          <Section icon={BellRing} title={t('settings_section_timer_sound')} delay={120}>
            <SettingRow first dense labelId="stg-knock" label={t('settings_gavel_sound_label')} hint={t('settings_gavel_sound_note')}
              control={<GavelSwitch size="sm" icon={BellRing} labelledBy="stg-knock" checked={s.gavelSoundEnabled !== false} onChange={(v) => upd('gavelSoundEnabled', v)} />} />
            {s.gavelSoundEnabled !== false && (
              <SettingRow dense label={t('settings_gavel_at_label')} hint={t('settings_gavel_at_note')}>
                <SecondsDial
                    label={t('settings_gavel_at_label')}
                    unit={t('motions_sec')}
                    value={gavelAt}
                    min={GAVEL_MIN_SECONDS}
                    max={GAVEL_MAX_SECONDS}
                    presets={[5, 10, 15, 30, 60, 120]}
                    format={formatSeconds}
                    clamp={clampGavelSeconds}
                    onChange={(v) => upd('gavelSoundAtSeconds', clampGavelSeconds(v))}
                    aside={(
                      <button type="button"
                        onClick={() => { primeGavelAudio(); playGavelKnock(); setKnocking(true); setTimeout(() => setKnocking(false), 500); }}
                        className="stg-focus stg-press inline-flex items-center gap-1.5 shrink-0"
                        style={{ height: 28, padding: '0 10px', borderRadius: 9, border: 'none', background: knocking ? K.gold : K.ivory, color: K.forest, fontSize: T.body, fontWeight: W.label, cursor: 'pointer', boxShadow: K.outSm }}>
                        <Volume2 size={14} strokeWidth={2.4} aria-hidden />
                        {t('settings_gavel_test')}
                      </button>
                    )}
                  />
              </SettingRow>
            )}
          </Section>

          <Section icon={Tag} title={t('stg_labels')} delay={160}>
            <SettingRow first dense htmlFor="stg-sponsor" label={t('stg_sponsor_label')} hint={t('stg_sponsor_note')}>
              <input
                id="stg-sponsor"
                type="text"
                value={s.sponsorLabel}
                placeholder={t('stg_sponsor_placeholder')}
                onChange={(e) => upd('sponsorLabel', e.target.value)}
                className="stg-focus w-full"
                style={{ height: 38, maxWidth: 300, borderRadius: 11, border: 'none', padding: '0 12px', fontSize: T.body, fontWeight: W.label, color: K.ink, background: K.ivory, boxShadow: K.inSm, fontFamily: K.font }}
              />
            </SettingRow>
          </Section>
        </SectionPair>
      </div>
    </div>
  );
}
