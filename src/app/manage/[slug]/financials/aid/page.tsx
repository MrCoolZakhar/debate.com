'use client';

/**
 * Financial aid, a sub-page of Financials (owner, 9 Oct 2026: "move financial
 * aid as another tab in financials, so that it's not on the side bar"). It is
 * reached from the Financial Aid card on the Financials dashboard, and the old
 * address /manage/[slug]/financial-aid redirects here. The content is the
 * former Financial Aid page unchanged: the form editor, then the requests. The
 * title and "Back to Financials" come from ../layout.tsx, like every other
 * Financials sub-page. Its permission is still the Financials one
 * (SECTION_PERMS in the manage layout keys on the `financials` segment).
 */

import { useManage } from '@/app/manage/[slug]/layout';
import { NEU, OUTFIT } from '@/components/neu';
import AidFormEditor from './AidFormEditor';
import AidRequestsSection from '../../applications/AidRequestsSection';

export default function FinancialAidPage() {
  const { conference } = useManage();
  if (!conference) return null;

  return (
    <div>
      <AidFormEditor
        conferenceId={conference.id}
        initialEnabled={conference.financial_aid_enabled}
        initialIntro={conference.aid_intro}
        initialBlocks={conference.aid_questions}
      />

      <p className="mb-3 mt-2" style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 11, letterSpacing: '0.14em', color: NEU.deepGold, textTransform: 'uppercase' }}>
        Requests
      </p>
      <AidRequestsSection conferenceId={conference.id} conferenceSlug={conference.slug} aidBlocks={conference.aid_questions} />
    </div>
  );
}
