'use client';

// ─────────────────────────────────────────────────────────────────────────────
// TOKENS THAT COME TO YOU.
//
// The Details rail is still there, but a rail is a place you have to go. This
// is the other half: while you write, the tokens float up next to the caret.
//
// Two modes, one layer, so they can never both be on screen at once:
//
//   TYPEAHEAD  you typed `{{`. Everything after it filters the list. Enter or
//              a click drops the pill in and eats the `{{query` you typed.
//              Escape closes it and leaves your text exactly as it was.
//   NUDGE      you typed something a token obviously belongs after ("Hi ",
//              "your committee", "the fee"). Up to three chips appear under
//              the caret. They never steal a keystroke: no Enter binding, no
//              focus change, and an ✕ that turns nudges off for the session.
//
// It is caret-anchored rather than block-anchored on purpose. A panel hinged
// to the bottom of a five-line paragraph is nowhere near the word you are
// writing, and on the last block it would hang off the sheet.
//
// The layer is FIXED-positioned through a Portal and clamped to the viewport,
// the house rule for floating layers (AGENTS.md, UI RULES): no ancestor's
// overflow can clip it, and it flips above the caret when the room below runs
// out.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import Portal from '@/components/Portal';
import { Emoji3D, NEU, OUTFIT, EASE } from '@/components/neu';
import { SOFT, CARD_BORDER, CARD_SHADOW } from '@/app/manage/[slug]/live/tokens';
import { EMAIL_TOKEN_KEYS, type EmailTokenKey } from '@/lib/emailTokens';
import { tokenIdentity, tokenShort, tokenLabel, matchTokens } from './tokenKit';

const FOREST = '#1B3828';
const INK = '#1C1410';

/** Keep-off-the-edge inset, and the gap between the caret and the layer. */
const MARGIN = 8;
const GAP = 8;

export interface CaretRect { left: number; top: number; bottom: number }

export interface SuggestState {
  mode: 'typeahead' | 'nudge';
  /** Which surface the caret is in, a block id, or 'subject'. */
  target: string;
  query: string;
  rect: CaretRect;
  /** NUDGE only: the tokens worth offering, already filtered by the caller. */
  keys?: EmailTokenKey[];
}

// ── What a token is worth suggesting after ───────────────────────────────────
// Deliberately conservative: every rule is anchored to the END of what has
// been typed, so a nudge only ever appears where the next word would go. A
// token already present in the same block is never suggested again.

const NUDGE_RULES: { re: RegExp; keys: EmailTokenKey[] }[] = [
  { re: /\b(hi|hello|hey|dear|greetings)[\s,]*$/i, keys: ['delegate_name'] },
  { re: /\b(committee|allocated|allocation|assigned)\s*(to|in)?\s*$/i, keys: ['committee', 'country'] },
  { re: /\b(country|delegation|represent|representing|school)\s*$/i, keys: ['country', 'delegation_name'] },
  { re: /\b(fee|fees|pay|payment|invoice|cost|owe|owes|balance)\s*(of|is)?\s*$/i, keys: ['fee', 'payment_status'] },
  { re: /\b(code|session|room|join|joining)\s*(is|code)?\s*$/i, keys: ['session_code'] },
  { re: /\b(dates?|runs|schedule|takes place|happening)\s*(on|from)?\s*$/i, keys: ['conference_dates'] },
  { re: /\b(conference|event|welcome to)\s*$/i, keys: ['conference_name'] },
  { re: /\b(role|you are|you're)\s*(a|an|the)?\s*$/i, keys: ['role'] },
];

/** Tokens worth offering for the text the caret sits at the end of, minus
 *  anything the block already carries. Empty array means: say nothing. */
export function nudgeKeysFor(textBeforeCaret: string, wholeBlock: string): EmailTokenKey[] {
  const tail = textBeforeCaret.slice(-48);
  if (!tail.trim()) return [];
  for (const rule of NUDGE_RULES) {
    if (!rule.re.test(tail)) continue;
    const fresh = rule.keys.filter(k => !wholeBlock.includes(`{{${k}}}`));
    if (fresh.length > 0) return fresh.slice(0, 3);
  }
  return [];
}

/** Matches `{{` plus any word characters typed since, at the caret. */
export const TYPEAHEAD_TRIGGER = /\{\{(\w*)$/;

export default function TokenSuggest({
  state, onPick, onClose, onSilenceNudges,
}: {
  state: SuggestState;
  onPick: (key: EmailTokenKey) => void;
  onClose: () => void;
  /** NUDGE only: "stop offering these" for the rest of the session. */
  onSilenceNudges: () => void;
}) {
  const layerRef = useRef<HTMLDivElement | null>(null);

  const keys: EmailTokenKey[] = useMemo(
    () => (state.mode === 'nudge' ? (state.keys ?? []) : matchTokens(state.query, EMAIL_TOKEN_KEYS).slice(0, 7)),
    [state.mode, state.keys, state.query]
  );

  // The highlighted row is stamped with the list it belongs to, so a new query
  // resets it DURING RENDER rather than in an effect that would fire a second
  // render every keystroke (and trip react-hooks/set-state-in-effect).
  const [highlight, setHighlight] = useState({ q: state.query, m: state.mode, i: 0 });
  const sameList = highlight.q === state.query && highlight.m === state.mode;
  const active = sameList ? Math.min(highlight.i, Math.max(0, keys.length - 1)) : 0;
  const moveActive = useCallback(
    (next: (from: number) => number) => setHighlight(h => {
      const from = (h.q === state.query && h.m === state.mode) ? h.i : 0;
      return { q: state.query, m: state.mode, i: next(from) };
    }),
    [state.query, state.mode]
  );

  const width = state.mode === 'nudge' ? 'auto' : 264;

  const place = useCallback(() => {
    const layer = layerRef.current;
    if (!layer) return;
    const h = layer.offsetHeight;
    const w = layer.offsetWidth;
    const below = window.innerHeight - state.rect.bottom - GAP - MARGIN;
    const up = below < h && state.rect.top - GAP - MARGIN > below;
    layer.style.left = `${Math.round(Math.max(MARGIN, Math.min(state.rect.left, window.innerWidth - w - MARGIN)))}px`;
    layer.style.top = up
      ? `${Math.round(Math.max(MARGIN, state.rect.top - GAP - h))}px`
      : `${Math.round(state.rect.bottom + GAP)}px`;
    layer.style.visibility = 'visible';
  }, [state.rect]);

  /** Placement runs the moment the node ATTACHES, not from an effect. `Portal`
   *  renders null on its first pass (it resolves its mount target in its own
   *  effect), so by the time an effect here fires the layer does not exist,
   *  it would measure nothing and stay hidden at 0,0 forever. Same reason, and
   *  the same fix, as PopoverLayer. */
  const attachLayer = useCallback((el: HTMLDivElement | null) => {
    layerRef.current = el;
    if (el) place();
  }, [place]);

  useLayoutEffect(() => { place(); }, [place, state.query, state.mode, keys.length]);

  // ── The keyboard handler reads REFS, not its own closure ───────────────────
  // It lives on `document` in the capture phase, so it can fire between a
  // keystroke's state update and the passive effect that would re-register it.
  // Closing over `onPick` meant the very first Enter after typing a query ran
  // the PREVIOUS render's callback and did nothing at all; you had to press
  // Enter twice. These refs are written in a LAYOUT effect, which React
  // flushes synchronously during commit, so by the time any later event is
  // dispatched they are already the committed values.
  const onPickRef = useRef(onPick);
  const keysRef = useRef(keys);
  const activeRef = useRef(active);
  const modeRef = useRef(state.mode);
  useLayoutEffect(() => {
    onPickRef.current = onPick;
    keysRef.current = keys;
    activeRef.current = active;
    modeRef.current = state.mode;
  });

  // ARROW KEYS ARE TYPEAHEAD-ONLY. A nudge is an offer, not a prompt, so it
  // must never intercept a keystroke meant for the paragraph, including
  // Enter, which in a paragraph inserts a line break.
  useEffect(() => {
    // preventDefault ALONE IS NOT ENOUGH. This listener is on `document` in the
    // capture phase, and React's own handlers sit on the root in the bubble
    // phase, so an Enter swallowed here still reached the paragraph editor,
    // which inserts a line break on Enter, and every accepted suggestion
    // landed with a stray newline stapled to it. Propagation has to be stopped
    // as well as the default suppressed.
    const claim = (e: KeyboardEvent) => { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); };
    const onKey = (e: KeyboardEvent) => {
      if (modeRef.current !== 'typeahead') return;
      if (e.key === 'Escape') { claim(e); onClose(); return; }
      const list = keysRef.current;
      if (list.length === 0) return;
      if (e.key === 'ArrowDown') { claim(e); moveActive(i => (i + 1) % list.length); return; }
      if (e.key === 'ArrowUp') { claim(e); moveActive(i => (i - 1 + list.length) % list.length); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { claim(e); onPickRef.current(list[Math.min(activeRef.current, list.length - 1)]); }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose, moveActive]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (layerRef.current?.contains(e.target as Node)) return;
      onClose();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [onClose]);

  if (keys.length === 0) return null;

  return (
    <Portal>
      <div
        ref={attachLayer}
        role="listbox"
        aria-label={state.mode === 'nudge' ? 'Suggested details' : 'Insert a detail'}
        style={{
          position: 'fixed', left: 0, top: 0, width, zIndex: 210, visibility: 'hidden',
          borderRadius: 16,
          backgroundColor: NEU.surface,
          border: CARD_BORDER,
          boxShadow: CARD_SHADOW,
          overflow: 'hidden',
        }}
      >
        {state.mode === 'nudge' ? (
          <div className="flex items-center gap-1.5" style={{ padding: 6 }}>
            <span className="flex-shrink-0" style={{ fontFamily: OUTFIT, fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', color: SOFT, paddingLeft: 5 }}>
              ADD
            </span>
            {keys.map(k => (
              <TokenChipButton key={k} tokenKey={k} onPick={onPick} />
            ))}
            <button
              type="button"
              title="Stop suggesting these"
              aria-label="Stop suggesting these"
              onMouseDown={e => e.preventDefault()}
              onClick={onSilenceNudges}
              className="inline-flex items-center justify-center focus:outline-none flex-shrink-0"
              style={{ width: 28, height: 28, borderRadius: 999, border: 'none', background: 'transparent', color: SOFT, cursor: 'pointer' }}
            >
              <X size={12} strokeWidth={2.6} />
            </button>
          </div>
        ) : (
          <div style={{ maxHeight: 292, overflowY: 'auto', padding: 5 }}>
            {keys.map((k, i) => {
              const id = tokenIdentity(k);
              const on = i === active;
              return (
                <button
                  key={k}
                  type="button"
                  role="option"
                  aria-selected={on}
                  onMouseEnter={() => moveActive(() => i)}
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => onPick(k)}
                  className="w-full flex items-center gap-2.5 text-left focus:outline-none"
                  style={{
                    minHeight: 40, padding: '7px 9px', borderRadius: 12,
                    border: 'none', cursor: 'pointer',
                    backgroundColor: on ? 'rgba(27,56,40,0.07)' : 'transparent',
                    transitionProperty: 'background-color',
                    transitionDuration: '140ms',
                    transitionTimingFunction: EASE,
                  }}
                >
                  <Emoji3D name={id.emoji} size={18} fallback={id.icon} fallbackColor={FOREST} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate" style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 800, color: INK }}>
                      {tokenShort(k)}
                    </span>
                    <span className="block truncate" style={{ fontFamily: OUTFIT, fontSize: 10.5, color: SOFT }}>
                      {tokenLabel(k)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </Portal>
  );
}

function TokenChipButton({ tokenKey, onPick }: { tokenKey: EmailTokenKey; onPick: (k: EmailTokenKey) => void }) {
  const id = tokenIdentity(tokenKey);
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      title={id.becomes}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onMouseDown={e => e.preventDefault()}
      onClick={() => onPick(tokenKey)}
      className="inline-flex items-center gap-1.5 focus:outline-none flex-shrink-0"
      style={{
        minHeight: 30, padding: '5px 11px', borderRadius: 999,
        backgroundColor: hover ? 'rgba(238,217,138,0.72)' : 'rgba(238,217,138,0.42)',
        border: '1px solid rgba(27,56,40,0.20)',
        fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 800, color: FOREST,
        cursor: 'pointer', whiteSpace: 'nowrap',
        transitionProperty: 'background-color',
        transitionDuration: '160ms',
        transitionTimingFunction: EASE,
      }}
    >
      <Emoji3D name={id.emoji} size={14} fallback={id.icon} fallbackColor={FOREST} />
      {tokenShort(tokenKey)}
    </button>
  );
}
