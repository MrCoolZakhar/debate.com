import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { authorJsonLd } from '@/components/blog/authors';
import { H2, Callout, FactCard, TableWrap } from '@/components/blog/prose';

export const metadata: Metadata = pageMetadata({
  title: 'MUN Visa Invitation Letters: What to Write, When, and What Not to Promise',
  description:
    'What a conference invitation letter must contain, lead times, who signs it, the sentences to leave out, and how to handle a refusal',
  path: '/blog/mun-visa-invitation-letters',
  ogDescription: 'What a MUN visa invitation letter must contain, and what it must never say.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'MUN Visa Invitation Letters: What to Write, When, and What Not to Promise',
  description: 'What a Model UN conference visa invitation letter must contain, when to issue it, and how not to create a problem for your conference.',
  url: 'https://gavelling.com/blog/mun-visa-invitation-letters',
  datePublished: '2026-09-20',
  dateModified: '2026-09-20',
  author: authorJsonLd('peter'),
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/mun-visa-invitation-letters' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'MUN Visa Invitation Letters', item: 'https://gavelling.com/blog/mun-visa-invitation-letters' },
  ],
};

export default function Article() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug="mun-visa-invitation-letters"
        pitch="Know exactly who is coming before you write a single letter. Gavelling tracks applications, allocations and payment status for your conference in one place."
      >
        <p>Somewhere in the registration inbox of every international Model UN conference is an email that begins &quot;our delegation needs an invitation letter for our visa applications&quot;, and it usually arrives later than it should. What you send back matters: it is a document that goes to a consulate with your institution&apos;s name on it, and the difference between a useful letter and a careless one is mostly a matter of knowing what belongs in it.</p>

        <p className="gv-note"><strong>Scope.</strong> This is practical guidance on how conferences handle invitation letters. It is not legal or immigration advice, and nothing here is a statement of any country&apos;s visa requirements. Requirements differ by destination, by nationality, by visa category and by year, and they change. Applicants must follow the published rules of the embassy or consulate handling their application. Before you issue letters, have your school or university&apos;s legal, compliance or international office approve your template and your policy, and ask your institution what it is willing to sign.</p>

        <H2>What the letter is, and what it is not</H2>
        <p>An invitation letter is a factual statement from the organisers confirming that a named person has been accepted to attend a named event on named dates, and setting out the practical arrangements around that attendance. That is all it is.</p>
        <p>It is not a visa, it is not a guarantee that a visa will be granted, it is not a sponsorship in any legal sense unless your institution has separately agreed to that, and it is not proof of anything about the applicant beyond their registration with you. Consular officers read a great many of these, and they weigh the letter as one document among several: the applicant&apos;s own circumstances, their travel history and their financial evidence usually matter far more.</p>
        <Callout>The letter&apos;s real job is to make the visit legible: a real event, real dates, a real organisation, a real named contact who can be telephoned. A letter that is specific and verifiable is useful. A letter full of assurances about the applicant is not, and can actively hurt.</Callout>

        <H2>Lead times</H2>
        <p>Processing times vary enormously by country, nationality and season, and appointment availability is often the real constraint rather than the decision itself. The practical planning rule used by conferences that host international delegations regularly is to treat three to six months as normal and to build the timetable backwards from the earliest date an applicant can apply.</p>
        <TableWrap>
          <table>
            <thead><tr><th>When</th><th>What should have happened</th></tr></thead>
            <tbody>
              <tr><td>6 months out</td><td>Registration open. Visa policy published on the conference site, with the deadline for letter requests</td></tr>
              <tr><td>5 months out</td><td>International delegations accepted and invoiced ahead of domestic ones</td></tr>
              <tr><td>4 months out</td><td>Letters issued as acceptances and payments confirm. Tracking sheet started</td></tr>
              <tr><td>3 months out</td><td>Last practical date for a first-time request. Say so publicly</td></tr>
              <tr><td>2 months out</td><td>Chase anyone issued a letter who has not confirmed an appointment</td></tr>
              <tr><td>1 month out</td><td>Refusals handled: refunds, seat reallocation, remote options decided</td></tr>
            </tbody>
          </table>
        </TableWrap>
        <p>Publish a hard deadline for letter requests and hold it. A request arriving six weeks before the conference is usually not going to succeed, and issuing a letter you know will not help does the delegation no favours: it encourages them to spend money on an application and a fee they will probably lose. It is kinder to be direct, offer a remote option if you have one, and invite them next year.</p>

        <H2>What the letter must contain</H2>
        <p>Work from a template and fill every field. A missing date or an unnamed signatory is what makes a letter look improvised.</p>
        <ul className="gv-check">
          <li><strong>Institutional letterhead</strong>, with the full legal name of the school, university or organisation, a postal address, a telephone number and a website</li>
          <li><strong>Date of issue</strong> and a reference number, so you can find it again</li>
          <li><strong>Conference name, dates and full venue address</strong>, including the start and end dates of the event itself</li>
          <li><strong>The applicant&apos;s full name exactly as it appears in their passport</strong>, their passport number if they have supplied it, date of birth and nationality</li>
          <li><strong>Their role</strong>: delegate, chair, faculty advisor, observer, and the committee or delegation if relevant</li>
          <li><strong>Confirmation of acceptance and of registration status</strong>, including whether fees have been paid</li>
          <li><strong>Who is paying for what</strong>: registration, accommodation, meals, travel, stated precisely and limited to what is actually true</li>
          <li><strong>Accommodation arrangements</strong> if the conference provides them, with the name and address of the accommodation</li>
          <li><strong>A named signatory</strong> with a role, a direct email address and a telephone number, plus a wet or verifiable digital signature</li>
        </ul>
        <p>Name spellings must match the passport, not the registration form and not what the delegate is usually called. Ask for a passport scan or, at minimum, the name exactly as machine-printed in the passport, and check it character by character before signing. A mismatched name is the single most common reason a letter is rejected as evidence.</p>

        <H2>Who signs, and why a student signature is often not enough</H2>
        <p>A letter signed &quot;Secretary-General&quot; by a sixteen-year-old, on a logo made in a design tool, is not an institutional document. Consular officers can generally tell, and faculty advisors certainly can.</p>
        <p>Get the letter onto the letterhead of the legal entity behind the conference: the school, the university, the students&apos; union, or the registered organisation that holds the bank account. The signatory should be a member of staff or an officer of that entity, usually the faculty supervisor, the head of the department, the international office, or a students&apos; union officer, depending on who owns the event.</p>
        <p>This is not a formality you can shortcut, and it has a second benefit: it forces you to have a <Link href="/blog/start-a-mun-conference">conversation with your institution</Link> about the conference&apos;s international attendance before the letters go out, which is where any objection is much cheaper to discover. If your institution refuses to sign, that is an answer about your conference&apos;s status, and you should tell prospective international delegations plainly that you cannot provide letters.</p>

        <H2>What never to say in one</H2>
        <p>Every sentence below has appeared in real conference letters and every one of them is a mistake.</p>
        <ul>
          <li><strong>&quot;We guarantee that the applicant will return to their home country.&quot;</strong> You cannot guarantee it, you have no basis to assert it, and a consular officer will treat the letter as less credible for saying so.</li>
          <li><strong>&quot;We take full financial responsibility for the applicant.&quot;</strong> Never write this unless your institution has formally agreed to it, in which case it is a contractual undertaking that needs their approval, not yours.</li>
          <li><strong>&quot;We request that a visa be granted.&quot;</strong> Do not ask for an outcome. State facts and let the letter be evidence.</li>
          <li><strong>&quot;The applicant is of good character and will comply with all conditions.&quot;</strong> You are vouching for something you do not know.</li>
          <li><strong>Anything about employment, study or extending the stay.</strong> The visit is for a conference on fixed dates. Keep it to that.</li>
          <li><strong>Any detail that is not true yet.</strong> Do not write that fees are paid when they are not, or that accommodation is provided when it is optional.</li>
        </ul>
        <Callout>A useful test before signing: could you prove every sentence in this letter from your own records? If a sentence is a promise about the future behaviour of a person you have never met, delete it.</Callout>

        <H2>Your own exposure, and the policy that protects you</H2>
        <p>What you are being asked to do is confirm, on institutional paper, that someone is coming to your event. The risks are modest but real: a letter issued to someone who never registered, a letter altered after issue, or a pattern of letters to applicants who do not attend.</p>
        <p>A short written policy handles almost all of it, and it should be agreed with whoever signs.</p>
        <ul className="gv-check">
          <li>Letters are issued only after acceptance and after payment or a deposit has cleared</li>
          <li>One letter per named individual, issued to the <Link href="/blog/mun-chaperone-guide">faculty advisor</Link> or delegation head, never to a general address</li>
          <li>Every letter carries a reference number and is logged</li>
          <li>Letters are issued as a signed PDF, and reissued rather than edited if something is wrong</li>
          <li>Requests after the published deadline are declined, in writing, with a remote option offered if one exists</li>
          <li>The named contact answers verification calls from consulates and knows to expect them</li>
          <li>Nobody but the named signatory issues letters, and the template is not circulated</li>
        </ul>
        <p>Requiring <Link href="/blog/mun-conference-registration-payments">payment</Link> or at least a confirmed acceptance before issuing is standard practice across international conferences, and it is the single most effective control you have. It also protects the delegations themselves, because it means a letter in circulation corresponds to a real seat.</p>

        <H2>Handling a refusal</H2>
        <p>Refusals happen, often for reasons that have nothing to do with your conference. Decide the policy before it happens and publish it with the fees, because a delegation choosing between two conferences will read it.</p>
        <TableWrap>
          <table>
            <thead><tr><th>Question</th><th>A workable answer</th></tr></thead>
            <tbody>
              <tr><td>Refund?</td><td>Full refund of the conference fee on production of the refusal notice, up to a stated date</td></tr>
              <tr><td>Who keeps the bank charges?</td><td>State it explicitly. Usually the sender</td></tr>
              <tr><td>Can the seat be transferred?</td><td>Yes, to another member of the same delegation, up to a stated date</td></tr>
              <tr><td>Remote participation?</td><td>Only if you can genuinely run it well. If not, say no rather than offering a poor version</td></tr>
              <tr><td>Reallocating the country</td><td>Keep a short waiting list, and know your cut-off date for reissuing an allocation</td></tr>
            </tbody>
          </table>
        </TableWrap>
        <p>Do not advise on reapplication, appeals or what to write on a form. That is immigration advice, it is regulated in some countries, and you are not the right source for it. Point applicants to the consulate&apos;s published guidance and to their own school or university&apos;s international office.</p>

        <H2>Tracking, and the paperwork around the letter</H2>
        <p>Keep one sheet, owned by one person, from the day registration opens: delegation, delegate name as in passport, nationality, role, letter reference, date issued, fee status, appointment confirmed, outcome, and whether they travelled. It takes minutes per week and it is the difference between knowing your attendance in advance and finding out at registration.</p>
        <p>Delegations will usually also ask for one or more of the following, so decide in advance what you can provide: a receipt or invoice showing what has been paid, written confirmation of accommodation if you are arranging it, a copy of the conference programme, and, for delegations of minors, whatever consent or supervision documentation your own policy requires. Travel insurance is normally the delegation&apos;s responsibility, and you should say so in writing rather than leaving it ambiguous. Our <Link href="/blog/mun-conference-planning">conference planning guide</Link> places this alongside the rest of the registration timeline, and the <Link href="/blog/mun-director-guide">director guide</Link> covers the secretariat roles that should own it.</p>

        <H2>A template to adapt</H2>
        <p>Adapt this with your institution and have it approved before use. It is deliberately plain.</p>
        <FactCard title="Invitation letter, sample wording">
          <p>[Institutional letterhead. Date. Reference number.]</p>
          <p>To whom it may concern,</p>
          <p>[Full legal name of institution] is hosting [Conference name], an academic Model United Nations conference, from [start date] to [end date] at [full venue address, city, country].</p>
          <p>This letter confirms that [full name as in passport], date of birth [date], passport number [number], a national of [country], has been accepted to attend the conference as a [delegate / chair / faculty advisor] representing [school or delegation]. Their registration fee of [amount] was received on [date].</p>
          <p>The conference programme runs on the dates stated above. [State exactly what the conference provides: for example, &quot;Registration includes conference materials and lunch on each conference day. Accommodation at (name and address) has been booked by the delegation. Travel and insurance are the responsibility of the participant.&quot;]</p>
          <p>Questions about this letter or about the conference may be directed to me at [email] or [telephone number].</p>
          <p>Yours faithfully,</p>
          <p>[Name], [Role], [Institution]. [Signature.]</p>
        </FactCard>
        <p className="gv-note">Sample wording only. It is not a legal document, it is not approved for any particular country, and it should be reviewed by your institution before you issue it to anyone.</p>
        <p>Finally, publish your visa policy on the <Link href="/blog/mun-conference-marketing">conference page</Link> rather than answering it one email at a time: the deadline for requests, what you will and will not sign, what you need from the applicant, and the refund policy on refusal. It saves your registration team dozens of emails, and for an international delegation deciding which conference to commit to, a clear policy is a genuine reason to choose yours. If you are comparing how other conferences handle it, the <Link href="/conferences/explore">conference directory</Link> is a quick way to see who publishes what.</p>
      </ArticleLayout>
    </>
  );
}
