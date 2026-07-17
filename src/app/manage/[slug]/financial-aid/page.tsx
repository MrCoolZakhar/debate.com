'use client';

import { HeartHandshake } from 'lucide-react';
import { useManage } from '@/app/manage/[slug]/layout';
import { NEU, NEU_GRADIENTS, OUTFIT, NeuIconDisc } from '@/components/neu';
import AidFormEditor from './AidFormEditor';
import AidRequestsSection from '../applications/AidRequestsSection';

export default function FinancialAidPage() {
  const { conference } = useManage();
  if (!conference) return null;

  return (
    <div className="px-6 md:px-10 py-8">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
        <div className="flex items-center gap-3.5">
          <NeuIconDisc gradient={NEU_GRADIENTS.forest} icon={HeartHandshake} emoji="Handshake" size={46} />
          <div>
            <p className="mb-1" style={{ fontFamily: OUTFIT, fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', color: NEU.deepGold, textTransform: 'uppercase' }}>
              {conference.acronym} · Financial Aid
            </p>
            <h1 style={{ fontFamily: OUTFIT, fontWeight: 900, fontSize: 26, color: NEU.ink, letterSpacing: '-0.01em' }}>Financial Aid</h1>
          </div>
        </div>
      </div>

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
