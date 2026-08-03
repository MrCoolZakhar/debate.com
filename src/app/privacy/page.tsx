import Link from 'next/link';
import type { Metadata } from 'next';
import FooterLegal from '@/components/FooterLegal';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Learn how Gavelling collects, uses, and protects the information entered during your Model UN sessions.',
  alternates: { canonical: 'https://gavelling.com/privacy' },
};

const EFFECTIVE_DATE = 'June 2, 2026';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#EDE7D8' }}>
      {/* Grain */}
      <div className="pointer-events-none fixed inset-0 z-0" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='1'/%3E%3C/svg%3E")`, backgroundRepeat: 'repeat', backgroundSize: '300px 300px', mixBlendMode: 'multiply', opacity: 0.18 }} />

      {/* Nav */}
      <nav className="relative z-10 border-b border-[#DDD4C0]/60 px-6 h-16 flex items-center justify-between" style={{ backgroundColor: '#EDE7D8' }}>
        <Link href="/" className="flex items-center gap-3">
          <img src="/GavellingLogo.png" alt="Gavelling" className="w-[16vw] h-auto max-h-9 object-contain" />
        </Link>
        <Link href="/" className="text-sm font-semibold transition-colors" style={{ color: '#1B3828' }}>
          ← Back to Home
        </Link>
      </nav>

      {/* Content */}
      <main className="relative z-10 flex-1 px-6 py-16 max-w-3xl mx-auto w-full">
        <h1 className="text-4xl font-black mb-2 tracking-tight" style={{ color: '#1B3828', fontFamily: "'Outfit', sans-serif" }}>
          Privacy Policy
        </h1>
        <p className="text-sm mb-10" style={{ color: '#9A8A78' }}>Effective date: {EFFECTIVE_DATE}</p>

        <div className="space-y-10 text-sm leading-relaxed" style={{ color: '#3A2E26' }}>

          <section>
            <h2 className="text-lg font-black mb-3" style={{ color: '#1B3828', fontFamily: "'Outfit', sans-serif" }}>1. Who We Are</h2>
            <p>Gavelling (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) is a Model United Nations committee management platform accessible at <strong>gavelling.com</strong>. Gavelling is operated by its founding team and is not affiliated with the United Nations or any governmental body.</p>
            <p className="mt-3">This Privacy Policy explains what information is collected when you use Gavelling, how we use it, and what choices you have. By using Gavelling you agree to the practices described here.</p>
          </section>

          <section>
            <h2 className="text-lg font-black mb-3" style={{ color: '#1B3828', fontFamily: "'Outfit', sans-serif" }}>2. Information We Collect</h2>

            <h3 className="font-bold mb-2" style={{ color: '#1B3828' }}>2a. Session data you enter</h3>
            <p>Gavelling is a session-based tool. No account or email address is required. The following information is entered voluntarily by users and stored for the duration of a session:</p>
            <ul className="list-disc ps-5 mt-2 space-y-1">
              <li><strong>Committee information</strong>: committee name, topic, and a randomly generated 6-character session code.</li>
              <li><strong>Delegate names / country assignments</strong>: entered by the chair when creating or managing a session.</li>
              <li><strong>Chair names</strong>: entered by each chair when joining a session.</li>
              <li><strong>Chat messages</strong>: messages sent between chairs, delegates, and faculty advisors within a session.</li>
              <li><strong>Documents</strong>: working papers and draft resolutions uploaded or described during a session.</li>
              <li><strong>Motions and votes</strong>: procedural motions raised and vote tallies recorded during the session.</li>
              <li><strong>Speaking history</strong>: which delegates spoke, for how long, and in what order.</li>
              <li><strong>Delegate feedback</strong>: optional emoji-based nudges sent by faculty advisors.</li>
            </ul>

            <h3 className="font-bold mt-5 mb-2" style={{ color: '#1B3828' }}>2b. Information stored locally on your device</h3>
            <p>Gavelling uses your browser&apos;s <code>localStorage</code> to remember certain preferences between visits:</p>
            <ul className="list-disc ps-5 mt-2 space-y-1">
              <li>Session rejoin state (the code and chair name of your most recent active session).</li>
              <li>Committee settings (voting thresholds, motion types, access controls).</li>
              <li>Chat read-counts (to track which messages you have already read).</li>
              <li>Language preference (English or Spanish).</li>
            </ul>
            <p className="mt-2">This data lives only on your device and is never transmitted to our servers.</p>

            <h3 className="font-bold mt-5 mb-2" style={{ color: '#1B3828' }}>2c. Technical data collected automatically</h3>
            <p>Like most web services, our hosting infrastructure and database provider (Supabase) may automatically collect standard server logs, including IP addresses, browser type, and timestamps. We do not control this logging at the infrastructure level, but we do not use it for profiling or advertising purposes.</p>
          </section>

          <section>
            <h2 className="text-lg font-black mb-3" style={{ color: '#1B3828', fontFamily: "'Outfit', sans-serif" }}>3. How We Use Your Information</h2>
            <p>We use session data exclusively to operate the Gavelling platform:</p>
            <ul className="list-disc ps-5 mt-2 space-y-1">
              <li>To display the speakers list, timer, motions, documents, and chat in real time across all connected devices.</li>
              <li>To allow chairs to manage the session and delegates to participate.</li>
              <li>To calculate speaking statistics and session summaries shown within the platform.</li>
              <li>To allow suspended sessions to be resumed and ended sessions to remain viewable for a limited time.</li>
            </ul>
            <p className="mt-3">We do <strong>not</strong> use your session data to send you marketing emails, build advertising profiles, or share information with third parties for commercial purposes.</p>
          </section>

          <section>
            <h2 className="text-lg font-black mb-3" style={{ color: '#1B3828', fontFamily: "'Outfit', sans-serif" }}>4. Data Retention</h2>
            <p>Session data is retained on our servers for a limited period:</p>
            <ul className="list-disc ps-5 mt-2 space-y-1">
              <li><strong>Active sessions</strong>: data is stored for as long as the session is ongoing.</li>
              <li><strong>Ended sessions</strong>: once an &quot;End Debate&quot; motion passes, all session data is scheduled for automatic deletion <strong>72 hours</strong> later.</li>
              <li><strong>Abandoned sessions</strong>: sessions that are never formally ended may be purged periodically at our discretion.</li>
            </ul>
            <p className="mt-3">Data stored in <code>localStorage</code> on your device persists until you clear your browser storage.</p>
          </section>

          <section>
            <h2 className="text-lg font-black mb-3" style={{ color: '#1B3828', fontFamily: "'Outfit', sans-serif" }}>5. Data Sharing and Third Parties</h2>
            <p>We do not sell, rent, or trade your information. We rely on the following third-party service providers to operate the platform:</p>
            <ul className="list-disc ps-5 mt-2 space-y-1">
              <li><strong>Supabase</strong>: our database and real-time infrastructure provider. Session data is stored on Supabase servers. Supabase&apos;s privacy policy is available at <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: '#1B3828' }}>supabase.com/privacy</a>.</li>
              <li><strong>Vercel</strong>: our hosting and deployment provider. Vercel&apos;s privacy policy is available at <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: '#1B3828' }}>vercel.com/legal/privacy-policy</a>.</li>
            </ul>
            <p className="mt-3">We may disclose information if required by law, court order, or to protect the rights and safety of users or the public.</p>
          </section>

          <section>
            <h2 className="text-lg font-black mb-3" style={{ color: '#1B3828', fontFamily: "'Outfit', sans-serif" }}>6. Cookies</h2>
            <p>Gavelling does not use tracking cookies or advertising cookies. We use <code>localStorage</code> (not cookies) for session preferences. Our hosting provider (Vercel) may set strictly necessary cookies for infrastructure purposes. No third-party analytics or advertising cookies are present on our platform.</p>
          </section>

          <section>
            <h2 className="text-lg font-black mb-3" style={{ color: '#1B3828', fontFamily: "'Outfit', sans-serif" }}>7. Children&apos;s Privacy</h2>
            <p>Gavelling is designed for use in educational and competitive Model UN settings, which may include participants under the age of 18. We do not knowingly collect personal information beyond what is entered voluntarily as part of a session (e.g., a delegate&apos;s country assignment or a chair&apos;s name). No real names are required to use the platform. Session data is automatically deleted within 72 hours of a session ending.</p>
            <p className="mt-3">If you believe a child has submitted personal information in a way that raises privacy concerns, please contact us at the address below and we will promptly delete it.</p>
          </section>

          {/* Anchor target for footer "Your Data & GDPR Rights" deep links (/privacy#your-rights) */}
          <section id="your-rights" className="scroll-mt-24">
            <h2 className="text-lg font-black mb-3" style={{ color: '#1B3828', fontFamily: "'Outfit', sans-serif" }}>8. Your Rights and Choices</h2>
            <p>Because Gavelling does not require accounts or email addresses, we cannot identify you across sessions. However, you may:</p>
            <ul className="list-disc ps-5 mt-2 space-y-1">
              <li><strong>Delete session content</strong>: chairs can end a session at any time, which schedules all session data for deletion within 72 hours.</li>
              <li><strong>Clear local data</strong>: you can clear your browser&apos;s <code>localStorage</code> at any time through your browser&apos;s settings to remove all locally stored preferences.</li>
              <li><strong>Request deletion</strong>: if you can identify the session code associated with your data, you may contact us to request early deletion.</li>
            </ul>
            <p className="mt-3">If you are located in the European Economic Area (EEA), United Kingdom, or California, you may have additional rights under GDPR, UK GDPR, or CCPA respectively. Please contact us to exercise these rights.</p>
          </section>

          <section>
            <h2 className="text-lg font-black mb-3" style={{ color: '#1B3828', fontFamily: "'Outfit', sans-serif" }}>9. Data Security</h2>
            <p>We take reasonable technical measures to protect session data, including encrypted connections (HTTPS) and access controls on our database. However, no method of transmission over the internet is 100% secure. Session codes should be shared only with intended participants.</p>
          </section>

          <section>
            <h2 className="text-lg font-black mb-3" style={{ color: '#1B3828', fontFamily: "'Outfit', sans-serif" }}>10. Changes to This Policy</h2>
            <p>We may update this Privacy Policy from time to time. We will update the effective date at the top of this page when changes are made. Continued use of Gavelling after any changes constitutes your acceptance of the revised policy.</p>
          </section>

          <section>
            <h2 className="text-lg font-black mb-3" style={{ color: '#1B3828', fontFamily: "'Outfit', sans-serif" }}>11. Contact Us</h2>
            <p>If you have questions about this Privacy Policy or wish to exercise your rights, please contact us through our <Link href="/contact" className="underline font-semibold" style={{ color: '#1B3828' }}>contact page</Link> or by email at <a href="mailto:wearegavelling@gmail.com" className="underline font-semibold" style={{ color: '#1B3828' }}>wearegavelling@gmail.com</a>.</p>
          </section>

        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-[#DDD4C0] px-6 py-8" style={{ backgroundColor: '#F6F1E9' }}>
        <div className="flex flex-col items-center gap-4 md:flex-row md:justify-between max-w-3xl mx-auto">
          <img src="/GavellingLogo.png" alt="Gavelling" className="h-7 w-auto"
            style={{ filter: 'brightness(0) saturate(100%) invert(18%) sepia(25%) saturate(800%) hue-rotate(100deg) brightness(85%)' }} />
          <p className="text-xs text-[#9A8A78]">© {new Date().getFullYear()} Gavelling. All rights reserved.</p>
        </div>
        <FooterLegal tone="ivory" />
      </footer>
    </div>
  );
}
