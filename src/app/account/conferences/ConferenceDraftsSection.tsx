'use client';

// "Finish listing" (12 Oct 2026): conferences an organiser started in the
// creation wizard and has not created yet, shown on My conferences beside the
// application drafts and drawn the same way (logo disc, name over full name,
// last edited, Continue and a delete). Continue reopens /conferences/new at the
// saved step with every answer filled in (src/lib/conferenceDrafts.ts).
//
// Reads `my_conference_drafts()` after `claim_conference_drafts()` (drafts
// saved while signed out to this account's VERIFIED email become its own).
// Until the drafts SQL is applied both answer `missing` and nothing renders.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Trash2 } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { LogoDisc } from '@/components/LogoDisc';
import { useConfirmModal } from '@/components/ConfirmModal';
import { committeeDisplayName } from '@/lib/presetNames';
import { OUTFIT, MONO } from '@/app/account/accountUi';
import { NEU, NEU_GRADIENTS, EASE } from '@/components/neu';
import {
  myConferenceDrafts, claimConferenceDrafts, deleteConferenceDraft, conferenceDraftHref,
  readLocalDraftToken, writeLocalDraftToken, type MyConferenceDraft,
} from '@/lib/conferenceDrafts';

const TOTAL_WIZARD_STEPS = 10;

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return 'recently';
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  const months = Math.round(days / 30);
  return months < 12 ? `${months} month${months === 1 ? '' : 's'} ago` : 'over a year ago';
}

export function ConferenceDraftsSection() {
  const { user, loading: authLoading } = useAuth();
  const [drafts, setDrafts] = useState<MyConferenceDraft[]>([]);
  const { confirm, modal } = useConfirmModal();
  const userId = user?.id ?? null;

  const load = useCallback(async () => {
    if (!userId) { setDrafts([]); return; }
    await claimConferenceDrafts();
    const a = await myConferenceDrafts();
    setDrafts(a.kind === 'ok' ? a.data : []);
  }, [userId]);

  useEffect(() => {
    if (authLoading) return;
    void Promise.resolve().then(() => load());
  }, [authLoading, load]);

  async function remove(d: MyConferenceDraft) {
    const name = d.acronym || d.full_name || 'this conference';
    const { confirmed } = await confirm({
      title: 'Delete this draft?',
      body: `Your saved answers for ${name} will be deleted and we will stop reminding you about it. You can always start listing it again.`,
      confirmLabel: 'Delete draft',
      danger: true,
    });
    if (!confirmed) return;
    const a = await deleteConferenceDraft(d.token);
    if (a.kind !== 'ok' || !a.data.ok) return;
    if (readLocalDraftToken() === d.token) writeLocalDraftToken(null);
    setDrafts((prev) => prev.filter((x) => x.token !== d.token));
  }

  if (drafts.length === 0) return <>{modal}</>;

  return (
    <section id="listing-drafts" className="mb-8" style={{ scrollMarginTop: 96 }}>
      <div className="flex items-center gap-2.5 mb-2">
        <h2 style={{ margin: 0, fontFamily: OUTFIT, fontWeight: 800, fontSize: 18, letterSpacing: '-0.01em', color: NEU.ink }}>
          Finish listing
        </h2>
        <span style={{ fontFamily: MONO, fontSize: 15, fontWeight: 800, lineHeight: 1, color: NEU.deepGold, fontVariantNumeric: 'tabular-nums' }}>
          {drafts.length}
        </span>
      </div>
      <p className="text-xs mb-4" style={{ color: NEU.inkSoft, fontFamily: OUTFIT }}>
        Conferences you started listing. Your answers are saved, so you can pick up where you left off.
      </p>
      <div className="flex flex-col gap-2.5">
        {drafts.map((d) => <DraftCard key={d.token} draft={d} onDelete={remove} />)}
      </div>
      {modal}
    </section>
  );
}

function DraftCard({ draft, onDelete }: { draft: MyConferenceDraft; onDelete: (d: MyConferenceDraft) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const full = draft.full_name || 'Untitled conference';
  // Acronym big, full name small beneath; never one line repeated twice.
  const primary = draft.acronym || committeeDisplayName(full) || full;
  const secondary = primary === full ? null : full;
  const step = Math.min(TOTAL_WIZARD_STEPS, Math.max(1, draft.step || 1));

  return (
    <div
      className="flex items-center gap-3 px-3.5 py-3"
      style={{ borderRadius: 18, backgroundColor: '#FFFFFF', boxShadow: '0 0 0 1px rgba(27,56,40,0.07), 6px 9px 20px -6px rgba(27,56,40,0.16)' }}
    >
      <LogoDisc src={draft.logo_url} alt={primary} size={40} fallbackText={primary.slice(0, 3)} />
      <div className="min-w-0 flex-1">
        <p className="font-black text-sm [overflow-wrap:anywhere]" style={{ color: NEU.ink, fontFamily: OUTFIT, letterSpacing: '-0.01em' }}>
          {primary}
        </p>
        {secondary && (
          <p className="text-[11px] [overflow-wrap:anywhere]" style={{ color: NEU.inkSoft, fontFamily: OUTFIT, fontWeight: 600 }}>
            {secondary}
          </p>
        )}
        <p className="text-xs mt-0.5" style={{ color: NEU.inkSoft, fontFamily: OUTFIT }}>
          Step {step} of {TOTAL_WIZARD_STEPS} · last edited {relativeTime(draft.updated_at)}
        </p>
      </div>
      <div className="flex items-center gap-3 sm:gap-2 flex-shrink-0">
        <Link
          href={conferenceDraftHref(draft.token)}
          className="inline-flex items-center focus:outline-none min-h-11 sm:min-h-0"
          style={{
            padding: '8px 14px', borderRadius: 999, border: 'none',
            background: `linear-gradient(135deg, ${NEU_GRADIENTS.forest[0]}, ${NEU_GRADIENTS.forest[1]})`,
            boxShadow: `0 3px 8px color-mix(in srgb, ${NEU_GRADIENTS.forest[0]} 27%, transparent), ${NEU.outSm}`,
            color: NEU.gold, fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 800,
            textDecoration: 'none', whiteSpace: 'nowrap',
          }}
        >
          Continue
        </Link>
        <button
          onClick={async () => { setBusy(true); try { await onDelete(draft); } finally { setBusy(false); } }}
          disabled={busy}
          className="inline-flex items-center justify-center focus:outline-none w-11 h-11 sm:w-[34px] sm:h-[34px]"
          aria-label={`Delete the ${primary} draft`}
          style={{
            borderRadius: 999, border: 'none',
            backgroundColor: NEU.surface, boxShadow: busy ? NEU.inSm : NEU.outSm,
            color: busy ? NEU.inkSoft : '#8B2020', cursor: busy ? 'default' : 'pointer',
            transition: `box-shadow 160ms ${EASE}`,
          }}
        >
          <Trash2 size={15} strokeWidth={2.2} />
        </button>
      </div>
    </div>
  );
}
