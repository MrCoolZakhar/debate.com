'use client';

/**
 * Marketing: paid announcements to Gavelling delegates (9 Oct 2026, reworked
 * 11 Oct 2026 as the "Marketing" button beside "Write an email").
 *
 * Two steps. First WHO: a short "How it works" card (who counts, our team
 * checks every one, at most one every 14 days and never two from the same
 * conference, unsubscribe), then three product cards in the Conference
 * Store's look (a 3D emoji in a tinted disc, the flat price as a big
 * number, one line saying who counts): the delegates in the conference's city,
 * in its country, or the whole world. NO reach numbers anywhere (owner,
 * 11 Oct 2026): the database only says whether anyone can get one there.
 * Then the email: heading, message, and the button as ONE compact row (type
 * the label straight onto the button, the link beside it), a preview, and
 * Send for review. Submitting emails our team inbox; nothing goes to anyone
 * else until a platform admin approves it in /admin.
 *
 * Built from the organiser kits: STORE_CSS (storeKit) and DASH_CSS
 * (financials/dashboardKit), EmojiIcon (commsKit: a Fluent 3D emoji in a
 * tinted disc), GoldWord for the title.
 *
 * The place is never chosen here: the database reads the conference's own
 * city and country. Prices come only from the database
 * (`paid_announcement_targets`); the buy runs through the Store's own
 * `useStoreBuy`, so a conference short of credits gets the credits pop-up for
 * exactly the difference and the request runs once more when the payment
 * lands. Until the SQL is applied every read answers `missing`: the three
 * cards are shown with "Coming soon" in place of a price, and no numbers.
 */

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  BellOff, Building2, CalendarClock, Globe2, Hourglass, Link2, Mail, MapPin, Megaphone, PenLine, Pencil, ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import { GoldWord } from '@/components/BrandHeading';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { useStoreBuy, rpcCall } from '../store/storeApi';
import { STORE_CSS, INK, INK_SOFT, FOREST, GOLD, DANGER, IVORY } from '../store/storeKit';
import { DASH_CSS } from '../financials/dashboardKit';
import { InfoHint } from '../settings/applicationsUi';
import {
  loadAnnouncementTargets, loadMyAnnouncements, cancelAnnouncement,
  placeName, statusWords, scopeTitle, whoCounts, normaliseButtonUrl, conferencePageUrl,
  ANNOUNCEMENT_SCOPES,
  type AnnouncementScope, type AnnouncementTargets, type AnnouncementItem, type AnnouncementOption,
} from '@/lib/paidAnnouncements';
import { BackLink, EmojiIcon } from './commsKit';

const HEADING_MAX = 80;
const BODY_MAX = 1200;
const BUTTON_MAX = 30;
const DEFAULT_BUTTON = 'See the conference';
const LINK_RE = /(https?:\/\/|www\.|[a-z0-9-]+\.(com|org|net|io|co|me|ly|app)\b|@)/i;

const SCOPE_ICON: Record<AnnouncementScope, LucideIcon> = {
  city: Building2,
  country: MapPin,
  world: Globe2,
};
/** The Fluent 3D emoji per scope (SCOPE_ICON is its fallback). */
const SCOPE_EMOJI: Record<AnnouncementScope, string> = {
  city: 'Cityscape',
  country: 'Round pushpin',
  world: 'Globe showing europe-africa',
};

/**
 * A white Store card with a 3D emoji in a gold disc, the title and an "i"
 * hint (always the gold wash, unlike the dashboard kit's DashCard).
 */
function AnnCard({ title, hint, line, emoji, icon, children, className, style }: {
  title: string; hint: string; line?: string; emoji: string; icon: LucideIcon; children?: ReactNode;
  className?: string; style?: React.CSSProperties;
}) {
  return (
    <section className={`gv-st-card gv-fd-card gv-fd-wash-gold${className ? ` ${className}` : ''}`} aria-label={title} style={style}>
      <div className="gv-st-card-head gv-fd-head">
        <EmojiIcon emoji={emoji} icon={icon} size={44} />
        <h2 className="gv-st-card-title">{title}</h2>
        <InfoHint label={`About ${title}`} text={hint} size={16} />
      </div>
      {line ? <p className="gv-st-card-line">{line}</p> : null}
      {children}
    </section>
  );
}

/** The rules, once, above the three choices. Short sentences, no numbers about reach. */
function HowItWorks({ capDays }: { capDays: number }) {
  const rows: { emoji: string; icon: LucideIcon; text: string }[] = [
    { emoji: 'Round pushpin', icon: MapPin, text: 'We pick people by the conferences they have been to: on Gavelling, or on their public MUN CV. For your country we also count people from there.' },
    { emoji: 'Shield', icon: ShieldCheck, text: 'Our team checks every announcement before it goes out. If we say no, every credit comes back.' },
    { emoji: 'Spiral calendar', icon: CalendarClock, text: `Each person gets at most one paid announcement every ${capDays} days, and never two from the same conference.` },
    { emoji: 'Bell with slash', icon: BellOff, text: 'Only delegates who chose to hear about conferences get it. Every email has an unsubscribe link.' },
  ];
  return (
    <section className="gv-st-card gv-ann-how" aria-label="How it works">
      <h2 className="gv-st-card-title" style={{ margin: '0 0 12px' }}>How It Works</h2>
      <ul className="gv-ann-how-list">
        {rows.map(r => (
          <li key={r.text}>
            <EmojiIcon emoji={r.emoji} icon={r.icon} size={36} />
            <span>{r.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

const ANN_CSS = `
.gv-ann-choices{display:grid;grid-template-columns:minmax(0,1fr);gap:16px}
@media (min-width:860px){.gv-ann-choices{grid-template-columns:repeat(3,minmax(0,1fr))}}
.gv-ann-choice{display:flex;flex-direction:column;width:100%;height:100%;text-align:left;border:none;font-family:inherit;cursor:pointer;transition:transform 200ms cubic-bezier(0.22,1,0.36,1),box-shadow 200ms ease}
.gv-ann-choice:hover{transform:translateY(-3px)}
.gv-ann-choice:focus{outline:none}
.gv-ann-choice:focus-visible{box-shadow:0 0 0 3px #FFFFFF,0 0 0 6px ${FOREST}}
.gv-ann-choice[data-chosen]{box-shadow:0 0 0 2px ${FOREST},0 18px 40px -26px rgba(27,56,40,0.55)}
.gv-ann-choice[aria-disabled="true"]{cursor:default}
.gv-ann-choice[aria-disabled="true"]:hover{transform:none}
.gv-ann-name{margin:14px 0 0;font-size:21px;font-weight:800;letter-spacing:-0.015em;line-height:1.2;color:${INK};overflow-wrap:anywhere;text-wrap:balance}
.gv-ann-nums{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 22px;margin:12px 0 0}
.gv-ann-num{display:inline-flex;align-items:baseline;gap:7px}
.gv-ann-num .gv-st-big{font-size:38px}
.gv-ann-num-word{font-size:15px;font-weight:700;color:${INK}}
.gv-ann-how{margin:0 0 22px}
.gv-ann-how-list{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:minmax(0,1fr);gap:12px 24px}
@media (min-width:860px){.gv-ann-how-list{grid-template-columns:repeat(2,minmax(0,1fr))}}
.gv-ann-how-list li{display:flex;align-items:flex-start;gap:12px;font-size:14px;line-height:1.5;color:${INK}}
.gv-ann-how-list li span:last-child{padding-top:7px}
.gv-ann-how-note{margin:8px 0 0;font-size:13px;line-height:1.5;color:${INK_SOFT}}
.gv-ann-who{margin:10px 0 0;font-size:14px;line-height:1.5;color:${INK_SOFT}}
.gv-ann-go{margin-top:auto;padding-top:16px}
.gv-ann-go .gv-st-btn{width:100%}
.gv-ann-why{margin:10px 0 0;font-size:13.5px;font-weight:600;color:${DANGER}}
.gv-ann-head{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:16px 28px;margin:0 0 22px}
.gv-ann-sum{display:flex;flex-wrap:wrap;align-items:center;gap:12px 18px;padding:14px 18px!important;margin:0 0 18px}
.gv-ann-sum-name{font-size:17px;font-weight:800;color:${INK};overflow-wrap:anywhere}
.gv-ann-sum-nums{display:flex;flex-wrap:wrap;gap:4px 16px;font-size:14px;color:${INK}}
.gv-ann-sum-nums b{font-size:20px;font-weight:900;color:${FOREST};font-variant-numeric:tabular-nums;margin-right:4px}
.gv-ann-sum-who{flex-basis:100%;margin:0;font-size:13.5px;line-height:1.5;color:${INK_SOFT}}
.gv-ann-input{width:100%;height:50px;padding:0 14px;border-radius:12px;border:1.5px solid rgba(27,56,40,0.28);background:#FFFFFF;color:${INK};font-family:inherit;font-size:16px}
.gv-ann-input:focus{outline:none;border-color:${FOREST};box-shadow:0 0 0 3px rgba(27,56,40,0.12)}
.gv-ann-cta{display:flex;flex-wrap:wrap;align-items:center;gap:10px}
.gv-ann-btn{display:inline-flex;align-items:center;gap:8px;min-height:50px;padding:0 16px;border-radius:12px;background:linear-gradient(90deg,#1B3828 0%,#2A5A3C 100%);box-shadow:0 8px 18px -12px rgba(27,56,40,0.7);cursor:text;flex-shrink:0;max-width:100%}
.gv-ann-btn:focus-within{box-shadow:0 0 0 2px #FFFFFF,0 0 0 4px ${GOLD},0 8px 18px -12px rgba(27,56,40,0.7)}
.gv-ann-btn input{background:transparent;border:none;outline:none;color:#FFFFFF;font-family:inherit;font-weight:700;font-size:16px;padding:0;min-width:0;max-width:100%}
.gv-ann-btn input::placeholder{color:rgba(255,255,255,0.7)}
.gv-ann-btn svg{color:${GOLD};flex-shrink:0}
.gv-ann-link{display:flex;align-items:center;gap:10px;flex:1 1 230px;min-width:0;height:50px;padding:0 14px;border-radius:12px;border:1.5px solid rgba(27,56,40,0.28);background:${IVORY}}
.gv-ann-link:focus-within{border-color:${FOREST};box-shadow:0 0 0 3px rgba(27,56,40,0.12);background:#FFFFFF}
.gv-ann-link[data-bad]{border-color:${DANGER}}
.gv-ann-link input{flex:1;min-width:0;background:transparent;border:none;outline:none;font-family:inherit;font-size:16px;color:${INK}}
.gv-ann-mail{border-radius:16px;padding:16px;background:#EDE7D8}
.gv-ann-mail-card{border-radius:14px;padding:20px;background:#FFFFFF;box-shadow:0 1px 0 rgba(27,56,40,0.06)}
.gv-ann-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:16px;align-items:start}
@media (min-width:1024px){.gv-ann-grid{grid-template-columns:minmax(0,1fr) minmax(0,420px)}.gv-ann-side{position:sticky;top:24px}}
@media (prefers-reduced-motion:reduce){.gv-ann-choice{transition:none}.gv-ann-choice:hover{transform:none}}
`;

function shortUrl(u: string): string {
  return u.replace(/^https?:\/\//i, '');
}

/** The "why you got this" words, exactly as the database renders them. */
function emailWho(scope: AnnouncementScope, city: string | null, country: string | null): string {
  if (scope === 'city') return `Gavelling delegates who took part in a conference in ${city ?? 'your city'}`;
  if (scope === 'country') return `Gavelling delegates in ${country ?? 'your country'}`;
  return 'Gavelling delegates around the world';
}

function plural(n: number, one: string, many: string) {
  return n === 1 ? one : many;
}

export default function AnnounceView({
  conferenceId, conferenceName, acronym, logoUrl, slug, city, country, onBack,
}: {
  conferenceId: string;
  conferenceName: string;
  acronym: string | null;
  logoUrl: string | null;
  slug: string;
  city: string | null;
  country: string | null;
  onBack: () => void;
}) {
  const [state, setState] = useState<'loading' | 'missing' | 'error' | 'ready'>('loading');
  const [targets, setTargets] = useState<AnnouncementTargets | null>(null);
  const [items, setItems] = useState<AnnouncementItem[]>([]);
  const [step, setStep] = useState<'choose' | 'write'>('choose');
  const [scope, setScope] = useState<AnnouncementScope | null>(null);
  const [heading, setHeading] = useState('');
  const [body, setBody] = useState('');
  const [button, setButton] = useState(DEFAULT_BUTTON);
  const [link, setLink] = useState(() => shortUrl(conferencePageUrl(slug)));
  const [fieldError, setFieldError] = useState<{ field: string; message: string } | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const buy = useStoreBuy(targets?.your_credits ?? 0);

  // The place shown is the database's answer once it exists, else the
  // conference row's own city and country (the same columns).
  const placeCity = targets?.city ?? (city?.trim() || null);
  const placeCountry = targets?.country ?? (country?.trim() || null);

  const reloadItems = useCallback(async () => {
    const a = await loadMyAnnouncements(conferenceId);
    if (a.kind === 'ok') setItems(a.data);
  }, [conferenceId]);

  const reloadTargets = useCallback(async () => {
    const t = await loadAnnouncementTargets(conferenceId);
    if (t.kind === 'ok') setTargets(t.data);
  }, [conferenceId]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const t = await loadAnnouncementTargets(conferenceId);
      if (!alive) return;
      if (t.kind === 'missing') { setState('missing'); return; }
      if (t.kind !== 'ok') { setState('error'); return; }
      setTargets(t.data);
      setState('ready');
      void reloadItems();
    })();
    return () => { alive = false; };
  }, [conferenceId, reloadItems]);

  const option: AnnouncementOption | null = (scope && targets?.options.find(o => o.scope === scope)) || null;
  const buttonUrl = normaliseButtonUrl(link, slug);

  const localProblem = useMemo(() => {
    if (LINK_RE.test(`${heading} ${body} ${button}`)) return { field: 'body', message: 'Links and email addresses are not allowed in the text. Put your link next to the button.' };
    return null;
  }, [heading, body, button]);

  const blocking = items.some(i => i.status === 'in_review' || i.status === 'sending' || i.status === 'paused');
  const cannotSend = buy.busy || !scope || !option || !option.available || option.hasPeople === false
    || !heading.trim() || !body.trim() || !button.trim() || !!localProblem || !buttonUrl;

  function choose(s: AnnouncementScope) {
    setScope(s);
    setFieldError(null);
    setStep('write');
  }

  function submit() {
    if (cannotSend || !buttonUrl || !scope) return;
    setFieldError(null);
    buy.run(
      rpcCall('request_paid_announcement', {
        p_conf: conferenceId, p_scope: scope,
        p_heading: heading.trim(), p_body: body.trim(),
        p_button_label: button.trim(), p_button_url: buttonUrl,
      }),
      {
        onDone: (a) => {
          notifyOk(typeof a.message === 'string' ? a.message : 'Sent for review');
          setHeading(''); setBody('');
          setStep('choose');
          void reloadItems();
          void reloadTargets();
        },
        onRefused: (message, a) => {
          if (a.need_credits) return; // the credits pop-up or the "use your own" offer handles it
          if (typeof a.field === 'string') setFieldError({ field: a.field, message });
          else notifyErr(message);
        },
      },
    );
  }

  async function cancel(id: string) {
    if (cancelling === id) return;
    setCancelling(id);
    const a = await cancelAnnouncement(id);
    setCancelling(null);
    if (a.kind === 'ok') { notifyOk(a.data); void reloadItems(); void reloadTargets(); }
    else notifyErr(a.kind === 'refused' ? a.message : 'Could not cancel it. Try again in a moment.');
  }

  const missing = state === 'missing';
  const err = (f: string) => (fieldError?.field === f ? fieldError.message : f === 'body' && localProblem ? localProblem.message : '');

  const header = (
    <div className="gv-ann-head">
      <div>
        <h1 style={{ fontWeight: 900, fontSize: 30, color: INK, letterSpacing: '-0.02em', margin: 0, lineHeight: 1.1 }}>
          Find New <GoldWord tone="light">Delegates</GoldWord>
        </h1>
        <p className="gv-st-sec-line" style={{ margin: '6px 0 0' }}>Email Gavelling delegates about your conference. Our team checks every one first</p>
      </div>
      {targets && (
        <div className="gv-fd-head-nums">
          <div className="gv-fd-head-cell">
            <span className="gv-fd-head-big">{targets.conference_credits.toLocaleString()}</span>
            <span className="gv-fd-head-cap">Conference credits</span>
          </div>
          <div className="gv-fd-head-cell">
            <span className="gv-fd-head-big gv-fd-owed">{targets.your_credits.toLocaleString()}</span>
            <span className="gv-fd-head-cap">Your credits</span>
          </div>
        </div>
      )}
    </div>
  );

  const shell = (children: React.ReactNode) => (
    <div className="gv-st">
      <style>{STORE_CSS}</style>
      <style>{DASH_CSS}</style>
      <style>{ANN_CSS}</style>
      {children}
    </div>
  );

  if (state === 'loading') {
    return shell(
      <>
        <BackLink onClick={onBack} />
        {header}
        <div className="gv-ann-choices" aria-hidden>
          {[0, 1, 2].map(i => <div key={i} className="gv-fd-ph" style={{ height: 250 }} />)}
        </div>
      </>,
    );
  }

  if (state === 'error') {
    return shell(
      <>
        <BackLink onClick={onBack} />
        {header}
        <AnnCard
          title="Not Available Right Now"
          hint="We could not read the announcement options. Nothing was charged."
          line="Refresh the page to try again"
          emoji="Megaphone"
          icon={Megaphone}
          style={{ maxWidth: 640 }}
        />
      </>,
    );
  }

  /* ─────────────────────────── Step 1: who gets it ─────────────────────────── */
  if (step === 'choose' || missing || !targets || !scope) {
    return shell(
      <>
        <BackLink onClick={onBack} />
        {header}

        {missing && (
          <AnnCard
            title="Coming Soon"
            hint="Paid announcements open after a final check by the Gavelling team. Prices appear here then."
            line="Soon you can pay to email one announcement to these delegates"
            emoji="Hourglass not done"
            icon={Hourglass}
            className="gv-fd-todo"
            style={{ marginBottom: 18, maxWidth: 720 }}
          />
        )}

        <HowItWorks capDays={targets?.cap_days ?? 14} />

        <h2 className="gv-st-sec">Who Should Get It?</h2>
        <p className="gv-st-sec-line">One flat price. We send it over a few hours, after our check</p>

        <div className="gv-ann-choices" role="list">
          {ANNOUNCEMENT_SCOPES.map(s => {
            const o = targets?.options.find(x => x.scope === s) ?? null;
            const usable = !missing && !!o && o.available && o.hasPeople !== false;
            const wash = ' gv-fd-wash-gold';
            const content = (
              <>
                <EmojiIcon emoji={SCOPE_EMOJI[s]} icon={SCOPE_ICON[s]} size={60} />
                <span className="gv-ann-name">{scopeTitle(s, placeCity, placeCountry)}</span>
                {o ? (
                  <span className="gv-ann-nums">
                    <span className="gv-ann-num">
                      <span className="gv-st-big">{o.credits.toLocaleString()}</span>
                      <span className="gv-ann-num-word">{plural(o.credits, 'credit', 'credits')}</span>
                    </span>
                  </span>
                ) : (
                  <span className="gv-st-soon-tag" style={{ margin: '12px 0 0' }}>Coming soon</span>
                )}
                <span className="gv-ann-who">{whoCounts(s, placeCity, placeCountry)}</span>
                {o && !o.available && o.reason && <span className="gv-ann-why">{o.reason}</span>}
                {o && o.available && o.hasPeople === false && <span className="gv-ann-why">Nobody can get one here yet. Choose a bigger area</span>}
                {usable && (
                  <span className="gv-ann-go"><span className="gv-st-btn gv-st-forest">Choose</span></span>
                )}
              </>
            );
            return (
              <div key={s} role="listitem" className="min-w-0">
                {usable ? (
                  <button
                    type="button"
                    onClick={() => choose(s)}
                    data-chosen={scope === s ? '' : undefined}
                    className={`gv-st-card gv-ann-choice${wash}`}
                  >
                    {content}
                  </button>
                ) : (
                  <div className={`gv-st-card gv-ann-choice${wash}`} aria-disabled="true">
                    {content}
                    {o && !o.available && (
                      <span className="gv-ann-go">
                        <Link href={`/manage/${slug}/settings?tab=conference`} className="gv-st-btn gv-st-outline" style={{ width: '100%' }}>Open Settings</Link>
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {items.length > 0 && <YourAnnouncements items={items} cancelling={cancelling} onCancel={id => void cancel(id)} />}
      </>,
    );
  }

  /* ─────────────────────────── Step 2: the email ─────────────────────────── */
  const linkError = !buttonUrl ? `The link must go to your conference on Gavelling, like ${shortUrl(conferencePageUrl(slug))}` : '';
  const ctaError = err('button') || err('button_url') || linkError;
  const ScopeIcon = SCOPE_ICON[scope];

  return shell(
    <>
      <BackLink onClick={() => setStep('choose')} label="Who gets it" />
      {header}

      {option && (
        <div className="gv-st-card gv-ann-sum gv-fd-wash-gold" style={{ boxShadow: `0 0 0 2px ${FOREST}, 0 18px 40px -30px rgba(27,56,40,0.5)` }}>
          <EmojiIcon emoji={SCOPE_EMOJI[scope]} icon={ScopeIcon} size={44} />
          <span className="gv-ann-sum-name">{scopeTitle(scope, placeCity, placeCountry)}</span>
          <span className="gv-ann-sum-nums">
            <span><b>{option.credits.toLocaleString()}</b>{plural(option.credits, 'credit', 'credits')}</span>
          </span>
          <button type="button" className="gv-st-link" onClick={() => setStep('choose')} style={{ marginInlineStart: 'auto' }}>Change</button>
          <p className="gv-ann-sum-who">{whoCounts(scope, placeCity, placeCountry)}</p>
        </div>
      )}

      <div className="gv-ann-grid">
        <AnnCard
          title="What It Says"
          hint="Plain words only. Links and email addresses go next to the button, not in the text."
          emoji="Memo"
          icon={PenLine}
        >
          <div className="flex flex-col gap-4">
            <div>
              <label htmlFor="ann-heading" className="gv-fd-label">Heading</label>
              <input id="ann-heading" className="gv-ann-input" value={heading} maxLength={HEADING_MAX} onChange={e => { setHeading(e.target.value); setFieldError(null); }} placeholder="Applications are open" />
              {err('heading') && <p role="alert" className="gv-st-err">{err('heading')}</p>}
            </div>
            <div>
              <label htmlFor="ann-body" className="gv-fd-label">Message</label>
              <textarea id="ann-body" className="gv-fd-text" value={body} maxLength={BODY_MAX} rows={6} onChange={e => { setBody(e.target.value); setFieldError(null); }} placeholder="Say when and where it is, who it is for, and why they should come" style={{ fontSize: 16 }} />
              <div className="flex justify-between gap-3">
                <span role={err('body') ? 'alert' : undefined} className="gv-st-err" style={{ marginTop: 4 }}>{err('body')}</span>
                <span className="gv-fd-count">{body.length} / {BODY_MAX}</span>
              </div>
            </div>

            {/* The call to action as ONE compact row: type on the button, the link beside it. */}
            <div>
              <span className="gv-fd-label" id="ann-cta-label">Button</span>
              <div className="gv-ann-cta" role="group" aria-labelledby="ann-cta-label">
                <label className="gv-ann-btn">
                  <input
                    aria-label="Button text"
                    value={button}
                    maxLength={BUTTON_MAX}
                    size={Math.max(6, button.length + 1)}
                    onChange={e => { setButton(e.target.value); setFieldError(null); }}
                    placeholder={DEFAULT_BUTTON}
                  />
                  <Pencil size={15} strokeWidth={2.4} aria-hidden />
                </label>
                <label className="gv-ann-link" data-bad={linkError ? '' : undefined}>
                  <Link2 size={20} strokeWidth={2.2} aria-hidden style={{ color: FOREST, flexShrink: 0 }} />
                  <input
                    aria-label="Button link"
                    value={link}
                    onChange={e => { setLink(e.target.value); setFieldError(null); }}
                    inputMode="url"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                </label>
              </div>
              {ctaError
                ? <p role="alert" className="gv-st-err">{ctaError}</p>
                : <p className="gv-st-quiet" style={{ marginTop: 8 }}>Type on the button to change its words. The link opens your conference on Gavelling</p>}
            </div>
          </div>
        </AnnCard>

        <div className="gv-ann-side flex flex-col gap-4 min-w-0">
          <AnnCard
            title="Check and Send"
            hint="Every email says who paid to send it and why the reader got it, and carries an unsubscribe link."
            emoji="Envelope"
            icon={Mail}
          >
            <div className="gv-ann-mail">
              <div className="gv-ann-mail-card">
                {logoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoUrl} alt="" width={44} height={44} style={{ width: 44, height: 44, borderRadius: 999, objectFit: 'cover', marginBottom: 10 }} />
                )}
                <p style={{ fontFamily: 'Arial, sans-serif', fontSize: 12, color: INK_SOFT, overflowWrap: 'anywhere', margin: 0 }}>{conferenceName}</p>
                <p style={{ fontFamily: 'Arial, sans-serif', fontSize: 20, fontWeight: 700, color: FOREST, lineHeight: 1.2, margin: '2px 0 10px', overflowWrap: 'anywhere' }}>{heading.trim() || 'Your heading'}</p>
                <p style={{ fontFamily: 'Arial, sans-serif', fontSize: 14, color: INK, whiteSpace: 'pre-wrap', lineHeight: 1.55, overflowWrap: 'anywhere', margin: '0 0 14px' }}>{body.trim() || 'Your message appears here.'}</p>
                <span style={{ display: 'inline-block', backgroundColor: FOREST, color: '#FFFFFF', fontFamily: 'Arial, sans-serif', fontWeight: 700, fontSize: 14, padding: '10px 18px', borderRadius: 10, overflowWrap: 'anywhere' }}>{button.trim() || DEFAULT_BUTTON}</span>
                {buttonUrl && (
                  <p style={{ fontFamily: 'Arial, sans-serif', fontSize: 11.5, color: INK_SOFT, margin: '6px 0 0', overflowWrap: 'anywhere' }}>Opens {shortUrl(buttonUrl)}</p>
                )}
              </div>
              <p style={{ fontFamily: 'Arial, sans-serif', fontSize: 11, color: INK_SOFT, margin: '10px 0 0', lineHeight: 1.5 }}>
                {acronym || conferenceName} paid to send this to {emailWho(scope, placeCity, placeCountry)}, and the Gavelling team checked it first.{' '}
                <span style={{ color: FOREST, fontWeight: 700, textDecoration: 'underline' }}>Unsubscribe</span>
              </p>
            </div>

            {blocking ? (
              <p className="gv-fd-review">You already have an announcement waiting or sending. Send the next one when it is done</p>
            ) : (
              <>
                <button
                  type="button"
                  onClick={submit}
                  disabled={cannotSend}
                  className="gv-st-btn gv-st-forest"
                  style={{ width: '100%', minHeight: 52, fontSize: 15.5, marginTop: 16 }}
                >
                  {buy.busy ? 'Sending for review…' : option ? `Send for review · ${option.credits.toLocaleString()} ${plural(option.credits, 'credit', 'credits')}` : 'Send for review'}
                </button>
                {buy.ownOffer !== null && (
                  <div className="gv-fd-warn" style={{ marginTop: 12 }}>
                    <p style={{ margin: 0 }}>Your conference is short. Use {buy.ownOffer} of your own credits?</p>
                    <button type="button" onClick={buy.acceptOwn} className="gv-st-btn gv-st-outline" style={{ marginTop: 8, minHeight: 40 }}>Use {buy.ownOffer} of mine</button>
                  </div>
                )}
                {err('scope') && <p role="alert" className="gv-st-err">{err('scope')}</p>}
                <p className="gv-st-quiet" style={{ marginTop: 10 }}>
                  Our team checks it first, usually within a day. Nothing is sent before that. If we say no, every credit comes back
                </p>
              </>
            )}
          </AnnCard>
        </div>
      </div>
    </>,
  );
}

function YourAnnouncements({ items, cancelling, onCancel }: { items: AnnouncementItem[]; cancelling: string | null; onCancel: (id: string) => void }) {
  return (
    <AnnCard
      title="Your Announcements"
      hint="Waiting ones can be cancelled for every credit back. Sent ones show how many people opened your page from the email."
      emoji="Loudspeaker"
      icon={Megaphone}
      style={{ marginTop: 22, maxWidth: 760 }}
    >
      <div className="gv-st-rows">
        {items.map(i => (
          <div key={i.id} className="gv-st-row">
            <div className="min-w-0" style={{ flex: '1 1 260px' }}>
              <p className="gv-st-row-title" style={{ overflowWrap: 'anywhere' }}>{i.heading}</p>
              <p className="gv-st-row-sub">
                To {placeName(i.scope, i.target, i.target_country)} · {i.credits.toLocaleString()} {plural(i.credits, 'credit', 'credits')}
              </p>
              {i.status === 'rejected' && i.reject_reason && (
                <p className="gv-st-row-sub" style={{ color: INK }}>Why: {i.reject_reason} Your {i.credits} credits are back</p>
              )}
              {i.status === 'in_review' && (
                <button type="button" className="gv-st-link" style={{ marginTop: 6 }} onClick={() => onCancel(i.id)}>
                  {cancelling === i.id ? 'Cancelling…' : 'Cancel and get my credits back'}
                </button>
              )}
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="gv-st-status" style={{ color: i.status === 'rejected' ? DANGER : i.status === 'sent' ? '#2F6644' : INK }}>{statusWords(i.status)}</span>
              {(i.status === 'sending' || i.status === 'sent') && (
                <span className="gv-st-stat"><b>{i.clicked.toLocaleString()}</b> {plural(i.clicked, 'person', 'people')} opened your page</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </AnnCard>
  );
}
