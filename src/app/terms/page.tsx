import Link from 'next/link';
import type { Metadata } from 'next';
import FooterLegal from '@/components/FooterLegal';
import { COMPANY, PLACE_OF_REGISTRATION } from '@/lib/companyDetails';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'The terms governing your use of Gavelling — the Model UN conference and committee management platform operated by GAVELLING LTD.',
  alternates: { canonical: 'https://gavelling.com/terms' },
};

const EFFECTIVE_DATE = 'August 2, 2026';
const CONTACT_EMAIL = 'wearegavelling@gmail.com';

const H2 = "text-lg font-black mb-3";
const H2_STYLE = { color: '#1B3828', fontFamily: "'Outfit', sans-serif" } as const;

export default function TermsPage() {
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#EDE7D8' }}>
      {/* Grain */}
      <div className="pointer-events-none fixed inset-0 z-0" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='1'/%3E%3C/svg%3E")`, backgroundRepeat: 'repeat', backgroundSize: '300px 300px', mixBlendMode: 'multiply', opacity: 0.18 }} />

      {/* Nav */}
      <nav className="relative z-10 border-b border-[#DDD4C0]/60 px-6 h-16 flex items-center justify-between" style={{ backgroundColor: '#EDE7D8' }}>
        <Link href="/" className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/GavellingLogo.png" alt="Gavelling" className="w-[16vw] h-auto max-h-9 object-contain" style={{ color: 'transparent' }} />
        </Link>
        <Link href="/" className="text-sm font-semibold transition-colors" style={{ color: '#1B3828' }}>
          ← Back to Home
        </Link>
      </nav>

      {/* Content */}
      <main className="relative z-10 flex-1 px-6 py-16 max-w-3xl mx-auto w-full">
        <h1 className="text-4xl font-black mb-2 tracking-tight" style={{ color: '#1B3828', fontFamily: "'Outfit', sans-serif" }}>
          Terms of Service
        </h1>
        <p className="text-sm mb-10" style={{ color: '#9A8A78' }}>Effective date: {EFFECTIVE_DATE}</p>

        <div className="space-y-10 text-sm leading-relaxed" style={{ color: '#3A2E26' }}>

          <section>
            <h2 className={H2} style={H2_STYLE}>1. Who We Are</h2>
            <p>
              Gavelling is a Model United Nations conference and committee management platform available at <strong>gavelling.com</strong>. The platform is operated by <strong>{COMPANY.name}</strong>, a private limited company {PLACE_OF_REGISTRATION.replace('Registered in', 'registered in')} under company number <strong>{COMPANY.number}</strong>, whose registered office is {COMPANY.address}.
            </p>
            <p className="mt-3">
              In these Terms, &quot;Gavelling&quot;, &quot;we&quot;, &quot;us&quot; and &quot;our&quot; mean {COMPANY.name}. &quot;You&quot; means the person using the platform.
            </p>
            <p className="mt-3">
              Gavelling is an independent product. It is <strong>not affiliated with, endorsed by, or connected to the United Nations</strong> or any governmental body, and simulations run on it are educational exercises only.
            </p>
          </section>

          <section>
            <h2 className={H2} style={H2_STYLE}>2. Agreeing to These Terms</h2>
            <p>
              By creating an account, joining a session, applying to a conference, or otherwise using Gavelling, you agree to these Terms and to our{' '}
              <Link href="/privacy" style={{ color: '#1B3828', fontWeight: 700 }}>Privacy Policy</Link>. If you do not agree, please do not use the platform.
            </p>
            <p className="mt-3">
              If you are using Gavelling on behalf of a school, university, society or conference, you confirm you are authorised to accept these Terms on that organisation&apos;s behalf.
            </p>
          </section>

          <section id="eligibility" className="scroll-mt-24">
            <h2 className={H2} style={H2_STYLE}>3. Eligibility and Young People</h2>
            <p>
              Model UN is widely run in schools, so Gavelling is used by people under 18. You may use Gavelling if you are <strong>13 or older</strong>. If you are under 18, you may only use Gavelling with the knowledge and permission of a parent, guardian, teacher or faculty advisor.
            </p>
            <p className="mt-3">
              If you are under 13, you may not create an account. Where a conference or school enters a young person&apos;s details on their behalf, the organiser is responsible for having the appropriate permission to do so.
            </p>
            <p className="mt-3">
              If you believe a child has provided us with personal data without appropriate permission, contact{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: '#1B3828', fontWeight: 700 }}>{CONTACT_EMAIL}</a> and we will delete it.
            </p>
          </section>

          <section>
            <h2 className={H2} style={H2_STYLE}>4. Your Account</h2>
            <ul className="list-disc ps-5 mt-2 space-y-1">
              <li>Give accurate information when you register, and keep it up to date.</li>
              <li>You are responsible for activity that happens under your account, and for keeping your login details secure.</li>
              <li>Do not share your account, and do not use anyone else&apos;s.</li>
              <li>Tell us promptly at <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: '#1B3828', fontWeight: 700 }}>{CONTACT_EMAIL}</a> if you think your account has been accessed without permission.</li>
            </ul>
          </section>

          <section>
            <h2 className={H2} style={H2_STYLE}>5. What Gavelling Provides</h2>
            <p>Gavelling has two main parts:</p>
            <ul className="list-disc ps-5 mt-2 space-y-1">
              <li><strong>Sessions</strong> — live committee tools for chairs and delegates: speakers lists, caucuses, motions, voting, documents and chat.</li>
              <li><strong>Conferences</strong> — tools for organisers to list a conference, take applications, allocate delegates to committees and countries, communicate with participants, and collect fees.</li>
            </ul>
            <p className="mt-3">
              We may add, change or withdraw features. If we make a change that materially reduces a paid feature you are actively relying on, we will give you reasonable notice where we can.
            </p>
          </section>

          <section id="marketplace" className="scroll-mt-24">
            <h2 className={H2} style={H2_STYLE}>6. Conferences Are Run by Their Organisers, Not by Us</h2>
            <p>
              This is important. When you apply to, pay for, or attend a conference listed on Gavelling, <strong>your agreement for that conference is with the organiser, not with us</strong>. We provide the software the organiser uses.
            </p>
            <p className="mt-3">We are not responsible for:</p>
            <ul className="list-disc ps-5 mt-2 space-y-1">
              <li>Whether a conference takes place, is cancelled, postponed or relocated.</li>
              <li>The quality, safety, supervision or conduct of any conference or its staff.</li>
              <li>Admissions decisions, committee or country allocations, awards, or any refund of conference fees.</li>
              <li>Statements an organiser makes on their conference page.</li>
            </ul>
            <p className="mt-3">
              Refund and cancellation requests for a conference must be raised with that conference&apos;s organising team. We can help with technical problems on the platform itself.
            </p>
          </section>

          <section>
            <h2 className={H2} style={H2_STYLE}>7. If You Organise a Conference</h2>
            <p>Organisers get access to other people&apos;s personal data, so additional obligations apply. If you run a conference on Gavelling you agree that:</p>
            <ul className="list-disc ps-5 mt-2 space-y-1">
              <li>You will describe your conference honestly, including dates, location, fees and what a fee covers.</li>
              <li>You are the <strong>data controller</strong> for the applicant and participant data you collect through Gavelling, and we act as a processor for you in respect of that data. You must comply with UK and EU data protection law, including having a lawful basis for the data you collect and honouring participants&apos; rights.</li>
              <li>You will only use participant data for running your conference — never to send unrelated marketing, and never to sell or pass it on.</li>
              <li>You are responsible for safeguarding and any duty of care owed to attendees, especially those under 18, including any required checks, supervision and insurance.</li>
              <li>You are responsible for collecting and remitting any taxes due on fees you charge.</li>
              <li>You will keep your own account access secure and remove team members who no longer need access.</li>
            </ul>
            <p className="mt-3">
              We may suspend or remove a conference listing that appears fraudulent, unsafe, unlawful, or in serious breach of these Terms.
            </p>
          </section>

          <section>
            <h2 className={H2} style={H2_STYLE}>8. Fees, Credits and Subscriptions</h2>
            <ul className="list-disc ps-5 mt-2 space-y-1">
              <li>Some Gavelling features are free; others require credits or a paid subscription. Prices are shown before you buy.</li>
              <li>Payments are processed by <strong>Stripe</strong>. We do not receive or store your full card details.</li>
              <li>Subscriptions renew automatically for the period stated until cancelled. You can cancel at any time, effective at the end of the current billing period.</li>
              <li>Credits are for use on the platform. They have no cash value, are not transferable, and are not exchangeable for money.</li>
              <li>Delegate and participant fees charged by an organiser are the organiser&apos;s, not ours — see section 6.</li>
            </ul>
            <p className="mt-3">
              <strong>Your right to cancel.</strong> If you are a consumer in the UK or EU, you normally have 14 days to cancel a digital purchase. Where you ask to use a paid feature immediately, you may lose that right once we have started providing it. Nothing here affects your statutory rights.
            </p>
            <p className="mt-3">
              If you think you have been charged in error, contact{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: '#1B3828', fontWeight: 700 }}>{CONTACT_EMAIL}</a>.
            </p>
          </section>

          <section>
            <h2 className={H2} style={H2_STYLE}>9. Your Content</h2>
            <p>
              You keep ownership of what you create on Gavelling — position papers, working papers, resolutions, messages, conference descriptions and profile information.
            </p>
            <p className="mt-3">
              You grant us a non-exclusive, worldwide, royalty-free licence to host, store, copy and display that content <strong>solely so we can operate the platform for you</strong> — for example showing your paper to your chair, or your application to the organiser you applied to. This licence ends when you delete the content, except for copies we must briefly retain in backups.
            </p>
            <p className="mt-3">
              You confirm you have the right to share what you upload, and that it does not infringe anyone else&apos;s rights.
            </p>
          </section>

          <section>
            <h2 className={H2} style={H2_STYLE}>10. Acceptable Use</h2>
            <p>Do not use Gavelling to:</p>
            <ul className="list-disc ps-5 mt-2 space-y-1">
              <li>Harass, bully, threaten, defame or discriminate against anyone. Vigorous debate in committee is expected; abuse of real people is not.</li>
              <li>Upload unlawful, hateful, sexual or violent material, or anything harmful to minors.</li>
              <li>Impersonate another person, conference or institution.</li>
              <li>Break into, disrupt, overload, scrape or reverse engineer the platform, or bypass access controls, credit limits or paywalls.</li>
              <li>Upload malware, or use the platform to send spam.</li>
              <li>Collect other users&apos; personal data for any purpose other than running your own conference.</li>
            </ul>
            <p className="mt-3">
              We may remove content and suspend or close accounts that breach this section. Where the law requires it, we may report serious matters to the authorities.
            </p>
          </section>

          <section>
            <h2 className={H2} style={H2_STYLE}>11. Our Intellectual Property</h2>
            <p>
              The Gavelling platform — its software, design, branding and content we create — belongs to {COMPANY.name} and its licensors. These Terms give you permission to use the service; they do not transfer ownership of anything to you. Do not copy our branding or present the platform as your own product.
            </p>
          </section>

          <section>
            <h2 className={H2} style={H2_STYLE}>12. Third-Party Services</h2>
            <p>
              Gavelling relies on third parties to work, including <strong>Supabase</strong> (database and authentication), <strong>Vercel</strong> (hosting), <strong>Stripe</strong> (payments) and <strong>Resend</strong> (email). Their handling of data is described in our{' '}
              <Link href="/privacy" style={{ color: '#1B3828', fontWeight: 700 }}>Privacy Policy</Link>. Conference pages may link to external sites, which we do not control or endorse.
            </p>
          </section>

          <section>
            <h2 className={H2} style={H2_STYLE}>13. Availability</h2>
            <p>
              We work hard to keep Gavelling running, particularly during live committee sessions, but we cannot promise the service will be uninterrupted or error-free. Access may be affected by maintenance, updates, or failures at our infrastructure providers. The service is provided &quot;as is&quot; to the extent the law allows.
            </p>
            <p className="mt-3">
              Keep your own copies of anything important. Session data is deleted on the schedule described in our Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className={H2} style={H2_STYLE}>14. Our Liability</h2>
            <p>
              Nothing in these Terms limits our liability for death or personal injury caused by our negligence, for fraud, or for anything else that cannot lawfully be excluded — including your statutory rights as a consumer.
            </p>
            <p className="mt-3">Subject to that, we are not liable for:</p>
            <ul className="list-disc ps-5 mt-2 space-y-1">
              <li>Loss of profits, business, goodwill or anticipated savings.</li>
              <li>Loss or corruption of data, beyond restoring from our routine backups.</li>
              <li>Anything a conference organiser, chair or other user does or fails to do.</li>
              <li>Losses that were not reasonably foreseeable when you started using the service.</li>
            </ul>
            <p className="mt-3">
              Where we are liable, our total liability to you in any 12-month period is limited to the greater of the amount you paid us in that period, or £100.
            </p>
          </section>

          <section>
            <h2 className={H2} style={H2_STYLE}>15. Suspension and Ending Your Account</h2>
            <p>
              You can stop using Gavelling and delete your account at any time from your account settings. We may suspend or end your access if you seriously or repeatedly breach these Terms, or if we must do so by law.
            </p>
            <p className="mt-3">
              If we close your account without good reason, we will refund any unused paid period. Sections that by their nature should survive — including sections 9, 11, 14 and 18 — continue to apply afterwards.
            </p>
          </section>

          <section>
            <h2 className={H2} style={H2_STYLE}>16. Changes to These Terms</h2>
            <p>
              We may update these Terms as the platform develops. We will change the effective date at the top, and for significant changes we will give notice in the app or by email. Continuing to use Gavelling after a change means you accept the updated Terms.
            </p>
          </section>

          <section>
            <h2 className={H2} style={H2_STYLE}>17. Complaints</h2>
            <p>
              If something has gone wrong, email{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: '#1B3828', fontWeight: 700 }}>{CONTACT_EMAIL}</a> and we will try to resolve it. For anything about your personal data, see{' '}
              <Link href="/privacy#your-rights" style={{ color: '#1B3828', fontWeight: 700 }}>Your Rights</Link> — you also have the right to complain to the UK Information Commissioner&apos;s Office (ICO) at ico.org.uk.
            </p>
          </section>

          <section id="governing-law" className="scroll-mt-24">
            <h2 className={H2} style={H2_STYLE}>18. Governing Law</h2>
            <p>
              These Terms are governed by the laws of <strong>England and Wales</strong>, and disputes will be handled by the courts of England and Wales. If you are a consumer living elsewhere in the UK or in the EU, you keep the protection of the mandatory laws of the country you live in, and may bring proceedings there.
            </p>
          </section>

          <section>
            <h2 className={H2} style={H2_STYLE}>19. Contact</h2>
            <p>
              {COMPANY.name}<br />
              {COMPANY.address}<br />
              {PLACE_OF_REGISTRATION} no. {COMPANY.number}<br />
              <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: '#1B3828', fontWeight: 700 }}>{CONTACT_EMAIL}</a>
            </p>
          </section>

        </div>
      </main>

      <footer className="relative z-10 border-t border-[#DDD4C0]/60 px-6 py-8" style={{ backgroundColor: '#EDE7D8' }}>
        <div className="max-w-3xl mx-auto">
          <p className="text-xs text-center" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
            © {new Date().getFullYear()} Gavelling. Built for the MUN community.
          </p>
          <FooterLegal />
        </div>
      </footer>
    </div>
  );
}
