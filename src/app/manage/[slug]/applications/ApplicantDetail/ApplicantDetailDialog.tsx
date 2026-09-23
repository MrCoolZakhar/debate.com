'use client';

// The applicant pop-up on Manage → Applications.
//
// Modelled on the admin conference pop-up (admin/ConferenceDetailDialog.tsx):
// a forest hero with the person as protagonist, an ivory action bar, then the
// content. Unlike that dialog it has a FIXED height, so switching tabs never
// resizes it, and only the tab panel scrolls, so nothing (a shadow, a chip, a
// long answer) is ever cut off by the card's edge. On a phone it is a
// full-screen sheet with the decisions pinned to the bottom.
//
// Behaviour the page keeps owning, unchanged: every action and its handler
// (passed in as rendered nodes), Escape, the focus trap and the scroll lock
// (the page's effect works on `cardRef`), and closing (setReviewId(null)).

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { LayoutDashboard, ListOrdered, MessageSquareText, Trophy, Wallet, X, Users, Cake } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Portal from '@/components/Portal';
import ProfileLink from '@/components/ProfileLink';
import { CircleFlag } from '@/components/CircleFlag';
import { useApplicantCv, useApplicantLedger, ledgerTotals, type ApplicantApp } from './data';
import { OverviewTab, PreferencesTab, ExperienceTab, AnswersTab, type AnswerItem } from './tabs';
import PaymentTab, { type AidInfo } from './PaymentTab';
import { C, OUTFIT, realCode, roleName } from './kit';
import { type ApplicantTab, initialApplicantTab, writeApplicantTab } from './url';

export type { AnswerItem } from './tabs';
export type { AidInfo } from './PaymentTab';
export { useApplicantUrlSync } from './url';

const TAB_META: Record<ApplicantTab, { label: string; icon: LucideIcon }> = {
  overview: { label: 'Overview', icon: LayoutDashboard },
  preferences: { label: 'Preferences', icon: ListOrdered },
  experience: { label: 'Experience', icon: Trophy },
  answers: { label: 'Answers', icon: MessageSquareText },
  payment: { label: 'Payment', icon: Wallet },
};

const CSS = `
@keyframes apdScrimIn { from { opacity: 0 } to { opacity: 1 } }
@keyframes apdCardIn { from { opacity: 0; transform: translateY(12px) scale(0.985) } to { opacity: 1; transform: none } }
.apdScrim { animation: apdScrimIn 180ms cubic-bezier(0.22,1,0.36,1); padding: 24px; }
.apdCard {
  width: min(1000px, 100%);
  height: min(800px, 100%);
  display: flex; flex-direction: column; overflow: hidden;
  background: ${C.cream}; border-radius: 26px; border: 1.5px solid ${C.parchment};
  box-shadow: 0 28px 70px rgba(27,56,40,0.32);
  animation: apdCardIn 220ms cubic-bezier(0.22,1,0.36,1);
  font-family: ${OUTFIT};
}
.apdHero { padding: 22px 64px 20px 26px; }
.apdPad { padding-left: 26px; padding-right: 26px; }
.apdBody { flex: 1 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 22px 26px 30px; }
.apdTabs { display: flex; gap: 2px; overflow-x: auto; scrollbar-width: none; }
.apdTabs::-webkit-scrollbar { display: none; }
.apdTwo { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr); gap: 32px; align-items: start; }
.apdPrefGrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 10px; }
.apdCard button:focus-visible, .apdCard a:focus-visible, .apdCard [tabindex]:focus-visible {
  outline: 2.5px solid ${C.forestLight}; outline-offset: 2px;
}
.apdHero button:focus-visible, .apdHero a:focus-visible { outline-color: ${C.gold}; }
/* The page's overflow and payment menus are portaled out of the card. */
.appRevMenu button:focus-visible { outline: 2.5px solid ${C.forestLight}; outline-offset: 2px; }
.apdBig > .flex-col { flex-direction: row; }
.apdBig > .flex-col > * { flex: 1 1 0; min-width: 0; }
@media (max-width: 860px) {
  .apdTwo { grid-template-columns: minmax(0, 1fr); gap: 24px; }
}
@media (max-width: 640px) {
  .apdScrim { padding: 0; }
  .apdCard { width: 100%; height: 100%; height: 100dvh; border-radius: 0; border: none; }
  .apdHero { padding: 18px 56px 16px 16px; padding-top: max(18px, env(safe-area-inset-top)); }
  .apdPad { padding-left: 16px; padding-right: 16px; }
  .apdBody { padding: 18px 16px 24px; }
  .apdActions { order: 99; border-top: 1px solid ${C.parchment}; border-bottom: none !important; padding-bottom: max(12px, env(safe-area-inset-bottom)) !important; }
  .apdBig > .flex-col { flex-direction: column; }
  .apdPrefGrid { grid-template-columns: minmax(0, 1fr); }
  .apdAvatar, .apdAvatar > img, .apdAvatar > span:first-child { width: 58px !important; height: 58px !important; }
  .apdName { font-size: 21px !important; }
  .apdMoney { grid-template-columns: minmax(0, 1fr) !important; }
  .apdMoney > div { border-inline-start: none !important; }
  .apdMoney > div + div { border-top: 1px solid ${C.parchment}; }
}
@media (prefers-reduced-motion: reduce) { .apdScrim, .apdCard { animation: none; } }
`;

export default function ApplicantDetailDialog({
  app, name, email, age, cardRef, onClose, conferenceSlug, accessToken,
  chips, actions, actionsWithoutPayment, paymentControls, isDelegate, showsPreferences, feeCharged,
  experienceLevel, answerItems, orphanAnswers, listedExperience, showListedExperience, aid, onOpenDelegation,
}: {
  app: ApplicantApp;
  name: string;
  email: string;
  age: number | null;
  cardRef: RefObject<HTMLDivElement | null>;
  onClose: () => void;
  conferenceSlug: string;
  accessToken: string | null;
  /** The page's pill row (role, status, not attending, resubmitted, level). */
  chips: ReactNode;
  /** Every decision the old footer offered, rendered by the page. */
  actions: ReactNode;
  /** The same controls with the payment menu left out (it sits in the Payment tab instead). */
  actionsWithoutPayment: ReactNode;
  paymentControls: ReactNode;
  isDelegate: boolean;
  showsPreferences: boolean;
  feeCharged: boolean;
  experienceLevel: string;
  answerItems: AnswerItem[];
  orphanAnswers: AnswerItem[];
  listedExperience: ApplicantApp['experience_entries'];
  showListedExperience: boolean;
  aid: AidInfo | null;
  onOpenDelegation?: () => void;
}) {
  const tabs = useMemo<ApplicantTab[]>(
    () => (['overview', ...(showsPreferences ? ['preferences' as const] : []), 'experience', 'answers', 'payment'] as ApplicantTab[]),
    [showsPreferences],
  );
  const [tab, setTabState] = useState<ApplicantTab>(() => {
    const t = initialApplicantTab();
    return t && tabs.includes(t) ? t : 'overview';
  });
  const setTab = useCallback((t: ApplicantTab) => { setTabState(t); writeApplicantTab(t); }, []);
  const tabRefs = useRef<Partial<Record<ApplicantTab, HTMLButtonElement | null>>>({});
  const bodyRef = useRef<HTMLDivElement | null>(null);

  // A new tab starts at its top.
  useEffect(() => { bodyRef.current?.scrollTo({ top: 0 }); }, [tab]);

  // Data: the CV once per person, the ledger once per person and state, both
  // cached for the page session. The ledger is read for Overview too, because
  // Overview's payment summary must come from money, not from a flag.
  const cv = useApplicantCv(app.user_id, accessToken);
  const ledger = useApplicantLedger(app, accessToken);
  const totals = useMemo(() => ledgerTotals(ledger.data), [ledger.data]);

  const onTabKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const i = tabs.indexOf(tab);
    let next: number | null = null;
    if (e.key === 'ArrowRight') next = (i + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') next = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    if (next === null) return;
    e.preventDefault();
    const t = tabs[next];
    setTab(t);
    tabRefs.current[t]?.focus();
  };

  const nationality = app.profiles?.nationality ?? null;
  const natCode = realCode(nationality);
  const meta: ReactNode[] = [];
  meta.push(<span key="role">{roleName(app.role)}{app.is_head_delegate && app.role !== 'head-delegate' ? ', head delegate' : ''}</span>);
  if (age !== null) meta.push(<span key="age" className="inline-flex items-center gap-1"><Cake size={13} aria-hidden style={{ color: C.gold }} />{age}</span>);
  if (nationality) meta.push(<span key="nat" className="inline-flex items-center gap-1.5">{natCode && <CircleFlag code={natCode} size={16} decorative ring={false} />}{nationality}</span>);
  if (app.societies?.name) {
    meta.push(onOpenDelegation && app.society_id ? (
      <button
        key="soc"
        type="button"
        onClick={onOpenDelegation}
        title="Open this delegation"
        className="inline-flex items-center gap-1.5 focus:outline-none"
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: C.gold, fontFamily: OUTFIT, fontSize: 'inherit', fontWeight: 700, textDecoration: 'underline', textUnderlineOffset: 3, textDecorationColor: 'rgba(238,217,138,0.5)' }}
      >
        <Users size={13} aria-hidden />{app.societies.name}
      </button>
    ) : <span key="soc" className="inline-flex items-center gap-1.5"><Users size={13} aria-hidden style={{ color: C.gold }} />{app.societies.name}</span>);
  }

  return (
    <Portal>
      <div
        className="apdScrim fixed inset-0 z-50 flex items-center justify-center"
        style={{ background: 'rgba(16,28,20,0.5)' }}
        onClick={onClose}
      >
        <style>{CSS}</style>
        <div
          ref={cardRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="apd-name"
          className="apdCard"
          onClick={e => e.stopPropagation()}
        >
          {/* ── Hero: the person ── */}
          <header
            className="apdHero relative flex items-center gap-4 flex-shrink-0"
            style={{ background: `radial-gradient(120% 160% at 0% 0%, ${C.forestMid} 0%, ${C.forest} 62%)`, color: C.ivory }}
          >
            {/* Avatar → public MUN CV in a new tab, so the review stays open. */}
            <ProfileLink userId={app.user_id} name={name} newTab style={{ display: 'block', flexShrink: 0, position: 'relative' }}>
              <span className="apdAvatar block relative" style={{ width: 76, height: 76 }}>
                {app.profiles?.avatar_url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={app.profiles.avatar_url} alt="" className="object-cover" style={{ width: 76, height: 76, borderRadius: 999, border: `2.5px solid ${C.gold}`, boxShadow: '0 10px 24px rgba(0,0,0,0.3)' }} />
                ) : (
                  <span className="flex items-center justify-center" style={{ width: 76, height: 76, borderRadius: 999, background: 'linear-gradient(135deg, #3D7A52, #1B3828)', border: `2.5px solid ${C.gold}`, boxShadow: '0 10px 24px rgba(0,0,0,0.3)' }}>
                    <span style={{ fontFamily: OUTFIT, fontSize: 30, fontWeight: 900, color: C.gold }}>{name.trim().charAt(0).toUpperCase() || '?'}</span>
                  </span>
                )}
                {natCode && (
                  <span className="absolute" style={{ right: -4, bottom: -2, borderRadius: 999, border: `2.5px solid ${C.forest}`, lineHeight: 0 }}>
                    <CircleFlag code={natCode} size={28} label={nationality ?? undefined} title={nationality ?? undefined} ring={false} />
                  </span>
                )}
              </span>
            </ProfileLink>

            <div className="flex-1 min-w-0">
              <ProfileLink userId={app.user_id} name={name} newTab style={{ display: 'block', color: 'inherit', textDecoration: 'none' }}>
                <h2
                  id="apd-name"
                  className="apdName"
                  style={{
                    fontFamily: OUTFIT, fontSize: 26, fontWeight: 900, lineHeight: 1.1, letterSpacing: '-0.01em', color: '#FFFFFF',
                    overflowWrap: 'anywhere', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                  }}
                >
                  {name}
                </h2>
              </ProfileLink>
              {email && (
                <p style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 500, color: 'rgba(237,231,216,0.78)', marginTop: 2, overflowWrap: 'anywhere' }}>{email}</p>
              )}
              <div className="flex items-center flex-wrap gap-x-3.5 gap-y-1 mt-2" style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 700, color: 'rgba(237,231,216,0.92)' }}>
                {meta.map((m, i) => (
                  <span key={i} className="inline-flex items-center gap-3.5">
                    {i > 0 && <span aria-hidden style={{ color: C.goldDeep, fontSize: 9 }}>◆</span>}
                    {m}
                  </span>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-2.5">{chips}</div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute flex items-center justify-center focus:outline-none"
              style={{
                top: 14, right: 14, width: 36, height: 36, borderRadius: 999, cursor: 'pointer',
                border: '1.5px solid rgba(238,217,138,0.35)', background: 'rgba(0,0,0,0.2)', color: C.ivory,
              }}
            >
              <X size={17} aria-hidden />
            </button>
          </header>

          {/* ── Decisions: always reachable, never scrolled away ── */}
          <div className="apdActions apdPad flex-shrink-0" style={{ paddingTop: 12, paddingBottom: 12, background: C.ivory, borderBottom: `1px solid ${C.parchment}` }}>
            <div className="apdDecision">{tab === 'payment' ? actionsWithoutPayment : actions}</div>
          </div>

          {/* ── Tabs ── */}
          <div
            role="tablist"
            aria-label="Application sections"
            className="apdTabs apdPad flex-shrink-0"
            onKeyDown={onTabKey}
            style={{ borderBottom: `1px solid ${C.parchment}`, background: C.cream }}
          >
            {tabs.map(t => {
              const on = t === tab;
              const Icon = TAB_META[t].icon;
              const badge = t === 'answers' ? answerItems.length + orphanAnswers.length
                : t === 'preferences' ? (app.application_preferences?.length ?? 0)
                : t === 'experience' ? (cv.data?.length ?? null)
                : null;
              return (
                <button
                  key={t}
                  ref={el => { tabRefs.current[t] = el; }}
                  role="tab"
                  id={`apd-tab-${t}`}
                  aria-selected={on}
                  aria-controls="apd-panel"
                  tabIndex={on ? 0 : -1}
                  onClick={() => setTab(t)}
                  className="inline-flex items-center gap-2 flex-shrink-0 focus:outline-none"
                  style={{
                    position: 'relative', padding: '13px 14px 12px', border: 'none', background: 'transparent', cursor: 'pointer',
                    fontFamily: OUTFIT, fontSize: 13.5, fontWeight: on ? 800 : 600, color: on ? C.forest : C.inkSoft,
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Icon size={16} strokeWidth={on ? 2.5 : 2.1} aria-hidden style={{ color: on ? C.goldDeep : C.inkSoft }} />
                  {TAB_META[t].label}
                  {badge !== null && badge > 0 && (
                    <span style={{ fontSize: 12, fontWeight: 700, color: on ? C.goldDeep : '#8C7E6E', fontVariantNumeric: 'tabular-nums' }}>{badge}</span>
                  )}
                  <span aria-hidden style={{ position: 'absolute', left: 10, right: 10, bottom: 0, height: 3, borderRadius: 3, background: on ? C.goldDeep : 'transparent' }} />
                </button>
              );
            })}
          </div>

          {/* ── The one scrolling plane ── */}
          <div ref={bodyRef} id="apd-panel" role="tabpanel" aria-labelledby={`apd-tab-${tab}`} tabIndex={-1} className="apdBody">
            {tab === 'overview' && (
              <OverviewTab
                app={app}
                isDelegate={isDelegate}
                conferenceSlug={conferenceSlug}
                experienceLevel={experienceLevel}
                cvCount={app.user_id ? (cv.data?.length ?? null) : 0}
                totals={totals}
                ledgerLoading={ledger.loading}
                feeCharged={feeCharged}
                age={age}
                onTab={setTab}
              />
            )}
            {tab === 'preferences' && <PreferencesTab app={app} />}
            {tab === 'experience' && (
              <ExperienceTab
                app={app}
                experienceLevel={experienceLevel}
                cv={cv.data}
                cvLoading={cv.loading}
                cvError={cv.error}
                onRetry={cv.reload}
                listedEntries={listedExperience}
                showListed={showListedExperience}
              />
            )}
            {tab === 'answers' && <AnswersTab items={answerItems} orphans={orphanAnswers} />}
            {tab === 'payment' && (
              <PaymentTab
                app={app}
                ledger={ledger.data}
                totals={totals}
                loading={ledger.loading}
                refreshing={ledger.refreshing}
                error={ledger.error}
                onReload={ledger.reload}
                accessToken={accessToken}
                conferenceSlug={conferenceSlug}
                paymentControls={paymentControls}
                feeCharged={feeCharged}
                aid={aid}
              />
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
}
