import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { H2, H3, Callout, FactCard, TableWrap } from '@/components/blog/prose';

export const metadata: Metadata = pageMetadata({
  title: 'MUN Conference Registration and Payments: Fees, Invoices and Refunds',
  description:
    'How to take money from schools in six countries without losing track of who paid, plus a refund policy you can publish before the first payment arrives',
  path: '/blog/mun-conference-registration-payments',
  ogDescription: 'Taking delegate fees properly: stages, invoices, manual payments and a refund policy that holds.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'MUN Conference Registration and Payments: Fees, Invoices and Refunds',
  description: 'Taking delegate fees properly: stages, invoices, manual payments and a refund policy that holds.',
  url: 'https://gavelling.com/blog/mun-conference-registration-payments',
  datePublished: '2026-09-20',
  dateModified: '2026-09-20',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/mun-conference-registration-payments' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'MUN Registration and Payments', item: 'https://gavelling.com/blog/mun-conference-registration-payments' },
  ],
};

export default function Article() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug="mun-conference-registration-payments"
        pitch="Gavelling takes conference payments through the organiser’s own Stripe account, handles manual transfers with proof review, and charges the organiser nothing."
      >
        <p>Money is the part of running a conference that nobody volunteers for and everybody remembers. A delegate whose payment went missing will tell their entire delegation. A school finance office that cannot pay you because your invoice is missing a reference number will simply not pay you, quietly, until three days before the conference. This guide covers the whole chain: who is paying, in what stages, through what routes, and the refund policy you write before you take a single pound.</p>

        <H2>Who is actually paying</H2>
        <p>Three payers, three flows, and treating them as one is the first mistake.</p>
        <ul>
          <li><strong>The individual delegate.</strong> Pays by card, on a phone, usually late at night, often not from the country your bank is in. Wants a receipt immediately.</li>
          <li><strong>The school or university.</strong> Pays by bank transfer against an invoice, through a finance office that has never heard of your conference, on a payment run that happens fortnightly. Cannot pay a person, only an institution.</li>
          <li><strong>The society or delegation.</strong> Somewhere between the two. One student holds a society card and pays for fourteen people, then needs a single document to reclaim it from their students union.</li>
        </ul>
        <p>Design for all three from the start. A conference that only accepts cards excludes most institutional payers outside the handful of countries where school finance offices use cards at all. A conference that only invoices makes an individual delegate wait two weeks for a seat.</p>

        <H2>The five stages, and what happens when you collapse them</H2>
        <p>Registration is not one step. It is five, and each boundary exists because something goes wrong when it is missing.</p>
        <TableWrap>
          <table>
            <thead><tr><th>Stage</th><th>What it does</th><th>What breaks if you skip it</th></tr></thead>
            <tbody>
              <tr><td>1. Expression of interest</td><td>A school says how many delegates it expects</td><td>You size the venue against hope instead of intent</td></tr>
              <tr><td>2. Application</td><td>Named delegates, preferences, experience</td><td>You cannot allocate, and you cannot email individuals</td></tr>
              <tr><td>3. Acceptance</td><td>You confirm seats and issue what is owed</td><td>People pay for seats you did not have</td></tr>
              <tr><td>4. Payment</td><td>Money arrives and is matched to named people</td><td>You arrive on the day not knowing who has paid</td></tr>
              <tr><td>5. <Link href="/blog/mun-conference-day-operations">Check-in</Link></td><td>The person is physically here</td><td>You cannot reconcile no-shows against paid seats</td></tr>
            </tbody>
          </table>
        </TableWrap>
        <p>The tempting collapse is merging 3 and 4: take the money at application. It is attractive because cash arrives early, and it creates the worst refund problem you can have, because you are now refunding people you rejected. Accept first, then charge. The second tempting collapse is merging 2 and 3 for delegations, which means a school that said twelve and sends nine has paid for twelve and will ask for three refunds.</p>
        <Callout>Never let a seat be held by an unpaid promise for longer than your payment window. Publish the window, usually fourteen or twenty-one days from acceptance, and say plainly that an unpaid seat returns to the pool at the end of it. Then actually release them, once, and tell everyone you did.</Callout>

        <H2>Card payments, and who is merchant of record</H2>
        <p>The phrase to understand before you sign anything is <em>merchant of record</em>: the entity the delegate&rsquo;s bank thinks they paid. It decides whose name appears on the card statement, who holds the money between payment and payout, who handles a chargeback, and who is legally on the hook if the conference does not happen.</p>
        <p>Two models exist on the market.</p>
        <ul>
          <li><strong>The platform is merchant of record.</strong> Money lands in the platform&rsquo;s account and is paid out to you later, sometimes after the conference. Simpler to set up, and it means a third party is holding your delegates&rsquo; money and setting the terms on which you see it.</li>
          <li><strong>You are merchant of record.</strong> You connect your own payment account, the money lands in it directly, your name is on the statement, and you own the relationship with your delegates and with your bank.</li>
        </ul>
        <p>Gavelling uses the second model: payments run through the organiser&rsquo;s own Stripe account via Stripe Connect, so the society or school is the merchant of record and the funds are theirs from the moment they settle. The platform fee is 5 per cent, plus the card processing cost passed through at cost, and the organiser is never charged a per-delegate or per-day licence.</p>
        <p>Whatever you use, work out your all-in cost per transaction before you set the fee, and decide explicitly whether you absorb it or add it. Both are defensible. Silently absorbing it and discovering the gap in week ten is not.</p>

        <H2>Bank transfer and manual payment</H2>
        <p>Outside the countries card processing reaches easily, bank transfer is not the fallback, it is the main route. Handle it as a first-class flow rather than an exception managed in a shared inbox.</p>
        <p>What a workable manual process needs:</p>
        <ul>
          <li><strong>A unique reference per payer</strong>, short and on the invoice. Without it you will have four transfers of the same amount and no idea whose they are.</li>
          <li><strong>A single place to upload proof of payment</strong>, attached to the delegation record rather than emailed to a person who may be on holiday.</li>
          <li><strong>A review step with two outcomes and a note.</strong> Approved, or rejected with a reason the payer can act on.</li>
          <li><strong>A rule about who pays the transfer fees.</strong> An international transfer can arrive short. Say in advance that the sender covers all charges and that a short payment leaves a balance due.</li>
          <li><strong>A currency rule.</strong> State the currency you invoice in and that conversion differences are the payer&rsquo;s.</li>
        </ul>
        <p>Gavelling supports this as a proper flow: a manual payment is recorded against the invoice, proof is uploaded and reviewed by the organising team, and the participant&rsquo;s record shows the same state as a card payment would.</p>

        <H2>Invoicing a school finance office</H2>
        <p>An invoice that a finance office cannot process is an invoice that does not get paid, and nobody will tell you why. Requirements differ by country, so check locally, but the following are asked for almost everywhere.</p>
        <FactCard title="What a finance office needs on the document">
          The legal name of the paying institution, exactly as they gave it. Your legal entity name and address, not the conference brand. An invoice number and date. A purchase order or reference number if they issued one, which is the field most often missing. A line per item, with unit price, quantity and total. The currency, stated. Your bank details including IBAN, BIC or SWIFT where relevant. The payment due date. Your tax registration number, or a clear statement that the entity is not registered.
        </FactCard>
        <p>Three practical points. Ask for the purchase order number at acceptance, not after the invoice bounces. Send invoices to the finance address the school gives you, not to the teacher, then copy the teacher. And allow for payment runs: a finance office paying fortnightly needs the invoice at least a month before you want the money, which means your payment window has to be longer for institutional payers than for individuals.</p>

        <H2>Fee structures that work</H2>
        <ul>
          <li><strong>Early bird.</strong> A genuine discount for paying by a real date. It pulls cash forward, which matters because your venue deposit is due long before your last delegate registers.</li>
          <li><strong>Delegation rate.</strong> A per-delegate discount above a threshold, usually eight or ten students. Rewards the schools that make your numbers work.</li>
          <li><strong>Per-role fees.</strong> Delegates, observers and faculty advisors do not consume the same things. Advisors are commonly free or nearly free, because an advisor is supervision you are not paying for.</li>
          <li><strong>Chairs.</strong> Almost universally free, and often with meals covered. They are staff.</li>
          <li><strong>Add-ons.</strong> The social, the dinner, a printed delegate pack. Keep them optional and priced separately so the base fee stays low enough to be approved by a head of department.</li>
          <li><strong>Application fee.</strong> A small non-refundable fee that deters speculative applications. Use it only if you are genuinely oversubscribed, and never when you are trying to grow.</li>
        </ul>
        <p>Set the numbers against a <Link href="/blog/mun-conference-budget">real budget</Link> rather than against what the conference down the road charges. Cost per delegate, plus contingency, plus the margin you need to survive under-registration, is the calculation.</p>

        <H2>Financial aid and waivers</H2>
        <p>Have a policy, publish it, and fund it deliberately. Aid that is invented case by case in week nine is unfair and exhausting.</p>
        <p>What works: a fixed pot decided at budget time, a short application that asks for the amount needed rather than a means test you are not qualified to assess, partial awards as the default so the pot reaches more people, and a decision made by two named people rather than one. Tell applicants the outcome on a published date, and tell the unsuccessful ones early enough to withdraw without losing anything.</p>
        <p>Keep aid decisions strictly separate from allocation decisions, and make sure neither the chairs nor the allocation team can see who received aid. It should be impossible for a delegate to believe their committee was affected by their ability to pay.</p>

        <H2>A refund policy you can publish</H2>
        <p>Write it before the first payment, put it on the registration page, and repeat it in the acceptance email. A policy that appears only after someone asks for a refund reads as invention, however reasonable it is.</p>
        <FactCard title="Sample refund policy, adapt to your conference">
          <p><strong>1. Cancellation tiers.</strong> Cancellations received more than 60 days before the first day of the conference: full refund less a non-refundable administration charge of [amount]. Between 60 and 30 days: 50 per cent refund. Fewer than 30 days, or non-attendance: no refund.</p>
          <p><strong>2. Substitution.</strong> A delegation may replace a registered delegate with another delegate from the same institution at no charge up to 7 days before the conference, by written notice. The replacement takes the original allocation.</p>
          <p><strong>3. Payment charges.</strong> Refunds are made by the original payment method, in the currency invoiced. Bank charges and currency differences are not refunded.</p>
          <p><strong>4. Cancellation by the conference.</strong> If the conference is cancelled in full by the organisers, all registration fees paid are refunded. The organisers are not responsible for travel or accommodation costs.</p>
          <p><strong>5. Force majeure.</strong> If the conference cannot proceed as planned for reasons outside the organisers&rsquo; control, the organisers may move it online or to new dates, or cancel it. Where the conference proceeds in a changed form, fees are not automatically refunded and the cancellation tiers above continue to apply.</p>
        </FactCard>
        <p className="gv-note">This is a starting point, not legal advice. Consumer rules on distance selling and cancellation vary by country and may override what you write, so have it checked by whoever signs off your society or school contracts.</p>
        <p>Two things to decide explicitly because they cause most of the arguments: whether the administration charge applies per delegate or per delegation, and what happens when a school cancels four of twelve delegates, which is a partial cancellation rather than a substitution.</p>

        <H2>Chasing unpaid fees</H2>
        <p>The relationship is worth more than the fee, because the school that annoys you this year sends twelve delegates next year. Chase on a schedule rather than on emotion.</p>
        <ul>
          <li><strong>Day 0:</strong> invoice, with the due date and the reference.</li>
          <li><strong>Seven days before due:</strong> a short reminder to the finance contact, copying the teacher. Attach the invoice again rather than referring to it.</li>
          <li><strong>Due date plus 3:</strong> a direct note to the teacher, not the finance office, because they are the person who can actually chase inside the school.</li>
          <li><strong>Due date plus 10:</strong> state the consequence and the date it takes effect, once, calmly.</li>
          <li><strong>Then act on it.</strong> A deadline you do not enforce trains every delegation to ignore the next one.</li>
        </ul>
        <p>Keep one exception in your pocket: a school that tells you early that their payment run is slow, with a date, is not a problem. A school that says nothing is.</p>

        <H2>Reconciliation after the conference</H2>
        <p>Close the books within two weeks, while people still remember. What the treasurer, and eventually your school or students union, will ask for:</p>
        <ul>
          <li>Total invoiced, total received, total outstanding, and the gap explained line by line.</li>
          <li>Refunds issued, with reasons.</li>
          <li>Registered against attended: your no-show rate, which is the single most useful number for pricing next year.</li>
          <li>Processing costs as an actual figure, not an estimate.</li>
          <li>Aid awarded against the aid budget.</li>
          <li>The handover note: what to change, written now rather than in August.</li>
        </ul>

        <H3>Before you open registration</H3>
        <ul className="gv-check">
          <li>Payment routes chosen, including a manual route.</li>
          <li>Merchant of record understood and the account connected.</li>
          <li>Fee table published with every role and add-on.</li>
          <li>Refund policy written, checked and on the registration page.</li>
          <li>Invoice template carrying every field a finance office needs.</li>
          <li>Payment window set, and the rule for releasing unpaid seats.</li>
          <li>Aid pot sized and the application open.</li>
          <li>One person named as the money contact, with an address that is not personal.</li>
        </ul>
        <p>Payments sit directly against two other jobs. What you charge comes out of <Link href="/blog/mun-conference-planning">the conference plan</Link> and its budget, and who you can seat depends on who has paid, which is the first constraint in our guide to <Link href="/blog/mun-country-allocation">country allocation</Link>. If you are running the whole thing for the first time, our <Link href="/blog/mun-director-guide">director&rsquo;s guide</Link> is the wider view. If the conference does not exist yet, start with <Link href="/blog/start-a-mun-conference">how to start a MUN conference</Link>.</p>
      </ArticleLayout>
    </>
  );
}
