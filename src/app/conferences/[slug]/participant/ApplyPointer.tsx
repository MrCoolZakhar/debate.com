'use client';

// Friendly pointer shown in the person tab when there's nothing to show yet:
// signed out, or signed in with no application to this conference.

import { openAuth } from '@/lib/authModal';
import { useRouter } from 'next/navigation';
import { UserRound } from 'lucide-react';
import { SectionCard, OUTFIT } from './shared';
import { BTN_CLASS } from './delegation/leaderKit';
import { mainBtn } from './delegation/overview/SeatCard';

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
        <UserRound size={36} strokeWidth={1.5} aria-hidden className="mb-4" style={{ color: '#1C1410' }} />
        <p className="text-[19px] font-semibold mb-1.5" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
          {signedOut ? 'Sign in to see your participant dashboard' : "You haven't applied yet"}
        </p>
        <p className="text-[14px] max-w-[380px] mb-6" style={{ color: '#6B5F52', fontFamily: OUTFIT, lineHeight: 1.7 }}>
          {signedOut
            ? 'Once you apply and sign in, your application status, documents, payment and messages with the organizing team all live here.'
            : 'Apply to this conference and your application status, documents, payment and messages with the organizing team will all live here.'}
        </p>
        <button
          onClick={() => (signedOut ? openAuth({ next }) : router.push(`/conferences/${conferenceSlug}/apply`))}
          className={BTN_CLASS}
          style={mainBtn}
        >
          {signedOut ? 'Sign in' : 'Apply now'}
        </button>
      </div>
    </SectionCard>
  );
}
