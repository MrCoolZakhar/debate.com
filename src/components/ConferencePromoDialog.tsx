'use client';

/**
 * ConferencePromoDialog: a one-time invitation to Gavelling Conferences, shown to the chair of
 * a STANDALONE session during an unmoderated caucus, when the room is talking among itself and
 * the dais has a moment.
 *
 * When it may open (all of them, decided by the chair page through `eligible`, plus the
 * checks below):
 *  - the Moderator's device (never a Commenter), a session that is not conference-linked,
 *    phase `unmoderated-caucus` and NOT a Consultation of the Whole (the chair is running a
 *    floor there), not suspended, not ended;
 *  - the caucus clock has run for at least three minutes: `totalTime - caucusRemainingNow`,
 *    on the database clock (RULE 6b). An extension adds to both, so it never resets this;
 *  - nothing else is open: the chair page passes `blocked` for its own dialogs, and at check
 *    time any `[aria-modal="true"]` / `role=dialog|alertdialog` on the page also defers it;
 *  - never shown before for this session code on this device
 *    (`localStorage gavelling-conference-promo:<CODE>`, stamped the moment it opens, so a
 *    reload never brings it back). Blocked storage means it is simply never shown.
 *
 * Checked every 15 s by a timer that sets state exactly once (when it opens). No per-second
 * work, no committee state, no writes (RULES 3 to 5).
 *
 * The look (18 Sep 2026, owner: "way too AI generated. Use bigger sized headings and less
 * words"): ONE large heading, one short gold line, the two buttons. The benefit rows with
 * their icon tiles and the eyebrow are gone.
 *
 * The CTA opens the organiser landing (`/`, which leads with the secretariat path) in a NEW
 * tab, so the room underneath is untouched. Escape, the backdrop, the X and "Not now" close
 * it. GrowDialog supplies the focus trap, focus return and the reduced-motion fade.
 */
import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import GrowDialog from '@/components/GrowDialog';
import { useT } from '@/contexts/LanguageContext';
import { caucusRemainingNow } from '@/lib/committeeService';
import type { CaucusState } from '@/lib/types';

const CHECK_EVERY_MS = 15_000;
const SHOW_AFTER_SECONDS = 180;
const LANDING_HREF = '/';

const storageKey = (code: string) => `gavelling-conference-promo:${code.toUpperCase()}`;

function alreadyShown(code: string): boolean {
  try {
    return window.localStorage.getItem(storageKey(code)) !== null;
  } catch {
    return true; // storage unavailable: we could not keep the "once" promise, so never show it
  }
}

function markShown(code: string) {
  try { window.localStorage.setItem(storageKey(code), new Date().toISOString()); } catch { /* ignore */ }
}

function anotherDialogOpen(): boolean {
  return !!document.querySelector('[aria-modal="true"], [role="dialog"], [role="alertdialog"]');
}


const FOREST = '#1B3828';
const GOLD = '#EED98A';
const IVORY = '#EDE7D8';

export default function ConferencePromoDialog({
  code,
  caucus,
  eligible,
  blocked,
}: {
  code: string;
  caucus: CaucusState | null | undefined;
  /** Moderator device, standalone session, plain unmoderated caucus, not suspended or ended. */
  eligible: boolean;
  /** Another chair-page dialog is open right now. */
  blocked: boolean;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const caucusRef = useRef(caucus);
  const blockedRef = useRef(blocked);
  useEffect(() => {
    caucusRef.current = caucus;
    blockedRef.current = blocked;
  }, [caucus, blocked]);

  useEffect(() => {
    if (!eligible || open || !code) return;
    if (alreadyShown(code)) return;
    const check = () => {
      const c = caucusRef.current;
      if (!c || blockedRef.current || document.visibilityState !== 'visible') return;
      const elapsed = (c.totalTime ?? 0) - caucusRemainingNow(c);
      if (!(elapsed >= SHOW_AFTER_SECONDS)) return;
      if (anotherDialogOpen() || alreadyShown(code)) return;
      markShown(code);
      setOpen(true);
    };
    check();
    const id = setInterval(check, CHECK_EVERY_MS);
    // A background tab is never interrupted; it is checked again the moment it is shown.
    document.addEventListener('visibilitychange', check);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', check); };
  }, [eligible, open, code]);

  // The caucus ended, the room was suspended, or the gavel moved: take it down at once, for
  // good (it was already stamped as shown).
  // (Adjusting state during render is React's documented pattern for this; no effect.)
  if (open && !eligible) setOpen(false);
  if (!open || !eligible) return null;

  return (
    <GrowDialog
      originSelector=".floor-emblem-anchor"
      onClose={() => setOpen(false)}
      ariaLabel={t('promo_conf_label')}
      panelClassName="w-full max-w-[460px] rounded-[28px] overflow-hidden"
      panelStyle={{
        background: `linear-gradient(160deg, #24493A 0%, ${FOREST} 46%, #132A1E 100%)`,
        boxShadow: '0 1px 0 rgba(238,217,138,0.18) inset, 0 0 0 1px rgba(238,217,138,0.10) inset, 0 30px 70px -20px rgba(8,22,14,0.65), 0 10px 24px -12px rgba(8,22,14,0.45)',
        color: IVORY,
      }}
      backdropStyle={{ background: 'rgba(10, 24, 16, 0.58)' }}
    >
      {(close) => (
        <div className="relative px-8 pt-10 pb-7 sm:px-10 sm:pt-12">
          {/* The mark, large and faint, bleeding off the corner: the emblem that sits on the floor. */}
          <div
            aria-hidden
            className="pointer-events-none absolute -end-16 -top-14 h-64 w-64"
            style={{
              WebkitMaskImage: 'url(/gavelling-mark.png)', maskImage: 'url(/gavelling-mark.png)',
              WebkitMaskSize: '100% 100%', maskSize: '100% 100%',
              WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat',
              backgroundColor: 'rgba(238,217,138,0.08)',
            }}
          />
          <button
            type="button"
            onClick={close}
            aria-label={t('promo_conf_close')}
            className="absolute end-4 top-4 grid h-9 w-9 place-items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EED98A] hover:bg-white/10 active:scale-[0.96]"
            style={{ color: 'rgba(237,231,216,0.78)', transitionProperty: 'background-color, transform' }}
          >
            <X size={18} strokeWidth={2.25} />
          </button>

          <h2
            className="relative pe-6 text-[40px] font-black leading-[1.02] sm:text-[46px]"
            style={{ color: '#FBF7EC', letterSpacing: '-0.025em', textWrap: 'balance' } as React.CSSProperties}
          >
            {t('promo_conf_title')}
          </h2>
          <p className="relative mt-4 text-[16px] font-medium leading-snug" style={{ color: GOLD, textWrap: 'pretty' } as React.CSSProperties}>
            {t('promo_conf_body')}
          </p>

          <div className="relative mt-9 flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <a
              href={LANDING_HREF}
              target="_blank"
              rel="noopener"
              onClick={() => close()}
              className="inline-flex h-12 items-center justify-center rounded-2xl px-6 text-[15px] font-black focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FBF7EC] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1B3828] hover:brightness-[1.04] active:scale-[0.96]"
              style={{
                background: `linear-gradient(180deg, #F4E3A0 0%, ${GOLD} 100%)`,
                color: FOREST,
                boxShadow: '0 1px 0 rgba(255,255,255,0.45) inset, 0 8px 18px -8px rgba(238,217,138,0.45)',
                transitionProperty: 'filter, transform',
                transitionDuration: '150ms',
              }}
            >
              {t('promo_conf_cta')}
              <span className="sr-only"> ({t('promo_conf_new_tab')})</span>
            </a>
            <button
              type="button"
              onClick={close}
              className="h-12 rounded-2xl px-5 text-[15px] font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EED98A] hover:bg-white/10 active:scale-[0.96]"
              style={{ color: 'rgba(237,231,216,0.86)', transitionProperty: 'background-color, transform' }}
            >
              {t('promo_conf_later')}
            </button>
          </div>
        </div>
      )}
    </GrowDialog>
  );
}
