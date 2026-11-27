'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Gamepad2 } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { GoldWord } from '@/components/BrandHeading';
import { TierIcon } from '@/components/munillion/PixelArt';
import { conferenceHref, munHistory, tierMeta, MAX_POINTS, type MunHistory, type MunHistoryPlay } from '@/lib/munillion';
import { friendlyError } from '@/lib/friendlyError';
import { notifyErr } from '@/lib/appNotify';
import { T } from '../accountUi';
import { AccountHero, HeroOverlap, RaisedCard, SectionHeading, FOREST, INK, INK_SOFT, DEEP_GOLD } from '../accountShell';

const FONT = 'var(--font-brand), sans-serif';
const LOAD_FAILED = 'Could not load your games. Try again.';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 'YYYY-MM-DD' as "27 Nov 2026" (no time zone maths: the date is a plain calendar day). */
function formatGameDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  if (!m) return iso ?? '';
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1] ?? ''} ${m[1]}`;
}

function sameText(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function Skeleton({ h, w = '100%', r = 12 }: { h: number; w?: number | string; r?: number }) {
  return <div aria-hidden className="animate-pulse" style={{ height: h, width: w, borderRadius: r, background: 'rgba(27,56,40,0.08)' }} />;
}

export default function GamesPage() {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;
  const [data, setData] = useState<MunHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  // Keyed on the user id, never the token. The wrapper reads a fresh client itself.
  const load = useCallback(async (isCancelled: () => boolean) => {
    setLoading(true);
    setFailed(false);
    try {
      const res = await munHistory();
      if (isCancelled()) return;
      if (!res || !res.ok) throw new Error('munillion_history refused');
      setData(res);
    } catch (e) {
      if (isCancelled()) return;
      setFailed(true);
      notifyErr(friendlyError(e, LOAD_FAILED));
    } finally {
      if (!isCancelled()) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading || !userId) return;
    let cancelled = false;
    void load(() => cancelled);
    return () => { cancelled = true; };
  }, [authLoading, userId, load]);

  const plays = data?.plays ?? [];
  const streak = data?.streak ?? 0;
  const played = data?.played ?? plays.length;
  const best = data?.best ?? 0;

  const stats = [
    { value: streak, word: 'day streak' },
    { value: played, word: played === 1 ? 'Game played' : 'Games played' },
    { value: best, word: `Best score out of ${MAX_POINTS}` },
  ];

  return (
    <div>
      <AccountHero
        label="MUNillion"
        title={<>Your <GoldWord>Games</GoldWord></>}
        line="Every daily MUNillion you have played, answer by answer"
      />

      <HeroOverlap>
        <RaisedCard className="grid grid-cols-3 gap-2 md:gap-3">
          {stats.map((s) => (
            <div
              key={s.word}
              className="rounded-[18px] px-3 py-3 md:px-5 md:py-4 text-center"
              style={{ backgroundColor: 'rgba(27,56,40,0.035)', minWidth: 0 }}
            >
              {loading ? (
                <div className="flex justify-center"><Skeleton h={40} w={64} r={10} /></div>
              ) : (
                <p style={{ margin: 0, fontFamily: FONT, fontWeight: 800, fontSize: 'clamp(30px, 6vw, 44px)', lineHeight: 1, letterSpacing: '-0.03em', color: FOREST, fontVariantNumeric: 'tabular-nums' }}>
                  {s.value}
                </p>
              )}
              <p lang="en" className="[hyphens:auto] max-sm:!text-[11px]" style={{ margin: '6px 0 0', fontFamily: FONT, fontWeight: 600, fontSize: T.caption + 1, color: INK_SOFT }}>
                {s.word}
              </p>
            </div>
          ))}
        </RaisedCard>
      </HeroOverlap>

      <div className="mt-6 px-2 sm:px-4 md:px-6">
        <SectionHeading title="Game History" count={loading || failed ? undefined : plays.length} />

        {loading ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {[0, 1].map((i) => (
              <RaisedCard key={i} as="div" className="flex flex-col gap-3">
                <Skeleton h={26} w="55%" />
                {Array.from({ length: 7 }).map((_, j) => <Skeleton key={j} h={36} />)}
              </RaisedCard>
            ))}
          </div>
        ) : failed ? (
          <RaisedCard className="text-center !py-10">
            <p style={{ margin: '0 0 16px', fontFamily: FONT, fontSize: T.body + 2, fontWeight: 700, color: INK }}>
              We could not load your games
            </p>
            <button type="button" onClick={() => void load(() => false)} className="gv-acct-btn">
              Try again
            </button>
          </RaisedCard>
        ) : plays.length === 0 ? (
          <RaisedCard className="flex flex-col items-center gap-3 text-center !py-12">
            <Gamepad2 size={40} strokeWidth={1.5} style={{ color: FOREST }} aria-hidden />
            <p style={{ margin: 0, fontFamily: FONT, fontSize: T.body + 2, fontWeight: 700, color: INK }}>
              You have not played MUNillion yet
            </p>
            <Link href="/games" className="gv-acct-link focus:outline-none" style={{ fontFamily: FONT, fontSize: T.body + 1 }}>
              Play today&apos;s MUNillion
            </Link>
          </RaisedCard>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {plays.map((play) => <GameCard key={play.number} play={play} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function GameCard({ play }: { play: MunHistoryPlay }) {
  const answers = [...play.answers].sort((a, b) => a.position - b.position);
  return (
    <RaisedCard as="article" className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h3 style={{ margin: 0, fontFamily: FONT, fontWeight: 800, fontSize: T.section - 2, letterSpacing: '-0.01em', color: INK }}>
            MUNillion #{play.number}
          </h3>
          <p style={{ margin: '2px 0 0', fontFamily: FONT, fontSize: T.body, color: INK_SOFT }}>
            {formatGameDate(play.date)}
            {!play.finished && <span> · Not finished</span>}
          </p>
        </div>
        <p className="flex items-baseline gap-1.5 flex-shrink-0" style={{ margin: 0, fontFamily: FONT, color: INK_SOFT, fontSize: T.body }}>
          <span style={{ fontWeight: 800, fontSize: 32, lineHeight: 1, letterSpacing: '-0.03em', color: FOREST, fontVariantNumeric: 'tabular-nums' }}>
            {play.total}
          </span>
          points
        </p>
      </div>

      <ol className="flex flex-col" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
        {answers.map((a) => {
          const tier = tierMeta(a.tier);
          const shown = (a.label ?? '').trim() || (a.typed ?? '').trim();
          const typedDiffers = !!a.label && !!a.typed && !sameText(a.label, a.typed);
          return (
            <li
              key={a.position}
              className="flex items-start gap-3 py-3"
              style={{ borderTop: '1px solid rgba(27,56,40,0.08)' }}
            >
              <span className="flex-shrink-0" style={{ marginTop: 2 }}>
                <TierIcon tier={a.tier} size={28} label={tier.name} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="[overflow-wrap:anywhere]" style={{ margin: 0, fontFamily: FONT, fontSize: T.caption, color: INK_SOFT }}>
                  {a.position}. {a.prompt}
                </p>
                <p className="[overflow-wrap:anywhere]" style={{ margin: '2px 0 0', fontFamily: FONT, fontSize: T.body + 1, fontWeight: 700, color: INK }}>
                  {shown ? (
                    a.slug ? (
                      <a
                        href={conferenceHref(a.slug)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="gv-acct-link focus:outline-none"
                      >
                        {shown}
                      </a>
                    ) : shown
                  ) : (
                    <span style={{ fontWeight: 600, color: INK_SOFT }}>No answer</span>
                  )}
                </p>
                {typedDiffers && (
                  <p className="[overflow-wrap:anywhere]" style={{ margin: '2px 0 0', fontFamily: FONT, fontSize: T.caption, color: INK_SOFT }}>
                    You typed {a.typed}
                  </p>
                )}
                {a.sub && (
                  <p className="[overflow-wrap:anywhere]" style={{ margin: '2px 0 0', fontFamily: FONT, fontSize: T.caption, color: INK_SOFT }}>
                    {a.sub}
                  </p>
                )}
              </div>
              <p className="text-right flex-shrink-0" style={{ margin: 0, fontFamily: FONT, fontSize: T.caption + 1, color: INK_SOFT, maxWidth: 130 }}>
                <span style={{ display: 'block', fontWeight: 800, fontSize: T.body + 2, color: a.tier ? DEEP_GOLD : INK_SOFT, fontVariantNumeric: 'tabular-nums' }}>
                  {tier.value}
                </span>
                {tier.name}
              </p>
            </li>
          );
        })}
      </ol>
    </RaisedCard>
  );
}
