'use client';
// Gavelling Crisis: the delegate's news dialog. The list of published news (all news), or one story
// opened from the compact news block. Picking a story swaps the content for the full story with a back
// button to the list (a dialog never opens another dialog). The news is loaded once by the page.

import { useState } from 'react';
import type { News } from '@/lib/crisis/types';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import { NewsHistory } from '../news/NewsList';
import { NewsDetailBody } from '../news/NewsDetailDialog';
import { CK } from '../../crisisKit';
import CrisisDialog from './CrisisDialog';

export default function NewsDialog({ items, error, initial, onClose }: { items: News[] | null; error: string | null; initial: News | null; onClose: () => void }) {
  const { core } = useCrisis();
  const [story, setStory] = useState<News | null>(initial);

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
