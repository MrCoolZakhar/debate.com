'use client';

// /files/application/<application id>/<question id> (8 Nov 2026): opens a file
// answer (question type file_upload). The bucket application-uploads is
// private, so this page reads the application with the viewer's own client
// (RLS: the applicant and that conference's organisers), takes the answer
// under the question id from custom_answers, else aid_custom_answers, checks
// it is a path inside that conference's folder, mints a 10-minute signed URL
// and replaces itself with it. Signed out, it opens the sign-in pop-up and
// carries on once the user is known. Noindex through NOINDEX_ROUTES
// (`/files/:path*`). Built like /files/study-guide/[id].

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { openAuth } from '@/lib/authModal';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { APPLICATION_UPLOADS_BUCKET } from '@/lib/applicationUploads';

const FONT = 'var(--font-brand), sans-serif';
const INK = '#1C1410';
const INK_SOFT = '#5C4A3A';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NOTICE = 'Sign in to open this file';

type View = 'working' | 'signin' | 'unavailable' | 'failed';

export default function ApplicationFilePage() {
  const params = useParams<{ applicationId: string; questionId: string }>();
  const applicationId = typeof params?.applicationId === 'string' ? params.applicationId : '';
  const questionId = typeof params?.questionId === 'string' ? decodeURIComponent(params.questionId) : '';
  const here = `/files/application/${applicationId}/${encodeURIComponent(questionId)}`;
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
        openAuth({ next: here, notice: NOTICE });
      });
      return () => { cancelled = true; };
    }
    void (async () => {
      if (!UUID.test(applicationId) || !questionId) { setView('unavailable'); return; }
      const client = await getFreshAuthedClient();
      if (cancelled) return;
      if (!client) { setView('failed'); return; }
      const { data, error } = await client.from('applications')
        .select('id, conference_id, custom_answers, aid_custom_answers')
        .eq('id', applicationId).maybeSingle();
      if (cancelled) return;
      if (error) { setView('failed'); return; }
      const row = data as { conference_id: string; custom_answers: Record<string, unknown> | null; aid_custom_answers: Record<string, unknown> | null } | null;
      if (!row) { setView('unavailable'); return; }
      const raw = row.custom_answers?.[questionId] ?? row.aid_custom_answers?.[questionId];
      if (typeof raw !== 'string' || !raw.startsWith(`${row.conference_id}/`)) { setView('unavailable'); return; }
      const { data: signed, error: signError } = await client.storage.from(APPLICATION_UPLOADS_BUCKET).createSignedUrl(raw, 600);
      if (cancelled) return;
      if (signError || !signed?.signedUrl) { setView('unavailable'); return; }
      window.location.replace(signed.signedUrl);
    })();
    return () => { cancelled = true; };
  }, [applicationId, questionId, here, userId, loading]);

  // Signed in from the pop-up: work again until the read answers.
  const shown: View = userId && view === 'signin' ? 'working' : view;

  return (
    <main style={{ minHeight: '100vh', background: '#EDE7D8', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 16px', fontFamily: FONT }}>
      <div style={{ width: '100%', maxWidth: 460, background: '#FFFFFF', borderRadius: 20, padding: '28px 26px', boxShadow: '0 10px 30px rgba(27,56,40,0.10)' }}>
        {shown === 'working' && (
          <div aria-busy="true" aria-label="Opening the file">
            <div style={{ height: 22, width: '60%', borderRadius: 8, background: '#F0EBDD', marginBottom: 14 }} />
            <div style={{ height: 14, width: '90%', borderRadius: 6, background: '#F0EBDD', marginBottom: 8 }} />
            <div style={{ height: 14, width: '70%', borderRadius: 6, background: '#F0EBDD' }} />
          </div>
        )}
        {shown === 'signin' && (
          <>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: INK }}>Application File</h1>
            <p style={{ margin: '10px 0 18px', fontSize: 15, lineHeight: 1.5, color: INK_SOFT }}>{NOTICE}</p>
            <button
              type="button"
              onClick={() => openAuth({ next: here, notice: NOTICE })}
              className="focus:outline-none"
              style={{ border: 'none', borderRadius: 12, padding: '12px 20px', fontFamily: FONT, fontSize: 15, fontWeight: 600, color: '#FFFFFF', background: 'linear-gradient(180deg, #24493A 0%, #1B3828 100%)', cursor: 'pointer' }}
            >
              Sign in
            </button>
          </>
        )}
        {(shown === 'unavailable' || shown === 'failed') && (
          <>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: INK }}>Application File</h1>
            <p style={{ margin: '10px 0 18px', fontSize: 15, lineHeight: 1.5, color: INK_SOFT }}>
              {shown === 'unavailable' ? 'This file is not available' : "This file can't be opened right now"}
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
