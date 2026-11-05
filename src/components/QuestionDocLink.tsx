'use client';

// The document a conference attached to a form question (prompt 19), drawn
// inside the question card under its title and help, above the answer. The
// bucket is public, so applicants who are signed out can open it too.

import { FileText } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { QUESTION_DOCS_BUCKET, type QuestionDoc } from '@/lib/customQuestions';

export function questionDocUrl(doc: QuestionDoc): string {
  return supabase.storage.from(QUESTION_DOCS_BUCKET).getPublicUrl(doc.path).data.publicUrl;
}

export default function QuestionDocLink({ doc }: { doc: QuestionDoc | null | undefined }) {
  if (!doc) return null;
  return (
    <div
      className="flex items-start gap-2.5 flex-wrap mb-3"
      style={{ padding: '9px 12px', borderRadius: 12, border: '1px solid color-mix(in srgb, var(--gv-main, #1B3828) 18%, transparent)', background: '#FFFFFF', fontFamily: 'var(--font-brand), sans-serif' }}
    >
      <FileText size={18} strokeWidth={1.5} aria-hidden style={{ color: 'var(--gv-main, #1B3828)', flexShrink: 0, marginTop: 1 }} />
      <span className="flex-1 min-w-0 [overflow-wrap:anywhere]" style={{ minWidth: 140, fontSize: 13.5, fontWeight: 600, color: '#1C1410', lineHeight: 1.35 }}>
        {doc.name}
      </span>
      <a
        href={questionDocUrl(doc)}
        target="_blank"
        rel="noopener noreferrer"
        download={doc.name}
        style={{ fontSize: 13, fontWeight: 700, color: 'var(--gv-main, #1B3828)', textDecoration: 'underline', textUnderlineOffset: 3 }}
      >
        Download
      </a>
    </div>
  );
}
