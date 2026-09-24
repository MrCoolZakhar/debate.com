'use client';

// The public committee card's pieces that the card and its "Show more" pop-up
// share: the dais (only chairs who accepted, linked to their MUN CV) and the
// pop-up with the committee's full information. Kept out of
// ConferenceDetailClient.tsx so that file only mounts them.

import { useEffect, useRef, type CSSProperties } from 'react';
import { X, Languages } from 'lucide-react';
import { committeeLanguageFlag } from '@/lib/committeeLanguage';
import { CircleFlag } from '@/components/CircleFlag';
import Portal from '@/components/Portal';
import ProfileLink from '@/components/ProfileLink';
import { DifficultyTile } from '@/components/DifficultyTile';
import { truncateAtWord } from '@/components/TruncatedTopic';
import { useScrollLock } from '@/hooks/useScrollLock';
import { chairTitleLabel } from '@/lib/chairTitles';

const FONT = "var(--font-brand), sans-serif";
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];

/** How much of each topic the card shows before "Show more". */
export const CARD_TOPIC_MAX = 120;

export interface DaisChair {
  name: string;
  avatar_url: string | null;
  /** Display-only title (src/lib/chairTitles.ts): Chair, Vice Chair, ... Absent = none. */
  title?: string | null;
}

/**
 * The committee's dais. `display_chairs` is trigger-maintained from
 * `chair_user_ids`, so it only ever holds chairs who ACCEPTED; nothing here
 * renders a placeholder for an invite. A chair links to their public CV only
 * when `chair_user_ids` lines up with `display_chairs` (same length, same
 * order from the trigger); otherwise the name is shown unlinked rather than
 * risk pointing at the wrong person.
 *
 * Up to 3 chairs sit in one row at full size. From 4 they are drawn smaller
 * and split over two rows (the first row takes the extra one when odd).
 */
export function CommitteeDais({
  chairs,
  chairIds,
  size = 'card',
}: {
  chairs: DaisChair[];
  chairIds: string[] | null;
  size?: 'card' | 'dialog';
}) {
  if (chairs.length === 0) return null;
  const linkable = (chairIds ?? []).length === chairs.length;
  const many = chairs.length > 3;
  const avatar = many ? (size === 'dialog' ? 46 : 42) : 52;
  const itemW = many ? (size === 'dialog' ? 88 : 78) : 96;
  const nameSize = many ? 10.5 : 11.5;
  const rows = many
    ? [chairs.slice(0, Math.ceil(chairs.length / 2)), chairs.slice(Math.ceil(chairs.length / 2))]
    : [chairs];
  let offset = 0;

  return (
    <div className="flex flex-col items-center" style={{ gap: many ? 14 : 0 }}>
      {rows.map((row, ri) => {
        const start = offset;
        offset += row.length;
        return (
          <div key={ri} className="flex items-start justify-center" style={{ gap: many ? 12 : 24 }}>
            {row.map((ch, i) => {
              const idx = start + i;
              const uid = linkable ? (chairIds ?? [])[idx] : null;
              const title = chairTitleLabel(ch.title);
              const inner = (
                <>
                  <PersonAvatar name={ch.name} url={ch.avatar_url} px={avatar} />
                  <span
                    className="font-semibold mt-2 leading-tight"
                    style={{ color: 'var(--gv-on-surface)', fontFamily: FONT, fontSize: nameSize, overflowWrap: 'anywhere' }}
                  >
                    {ch.name}
                  </span>
                  {title && (
                    <span
                      className="mt-0.5 leading-tight"
                      style={{ color: 'var(--gv-on-surface)', opacity: 0.7, fontFamily: FONT, fontSize: nameSize - 1.5, fontWeight: 500 }}
                    >
                      {title}
                    </span>
                  )}
                </>
              );
              const cls = 'flex flex-col items-center text-center';
              return uid ? (
                <ProfileLink
                  key={`${ch.name}-${idx}`}
                  userId={uid}
                  name={ch.name}
                  className={`${cls} rounded-lg transition-transform hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--gv-main)]`}
                  style={{ width: itemW }}
                >
                  {inner}
                </ProfileLink>
              ) : (
                <div key={`${ch.name}-${idx}`} className={cls} style={{ width: itemW }}>
                  {inner}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

/** Round photo, or the initial on forest. Shared by the dais and the Secretariat. */
export function PersonAvatar({ name, url, px }: { name: string; url: string | null; px: number }) {
  const base: CSSProperties = {
    width: px, height: px, borderRadius: 9999, flexShrink: 0,
    boxShadow: '0 4px 12px color-mix(in srgb, var(--gv-main) 22%, transparent)',
  };
  if (url) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={url}
        alt={name}
        style={{ ...base, objectFit: 'cover', backgroundColor: 'var(--gv-bg)', outline: '1px solid rgba(0,0,0,0.1)', outlineOffset: '-1px' }}
      />
    );
  }
  return (
    <span
      className="flex items-center justify-center"
      style={{ ...base, backgroundColor: 'var(--gv-main)', color: 'var(--gv-on-main)', fontSize: Math.round(px / 3.1), fontWeight: 700, fontFamily: FONT }}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

/** True when the card cuts at least one topic, i.e. "Show more" has something to show. */
export function committeeHasMore(topics: string[] | null): boolean {
  return (topics ?? []).some((t) => Array.from(t).length > CARD_TOPIC_MAX);
}

export interface CommitteeInfo {
  id: string;
  name: string;
  abbreviation: string | null;
  topics: string[] | null;
  difficulty: string;
  committee_type: string;
  logo_url: string | null;
  display_chairs: DaisChair[] | null;
  chair_user_ids: string[] | null;
  /** conference_committees.working_language; absent or null = not set, print nothing. */
  working_language?: string | null;
}

/**
 * The full committee: emblem, name, level, seats line, every topic in full,
 * and the dais. Portal at fixed coordinates, so no card or scroller can clip
 * it; Escape and the backdrop close it; Tab stays inside; focus returns to
 * the button that opened it.
 */
export function CommitteeInfoDialog({
  committee: c,
  seatsLine,
  onClose,
}: {
  committee: CommitteeInfo;
  seatsLine: string;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useScrollLock(true);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    // Portal mounts its target in an effect, so the panel exists one frame later.
    const raf = requestAnimationFrame(() => closeRef.current?.focus());
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const nodes = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'),
      );
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !panelRef.current.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !panelRef.current.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey, true);
      opener?.focus?.();
    };
  }, []);

  const isCrisis = c.committee_type === 'crisis';
  const chairs = c.display_chairs ?? [];
  const titleId = `committee-info-${c.id}`;

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center px-4 sm:px-6"
        style={{ backgroundColor: 'color-mix(in srgb, var(--gv-on-bg) 45%, transparent)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
        onClick={onClose}
      >
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-lg rounded-[24px] flex flex-col"
          style={{ maxHeight: '86%', backgroundColor: 'var(--gv-surface)', border: '1px solid var(--gv-border)', boxShadow: '0 28px 72px rgba(16,28,21,0.35)' }}
        >
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute flex items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--gv-main)]"
            style={{ top: 14, right: 14, width: 32, height: 32, border: '1px solid var(--gv-border)', color: 'var(--gv-on-surface)', backgroundColor: 'var(--gv-surface)', cursor: 'pointer', zIndex: 1 }}
          >
            <X size={15} />
          </button>

          <div className="overflow-y-auto px-6 pt-7 pb-7" style={{ overscrollBehavior: 'contain' }}>
            <div className="flex flex-col items-center text-center">
              {c.logo_url && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={c.logo_url}
                  alt=""
                  style={{ width: 88, height: 88, objectFit: 'contain', filter: 'drop-shadow(0 10px 18px color-mix(in srgb, var(--gv-main) 28%, transparent))', marginBottom: 14 }}
                />
              )}
              {/* The acronym alone, small above the name, and never the name
                  twice. The working language moved to the meta line below
                  (owner, 23 Sep 2026: acronym and language no longer stacked). */}
              {c.abbreviation?.trim() && c.abbreviation.trim().toUpperCase() !== c.name.trim().toUpperCase() && (
                <p style={{ fontFamily: FONT, fontWeight: 700, fontSize: 12, letterSpacing: '0.14em', color: 'var(--gv-accent)', margin: 0 }}>
                  {c.abbreviation.trim()}
                </p>
              )}
              <h2 id={titleId} className="font-bold leading-snug" style={{ fontFamily: FONT, fontSize: 20, color: 'var(--gv-on-surface)', margin: '6px 0 0 0', textWrap: 'balance' }}>
                {c.name}
              </h2>
              <div className="flex items-center justify-center gap-3 mt-3 flex-wrap">
                {c.difficulty && <DifficultyTile level={c.difficulty} size="sm" />}
                <span style={{ fontFamily: FONT, fontSize: 12.5, fontWeight: 600, color: '#6B5F52' }}>
                  {seatsLine}{isCrisis ? ' · Crisis' : ''}
                </span>
                {c.working_language && (
                  <span className="inline-flex items-center gap-1" title="Working language" style={{ fontFamily: FONT, fontSize: 12.5, fontWeight: 600, color: '#6B5F52' }}>
                    {committeeLanguageFlag(c.working_language)
                      ? <CircleFlag code={committeeLanguageFlag(c.working_language)!} size={15} decorative />
                      : <Languages size={13} aria-hidden style={{ color: 'var(--gv-accent)' }} />}
                    {c.working_language}
                  </span>
                )}
              </div>
            </div>

            {c.topics && c.topics.length > 0 && (
              <section className="mt-6 pt-5" style={{ borderTop: '1px solid color-mix(in srgb, var(--gv-border) 55%, transparent)' }}>
                <p style={{ fontFamily: FONT, fontWeight: 700, fontSize: 10, letterSpacing: '0.14em', color: 'var(--gv-accent)', margin: '0 0 10px 0' }}>
                  {c.topics.length === 1 ? 'TOPIC' : 'TOPICS'}
                </p>
                {c.topics.map((topic, ti) => (
                  <div key={`${ti}-${topic}`} className="flex items-start gap-3 py-1.5">
                    <span className="flex-shrink-0 text-right" style={{ fontFamily: FONT, fontWeight: 600, fontVariantNumeric: 'tabular-nums', fontSize: 12, color: 'var(--gv-accent)', width: 22, lineHeight: '22px' }}>
                      {ROMAN[ti] ?? String(ti + 1)}.
                    </span>
                    <span style={{ fontFamily: FONT, fontSize: 14, fontWeight: 500, color: '#2E2820', lineHeight: 1.6, textWrap: 'pretty' }}>
                      {topic}
                    </span>
                  </div>
                ))}
              </section>
            )}

            {chairs.length > 0 && (
              <section className="mt-6 pt-5" style={{ borderTop: '1px solid color-mix(in srgb, var(--gv-border) 55%, transparent)' }}>
                <p style={{ fontFamily: FONT, fontWeight: 700, fontSize: 10, letterSpacing: '0.14em', color: 'var(--gv-accent)', margin: '0 0 14px 0', textAlign: 'center' }}>
                  {chairs.length === 1 ? 'CHAIR' : 'CHAIRS'}
                </p>
                <CommitteeDais chairs={chairs} chairIds={c.chair_user_ids} size="dialog" />
              </section>
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
}

/** The card's topic text: at most CARD_TOPIC_MAX characters, the full text kept for screen readers and SEO. */
export function CardTopic({ text }: { text: string }) {
  if (Array.from(text).length <= CARD_TOPIC_MAX) return <>{text}</>;
  return (
    <>
      <span aria-hidden="true">{truncateAtWord(text, CARD_TOPIC_MAX)}</span>
      <span className="sr-only">{text}</span>
    </>
  );
}
