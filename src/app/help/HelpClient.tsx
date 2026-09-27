'use client';

// ── Help center ──────────────────────────────────────────────────────────────
// One page, five sections, one search box. The full list of questions is
// rendered on the server; typing filters it on the client (never a fetch).
// Deep links: /help#pricing lands on the section, /help#cancel-unlimited opens
// that one entry. Nothing else ever opens an entry: every question starts
// collapsed, in the sections and in the search results alike.
//
// Look (taste board, 25 Sep 2026): an ivory header block (ink title with the
// gold last word, the search and a sentence-case forest "Contact us" button),
// a white body, a quiet section rail (forest only as the current item's accent),
// sticky from 1024px, and the answers as a calm 65ch reading column.

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Search, X, Landmark, GraduationCap, Gavel, Briefcase, Wallet, type LucideIcon } from 'lucide-react';
import SiteNav from '@/components/SiteNav';
import SiteFooter from '@/components/SiteFooter';
import { Emoji3D, OUTFIT } from '@/components/neu';
import { GoldWord } from '@/components/BrandHeading';
import { FaqList } from '@/components/pricing/FaqList';
import { HELP_SECTIONS, searchHelp, sectionForEntry, type HelpFallbackIcon, type HelpSection } from '@/lib/helpContent';

const FOREST = '#1B3828';
const FOREST_MID = '#2A5A3C';
const GOLD = '#EED98A';
const CREAM = '#EDE7D8';
const IVORY = '#F4EFE3';
const WHITE = '#FFFFFF';
const INK = '#1C1410';
const INK_SOFT = '#5A5046';

const FALLBACK: Record<HelpFallbackIcon, LucideIcon> = { Landmark, GraduationCap, Gavel, Briefcase, Wallet };

/** Focus ring on the white body. */
const FOCUS = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] focus-visible:ring-offset-2 focus-visible:ring-offset-white';
/** Focus ring on the ivory header. */
const FOCUS_ON_IVORY = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] focus-visible:ring-offset-2 focus-visible:ring-offset-[#F4EFE3]';

function SectionIcon({ section, size }: { section: HelpSection; size: number }) {
  return <Emoji3D name={section.emoji} size={size} fallback={FALLBACK[section.fallback]} fallbackColor={FOREST} />;
}

export default function HelpClient() {
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [active, setActive] = useState<string>(HELP_SECTIONS[0].id);
  const inputRef = useRef<HTMLInputElement>(null);

  // Deep links. A hash naming an entry opens that one entry; a hash naming a
  // section is handled by the browser (the h2 carries the id and a scroll margin).
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
    <div className="min-h-screen flex flex-col relative" style={{ background: WHITE, fontFamily: OUTFIT, color: INK, overflowX: 'clip' }}>
      <style>{`
        .gv-help-wrap{width:100%;max-width:1120px;margin:0 auto;padding:0 20px}

        /* Header block: ivory, ink title with the gold word, one line, the search row. */
        .gv-help-hero{background:${IVORY};color:${INK};padding:clamp(40px,4vw,64px) 0 clamp(32px,3vw,44px);border-bottom:1px solid ${CREAM}}
        .gv-help-h1{margin:0;font-size:clamp(32px,4vw,48px);font-weight:900;letter-spacing:-0.02em;line-height:1.05;color:${INK}}
        .gv-help-lead{margin:10px 0 0;font-size:16px;line-height:1.55;color:${INK_SOFT}}
        .gv-help-lead a{color:${FOREST};font-weight:700;text-decoration:underline;text-underline-offset:3px;text-decoration-thickness:1.5px;border-radius:4px}
        .gv-help-lead a:hover{color:${FOREST_MID}}
        .gv-help-row{display:flex;flex-direction:column;gap:10px;margin-top:24px;max-width:720px}
        .gv-help-search{position:relative;flex:1 1 auto;min-width:0}
        .gv-help-search svg.gv-help-glass{position:absolute;left:16px;top:50%;transform:translateY(-50%);color:${INK_SOFT};pointer-events:none}
        .gv-help-input{width:100%;height:48px;padding:0 52px 0 46px;border:1px solid rgba(27,56,40,0.14);border-radius:12px;background:${WHITE};font-family:${OUTFIT};font-size:16px;color:${INK};box-shadow:0 2px 10px rgba(27,56,40,0.08);transition:box-shadow 140ms ease,border-color 140ms ease}
        .gv-help-input::placeholder{color:${INK_SOFT};opacity:0.85}
        .gv-help-input::-webkit-search-cancel-button,.gv-help-input::-webkit-search-decoration{-webkit-appearance:none;display:none}
        .gv-help-input:hover{border-color:rgba(27,56,40,0.3)}
        .gv-help-input:focus{outline:none;border-color:${FOREST};box-shadow:0 0 0 3px rgba(27,56,40,0.14),0 2px 10px rgba(27,56,40,0.08)}
        .gv-help-clear{position:absolute;right:2px;top:2px;width:44px;height:44px;display:inline-flex;align-items:center;justify-content:center;border:none;background:none;border-radius:12px;color:${INK_SOFT};cursor:pointer}
        .gv-help-clear:hover{color:${INK};background:rgba(27,56,40,0.08)}
        .gv-help-contact{display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;height:48px;padding:0 22px;border-radius:12px;background:linear-gradient(90deg,#1B3828 0%,#2A5A3C 55%,#1E4A31 100%);color:${WHITE};font-family:${OUTFIT};font-size:15px;font-weight:700;text-decoration:none;white-space:nowrap;box-shadow:0 2px 10px rgba(27,56,40,0.18);transition:filter 140ms ease,transform 160ms cubic-bezier(0.22,1,0.36,1)}
        .gv-help-contact:hover{filter:brightness(1.12);transform:translateY(-1px)}
        .gv-help-contact:active{transform:scale(0.98)}

        /* Body: white, the rail and the sections. */
        .gv-help-body{display:block;padding:20px 0 clamp(40px,4vw,64px)}
        .gv-help-rail{display:flex;gap:8px;overflow-x:auto;padding:4px 20px 14px;margin:0 -20px;scrollbar-width:none;-webkit-overflow-scrolling:touch}
        .gv-help-rail::-webkit-scrollbar{display:none}
        .gv-help-rail a{display:inline-flex;align-items:center;gap:10px;min-height:44px;padding:0 14px 0 10px;border-radius:10px;border:none;background:transparent;color:${INK_SOFT};font-size:15px;font-weight:600;white-space:nowrap;text-decoration:none;box-shadow:inset 3px 0 0 transparent;transition:background-color 140ms ease,color 140ms ease}
        .gv-help-rail a:hover{background:${IVORY};color:${INK}}
        .gv-help-rail a[aria-current="true"]{background:${IVORY};color:${FOREST};font-weight:700;box-shadow:inset 3px 0 0 ${FOREST}}
        .gv-help-rail a[aria-current="true"]:hover{background:${IVORY};color:${FOREST}}
        .gv-help-main{min-width:0}
        .gv-help-section{padding:28px 0 6px}
        .gv-help-section + .gv-help-section{margin-top:18px;border-top:1px solid ${CREAM}}
        .gv-help-h2{display:flex;align-items:center;gap:12px;margin:0 0 14px;font-size:26px;font-weight:800;letter-spacing:-0.015em;line-height:1.15;color:${INK};scroll-margin-top:96px}
        .gv-help-h2::after{content:"";flex:1 1 auto;height:3px;border-radius:2px;background:${GOLD};margin-left:6px}
        .gv-help-results{padding-top:8px}
        .gv-help-results-count{margin:0 0 10px;font-size:14px;color:${INK_SOFT}}
        .gv-help-group{padding:20px 0 4px}
        .gv-help-group h2{margin:0 0 10px;font-size:17px;font-weight:800;letter-spacing:-0.005em;color:${INK}}
        .gv-help-empty{padding:28px 0 8px;font-size:16px;line-height:1.6;color:${INK_SOFT};max-width:56ch}
        .gv-help-empty a{color:${FOREST};font-weight:700;text-decoration:underline;text-underline-offset:3px;text-decoration-thickness:1.5px;border-radius:4px}
        .gv-help-empty a:hover{color:${FOREST_MID}}

        @media (min-width:640px){
          .gv-help-row{flex-direction:row;align-items:stretch}
        }
        @media (min-width:1024px){
           .gv-help-body{display:grid;grid-template-columns:232px minmax(0,1fr);column-gap:56px;align-items:start;padding-top:40px}
          .gv-help-rail{position:sticky;top:96px;align-self:start;flex-direction:column;gap:6px;overflow:visible;margin:0;padding:0;max-height:calc(100dvh - 96px)}
          .gv-help-rail a{min-height:44px;padding:0 14px 0 12px;font-size:15px}
          .gv-help-section{padding:8px 0 8px}
          .gv-help-section + .gv-help-section{margin-top:clamp(32px,3vw,48px);padding-top:clamp(32px,3vw,48px)}
          .gv-help-h2{font-size:30px}
        }
        @media (prefers-reduced-motion:reduce){.gv-help-contact,.gv-help-rail a,.gv-help-input{transition:none}.gv-help-contact:hover{transform:none}}
      `}</style>

      <SiteNav />

      <main className="relative z-10 flex-1 w-full">
        <header className="gv-help-hero">
          <div className="gv-help-wrap">
            <h1 className="gv-help-h1">How can we <GoldWord tone="light">help</GoldWord></h1>
            <p className="gv-help-lead">
              Search or browse by section, or <Link href="/contact" className={FOCUS_ON_IVORY}>contact us</Link>
            </p>
            <div className="gv-help-row">
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
              <Link href="/contact" className={`gv-help-contact ${FOCUS_ON_IVORY}`}>Contact us</Link>
            </div>
          </div>
        </header>

        <div className="gv-help-wrap">
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
                      No matches. <Link href="/contact" className={FOCUS}>Contact us</Link> and a person answers
                    </p>
                  ) : (
                    <>
                      <p className="gv-help-results-count" aria-live="polite">{hits.length === 1 ? '1 answer' : `${hits.length} answers`} for &ldquo;{query.trim()}&rdquo;</p>
                      {grouped.map((g) => (
                        <div key={g.section.id} className="gv-help-group">
                          <h2>{g.section.title}</h2>
                          {/* Every hit starts collapsed, the best one included (G4). */}
                          <FaqList key={`${g.section.id}:${query}`} entries={g.entries} context="header" compact reading />
                        </div>
                      ))}
                    </>
                  )}
                </section>
              ) : (
                HELP_SECTIONS.map((s) => {
                  // Only a URL fragment naming an entry opens it; nothing else does.
                  const opens = openId && s.entries.some((e) => e.id === openId) ? [openId] : [];
                  return (
                    <section key={s.id} className="gv-help-section" aria-labelledby={`${s.id}-title`}>
                      <h2 id={s.id} className="gv-help-h2">
                        <SectionIcon section={s} size={28} />
                        <span id={`${s.id}-title`}>{s.title}</span>
                      </h2>
                      <FaqList key={`${s.id}:${opens[0] ?? ''}`} entries={s.entries} context="header" compact reading defaultOpen={opens} />
                    </section>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
