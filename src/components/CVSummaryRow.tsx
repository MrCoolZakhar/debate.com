'use client';

/**
 * CVSummaryRow — extracted from src/app/auth/onboarding/page.tsx's
 * `ConfSummaryRow` (a compact read-back of a saved conference entry: logo,
 * name, role chip, and a one-line detail). A move, not a redesign — the
 * onboarding "been to conferences before?" step still renders exactly this.
 *
 * Shared with the apply flow's chair/secretariat MUN experience step, which
 * summarises `applications.experience_entries` items (a narrower shape than
 * a full mun_cv_entries row — see `CVSummaryRowEntry`) and needs a remove
 * affordance onboarding never did, hence the optional `onRemove`.
 */

import { Pencil, X } from 'lucide-react';
import { ENTRY_TYPE_MAP, type EntryType } from '@/components/CVEntryModal';
import { LogoDisc } from '@/components/LogoDisc';
import { monogramFor } from '@/app/account/accountUi';
import { NEU, OUTFIT, EASE } from '@/components/neu';

/** Only the fields this row actually reads — a full `CVEntry` satisfies this
 *  structurally, and so does the narrower `ExperienceEntry` shape (once the
 *  caller fills in `logo_url: null`, since an application entry has none). */
export interface CVSummaryRowEntry {
  entry_type: EntryType;
  conference_name: string;
  committee: string;
  allocation: string;
  logo_url?: string | null;
}

export function CVSummaryRow({
  entry,
  onEdit,
  onRemove,
}: {
  entry: CVSummaryRowEntry;
  onEdit: () => void;
  /** When supplied, renders a small X that removes the row from whatever
   *  list it belongs to (never mun_cv_entries) — onboarding never passes
   *  this, so its row renders identically to before. */
  onRemove?: () => void;
}) {
  const type = ENTRY_TYPE_MAP[entry.entry_type] ?? ENTRY_TYPE_MAP.delegate;
  const detail =
    entry.entry_type === 'delegate' ? [entry.allocation, entry.committee].filter(Boolean).join(' · ')
    : entry.entry_type === 'chair' ? entry.committee
    : entry.allocation;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onEdit}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onEdit(); } }}
      className="flex items-center gap-3.5 w-full text-left focus:outline-none"
      style={{
        padding: '14px 16px',
        borderRadius: 18,
        border: `1.5px solid ${type.border}`,
        backgroundColor: NEU.surface,
        boxShadow: NEU.outSm,
        cursor: 'pointer',
        transition: `all 200ms ${EASE}`,
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = NEU.outSmHover; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = NEU.outSm; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}
    >
      <LogoDisc src={entry.logo_url ?? null} size={44} fallbackText={monogramFor(entry.conference_name)} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="truncate"
            style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 15, color: NEU.ink, letterSpacing: '-0.01em' }}
          >
            {entry.conference_name}
          </span>
          <span
            style={{
              fontFamily: OUTFIT, fontSize: 10, fontWeight: 800, letterSpacing: '0.06em',
              textTransform: 'uppercase', color: type.chipInk,
              padding: '2px 8px', borderRadius: 999,
              background: `linear-gradient(150deg, ${type.accent}1C, ${type.accent}0C), ${NEU.surface}`,
              border: `1px solid ${type.accent}33`,
            }}
          >
            {type.label}
          </span>
        </div>
        {detail && (
          <span
            className="block truncate"
            // The only place the saved allocation / committee is read back,
            // so it has to be legible: NEU.muted is 2.78:1 on the card surface.
            style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 500, color: NEU.inkSoft, marginTop: 2 }}
          >
            {detail}
          </span>
        )}
      </div>
      {/* Not decorative: this glyph is the only standing cue that the row is
          editable, so it owes the 3:1 non-text minimum. NEU.muted is 2.78:1. */}
      <Pencil size={15} strokeWidth={2.2} style={{ color: NEU.inkSoft, flexShrink: 0 }} />
      {onRemove && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          aria-label="Remove from this application"
          className="flex items-center justify-center flex-shrink-0 focus:outline-none"
          style={{
            width: 22, height: 22, borderRadius: 999,
            backgroundColor: 'rgba(139,32,32,0.08)', border: '1px solid rgba(139,32,32,0.22)',
            color: '#8B2020', cursor: 'pointer',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(139,32,32,0.15)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(139,32,32,0.08)'; }}
        >
          <X size={12} strokeWidth={2.8} />
        </button>
      )}
    </div>
  );
}
