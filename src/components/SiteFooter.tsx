// ── ONE footer, everywhere (owner, 25 Sep 2026) ──────────────────────────────
// The footer the owner likes is the sessions landing's: the logo, Instagram
// and LinkedIn, the © line with Privacy Policy, then the FooterLegal row of
// information links. It replaces LabFooter (the grain footer on the homepage)
// and every page's own footer. The wordmark is BrandLogo.
//
// Server-renderable: it takes the © line as a prop (the sessions landing
// passes its translated `home_footer_copy`; everything else uses the English
// default), so a page that is a server component can mount it directly.

import Link from 'next/link';
import BrandLogo from '@/components/BrandLogo';
import FooterLegal from '@/components/FooterLegal';

const FOREST = '#1B3828';
const HAIR = 'rgba(27,56,40,0.14)';

export default function SiteFooter({
  copy,
  className = '',
}: {
  /** The © line. `{year}` is replaced. */
  copy?: string;
  className?: string;
}) {
  const line = (copy ?? '© {year} Gavelling. Built for the MUN community.').replace('{year}', String(new Date().getFullYear()));
  return (
    <footer
      className={`relative z-10 border-t px-6 py-8 ${className}`}
      style={{ borderColor: HAIR, backgroundColor: '#F6F1E9', fontFamily: 'var(--font-brand), sans-serif' }}
    >
      <style>{`
        .gv-foot-social{color:#5A5046;transition:color .15s ease,transform .15s ease;display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:999px}
        .gv-foot-social:hover,.gv-foot-social:focus-visible{color:${FOREST};transform:translateY(-1px);outline:none}
        .gv-foot-social:focus-visible{box-shadow:0 0 0 2px ${FOREST}}
        .gv-foot-link{color:${FOREST};font-weight:700;text-decoration:underline;text-underline-offset:3px;text-decoration-thickness:1.5px;transition:color .15s ease}
        .gv-foot-link:hover{color:#0F3A28}
        .gv-foot-link:focus-visible{outline:2px solid ${FOREST};outline-offset:2px;border-radius:4px}
      `}</style>
      <div className="mx-auto w-full max-w-6xl flex flex-col items-center gap-4 md:grid md:grid-cols-3 md:gap-0 md:items-center">
        <div className="justify-self-center md:justify-self-start">
          <BrandLogo height={28} tone="ink" />
        </div>
        <div className="flex items-center justify-center gap-2">
          <a href="https://www.instagram.com/wearegavelling/" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="gv-foot-social">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
            </svg>
          </a>
          <a href="https://www.linkedin.com/company/gavelling/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className="gv-foot-social">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" /><rect x="2" y="9" width="4" height="12" /><circle cx="4" cy="4" r="2" />
            </svg>
          </a>
        </div>
        <div className="flex flex-col items-center gap-1 md:items-end">
          <p className="text-xs font-semibold" style={{ color: FOREST, margin: 0 }}>{line}</p>
          <Link href="/privacy" className="text-xs gv-foot-link">Privacy Policy</Link>
        </div>
      </div>
      <FooterLegal tone="ivory" />
    </footer>
  );
}
