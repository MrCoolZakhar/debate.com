'use client';

// ── NotificationStack ──────────────────────────────────────────────────────
//
// The chair-facing notification surface: tinted liquid-glass cards stacked at
// the TOP-LEFT of the viewport. Renderer only — every rule about what appears,
// how long it lives and what may coexist lives in `@/lib/sessionNotifications`.
//
// Mount ONE of these per surface. It owns the single interval that advances
// every TTL, so a second mounted host would double-speed every countdown.
//
// Positioning note: portaled through `@/components/Portal`, which mounts into
// `#fit-root` when one exists. On the chair page that node carries a CSS
// `transform`, which makes it the containing block for `position: fixed` — so
// these coordinates are in the scaled frame, not raw viewport pixels. That is
// correct and intended here: the stack should scale with the cockpit it
// belongs to, unlike a popover that must align to a real on-screen trigger.

import { useEffect, useState } from 'react';
import { Check, X, Hand, MessageCircle, Megaphone, Info } from 'lucide-react';
import Portal from '@/components/Portal';
import { getFlagUrl } from '@/lib/countries';
import {
  useNotifications, dismiss, setPending, tickNotifications,
  type NotificationKind, type NotificationTone,
} from '@/lib/sessionNotifications';

const OUTFIT = "'Outfit', sans-serif";
const EASE = 'cubic-bezier(0.22,1,0.36,1)';
const TICK_MS = 250;
const MAX_VISIBLE = 4;

const KIND_ICON: Record<NotificationKind, typeof Hand> = {
  'gsl-request': Hand,
  chat: MessageCircle,
  broadcast: Megaphone,
  motion: Info,
  info: Info,
};

const TONE: Record<NotificationTone, { bg: string; fg: string; border: string }> = {
  accept: { bg: 'rgba(61,122,82,0.92)', fg: '#FFFFFF', border: 'rgba(255,255,255,0.28)' },
  reject: { bg: 'rgba(139,32,32,0.86)', fg: '#FFFFFF', border: 'rgba(255,255,255,0.24)' },
  neutral: { bg: 'rgba(255,255,255,0.16)', fg: '#F3EFE3', border: 'rgba(255,255,255,0.28)' },
};

export default function NotificationStack() {
  const { items, suppressed } = useNotifications();
  /* Value is never read — the state exists only to re-render the progress
     hairlines each tick. The authoritative countdown lives in the store. */
  const [, bumpTick] = useState(0);

  /* One interval for the whole stack; a second mounted host would advance
     every TTL at double speed. */
  useEffect(() => {
    const id = setInterval(() => {
      tickNotifications(TICK_MS);
      bumpTick((n) => n + 1);
    }, TICK_MS);
    return () => clearInterval(id);
  }, []);

  if (suppressed || items.length === 0) return null;
  const visible = items.slice(0, MAX_VISIBLE);
  const overflow = items.length - visible.length;

  return (
    <Portal>
      <style>{`
        @keyframes dgn-in {
          from { opacity: 0; transform: translateX(-14px) scale(0.97) }
          to   { opacity: 1; transform: none }
        }
        .dgn-card { animation: dgn-in 260ms ${EASE} both }
        .dgn-act { transition: transform 120ms ${EASE}, filter 120ms ${EASE} }
        .dgn-act:active { transform: scale(0.96) }
        .dgn-act:disabled { opacity: 0.55; cursor: progress }
        @media (prefers-reduced-motion: reduce) {
          .dgn-card { animation: none }
          .dgn-act { transition: none }
        }
      `}</style>

      <div
        aria-live="polite"
        style={{
          position: 'fixed', top: 14, insetInlineStart: 14, zIndex: 900,
          display: 'flex', flexDirection: 'column', gap: 10,
          width: 'min(330px, calc(100vw - 28px))', pointerEvents: 'none',
        }}
      >
        {visible.map((n) => {
          const Icon = KIND_ICON[n.kind];
          const pct = n.ttlMs == null ? 0 : Math.min(1, n.elapsedMs / n.ttlMs);
          return (
            <div
              key={n.key}
              className="dgn-card"
              role={n.actions?.length ? 'group' : undefined}
              style={{
                pointerEvents: 'auto', position: 'relative', overflow: 'hidden',
                borderRadius: 18, padding: '11px 12px 12px',
                /* Tinted liquid glass: a forest wash over whatever is behind,
                   blurred and saturated so the tint reads as glass rather than
                   as a flat scrim, with a bright top hairline for the lit edge
                   and a dark ambient below to seat it. */
                background: 'linear-gradient(180deg, rgba(27,56,40,0.82), rgba(18,40,28,0.88))',
                backdropFilter: 'blur(18px) saturate(1.5)',
                WebkitBackdropFilter: 'blur(18px) saturate(1.5)',
                border: '1px solid rgba(255,255,255,0.16)',
                boxShadow:
                  'inset 0 1px 0 rgba(255,255,255,0.20), 0 12px 32px rgba(12,24,18,0.42)',
                color: '#F3EFE3',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                {n.flagCode ? (
                  <img
                    src={getFlagUrl(n.flagCode)}
                    alt=""
                    aria-hidden="true"
                    style={{
                      width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                      objectFit: 'cover', outline: '1px solid rgba(255,255,255,0.22)',
                      outlineOffset: -1,
                    }}
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    style={{
                      width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                      display: 'grid', placeItems: 'center',
                      background: 'rgba(238,217,138,0.18)', color: '#EED98A',
                    }}
                  >
                    <Icon size={16} strokeWidth={2.4} />
                  </span>
                )}

                <div style={{ minWidth: 0, flex: 1 }}>
                  <p
                    style={{
                      margin: 0, fontFamily: OUTFIT, fontSize: 13.5, fontWeight: 800,
                      lineHeight: 1.25, color: '#FFFFFF',
                    }}
                  >
                    {n.title}
                  </p>
                  {n.body && (
                    <p
                      style={{
                        margin: '2px 0 0', fontFamily: OUTFIT, fontSize: 11.5,
                        fontWeight: 500, lineHeight: 1.3, color: 'rgba(243,239,227,0.76)',
                      }}
                    >
                      {n.body}
                    </p>
                  )}
                </div>

                {!n.actions?.length && (
                  <button
                    type="button"
                    onClick={() => dismiss(n.key)}
                    aria-label="Dismiss"
                    className="dgn-act"
                    style={{
                      flexShrink: 0, width: 26, height: 26, borderRadius: 999,
                      border: 'none', cursor: 'pointer', display: 'grid', placeItems: 'center',
                      background: 'rgba(255,255,255,0.12)', color: '#F3EFE3',
                    }}
                  >
                    <X size={13} strokeWidth={2.6} />
                  </button>
                )}
              </div>

              {!!n.actions?.length && (
                <div style={{ display: 'flex', gap: 7, marginTop: 10 }}>
                  {n.actions.map((a) => {
                    const tone = TONE[a.tone];
                    const busy = !!n.pending;
                    return (
                      <button
                        key={a.id}
                        type="button"
                        disabled={busy}
                        className="dgn-act"
                        onClick={async () => {
                          setPending(n.key, a.id);
                          try {
                            await a.run();
                          } finally {
                            /* Dismiss regardless: the action either succeeded,
                               or it failed and its own error path owns telling
                               the chair. Leaving a dead card that reruns a DB
                               write on a second click is worse. */
                            dismiss(n.key);
                          }
                        }}
                        style={{
                          flex: 1, minHeight: 34, borderRadius: 11, cursor: busy ? 'progress' : 'pointer',
                          background: tone.bg, color: tone.fg,
                          border: `1px solid ${tone.border}`,
                          fontFamily: OUTFIT, fontSize: 12, fontWeight: 800,
                          letterSpacing: '0.02em',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                        }}
                      >
                        {a.tone === 'accept' && <Check size={13} strokeWidth={3} />}
                        {a.tone === 'reject' && <X size={13} strokeWidth={3} />}
                        {a.label}
                      </button>
                    );
                  })}
                </div>
              )}

              {n.ttlMs != null && (
                /* Hairline countdown — tells the chair the card is going to
                   leave on its own, so an unanswered request does not read as
                   a thing they failed to clear. */
                <span
                  aria-hidden="true"
                  style={{
                    position: 'absolute', insetInlineStart: 0, bottom: 0, height: 2,
                    width: `${(1 - pct) * 100}%`,
                    background: 'linear-gradient(90deg, rgba(238,217,138,0.85), rgba(238,217,138,0.35))',
                  }}
                />
              )}
            </div>
          );
        })}

        {overflow > 0 && (
          <p
            style={{
              margin: 0, fontFamily: OUTFIT, fontSize: 11, fontWeight: 700,
              color: 'rgba(27,56,40,0.62)', paddingInlineStart: 6,
            }}
          >
            +{overflow} more
          </p>
        )}
      </div>
    </Portal>
  );
}
