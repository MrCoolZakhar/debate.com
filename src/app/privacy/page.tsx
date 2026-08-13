import Link from 'next/link';
import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import { LegalShell, LegalSection, Disclosure } from '@/components/LegalPage';
import { COMPANY, PLACE_OF_REGISTRATION } from '@/lib/companyDetails';

export const metadata: Metadata = pageMetadata({
  title: 'Privacy Policy',
  description:
    'How GAVELLING LTD collects, uses, shares and protects personal data across Gavelling Sessions and Gavelling Conferences — including your UK GDPR rights.',
  path: '/privacy',
});

const EFFECTIVE_DATE = 'August 3, 2026';
const CONTACT_EMAIL = 'wearegavelling@gmail.com';

const OUTFIT = "'Outfit', sans-serif";
const LINK = { color: '#1B3828', fontWeight: 700 } as const;

/**
 * One row of a two-column reference list (lawful bases, retention periods).
 * Rendered as a stacked row rather than a <table> so it stays readable on a
 * phone — a delegate reading this on the way to committee should not have to
 * scroll sideways.
 */
function SpecRow({ label, tag, note }: { label: string; tag: string; note?: React.ReactNode }) {
  return (
    <div className="py-3" style={{ borderTop: '1px solid rgba(221,212,192,0.9)' }}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-extrabold" style={{ color: '#1B3828', fontFamily: OUTFIT }}>
          {label}
        </span>
        <span
          className="uppercase"
          style={{
            fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.14em',
            color: '#B6871F', fontWeight: 700,
          }}
        >
          {tag}
        </span>
      </div>
      {note && <p className="mt-1" style={{ color: '#6B5B4B' }}>{note}</p>}
    </div>
  );
}

/** A right you can exercise, with the concrete way to use it. */
function RightRow({ name, what, how }: { name: string; what: string; how: React.ReactNode }) {
  return (
    <div className="py-3" style={{ borderTop: '1px solid rgba(221,212,192,0.9)' }}>
      <p>
        <strong style={{ color: '#1B3828' }}>{name}.</strong> {what}
      </p>
      <p className="mt-1" style={{ color: '#6B5B4B' }}>{how}</p>
    </div>
  );
}

export default function PrivacyPage() {
  return (
    <LegalShell
      title="Privacy"
      italicWord="Policy"
      effectiveDate={EFFECTIVE_DATE}
      intro={
        <>
          <p>
            This is the plain-English version of what we do with your personal data, and it is
            also the formal notice we are required to give you under the UK GDPR. We have tried
            to make it readable, because a lot of the people using Gavelling are still at school.
          </p>
          <p className="mt-3">
            The short version: we collect what we need to run committee sessions and conference
            applications, we do not sell anything to anyone, session data is deleted 72 hours
            after a session ends, and you can ask us to show you or delete what we hold. Your
            rights are in{' '}
            <Link href="#your-rights" style={LINK}>section 07</Link>.
          </p>
        </>
      }
    >
      {/* ─────────────────────────────────────────────────────────── 01 */}
      <LegalSection n={1} title="Who we are">
        <p>
          Gavelling is a Model United Nations conference and committee platform at{' '}
          <strong>gavelling.com</strong>. It is operated by <strong>{COMPANY.name}</strong>, a
          private limited company {PLACE_OF_REGISTRATION.replace('Registered in', 'registered in')}{' '}
          under company number <strong>{COMPANY.number}</strong>, whose registered office is{' '}
          {COMPANY.address}.
        </p>
        <p>
          In this policy, &quot;we&quot;, &quot;us&quot; and &quot;our&quot; mean {COMPANY.name}.
          For most of the data described here, {COMPANY.name} is the <strong>data controller</strong>{' '}
          — the organisation that decides what is collected and why. Section 02 explains the one
          important exception.
        </p>
        <p>
          We do not currently have a statutory Data Protection Officer. Data protection questions
          go straight to the people who build the product:{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} style={LINK}>{CONTACT_EMAIL}</a>.
        </p>
        <p>
          Gavelling is independent and is <strong>not affiliated with or endorsed by the United
          Nations</strong>.
        </p>
      </LegalSection>

      {/* ─────────────────────────────────────────────────────────── 02 */}
      <LegalSection n={2} title="Who controls your data — us, or the conference organiser">
        <p>This split matters, because it changes who you ask when you want something done.</p>
        <ul className="list-disc ps-5 mt-2 space-y-1">
          <li>
            <strong>Your account is ours.</strong> Your login, profile, MUN CV, saved preferences
            and any payments you make to us — {COMPANY.name} is the controller. Ask us.
          </li>
          <li>
            <strong>A conference&apos;s applicant data is theirs.</strong> When you apply to a
            conference listed on Gavelling, the <strong>organiser is the controller</strong> of
            your application: the answers to their custom questions, your committee and country
            preferences, your position papers, your allocation, and their notes on you. We act as
            their <strong>processor</strong> — we store and move that data on their documented
            instructions and do not use it for our own purposes.
          </li>
        </ul>
        <p className="mt-3">
          So if you want an application deleted, corrected, or explained, contact the organising
          team of that conference first — they are the ones who decide. <strong>Email us anyway
          if you get stuck.</strong> We will help you find the right contact, and we will act on a
          valid instruction from the organiser without dragging it out. This mirrors section 7 of
          our <Link href="/terms" style={LINK}>Terms of Service</Link>.
        </p>
      </LegalSection>

      {/* ─────────────────────────────────────────────────────────── 03 */}
      <LegalSection n={3} title="What we collect">
        <p>
          Gavelling has two products, and they collect very different amounts of data. Open
          whichever applies to you.
        </p>

        <div className="space-y-3 mt-4">
          <Disclosure
            eyebrow="Product one"
            title="Sessions — running a live committee"
          >
            <p>
              A chair creates a session and gets a 6-character code; delegates join with it. There
              is no account needed to join a session. What gets stored while it runs:
            </p>
            <ul className="list-disc ps-5 mt-2 space-y-1">
              <li><strong>Committee details</strong> — name, topic, settings, and the session code.</li>
              <li><strong>Names</strong> — the delegate names and country assignments entered by the chair, and the name each chair or faculty advisor types when joining. These are often a country or a placeholder rather than a real name.</li>
              <li><strong>Chat messages</strong> — between chairs, delegates and advisors in that session.</li>
              <li><strong>Documents</strong> — working papers and draft resolutions submitted to the committee.</li>
              <li><strong>Motions and votes</strong> — what was raised, and how the committee voted.</li>
              <li><strong>Speaking history</strong> — who spoke, in what order, and for how long.</li>
              <li><strong>Feedback nudges</strong> — the optional emoji feedback advisors send delegates.</li>
            </ul>
            <p className="mt-3">
              <strong>All of it is deleted 72 hours after the session ends.</strong> Some state
              also sits in your browser (see section 11) until you clear it.
            </p>
          </Disclosure>

          <Disclosure
            eyebrow="Product two"
            title="Conferences — accounts, applications and payments"
          >
            <p>This is the part with real accounts, so there is more of it.</p>
            <ul className="list-disc ps-5 mt-2 space-y-1">
              <li><strong>Account</strong> — your name, email address and password. Passwords are handled by Supabase Auth and stored hashed; we never see your password.</li>
              <li><strong>Profile</strong> — date of birth, nationality, education level, MUN experience level, profile photo, and a short bio. You choose how much of this to fill in.</li>
              <li><strong>Applications</strong> — committee and country preferences, position papers, and your answers to whatever custom questions the organiser wrote. The organiser controls these (section 02).</li>
              <li><strong>Delegations and societies</strong> — which delegation or MUN society you belong to, and your role in it.</li>
              <li><strong>Awards and MUN CV</strong> — the conferences, committees, allocations and awards on your record. See section 16, because a CV can be shared publicly.</li>
              <li><strong>Payments</strong> — what you bought, when, how much, and whether it succeeded. <strong>We do not store your full card details</strong> — Stripe handles the card and we keep only the record.</li>
              <li><strong>Email preferences</strong> — which kinds of email you have opted into or out of.</li>
            </ul>
          </Disclosure>

          <Disclosure
            eyebrow="Both products"
            title="Technical data we collect automatically"
          >
            <ul className="list-disc ps-5 mt-2 space-y-1">
              <li><strong>Server logs</strong> — our hosting and database providers record standard things like IP address, browser type and timestamps. We do not use these to build profiles or to advertise to you.</li>
              <li><strong>Crash reports</strong> — when a page breaks in your browser we send ourselves the error message, the technical stack trace, and the address of the page you were on, so we can fix it fast. We do not attach your name to it, but a page address can include a session code.</li>
            </ul>
            <p className="mt-3">
              We do not run Google Analytics, advertising pixels, or any third-party tracking on
              Gavelling.
            </p>
          </Disclosure>
        </div>
      </LegalSection>

      {/* ─────────────────────────────────────────────────────────── 04 */}
      <LegalSection n={4} title="Why we use it, and our lawful basis">
        <p>
          UK GDPR says we need a legal reason — a &quot;lawful basis&quot; — for every purpose. Here is
          ours, purpose by purpose.
        </p>

        <div className="mt-4">
          <SpecRow
            label="Running committee sessions"
            tag="Contract — Art 6(1)(b)"
            note="Showing the speakers list, timers, motions, documents and chat to everyone in the room is the service you asked for."
          />
          <SpecRow
            label="Creating and running your account"
            tag="Contract — Art 6(1)(b)"
            note="Signing you in, showing your profile, your conferences and your CV."
          />
          <SpecRow
            label="Handling conference applications and allocations"
            tag="Processor — on the organiser's instructions"
            note="The organiser is the controller here and sets their own lawful basis; we process on their behalf. See section 02."
          />
          <SpecRow
            label="Taking payments, credits and subscriptions"
            tag="Contract — Art 6(1)(b)"
            note="Processing what you buy and giving you access to it."
          />
          <SpecRow
            label="Service emails you cannot turn off"
            tag="Contract — Art 6(1)(b)"
            note="Password resets, payment receipts, application status. These are part of the service, not marketing."
          />
          <SpecRow
            label="Keeping financial and accounting records"
            tag="Legal obligation — Art 6(1)(c)"
            note="UK tax and company law requires us to keep records of what we were paid."
          />
          <SpecRow
            label="Responding to legal requests and court orders"
            tag="Legal obligation — Art 6(1)(c)"
          />
          <SpecRow
            label="Security, abuse and fraud prevention"
            tag="Legitimate interests — Art 6(1)(f)"
            note="Our interest: keeping the platform, and the many under-18s on it, safe from abuse, impersonation, spam and fraudulent payments. We think you would expect us to do this."
          />
          <SpecRow
            label="Crash diagnostics and bug fixing"
            tag="Legitimate interests — Art 6(1)(f)"
            note="Our interest: a live committee session cannot wait for a fix, so we want to know the moment something breaks."
          />
          <SpecRow
            label="Improving the product"
            tag="Legitimate interests — Art 6(1)(f)"
            note="Our interest: understanding which features are actually used, so we build the right things. We use aggregate patterns, not individual profiling."
          />
          <SpecRow
            label="Answering your support messages"
            tag="Legitimate interests — Art 6(1)(f)"
            note="Our interest: replying to a person who has contacted us for help."
          />
          <SpecRow
            label="Marketing and announcement emails"
            tag="Consent — Art 6(1)(a)"
            note="Opt in, and opt out whenever you like. See section 12."
          />
          <SpecRow
            label="Publishing your MUN CV at a public link"
            tag="Consent — Art 6(1)(a)"
            note="Nothing is public unless you choose to share the link. See section 16."
          />
          <SpecRow
            label="Optional (non-essential) cookies and storage"
            tag="Consent — Art 6(1)(a) and PECR"
            note="Essential storage that makes the app work does not need consent; anything beyond it does."
          />
        </div>

        <p className="mt-4">
          Where we rely on <strong>legitimate interests</strong>, we have weighed our interest
          against your rights and freedoms. You can object to any of it — see section 07 — and we
          will stop unless we have compelling grounds not to.
        </p>
      </LegalSection>

      {/* ─────────────────────────────────────────────────────────── 05 */}
      <LegalSection n={5} title="Special category data">
        <p>
          &quot;Special category&quot; data is the extra-sensitive kind under Article 9 — health,
          race or ethnic origin, religious or philosophical beliefs, political opinions, trade
          union membership, sex life or sexual orientation, genetic and biometric data.
        </p>
        <p>
          <strong>We do not ask for any of it, and we do not intentionally collect it.</strong>{' '}
          Nothing on Gavelling requires you to disclose it. Nationality, and the country you are
          assigned to represent in committee, are roles and identifiers rather than Article 9 data.
        </p>
        <p>
          The one risk is free text. Bios, position papers, application answers, chat messages and
          CV descriptions are boxes you can type anything into. <strong>Please do not put health
          details, religious or political beliefs, or anything similarly sensitive into them</strong>{' '}
          — not about yourself, and definitely not about anyone else. If you do, we will hold it
          simply because you typed it, and we would rather you did not.
        </p>
        <p>
          Debating a political topic in committee is not the same thing as disclosing your own
          political beliefs, and we do not treat committee positions as a record of what you
          personally think.
        </p>
      </LegalSection>

      {/* ─────────────────────────────────────────────────────────── 06 */}
      <LegalSection n={6} title="Young people">
        <p>
          Model UN is run in schools, so we know a large share of the people reading this are
          under 18. We have tried to design for that rather than pretend otherwise.
        </p>
        <ul className="list-disc ps-5 mt-2 space-y-1">
          <li><strong>You must be 13 or older</strong> to create a Gavelling account.</li>
          <li>If you are under 18, use Gavelling with the knowledge and permission of a parent, guardian, teacher or faculty advisor.</li>
          <li>Joining a session as a delegate does not require an account or an email address, so a school can run a committee without any pupil handing over personal details.</li>
          <li>Where a school or conference enters a young person&apos;s details for them, that organiser is responsible for having the right permission to do so.</li>
        </ul>
        <p className="mt-3">
          We take the ICO&apos;s <strong>Age Appropriate Design Code</strong> seriously: we collect
          the minimum we need, we do not profile children, we do not use nudge techniques to push
          anyone into sharing more, nothing is made public by default, and session data deletes
          itself on a short clock.
        </p>
        <p>
          <strong>If you are a parent, guardian or teacher</strong> and you want a young person&apos;s
          data removed, email{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} style={LINK}>{CONTACT_EMAIL}</a>. You do not need to
          quote legislation at us or explain yourself at length — tell us the account email or the
          session code and we will sort it out. If the data sits with a conference organiser we
          will tell you who they are and help you reach them.
        </p>
        <p>
          If you are under 13 and have made an account anyway, that is alright — just email us, or
          ask an adult to, and we will delete it. Nobody is in trouble.
        </p>
      </LegalSection>

      {/* ────────────────────────────────────────── 07 · ANCHOR TARGET */}
      {/* /privacy#your-rights is deep-linked from FooterLegal and /terms — the
          id below must not be renamed or removed. */}
      <LegalSection n={7} title="Your rights" id="your-rights">
        <p>
          These are yours under the UK GDPR. They are free to use, and asking us to use one will
          never count against you.
        </p>

        <div className="mt-3">
          <RightRow
            name="Access"
            what="Get a copy of the personal data we hold about you, and an explanation of what we do with it."
            how={<>Email us. Much of it is already visible in <Link href="/account/profile" style={LINK}>your account</Link>.</>}
          />
          <RightRow
            name="Rectification"
            what="Have anything inaccurate corrected, or anything incomplete filled in."
            how={<>Edit it yourself in <Link href="/account/profile" style={LINK}>Account → Profile</Link>, or email us for anything you cannot reach.</>}
          />
          <RightRow
            name="Erasure"
            what="Have your data deleted — the 'right to be forgotten'."
            how={<>Delete your account in <Link href="/account/profile" style={LINK}>Account → Profile</Link>, which removes your profile, CV and preferences. Or email us. We may keep the minimum required for tax and accounting records (section 10).</>}
          />
          <RightRow
            name="Restriction"
            what="Tell us to keep your data but stop using it, for example while you dispute whether it is accurate."
            how="Email us and say what you want paused."
          />
          <RightRow
            name="Portability"
            what="Receive the data you gave us in a common, machine-readable format, or have us send it to another service where technically possible."
            how="Email us and we will export it."
          />
          <RightRow
            name="Objection"
            what="Object to processing we base on legitimate interests, and object to direct marketing at any time — marketing objections are absolute, we must stop."
            how={<>Email us, or switch the relevant emails off in <Link href="/account/profile" style={LINK}>Account → Profile</Link>.</>}
          />
          <RightRow
            name="Withdrawing consent"
            what="Where we rely on your consent, you can take it back at any time. That does not make what we did beforehand unlawful."
            how={<>Turn off email preferences in <Link href="/account/profile" style={LINK}>Account → Profile</Link>, unpublish your CV (section 16), or email us.</>}
          />
          <RightRow
            name="Not being subject to solely automated decisions"
            what="You have the right not to be subject to a decision based only on automated processing that has a legal or similarly significant effect on you."
            how="We do not make decisions that way — see section 15 — but you can always ask a human to look again."
          />
        </div>

        <p className="mt-4">
          <strong>How to use any of them:</strong> email{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} style={LINK}>{CONTACT_EMAIL}</a> from the address on
          your account if you can, or tell us enough to find you (for session data, the session
          code). <strong>We will respond within one month.</strong> If a request is genuinely
          complex we may extend that by up to two further months, and we will tell you why within
          the first month. We may need to check who you are before handing over personal data.
        </p>
        <p>
          For anything a conference organiser controls — your application, allocation or their
          notes — the organiser has to make the decision. Contact them first, and copy us in if you
          would like us to chase it.
        </p>
      </LegalSection>

      {/* ─────────────────────────────────────────────────────────── 08 */}
      <LegalSection n={8} title="Who else handles your data">
        <p>
          <strong>We do not sell, rent or trade personal data.</strong> We use a small set of
          service providers who process it on our instructions:
        </p>
        <ul className="list-disc ps-5 mt-2 space-y-1">
          <li><strong>Supabase</strong> — database, authentication, file storage and server-side functions. Most of what Gavelling stores lives here.</li>
          <li><strong>Vercel</strong> — hosting and content delivery for the website itself.</li>
          <li><strong>Stripe</strong> — payment processing. Card details go to Stripe, not to us.</li>
          <li><strong>Resend</strong> — sending transactional and announcement emails.</li>
        </ul>
        <p className="mt-3">
          Each of them is bound by a contract that limits them to processing data for us. Beyond
          that, data goes to a conference organiser only when you apply to their conference, and to
          the other people in your committee only where the session is designed to show it (your
          name in the speakers list, a paper you submitted, a message you sent).
        </p>
        <p>
          We may also disclose data where the law requires it, or where it is necessary to protect
          the rights and safety of our users — particularly the young people using the platform.
        </p>
      </LegalSection>

      {/* ─────────────────────────────────────────────────────────── 09 */}
      <LegalSection n={9} title="Sending data outside the UK">
        <p>
          Our infrastructure providers — <strong>Supabase</strong>, <strong>Vercel</strong> and{' '}
          <strong>Stripe</strong> — are US-based, and our database is hosted in a US region. That
          makes these <strong>restricted transfers</strong> under UK data protection law, so they
          need a safeguard.
        </p>
        <p>
          For each provider we rely on <em>one of</em> the following mechanisms:
        </p>
        <ul className="list-disc ps-5 mt-2 space-y-1">
          <li>the <strong>UK Extension to the EU–US Data Privacy Framework</strong>, where that provider is certified under it; or</li>
          <li>the ICO&apos;s <strong>International Data Transfer Agreement (IDTA)</strong>, or the <strong>UK Addendum to the EU Standard Contractual Clauses</strong>, together with a transfer risk assessment.</li>
        </ul>
        <p className="mt-3">
          We are deliberately not claiming here that a particular provider holds a particular
          certification, because certifications change and we will not assert one we have not
          re-checked. If you want to know exactly which mechanism applies to which provider today,
          email <a href={`mailto:${CONTACT_EMAIL}`} style={LINK}>{CONTACT_EMAIL}</a> and we will
          tell you what is in place at that moment.
        </p>
      </LegalSection>

      {/* ─────────────────────────────────────────────────────────── 10 */}
      <LegalSection n={10} title="How long we keep things">
        <div className="mt-2">
          <SpecRow
            label="Live session data"
            tag="72 hours after the session ends"
            note="Speakers lists, chat, documents, motions, votes and speaking history are deleted automatically once a session is ended."
          />
          <SpecRow
            label="Sessions that were never formally ended"
            tag="Purged periodically"
            note="Abandoned sessions are cleaned up on a rolling basis."
          />
          <SpecRow
            label="Account and profile"
            tag="Until you delete your account"
            note="Delete the account and the profile, CV and preferences go with it."
          />
          <SpecRow
            label="Conference applications and allocations"
            tag="As long as the organiser needs them"
            note="The organiser decides, because they are the controller. Ask them, and we will act on their instruction."
          />
          <SpecRow
            label="Payment and financial records"
            tag="About 6 years"
            note="UK tax and company law requires us to keep accounting records for six years after the end of the relevant accounting period."
          />
          <SpecRow
            label="Crash reports and error logs"
            tag="Only while we need them"
            note="Kept long enough to diagnose and fix the bug, then cleared."
          />
          <SpecRow
            label="Data in your browser"
            tag="Until you clear it"
            note="Local storage stays on your device until you clear your browser storage or sign out."
          />
        </div>
        <p className="mt-4">
          After deletion, copies can survive briefly in routine encrypted backups before those
          backups roll over. We do not restore deleted data from a backup to bring it back.
        </p>
      </LegalSection>

      {/* ─────────────────────────────────────────────────────────── 11 */}
      <LegalSection n={11} title="Cookies and local storage">
        <p>
          Gavelling leans on your browser&apos;s <code>localStorage</code> more than on cookies.
          Either way, here is the honest split.
        </p>
        <p className="mt-2"><strong>Essential — the app does not work without these:</strong></p>
        <ul className="list-disc ps-5 mt-2 space-y-1">
          <li><strong>Authentication tokens</strong> stored by Supabase Auth, so you stay signed in between page loads.</li>
          <li><strong>Session and committee state</strong> — the code you last joined, your committee settings, chat read counts, and the local copy of the committee the app renders from.</li>
          <li><strong>Preferences</strong> such as your language choice.</li>
          <li>Strictly necessary cookies our hosting provider sets for infrastructure and security.</li>
        </ul>
        <p className="mt-3"><strong>Optional:</strong></p>
        <p>
          We do not currently run advertising cookies, third-party analytics or tracking pixels. If
          that ever changes we will ask for your consent first, and you will be able to say no and
          keep using Gavelling.
        </p>
        <p>
          You can clear local storage and cookies from your browser settings at any time. Doing so
          signs you out and forgets your local preferences; it does not delete anything held on our
          servers.
        </p>
      </LegalSection>

      {/* ─────────────────────────────────────────────────────────── 12 */}
      <LegalSection n={12} title="Emails you get from us">
        <ul className="list-disc ps-5 mt-2 space-y-1">
          <li><strong>Service emails</strong> — password resets, payment receipts, application updates, and messages from a conference you applied to about that conference. These are part of the service, so you cannot switch them off while you have an account.</li>
          <li><strong>Announcements and marketing</strong> — these go only to people who have opted in, and every one of them can be turned off in <Link href="/account/profile" style={LINK}>Account → Profile</Link>. Organisers sending a broadcast through Gavelling cannot reach anyone who has opted out; we exclude them automatically.</li>
        </ul>
        <p className="mt-3">
          Emails are delivered by Resend on our behalf. We never sell your email address or pass it
          to anyone for their own marketing.
        </p>
      </LegalSection>

      {/* ─────────────────────────────────────────────────────────── 13 */}
      <LegalSection n={13} title="Security">
        <p>Concretely, and without overselling it:</p>
        <ul className="list-disc ps-5 mt-2 space-y-1">
          <li>Everything travels over <strong>encrypted connections (HTTPS/TLS)</strong>.</li>
          <li>Data is protected at the database layer by <strong>row-level security policies</strong>, so a request can only reach the rows it is entitled to — not just the screens the app chooses to show.</li>
          <li><strong>Passwords are hashed</strong> by Supabase Auth. We cannot see them, and neither can anyone who reads our database.</li>
          <li><strong>Card details never reach us.</strong> Stripe takes them directly.</li>
          <li>Access to production data is limited to the people who need it to run the service.</li>
          <li>Session codes act as access keys — share a code only with the people who should be in that committee.</li>
        </ul>
        <p className="mt-3">
          We are a small team and we hold no security certifications. No service on the internet can
          promise perfect security, and we are not going to pretend otherwise. What we can promise
          is that we take it seriously and that we will tell you the truth if something goes wrong.
        </p>
      </LegalSection>

      {/* ─────────────────────────────────────────────────────────── 14 */}
      <LegalSection n={14} title="If there is a data breach">
        <p>
          If personal data we hold is lost, exposed or accessed without permission, and there is a
          risk to people&apos;s rights and freedoms, we will report it to the{' '}
          <strong>Information Commissioner&apos;s Office within 72 hours</strong> of becoming aware
          of it, as the law requires.
        </p>
        <p>
          Where a breach is likely to result in a <strong>high risk</strong> to you, we will tell
          you directly and without undue delay — what happened, what data was involved, what we are
          doing about it, and what you should do. Where a conference organiser is the controller, we
          will notify them so they can meet their own obligations.
        </p>
      </LegalSection>

      {/* ─────────────────────────────────────────────────────────── 15 */}
      <LegalSection n={15} title="Automated decision-making">
        <p>
          Gavelling can <strong>suggest</strong> committee and country allocations to an organiser
          based on the preferences and information applicants have submitted. That is a suggestion
          on a screen, and nothing more.
        </p>
        <p>
          <strong>A human organiser always makes the final decision</strong>, and can override any
          suggestion. So there is no decision on Gavelling based solely on automated processing that
          produces legal effects for you or similarly significantly affects you, and we do no
          profiling for advertising or any other purpose.
        </p>
        <p>
          If you think an allocation decision was made unfairly, raise it with the conference
          organiser — it was their call, not an algorithm&apos;s.
        </p>
      </LegalSection>

      {/* ─────────────────────────────────────────────────────────── 16 */}
      <LegalSection n={16} title="Public MUN CVs">
        <p>
          Your MUN CV — the conferences, committees, allocations and awards on your record — is{' '}
          <strong>private by default</strong>. You can also share it at a public link that looks
          like <code>gavelling.com/cv/your-name-1a2b3c4d</code>.
        </p>
        <p>
          <strong>Anyone with that link can open it without signing in.</strong> Once a link is out
          in the world you cannot control who passes it on, and a search engine could index it if
          someone posts it somewhere public. What a visitor sees is your display name, profile
          photo, nationality, education level, experience level, bio, and the CV entries on your
          record — conference names, committees, allocations, awards, dates, and any photos or
          descriptions you added to an entry.
        </p>
        <p>
          <strong>To take something down:</strong> delete the individual entry in{' '}
          <Link href="/account/cv" style={LINK}>Account → MUN CV</Link> and it disappears from the
          public page immediately. Deleting your account removes the public page entirely. Stop
          sharing the link, too — a page someone already saved a copy of is out of our hands.
        </p>
        <p>
          If you are under 18, think about this one before you post the link anywhere public. There
          is no obligation to share a CV at all, and nothing on Gavelling works less well if you
          keep it private.
        </p>
      </LegalSection>

      {/* ─────────────────────────────────────────────────────────── 17 */}
      <LegalSection n={17} title="Changes to this policy">
        <p>
          Gavelling is still growing, so this policy will change. When it does we will update the
          effective date at the top of the page.
        </p>
        <p>
          For anything <strong>significant</strong> — a new purpose, a new category of data, a new
          provider handling your data — we will tell you properly in the app or by email before it
          takes effect, rather than quietly editing this page. If a change relies on your consent,
          we will ask you for it.
        </p>
      </LegalSection>

      {/* ─────────────────────────────────────────────────────────── 18 */}
      <LegalSection n={18} title="Complaints and contact">
        <p>
          If you are unhappy with how we have handled your data, tell us first — we would like the
          chance to put it right, and it is usually the fastest route.
        </p>
        <p className="mt-2">
          <strong>{COMPANY.name}</strong><br />
          {COMPANY.address}<br />
          {PLACE_OF_REGISTRATION} no. {COMPANY.number}<br />
          <a href={`mailto:${CONTACT_EMAIL}`} style={LINK}>{CONTACT_EMAIL}</a>
        </p>
        <p className="mt-3">
          You also have the right to complain to the UK&apos;s data protection regulator, the{' '}
          <strong>Information Commissioner&apos;s Office (ICO)</strong>. You can do that{' '}
          <strong>whether or not you come to us first</strong> — you do not need our permission and
          you do not have to wait for our reply.
        </p>
        <ul className="list-disc ps-5 mt-2 space-y-1">
          <li>
            Online:{' '}
            <a href="https://ico.org.uk" target="_blank" rel="noopener noreferrer" style={LINK}>
              ico.org.uk
            </a>
          </li>
          <li>Helpline: <strong>0303 123 1113</strong></li>
          <li>By post: Information Commissioner&apos;s Office, Wycliffe House, Water Lane, Wilmslow, Cheshire, SK9 5AF</li>
        </ul>
        <p className="mt-3">
          For questions about the rules of using Gavelling rather than your data, see our{' '}
          <Link href="/terms" style={LINK}>Terms of Service</Link>.
        </p>
      </LegalSection>
    </LegalShell>
  );
}
