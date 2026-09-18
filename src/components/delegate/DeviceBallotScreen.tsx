'use client';

/**
 * The delegate's ballot for a device vote (src/lib/deviceVoting.ts).
 *
 * While the room is voting and a device ballot is open that this delegation is part of, the
 * whole delegate screen is replaced by the ballot: the paper's code and title, every choice
 * (In favour, In favour with rights, Abstain when allowed and the delegation is Present rather
 * than Present and voting, Against with rights, Against), a confirmation step, and afterwards
 * "Your vote" with Change vote until the chair reveals. No pass round. When this delegation
 * holds a veto (P5 or the chair's custom list, read from the committee row through
 * `vetoRulesFromRow`, the same rules the chair's verdict uses) and picks Against, the
 * confirmation becomes the veto double check: "This is a veto. Record it?" (18 Sep 2026). When the ballot closes
 * (result, rights speakers, back to debate) the normal delegate board returns.
 *
 * Reads `my_device_ballot` when the phase or the documents slice changes (every vote_state
 * write fires a documents event, which the page's session sync already refetches) and on a
 * light 10 s poll while the room is voting and the tab is visible. Nothing here writes
 * committee state (AGENTS.md rules 3 and 4).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Minus, X, Eye, Smartphone, ShieldAlert } from 'lucide-react';
import { useT, useLanguage } from '@/contexts/LanguageContext';
import { getCountryDisplayName } from '@/lib/countries';
import { getMyDeviceBallot, castDeviceVote, type MyDeviceBallot } from '@/lib/deviceVoting';
import { markDelegateActivity } from '@/lib/delegateIdle';
import type { Committee } from '@/lib/types';
import type { VoteChoice } from '@/lib/voteState';
import { DG, DelegateStyles } from '@/components/delegate/DelegateUI';
import { holdsVeto, isVetoChoice, vetoRulesFromRow } from '@/components/voting/vetoHolders';

const OUTFIT = "'Outfit', system-ui, sans-serif";

const CHOICE_KEY = {
  'for': 'voting_choice_for',
  'for-rights': 'voting_choice_for_rights',
  'abstain': 'voting_choice_abstain',
  'against-rights': 'voting_choice_against_rights',
  'against': 'voting_choice_against',
} as const satisfies Record<VoteChoice, string>;

export default function DeviceBallotScreen({ code, country, committee, accessToken }: {
  code: string;
  country: string;
  committee: Committee;
  accessToken?: string | null;
}) {
  const t = useT();
  const { language } = useLanguage();
  const [ballot, setBallot] = useState<MyDeviceBallot | null>(null);
  const [pick, setPick] = useState<VoteChoice | null>(null);
  const [changing, setChanging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<null | 'failed' | 'closed' | 'not_holder' | 'voted_elsewhere'>(null);
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || document.visibilityState === 'visible');
  const tokenRef = useRef(accessToken);
  useEffect(() => { tokenRef.current = accessToken; }, [accessToken]);
  const seqRef = useRef(0);
  const ballotIdRef = useRef<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const voting = committee.phase === 'voting' && !committee.endedAt && !committee.suspendedAt;
  const myStatus = committee.delegates.find((d) => d.country.trim().toLowerCase() === country.trim().toLowerCase())?.status;

  const refresh = useCallback(async () => {
    const ticket = ++seqRef.current;
    const b = await getMyDeviceBallot(code, country, tokenRef.current);
    if (ticket !== seqRef.current || b === undefined) return;   // a failed read changes nothing
    // A new ballot (a re-vote) starts clean.
    if ((b?.ballot ?? null) !== ballotIdRef.current) { setPick(null); setChanging(false); setError(null); }
    ballotIdRef.current = b?.ballot ?? null;
    setBallot(b);
  }, [code, country]);

  useEffect(() => {
    const on = () => setVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);

  // The phase, the documents slice (vote_state writes) and this delegation's status (Abstain).
  useEffect(() => {
    if (!voting) { seqRef.current++; return; }   // nothing renders while not voting; the next read replaces the ballot
    // eslint-disable-next-line react-hooks/set-state-in-effect -- an RPC read: state is set after it resolves, never synchronously.
    void refresh();
  }, [voting, committee.documents, myStatus, refresh]);

  useEffect(() => {
    if (!voting || !visible) return;
    const timer = setInterval(() => { void refresh(); }, 10000);
    return () => clearInterval(timer);
  }, [voting, visible, refresh]);

  // Move focus into the ballot when it opens (or a re-vote replaces it), so keyboard and
  // screen-reader users land on it instead of the board it covers.
  const openBallotId = voting && ballot ? ballot.ballot : null;
  useEffect(() => {
    if (openBallotId) rootRef.current?.focus({ preventScroll: true });
  }, [openBallotId]);

  if (!voting || !ballot) return null;

  const cast = async (choice: VoteChoice) => {
    markDelegateActivity();
    setSaving(true);
    setError(null);
    const r = await castDeviceVote(code, ballot.documentId, country, choice, tokenRef.current);
    setSaving(false);
    if (r === 'ok') {
      setBallot((prev) => (prev && prev.ballot === ballot.ballot ? { ...prev, choice } : prev));
      setPick(null);
      setChanging(false);
      void refresh();
      return;
    }
    if (r === 'no_rights') { setError('failed'); setPick(null); return; }
    if (r === 'closed' || r === 'revealed' || r === 'no_ballot' || r === 'not_in_ballot') { setError('closed'); setPick(null); void refresh(); return; }
    if (r === 'not_holder') { setError('not_holder'); setPick(null); return; }
    if (r === 'voted_elsewhere') { setError('voted_elsewhere'); setPick(null); setChanging(false); void refresh(); return; }
    setError('failed');
  };

  const showChoices = ballot.holder && !ballot.votedElsewhere && !ballot.revealed && (!ballot.choice || changing);
  // Settings → Voting → "Votes with rights" (default on), read from the committee row. There is
  // no Pass on a device ballot, so `allowPass` does not apply here. cast_device_vote refuses a
  // rights choice when the setting is off (`no_rights`), and the reveal counts one cast before
  // the switch as the plain vote.
  const allowRights = (committee.dbSettings as { allowRightsVotes?: unknown } | undefined)?.allowRightsVotes !== false;
  const options: { choice: VoteChoice; tone: 'for' | 'against' | 'neutral'; label: string; sub?: string }[] = [
    { choice: 'for', tone: 'for', label: t('voting_in_favour') },
    ...(allowRights ? [{ choice: 'for-rights' as VoteChoice, tone: 'for' as const, label: t('voting_in_favour'), sub: t('voting_with_rights_label') }] : []),
    ...(ballot.mayAbstain ? [{ choice: 'abstain' as VoteChoice, tone: 'neutral' as const, label: t('voting_abstain') }] : []),
    ...(allowRights ? [{ choice: 'against-rights' as VoteChoice, tone: 'against' as const, label: t('voting_against'), sub: t('voting_with_rights_label') }] : []),
    { choice: 'against', tone: 'against', label: t('voting_against') },
  ];
  // The veto double check (owner, 18 Sep 2026): the same question the chair's roll call asks.
  const vetoPick = !!pick && isVetoChoice(pick)
    && holdsVeto(vetoRulesFromRow(committee.name, committee.dbSettings as Record<string, unknown> | undefined), country);
  const skin = (tone: 'for' | 'against' | 'neutral') => tone === 'for'
    ? { bg: '#2F6B45', fg: '#FFFFFF', sub: 'rgba(238,217,138,0.95)', icon: <Check size={22} strokeWidth={3} aria-hidden /> }
    : tone === 'against'
    ? { bg: DG.danger, fg: '#FFFFFF', sub: 'rgba(255,222,190,0.95)', icon: <X size={22} strokeWidth={3} aria-hidden /> }
    : { bg: DG.cream, fg: DG.ink, sub: DG.faint, icon: <Minus size={22} strokeWidth={3} aria-hidden /> };

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby="dvote-title"
      className="fixed inset-0 overflow-y-auto focus:outline-none"
      style={{ zIndex: 1100, background: DG.ivory, fontFamily: OUTFIT }}
    >
      <DelegateStyles />
      <div className="min-h-full w-full max-w-lg mx-auto flex flex-col px-5 pt-8 pb-10" style={{ paddingInline: 'max(20px, env(safe-area-inset-left))' }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: DG.deepGold }}>
          {t('dvote_eyebrow')} · {getCountryDisplayName(country, language)}
        </p>
        <p style={{ margin: '14px 0 0', fontSize: 13, fontWeight: 800, letterSpacing: '0.06em', color: DG.forestMid }}>{ballot.docCode}</p>
        <h1 id="dvote-title" className="[text-wrap:balance]" style={{ margin: '4px 0 0', fontSize: 'clamp(22px, 6.5vw, 30px)', fontWeight: 900, lineHeight: 1.15, letterSpacing: '-0.015em', color: DG.forest }}>
          {ballot.title}
        </h1>

        {error && (
          <p role="alert" style={{ margin: '16px 0 0', padding: '10px 12px', borderRadius: 12, background: 'rgba(139,32,32,0.10)', color: DG.danger, fontSize: 14, fontWeight: 700 }}>
            {t(error === 'failed' ? 'dvote_failed' : error === 'closed' ? 'dvote_closed' : error === 'voted_elsewhere' ? 'dvote_voted_elsewhere' : 'dvote_not_holder')}
          </p>
        )}

        {!ballot.holder && (
          <div className="flex flex-col items-center text-center" style={{ marginTop: 40, gap: 12 }}>
            <Smartphone size={40} strokeWidth={1.8} aria-hidden style={{ color: DG.faint }} />
            <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: DG.body }}>{t('dvote_not_holder')}</p>
          </div>
        )}

        {ballot.holder && ballot.votedElsewhere && !ballot.revealed && error !== 'voted_elsewhere' && (
          <div className="flex flex-col items-center text-center" style={{ marginTop: 40, gap: 12 }}>
            <Smartphone size={40} strokeWidth={1.8} aria-hidden style={{ color: DG.faint }} />
            <p role="status" style={{ margin: 0, fontSize: 16, fontWeight: 600, color: DG.body }}>{t('dvote_voted_elsewhere')}</p>
          </div>
        )}

        {ballot.holder && ballot.revealed && (
          <div className="flex flex-col items-center text-center" style={{ marginTop: 40, gap: 12 }}>
            <Eye size={40} strokeWidth={1.8} aria-hidden style={{ color: DG.forest }} />
            <p role="status" style={{ margin: 0, fontSize: 18, fontWeight: 800, color: DG.forest }}>
              {t('dvote_revealed', { choice: ballot.choice ? t(CHOICE_KEY[ballot.choice]) : '-' })}
            </p>
          </div>
        )}

        {ballot.holder && !ballot.votedElsewhere && !ballot.revealed && ballot.choice && !changing && (
          <div className="flex flex-col items-center text-center" style={{ marginTop: 36, gap: 14 }}>
            <span className="inline-flex items-center justify-center" style={{ width: 72, height: 72, borderRadius: 999, background: DG.forest, color: DG.gold }}>
              <Check size={36} strokeWidth={3} aria-hidden />
            </span>
            <p role="status" style={{ margin: 0, fontSize: 22, fontWeight: 900, color: DG.forest }}>
              {t('dvote_cast', { choice: t(CHOICE_KEY[ballot.choice]) })}
            </p>
            <p style={{ margin: 0, fontSize: 15, color: DG.body }}>{t('dvote_can_change')}</p>
            <button
              type="button"
              onClick={() => { markDelegateActivity(); setChanging(true); setError(null); }}
              className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] active:scale-[0.97] transition-transform"
              style={{ marginTop: 6, height: 48, padding: '0 22px', borderRadius: 14, border: 'none', background: DG.cream, color: DG.forest, fontSize: 15, fontWeight: 800, boxShadow: '0 0 0 1px rgba(27,56,40,0.14), 0 4px 12px rgba(27,56,40,0.10)' }}
            >
              {t('dvote_change')}
            </button>
          </div>
        )}

        {showChoices && (
          <>
            <p style={{ margin: '28px 0 12px', fontSize: 15, fontWeight: 700, color: DG.body }}>{t('dvote_choose')}</p>
            <div className="flex flex-col" style={{ gap: 10 }}>
              {options.map((o) => {
                const k = skin(o.tone);
                const current = ballot.choice === o.choice;
                return (
                  <button
                    key={o.choice}
                    type="button"
                    disabled={saving}
                    aria-pressed={current || undefined}
                    onClick={() => { markDelegateActivity(); setPick(o.choice); setError(null); }}
                    className="w-full flex items-center gap-3 text-start focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] focus-visible:ring-offset-2 active:scale-[0.98] transition-transform disabled:opacity-50"
                    style={{
                      minHeight: 64, padding: '10px 18px', borderRadius: 18, border: 'none', background: k.bg, color: k.fg,
                      boxShadow: `${o.tone === 'neutral' ? '0 0 0 1px rgba(27,56,40,0.14), ' : ''}0 4px 14px rgba(27,56,40,0.16)${current ? ', 0 0 0 3px #EDE7D8, 0 0 0 6px #D9B44A' : ''}`,
                    }}
                  >
                    {k.icon}
                    <span className="flex flex-col">
                      <span style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.1 }}>{o.label}</span>
                      {o.sub && <span style={{ fontSize: 14, fontWeight: 600, color: k.sub }}>{o.sub}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
            {!ballot.mayAbstain && myStatus === 'present-voting' && (
              <p style={{ margin: '12px 0 0', fontSize: 13, color: DG.faint }}>{t('dvote_pv_no_abstain')}</p>
            )}
            {changing && ballot.choice && (
              <button type="button" onClick={() => setChanging(false)}
                className="self-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] rounded"
                style={{ marginTop: 16, background: 'none', border: 'none', color: DG.forest, fontSize: 15, fontWeight: 700, textDecoration: 'underline' }}>
                {t('dvote_back')}
              </button>
            )}
          </>
        )}
      </div>

      {pick && showChoices && (
        <div className="fixed inset-0 flex items-end sm:items-center justify-center" style={{ zIndex: 1101, background: 'rgba(20,24,18,0.5)' }} onClick={() => { if (!saving) setPick(null); }}>
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="dvote-confirm-title"
            className="w-full sm:max-w-sm"
            style={{ background: DG.cream, borderRadius: '24px 24px 0 0', padding: '24px 22px calc(22px + env(safe-area-inset-bottom))', fontFamily: OUTFIT }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => { if (e.key === 'Escape' && !saving) setPick(null); }}
          >
            {vetoPick ? (
              <>
                <span className="inline-flex items-center justify-center" aria-hidden style={{ width: 48, height: 48, borderRadius: 999, background: '#3E2447', color: '#F3D98A' }}>
                  <ShieldAlert size={24} strokeWidth={2.4} />
                </span>
                <h2 id="dvote-confirm-title" style={{ margin: '12px 0 0', fontSize: 24, fontWeight: 900, lineHeight: 1.15, color: '#3E2447' }}>{t('voting_veto_confirm_title')}</h2>
                <p style={{ margin: '6px 0 0', fontSize: 15, lineHeight: 1.4, color: DG.body }}>{t('dvote_veto_body')}</p>
              </>
            ) : (
              <>
                <h2 id="dvote-confirm-title" style={{ margin: 0, fontSize: 15, fontWeight: 700, color: DG.body }}>{t('dvote_confirm_title')}</h2>
                <p style={{ margin: '6px 0 0', fontSize: 26, fontWeight: 900, color: pick.startsWith('for') ? '#2F6B45' : pick.startsWith('against') ? DG.danger : DG.ink }}>
                  {t(CHOICE_KEY[pick])}
                </p>
              </>
            )}
            <div className="flex" style={{ gap: 10, marginTop: 20 }}>
              <button type="button" autoFocus={vetoPick} disabled={saving} onClick={() => setPick(null)}
                className="flex-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] active:scale-[0.97] transition-transform disabled:opacity-50"
                style={{ height: 52, borderRadius: 14, border: 'none', background: DG.ivory, color: DG.ink, fontSize: 16, fontWeight: 700 }}>
                {t('dvote_back')}
              </button>
              {/* A veto is not pre-focused: the safe key (Back) is the default there. */}
              <button type="button" autoFocus={!vetoPick} disabled={saving} onClick={() => { void cast(pick); }}
                className="flex-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] active:scale-[0.97] transition-transform disabled:opacity-60"
                style={{ height: 52, borderRadius: 14, border: 'none', background: vetoPick ? DG.danger : DG.forest, color: vetoPick ? '#FFFFFF' : DG.gold, fontSize: 16, fontWeight: 800 }}>
                {saving ? t('dvote_saving') : vetoPick ? t('voting_veto_confirm_yes') : t('dvote_confirm_btn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
