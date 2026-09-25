'use client';

// ── Help center ──────────────────────────────────────────────────────────────
// One page, five sections, one search box. The full list of questions is
// rendered on the server; typing filters it on the client (never a fetch).
// Deep links: /help#pricing lands on the section, /help#cancel-unlimited opens
// that one entry (its id is passed to FaqList as defaultOpen once the hash is
// read on mount).

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Search, X, Landmark, GraduationCap, Gavel, Briefcase, Wallet, Mail, MessageSquare, type LucideIcon } from 'lucide-react';
import SiteNav from '@/components/SiteNav';
import FooterLegal from '@/components/FooterLegal';
import { Emoji3D, OUTFIT } from '@/components/neu';
import { FaqList } from '@/components/pricing/FaqList';
import { HELP_SECTIONS, searchHelp, sectionForEntry, type HelpFallbackIcon, type HelpSection } from '@/lib/helpContent';

const IVORY = '#EDE7D8';
const SURFACE = '#FAF8F3';
const BORDER = '#DDD4C0';
const FOREST = '#1B3828';
const INK = '#1C1410';
const INK_SOFT = '#5A5046';
const DEEP_GOLD = '#B6871F';

const FALLBACK: Record<HelpFallbackIcon, LucideIcon> = { Landmark, GraduationCap, Gavel, Briefcase, Wallet };

const FOCUS = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] focus-visible:ring-offset-2 focus-visible:ring-offset-[#EDE7D8]';

const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='1'/%3E%3C/svg%3E")`;

function SectionIcon({ section, size }: { section: HelpSection; size: number }) {
  return <Emoji3D name={section.emoji} size={size} fallback={FALLBACK[section.fallback]} fallbackColor={FOREST} />;
}

export default function HelpClient() {
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [active, setActive] = useState<string>(HELP_SECTIONS[0].id);
  const inputRef = useRef<HTMLInputElement>(null);

  // Deep links. A hash naming an entry opens it; a hash naming a section is
  // handled by the browser (the h2 carries the id and a scroll margin).
  useEffect(() => {
    function readHash() {
      const id = decodeURIComponent(window.location.hash.replace(/^#/, ''));
      if (!id) return;
      if (HELP_SECTIONS.some((s) => s.id === id)) { setActive(id); return; }
      const section = sectionForEntry(id);
      if (!section) return;
      setQuery('');
      setOpenId(id);
      setActive(section.id);
      // The row exists in the SSR HTML, so the browser already jumped there;
      // scroll again after the entry opens so the answer is in view.
      window.requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: 'start' }));
    }
    readHash();
    window.addEventListener('hashchange', readHash);
    return () => window.removeEventListener('hashchange', readHash);
  }, []);

  // Which section the reader is in, for the rail.
  useEffect(() => {
    if (query) return;
    const headings = HELP_SECTIONS.map((s) => document.getElementById(s.id)).filter((n): n is HTMLElement => !!n);
    if (headings.length === 0 || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((entries) => {
      const hit = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (hit) setActive(hit.target.id);
    }, { rootMargin: '-96px 0px -60% 0px', threshold: 0 });
    headings.forEach((h) => io.observe(h));
    return () => io.disconnect();
  }, [query]);

  const hits = useMemo(() => searchHelp(query), [query]);
  const searching = query.trim().length > 0;

  const grouped = useMemo(() => {
    const map = new Map<string, { section: HelpSection; entries: HelpSection['entries'] }>();
    for (const h of hits) {
      const g = map.get(h.section.id) ?? { section: h.section, entries: [] };
      g.entries.push(h.entry);
      map.set(h.section.id, g);
    }
    // Keep page order for the groups; the entries inside keep their rank.
    return HELP_SECTIONS.map((s) => map.get(s.id)).filter((g): g is NonNullable<typeof g> => !!g);
  }, [hits]);

  function clearQuery() {
    setQuery('');
    inputRef.current?.focus();
  }

  return (
    <div className="min-h-screen flex flex-col relative overflow-x-hidden" style={{ background: IVORY, fontFamily: OUTFIT, color: INK }}>
      <style>{`
        .gv-help-wrap{width:100%;max-width:1120px;margin:0 auto;padding:0 20px}
        .gv-help-head{padding:44px 0 28px}
        .gv-help-h1{margin:0;font-size:clamp(34px,6vw,54px);font-weight:900;letter-spacing:-0.02em;line-height:1.02;color:${INK}}
        .gv-help-lead{margin:12px 0 0;font-size:16.5px;line-height:1.55;color:${INK_SOFT};max-width:52ch}
        .gv-help-search{position:relative;margin-top:26px;max-width:640px}
        .gv-help-search svg.gv-help-glass{position:absolute;left:16px;top:50%;transform:translateY(-50%);color:${INK_SOFT};pointer-events:none}
        .gv-help-input{width:100%;height:48px;padding:0 52px 0 46px;border:1px solid ${BORDER};border-radius:14px;background:${SURFACE};font-family:${OUTFIT};font-size:16px;color:${INK};box-shadow:0 1px 2px rgba(27,56,40,0.06);transition:border-color 140ms ease,box-shadow 140ms ease}
        .gv-help-input::placeholder{color:${INK_SOFT};opacity:0.8}
        .gv-help-input::-webkit-search-cancel-button,.gv-help-input::-webkit-search-decoration{-webkit-appearance:none;display:none}
        .gv-help-input:hover{border-color:rgba(27,56,40,0.4)}
        .gv-help-input:focus{outline:none;border-color:${FOREST};box-shadow:0 0 0 2px rgba(27,56,40,0.18)}
        .gv-help-clear{position:absolute;right:2px;top:2px;width:44px;height:44px;display:inline-flex;align-items:center;justify-content:center;border:none;background:none;border-radius:12px;color:${INK_SOFT};cursor:pointer}
        .gv-help-clear:hover{color:${INK};background:rgba(27,56,40,0.06)}
        .gv-help-body{display:block;padding-bottom:72px}
        .gv-help-rail{display:flex;gap:8px;overflow-x:auto;padding:4px 0 14px;margin:0 -20px;padding-left:20px;padding-right:20px;scrollbar-width:none;-webkit-overflow-scrolling:touch}
        .gv-help-rail::-webkit-scrollbar{display:none}
        .gv-help-rail a{display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:0 14px 0 10px;border-radius:999px;border:1px solid ${BORDER};background:${SURFACE};color:${FOREST};font-size:14.5px;font-weight:700;white-space:nowrap;text-decoration:none;transition:background-color 140ms ease,border-color 140ms ease,color 140ms ease}
        .gv-help-rail a:hover{border-color:${FOREST}}
        .gv-help-rail a[aria-current="true"]{background:${FOREST};border-color:${FOREST};color:#FFFFFF}
        .gv-help-main{min-width:0}
        .gv-help-section{padding:36px 0 6px}
        .gv-help-section + .gv-help-section{margin-top:18px;border-top:1px solid ${BORDER}}
        .gv-help-h2{display:flex;align-items:center;gap:12px;margin:0;font-size:26px;font-weight:800;letter-spacing:-0.015em;line-height:1.15;color:${INK};scroll-margin-top:96px}
        .gv-help-intro{margin:8px 0 18px;font-size:15.5px;line-height:1.55;color:${INK_SOFT};max-width:60ch}
        .gv-help-results{padding-top:8px}
        .gv-help-results-count{margin:0 0 10px;font-size:14px;color:${INK_SOFT}}
        .gv-help-group{padding:20px 0 4px}
        .gv-help-group h2{margin:0 0 10px;font-size:13px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:${DEEP_GOLD}}
        .gv-help-empty{padding:28px 0 8px;font-size:16px;line-height:1.6;color:${INK_SOFT};max-width:56ch}
        .gv-help-empty a{color:${FOREST};font-weight:700;text-decoration:underline;text-underline-offset:3px}
        .gv-help-stuck{margin-top:56px;padding:26px 24px;border:1px solid ${BORDER};border-radius:18px;background:${SURFACE}}
        .gv-help-stuck h2{margin:0;font-size:22px;font-weight:800;letter-spacing:-0.01em;color:${INK}}
        .gv-help-stuck p{margin:8px 0 18px;font-size:15.5px;line-height:1.55;color:${INK_SOFT};max-width:56ch}
        .gv-help-stuck-acts{display:flex;flex-wrap:wrap;gap:10px}
        .gv-help-btn{display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:0 18px;border-radius:12px;font-size:15px;font-weight:700;text-decoration:none;transition:background-color 140ms ease,transform 160ms cubic-bezier(0.22,1,0.36,1)}
        .gv-help-btn:hover{transform:translateY(-1px)}
        .gv-help-btn-primary{background:${FOREST};color:#FFFFFF}
        .gv-help-btn-primary:hover{background:#244a35}
        .gv-help-btn-quiet{background:transparent;color:${FOREST};border:1px solid rgba(27,56,40,0.3)}
        .gv-help-btn-quiet:hover{background:rgba(27,56,40,0.06)}
        @media (min-width:1024px){
          .gv-help-head{padding:64px 0 36px}
          .gv-help-body{display:grid;grid-template-columns:232px minmax(0,1fr);column-gap:56px;align-items:start}
          .gv-help-rail{position:sticky;top:96px;flex-direction:column;gap:2px;overflow:visible;margin:0;padding:0}
          .gv-help-rail a{min-height:46px;padding:0 12px;border:none;background:transparent;border-radius:12px;font-size:15.5px;color:${INK_SOFT}}
          .gv-help-rail a:hover{background:rgba(27,56,40,0.06);color:${INK}}
          .gv-help-rail a[aria-current="true"]{background:rgba(27,56,40,0.08);color:${FOREST}}
          .gv-help-section{padding:8px 0 8px}
          .gv-help-section + .gv-help-section{margin-top:40px;padding-top:40px}
          .gv-help-h2{font-size:30px}
        }
        @media (prefers-reduced-motion:reduce){.gv-help-btn,.gv-help-rail a,.gv-help-input{transition:none}.gv-help-btn:hover{transform:none}}
      `}</style>

      <div className="pointer-events-none fixed inset-0 z-0" style={{ backgroundImage: GRAIN, backgroundRepeat: 'repeat', backgroundSize: '300px 300px', mixBlendMode: 'multiply', opacity: 0.18 }} />

      <SiteNav />

      <main className="relative z-10 flex-1 w-full">
        <div className="gv-help-wrap">
          <header className="gv-help-head">
            <h1 className="gv-help-h1">How can we help?</h1>
            <p className="gv-help-lead">Short answers about sessions, conferences, credits and Unlimited. Type a word or two, or browse by section.</p>
            <div className="gv-help-search">
              <Search className="gv-help-glass" size={18} strokeWidth={2.2} aria-hidden />
              <input
                ref={inputRef}
                type="search"
                className="gv-help-input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape' && query) { e.preventDefault(); clearQuery(); } }}
                placeholder="Search the help center"
                aria-label="Search the help center"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="search"
              />
              {query && (
                <button type="button" className={`gv-help-clear ${FOCUS}`} onClick={clearQuery} aria-label="Clear search">
                  <X size={18} strokeWidth={2.2} aria-hidden />
                </button>
              )}
            </div>
          </header>

          <div className="gv-help-body">
            <nav className="gv-help-rail" aria-label="Help sections">
              {HELP_SECTIONS.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className={FOCUS}
                  aria-current={!searching && active === s.id ? 'true' : undefined}
                  onClick={(e) => {
                    setActive(s.id);
                    if (!searching) return;
                    // The section headings are not on the page while a search
                    // is shown: clear it first, then jump once they are back.
                    e.preventDefault();
                    setQuery('');
                    window.requestAnimationFrame(() => {
                      document.getElementById(s.id)?.scrollIntoView({ block: 'start' });
                      window.history.replaceState(null, '', `#${s.id}`);
                    });
                  }}
                >
                  <SectionIcon section={s} size={22} />
                  <span>{s.title}</span>
                </a>
              ))}
            </nav>

            <div className="gv-help-main">
              {searching ? (
                <section className="gv-help-results" aria-label="Search results">
                  {hits.length === 0 ? (
                    <p className="gv-help-empty" aria-live="polite">
                      No matches. Email <a href="mailto:wearegavelling@gmail.com">wearegavelling@gmail.com</a> and we&apos;ll answer.
                    </p>
                  ) : (
                    <>
                      <p className="gv-help-results-count" aria-live="polite">{hits.length === 1 ? '1 answer' : `${hits.length} answers`} for &ldquo;{query.trim()}&rdquo;</p>
                      {grouped.map((g) => (
                        <div key={g.section.id} className="gv-help-group">
                          <h2>{g.section.title}</h2>
                          <FaqList
                            key={`${g.section.id}:${query}`}
                            entries={g.entries}
                            context="header"
                            compact
                            defaultOpen={hits[0] && hits[0].section.id === g.section.id ? [hits[0].entry.id] : []}
                          />
                        </div>
                      ))}
                    </>
                  )}
                </section>
              ) : (
                HELP_SECTIONS.map((s) => {
                  const opens = openId && s.entries.some((e) => e.id === openId) ? [openId] : [];
                  return (
                    <section key={s.id} className="gv-help-section" aria-labelledby={`${s.id}-title`}>
                      <h2 id={s.id} className="gv-help-h2">
                        <SectionIcon section={s} size={28} />
                        <span id={`${s.id}-title`}>{s.title}</span>
                      </h2>
                      <p className="gv-help-intro">{s.intro}</p>
                      <FaqList key={`${s.id}:${opens[0] ?? ''}`} entries={s.entries} context="header" compact defaultOpen={opens} />
                    </section>
                  );
                })
              )}

              <aside className="gv-help-stuck" aria-labelledby="help-stuck-title">
                <h2 id="help-stuck-title">Still stuck?</h2>
                <p>Write to us and a person answers. Say which conference or session code it is about and we can look straight at it.</p>
                <div className="gv-help-stuck-acts">
                  <a href="mailto:wearegavelling@gmail.com" className={`gv-help-btn gv-help-btn-primary ${FOCUS}`}>
                    <Mail size={17} strokeWidth={2.2} aria-hidden />
                    Email wearegavelling@gmail.com
                  </a>
                  <Link href="/contact" className={`gv-help-btn gv-help-btn-quiet ${FOCUS}`}>
                    <MessageSquare size={17} strokeWidth={2.2} aria-hidden />
                    Use the contact form
                  </Link>
                </div>
              </aside>
            </div>
          </div>
        </div>
      </main>

      <FooterLegal tone="ivory" />
    </div>
  );
}
