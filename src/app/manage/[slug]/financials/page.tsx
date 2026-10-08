'use client';

/**
 * Financials dashboard (1 Oct 2026, prompt 92). One screen of cards in the
 * Conference Store's manner:
 *   header   Received and Outstanding, the display-currency picker
 *   row 1    Money (breakdown pop-up) and Things to do (the anchor)
 *   row 2    Invoices, Generate invoices (off until GENERATE_INVOICES_READY)
 *   row 3    four settings cards (payment method, registration fee, add-ons, vouchers)
 * Every number is from financials_dashboard, read on mount and again after any
 * action. The things-to-do line is from money_things_to_do. The Referrals
 * section stays at the foot (it renders nothing without referral codes).
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import { useManage } from '@/app/manage/[slug]/layout';
import { OUTFIT, NEU } from '@/components/neu';
import { GoldWord } from '@/components/BrandHeading';
import { CurrencyPicker } from '@/components/CurrencyPicker';
import { PURCHASE_CSS } from '@/components/purchase/purchaseKit';
import { friendlyError } from '@/lib/friendlyError';
import { STORE_CSS, Big } from '../store/storeKit';
import ReferralsSection from './ReferralsSection';
import { useFinancialsCurrency } from './shared';
import {
  cents, readDashboard, readThingsToDo, type FinancialsDashboard, type ThingsToDo, type TodoKind,
} from './financialsApi';
import {
  DASH_CSS, DashCard, DashboardPlaceholder, GENERATE_INVOICES_READY, READ_ONLY_LINE,
  PaymentMethodCard, RegistrationFeeCard, AddonsCard, VouchersCard,
} from './dashboardKit';
import MoneyPopup from './MoneyPopup';
import ThingsToDoPopup from './ThingsToDoPopup';

const TODO_WORDS: Record<'proof' | TodoKind, [string, string]> = {
  proof: ['proof to review', 'proofs to review'],
  refund_request: ['refund request', 'refund requests'],
  refund_not_received: ['refund not received', 'refunds not received'],
  stripe_refund_to_match: ['Stripe refund to match', 'Stripe refunds to match'],
  dispute: ['dispute', 'disputes'],
  refund_due: ['refund due', 'refunds due'],
};

function todoLine(t: ThingsToDo | null): string {
  if (!t) return '';
  const counts = new Map<'proof' | TodoKind, number>();
  if (t.proofs.length) counts.set('proof', t.proofs.length);
  for (const x of t.todos) counts.set(x.kind, (counts.get(x.kind) ?? 0) + 1);
  return [...counts.entries()]
    .map(([k, n]) => `${n} ${(TODO_WORDS[k] ?? ['thing to do', 'things to do'])[n === 1 ? 0 : 1]}`)
    .join(', ');
}

export default function FinancialsDashboardPage() {
  const { conference, financialsReadOnly } = useManage();
  const router = useRouter();
  const { currency, displayCurrency, setDisplayCurrency, currencyOptions, converted, disp } = useFinancialsCurrency();
  const [data, setData] = useState<FinancialsDashboard | null>(null);
  const [things, setThings] = useState<ThingsToDo | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [popup, setPopup] = useState<'money' | 'todo' | null>(null);
  const conferenceId = conference?.id ?? null;

  useEffect(() => {
    if (!conferenceId) return;
    let alive = true;
    readDashboard(conferenceId).then(d => {
      if (!alive) return;
      setData(d);
      setError('');
    }).catch(e => {
      if (alive) setError(friendlyError(e, 'Your Financials could not be read. Try again in a moment.'));
    });
    // The things-to-do line is a nicety: a failed read leaves only the count.
    readThingsToDo(conferenceId).then(t => { if (alive) setThings(t); }).catch(() => { if (alive) setThings(null); });
    return () => { alive = false; };
  }, [conferenceId, attempt]);

  const reload = useCallback(() => setAttempt(a => a + 1), []);

  if (!conference) return null;

  const slug = conference.slug;
  const m = (c: number) => disp((c || 0) / 100);
  const openSettings = () => router.push(`/manage/${slug}/financials/settings`);

  const r = data?.received;
  const o = data?.outstanding;
  const payments = r ? r.card_count + r.manual_count : 0;
  const todoCount = data?.todo_count ?? 0;
  const line = todoLine(things);

  return (
    <div className="gv-st">
      <style>{STORE_CSS}</style>
      <style>{DASH_CSS}</style>
      {popup ? <style>{PURCHASE_CSS}</style> : null}

      {/* Header: the title left, the key numbers and the picker right, like the Store */}
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <h1 style={{ fontFamily: OUTFIT, fontWeight: 900, fontSize: 30, color: NEU.ink, letterSpacing: '-0.02em', margin: 0 }}>
          <GoldWord tone="light">Financials</GoldWord>
        </h1>
        <div>
          <div className="gv-fd-head-nums">
            {r && o && (
              <>
                <div className="gv-fd-head-cell">
                  <span className="gv-fd-head-big">{m(r.total_cents)}</span>
                  <span className="gv-fd-head-cap">Received</span>
                </div>
                <div className="gv-fd-head-cell">
                  <span className="gv-fd-head-big gv-fd-owed">{m(o.total_cents)}</span>
                  <span className="gv-fd-head-cap">Outstanding</span>
                </div>
              </>
            )}
            <div className="gv-fd-head-cell" style={{ alignSelf: 'center' }}>
              <CurrencyPicker
                value={displayCurrency}
                onChange={setDisplayCurrency}
                options={currencyOptions}
                variant="pill"
                showName
                disabled={currencyOptions.length <= 1}
                ariaLabel="Display currency"
              />
            </div>
          </div>
          {converted && <p className="gv-fd-other">Approximate conversion: payments settle in {currency}</p>}
          {data && data.other_currencies.length > 0 && (
            <p className="gv-fd-other">Some payments are in {data.other_currencies.join(', ')}. They are not included here</p>
          )}
        </div>
      </div>

      {financialsReadOnly && <p className="gv-st-quiet" style={{ marginBottom: 14 }}>{READ_ONLY_LINE}</p>}

      {!data && error ? (
        <p className="gv-st-err" role="alert">
          {error} <button type="button" className="gv-st-link" onClick={() => { setError(''); reload(); }}>Try again</button>
        </p>
      ) : !data || !r || !o ? (
        <DashboardPlaceholder />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="gv-fd-grid">
            {/* Money */}
            <DashCard
              title="Money"
              hint="Everything paid to your conference and everything still owed. Received is after refunds. Outstanding counts only people you have accepted."
            >
              <div className="gv-fd-pair">
                <Big n={m(r.total_cents)} cap={`Received · ${payments} payment${payments === 1 ? '' : 's'}`} />
                <Big n={m(o.total_cents)} cap={`Outstanding · ${o.items} item${o.items === 1 ? '' : 's'} from ${o.people} ${o.people === 1 ? 'person' : 'people'}`} />
              </div>
              {data.in_review.count > 0 && (
                <p className="gv-fd-review">{m(data.in_review.total_cents)} waiting for your review</p>
              )}
              <div className="gv-fd-foot">
                <button type="button" className="gv-st-btn gv-st-outline" onClick={() => setPopup('money')}>See the breakdown</button>
              </div>
            </DashCard>

            {/* Things to do: the anchor */}
            <DashCard
              title="Things to Do"
              className={todoCount > 0 ? 'gv-fd-todo' : undefined}
              hint="Payments and refunds waiting on you: proofs to accept or deny, refund requests, and card refunds or disputes from Stripe. People are waiting until you answer."
            >
              {todoCount > 0 ? (
                <>
                  <div>
                    <span className="gv-fd-todo-num">{todoCount}</span>
                    <span className="gv-fd-todo-word">{todoCount === 1 ? 'thing to do' : 'things to do'}</span>
                  </div>
                  {line && <p className="gv-fd-todo-line">{line}</p>}
                  <div className="gv-fd-foot">
                    <button type="button" className="gv-st-btn gv-st-forest" onClick={() => setPopup('todo')}>Review now</button>
                  </div>
                </>
              ) : (
                <div className="gv-fd-clear">
                  <span className="gv-fd-clear-disc" aria-hidden><CheckCircle2 size={22} strokeWidth={2.2} /></span>
                  <span className="gv-fd-clear-text">You&apos;re all caught up</span>
                </div>
              )}
            </DashCard>
          </div>

          <div className="gv-fd-two">
            <DashCard
              title="Invoices"
              hint="Every item each person was billed: tickets, registration fees and add-ons, with what is paid, owed, waived or refunded."
            >
              <Big n={data.people_billed} cap={data.people_billed === 1 ? 'person billed' : 'people billed'} />
              <div className="gv-fd-foot">
                <Link href={`/manage/${slug}/financials/invoices`} className="gv-st-btn gv-st-outline">Open invoices</Link>
              </div>
            </DashCard>

            <DashCard
              title="Generate Invoices"
              line="Make an invoice or receipt for any payment, in your conference's name"
              hint="Schools and sponsors often need a formal invoice or receipt. This makes one under your conference's name, ready to send."
            >
              <div className="gv-fd-foot">
                <button type="button" className="gv-st-btn gv-st-outline" disabled={!GENERATE_INVOICES_READY || financialsReadOnly}>Generate invoices</button>
                {!GENERATE_INVOICES_READY && <span className="gv-st-quiet">Available soon</span>}
              </div>
            </DashCard>
          </div>

          <div className="gv-fd-four">
            <PaymentMethodCard s={data.settings} onOpen={openSettings} readOnly={financialsReadOnly} />
            <RegistrationFeeCard s={data.settings} onOpen={openSettings} readOnly={financialsReadOnly} formatCents={cents} />
            <AddonsCard s={data.settings} onOpen={openSettings} readOnly={financialsReadOnly} />
            <VouchersCard s={data.settings} onOpen={openSettings} readOnly={financialsReadOnly} />
          </div>
        </div>
      )}

      {popup === 'money' && data && <MoneyPopup d={data} slug={slug} onClose={() => setPopup(null)} />}
      {popup === 'todo' && (
        <ThingsToDoPopup
          conferenceId={conference.id}
          readOnly={financialsReadOnly}
          onClose={() => { setPopup(null); reload(); }}
        />
      )}

      {/* Referrals: who referred whom. Renders nothing for a conference with no referral codes. */}
      <div style={{ marginTop: 32 }}>
        <ReferralsSection conference={conference} />
      </div>
    </div>
  );
}
