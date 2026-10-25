'use client';
// Gavelling Crisis: one news story in full. The banner on top (if any), source and time, the title,
// the whole story (line breaks kept, any length, scrolls inside the dialog) and the attached file.
// NewsDetailBody is the content alone, so a dialog that already lists the news can swap to it with a
// back button instead of opening a second dialog on top of itself.

import { Download, Newspaper } from 'lucide-react';
import type { News } from '@/lib/crisis/types';
import { CK } from '../../crisisKit';
import CrisisDialog from '../delegate/CrisisDialog';
import { newsTime } from './NewsList';

export function NewsDetailBody({ n }: { n: News }) {
  return (
    <article style={{ fontFamily: CK.font }}>
      {n.banner_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={n.banner_url} alt="" style={{ display: 'block', width: '100%', maxHeight: 280, objectFit: 'cover', background: CK.well }} />
      )}
      <div style={{ padding: '16px 20px 24px' }}>
        <div className="flex items-center gap-2 flex-wrap" style={{ fontSize: 12.5, fontWeight: 700, color: CK.red }}>
          <Newspaper size={15} strokeWidth={1.5} aria-hidden />
          <span style={{ overflowWrap: 'anywhere' }}>{n.source_label || 'Crisis update'}</span>
          <span style={{ color: CK.muted, fontWeight: 600 }}>{newsTime(n.published_at ?? n.created_at)}</span>
        </div>
        <h3 style={{ margin: '8px 0 10px', fontSize: 22, lineHeight: 1.25, fontWeight: 800, color: CK.ink, overflowWrap: 'anywhere' }}>{n.title}</h3>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.65, color: CK.ink, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{n.body}</p>
        {n.attachment_url && (
          <a
            href={n.attachment_url}
            target="_blank"
            rel="noopener noreferrer"
            download={n.attachment_name || undefined}
            className="inline-flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
            style={{ marginTop: 18, padding: '9px 14px', borderRadius: 12, background: CK.card, boxShadow: CK.shadowSm, color: CK.forest, fontSize: 14, fontWeight: 700, textDecoration: 'underline', overflowWrap: 'anywhere' }}
          >
            <Download size={16} strokeWidth={1.5} aria-hidden style={{ flexShrink: 0 }} />
            {n.attachment_name || 'Download the attached file'}
          </a>
        )}
      </div>
    </article>
  );
}

export default function NewsDetailDialog({ n, onClose }: { n: News; onClose: () => void }) {
  return (
    <CrisisDialog title="News" onClose={onClose} width={760} flush>
      <NewsDetailBody n={n} />
    </CrisisDialog>
  );
}
