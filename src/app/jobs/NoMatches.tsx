'use client';

// ── No results on All roles (Job Board prompt 12) ──────────────────────────
//
// When the filters match nothing, the right pane on a laptop (and the list on
// a phone, under "No roles match these filters.") offers to save the search
// as an alert instead of an empty pane. SaveAlertAction already handles
// signed-out people (sign-in) and members without Unlimited (the pop-up).

import { BellPlus } from 'lucide-react';
import SaveAlertAction from './SaveAlertAction';
import type { JobQuery } from './jobQuery';

const FONT = "var(--font-brand), sans-serif";
const INK = '#1C1410';
const INK_SOFT = '#5C5140';
const FOREST = '#1B3828';

export default function NoMatches({ query, onClear, compact = false }: {
  query: JobQuery;
  onClear: () => void;
  /** The phone version under the list's own sentence: no repeated heading card. */
  compact?: boolean;
}) {
  return (
    <div
      style={{
        fontFamily: FONT, display: 'flex', flexDirection: 'column', alignItems: compact ? 'flex-start' : 'center',
        textAlign: compact ? 'left' : 'center', gap: 10,
        ...(compact ? { marginTop: 14 } : {
          minHeight: 320, justifyContent: 'center', padding: '32px 28px', borderRadius: 20, background: '#FFFFFF',
          boxShadow: '0 1px 2px rgba(27,56,40,0.05), 0 8px 24px rgba(27,56,40,0.08)',
        }),
      }}
    >
      {!compact && (
        <span aria-hidden style={{ width: 52, height: 52, borderRadius: 9999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: FOREST, background: 'linear-gradient(180deg,#FFFFFF 0%,#F2EDE2 100%)', border: '1px solid rgba(27,56,40,0.16)', boxShadow: 'inset 0 1px 0 #FFFFFF, 0 3px 10px rgba(27,56,40,0.14)' }}>
          <BellPlus size={22} strokeWidth={2.2} />
        </span>
      )}
      {!compact && <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: INK }}>No matches found</h2>}
      <p style={{ margin: 0, maxWidth: '46ch', fontSize: 15, lineHeight: 1.55, color: INK_SOFT }}>
        Save this search as an alert to know when roles that match it are posted.
      </p>
      <SaveAlertAction query={query} />
      <button
        type="button"
        onClick={onClear}
        className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] rounded"
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: FONT, fontSize: 14, fontWeight: 700, color: INK, textDecoration: 'underline', textUnderlineOffset: 3 }}
      >
        Clear filters
      </button>
    </div>
  );
}
