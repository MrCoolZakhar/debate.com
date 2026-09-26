'use client';

/**
 * "Live now" in the profile menu (ProfileDropdown): every conference room of this
 * account that is live right now, the same entries and the same destinations as
 * the pop-up (LiveRoomsGate), so dismissing the pop-up never loses the way in.
 * A faculty advisor's rooms are ONE row per conference, to the advisor board.
 * Renders nothing while there is none. Re-reads `my_live_rooms()` when the menu
 * opens and the cached answer is more than a minute old.
 */

import { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useT } from '@/contexts/LanguageContext';
import { chairIdentity, liveEntryHref, resolveEntryHref, useLiveRooms } from '@/lib/liveRooms';
import { EntryMark, LR, actionLabel, entryLines } from './LiveRoomsDialog';

export default function LiveNowMenuSection({ onNavigate }: { onNavigate: () => void }) {
  const t = useT();
  const { user, session, profile, loading } = useAuth();
  const { entries } = useLiveRooms(loading ? null : user?.id ?? null, session?.access_token ?? null, { maxAgeMs: 60_000 });
  const [busy, setBusy] = useState<string | null>(null);
  if (!entries || entries.length === 0) return null;

  return (
    <>
      <div className="pt-2.5 pb-1.5" style={{ fontFamily: LR.font, backgroundColor: 'rgba(61,122,82,0.06)' }}>
        <p className="px-4 pb-1.5 flex items-center gap-1.5 font-bold" style={{ color: '#2A5A3C', fontSize: 10, letterSpacing: '0.08em' }}>
          <span aria-hidden className="inline-block rounded-full" style={{ width: 7, height: 7, backgroundColor: '#2F9A5A', boxShadow: '0 0 0 3px rgba(47,154,90,0.18)' }} />
          {t('srp_menu_title').toUpperCase()}
        </p>
        {entries.slice(0, 5).map((e) => {
          const { title, sub } = entryLines(e, t);
          return (
            <div key={e.key} className="flex items-center gap-2.5 px-4 py-1.5">
              <EntryMark item={e} size={28} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold" style={{ color: LR.ink, fontSize: 12.5, lineHeight: 1.25 }}>{title}</p>
                <p className="truncate" title={sub} style={{ color: LR.inkSoft, fontSize: 11, lineHeight: 1.3 }}>{sub}</p>
              </div>
              <a
                href={liveEntryHref(e)}
                onClick={async (ev) => {
                  // Same walk-in as the pop-up. A modified click (new tab) keeps the plain href.
                  // A chair keeps the plain href too: /join?mode=chair asks "Moderator or
                  // Commenter?" first (the menu has no room for the two cards).
                  if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button !== 0 || e.role === 'chair') { onNavigate(); return; }
                  ev.preventDefault();
                  setBusy(e.key);
                  const href = await resolveEntryHref(e, {
                    accessToken: session?.access_token ?? null,
                    chairName: chairIdentity(profile?.display_name, user?.email),
                  });
                  onNavigate();
                  window.location.href = href;
                }}
                aria-label={`${actionLabel(e, t, true)}: ${title}`}
                className="shrink-0 inline-flex items-center rounded-lg font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] transition-[filter] hover:brightness-110"
                style={{ backgroundColor: LR.forest, color: LR.gold, fontSize: 11.5, padding: '6px 10px', textDecoration: 'none', whiteSpace: 'nowrap' }}
              >
                {busy === e.key ? t('srp_entering') : actionLabel(e, t, false)}
              </a>
            </div>
          );
        })}
      </div>
      <div style={{ height: '1px', backgroundColor: '#DDD4C0' }} />
    </>
  );
}
