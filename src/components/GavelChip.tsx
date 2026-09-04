'use client';

// ─────────────────────────────────────────────────────────────────────────────
// GavelChip — the ONE place a chair sees, and changes, who is chairing.
//
// Replaces the old crimson "View only · X is chairing" pill. That pill was
// (a) only rendered for the Commenter, so the Moderator had no idea a handover
// was even possible, and (b) coloured like an error, which made switching feel
// like something had gone wrong. The whole point of this redesign is the
// opposite message: switching is cheap, instant, and reversible.
//
// Two states, both calm:
//   • YOU HOLD IT      → forest gradient pill, gold text. Positive, not a warning.
//   • SOMEONE ELSE     → ivory NEU pill + presence dot. Never crimson.
//
// Handover is ONE field write (settings.headChair). It never touches
// current_speaker, speakers_list, caucus or phase — the session keeps running
// and delegates see nothing at all. The popover says so in as many words.
//
// Positioning note (important): the chip lives inside FitToScreen, and Portal
// targets `#fit-root`, which carries a CSS `transform: scale()`. A transformed
// ancestor becomes the containing block for `position: fixed` descendants, so
// a portaled fixed layer is positioned in fit-root's UNSCALED coordinate space
// while getBoundingClientRect() reports SCALED viewport pixels. Everything here
// is therefore divided by the live fit-root scale, and the viewport bounds used
// for clamping/flipping are `window.inner*/scale`. Never use `vh`/`vw` units
// here — they do not match that space.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Portal from '@/components/Portal';
import { NEU, OUTFIT, EASE } from '@/components/neu';
import { useT } from '@/contexts/LanguageContext';

const POPOVER_W = 288;

/** Live scale of the FitToScreen root (1 when the chip is not inside one). */
function fitScale(): number {
  if (typeof document === 'undefined') return 1;
  const root = document.getElementById('fit-root');
  if (!root || !root.offsetWidth) return 1;
  const s = root.getBoundingClientRect().width / root.offsetWidth;
  return Number.isFinite(s) && s > 0 ? s : 1;
}

function GavelGlyph({ size = 13, color }: { size?: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d="m14.5 12.5-8 8a2.12 2.12 0 1 1-3-3l8-8" />
      <path d="m16 16 6-6" /><path d="m8 8 6-6" />
      <path d="m9 7 8 8" /><path d="m21 11-8-8" />
    </svg>
  );
}

function Dot({ online }: { online: boolean }) {
  return (
    <span
      aria-hidden
      style={{
        width: 7, height: 7, borderRadius: 9999, flexShrink: 0,
        backgroundColor: online ? NEU.green : NEU.amber,
        boxShadow: online ? `0 0 0 2px rgba(61,122,82,0.20)` : `0 0 0 2px rgba(184,132,74,0.20)`,
      }}
    />
  );
}

export default function GavelChip({
  chairNames,
  headChairName,
  myChairName,
  onlineChairs,
  headOffline,
  onTakeGavel,
  onHandOver,
}: {
  /** Every chair who has ever joined — `committee.chairNames`. Handover targets are limited to this. */
  chairNames: string[];
  /** Current gavel holder (already resolved: dbHeadChair ?? chairNames[0]). */
  headChairName: string | null;
  /** This device's chair identity (?chairName=). */
  myChairName: string;
  /** Chair names currently present on the `chair-presence-{id}` channel. */
  onlineChairs: Set<string>;
  /** True when the holder has been off the presence channel for >20s. Human decides — never auto-transfer. */
  headOffline: boolean;
  onTakeGavel: () => void;
  onHandOver: (name: string) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; flip: boolean } | null>(null);
  const [pulse, setPulse] = useState(0);
  const [hint, setHint] = useState(false);
  const hintTimer = useRef<NodeJS.Timeout | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const prevHolder = useRef<string | null>(headChairName);

  const iHoldIt = !!headChairName && headChairName === myChairName;
  const holderOnline = !!headChairName && (headChairName === myChairName || onlineChairs.has(headChairName));
  const showOffline = !iHoldIt && headOffline;

  // Pulse ring for ~1.2s whenever the holder changes, so a handover is noticed
  // without a modal interrupting whoever is mid-speech.
  useEffect(() => {
    if (prevHolder.current === headChairName) return;
    prevHolder.current = headChairName;
    setPulse((n) => n + 1);
    const t = setTimeout(() => setPulse(0), 1300);
    return () => clearTimeout(t);
  }, [headChairName]);

  const place = useCallback(() => {
    const b = btnRef.current;
    if (!b) return;
    const s = fitScale();
    const r = b.getBoundingClientRect();
    // → fit-root (unscaled) space
    const left0 = r.left / s, right0 = r.right / s, top0 = r.top / s, bottom0 = r.bottom / s;
    const vw = window.innerWidth / s, vh = window.innerHeight / s;
    const margin = 8;
    const h = menuRef.current?.offsetHeight ?? (150 + chairNames.length * 42);

    // Right-align to the trigger (the chip hugs the right edge), then clamp.
    let left = right0 - POPOVER_W;
    if (left + POPOVER_W > vw - margin) left = vw - margin - POPOVER_W;
    left = Math.max(margin, Math.min(left, left0));
    left = Math.max(margin, left);

    const spaceBelow = vh - margin - (bottom0 + 8);
    const spaceAbove = top0 - 8 - margin;
    const flip = h > spaceBelow && spaceAbove > spaceBelow;
    const top = flip ? Math.max(margin, top0 - 8 - h) : bottom0 + 8;
    setPos({ top, left, flip });
  }, [chairNames.length]);

  useLayoutEffect(() => { if (open) place(); }, [open, place]);

  useEffect(() => {
    if (!open) { setPos(null); setHint(false); return; }
    place();
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      // Account for the portaled node — it is not a DOM descendant of the trigger.
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false); }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, place]);

  useEffect(() => () => { if (hintTimer.current) clearTimeout(hintTimer.current); }, []);
  const openHint = () => { if (hintTimer.current) clearTimeout(hintTimer.current); setHint(true); };
  // Small close delay so the pointer can travel from the badge into the panel.
  const closeHint = () => { if (hintTimer.current) clearTimeout(hintTimer.current); hintTimer.current = setTimeout(() => setHint(false), 160); };

  // Holder first, then everyone else alphabetically. Handover targets are limited to
  // committee.chairNames; self is unioned in because a chair can reach the session with
  // a ?chairName= that has not landed in chair_names yet (e.g. the organiser's
  // "Secretariat" deep link) — that row is what carries "Take the gavel".
  const rows = (() => {
    const all = new Set(chairNames.filter(Boolean));
    if (myChairName) all.add(myChairName);
    if (headChairName) all.add(headChairName);
    const rest = [...all].filter((n) => n !== headChairName).sort((a, b) => a.localeCompare(b));
    return headChairName ? [headChairName, ...rest] : rest;
  })();

  const chipStyle: React.CSSProperties = iHoldIt
    ? {
        background: 'linear-gradient(135deg, #1B3828, #2A5A3C)',
        color: NEU.gold,
        border: '1px solid rgba(238,217,138,0.28)',
        boxShadow: '0 8px 22px rgba(27,56,40,0.26)',
      }
    : showOffline
      ? {
          backgroundColor: '#F6EEE0',
          color: '#8A5A2E',
          border: `1px solid rgba(184,132,74,0.45)`,
          boxShadow: NEU.outSm,
        }
      : {
          backgroundColor: NEU.surface,
          color: NEU.ink,
          border: '1px solid rgba(221,212,192,0.9)',
          boxShadow: NEU.outSm,
        };

  return (
    <>
      <style>{`
        @keyframes gavelchip-ring {
          0%   { transform: scale(1);    opacity: 0.55; }
          70%  { transform: scale(1.18); opacity: 0;    }
          100% { transform: scale(1.18); opacity: 0;    }
        }
        @keyframes gavelchip-in {
          from { opacity: 0; transform: translateY(-4px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
      `}</style>

      {/* `--dgn-stack-shift` is published on <html> by NotificationStack, which now owns
          the slot directly under the header in this same top-inline-end column. It is the
          stack's measured height (absent → 0 when the stack is empty or suppressed), so
          the chip steps down below the cards and back up when they clear. See the
          positioning note at the top of NotificationStack.tsx. */}
      <div
        className="fixed z-50"
        style={{
          top: 'calc(3.75rem + var(--dgn-stack-shift, 0px))', right: '0.85rem',
          fontFamily: OUTFIT, transition: 'top 240ms cubic-bezier(0.22,1,0.36,1)',
        }}
      >
        {pulse > 0 && (
          <span
            key={pulse}
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-full"
            style={{
              border: `2px solid ${iHoldIt ? NEU.gold : NEU.green}`,
              animation: 'gavelchip-ring 1.2s cubic-bezier(0.22,1,0.36,1) 2',
            }}
          />
        )}
        <button
          ref={btnRef}
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={open}
          className="flex items-center gap-2 px-3.5 py-2 rounded-full focus:outline-none"
          style={{
            ...chipStyle,
            transition: `box-shadow 180ms ${EASE}, transform 180ms ${EASE}`,
            backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}
        >
          {iHoldIt
            ? <GavelGlyph color={NEU.gold} />
            : <Dot online={holderOnline} />}
          <span className="text-xs font-bold whitespace-nowrap">
            {iHoldIt ? (
              <span className="font-black">{t('gavel_you_have_it')}</span>
            ) : showOffline ? (
              <>{t('gavel_chair_offline')} <span className="font-black">{t('gavel_take_over')}</span></>
            ) : (
              <>{t('gavel_chairing_label')} <span className="font-black">{headChairName ?? '—'}</span></>
            )}
          </span>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"
            style={{ opacity: 0.7, transform: open ? 'rotate(180deg)' : 'none', transition: `transform 180ms ${EASE}` }}>
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </div>

      {open && pos && (
        <Portal>
          <div
            ref={menuRef}
            role="menu"
            className="fixed z-[60] rounded-2xl"
            style={{
              top: pos.top, left: pos.left, width: POPOVER_W,
              backgroundColor: NEU.surface,
              border: '1px solid rgba(221,212,192,0.9)',
              boxShadow: '0 18px 44px rgba(27,56,40,0.22)',
              fontFamily: OUTFIT,
              animation: `gavelchip-in 160ms ${EASE}`,
            }}
          >
            {/* Header + hover-only explainer (UI RULE: informational "i" opens on hover/focus).
                The panel hangs off the whole card, not over the header — obscuring the very
                rows the reader is deciding between defeats the purpose of the hint. It follows
                the card's own flip direction: when the card flipped UP because there was no
                room below it, dropping the hint downward would put it right back in the space
                that was already too small. */}
            <div className="flex items-center gap-1.5 px-3.5 pt-3 pb-2">
              <span className="text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: NEU.muted }}>
                {t('gavel_popover_title')}
              </span>
              <span
                tabIndex={0}
                role="note"
                aria-label={t('gavel_explainer_aria')}
                onMouseEnter={openHint} onMouseLeave={closeHint}
                onFocus={openHint} onBlur={closeHint}
                className="inline-flex items-center justify-center rounded-full cursor-default focus:outline-none"
                style={{
                  width: 13, height: 13, fontSize: 9, fontWeight: 900, lineHeight: 1,
                  color: NEU.muted, border: `1.2px solid ${NEU.muted}`, opacity: 0.75,
                }}
              >
                i
              </span>
            </div>

            {hint && (
              <div
                onMouseEnter={openHint} onMouseLeave={closeHint}
                className="absolute rounded-xl px-3 py-2.5 z-10"
                style={{
                  ...(pos.flip
                    ? { bottom: 'calc(100% + 6px)' }
                    : { top: 'calc(100% + 6px)' }),
                  left: 6, right: 6,
                  backgroundColor: NEU.forest, color: '#EFE9DB',
                  boxShadow: '0 10px 26px rgba(27,56,40,0.30)',
                  fontSize: 11, lineHeight: 1.45, fontWeight: 500,
                }}
              >
                {t('gavel_explainer')}
              </div>
            )}

            <div className="px-2 pb-1.5 flex flex-col gap-1">
              {rows.map((name) => {
                const isHolder = name === headChairName;
                const isMe = name === myChairName;
                const online = isMe || onlineChairs.has(name);
                return (
                  <div
                    key={name}
                    className="flex items-center gap-2 rounded-xl px-2.5 py-2"
                    style={isHolder
                      ? { boxShadow: NEU.inSm, backgroundColor: 'rgba(27,56,40,0.05)' }
                      : { backgroundColor: 'transparent' }}
                  >
                    {isHolder ? <GavelGlyph size={13} color={NEU.deepGold} /> : <Dot online={online} />}
                    <span className="text-xs truncate" style={{ color: NEU.ink, fontWeight: isHolder ? 800 : 600 }}>
                      {name}{isMe ? ` ${t('gavel_you')}` : ''}
                    </span>
                    {isHolder && (
                      <span className="ms-auto text-[9px] font-black uppercase tracking-widest shrink-0" style={{ color: NEU.deepGold }}>
                        {t('gavel_chairing_badge')}
                      </span>
                    )}
                    {!isHolder && isMe && (
                      <button
                        onClick={() => { onTakeGavel(); setOpen(false); }}
                        className="ms-auto shrink-0 text-[10px] font-black px-2.5 py-1.5 rounded-lg focus:outline-none"
                        style={{
                          background: 'linear-gradient(135deg, #1B3828, #2A5A3C)', color: NEU.gold,
                          transition: `filter 160ms ${EASE}`,
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.filter = 'brightness(1.15)'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.filter = 'none'; }}
                      >
                        {t('gavel_take_the_gavel')}
                      </button>
                    )}
                    {!isHolder && !isMe && iHoldIt && (
                      <button
                        onClick={() => { onHandOver(name); setOpen(false); }}
                        className="ms-auto shrink-0 text-[10px] font-black px-2.5 py-1.5 rounded-lg focus:outline-none"
                        style={{
                          backgroundColor: NEU.surface, color: NEU.forest,
                          boxShadow: NEU.outSm, transition: `box-shadow 160ms ${EASE}`,
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = NEU.outSmHover; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = NEU.outSm; }}
                      >
                        {t('gavel_hand_over')}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="px-3.5 pt-2 pb-3" style={{ borderTop: '1px solid rgba(221,212,192,0.9)' }}>
              <p className="text-[10.5px] leading-snug font-semibold" style={{ color: NEU.muted }}>
                {t('gavel_footnote')}
              </p>
            </div>
          </div>
        </Portal>
      )}
    </>
  );
}
