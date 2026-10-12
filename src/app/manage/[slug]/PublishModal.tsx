'use client';

// PublishModal — "Publish Your Conference?" (moved out of the dashboard in
// prompt 106, unchanged in behaviour). Mounted by the manage header's Publish
// button and by the dashboard checklist's "Publish your conference" row. It
// writes is_public true and status 'public' as a verified write (exactly one
// row) and pings IndexNow. Dates to be decided do not block it (12 Oct 2026).

import { useState } from 'react';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { friendlyError } from '@/lib/friendlyError';
import { NEU, OUTFIT } from '@/components/neu';
import Portal from '@/components/Portal';
import { useScrollLock } from '@/hooks/useScrollLock';

const RED = '#A8442F';

export default function PublishModal({
  conference,
  onClose,
  onPublished,
}: {
  conference: { id: string; slug: string; full_name: string; dates_tbd: boolean; start_date: string | null };
  onClose: () => void;
  onPublished: () => void;
}) {
  // Modal: freeze the dashboard behind it.
  useScrollLock(true);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState('');

  // Dates to be decided no longer block publishing (owner, 12 Oct 2026):
  // Explore lists such a conference under "Dates to Be Decided". Until the
  // CHECK conferences_tbd_not_public is dropped (scratch-tbd-public.sql) the
  // write is refused and friendlyError shows CONSTRAINT_MESSAGES' sentence.

  async function handlePublish() {
    setPublishing(true);
    setPublishError('');
    const supabase = await getFreshAuthedClient();
    if (!supabase) {
      setPublishing(false);
      setPublishError('Your session has expired. Please refresh the page and sign in again.');
      return;
    }
    const { data, error } = await supabase
      .from('conferences')
      .update({ is_public: true, status: 'public' })
      .eq('id', conference.id)
      .select('id');
    if (error || !data || data.length !== 1) {
      setPublishing(false);
      setPublishError(error
        ? friendlyError(error, "Couldn't publish your conference. Please try again.")
        : "Couldn't publish your conference. Please refresh and try again.");
      return;
    }
    // Fire-and-forget: ping search engines (IndexNow) so the newly public
    // conference page gets crawled right away.
    void fetch('/api/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: conference.slug }),
    }).catch(() => {});
    setPublishing(false);
    onPublished();
  }

  return (
    <Portal><div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl p-8"
        style={{ backgroundColor: NEU.surface, boxShadow: NEU.out }}
        onClick={(e) => e.stopPropagation()}
      >
          <>
            <h2 className="font-black text-xl mb-2" style={{ color: NEU.ink, fontFamily: OUTFIT }}>
              Publish Your Conference?
            </h2>
            <p className="text-sm mb-6" style={{ color: NEU.muted, fontFamily: OUTFIT }}>
              Your conference will appear publicly on gavelling.com/conferences/explore and delegates will be able to apply.
            </p>
            {publishError && (
              <p className="text-sm mb-4" style={{ color: RED, fontFamily: OUTFIT }}>{publishError}</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 rounded-xl py-2.5 font-bold text-sm transition-colors focus:outline-none gv-lift"
                style={{ border: '1.5px solid #DDD4C0', color: NEU.ink, backgroundColor: 'transparent', fontFamily: OUTFIT }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#1B3828'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#DDD4C0'; }}
              >
                Cancel
              </button>
              <button
                onClick={handlePublish}
                disabled={publishing}
                className="flex-1 rounded-xl py-2.5 font-bold text-sm transition-colors focus:outline-none gv-lift"
                style={{
                  backgroundColor: publishing ? '#DDD4C0' : '#1B3828',
                  color: publishing ? NEU.muted : NEU.gold,
                  fontFamily: OUTFIT,
                }}
                onMouseEnter={(e) => { if (!publishing) (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
                onMouseLeave={(e) => { if (!publishing) (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
              >
                {publishing ? 'Publishing…' : 'Publish now'}
              </button>
            </div>
          </>
      </div>
    </div></Portal>
  );
}
