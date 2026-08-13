import Link from 'next/link';
import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import { LegalShell, LegalSection, Disclosure } from '@/components/LegalPage';
import { COMPANY, PLACE_OF_REGISTRATION } from '@/lib/companyDetails';

export const metadata: Metadata = pageMetadata({
  title: 'Terms of Service',
  description: 'The terms governing your use of Gavelling — the Model UN conference and committee platform operated by GAVELLING LTD.',
  path: '/terms',
});

const EFFECTIVE_DATE = 'August 3, 2026';
const CONTACT_EMAIL = 'wearegavelling@gmail.com';

const A = { color: '#1B3828', fontWeight: 700 } as const;
const UL = 'list-disc ps-5 mt-2 space-y-1';

export default function TermsPage() {
  return (
    <LegalShell
      title="Terms of"
      italicWord="Service"
      effectiveDate={EFFECTIVE_DATE}
      intro={
        <>
          <p>
            These terms cover both parts of Gavelling — <strong>Sessions</strong> (running a live committee) and{' '}
            <strong>Conferences</strong> (listing, applying to and attending a conference). The sections below apply to
            everyone; <Link href="#by-role" style={A}>section 5</Link> sets out what changes depending on whether you are
            a delegate, a chair, or the person organising.
          </p>
          <p className="mt-3" style={{ color: '#6B5F52' }}>
            Plain English, no traps. If anything here is unclear, email{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} style={A}>{CONTACT_EMAIL}</a>{' '}and we&apos;ll explain it.
          </p>
        </>
      }
    >
      <LegalSection n={1} title="Who we are">
        <p>
          Gavelling is a Model United Nations conference and committee platform at <strong>gavelling.com</strong>,
          operated by <strong>{COMPANY.name}</strong>, a private limited company{' '}
          {PLACE_OF_REGISTRATION.replace('Registered in', 'registered in')} under company number{' '}
          <strong>{COMPANY.number}</strong>, registered office {COMPANY.address}.
        </p>
        <p>
          &quot;We&quot;, &quot;us&quot; and &quot;our&quot; mean {COMPANY.name}. &quot;You&quot; means the person using
          Gavelling.
        </p>
        <p>
          Gavelling is independent. It is <strong>not affiliated with, endorsed by, or connected to the United Nations</strong>{' '}
          or any government. Simulations run on it are educational exercises.
        </p>
      </LegalSection>

      <LegalSection n={2} title="Agreeing to these terms">
        <p>
          By creating an account, joining a session, applying to a conference, or otherwise using Gavelling, you agree to
          these terms and to our <Link href="/privacy" style={A}>Privacy Policy</Link>. If you don&apos;t agree, please
          don&apos;t use the platform.
        </p>
        <p>
          If you&apos;re acting for a school, university, society or conference, you confirm you&apos;re allowed to accept
          these terms on its behalf.
        </p>
      </LegalSection>

      <LegalSection n={3} title="Eligibility and young people" id="eligibility">
        <p>
          Model UN is run in schools, so Gavelling is used by people under 18. You may use Gavelling if you are{' '}
          <strong>13 or older</strong>. If you&apos;re under 18, use it with the knowledge and permission of a parent,
          guardian, teacher or faculty advisor.
        </p>
        <p>
          If you&apos;re under 13, please don&apos;t create an account. Where a school or conference enters a young
          person&apos;s details for them, that organisation is responsible for having permission to do so.
        </p>
        <p>
          If you believe a child&apos;s data is on Gavelling without the right permission, email{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} style={A}>{CONTACT_EMAIL}</a> and we will delete it.
        </p>
      </LegalSection>

      <LegalSection n={4} title="Your account">
        <ul className={UL}>
          <li>Give accurate details, and keep them current.</li>
          <li>You&apos;re responsible for what happens under your account, and for keeping your login secure.</li>
          <li>Don&apos;t share your account, and don&apos;t use anyone else&apos;s.</li>
          <li>
            Tell us at <a href={`mailto:${CONTACT_EMAIL}`} style={A}>{CONTACT_EMAIL}</a> if you think someone else has
            got into your account.
          </li>
        </ul>
      </LegalSection>

      {/* ── The role-specific terms ─────────────────────────────────────────── */}
      <LegalSection n={5} title="What applies to you" id="by-role">
        <p>
          Gavelling is used by very different people — a delegate joining one committee, and a secretariat running a
          conference for a thousand, are doing quite different things. Open the panel that matches you.
        </p>

        <div className="space-y-3 pt-3">
          <Disclosure eyebrow="Sessions" title="If you're a delegate, chair or faculty advisor in a session" defaultOpen>
            <ul className={UL}>
              <li>
                No account is needed. You join with a <strong>6-character session code</strong> from your chair — treat
                that code like a key, and only share it with people meant to be in the committee.
              </li>
              <li>
                What you enter is <strong>visible to others in the session</strong> — your name, country, speeches
                logged, chat messages, and any documents you submit. Don&apos;t put anything private in them.
              </li>
              <li>
                The chair runs the committee: they manage the speakers list, motions, voting and who is present, and can
                remove someone from the session.
              </li>
              <li>
                <strong>Session data is deleted 72 hours after the session ends.</strong> If you want to keep a
                resolution or a paper, save your own copy before then.
              </li>
              <li>
                Debate the topic, not the person. Committee is meant to be adversarial; harassment of real people is
                not, and can end your access.
              </li>
            </ul>
          </Disclosure>

          <Disclosure eyebrow="Sessions" title="If you're running a session">
            <ul className={UL}>
              <li>
                You control the committee: creating it, admitting delegates, assigning countries, and ending it. You are
                responsible for how you run it.
              </li>
              <li>
                You&apos;re responsible for the details you enter about other people — delegate names and country
                assignments in particular. Enter only what the committee needs.
              </li>
              <li>
                If you&apos;re a teacher, advisor or student leader entering details of people{' '}
                <strong>under 18</strong>, make sure you have the permission of your school or their guardian.
              </li>
              <li>
                Anyone with the session code can join. Share it only with your committee, and start a new session if a
                code gets out.
              </li>
              <li>
                Sessions are automatically deleted 72 hours after they end. Export anything you need to keep — we
                can&apos;t recover it afterwards.
              </li>
            </ul>
          </Disclosure>

          <Disclosure eyebrow="Conferences" title="If you're applying to or attending a conference">
            <p style={{ color: '#8B2020', fontWeight: 600 }}>
              The most important thing on this page: your agreement for a conference is with the{' '}
              <strong>organiser</strong>, not with us. We provide the software they run it on.
            </p>
            <ul className={UL}>
              <li>
                Your application — including your answers, preferences and any documents — is sent to that
                conference&apos;s organising team, who decide on it.
              </li>
              <li>
                <strong>Admission, committee and country allocation, awards, fees and refunds are all the
                organiser&apos;s decisions.</strong> If a conference is cancelled, moved, or you want money back, raise
                it with them. We can help with technical problems on the platform.
              </li>
              <li>You can hold one active application per conference, and you can withdraw it at any time.</li>
              <li>
                Your MUN CV is yours. You can choose to publish it at a public link — if you do, the entries on it become
                visible to anyone with that link, and you can unpublish it whenever you like.
              </li>
              <li>
                Fees you pay to a conference are collected for that organiser. Payment is handled by Stripe; we never see
                your full card details.
              </li>
            </ul>
          </Disclosure>

          <Disclosure eyebrow="Conferences" title="If you're organising a conference">
            <p>
              Organisers get access to other people&apos;s personal data — often minors&apos; — so more is expected of
              you. By running a conference on Gavelling you agree that:
            </p>
            <ul className={UL}>
              <li>
                You&apos;ll describe your conference <strong>honestly</strong> — dates, location, format, fees, and what
                a fee does and doesn&apos;t cover.
              </li>
              <li>
                You are the <strong>data controller</strong> for the applicant and participant data you collect through
                Gavelling, and we act as your <strong>processor</strong>. You need your own lawful basis for what you
                collect, and you must honour participants&apos; data rights. See our{' '}
                <Link href="/privacy#your-rights" style={A}>Privacy Policy</Link>.
              </li>
              <li>
                Use participant data <strong>only to run your conference</strong>. Never sell it, pass it on, or use it
                for unrelated marketing.
              </li>
              <li>
                <strong>Safeguarding is yours.</strong> You are responsible for the duty of care owed to attendees,
                especially under-18s — including any checks, supervision, insurance and permissions your jurisdiction
                requires.
              </li>
              <li>You&apos;re responsible for any taxes due on the fees you charge.</li>
              <li>
                Keep your team&apos;s access tight: give access only to people who need it, and remove them when they
                don&apos;t.
              </li>
              <li>
                We may suspend or remove a listing that appears fraudulent, unsafe, unlawful, or in serious breach of
                these terms.
              </li>
            </ul>
          </Disclosure>
        </div>
      </LegalSection>

      <LegalSection n={6} title="Your content">
        <p>
          You keep ownership of what you create — position papers, working papers, resolutions, messages, conference
          descriptions and profile information.
        </p>
        <p>
          You give us permission to host, store, copy and display that content <strong>only so we can run the platform
          for you</strong> — showing your paper to your chair, or your application to the organiser you applied to. That
          permission ends when you delete the content, apart from copies that sit briefly in routine backups.
        </p>
        <p>You confirm you have the right to upload what you upload, and that it doesn&apos;t infringe anyone else&apos;s rights.</p>
      </LegalSection>

      <LegalSection n={7} title="Acceptable use">
        <p>Don&apos;t use Gavelling to:</p>
        <ul className={UL}>
          <li>Harass, bully, threaten, defame or discriminate against anyone.</li>
          <li>Post unlawful, hateful, sexual or violent material, or anything harmful to children.</li>
          <li>Impersonate another person, conference or institution.</li>
          <li>Break into, disrupt, overload, scrape or reverse engineer the platform, or get around access limits, credit limits or paywalls.</li>
          <li>Upload malware, or send spam.</li>
          <li>Collect other people&apos;s personal data for anything other than running your own conference.</li>
        </ul>
        <p>
          We may remove content and suspend or close accounts that break these rules, and report serious matters where
          the law requires it.
        </p>
      </LegalSection>

      <LegalSection n={8} title="Fees, credits and subscriptions">
        <ul className={UL}>
          <li>Some features are free; others need credits or a paid subscription. Prices are shown before you buy.</li>
          <li>Payments are processed by <strong>Stripe</strong>. We don&apos;t receive or store full card details.</li>
          <li>Subscriptions renew automatically until cancelled. Cancel any time — it takes effect at the end of the current billing period.</li>
          <li>Credits are for use on the platform. They have no cash value and aren&apos;t transferable or refundable for money.</li>
          <li>Delegate fees charged by a conference belong to that organiser, not to us — see section 5.</li>
        </ul>
        <p>
          <strong>Cancelling.</strong> As a consumer in the UK or EU you normally have 14 days to cancel a digital
          purchase. If you ask to start using a paid feature immediately, you may lose that right once we&apos;ve
          provided it. None of this affects your statutory rights.
        </p>
      </LegalSection>

      <LegalSection n={9} title="Our intellectual property">
        <p>
          The platform — its software, design, branding and the content we create — belongs to {COMPANY.name} and its
          licensors. These terms let you use the service; they don&apos;t transfer ownership. Please don&apos;t copy our
          branding or pass the platform off as your own product.
        </p>
      </LegalSection>

      <LegalSection n={10} title="Services we rely on">
        <p>
          Gavelling runs on <strong>Supabase</strong> (database, accounts, storage), <strong>Vercel</strong> (hosting),{' '}
          <strong>Stripe</strong> (payments) and <strong>Resend</strong> (email). How they handle data is set out in our{' '}
          <Link href="/privacy" style={A}>Privacy Policy</Link>. Conference pages may link to outside sites we
          don&apos;t control or endorse.
        </p>
      </LegalSection>

      <LegalSection n={11} title="Availability">
        <p>
          We work hard to keep Gavelling up, especially during live committee sessions, but we can&apos;t promise it will
          never be interrupted. Maintenance, updates or failures at our providers can affect access, and the service is
          provided &quot;as is&quot; so far as the law allows.
        </p>
        <p>Keep your own copies of anything important — session data is deleted on the schedule in our Privacy Policy.</p>
      </LegalSection>

      <LegalSection n={12} title="Our liability">
        <p>
          Nothing here limits our liability for death or personal injury caused by our negligence, for fraud, or for
          anything else that can&apos;t lawfully be excluded — including your statutory rights as a consumer.
        </p>
        <p>Beyond that, we&apos;re not liable for:</p>
        <ul className={UL}>
          <li>Loss of profits, business, goodwill or expected savings.</li>
          <li>Loss or corruption of data, beyond restoring from our routine backups.</li>
          <li>What a conference organiser, chair or other user does or fails to do.</li>
          <li>Losses that weren&apos;t reasonably foreseeable when you started using the service.</li>
        </ul>
        <p>
          Where we are liable, our total liability to you in any 12-month period is limited to the greater of what you
          paid us in that period, or £100.
        </p>
      </LegalSection>

      <LegalSection n={13} title="Suspension and ending your account">
        <p>
          You can stop using Gavelling and delete your account at any time from your account settings. We may suspend or
          end access if you seriously or repeatedly break these terms, or if the law requires it.
        </p>
        <p>
          If we close your account without good reason, we&apos;ll refund any unused paid period. Sections that should
          naturally survive — including 6, 9, 12 and 16 — carry on applying afterwards.
        </p>
      </LegalSection>

      <LegalSection n={14} title="Changes to these terms">
        <p>
          We may update these terms as the platform develops. We&apos;ll change the effective date at the top, and give
          notice in the app or by email for significant changes. Carrying on using Gavelling after a change means you
          accept the updated terms.
        </p>
      </LegalSection>

      <LegalSection n={15} title="Complaints">
        <p>
          If something has gone wrong, email <a href={`mailto:${CONTACT_EMAIL}`} style={A}>{CONTACT_EMAIL}</a> and
          we&apos;ll try to put it right. For anything about your personal data see{' '}
          <Link href="/privacy#your-rights" style={A}>Your Rights</Link> — you can also complain to the UK Information
          Commissioner&apos;s Office at <span style={{ fontWeight: 600 }}>ico.org.uk</span>.
        </p>
      </LegalSection>

      <LegalSection n={16} title="Governing law" id="governing-law">
        <p>
          These terms are governed by the laws of <strong>England and Wales</strong>, and disputes go to the courts of
          England and Wales. If you&apos;re a consumer living elsewhere in the UK or in the EU, you keep the protection
          of the mandatory laws where you live, and can bring proceedings there.
        </p>
      </LegalSection>

      <LegalSection n={17} title="Contact">
        <p>
          {COMPANY.name}
          <br />
          {COMPANY.address}
          <br />
          {PLACE_OF_REGISTRATION} no. {COMPANY.number}
          <br />
          <a href={`mailto:${CONTACT_EMAIL}`} style={A}>{CONTACT_EMAIL}</a>
        </p>
      </LegalSection>
    </LegalShell>
  );
}
