'use client';

import { useState } from 'react';
import { Ban, BellRing, Check, Copy, Eye, Gavel, KeyRound, Lock, MessageCircle, MessageSquareText, Smartphone, Volume2, Users } from 'lucide-react';
import { clampGavelSeconds, primeGavelAudio, playGavelKnock, GAVEL_MIN_SECONDS, GAVEL_MAX_SECONDS, GAVEL_DEFAULT_SECONDS } from '@/lib/gavelSound';
import { getCountryByName, getCountryDisplayName } from '@/lib/countries';
import { SeatFlag } from '@/components/SeatFlag';
import { CircleFlag, flagMonogram } from '@/components/CircleFlag';
import { ACTION_SKINS, DG } from '@/components/delegate/DelegateUI';
import { K, T, W, LH, Section, SettingRow, GavelSwitch, InfoHint, TimeChooser } from './settingsKit';
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

// ── What delegates can do: the delegate phone's own controls, as switches ──────
/**
 * One delegate ability. The stage is a role=switch drawn as the control a delegate sees; OFF
 * greys it out and strikes it through, so a chair reads the room's rules at a glance. The
 * label and its hint sit beneath (a hint is focusable, so it cannot live inside the switch).
 */
function DelegateAbility({ id, label, hint, allowed, onChange, onLabel, offLabel, invert = false, children }: {
  id: string; label: string; hint: string; allowed: boolean; onChange: (v: boolean) => void;
  onLabel: string; offLabel: string;
  /** The replica is something the CHAIR sees only while delegates cannot do this (the
   *  approval request): it is live when the ability is off and set aside when it is on. */
  invert?: boolean;
  children: React.ReactNode;
}) {
  const live = invert ? !allowed : allowed;
  return (
    <div className="flex flex-col" style={{ borderRadius: 16, background: K.page, boxShadow: 'inset 0 0 0 1px rgba(28,20,16,0.07)', padding: 8 }}>
      <button type="button" role="switch" aria-checked={allowed} aria-labelledby={`${id}-label`} aria-describedby={`${id}-state`}
        onClick={() => onChange(!allowed)}
        className="stg-focus stg-press relative flex items-center justify-center overflow-hidden"
        style={{
          height: 150, borderRadius: 12, border: 'none', cursor: 'pointer', padding: 12,
          background: live ? DG.ivory : '#E4DED0',
          boxShadow: live ? 'inset 0 0 0 1.5px rgba(27,56,40,0.10)' : 'inset 0 0 0 1.5px rgba(28,20,16,0.06)',
        }}>
        <span aria-hidden className="flex items-center justify-center" style={{
          filter: live ? 'none' : 'grayscale(1)', opacity: live ? 1 : 0.42,
          transitionProperty: 'opacity, filter', transitionDuration: '200ms',
        }}>
          {children}
        </span>
        {!live && (
          /* The strike: one line corner to corner over the replica. Red when delegates are
             blocked; a quiet ink line when an inverted replica is simply not needed. */
          <span aria-hidden className="absolute" style={{ left: '12%', right: '12%', top: '50%', height: 3, borderRadius: 3, background: allowed ? K.inkSoft : K.danger, opacity: allowed ? 0.5 : 0.8, transform: 'rotate(-18deg)' }} />
        )}
        {!allowed && (
          <span aria-hidden className="absolute inline-flex items-center justify-center" style={{ top: 8, insetInlineEnd: 8, width: 26, height: 26, borderRadius: 999, background: K.surface, color: K.danger, boxShadow: K.outSm }}>
            <Ban size={15} strokeWidth={2.6} />
          </span>
        )}
      </button>
      <div className="flex items-center gap-1.5" style={{ padding: '10px 4px 2px', minHeight: 36 }}>
        <span id={`${id}-label`} className="min-w-0" style={{ fontSize: T.body, fontWeight: W.section, color: K.ink, lineHeight: LH.body }}>{label}</span>
        <InfoHint text={hint} />
        <span className="flex-1" aria-hidden />
        <span id={`${id}-state`} className="inline-flex items-center gap-1 shrink-0" style={{
          height: 24, padding: '0 9px', borderRadius: 999, fontSize: T.caption, fontWeight: W.section,
          background: allowed ? 'rgba(27,56,40,0.09)' : K.dangerTint, color: allowed ? K.forestMid : K.danger,
        }}>
          {allowed ? <Check size={11} strokeWidth={3} aria-hidden /> : <Ban size={11} strokeWidth={2.8} aria-hidden />}
          {allowed ? onLabel : offLabel}
        </span>
      </div>
    </div>
  );
}

/** The gold Chat key from the delegate phone's action column (SquareButton, skin gold). */
function ChatKeyReplica({ label }: { label: string }) {
  const skin = ACTION_SKINS.gold;
  return (
    <span className="block" style={{ width: 150, paddingBottom: 6, borderRadius: 18, background: skin.edge, boxShadow: '0 2px 3px rgba(27,56,40,0.16)' }}>
      <span className="flex flex-col justify-center" style={{ height: 104, gap: 10, padding: 16, borderRadius: 18, background: skin.bg, color: skin.fg, border: `2px solid ${DG.forest}` }}>
        <MessageCircle size={26} strokeWidth={2.25} />
        <span className="text-start" style={{ fontSize: T.section, fontWeight: W.title, lineHeight: 1.1, letterSpacing: '-0.01em' }}>{label}</span>
      </span>
    </span>
  );
}

/** The ROLL CALL caption and P / PV pill from the delegate hero (RollCallSwitch). */
function RollCallReplica({ caption }: { caption: string }) {
  return (
    <span className="flex flex-col items-center" style={{ gap: 6 }}>
      <span style={{ fontSize: T.caption, fontWeight: W.title, color: DG.body, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{caption}</span>
      <span className="relative inline-grid" style={{ gridTemplateColumns: '1fr 1fr', padding: 4, borderRadius: 999, background: DG.ivory, boxShadow: '0 0 0 1px rgba(27,56,40,0.10), 0 1px 2px rgba(27,56,40,0.08), inset 0 0 0 1px rgba(27,56,40,0.09), inset 0 1px 1.5px rgba(27,56,40,0.06)' }}>
        <span className="absolute" style={{ top: 4, bottom: 4, insetInlineStart: 'calc(50%)', width: 'calc(50% - 4px)', borderRadius: 999, background: `linear-gradient(135deg, ${DG.forestMid}, ${DG.forest})`, boxShadow: '0 3px 8px rgba(27,56,40,0.30)' }} />
        {['P', 'PV'].map((l, i) => (
          <span key={l} className="relative inline-flex items-center justify-center stg-num" style={{ minWidth: 64, height: 48, padding: '0 16px', fontSize: T.section, fontWeight: W.title, color: i === 1 ? DG.gold : DG.body }}>{l}</span>
        ))}
      </span>
    </span>
  );
}

/**
 * The request a chair gets when a delegation asks to join: the chair page's Waiting Room bar
 * (the `join-request` strip under the top bar), drawn with a sample delegation asking for
 * Present and Voting. Same pieces in the same order: the forest Waiting Room pill with its
 * count, then the request chip (flag, name, P+V, Approve, Deny).
 */
function JoinRequestReplica({ waitingRoom, country, approve, deny }: { waitingRoom: string; country: string; approve: string; deny: string }) {
  return (
    <span className="flex flex-col items-start" style={{ gap: 10, padding: 10, borderRadius: 12, background: '#F3EEE2', boxShadow: 'inset 0 -1px 0 rgba(27,56,40,0.4)', maxWidth: '100%' }}>
      <span className="inline-flex items-center gap-1.5" style={{ padding: '4px 10px', borderRadius: 999, background: DG.forest, color: '#EED98A', fontSize: T.caption, fontWeight: W.title, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        <span>🚪</span>{waitingRoom} · 1
      </span>
      <span className="flex flex-wrap items-center" style={{ gap: 8, padding: '5px 8px', borderRadius: 12, background: '#FAF8F3', border: '1px solid #DDD4C0', maxWidth: '100%' }}>
        <SeatFlag country="France" size={20} className="object-contain shrink-0" />
        <span style={{ fontSize: T.body, fontWeight: W.section, color: K.ink }}>{country}</span>
        <span className="stg-num" style={{ padding: '2px 8px', borderRadius: 999, background: DG.forest, color: '#EED98A', fontSize: T.caption, fontWeight: W.title }}>P+V</span>
        <span style={{ padding: '4px 10px', borderRadius: 8, background: DG.forest, color: '#EED98A', fontSize: T.caption, fontWeight: W.title }}>{approve}</span>
        <span style={{ padding: '4px 9px', borderRadius: 8, border: '1px solid rgba(139,32,32,0.4)', color: '#8B2020', fontSize: T.caption, fontWeight: W.section }}>{deny}</span>
      </span>
    </span>
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

export default function AccessTab({ committee, s, upd, isViewOnly, myChairName, t, language, displayChairSuffix, onlineChairs }: TabProps & {
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
        {/* Everything here is something a DELEGATE does, so each rule is drawn as the control
            they see on their phone and the chair switches the control itself on or off. ON
            always means "delegates can"; the stored keys keep their old sense (disableChat,
            lockDelegateRollCall, requireChairApproval), so the value is inverted on the way in
            and out and still written through `upd`. */}
        <Section icon={Smartphone} title={t('stg_delegates_can')} hint={t('stg_delegates_can_hint')} lead delay={80}>
          <div className="grid gap-3" style={{ padding: '12px 0 14px', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <DelegateAbility id="stg-can-chat" label={t('stg_can_chat')} hint={t('stg_can_chat_note')}
              onLabel={t('stg_can_on')} offLabel={t('stg_can_off')}
              allowed={!s.disableChat} onChange={(v) => upd('disableChat', !v)}>
              <ChatKeyReplica label={t('tab_chat')} />
            </DelegateAbility>
            <DelegateAbility id="stg-can-rollcall" label={t('stg_can_rollcall')} hint={t('stg_can_rollcall_note')}
              onLabel={t('stg_can_on')} offLabel={t('stg_can_off')}
              allowed={!s.lockDelegateRollCall} onChange={(v) => upd('lockDelegateRollCall', !v)}>
              <RollCallReplica caption={t('delegate_roll_call_label')} />
            </DelegateAbility>
            <DelegateAbility id="stg-can-join" label={t('stg_can_join')} hint={t('stg_can_join_note')}
              onLabel={t('stg_can_on')} offLabel={t('stg_can_off')}
              invert allowed={!s.requireChairApproval} onChange={(v) => upd('requireChairApproval', !v)}>
              <JoinRequestReplica waitingRoom={t('stg_waiting_room')} country={getCountryDisplayName('France', language)}
                approve={t('session_approve')} deny={t('session_deny')} />
            </DelegateAbility>
          </div>
        </Section>

        {/* Gavel knock, played only on the Moderator's device by src/lib/useGavelCue.ts. The
            Test button is a user gesture, so it also unlocks audio for the timer knocks. */}
        <Section icon={BellRing} title={t('settings_section_timer_sound')} delay={120}>
          <SettingRow first dense labelId="stg-knock" label={t('settings_gavel_sound_label')} hint={t('settings_gavel_sound_note')}
            control={<GavelSwitch size="sm" icon={BellRing} labelledBy="stg-knock" checked={s.gavelSoundEnabled !== false} onChange={(v) => upd('gavelSoundEnabled', v)} />} />
          {s.gavelSoundEnabled !== false && (
            <SettingRow dense label={t('settings_gavel_at_label')} hint={t('settings_gavel_at_note')}
              control={(
                <TimeChooser
                  label={t('settings_gavel_at_label')}
                  lessLabel={t('stg_knock_less', { n: 5 })}
                  moreLabel={t('stg_knock_more', { n: 5 })}
                  value={gavelAt}
                  min={GAVEL_MIN_SECONDS}
                  max={GAVEL_MAX_SECONDS}
                  step={5}
                  clamp={clampGavelSeconds}
                  onChange={(v) => upd('gavelSoundAtSeconds', clampGavelSeconds(v))}
                  aside={(
                    <button type="button"
                      onClick={() => { primeGavelAudio(); playGavelKnock(); setKnocking(true); setTimeout(() => setKnocking(false), 500); }}
                      className="stg-focus stg-press inline-flex items-center gap-1.5 shrink-0"
                      style={{ height: 34, padding: '0 12px', borderRadius: 10, border: 'none', background: knocking ? K.gold : K.ivory, color: K.forest, fontSize: T.body, fontWeight: W.label, cursor: 'pointer', boxShadow: K.outSm }}>
                      <Volume2 size={14} strokeWidth={2.4} aria-hidden />
                      {t('settings_gavel_test')}
                    </button>
                  )}
                />
              )} />
          )}
        </Section>
      </div>
    </div>
  );
}
