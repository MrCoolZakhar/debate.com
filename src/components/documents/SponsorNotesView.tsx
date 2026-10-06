'use client';

/**
 * SponsorNotesView: a Commenter's notes on the sponsors of one paper (Oct 2026, after Asia
 * WorldMUN DISEC: "a commenter view during the presentation and Q&A of a doc, the sponsors in
 * three fields at the same time, being visible, not scrolling, so chairs can take comments").
 *
 * WHY HERE AND NOT ON THE STAGE SCREEN. The introduction's stage (Reading / Presentation / Q&A)
 * lives only in the Moderator's DocumentsModal state: `documents.intro_state` is no longer
 * written (AGENTS.md, FEATURE: DOCUMENTS), and a Commenter's card offers no Introduce at all.
 * A Commenter therefore cannot see the Moderator's stage screen. So the Commenter opens this
 * view from the paper's card ("Take notes"): the same paper, filling the screen, and under it
 * one note field per sponsor, three side by side. The Moderator does not get it: they run the
 * floor and the clock (the comment dock is Commenter-only for the same reason).
 *
 * The whole view fits the console (FitToScreen lays it out 820 px tall): the top bar 44, this
 * view's bar 56, the notes panel NOTES_PANEL_H, and the paper takes the rest (about 460 px).
 * Nothing in it scrolls but the paper itself and, if several other chairs wrote on the same
 * sponsor, their few lines inside that card.
 *
 * More than three sponsors: three at a time, with a flag strip and arrows to page (a flag
 * brings its page in). Drafts of sponsors paged away are kept and saved all the same.
 *
 * Storage and the author rule: src/lib/documentNotes.ts. The local draft always wins over a
 * refetch; a row is adopted only to learn its id. Saved on a pause in typing (700 ms), on blur,
 * on leaving the view and on pagehide.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Info } from 'lucide-react';
import { useT, useLanguage } from '@/contexts/LanguageContext';
import { SeatCircleFlag } from '@/components/CircleFlag';
import { getCountryDisplayName } from '@/lib/countries';
import type { Committee, CommitteeDocument } from '@/lib/types';
import { insertDocumentNote, loadDocumentNotes, updateDocumentNote, type DocumentNote } from '@/lib/documentNotes';

export const NOTES_PANEL_H = 256;
const PER_PAGE = 3;
const SAVE_DELAY_MS = 700;
const POLL_MS = 15_000;
const FONT = "var(--font-brand), sans-serif";

type Status = 'idle' | 'saving' | 'saved' | 'failed';
type Mine = { id: string | null; text: string; status: Status };
type Other = { chairName: string; content: string };

export default function SponsorNotesView({ committee, doc, chairName, readOnly, onBack, paper, feedbackVersion }: {
  committee: Committee;
  doc: CommitteeDocument;
  /** This chair's identity (`?chairName=`). Rows are claimed and edited by it only. */
  chairName: string;
  /** Ended session: everything is shown, nothing is written. */
  readOnly: boolean;
  onBack: () => void;
  /** The paper, drawn by DocumentsModal exactly as on the stage screen. */
  paper: React.ReactNode;
  /** Bumped by the chair page on every `feedback` realtime event (optional; a 15 s poll
   *  covers a page that does not pass it). */
  feedbackVersion?: number;
}) {
  const t = useT();
  const { language } = useLanguage();
  const sponsors = doc.sponsors;
  const code = committee.code;
  const suffix = committee.dbChairJoinSuffix ?? undefined;

  const [mine, setMine] = useState<Record<string, Mine>>({});
  const [others, setOthers] = useState<Record<string, Other[]>>({});
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(sponsors.length / PER_PAGE));
  const pageNow = Math.min(page, pages - 1);
  const visible = sponsors.slice(pageNow * PER_PAGE, pageNow * PER_PAGE + PER_PAGE);

  // Refs the async savers read, so a save always sends the latest text.
  const mineRef = useRef(mine);
  useEffect(() => { mineRef.current = mine; }, [mine]);
  const dirty = useRef<Set<string>>(new Set());
  const inflight = useRef<Set<string>>(new Set());
  const again = useRef<Set<string>>(new Set());
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const focused = useRef<string | null>(null);
  const loaded = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const patch = useCallback((country: string, p: Partial<Mine>) => {
    const cur = mineRef.current[country] ?? { id: null, text: '', status: 'idle' as Status };
    const next = { ...mineRef.current, [country]: { ...cur, ...p } };
    mineRef.current = next;
    if (alive.current) setMine(next);
  }, []);

  const save = useCallback(async (country: string): Promise<void> => {
    if (readOnly || !chairName) return;
    const tm = timers.current.get(country);
    if (tm) { clearTimeout(tm); timers.current.delete(country); }
    if (!dirty.current.has(country)) return;
    if (inflight.current.has(country)) { again.current.add(country); return; }
    const cur = mineRef.current[country];
    if (!cur) return;
    // Until the first read has come back we do not know whether this chair already has a row
    // for this sponsor: inserting now would make a duplicate. The load saves it when it lands.
    if (!cur.id && !loaded.current) return;
    const text = cur.text;
    if (!cur.id && !text.trim()) { dirty.current.delete(country); return; }
    inflight.current.add(country);
    patch(country, { status: 'saving' });
    let ok: boolean;
    if (cur.id) {
      ok = await updateDocumentNote(cur.id, chairName, text, code, suffix);
    } else {
      const id = await insertDocumentNote(committee.id, country, chairName, text, doc.docCode, code, suffix);
      ok = !!id;
      if (id) patch(country, { id });
    }
    inflight.current.delete(country);
    const latest = mineRef.current[country]?.text ?? text;
    if (ok && latest === text) dirty.current.delete(country);
    patch(country, { status: ok ? (latest === text ? 'saved' : 'idle') : 'failed' });
    // Typed again while this was in flight: send the newer text now.
    if (ok && (again.current.has(country) || latest !== text)) {
      again.current.delete(country);
      void save(country);
    } else {
      again.current.delete(country);
    }
  }, [readOnly, chairName, code, suffix, committee.id, doc.docCode, patch]);

  const saveRef = useRef(save);
  useEffect(() => { saveRef.current = save; }, [save]);

  const flushAll = useCallback(() => {
    for (const c of Array.from(dirty.current)) void saveRef.current(c);
  }, []);

  const onType = (country: string, text: string) => {
    if (readOnly) return;
    dirty.current.add(country);
    patch(country, { text, status: mineRef.current[country]?.status === 'failed' ? 'failed' : 'idle' });
    const tm = timers.current.get(country);
    if (tm) clearTimeout(tm);
    timers.current.set(country, setTimeout(() => { timers.current.delete(country); void saveRef.current(country); }, SAVE_DELAY_MS));
  };

  // ── Reading the notes: on open, on every feedback event, and every 15 s while visible ──
  const load = useCallback(async () => {
    const rows = await loadDocumentNotes(committee.id, doc.docCode, code, suffix);
    if (!rows || !alive.current) return;   // a failed read changes nothing
    const ownBy: Record<string, DocumentNote> = {};
    const otherBy: Record<string, Record<string, DocumentNote>> = {};
    for (const r of rows) {
      if (r.chairName === chairName) {
        // Duplicates are possible (two tabs): the one with prose wins, else the newest.
        const prev = ownBy[r.country];
        if (!prev || r.content.trim() || !prev.content.trim()) ownBy[r.country] = r;
      } else {
        const bucket = (otherBy[r.country] ??= {});
        const prev = bucket[r.chairName];
        if (!prev || r.content.trim() || !prev.content.trim()) bucket[r.chairName] = r;
      }
    }
    const next = { ...mineRef.current };
    for (const [country, r] of Object.entries(ownBy)) {
      const cur = next[country];
      if (!cur) { next[country] = { id: r.id, text: r.content, status: 'idle' }; continue; }
      // The local draft always wins: a refetch only teaches us the row id, and replaces the
      // text only when nothing is being typed or waiting to be saved there.
      const keepLocal = dirty.current.has(country) || focused.current === country || inflight.current.has(country);
      next[country] = { ...cur, id: cur.id ?? r.id, text: keepLocal ? cur.text : r.content };
    }
    mineRef.current = next;
    setMine(next);
    const o: Record<string, Other[]> = {};
    for (const [country, byChair] of Object.entries(otherBy)) {
      const list = Object.values(byChair).filter((r) => r.content.trim()).map((r) => ({ chairName: r.chairName, content: r.content.trim() }));
      if (list.length) o[country] = list;
    }
    setOthers(o);
    if (!loaded.current) {
      loaded.current = true;
      // Anything typed before the first read could not be inserted yet (see save).
      flushAll();
    }
  }, [committee.id, doc.docCode, code, suffix, chairName, flushAll]);

  useEffect(() => {
    // Async read: every setState in `load` happens after an await.
    void load();
  }, [load, feedbackVersion]);

  useEffect(() => {
    const id = setInterval(() => { if (document.visibilityState === 'visible') void load(); }, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  // Leaving the view (or the page) saves what is waiting.
  useEffect(() => {
    const onHide = () => flushAll();
    window.addEventListener('pagehide', onHide);
    const timerMap = timers.current;
    return () => {
      window.removeEventListener('pagehide', onHide);
      for (const tm of timerMap.values()) clearTimeout(tm);
      timerMap.clear();
      flushAll();
    };
  }, [flushAll]);

  const name = (c: string) => getCountryDisplayName(c, language);
  const cols = Math.max(1, Math.min(PER_PAGE, visible.length));

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* The view's bar: back, the paper's code and title. */}
      <div className="relative z-[30] flex items-center gap-3 px-4 h-14 shrink-0 bg-[#F6F1E6]" style={{ boxShadow: '0 1px 0 rgba(28,20,16,0.08)' }}>
        <button type="button" onClick={() => { flushAll(); onBack(); }}
          aria-label={t('dnotes_back')} title={t('dnotes_back')}
          className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-white text-[#1B3828] hover:bg-[#FAF8F3] transition-[background-color,transform] duration-150 active:scale-[0.96] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
          style={{ boxShadow: '0 0 0 1px rgba(28,20,16,0.08), 0 1px 3px rgba(27,56,40,0.12)' }}>
          <ArrowLeft size={18} strokeWidth={2.4} aria-hidden className="rtl:rotate-180" />
        </button>
        <span className="shrink-0 h-7 px-2.5 rounded-lg flex items-center text-[14.5px] font-semibold tabular-nums"
          style={{ color: '#1B3828', backgroundColor: 'rgba(27,56,40,0.08)', fontFamily: FONT }}>{doc.docCode}</span>
        <span className="text-[17px] font-semibold truncate min-w-0" style={{ color: '#1C1410', fontFamily: FONT }} title={doc.title}>{doc.title}</span>
      </div>

      <div className="flex-1 min-h-0 relative">{paper}</div>

      {/* The notes: one field per sponsor, three side by side, never scrolling. */}
      <section aria-label={t('dnotes_heading')} className="shrink-0 flex flex-col gap-2 px-4 pt-2.5 pb-3 bg-[#F6F1E6]"
        style={{ height: NOTES_PANEL_H, boxShadow: '0 -1px 0 rgba(28,20,16,0.08), 0 -6px 18px rgba(27,56,40,0.08)', fontFamily: FONT }}>
        <div className="flex items-center gap-2 h-7 shrink-0 min-w-0">
          <h2 className="text-[14px] font-semibold shrink-0" style={{ color: '#1B3828' }}>{t('dnotes_heading')}</h2>
          <span role="img" aria-label={readOnly ? t('dnotes_read_only') : t('dnotes_hint')} title={readOnly ? t('dnotes_read_only') : t('dnotes_hint')}
            className="shrink-0 flex text-[#8A7B6A]">
            <Info size={15} strokeWidth={2.2} aria-hidden />
          </span>
          {readOnly && <span className="text-[12px] min-w-0" style={{ color: '#5C4E40' }}>{t('dnotes_read_only')}</span>}
          {pages > 1 && (
            <div className="ms-auto flex items-center gap-1.5 shrink-0">
              <button type="button" onClick={() => setPage(Math.max(0, pageNow - 1))} disabled={pageNow === 0}
                aria-label={t('dnotes_prev')} title={t('dnotes_prev')}
                className="w-7 h-7 rounded-full flex items-center justify-center text-[#5C4E40] hover:bg-[#1B3828]/[0.08] disabled:opacity-35 disabled:hover:bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]">
                <ChevronLeft size={16} strokeWidth={2.4} aria-hidden className="rtl:rotate-180" />
              </button>
              <div className="flex items-center gap-1">
                {sponsors.map((s, i) => {
                  const on = Math.floor(i / PER_PAGE) === pageNow;
                  return (
                    <button key={`${s}-${i}`} type="button" onClick={() => setPage(Math.floor(i / PER_PAGE))}
                      aria-label={t('dnotes_show', { country: name(s) })} title={name(s)} aria-pressed={on}
                      className="rounded-full flex focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
                      style={{ boxShadow: on ? '0 0 0 2px #F6F1E6, 0 0 0 3.5px #1B3828' : 'none', opacity: on ? 1 : 0.6 }}>
                      <SeatCircleFlag country={s} size={22} decorative />
                    </button>
                  );
                })}
              </div>
              <span className="text-[12px] tabular-nums px-1" style={{ color: '#5C4E40' }}>
                {t('dnotes_page', { from: String(pageNow * PER_PAGE + 1), to: String(Math.min(sponsors.length, pageNow * PER_PAGE + PER_PAGE)), total: String(sponsors.length) })}
              </span>
              <button type="button" onClick={() => setPage(Math.min(pages - 1, pageNow + 1))} disabled={pageNow >= pages - 1}
                aria-label={t('dnotes_next')} title={t('dnotes_next')}
                className="w-7 h-7 rounded-full flex items-center justify-center text-[#5C4E40] hover:bg-[#1B3828]/[0.08] disabled:opacity-35 disabled:hover:bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]">
                <ChevronRight size={16} strokeWidth={2.4} aria-hidden className="rtl:rotate-180" />
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 min-h-0 grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {visible.map((country) => {
            const m = mine[country];
            const list = others[country] ?? [];
            const label = name(country);
            const fieldId = `dnote-${doc.id}-${country.replace(/[^a-z0-9]+/gi, '-')}`;
            return (
              <div key={country} className="min-h-0 flex flex-col gap-2 rounded-2xl bg-white p-3 overflow-hidden"
                style={{ boxShadow: '0 0 0 1px rgba(28,20,16,0.06), 0 1px 3px rgba(27,56,40,0.08), 0 8px 20px rgba(27,56,40,0.08)' }}>
                <div className="flex items-start gap-2 shrink-0 min-w-0">
                  <SeatCircleFlag country={country} size={30} decorative />
                  {/* The delegation's name is never cut: it wraps instead. */}
                  <label htmlFor={fieldId} className="flex-1 min-w-0 text-[15px] font-semibold leading-tight pt-[5px] [overflow-wrap:anywhere]" style={{ color: '#1C1410' }}>
                    {label}
                  </label>
                  <SaveState status={m?.status ?? 'idle'} onRetry={() => { dirty.current.add(country); void save(country); }} />
                </div>
                <textarea
                  id={fieldId}
                  value={m?.text ?? ''}
                  readOnly={readOnly}
                  onChange={(e) => onType(country, e.target.value)}
                  onFocus={() => { focused.current = country; }}
                  onBlur={() => { if (focused.current === country) focused.current = null; void save(country); }}
                  aria-label={t('dnotes_field_label', { country: label })}
                  placeholder={readOnly ? '' : t('dnotes_placeholder', { country: label })}
                  className="flex-1 min-h-[56px] w-full resize-none rounded-xl px-3 py-2 text-[14px] leading-snug bg-[#FAF8F3] text-[#1C1410] placeholder-[#9A8A78] focus:outline-none focus:ring-2 focus:ring-[#1B3828]/40"
                  style={{ boxShadow: 'inset 0 0 0 1px rgba(28,20,16,0.08)', fontFamily: FONT }}
                />
                {list.length > 0 && (
                  <div className="shrink-0 max-h-[72px] overflow-y-auto text-[12.5px] leading-snug space-y-1" aria-label={t('dnotes_other_chairs')}>
                    {list.map((o) => (
                      <p key={o.chairName} className="whitespace-pre-wrap [overflow-wrap:anywhere]" style={{ color: '#5C4E40' }}>
                        <span className="font-semibold" style={{ color: '#1B3828' }}>{o.chairName}</span>{' '}{o.content}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function SaveState({ status, onRetry }: { status: Status; onRetry: () => void }) {
  const t = useT();
  if (status === 'idle') return null;
  if (status === 'failed') {
    return (
      <span role="alert" className="shrink-0 flex items-center gap-1.5 text-[11.5px] pt-[7px]" style={{ color: '#8B2020' }}>
        {t('dnotes_failed')}
        <button type="button" onClick={onRetry} className="font-semibold underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8B2020] rounded">
          {t('dnotes_retry')}
        </button>
      </span>
    );
  }
  return (
    <span aria-live="polite" className="shrink-0 text-[11.5px] pt-[7px]" style={{ color: '#8A7B6A' }}>
      {status === 'saving' ? t('dnotes_saving') : t('dnotes_saved')}
    </span>
  );
}
