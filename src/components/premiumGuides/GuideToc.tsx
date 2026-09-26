'use client';

// "In this guide" (26 Sep 2026). The server renders it with the paid sections
// locked; once guide_access says this reader can read the guide (Unlimited or
// unlocked), every section is a live link with no lock.

import { Lock, LockOpen } from 'lucide-react';
import { useGuideAccess } from '@/lib/useGuideAccess';

export default function GuideToc({ slug, toc }: { slug: string; toc: { id: string; text: string; free: boolean }[] }) {
  const access = useGuideAccess(slug);
  const open = !!access?.can_read;
  return (
    <nav className="gvg-toc">
      <p className="gvg-toc-title">In this guide</p>
      <ol>
        {toc.map((t) => {
          const live = open || t.free;
          return (
            <li key={t.id}>
              {open ? null : t.free ? (
                <LockOpen size={15} strokeWidth={2.2} aria-hidden="true" />
              ) : (
                <Lock size={15} strokeWidth={2.2} aria-hidden="true" />
              )}
              {live ? (
                <a href={`#${t.id}`}>{t.text}</a>
              ) : (
                <span className="gvg-locked">
                  {t.text}
                  <span className="sr-only"> (included with Unlimited)</span>
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
