'use client';
// Gavelling Crisis: "Sign this joint directive?" (docs/crisis/sql/054). When another delegate names me as a co-author of a joint
// directive, a centred card opens on any page with the writer, the title and the text, and Accept / Decline. The directive reaches
// the backroom once every co-author has answered (a decline takes that person off it). Closing it hides it for this visit; it
// still waits in My Directives. It never opens over another dialog.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, FileSignature, X } from 'lucide-react';
import Portal from '@/components/Portal';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { crisisError, listDirectives, respondCoauthor } from '@/lib/crisis/api';
import { dirNumber } from '@/lib/crisis/format';
import { useCrisisLive } from '@/lib/crisis/live';
import type { Directive } from '@/lib/crisis/types';
import { Btn, CK, OverhangCard, useScrollLock } from '../../crisisKit';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import PopBanner from '../directives/PopBanner';
import { DirectiveBody } from '../directives/attachedImage';
import { listCoauthors } from './delegateData';

const WATCH_MS = 1500;

function otherDialogOpen(): boolean {
  return !!document.querySelector('[aria-modal="true"]:not([data-coauthor-invite]), [role="dialog"]:not([data-coauthor-invite])');
}

export default function CoauthorInvitePrompt() {
  const { ref, core, role, characterId } = useCrisis();
  const enabled = role === 'delegate' && !!characterId;
  const [items, setItems] = useState<Directive[]>([]);
  const [closed, setClosed] = useState<Set<string>>(() => new Set());
  const [blocked, setBlocked] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!enabled) return;
    try {
      const [dirs, co] = await Promise.all([listDirectives(ref), listCoauthors(ref)]);
      const mine = new Set(co.filter((x) => x.character_id === characterId && x.status === 'pending').map((x) => x.directive_id));
      setItems(dirs.filter((d) => d.status === 'awaiting_coauthors' && mine.has(d.id)).sort((a, b) => a.created_at.localeCompare(b.created_at)));
    } catch { /* the next ping retries; a prompt never shows an error */ }
  }, [enabled, ref, characterId]);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);
  useCrisisLive(enabled ? ref.id : null, ['crisis_directives'], () => { void load(); });

  useEffect(() => {
    if (!enabled) return undefined;
    const watch = () => setBlocked(otherDialogOpen());
    watch();
    const t = window.setInterval(watch, WATCH_MS);
    return () => window.clearInterval(t);
  }, [enabled]);

  const pending = useMemo(() => items.filter((d) => !closed.has(d.id)), [items, closed]);
  const at = pending.length ? cursor % pending.length : 0;
  const current = pending[at] ?? null;
  const shown = !!current && !blocked;
  useScrollLock(shown);

  if (!enabled || !current) return null;

  const author = core.characters.find((c) => c.id === current.author_character_id);
  const authorName = author?.name ?? 'A delegate';
  const color = author?.cabinet_id ? core.cabinets.find((c) => c.id === author.cabinet_id)?.color ?? CK.red : CK.red;
  const size = 60;
  const overhang = Math.round(size / 3);
  const close = () => setClosed((s) => new Set(s).add(current.id));
  const answer = async (accept: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await respondCoauthor(ref, current.id, accept);
      if (r.ok) notifyOk(accept ? (r.sent ? 'Signed. It went to the backroom' : 'Signed. It goes to the backroom once everyone has') : 'You are off this directive');
      close();
      void load();
    } catch (e) { notifyErr(crisisError(e, 'Could not save your answer. Try again.')); }
    finally { setBusy(false); }
  };
  const navBtn = { border: 0, background: CK.well, color: CK.inkSoft, borderRadius: 999, width: 30, height: 30, cursor: 'pointer', flex: 'none' } as const;

  return (
    <Portal>
      <div style={{ position: 'fixed', inset: 0, zIndex: 231, display: blocked ? 'none' : 'grid', placeItems: 'center', padding: '44px 12px 12px', fontFamily: CK.font }}>
        <div aria-hidden onMouseDown={close} style={{ position: 'absolute', inset: 0, background: 'rgba(58,14,15,0.5)' }} />
        <div data-coauthor-invite="" role="dialog" aria-modal="true" aria-label="Joint directive to sign" style={{ position: 'relative', width: 'min(560px, 100%)', maxHeight: 'calc(100dvh - 56px)' }}>
          <PopBanner icon={<FileSignature size={26} strokeWidth={1.6} />}>Sign This Directive?</PopBanner>
          <OverhangCard name={authorName} src={author?.picture_url} color={color} size={size} warm
            style={{ padding: '12px 18px 18px', borderTop: `4px solid ${CK.red}`, boxShadow: `${CK.shadow}, 0 24px 60px rgba(58,14,15,0.4)` }}>
            <div className="flex items-start justify-between" style={{ gap: 8, paddingLeft: overhang + size + 12 - 18, minHeight: Math.round((size * 2) / 3) - 4 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <span style={{ fontSize: 11.5, fontWeight: 800, color: CK.red }}>Joint directive No. {dirNumber(current)}</span>
                <b style={{ display: 'block', marginTop: 2, fontSize: 16, lineHeight: 1.25, fontWeight: 800, color: CK.ink, overflowWrap: 'anywhere' }}>{authorName}</b>
                <span style={{ display: 'block', marginTop: 3, fontSize: 12.5, fontWeight: 600, color: CK.inkSoft }}>asks you to sign it with them</span>
              </div>
              <div className="flex items-center" style={{ gap: 4, flex: 'none' }}>
                {pending.length > 1 && (
                  <>
                    <button type="button" onClick={() => setCursor(at - 1 + pending.length)} aria-label="Previous" className="grid place-items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]" style={navBtn}><ChevronLeft size={16} strokeWidth={1.5} aria-hidden /></button>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: CK.inkSoft, fontVariantNumeric: 'tabular-nums' }}>{at + 1} of {pending.length}</span>
                    <button type="button" onClick={() => setCursor(at + 1)} aria-label="Next" className="grid place-items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]" style={navBtn}><ChevronRight size={16} strokeWidth={1.5} aria-hidden /></button>
                  </>
                )}
                <button type="button" onClick={close} aria-label="Close, it stays in My Directives" title="Close, it stays in My Directives" className="grid place-items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]" style={{ ...navBtn, marginLeft: 4 }}><X size={16} strokeWidth={1.5} aria-hidden /></button>
              </div>
            </div>
            <b style={{ display: 'block', marginTop: 14, fontSize: 17, color: CK.ink, overflowWrap: 'anywhere' }}>{current.title}</b>
            <div style={{ margin: '8px 0 14px', maxHeight: 'min(34dvh, 280px)', overflowY: 'auto', fontSize: 14.5, lineHeight: 1.55, color: CK.ink }}>
              <DirectiveBody body={current.body} />
            </div>
            <div className="flex flex-wrap" style={{ gap: 10 }}>
              <Btn tone="green" disabled={busy} onClick={() => void answer(true)}>Accept and sign</Btn>
              <Btn tone="ghost" disabled={busy} onClick={() => void answer(false)}>Decline</Btn>
            </div>
          </OverhangCard>
        </div>
      </div>
    </Portal>
  );
}
