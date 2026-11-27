'use client';

// ── Pick a Conference (/store, prompt 90, 27 Nov 2026) ──────────────────────
//
// Every organiser action on /store (Book a spotlight, Pick a listing, Add
// credits, Buy emails) opens this one pop-up. The design board "Pick a
// Conference pop-up" on the canvas Motion to Save: Store and Black Friday:
// PurchaseShell in the LIGHT tone, exactly like the Spotlight and Promote
// pop-ups (owner, 27 Nov 2026).
//
//   - the conferences this person organises come from readOrganizedConferences
//     (the /jobs read; only conferences that have not ended);
//   - none: "You're not organising a conference yet" and Create a conference;
//   - one: straight to the action's own pop-up;
//   - several: a list; picking REPLACES this pop-up with the action's pop-up,
//     whose back arrow (PurchaseBackContext) returns to the list.
//
// The action pop-ups are the conference Store's own (SpotlightPopup,
// SponsorshipPopup, EmailsPopup) fed exactly what /manage/[slug]/store feeds
// them, through useStoreData; the Job Board is the existing PromotePopup with
// the conference's live listings (readConferencePromoteGroup, the /jobs read).
// Short of credits behaves as it does there (useStoreBuy inside the pop-ups;
// the Job Board's top-up through the useJobTopUp the caller passes).

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, ChevronRight, Loader2 } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { PurchaseBackContext, PurchaseShell, PURCHASE_CSS, INK, INK_SOFT, FOREST, IVORY } from '@/components/purchase/purchaseKit';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { DATES_TO_BE_DECIDED, formatConferenceDates } from '@/lib/conferenceDates';
import { notifyOk } from '@/lib/appNotify';
import { refreshCreditsEverywhere } from '@/hooks/useCredits';
import { readOrganizedConferences, type OrganizedConference } from '@/app/jobs/StandalonePostingPopup';
import { readConferencePromoteGroup, type ConfPromoteGroup } from '@/app/jobs/PostListingButton';
import { readStoreState, useStoreData, type Placement, type StoreAnswer } from '@/app/manage/[slug]/store/storeApi';
import { STORE_CSS as MANAGE_STORE_CSS } from '@/app/manage/[slug]/store/storeKit';
import SpotlightPopup from '@/app/manage/[slug]/store/SpotlightPopup';
import { PopupOfferDialog } from '@/app/manage/[slug]/store/SpotlightPopupEditor';
import SponsorshipPopup from '@/app/manage/[slug]/store/SponsorshipPopup';
import EmailsPopup from '@/app/manage/[slug]/store/EmailsPopup';
import PromotePopup from '@/app/manage/[slug]/jobs/PromotePopup';
import { dayLabel } from '@/app/manage/[slug]/jobs/jobsApi';
import type { TopUpRequest } from '@/app/manage/[slug]/jobs/useJobTopUp';

export type OrganiserAction =
  | { kind: 'spotlight'; placement: Placement }
  | { kind: 'jobs' }
  | { kind: 'sponsorship' }
  | { kind: 'emails' };

/** A conference row: the /jobs read, plus what the list and the pop-ups draw. */
interface PickRow extends OrganizedConference {
  full_name: string | null;
  logo_url: string | null;
  banner_url: string | null;
  city: string | null;
  country: string | null;
  start_date: string | null;
  end_date: string | null;
  dates_tbd: boolean | null;
  is_public: boolean | null;
  /** The conference's credits (my_store); null when it could not be read. */
  credits: number | null;
}

async function readRows(userId: string): Promise<PickRow[] | null> {
  const confs = await readOrganizedConferences(userId);
  if (!confs) return null;
  if (confs.length === 0) return [];
  const client = await getFreshAuthedClient();
  if (!client) return null;
  const ids = confs.map((c) => c.id);
  const [details, ...stores] = await Promise.all([
    client.from('conferences').select('id, logo_url, banner_url, city, country, start_date, end_date, dates_tbd, is_public').in('id', ids),
    ...ids.map((id) => client.rpc('my_store', { p_conf: id })),
  ]);
  const byId = new Map(((details.data ?? []) as (Omit<PickRow, keyof OrganizedConference | 'credits'> & { id: string })[]).map((d) => [d.id, d]));
  return confs.map((c, i) => {
    const d = byId.get(c.id);
    const st = stores[i] && !stores[i].error ? readStoreState(stores[i].data as StoreAnswer) : null;
    return {
      ...c,
      logo_url: d?.logo_url ?? null,
      banner_url: d?.banner_url ?? null,
      city: d?.city ?? null,
      country: d?.country ?? null,
      start_date: d?.start_date ?? null,
      end_date: d?.end_date ?? null,
      dates_tbd: d?.dates_tbd ?? null,
      is_public: d?.is_public ?? null,
      credits: st && st.can_use ? st.conference_credits : null,
    };
  });
}

function datesLine(c: PickRow): string {
  const dates = c.dates_tbd ? DATES_TO_BE_DECIDED : formatConferenceDates(c.start_date, c.end_date, { fallback: DATES_TO_BE_DECIDED });
  return c.city ? `${dates} · ${c.city}` : dates;
}

export default function OrganiserConferencePicker({ action, eyebrow, onClose, jobTopUp }: {
  action: OrganiserAction;
  /** What is being bought and its price, e.g. "Homepage Spotlight · 25 credits a week". */
  eyebrow: string;
  onClose: () => void;
  /** The caller's useJobTopUp(): it must outlive this pop-up, so the retry still lands. */
  jobTopUp: (req: TopUpRequest) => void;
}) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [rows, setRows] = useState<PickRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [picked, setPicked] = useState<PickRow | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void readRows(userId).then((r) => {
      if (cancelled) return;
      if (!r) { setFailed(true); return; }
      setFailed(false);
      setRows(r);
      if (r.length === 1) setPicked(r[0]);
    });
    return () => { cancelled = true; };
  }, [userId, attempt]);

  const several = !!rows && rows.length > 1;
  const back = useCallback(() => setPicked(null), []);

  if (picked) {
    return (
      <PurchaseBackContext.Provider value={several ? back : null}>
        <ActionStep conf={picked} action={action} eyebrow={eyebrow} onClose={onClose} jobTopUp={jobTopUp} />
      </PurchaseBackContext.Provider>
    );
  }

  return (
    <PurchaseShell tone="light" label="Pick a Conference" onClose={onClose} panelClass="gv-ocp" testId="store-pick-conference">
      <style>{PURCHASE_CSS}{CSS}</style>
      <div className="gv-ocp-col">
        <p className="gv-buy-eyebrow">{eyebrow}</p>
        {failed ? (
          <>
            <h2 className="gv-buy-title">Pick a Conference</h2>
            <p className="gv-buy-sub" role="alert">
              Your conferences could not be read just now.{' '}
              <button type="button" className="gv-ocp-a" onClick={() => { setFailed(false); setAttempt((n) => n + 1); }}>Try again</button>
            </p>
          </>
        ) : !rows ? (
          <>
            <h2 className="gv-buy-title">Pick a Conference</h2>
            <ul className="gv-ocp-list" aria-busy="true" aria-label="Loading">
              {[0, 1].map((i) => <li key={i} className="gv-ocp-skel" />)}
            </ul>
          </>
        ) : rows.length === 0 ? (
          <div className="gv-ocp-empty">
            <CalendarDays size={30} strokeWidth={1.5} aria-hidden style={{ color: FOREST }} />
            <h2 className="gv-ocp-empty-t">You&apos;re not organising a conference yet</h2>
            <p className="gv-buy-sub" style={{ marginTop: 0 }}>Create your conference on Gavelling, then come back to promote it.</p>
            <Link href="/conferences/new" className="gv-ocp-btn" onClick={onClose}>Create a conference</Link>
          </div>
        ) : (
          <>
            <h2 className="gv-buy-title">Pick a Conference</h2>
            <p className="gv-buy-sub">Choose which conference this is for</p>
            <ul className="gv-ocp-list">
              {rows.map((c) => {
                const name = c.full_name || c.acronym || 'Your conference';
                return (
                  <li key={c.id}>
                    <button type="button" className="gv-ocp-row" onClick={() => setPicked(c)}>
                      <span className="gv-ocp-logo" aria-hidden>
                        {c.logo_url
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={c.logo_url} alt="" width={40} height={40} />
                          : <span className="gv-ocp-acr">{(c.acronym || name).slice(0, 6)}</span>}
                      </span>
                      <span className="gv-ocp-id">
                        <span className="gv-ocp-name">{name}</span>
                        <span className="gv-ocp-meta">{datesLine(c)}</span>
                      </span>
                      {c.credits !== null && (
                        <span className="gv-ocp-bal" aria-label={`${c.credits} conference ${c.credits === 1 ? 'credit' : 'credits'}`}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src="/credit-token.webp" alt="" width={18} height={18} aria-hidden />
                          {c.credits.toLocaleString('en-US')}
                        </span>
                      )}
                      <ChevronRight size={18} strokeWidth={1.75} aria-hidden style={{ flexShrink: 0, color: FOREST }} />
                    </button>
                  </li>
                );
              })}
            </ul>
            {action.kind === 'spotlight' && (
              <p className="gv-ocp-fine">Spotlights are paid from the conference&apos;s credits, or yours if it runs short.</p>
            )}
          </>
        )}
      </div>
    </PurchaseShell>
  );
}

// ── The action's own pop-up for one conference ──────────────────────────────

function ActionStep({ conf, action, eyebrow, onClose, jobTopUp }: {
  conf: PickRow; action: OrganiserAction; eyebrow: string; onClose: () => void; jobTopUp: (req: TopUpRequest) => void;
}) {
  if (action.kind === 'jobs') return <JobsStep conf={conf} eyebrow={eyebrow} onClose={onClose} jobTopUp={jobTopUp} />;
  return <StoreStep conf={conf} action={action} eyebrow={eyebrow} onClose={onClose} />;
}

/** A small light pop-up for a step that is still reading or has nothing to show. */
function WaitShell({ eyebrow, title, onClose, children }: { eyebrow: string; title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <PurchaseShell tone="light" label={title} onClose={onClose} panelClass="gv-ocp">
      <style>{PURCHASE_CSS}{CSS}</style>
      <div className="gv-ocp-col">
        <p className="gv-buy-eyebrow">{eyebrow}</p>
        <h2 className="gv-buy-title">{title}</h2>
        {children}
      </div>
    </PurchaseShell>
  );
}

function StoreStep({ conf, action, eyebrow, onClose }: {
  conf: PickRow; action: Exclude<OrganiserAction, { kind: 'jobs' }>; eyebrow: string; onClose: () => void;
}) {
  const { data, loading, error, reload } = useStoreData(conf.id, conf.country);
  const [popupOffer, setPopupOffer] = useState<{ purchaseId: string; placements: Placement[] } | null>(null);
  const offerRef = useRef<typeof popupOffer>(null);
  const name = conf.acronym || conf.full_name || 'Your conference';

  // The conference Store's afterBuy: balances everywhere, then the Store's own read.
  const afterBuy = useCallback(() => {
    refreshCreditsEverywhere();
    void reload();
  }, [reload]);

  const shown = data.state;
  if (popupOffer) {
    // After a booking there is nothing to go back to: no back arrow here.
    return (
      <PurchaseBackContext.Provider value={null}>
        <PopupOfferDialog purchaseId={popupOffer.purchaseId} placements={popupOffer.placements} onClose={onClose} onSaved={() => afterBuy()} />
      </PurchaseBackContext.Provider>
    );
  }
  if (loading && !shown) {
    return (
      <WaitShell eyebrow={eyebrow} title={name} onClose={onClose}>
        <p className="gv-buy-sub" aria-busy="true"><Loader2 size={16} className="animate-spin" aria-hidden style={{ display: 'inline', verticalAlign: '-3px' }} /> Reading the conference Store</p>
      </WaitShell>
    );
  }
  if (!shown) {
    return (
      <WaitShell eyebrow={eyebrow} title={name} onClose={onClose}>
        <p className="gv-buy-sub" role="alert">{error ?? 'The Store could not be read.'} <button type="button" className="gv-ocp-a" onClick={() => { void reload(); }}>Try again</button></p>
      </WaitShell>
    );
  }
  if (!shown.can_use) {
    return (
      <WaitShell eyebrow={eyebrow} title={name} onClose={onClose}>
        <p className="gv-buy-sub">Your organizer role for this conference doesn&apos;t include the Store. Ask the conference owner to grant it.</p>
      </WaitShell>
    );
  }

  return (
    <>
      <style>{MANAGE_STORE_CSS}</style>
      <style>{PURCHASE_CSS}</style>
      {action.kind === 'spotlight' && (
        <SpotlightPopup
          conference={{
            id: conf.id, full_name: conf.full_name ?? '', acronym: conf.acronym ?? '', banner_url: conf.banner_url,
            country: conf.country ?? '', start_date: conf.start_date, end_date: conf.end_date,
            dates_tbd: conf.dates_tbd ?? false, is_public: conf.is_public ?? false,
          }}
          continent={data.continent}
          prices={data.prices}
          conferenceCredits={shown.conference_credits}
          yourCredits={shown.your_credits}
          placement={action.placement}
          onClose={() => { if (!offerRef.current) onClose(); }}
          onBooked={(b) => {
            afterBuy();
            if (b.purchaseId && b.placements.some((p) => p === 'country' || p === 'region')) {
              const offer = { purchaseId: b.purchaseId, placements: b.placements };
              offerRef.current = offer;
              setPopupOffer(offer);
            }
          }}
        />
      )}
      {action.kind === 'sponsorship' && (
        <SponsorshipPopup
          conferenceId={conf.id}
          available={shown.sponsorship.available}
          used={shown.sponsorship.used}
          conferenceCredits={shown.conference_credits}
          yourCredits={shown.your_credits}
          onClose={onClose}
          onDone={afterBuy}
        />
      )}
      {action.kind === 'emails' && (
        <EmailsPopup conferenceId={conf.id} email={data.email} yourCredits={shown.your_credits} initial="500" onClose={onClose} onDone={afterBuy} />
      )}
    </>
  );
}

function JobsStep({ conf, eyebrow, onClose, jobTopUp }: {
  conf: PickRow; eyebrow: string; onClose: () => void; jobTopUp: (req: TopUpRequest) => void;
}) {
  const [group, setGroup] = useState<ConfPromoteGroup | 'refused' | null>(null);
  const [attempt, setAttempt] = useState(0);
  const name = conf.acronym || conf.full_name || 'Your conference';

  useEffect(() => {
    let cancelled = false;
    void readConferencePromoteGroup(conf).then((g) => { if (!cancelled) setGroup(g); });
    return () => { cancelled = true; };
  }, [conf, attempt]);

  if (group === null) {
    return (
      <WaitShell eyebrow={eyebrow} title={name} onClose={onClose}>
        <p className="gv-buy-sub" aria-busy="true"><Loader2 size={16} className="animate-spin" aria-hidden style={{ display: 'inline', verticalAlign: '-3px' }} /> Reading your listings</p>
      </WaitShell>
    );
  }
  if (group === 'refused') {
    return (
      <WaitShell eyebrow={eyebrow} title={name} onClose={onClose}>
        <p className="gv-buy-sub" role="alert">
          This conference&apos;s Job Board could not be opened for promotion.{' '}
          <button type="button" className="gv-ocp-a" onClick={() => { setGroup(null); setAttempt((n) => n + 1); }}>Try again</button>
        </p>
      </WaitShell>
    );
  }
  if (group.listings.length === 0) {
    return (
      <WaitShell eyebrow={eyebrow} title="No live listings to promote yet" onClose={onClose}>
        <p className="gv-buy-sub">Drafts don&apos;t count. Publish a chair, secretariat or staff listing first.</p>
        <Link href={`/manage/${conf.slug}/team?tab=jobs`} className="gv-ocp-btn" onClick={onClose}>Post a listing</Link>
      </WaitShell>
    );
  }

  const first = group.listings[0];
  const okMessage = (a: Record<string, unknown>) => `Promoted until ${dayLabel(typeof a.ends_on === 'string' ? a.ends_on : null)}`;
  return (
    <PromotePopup
      listingId={first.id}
      listingTitle={first.title}
      choices={group.listings.length > 1 ? group.listings.map((l) => ({ id: l.id, title: l.title })) : undefined}
      conferenceCredits={group.credits}
      onClose={onClose}
      onDone={(endsOn) => {
        onClose();
        notifyOk(endsOn ? `Promoted until ${dayLabel(endsOn)}` : 'Promoted', 'jobs');
        refreshCreditsEverywhere();
      }}
      onShort={(req) => {
        onClose();
        jobTopUp({ need: req.need, retry: req.retry, okMessage, onSettled: () => refreshCreditsEverywhere() });
      }}
    />
  );
}

const CSS = `
.gv-buy-panel.gv-ocp{max-width:560px}
.gv-ocp-col{display:flex;flex-direction:column;gap:14px;padding:30px 28px 26px}
.gv-ocp-col .gv-buy-eyebrow{margin:0;padding-right:48px}
.gv-ocp-col .gv-buy-title{font-size:32px;padding-right:48px}
.gv-ocp-col .gv-buy-sub{margin:0}
.gv-ocp-list{list-style:none;margin:6px 0 0;padding:0;display:flex;flex-direction:column;gap:10px}
.gv-ocp-row{display:flex;align-items:center;gap:14px;width:100%;padding:12px 14px;border:none;border-radius:16px;background:#FFFFFF;box-shadow:0 1px 2px rgba(27,56,40,0.06),0 8px 22px -14px rgba(27,56,40,0.35);cursor:pointer;text-align:left;font:inherit;color:${INK};transition:transform 160ms ease-out,box-shadow 160ms ease-out}
.gv-ocp-row:hover{transform:translateY(-1px);box-shadow:0 0 0 1px ${FOREST},0 10px 26px -14px rgba(27,56,40,0.45)}
.gv-ocp-row:focus{outline:none}
.gv-ocp-row:focus-visible{box-shadow:0 0 0 2px ${FOREST}}
.gv-ocp-logo{flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;width:48px;height:48px;border-radius:50%;background:${IVORY};box-shadow:inset 0 0 0 1px rgba(28,20,16,0.08);overflow:hidden}
.gv-ocp-logo img{width:40px;height:40px;object-fit:contain}
.gv-ocp-acr{font-size:12px;font-weight:900;letter-spacing:-0.01em;color:${FOREST}}
.gv-ocp-id{min-width:0;flex:1;display:flex;flex-direction:column;gap:2px}
.gv-ocp-name{font-size:16px;font-weight:800;line-height:1.3;color:${INK};overflow-wrap:anywhere}
.gv-ocp-meta{font-size:13.5px;line-height:1.35;color:${INK_SOFT}}
.gv-ocp-bal{flex-shrink:0;display:inline-flex;align-items:center;gap:6px;font-size:15px;font-weight:800;color:${INK};font-variant-numeric:tabular-nums}
.gv-ocp-skel{height:72px;border-radius:16px;background:rgba(28,20,16,0.07);animation:gvOcpPulse 1.2s ease-in-out infinite}
@keyframes gvOcpPulse{0%,100%{opacity:1}50%{opacity:0.55}}
.gv-ocp-fine{margin:0;font-size:13px;line-height:1.5;color:${INK_SOFT}}
.gv-ocp-empty{display:flex;flex-direction:column;align-items:flex-start;gap:12px;margin-top:4px;padding:24px;border-radius:16px;background:${IVORY};box-shadow:inset 0 0 0 1px rgba(28,20,16,0.06)}
.gv-ocp-empty-t{margin:0;font-size:22px;font-weight:800;letter-spacing:-0.02em;line-height:1.2;color:${INK}}
.gv-ocp-btn{display:inline-flex;align-items:center;justify-content:center;align-self:flex-start;min-height:48px;padding:0 20px;border-radius:12px;background:linear-gradient(90deg,#1B3828 0%,#2A5A3C 55%,#1E4A31 100%);color:#FFFFFF;font-size:15px;font-weight:700;text-decoration:none}
.gv-ocp-btn:hover{background:linear-gradient(90deg,#22452F 0%,#316844 55%,#245638 100%)}
.gv-ocp-btn:focus{outline:none}
.gv-ocp-btn:focus-visible{box-shadow:0 0 0 2px ${IVORY},0 0 0 4px ${FOREST}}
.gv-ocp-a{background:none;border:none;padding:0;font:inherit;font-weight:800;color:${FOREST};text-decoration:underline;text-underline-offset:3px;cursor:pointer}
.gv-ocp-a:focus{outline:none}
.gv-ocp-a:focus-visible{outline:2px solid ${FOREST};outline-offset:2px;border-radius:4px}
@media (prefers-reduced-motion:reduce){.gv-ocp-row{transition:none}.gv-ocp-row:hover{transform:none}.gv-ocp-skel{animation:none}}
`;
