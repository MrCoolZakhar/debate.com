'use client';

import { useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import GrowDialog from '@/components/GrowDialog';
import { useT } from '@/contexts/LanguageContext';
import { CHAT } from './chatTokens';

/**
 * The chair's chat, as a dialog that grows out of the chat icon in the top bar, exactly like
 * Motions, Documents and the scoreboard (GrowDialog).
 *
 * Performance: the panel is a lightweight shell (list header and thread canvas colours) for
 * the few hundred ms of the grow, and the chat itself mounts the moment the motion has
 * ended. A committee can have forty delegations, each a round flag image, plus a long
 * thread; mounting that inside the animation rasterised the whole layer mid-motion.
 * Nothing waits on the network: the chat renders from the committee already in memory.
 *
 * Close: a lightbox-style round button OUTSIDE the panel, just above its top-end corner
 * (not in the list header next to the group `+`). The panel's height leaves at least 56 px
 * above it for the button, so it never overlaps the chat or leaves the screen.
 */
export default function ChatDialog({
  onClose,
  children,
}: {
  onClose: () => void;
  /** Receives the animated close, for the panel's own close button. */
  children: (requestClose: () => void) => ReactNode;
}) {
  const t = useT();
  const [opened, setOpened] = useState(false);
  return (
    <GrowDialog
      originSelector='[data-tutorial="tab-chat"]'
      onClose={onClose}
      onOpened={() => setOpened(true)}
      ariaLabel={t('tab_chat')}
      panelClassName="w-full max-w-5xl flex"
      panelStyle={{
        height: 'min(86%, calc(100% - 112px))',
        marginTop: 40,
        borderRadius: 26,
        backgroundColor: 'var(--gv-surface, #FAF8F3)',
        boxShadow: '0 0 0 0.5px rgba(27,56,40,0.18), 0 24px 70px -12px rgba(5,8,20,0.55)',
      }}
      backdropStyle={{ background: 'rgba(5, 8, 20, 0.62)' }}
    >
      {(requestClose) => (
        <>
          <button
            type="button"
            onClick={requestClose}
            aria-label={t('chat_close')}
            title={t('chat_close')}
            className="absolute inline-flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EED98A] hover:bg-[rgba(255,253,248,0.28)] active:scale-[0.96]"
            style={{
              top: -52, insetInlineEnd: 0, width: 42, height: 42, borderRadius: 999, border: 'none', cursor: 'pointer',
              background: 'rgba(255,253,248,0.16)', color: '#FFFDF8',
              boxShadow: 'inset 0 0 0 1px rgba(255,253,248,0.28)',
              transitionProperty: 'background-color, transform', transitionDuration: '150ms',
            }}
          >
            <X size={22} strokeWidth={2.4} aria-hidden />
          </button>
          {/* The panel itself cannot clip (the close button sits outside it), so the rounding lives here. */}
          <div className="flex w-full h-full overflow-hidden" style={{ borderRadius: 26 }}>
            {opened ? children(requestClose) : (
              <div className="flex w-full h-full" aria-hidden>
                <div style={{ width: 'clamp(280px, 34%, 360px)', background: CHAT.bar, boxShadow: `inset -1px 0 0 ${CHAT.hairline}` }} />
                <div className="flex-1 flex flex-col">
                  <div style={{ height: 64, background: CHAT.bar, boxShadow: CHAT.barShadow }} />
                  <div className="flex-1" style={{ background: CHAT.canvas }} />
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </GrowDialog>
  );
}
