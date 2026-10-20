'use client';

// /files/study-guide/<study_guides.id> (20 Oct 2026): the stable Gavelling link
// a builder email carries for a study guide (src/components/email/
// ConferenceFilesPanel.tsx). The `study-guides` bucket is private, so a stored
// public URL no longer opens; this page reads the guide's row with the
// viewer's own client (RLS decides: released guides for seated delegates,
// chairs, delegation members, organisers), mints a short signed URL and
// replaces itself with it. Signed out, it opens the sign-in pop-up and carries
// on once the user is known. Noindex through NOINDEX_ROUTES (`/files/:path*`);
// rendering has no side effect, so robots leaves it crawlable.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { openAuth } from '@/lib/authModal';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { signedStudyGuideUrl } from '@/lib/studyGuideFiles';

const FONT = 'var(--font-brand), sans-serif';
const INK = '#1C1410';
const INK_SOFT = '#5C4A3A';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type View = 'working' | 'signin' | 'unavailable' | 'failed';

export default function StudyGuideFilePage() {
  const params = useParams<{ id: string }>();
  const id = typeof params?.id === 'string' ? params.id : '';
  const { user, loading } = useAuth();
  const userId = user?.id ?? null;
  const [view, setView] = useState<View>('working');

  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    if (!userId) {
      void Promise.resolve().then(() => {
        if (cancelled) return;
        setView('signin');
        openAuth({ next: `/files/study-guide/${id}`, notice: 'Sign in to open this study guide' });
      });
      return () => { cancelled = true; };
    }
    void (async () => {
      if (!UUID.test(id)) { setView('unavailable'); return; }
      const client = await getFreshAuthedClient();
      if (cancelled) return;
      if (!client) { setView('failed'); return; }
      const { data, error } = await client.from('study_guides').select('id, file_url').eq('id', id).maybeSingle();
      if (cancelled) return;
      if (error) { setView('failed'); return; }
      if (!data) { setView('unavailable'); return; }
      const url = await signedStudyGuideUrl(client, (data as { file_url: string | null }).file_url, 10 * 60);
      if (cancelled) return;
      if (!url) { setView('failed'); return; }
      window.location.replace(url);
    })();
    return () => { cancelled = true; };
  }, [id, userId, loading]);

  // Signed in from the pop-up: work again until the read answers.
  const shown: View = userId && view === 'signin' ? 'working' : view;

  return (
    <main style={{ minHeight: '100vh', background: '#EDE7D8', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 16px', fontFamily: FONT }}>
      <div style={{ width: '100%', maxWidth: 460, background: '#FFFFFF', borderRadius: 20, padding: '28px 26px', boxShadow: '0 10px 30px rgba(27,56,40,0.10)' }}>
        {shown === 'working' && (
          <div aria-busy="true" aria-label="Opening the study guide">
            <div style={{ height: 22, width: '60%', borderRadius: 8, background: '#F0EBDD', marginBottom: 14 }} />
            <div style={{ height: 14, width: '90%', borderRadius: 6, background: '#F0EBDD', marginBottom: 8 }} />
            <div style={{ height: 14, width: '70%', borderRadius: 6, background: '#F0EBDD' }} />
          </div>
        )}
        {shown === 'signin' && (
          <>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: INK }}>Study Guide</h1>
            <p style={{ margin: '10px 0 18px', fontSize: 15, lineHeight: 1.5, color: INK_SOFT }}>Sign in to open this study guide</p>
            <button
              type="button"
              onClick={() => openAuth({ next: `/files/study-guide/${id}`, notice: 'Sign in to open this study guide' })}
              className="focus:outline-none"
              style={{ border: 'none', borderRadius: 12, padding: '12px 20px', fontFamily: FONT, fontSize: 15, fontWeight: 600, color: '#FFFFFF', background: 'linear-gradient(180deg, #24493A 0%, #1B3828 100%)', cursor: 'pointer' }}
            >
              Sign in
            </button>
          </>
        )}
        {(shown === 'unavailable' || shown === 'failed') && (
          <>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: INK }}>Study Guide</h1>
            <p style={{ margin: '10px 0 18px', fontSize: 15, lineHeight: 1.5, color: INK_SOFT }}>
              {shown === 'unavailable'
                ? "This study guide isn't available to you yet. It opens on its release date, or once you have a seat in its committee."
                : "This file can't be opened right now"}
            </p>
            <Link href="/" className="focus:outline-none" style={{ fontWeight: 700, textDecoration: 'underline', color: INK, fontSize: 15 }}>
              Go to Gavelling
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
