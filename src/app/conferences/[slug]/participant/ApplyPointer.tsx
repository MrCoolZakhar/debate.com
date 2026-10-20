'use client';

// Friendly pointer shown in the person tab when there's nothing to show yet:
// signed out, or signed in with no application to this conference.

import { openAuth } from '@/lib/authModal';
import { useRouter } from 'next/navigation';
import { UserRound } from 'lucide-react';
import { SectionCard, OUTFIT } from './shared';

export default function ApplyPointer({ conferenceSlug, signedOut, next }: {
  conferenceSlug: string;
  signedOut: boolean;
  /** Exact URL to send the viewer back to after signing in, so a role deep
   *  link never bounces them to the plain landing page. Defaults to the
   *  role resolver when not given. */
  next?: string;
}) {
  const router = useRouter();

  return (
    <SectionCard>
      <div className="flex flex-col items-center text-center py-10">
        <div
          className="flex items-center justify-center mb-5"
          style={{ width: '64px', height: '64px', borderRadius: '9999px', backgroundColor: 'color-mix(in srgb, var(--gv-main) 7%, transparent)', border: '1px solid color-mix(in srgb, var(--gv-main) 14%, transparent)' }}
        >
          <UserRound size={26} strokeWidth={1.8} style={{ color: 'var(--gv-main)' }} />
        </div>
        <p className="text-[15px] font-semibold mb-1.5" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
          {signedOut ? 'Sign in to see your participant dashboard' : "You haven't applied yet"}
        </p>
        <p className="text-[13px] max-w-[340px] mb-6" style={{ color: '#9A8A78', fontFamily: OUTFIT, lineHeight: 1.7 }}>
          {signedOut
            ? 'Once you apply and sign in, your application status, documents, payment and messages with the organizing team all live here.'
            : 'Apply to this conference and your application status, documents, payment and messages with the organizing team will all live here.'}
        </p>
        <button
          onClick={() => (signedOut ? openAuth({ next }) : router.push(`/conferences/${conferenceSlug}/apply`))}
          className="rounded-xl py-2.5 px-6 font-bold text-sm focus:outline-none transition-colors"
          style={{ backgroundColor: 'var(--gv-main)', color: 'var(--gv-on-main)', fontFamily: OUTFIT, border: 'none', cursor: 'pointer' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--gv-main-mid)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--gv-main)'; }}
        >
          {signedOut ? 'Sign in' : 'Apply now'}
        </button>
      </div>
    </SectionCard>
  );
}
