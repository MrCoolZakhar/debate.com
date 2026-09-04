'use client';

// Financial aid FORM editor, organizer side — the enable toggle, intro copy
// and question set that the payment-panel aid form (individual + delegation)
// reads. Aid itself is a separate application (financial_aid_requests table),
// this only edits the conference-level config columns. Review of submitted
// requests lives alongside this in AidRequestsSection, same tab.

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { useManage } from '@/app/manage/[slug]/layout';
import { getAuthedClient, getFreshAuthedClient } from '@/lib/supabase-auth';
import { PillToggle } from '@/app/account/accountUi';
import QuestionBuilder from '@/components/QuestionBuilder';
import { type FormBlock, normalizeBlocks } from '@/lib/customQuestions';
import { NEU, OUTFIT, NeuCard } from '@/components/neu';

const inputStyle: React.CSSProperties = {
  backgroundColor: '#FAF8F3',
  border: '1.5px solid #DDD4C0',
  borderRadius: '10px',
  padding: '10px 14px',
  fontSize: '13px',
  color: '#1C1410',
  fontFamily: OUTFIT,
  outline: 'none',
  transition: 'border-color 150ms ease',
  width: '100%',
};

// Standard failure copy for a verified-write save: a write that returns an
// error OR affects zero rows (RLS silently filtered it, or the row vanished)
// is treated identically, never a silent false success.
function saveFailMessage(error?: { message: string } | null): string {
  return "Couldn't save, please refresh and try again." + (error?.message ? ' ' + error.message : '');
}

export interface AidFormEditorProps {
  conferenceId: string;
  initialEnabled: boolean;
  initialIntro: string | null;
  initialBlocks: unknown[];
}

export default function AidFormEditor({ conferenceId, initialEnabled, initialIntro, initialBlocks }: AidFormEditorProps) {
  const { session } = useAuth();
  const { refreshConferenceQuiet } = useManage();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [intro, setIntro] = useState(initialIntro ?? '');
  const [blocks, setBlocks] = useState<FormBlock[]>(() => normalizeBlocks(initialBlocks));
  const [toggleSaving, setToggleSaving] = useState(false);
  const [introSaving, setIntroSaving] = useState(false);
  const [introSaved, setIntroSaved] = useState(false);
  const [error, setError] = useState('');
  // Decoupled from `enabled` — organizers can open the form to edit it
  // whether or not aid is currently switched on.
  const [expanded, setExpanded] = useState(false);

  // Debounced, serialized write path for `blocks` — see handleBlocksChange /
  // persistBlocks below. Mirrors the pattern in settings.tsx's block editor,
  // minus the per-role Map since this editor only ever edits one form.
  const blocksPendingRef = useRef<FormBlock[] | null>(null);
  const blocksTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blocksChainRef = useRef<Promise<void>>(Promise.resolve());
  const flushBlocksRef = useRef<() => void>(() => {});

  async function saveAidConfig(updates: Partial<{ financial_aid_enabled: boolean; aid_intro: string | null; aid_questions: FormBlock[] }>): Promise<boolean> {
    if (!session) {
      setError('Your session has expired, please refresh and sign in again.');
      return false;
    }
    const supabase = getAuthedClient(session.access_token);
    const { data, error: writeError } = await supabase
      .from('conferences')
      .update(updates)
      .eq('id', conferenceId)
      .select('id');
    if (writeError || !data || data.length !== 1) {
      setError(saveFailMessage(writeError));
      return false;
    }
    setError('');
    await refreshConferenceQuiet();
    return true;
  }

  function handleToggle(next: boolean) {
    if (toggleSaving) return;
    const previous = enabled;
    setEnabled(next);
    setToggleSaving(true);
    void saveAidConfig({ financial_aid_enabled: next })
      .then(ok => { if (!ok) setEnabled(previous); })
      .finally(() => setToggleSaving(false));
  }

  async function handleSaveIntro() {
    if (introSaving) return;
    setIntroSaving(true);
    const ok = await saveAidConfig({ aid_intro: intro.trim() || null });
    setIntroSaving(false);
    if (ok) {
      setIntroSaved(true);
      setTimeout(() => setIntroSaved(false), 2500);
    }
  }

  /** Patch local state at once so typing stays responsive, then debounce the
   *  write. Two async writes landing out of order would silently overwrite a
   *  later edit with older data, so writes are serialized in persistBlocks
   *  rather than fired independently here. */
  function handleBlocksChange(next: FormBlock[]) {
    setBlocks(next);
    blocksPendingRef.current = next;
    if (blocksTimerRef.current) clearTimeout(blocksTimerRef.current);
    blocksTimerRef.current = setTimeout(() => {
      blocksTimerRef.current = null;
      persistBlocks();
    }, 400);
  }

  /** Writes the pending blocks, appended to the serial chain so two writes
   *  can never be in flight at once. On failure we reload rather than roll
   *  back: local state has moved on by several keystrokes since the failed
   *  write was queued, so any snapshot we could restore is already stale. */
  function persistBlocks() {
    const pending = blocksPendingRef.current;
    if (!pending) return;
    blocksPendingRef.current = null;
    blocksChainRef.current = blocksChainRef.current.then(async () => {
      if (!session) {
        setError('Your session has expired, please refresh and sign in again.');
        return;
      }
      const supabase = await getFreshAuthedClient();
      if (!supabase) {
        setError('Your session has expired, please refresh and sign in again.');
        return;
      }
      const { data, error: writeError } = await supabase
        .from('conferences')
        .update({ aid_questions: pending })
        .eq('id', conferenceId)
        .select('id');
      if (writeError || !data || data.length !== 1) {
        setError(saveFailMessage(writeError));
        void (async () => {
          const fresh = await getFreshAuthedClient();
          if (!fresh) return;
          const { data: row } = await fresh
            .from('conferences')
            .select('aid_questions')
            .eq('id', conferenceId)
            .maybeSingle();
          if (row) setBlocks(normalizeBlocks((row as { aid_questions: unknown }).aid_questions ?? []));
        })();
        return;
      }
      setError('');
      await refreshConferenceQuiet();
    });
  }

  /** Cancel the debounce and write now. Called before anything can read
   *  stale data: collapsing the editor, unmounting. */
  function flushBlocks() {
    if (blocksTimerRef.current) {
      clearTimeout(blocksTimerRef.current);
      blocksTimerRef.current = null;
    }
    persistBlocks();
  }

  flushBlocksRef.current = flushBlocks;

  useEffect(() => {
    return () => { flushBlocksRef.current(); };
  }, []);

  // Leaving the editor. Its panel is about to collapse, so write now.
  useEffect(() => {
    if (!expanded) flushBlocksRef.current();
  }, [expanded]);

  return (
    <NeuCard style={{ padding: 24, marginBottom: 20 }}>
      <div className="flex items-center justify-between gap-4 mb-1">
        <p className="font-semibold text-base" style={{ color: NEU.ink, fontFamily: OUTFIT }}>
          Aid application form
        </p>
        <PillToggle value={enabled} onChange={toggleSaving ? () => {} : handleToggle} size="md" />
      </div>
      <p className="text-sm mb-4" style={{ color: NEU.muted, fontFamily: OUTFIT }}>
        Delegates can request financial aid from the payment panel once accepted. Review each request below and grant a discount, applied automatically at checkout.
      </p>

      {error && (
        <p className="text-xs mb-3" style={{ color: '#8B2020', fontFamily: OUTFIT }}>{error}</p>
      )}

      {!expanded && (
        <div className="flex justify-center pt-1">
          <button
            onClick={() => setExpanded(true)}
            className="flex items-center gap-1.5 text-xs font-semibold focus:outline-none transition-colors"
            style={{ color: NEU.muted, fontFamily: OUTFIT }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = NEU.forest; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = NEU.muted; }}
          >
            <ChevronDown size={14} />
            Edit questions
          </button>
        </div>
      )}

      {expanded && (
        <>
          <div className="mb-5">
            <label className="block text-xs font-semibold mb-1.5" style={{ color: NEU.ink, fontFamily: OUTFIT }}>
              Intro message (optional)
            </label>
            <textarea
              rows={3}
              value={intro}
              onChange={(e) => setIntro(e.target.value)}
              placeholder="Shown at the top of the aid form"
              style={{ ...inputStyle, resize: 'vertical', lineHeight: '1.6' }}
              onFocus={(e) => { e.currentTarget.style.borderColor = '#1B3828'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = '#DDD4C0'; }}
            />
            <button
              onClick={handleSaveIntro}
              disabled={introSaving || introSaved}
              className="mt-2 rounded-xl py-2 px-5 font-bold text-xs tracking-widest transition-colors focus:outline-none flex items-center justify-center gap-2"
              style={{
                backgroundColor: introSaved ? NEU.green : NEU.forest,
                color: NEU.gold,
                fontFamily: OUTFIT,
                letterSpacing: '0.07em',
                opacity: introSaving ? 0.75 : 1,
                cursor: introSaving ? 'wait' : 'pointer',
              }}
            >
              {introSaving && (
                <span className="w-3 h-3 rounded-full border-2 border-t-transparent animate-spin flex-shrink-0" style={{ borderColor: NEU.gold, borderTopColor: 'transparent' }} />
              )}
              {introSaving ? 'SAVING…' : introSaved ? 'SAVED ✓' : 'SAVE'}
            </button>
          </div>

          <p className="block text-xs font-semibold mb-2" style={{ color: NEU.ink, fontFamily: OUTFIT }}>
            Aid questions
          </p>
          <QuestionBuilder value={blocks} onChange={handleBlocksChange} />

          <div className="flex justify-center pt-2">
            <button
              onClick={() => setExpanded(false)}
              className="flex items-center gap-1.5 text-xs font-semibold focus:outline-none transition-colors"
              style={{ color: NEU.muted, fontFamily: OUTFIT }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = NEU.forest; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = NEU.muted; }}
            >
              <ChevronUp size={14} />
              Collapse
            </button>
          </div>
        </>
      )}
    </NeuCard>
  );
}
