'use client';

/**
 * Announce to Gavelling users (paid, 9 Oct 2026).
 *
 * Who → What it says → Preview → Send for review, on one screen. The price
 * and the reach come from the database (`paid_announcement_quote`); the buy
 * runs through the Store's own `useStoreBuy`, so a conference short of
 * credits gets the credits pop-up for exactly the difference and the request
 * runs once more when the payment lands. Until the SQL is applied every read
 * answers `missing` and this view says "Coming soon".
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Megaphone, Flag, Globe2, Earth, Clock } from 'lucide-react';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { useStoreBuy, rpcCall } from '../store/storeApi';
import {
  loadAnnouncementTargets, quoteAnnouncement, loadMyAnnouncements, cancelAnnouncement,
  placeName, statusWords, CONTINENT_NAMES,
  type AnnouncementScope, type AnnouncementTargets, type AnnouncementQuote, type AnnouncementItem,
} from '@/lib/paidAnnouncements';
import {
  CARD, PRIMARY, SECONDARY, FONT, INK, SOFT_INK, FOREST, DANGER,
  BackLink, CommsTitle, DuoIcon, TextLink,
} from './commsKit';

const HEADING_MAX = 80;
const BODY_MAX = 1200;
const BUTTON_MAX = 30;
const LINK_RE = /(https?:\/\/|www\.|[a-z0-9-]+\.(com|org|net|io|co|me|ly|app)\b|@)/i;

const FIELD: React.CSSProperties = {
  width: '100%', borderRadius: 12, border: '1.5px solid rgba(27,56,40,0.18)', backgroundColor: '#FFFFFF',
  padding: '12px 14px', fontFamily: FONT, fontSize: 16, color: INK, outline: 'none',
};
const LABEL: React.CSSProperties = { display: 'block', fontFamily: FONT, fontSize: 14, fontWeight: 700, color: INK, marginBottom: 6 };

function StepTitle({ n, children }: { n: number; children: string }) {
  return (
    <h2 className="flex items-center gap-2.5 mb-3" style={{ fontFamily: FONT, fontWeight: 800, fontSize: 19, color: INK }}>
      <span aria-hidden className="inline-flex items-center justify-center" style={{ width: 28, height: 28, borderRadius: 999, backgroundColor: 'rgba(238,217,138,0.6)', color: FOREST, fontSize: 14, fontWeight: 800 }}>{n}</span>
      {children}
    </h2>
  );
}

export default function AnnounceView({
  conferenceId, conferenceName, acronym, logoUrl, onBack,
}: {
  conferenceId: string;
  conferenceName: string;
  acronym: string | null;
  logoUrl: string | null;
  onBack: () => void;
}) {
  const [state, setState] = useState<'loading' | 'missing' | 'error' | 'ready'>('loading');
  const [targets, setTargets] = useState<AnnouncementTargets | null>(null);
  const [items, setItems] = useState<AnnouncementItem[]>([]);
  const [scope, setScope] = useState<AnnouncementScope>('country');
  const [country, setCountry] = useState('');
  const [continent, setContinent] = useState('');
  const [quote, setQuote] = useState<AnnouncementQuote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState('');
  const [heading, setHeading] = useState('');
  const [body, setBody] = useState('');
  const [button, setButton] = useState('See the conference');
  const [fieldError, setFieldError] = useState<{ field: string; message: string } | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const buy = useStoreBuy(quote?.your_credits ?? 0);
  const quoteSeq = useRef(0);

  const reloadItems = useCallback(async () => {
    const a = await loadMyAnnouncements(conferenceId);
    if (a.kind === 'ok') setItems(a.data);
  }, [conferenceId]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const t = await loadAnnouncementTargets(conferenceId);
      if (!alive) return;
      if (t.kind === 'missing') { setState('missing'); return; }
      if (t.kind !== 'ok') { setState('error'); return; }
      setTargets(t.data);
      setCountry(t.data.home_country ?? t.data.countries[0] ?? '');
      setContinent(t.data.home_continent ?? t.data.continents[0] ?? '');
      setState('ready');
      void reloadItems();
    })();
    return () => { alive = false; };
  }, [conferenceId, reloadItems]);

  const target = scope === 'world' ? null : scope === 'country' ? country : continent;

  useEffect(() => {
    if (state !== 'ready' || (scope !== 'world' && !target)) return;
    const seq = ++quoteSeq.current;
    setQuoting(true);
    setQuoteError('');
    const t = setTimeout(async () => {
      const q = await quoteAnnouncement(conferenceId, scope, target);
      if (seq !== quoteSeq.current) return;
      setQuoting(false);
      if (q.kind === 'ok') setQuote(q.data);
      else { setQuote(null); setQuoteError(q.kind === 'refused' ? q.message : 'We could not count the audience. Try again in a moment.'); }
    }, 250);
    return () => clearTimeout(t);
  }, [state, conferenceId, scope, target]);

  const localProblem = useMemo(() => {
    if (LINK_RE.test(`${heading} ${body} ${button}`)) return { field: 'body', message: 'Links and email addresses are not allowed. The button already takes people to your conference page.' };
    return null;
  }, [heading, body, button]);

  const busyOrBlocked = buy.busy || !quote || quote.reach === 0 || !heading.trim() || !body.trim() || !button.trim() || !!localProblem;
  const blocking = items.some(i => i.status === 'in_review' || i.status === 'sending' || i.status === 'paused');

  function submit() {
    if (busyOrBlocked || !quote) return;
    setFieldError(null);
    buy.run(
      rpcCall('request_paid_announcement', {
        p_conf: conferenceId, p_scope: scope, p_target: target,
        p_heading: heading.trim(), p_body: body.trim(), p_button_label: button.trim(),
      }),
      {
        onDone: (a) => {
          notifyOk(typeof a.message === 'string' ? a.message : 'Sent for review.');
          setHeading(''); setBody('');
          void reloadItems();
        },
        onRefused: (message, a) => {
          if (a.need_credits) return; // the credits pop-up or the "use your own" offer handles it
          if (a.field) setFieldError({ field: a.field, message });
          else notifyErr(message);
        },
      },
    );
  }

  async function cancel(id: string) {
    setCancelling(id);
    const a = await cancelAnnouncement(id);
    setCancelling(null);
    if (a.kind === 'ok') { notifyOk(a.data); void reloadItems(); }
    else notifyErr(a.kind === 'refused' ? a.message : 'Could not cancel it. Try again in a moment.');
  }

  const title = <CommsTitle lead="Announce to Gavelling" gold="Users" sub="Tell students in your country, your continent or the whole world about your conference." />;

  if (state === 'loading') {
    return (<div><BackLink onClick={onBack} />{title}<div className="flex justify-center py-12"><div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: FOREST, borderTopColor: 'transparent' }} /></div></div>);
  }

  if (state === 'missing' || state === 'error') {
    return (
      <div>
        <BackLink onClick={onBack} />
        {title}
        <div className="p-6 flex items-start gap-4" style={{ ...CARD, maxWidth: 640 }}>
          <DuoIcon icon={state === 'missing' ? Clock : Megaphone} />
          <div>
            <p style={{ fontFamily: FONT, fontWeight: 800, fontSize: 18, color: INK }}>{state === 'missing' ? 'Coming soon' : 'This is not available right now'}</p>
            <p style={{ fontFamily: FONT, fontSize: 15, color: SOFT_INK, marginTop: 4, textWrap: 'pretty' }}>
              {state === 'missing'
                ? 'Soon you can pay to send one announcement to every Gavelling user in a country, a continent or the world. We check each one before it goes out.'
                : 'Refresh the page to try again.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const choices: { key: AnnouncementScope; icon: typeof Flag; title: string }[] = [
    { key: 'country', icon: Flag, title: 'One country' },
    { key: 'continent', icon: Globe2, title: 'One continent' },
    { key: 'world', icon: Earth, title: 'The whole world' },
  ];
  const err = (f: string) => (fieldError?.field === f ? fieldError.message : f === 'body' && localProblem ? localProblem.message : '');

  return (
    <div>
      <BackLink onClick={onBack} />
      {title}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] gap-6 items-start">
        <div className="flex flex-col gap-6 min-w-0">
          {/* 1 · Who */}
          <section className="p-5" style={CARD}>
            <StepTitle n={1}>Who should get it?</StepTitle>
            <div role="radiogroup" aria-label="Who should get it" className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {choices.map(c => {
                const on = scope === c.key;
                return (
                  <button
                    key={c.key}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setScope(c.key)}
                    className="flex sm:flex-col items-center sm:items-start gap-3 p-3.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
                    style={{
                      borderRadius: 14, cursor: 'pointer', fontFamily: FONT,
                      border: on ? `2px solid ${FOREST}` : '2px solid rgba(27,56,40,0.12)',
                      backgroundColor: on ? 'rgba(238,217,138,0.22)' : '#FFFFFF',
                    }}
                  >
                    <c.icon size={22} strokeWidth={2} style={{ color: FOREST }} aria-hidden />
                    <span style={{ fontWeight: 700, fontSize: 15, color: INK }}>{c.title}</span>
                  </button>
                );
              })}
            </div>
            {scope === 'country' && targets && (
              <div className="mt-4">
                <label htmlFor="ann-country" style={LABEL}>Country</label>
                <select id="ann-country" value={country} onChange={e => setCountry(e.target.value)} style={FIELD}>
                  {targets.countries.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            )}
            {scope === 'continent' && targets && (
              <div className="mt-4">
                <label htmlFor="ann-continent" style={LABEL}>Continent</label>
                <select id="ann-continent" value={continent} onChange={e => setContinent(e.target.value)} style={FIELD}>
                  {targets.continents.map(c => <option key={c} value={c}>{CONTINENT_NAMES[c] ?? c}</option>)}
                </select>
              </div>
            )}
            <div className="mt-4 flex flex-wrap items-baseline gap-x-6 gap-y-2" aria-live="polite">
              {quoting ? (
                <span style={{ fontFamily: FONT, fontSize: 15, color: SOFT_INK }}>Counting people…</span>
              ) : quoteError ? (
                <span style={{ fontFamily: FONT, fontSize: 15, color: DANGER, fontWeight: 600 }}>{quoteError}</span>
              ) : quote ? (
                <>
                  <span className="flex items-baseline gap-1.5">
                    <span style={{ fontFamily: FONT, fontWeight: 800, fontSize: 30, color: FOREST, fontVariantNumeric: 'tabular-nums' }}>{quote.reach.toLocaleString()}</span>
                    <span style={{ fontFamily: FONT, fontSize: 15, color: SOFT_INK, fontWeight: 600 }}>{quote.reach === 1 ? 'person' : 'people'}</span>
                  </span>
                  <span className="flex items-baseline gap-1.5">
                    <span style={{ fontFamily: FONT, fontWeight: 800, fontSize: 30, color: INK, fontVariantNumeric: 'tabular-nums' }}>{quote.credits.toLocaleString()}</span>
                    <span style={{ fontFamily: FONT, fontSize: 15, color: SOFT_INK, fontWeight: 600 }}>{quote.credits === 1 ? 'credit' : 'credits'}</span>
                  </span>
                </>
              ) : null}
            </div>
            {quote && !quoting && (
              <p style={{ fontFamily: FONT, fontSize: 13, color: SOFT_INK, marginTop: 6, textWrap: 'pretty' }}>
                Only people who chose to hear about conferences. Nobody gets more than one of these every {quote.cap_days} days.
              </p>
            )}
          </section>

          {/* 2 · What */}
          <section className="p-5" style={CARD}>
            <StepTitle n={2}>What does it say?</StepTitle>
            <div className="flex flex-col gap-4">
              <div>
                <label htmlFor="ann-heading" style={LABEL}>Heading</label>
                <input id="ann-heading" value={heading} maxLength={HEADING_MAX} onChange={e => { setHeading(e.target.value); setFieldError(null); }} placeholder="Applications are open" style={FIELD} />
                {err('heading') && <p role="alert" style={{ fontFamily: FONT, fontSize: 13, color: DANGER, marginTop: 4 }}>{err('heading')}</p>}
              </div>
              <div>
                <label htmlFor="ann-body" style={LABEL}>Message</label>
                <textarea id="ann-body" value={body} maxLength={BODY_MAX} rows={6} onChange={e => { setBody(e.target.value); setFieldError(null); }} placeholder="Say when and where it is, who it is for, and why they should come." style={{ ...FIELD, resize: 'vertical', lineHeight: 1.5 }} />
                <div className="flex justify-between gap-3 mt-1">
                  <span role={err('body') ? 'alert' : undefined} style={{ fontFamily: FONT, fontSize: 13, color: DANGER }}>{err('body')}</span>
                  <span style={{ fontFamily: FONT, fontSize: 12, color: SOFT_INK, fontVariantNumeric: 'tabular-nums' }}>{body.length} / {BODY_MAX}</span>
                </div>
              </div>
              <div>
                <label htmlFor="ann-button" style={LABEL}>Button</label>
                <input id="ann-button" value={button} maxLength={BUTTON_MAX} onChange={e => { setButton(e.target.value); setFieldError(null); }} style={{ ...FIELD, maxWidth: 320 }} />
                <p style={{ fontFamily: FONT, fontSize: 13, color: SOFT_INK, marginTop: 4 }}>It opens your conference page on Gavelling.</p>
                {err('button') && <p role="alert" style={{ fontFamily: FONT, fontSize: 13, color: DANGER, marginTop: 4 }}>{err('button')}</p>}
              </div>
            </div>
          </section>
        </div>

        {/* 3 · Preview and send */}
        <div className="flex flex-col gap-4 lg:sticky lg:top-6 min-w-0">
          <section className="p-5" style={CARD}>
            <StepTitle n={3}>Check and send</StepTitle>
            <div className="rounded-2xl p-4" style={{ backgroundColor: '#EDE7D8' }}>
              <div className="rounded-xl p-5" style={{ backgroundColor: '#FFFFFF' }}>
                {logoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoUrl} alt="" width={44} height={44} style={{ width: 44, height: 44, borderRadius: 999, objectFit: 'cover', marginBottom: 10 }} />
                )}
                <p style={{ fontFamily: 'Arial, sans-serif', fontSize: 12, color: SOFT_INK, overflowWrap: 'anywhere' }}>{conferenceName}</p>
                <p style={{ fontFamily: 'Arial, sans-serif', fontSize: 20, fontWeight: 700, color: FOREST, lineHeight: 1.2, margin: '2px 0 10px', overflowWrap: 'anywhere' }}>{heading.trim() || 'Your heading'}</p>
                <p style={{ fontFamily: 'Arial, sans-serif', fontSize: 14, color: INK, whiteSpace: 'pre-wrap', lineHeight: 1.55, overflowWrap: 'anywhere', margin: '0 0 14px' }}>{body.trim() || 'Your message appears here.'}</p>
                <span style={{ display: 'inline-block', backgroundColor: FOREST, color: '#FFFFFF', fontFamily: 'Arial, sans-serif', fontWeight: 700, fontSize: 14, padding: '10px 18px', borderRadius: 10 }}>{button.trim() || 'See the conference'}</span>
              </div>
              <p style={{ fontFamily: 'Arial, sans-serif', fontSize: 11, color: SOFT_INK, marginTop: 10, lineHeight: 1.5 }}>
                Every email says why they got it ({acronym || conferenceName} paid to send it to Gavelling users in {placeName(scope, target)}) and has an unsubscribe link.
              </p>
            </div>

            {blocking ? (
              <p style={{ fontFamily: FONT, fontSize: 14, color: SOFT_INK, marginTop: 16, textWrap: 'pretty' }}>
                You already have an announcement waiting or sending. You can send the next one when it is done.
              </p>
            ) : (
              <>
                <button
                  type="button"
                  onClick={submit}
                  disabled={busyOrBlocked}
                  className="w-full mt-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#1B3828]"
                  style={{ ...PRIMARY, opacity: busyOrBlocked ? 0.55 : 1, cursor: busyOrBlocked ? 'default' : 'pointer', minHeight: 50, fontSize: 16 }}
                >
                  {buy.busy ? 'Sending for review…' : quote ? `Send for review · ${quote.credits} ${quote.credits === 1 ? 'credit' : 'credits'}` : 'Send for review'}
                </button>
                {buy.ownOffer !== null && (
                  <div className="mt-3 rounded-xl p-3" style={{ backgroundColor: 'rgba(238,217,138,0.22)' }}>
                    <p style={{ fontFamily: FONT, fontSize: 14, color: INK }}>Your conference is short. Use {buy.ownOffer} of your own credits?</p>
                    <button type="button" onClick={buy.acceptOwn} className="mt-2 focus:outline-none" style={{ ...SECONDARY, minHeight: 40 }}>Use {buy.ownOffer} of mine</button>
                  </div>
                )}
                <p style={{ fontFamily: FONT, fontSize: 13, color: SOFT_INK, marginTop: 10, textWrap: 'pretty' }}>
                  The Gavelling team checks it first, usually within a day. If we say no, you get every credit back.
                </p>
              </>
            )}
          </section>

          {items.length > 0 && (
            <section className="p-5" style={CARD}>
              <h2 style={{ fontFamily: FONT, fontWeight: 800, fontSize: 17, color: INK, marginBottom: 10 }}>Your announcements</h2>
              <div className="flex flex-col gap-3">
                {items.map(i => (
                  <div key={i.id} className="rounded-xl p-3.5" style={{ backgroundColor: '#FAF8F3' }}>
                    <p style={{ fontFamily: FONT, fontWeight: 700, fontSize: 15, color: INK, overflowWrap: 'anywhere' }}>{i.heading}</p>
                    <p style={{ fontFamily: FONT, fontSize: 13, color: SOFT_INK, marginTop: 2 }}>
                      To {placeName(i.scope, i.target)} · <span style={{ color: i.status === 'rejected' ? DANGER : i.status === 'sent' ? '#2F6644' : INK, fontWeight: 700 }}>{statusWords(i.status)}</span>
                    </p>
                    {(i.status === 'sending' || i.status === 'sent') && (
                      <p style={{ fontFamily: FONT, fontSize: 13, color: INK, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
                        <strong>{i.reached.toLocaleString()}</strong> reached · <strong>{i.clicked.toLocaleString()}</strong> opened your page
                      </p>
                    )}
                    {i.status === 'rejected' && i.reject_reason && (
                      <p style={{ fontFamily: FONT, fontSize: 13, color: INK, marginTop: 4, textWrap: 'pretty' }}>Why: {i.reject_reason} Your {i.credits} credits are back.</p>
                    )}
                    {i.status === 'in_review' && (
                      <div className="mt-1">
                        <TextLink onClick={() => { if (cancelling !== i.id) void cancel(i.id); }}>{cancelling === i.id ? 'Cancelling…' : 'Cancel and get my credits back'}</TextLink>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
