'use client';

/**
 * Session Settings: a centred dialog that grows out of the Settings icon (GrowDialog), with
 * physical bookmark tabs along its spine. Mounted by /chair/[code] and /voting/[code].
 *
 * WRITES (unchanged by the redesign, AGENTS.md FEATURE: SETTINGS):
 *   - `upd` updates the local store at once and debounces (400 ms) a key-level patch of ONLY
 *     the keys changed since the last flush, through saveCommitteeSettings. Never a blob.
 *   - `updScoring` patches `{ scoring }` through updateCommitteeScoringInDB.
 *   - Both are no-ops for a Commenter (UI gate only, rule 15), and a refused write shows
 *     `settings_write_failed`.
 *   - The chair code is adopted from the DB and minted only when the DB has none.
 * The tabs in src/components/settings/ only render and call these.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Award, Eye, Gavel, KeyRound, Languages, ListOrdered, Sparkles, Star, Users, Vote, X, CircleAlert, Check } from 'lucide-react';
import GrowDialog from '@/components/GrowDialog';
import { Brand } from '@/components/Brand';
import { useSettingsStore, CommitteeSettings, DEFAULT_SCORING, type ScoringConfig } from '@/lib/settingsStore';
import { Committee } from '@/lib/types';
import { updateCommitteeChairSuffixInDB, saveCommitteeSettings, updateCommitteeScoringInDB } from '@/lib/committeeService';
import { useT, useLanguage } from '@/contexts/LanguageContext';
import type { Language } from '@/lib/translations';
import { K, T, W, LH, SettingsKitStyles, ConfirmSheet } from '@/components/settings/settingsKit';
import type { SettingsTab, TabProps } from '@/components/settings/settingsTypes';
import AccessTab from '@/components/settings/AccessTab';
import MotionsTab from '@/components/settings/MotionsTab';
import VotingTab from '@/components/settings/VotingTab';
import PointsTab from '@/components/settings/PointsTab';
import PeopleTab, { type ConfirmRequest } from '@/components/settings/PeopleTab';
import AwardsTab from '@/components/settings/AwardsTab';

type Icon = React.ComponentType<{ size?: number; strokeWidth?: number; 'aria-hidden'?: boolean | 'true'; style?: React.CSSProperties }>;

const LANGS: { code: Language; label: string }[] = [
  { code: 'en', label: 'EN' }, { code: 'es', label: 'ES' }, { code: 'fr', label: 'FR' }, { code: 'ar', label: 'ع' },
];

export function SettingsPanel({ committee, onClose, myChairName, isViewOnly = false, onlineChairs }: {
  committee: Committee;
  onClose: () => void;
  myChairName?: string;
  // UI GATE ONLY. RLS authenticates the SESSION (anyone holding the chair suffix can write
  // anything to it), never the chair's role. It hides and disables the write affordances for
  // a Commenter. Never a security boundary (AGENTS.md rule 15).
  isViewOnly?: boolean;
  /** Chair names live on the chair-presence channel (chair page only). */
  onlineChairs?: ReadonlySet<string>;
}) {
  const t = useT();
  const { language, setLanguage } = useLanguage();
  const [tab, setTab] = useState<SettingsTab>('access');
  const [writeFailed, setWriteFailed] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const { getSettings, updateSetting } = useSettingsStore();
  const s = getSettings(committee.code);
  const headChairName = committee.dbHeadChair || committee.chairNames?.[0] || '';
  const isConference = committee.sessionOrigin === 'conference';
  const rtl = language === 'ar';
  const scrollRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Partial<Record<SettingsTab, HTMLButtonElement | null>>>({});

  // ── Debounced key-level DB writes ───────────────────────────────────────────
  const WRITE_DEBOUNCE_MS = 400;
  const pendingSettings = useRef<Partial<CommitteeSettings> | null>(null);
  const pendingScoring = useRef<ScoringConfig | null>(null);
  const writeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushWrites = () => {
    if (writeTimer.current) { clearTimeout(writeTimer.current); writeTimer.current = null; }
    const settingsPatch = pendingSettings.current;
    const scoringPatch = pendingScoring.current;
    pendingSettings.current = null;
    pendingScoring.current = null;
    const suffix = committee.dbChairJoinSuffix ?? undefined;
    if (settingsPatch) {
      // ONLY the keys this chair changed since the last flush (D-1). saveCommitteeSettings is
      // a key-level patch RPC and drops headChair / headChairDevice / chairJoinSuffix /
      // agendaTopicIndex / votingReturnPhase defensively.
      void saveCommitteeSettings(committee.id, settingsPatch, committee.code, suffix)
        .then((ok) => { if (!ok) setWriteFailed(true); });
    }
    if (scoringPatch) {
      void updateCommitteeScoringInDB(committee.id, scoringPatch, committee.code, suffix)
        .then((ok) => { if (!ok) setWriteFailed(true); });
    }
  };
  const flushRef = useRef(flushWrites);
  useEffect(() => { flushRef.current = flushWrites; });

  const scheduleWrite = () => {
    if (writeTimer.current) clearTimeout(writeTimer.current);
    writeTimer.current = setTimeout(() => flushRef.current(), WRITE_DEBOUNCE_MS);
  };

  // Flush on unmount and on pagehide so a debounced change is never dropped.
  useEffect(() => {
    const onHide = () => flushRef.current();
    window.addEventListener('pagehide', onHide);
    return () => { window.removeEventListener('pagehide', onHide); flushRef.current(); };
  }, []);

  const upd = <Key extends keyof CommitteeSettings>(key: Key, value: CommitteeSettings[Key]) => {
    if (isViewOnly) return;
    updateSetting(committee.code, key, value);
    setWriteFailed(false);
    pendingSettings.current = { ...(pendingSettings.current ?? {}), [key]: value };
    scheduleWrite();
  };

  const scoring: ScoringConfig = s.scoring ?? DEFAULT_SCORING;
  const updScoring = (next: ScoringConfig) => {
    if (isViewOnly) return;
    updateSetting(committee.code, 'scoring', next);
    setWriteFailed(false);
    pendingScoring.current = next;
    scheduleWrite();
  };

  // ── Chair code. THE DB IS THE SOURCE OF TRUTH. ──────────────────────────────
  // The suffix is the only write credential AND the code every chair typed, so a new one is
  // minted ONLY when the DB genuinely has none; otherwise it is adopted locally, never written.
  const dbChairSuffix = committee.dbChairJoinSuffix ?? '';
  useEffect(() => {
    if (dbChairSuffix) {
      if (s.chairJoinSuffix !== dbChairSuffix) updateSetting(committee.code, 'chairJoinSuffix', dbChairSuffix);
      return;
    }
    if (isViewOnly) return;
    if (s.chairJoinSuffix) {
      updateCommitteeChairSuffixInDB(committee.id, s.chairJoinSuffix, committee.code, s.chairJoinSuffix);
      return;
    }
    const newSuffix = Math.floor(1000 + Math.random() * 9000).toString();
    updateSetting(committee.code, 'chairJoinSuffix', newSuffix);
    updateCommitteeChairSuffixInDB(committee.id, newSuffix, committee.code, newSuffix);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [committee.id, dbChairSuffix, s.chairJoinSuffix, isViewOnly]);
  const displayChairSuffix = dbChairSuffix || s.chairJoinSuffix || '????';

  // ── Tabs ────────────────────────────────────────────────────────────────────
  const tabs = useMemo(() => {
    const list: { id: SettingsTab; label: string; title: string; desc: string; icon: Icon }[] = [
      { id: 'access', label: t('stg_tab_access'), title: t('stg_access_title'), desc: t('stg_access_desc'), icon: KeyRound },
      { id: 'motions', label: t('settings_tab_motions'), title: t('stg_motions_title'), desc: t('stg_motions_desc'), icon: ListOrdered },
      { id: 'voting', label: t('settings_tab_voting'), title: t('stg_voting_title'), desc: t('stg_voting_desc'), icon: Vote },
      { id: 'points', label: t('settings_tab_points'), title: t('stg_points_title'), desc: t('stg_points_desc'), icon: Star },
      { id: 'people', label: t('stg_tab_people'), title: t('stg_people_title'), desc: t('stg_people_desc'), icon: Users },
    ];
    // Awards only exist for a committee run through a conference (PRD rule 8).
    if (isConference) list.push({ id: 'awards', label: t('stg_tab_awards'), title: t('stg_awards_title'), desc: t('stg_awards_desc'), icon: Award });
    return list;
  }, [t, isConference]);
  const active = tabs.find((x) => x.id === tab) ?? tabs[0];

  const selectTab = (id: SettingsTab, focus = false) => {
    setTab(id);
    scrollRef.current?.scrollTo({ top: 0 });
    if (focus) tabRefs.current[id]?.focus();
  };
  const onTabKey = (e: React.KeyboardEvent, i: number) => {
    let next = -1;
    if (e.key === 'ArrowDown' || e.key === (rtl ? 'ArrowLeft' : 'ArrowRight')) next = (i + 1) % tabs.length;
    else if (e.key === 'ArrowUp' || e.key === (rtl ? 'ArrowRight' : 'ArrowLeft')) next = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    if (next >= 0) { e.preventDefault(); selectTab(tabs[next].id, true); }
  };

  const requestConfirm = (req: ConfirmRequest) => { setConfirmError(null); setConfirmBusy(false); setConfirm(req); };
  const runConfirm = () => {
    if (!confirm || confirmBusy) return;
    setConfirmBusy(true);
    // Called synchronously inside the click, so a run that opens a tab stays a user gesture.
    void confirm.run().then((res) => {
      setConfirmBusy(false);
      if (res === true) setConfirm(null);
      else setConfirmError(res);
    });
  };

  const tabProps: TabProps = { committee, s, upd, scoring, updScoring, isViewOnly, myChairName, t, language };
  const panelId = 'stg-tabpanel';

  // Ribbon shapes: a swallowtail notch at the inline-end, mirrored in Arabic.
  const ribbon = rtl
    ? 'polygon(0 0, 100% 0, 100% 100%, 0 100%, 16px 50%)'
    : 'polygon(0 0, 100% 0, calc(100% - 16px) 50%, 100% 100%, 0 100%)';

  return (
    <GrowDialog
      originSelector='[data-tutorial="tab-settings"]'
      onClose={onClose}
      ariaLabel={t('stg_dialog_title')}
      /* % not vh: the dialog is portalled into the scaled #fit-root (see ScoreboardPanel). */
      panelClassName="w-full overflow-hidden flex"
      panelStyle={{ maxWidth: 1160, height: '90%', borderRadius: 28, background: K.page, boxShadow: '0 40px 90px -30px rgba(5,8,20,0.6), 0 0 0 1px rgba(27,56,40,0.10)', fontFamily: K.font }}
      backdropStyle={{ background: 'rgba(16,24,19,0.62)' }}
    >
      {(requestClose) => (
        <div className="stg-root relative flex w-full h-full min-h-0" dir={rtl ? 'rtl' : 'ltr'}>
          <SettingsKitStyles />
          {/* A clipped ribbon cannot show a box-shadow ring, so focus turns its stitching solid. */}
          <style>{`.stg-tab:focus-visible .stg-stitch { border: 2px solid ${K.deepGold} !important; } .stg-tab:not([aria-selected="true"]):hover { color: #FFF8E4 !important; background: linear-gradient(100deg, rgba(238,217,138,0.18), rgba(238,217,138,0.07)) !important; }`}</style>

          {/* ── Spine with bookmarks ── */}
          <nav aria-label={t('stg_dialog_title')} className="relative shrink-0 flex flex-col min-h-0 w-[78px] md:w-[236px]"
            style={{ zIndex: 2, background: `linear-gradient(180deg, ${K.forest} 0%, #17301F 100%)`, boxShadow: 'inset -1px 0 0 rgba(238,217,138,0.08)' }}>
            {/* Spine stitching. */}
            <span aria-hidden className="absolute" style={{ top: 18, bottom: 18, insetInlineStart: 10, borderInlineStart: '1px dashed rgba(238,217,138,0.16)' }} />
            {/* The dialog's own masthead: the Gavelling gavel mark, not a tiled glyph. */}
            <div className="flex items-center gap-2.5" style={{ padding: '20px 18px 16px 20px' }}>
              <Brand markOnly size={30} />
              <span className="hidden md:block min-w-0">
                <span className="block" style={{ fontSize: T.section, fontWeight: W.section, color: '#FFF8E4', lineHeight: LH.section }}>{t('stg_dialog_title')}</span>
                <span className="block truncate" style={{ marginTop: 2, fontSize: T.caption, fontWeight: W.label, color: 'rgba(243,234,208,0.72)' }} title={committee.name}>{committee.name}</span>
              </span>
            </div>

            <div role="tablist" aria-orientation="vertical" aria-label={t('stg_dialog_title')} className="flex flex-col gap-2 flex-1 min-h-0" style={{ padding: '6px 0 16px' }}>
              {tabs.map((x, i) => {
                const on = x.id === active.id;
                const TabIcon = x.icon;
                const gapBefore = x.id === 'people' || x.id === 'awards';
                return (
                  <div key={x.id} style={{ marginTop: gapBefore ? 12 : 0, filter: on ? 'drop-shadow(0 8px 10px rgba(5,12,8,0.35))' : undefined, paddingInlineStart: 12 }}>
                    <button
                      ref={(el) => { tabRefs.current[x.id] = el; }}
                      type="button"
                      role="tab"
                      id={`stg-tab-${x.id}`}
                      aria-selected={on}
                      aria-controls={panelId}
                      tabIndex={on ? 0 : -1}
                      onClick={() => selectTab(x.id)}
                      onKeyDown={(e) => onTabKey(e, i)}
                      className="stg-tab relative flex items-center gap-3 text-start"
                      title={x.label}
                      style={{
                        width: on ? 'calc(100% + 10px)' : 'calc(100% - 12px)',
                        height: 52, border: 'none', cursor: 'pointer', clipPath: ribbon,
                        paddingInlineStart: 16, paddingInlineEnd: 26,
                        background: on
                          ? `linear-gradient(100deg, #F6E7A8 0%, ${K.gold} 55%, #D9BC5E 100%)`
                          : 'linear-gradient(100deg, rgba(238,217,138,0.10), rgba(238,217,138,0.04))',
                        color: on ? K.forest : 'rgba(243,234,208,0.78)',
                        borderRadius: rtl ? '0 12px 12px 0' : '12px 0 0 12px',
                        transitionProperty: 'width, background-color, color', transitionDuration: '220ms', transitionTimingFunction: K.ease,
                      }}
                    >
                      {/* Stitching along the ribbon. */}
                      <span aria-hidden className="stg-stitch absolute" style={{ top: 5, bottom: 5, insetInlineStart: 5, insetInlineEnd: 20, borderRadius: 8, border: `1px dashed ${on ? 'rgba(27,56,40,0.22)' : 'rgba(238,217,138,0.12)'}`, pointerEvents: 'none' }} />
                      <TabIcon aria-hidden size={18} strokeWidth={on ? 2.5 : 2.1} style={{ position: 'relative', flexShrink: 0 }} />
                      <span className="relative hidden md:block truncate" style={{ fontSize: T.body, fontWeight: on ? W.section : W.label }}>{x.label}</span>
                      {x.id === 'awards' && !on && <Sparkles aria-hidden size={12} strokeWidth={2.4} style={{ position: 'relative', color: K.gold, marginInlineStart: 'auto', flexShrink: 0 }} />}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Language, at the foot of the spine. */}
            <div className="hidden md:block" style={{ padding: '14px 18px 20px 22px', borderTop: '1px solid rgba(238,217,138,0.08)' }}>
              <div className="flex items-center gap-2" style={{ marginBottom: 8, fontSize: T.caption, fontWeight: W.label, color: 'rgba(243,234,208,0.72)' }}>
                <Languages size={13} strokeWidth={2.4} aria-hidden />{t('settings_language')}
              </div>
              <div role="radiogroup" aria-label={t('settings_language')} className="grid grid-cols-4 gap-1" style={{ padding: 3, borderRadius: 12, background: 'rgba(0,0,0,0.18)' }}>
                {LANGS.map((l) => {
                  const on = language === l.code;
                  return (
                    <button key={l.code} type="button" role="radio" aria-checked={on} onClick={() => setLanguage(l.code)} lang={l.code}
                      aria-label={l.code === 'en' ? 'English' : l.code === 'es' ? 'Español' : l.code === 'fr' ? 'Français' : 'العربية'}
                      className="stg-focus stg-press" style={{ height: 30, borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: T.caption, fontWeight: on ? W.section : W.label, background: on ? K.gold : 'transparent', color: on ? K.forest : 'rgba(243,234,208,0.7)' }}>
                      {l.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </nav>

          {/* ── The page ── */}
          <div className="relative flex-1 min-w-0 flex flex-col min-h-0" style={{ background: `linear-gradient(180deg, ${K.page}, #F1EBDD)` }}>
            {/* One title per tab at T.title, then ONE short lead in inkSoft. The bookmark already
                names the tab, so there is no eyebrow repeating it. Group titles below are one
                step down the 1.6 scale (T.section, forest). */}
            <header className="shrink-0 flex items-start gap-4" style={{ padding: '22px 26px 16px 28px' }}>
              <div className="flex-1 min-w-0">
                <h2 id="stg-heading" className="stg-title" style={{ margin: 0, fontSize: T.title, fontWeight: W.title, letterSpacing: '-0.02em', color: K.ink, lineHeight: LH.title }}>{active.title}</h2>
                <p className="stg-body" style={{ margin: '6px 0 0', fontSize: T.body, fontWeight: W.body, lineHeight: LH.body, color: K.inkSoft, maxWidth: 560 }}>{active.desc}</p>
              </div>
              <div className="shrink-0 flex items-center gap-2">
                <span className={`${active.id === 'people' || active.id === 'awards' ? 'hidden' : 'hidden lg:inline-flex'} items-center gap-1.5`} aria-live="polite" style={{ height: 28, padding: '0 10px', borderRadius: 999, fontSize: T.caption, fontWeight: W.label, background: writeFailed ? K.dangerTint : 'rgba(27,56,40,0.06)', color: writeFailed ? K.danger : K.forestMid }}>
                  {isViewOnly ? <Eye size={13} strokeWidth={2.4} aria-hidden /> : writeFailed ? <CircleAlert size={13} strokeWidth={2.4} aria-hidden /> : <Check size={13} strokeWidth={2.8} aria-hidden />}
                  {isViewOnly ? t('stg_read_only') : writeFailed ? t('stg_not_saved') : t('stg_saves_instantly')}
                </span>
                <button type="button" onClick={requestClose} aria-label={t('sb_close')} className="stg-focus stg-press inline-flex items-center justify-center"
                  style={{ width: 38, height: 38, borderRadius: 12, border: 'none', background: K.surface, color: K.inkSoft, boxShadow: K.outSm, cursor: 'pointer' }}>
                  <X size={18} strokeWidth={2.4} />
                </button>
              </div>
            </header>

            {(writeFailed || isViewOnly) && (
              <div className="shrink-0" style={{ padding: '0 26px 10px 28px' }}>
                {writeFailed && (
                  <div role="alert" className="flex items-center gap-3" style={{ padding: '10px 14px', borderRadius: 14, background: K.dangerTint, color: K.danger, fontSize: T.body, fontWeight: W.label }}>
                    <CircleAlert size={16} strokeWidth={2.4} aria-hidden />
                    <span className="flex-1">{t('settings_write_failed')}</span>
                    <button type="button" onClick={() => setWriteFailed(false)} aria-label={t('sb_close')} className="stg-focus inline-flex items-center justify-center" style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: 'transparent', color: K.danger, cursor: 'pointer' }}><X size={15} strokeWidth={2.6} /></button>
                  </div>
                )}
                {isViewOnly && !writeFailed && (
                  <div className="flex items-center gap-3" style={{ padding: '10px 14px', borderRadius: 14, background: 'rgba(182,135,31,0.10)', color: '#6E5114', fontSize: T.body, fontWeight: W.body }}>
                    <Gavel size={16} strokeWidth={2.4} aria-hidden />
                    <span className="flex-1">
                      <strong style={{ fontWeight: W.section }}>{t('settings_view_only')}</strong>
                      {headChairName ? <> · {headChairName === myChairName ? t('gavel_device_elsewhere') : t('settings_view_only_chairing', { name: headChairName })}</> : null}
                    </span>
                  </div>
                )}
              </div>
            )}

            <div ref={scrollRef} id={panelId} role="tabpanel" aria-labelledby={`stg-tab-${active.id}`} tabIndex={-1}
              className="flex-1 min-h-0 overflow-y-auto" style={{ padding: '4px 26px 24px 28px', overscrollBehavior: 'contain' }}>
              <div key={active.id} style={{ maxWidth: 880 }}>
                {active.id === 'access' && <AccessTab {...tabProps} displayChairSuffix={displayChairSuffix} onlineChairs={onlineChairs} />}
                {active.id === 'motions' && <MotionsTab {...tabProps} />}
                {active.id === 'voting' && <VotingTab {...tabProps} />}
                {active.id === 'points' && <PointsTab {...tabProps} />}
                {active.id === 'people' && <PeopleTab {...tabProps} onlineChairs={onlineChairs} requestConfirm={requestConfirm} />}
                {active.id === 'awards' && isConference && <AwardsTab {...tabProps} requestConfirm={requestConfirm} />}
              </div>
            </div>
          </div>

          {confirm && (
            <ConfirmSheet
              title={confirm.title}
              body={confirm.body}
              confirmLabel={confirm.confirmLabel}
              cancelLabel={t('stg_cancel')}
              tone={confirm.tone}
              icon={confirm.icon}
              busy={confirmBusy}
              error={confirmError}
              onCancel={() => setConfirm(null)}
              onConfirm={runConfirm}
            />
          )}
        </div>
      )}
    </GrowDialog>
  );
}
