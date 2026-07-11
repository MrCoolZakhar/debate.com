'use client';

// Friendly pointer shown in the person tab when there's nothing to show yet:
// signed out, or signed in with no application to this conference.

import { useRouter } from 'next/navigation';
import { UserRound } from 'lucide-react';
import { SectionCard, OUTFIT } from './shared';

export default function ApplyPointer({ conferenceSlug, signedOut }: {
  conferenceSlug: string;
  signedOut: boolean;
}) {
  const router = useRouter();

  return (
    <SectionCard>
      <div className="flex flex-col items-center text-center py-10">
        <div
          className="flex items-center justify-center mb-5"
          style={{ width: '64px', height: '64px', borderRadius: '9999px', backgroundColor: 'rgba(27,56,40,0.07)', border: '1px solid rgba(27,56,40,0.14)' }}
        >
          <UserRound size={26} strokeWidth={1.8} style={{ color: '#1B3828' }} />
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
          onClick={() => router.push(signedOut ? `/auth/signin?next=/conferences/${conferenceSlug}` : `/conferences/${conferenceSlug}/apply`)}
          className="rounded-xl py-2.5 px-6 font-bold text-sm focus:outline-none transition-colors"
          style={{ backgroundColor: '#1B3828', color: '#EED98A', fontFamily: OUTFIT, letterSpacing: '0.06em', border: 'none', cursor: 'pointer' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
        >
          {signedOut ? 'SIGN IN →' : 'APPLY NOW →'}
        </button>
      </div>
    </SectionCard>
  );
}
