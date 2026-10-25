'use client';
// Gavelling Crisis: the delegate's news dialog. The list of published news; picking a story swaps the
// content for the full story with a back button (a dialog never opens another dialog).

import { useState } from 'react';
import type { News } from '@/lib/crisis/types';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import { NewsHistory } from '../news/NewsList';
import { NewsDetailBody } from '../news/NewsDetailDialog';
import { useCrisisNews } from '../news/useCrisisNews';
import { CK } from '../../crisisKit';
import CrisisDialog from './CrisisDialog';

export default function NewsDialog({ onClose }: { onClose: () => void }) {
  const { ref, core } = useCrisis();
  const { items, error } = useCrisisNews(ref);
  const [story, setStory] = useState<News | null>(null);

  if (story) {
    return (
      <CrisisDialog title="News" onClose={onClose} onBack={() => setStory(null)} width={760} flush step="story">
        <NewsDetailBody n={story} />
      </CrisisDialog>
    );
  }
  return (
    <CrisisDialog title="News" onClose={onClose} width={760} step="list">
      {error && <p role="status" style={{ margin: '0 0 10px', fontSize: 13, color: CK.danger }}>{error}</p>}
      <NewsHistory items={items} cabinets={core.cabinets} onOpen={setStory} />
    </CrisisDialog>
  );
}
