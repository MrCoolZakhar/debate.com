'use client';

// The committee settings pop-up (12 Oct 2026, owner: "in your committees on
// organiser tools, completely remove overview and settings. put the settings
// button right next to the filters, slightly bigger"). The Committees page no
// longer has Overview / Settings section cards: it shows the committees
// straight away, and what the Settings section held (session release times,
// observer access, Send all) opens here from the Settings button beside the
// sort filters. Purely a frame: every control and every write inside is the
// page's own, passed in as children.
//
// The house ModalOverlay gives the Portal, the scrim, the scroll lock and the
// shared Escape stack (so a confirm opened from inside closes first). This
// adds the white organiser card (the Store's gv-st-card look), a close button,
// focus on open, Tab kept inside the card and focus returned to the button
// that opened it.

import { useEffect, useRef, type ReactNode } from 'react';
import { Settings, X } from 'lucide-react';
import { ModalOverlay, MODAL_PANEL_MAX_HEIGHT } from '@/components/ModalOverlay';
import { Emoji3D, OUTFIT } from '@/components/neu';
import { GoldWord } from '@/components/BrandHeading';

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

const CSS = `
.gv-cs-card{position:relative;width:min(760px,calc(100vw - 32px));background:#FFFFFF;border-radius:22px;padding:26px 28px 24px;box-shadow:0 1px 0 rgba(27,56,40,0.08),0 30px 60px -30px rgba(27,56,40,0.45);font-family:${OUTFIT};color:#1C1410;overflow-y:auto;overscroll-behavior:contain}
.gv-cs-close{position:absolute;top:16px;right:16px;width:40px;height:40px;border-radius:999px;border:none;background:#FAF8F3;color:#1C1410;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:inset 0 0 0 1px rgba(27,56,40,0.12);transition:background-color 140ms ease,transform 120ms ease}
.gv-cs-close:hover{background:#F0EBDD}
.gv-cs-close:active{transform:scale(0.96)}
.gv-cs-close:focus{outline:none}
.gv-cs-close:focus-visible{outline:2px solid #1B3828;outline-offset:2px}
@media (max-width:600px){.gv-cs-card{padding:22px 18px 20px;border-radius:20px}}
`;

export function CommitteeSettingsSheet({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const cardRef = useRef<HTMLDivElement>(null);

  // Focus the card on open; give focus back to whatever opened it on close.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    // The Portal mounts its children a tick after this effect, so wait for
    // the card (a few ticks at most) before moving focus into it. Timers, not
    // animation frames, so it also works in a tab that is not in front.
    let id: ReturnType<typeof setTimeout> | undefined;
    let tries = 0;
    const focusIn = () => {
      const card = cardRef.current;
      if (!card) {
        if (tries++ < 30) id = setTimeout(focusIn, 16);
        return;
      }
      (card.querySelector<HTMLElement>('[data-cs-autofocus]') ?? card).focus();
    };
    id = setTimeout(focusIn, 0);
    return () => {
      clearTimeout(id);
      if (opener && document.contains(opener)) opener.focus();
    };
  }, []);

  // Tab and Shift+Tab wrap inside the card. On the card's own keydown, so a
  // confirm dialog stacked on top keeps its own focus handling.
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab' || !cardRef.current) return;
    const items = Array.from(cardRef.current.querySelectorAll<HTMLElement>(FOCUSABLE))
      .filter(el => el.offsetParent !== null || el === document.activeElement);
    if (items.length === 0) { e.preventDefault(); return; }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === cardRef.current)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
  };

  return (
    <ModalOverlay onClose={onClose} labelledBy="gv-cs-title" scrimColor="rgba(27,20,16,0.42)">
      <style>{CSS}</style>
      <div
        ref={cardRef}
        className="gv-cs-card"
        tabIndex={-1}
        onKeyDown={onKeyDown}
        style={{ maxHeight: MODAL_PANEL_MAX_HEIGHT, outline: 'none' }}
        data-testid="committee-settings-sheet"
      >
        <button type="button" className="gv-cs-close" onClick={onClose} aria-label="Close settings" data-cs-autofocus>
          <X size={18} strokeWidth={2.4} aria-hidden />
        </button>
        <div className="flex items-center gap-3" style={{ paddingRight: 48 }}>
          <span
            aria-hidden
            style={{
              width: 48, height: 48, borderRadius: 15, flexShrink: 0,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              background: 'linear-gradient(150deg, rgba(61,122,82,0.26), rgba(61,122,82,0.09))',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.8)',
            }}
          >
            <Emoji3D name="Gear" size={30} fallback={Settings} fallbackColor="#1B3828" />
          </span>
          <h2 id="gv-cs-title" style={{ margin: 0, fontFamily: OUTFIT, fontWeight: 800, fontSize: 'clamp(24px, 2.4vw, 30px)', letterSpacing: '-0.02em', lineHeight: 1.1, color: '#1C1410' }}>
            Session <GoldWord>Release</GoldWord>
          </h2>
        </div>
        {children}
      </div>
    </ModalOverlay>
  );
}

/** The button beside the filters that opens the sheet: a little bigger than them. */
export function CommitteeSettingsButton({ onClick, open }: { onClick: () => void; open: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-haspopup="dialog"
      aria-expanded={open}
      className="gv-lift inline-flex items-center gap-2 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      style={{
        minHeight: 48,
        padding: '0 20px 0 14px',
        borderRadius: 9999,
        border: '1px solid rgba(221,212,192,0.85)',
        background: '#FFFFFF',
        color: '#1B3828',
        boxShadow: '0 6px 20px rgba(27,56,40,0.09)',
        fontFamily: OUTFIT,
        fontSize: 15,
        fontWeight: 700,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      <Emoji3D name="Gear" size={24} fallback={Settings} fallbackColor="#1B3828" />
      Settings
    </button>
  );
}
