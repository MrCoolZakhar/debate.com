'use client';

/**
 * ShareAchievementModal — the "Spotify-Wrapped" congratulations moment.
 *
 * Fires once, right after a NEW entry is saved to a delegate's MUN CV (an ADD,
 * never an edit or delete). It celebrates the achievement with a gorgeous
 * gold-foil share card — conference logo + name, committee / allocation, any
 * award, the delegate's name and Gavelling Conferences branding — then invites
 * them to share it: the native Web Share sheet where available, with X /
 * WhatsApp / LinkedIn / copy-link fallbacks.
 *
 * Purely presentational + share plumbing. It writes nothing to the DB — the
 * parent has already persisted the entry before opening this. Renders nothing
 * when !open. Matches the forest/ivory neumorphic system used across /account.
 */

import { useEffect, useMemo, useState, useCallback } from 'react';
import { Share2, Link2, Check, Sparkles } from 'lucide-react';
import Portal from '@/components/Portal';
import { LogoDisc } from '@/components/LogoDisc';
import { AwardChip, AwardArtwork, monogramFor, OUTFIT } from '@/app/account/accountUi';
import type { CVEntry } from '@/components/CVEntryModal';
import { useScrollLock } from '@/hooks/useScrollLock';

export function ShareAchievementModal({
  open,
  onClose,
  entry,
  profileName,
  cvShareUrl,
}: {
  open: boolean;
  onClose: () => void;
  /** The freshly-saved CV entry we are celebrating. */
  entry: CVEntry | null;
  /** The delegate's display name — printed on the card. */
  profileName: string;
  /** Pretty public CV link (e.g. /cv/jane-doe-8f0376f2) shared everywhere. */
  cvShareUrl: string;
}) {
  const [closing, setClosing] = useState(false);
  const [copied, setCopied] = useState(false);

  // Play a brief reverse animation before really unmounting (mirrors CVEntryModal).
  const requestClose = useCallback(() => {
    if (closing) return;
    setClosing(true);
    setTimeout(() => { setClosing(false); onClose(); }, 190);
  }, [closing, onClose]);

  // Confetti geometry — computed once per open so pieces don't jump on re-render.
  const confetti = useMemo(() => {
    const palette = ['#EED98A', '#B6871F', '#3D7A52', '#F3E3A1', '#FAF8F3'];
    return Array.from({ length: 16 }, (_, i) => ({
      left: `${(i * 6.1 + ((i * 37) % 11)) % 100}%`,
      delay: `${(i % 6) * 0.28}s`,
      dur: `${2.6 + ((i * 13) % 9) / 10}s`,
      size: 5 + ((i * 7) % 5),
      color: palette[i % palette.length],
      rot: (i * 47) % 360,
      round: i % 3 === 0,
    }));
  // Reshuffle each time the modal (re)opens for a fresh burst.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, entry?.id]);

  // Modal: the MUN CV page behind must not scroll while the card is up.
  useScrollLock(open && !!entry);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') requestClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, requestClose]);

  if (!open || !entry) return null;

  const award = entry.awards?.[0] ?? (entry.award && entry.award !== 'None' ? entry.award : null);
  const hasAward = !!award;
  // committee · allocation, whichever are present (secretariat/other put the
  // role title in `allocation`, so this reads naturally for every entry type).
  const metaParts = [entry.committee, entry.allocation].map((s) => (s ?? '').trim()).filter(Boolean);
  const metaLine = metaParts.join('  ·  ');

  const headline = hasAward ? 'An award for the record 🏆' : 'Another one for the record 🎉';
  const subline = hasAward
    ? 'Silverware on the shelf — let the world see it.'
    : 'Your Model UN journey just grew. Share the moment.';

  // Share plumbing ──────────────────────────────────────────────────────────
  const shareText = (() => {
    const bits = [`I just added ${entry.conference_name}`];
    if (entry.committee) bits.push(` (${entry.committee})`);
    bits.push(' to my Model UN CV');
    if (hasAward) bits.push(` — ${award}! 🏆`);
    else bits.push(' on Gavelling! 🎉');
    return bits.join('');
  })();
  const encMsg = encodeURIComponent(shareText);
  const encUrl = encodeURIComponent(cvShareUrl);

  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  async function handlePrimaryShare() {
    if (canNativeShare) {
      try {
        await navigator.share({ title: 'My Model UN CV', text: shareText, url: cvShareUrl });
        return;
      } catch {
        /* user cancelled or share failed — fall through to copy */
      }
    }
    await handleCopy();
  }

  async function handleCopy() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(cvShareUrl);
      } else {
        window.prompt('Copy your public CV link:', cvShareUrl);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      window.prompt('Copy your public CV link:', cvShareUrl);
    }
  }

  const socials: { key: string; label: string; href: string; bg: string; icon: React.ReactNode }[] = [
    {
      key: 'x',
      label: 'Share on X',
      href: `https://twitter.com/intent/tweet?text=${encMsg}&url=${encUrl}`,
      bg: '#111111',
      icon: (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.653l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
        </svg>
      ),
    },
    {
      key: 'whatsapp',
      label: 'Share on WhatsApp',
      href: `https://wa.me/?text=${encodeURIComponent(`${shareText} ${cvShareUrl}`)}`,
      bg: '#25D366',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.945C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 0 1 8.413 3.488 11.824 11.824 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24Zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 0 0 1.51 5.262l-.999 3.648 3.978-1.209Zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.767.967-.94 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414Z" />
        </svg>
      ),
    },
    {
      key: 'linkedin',
      label: 'Share on LinkedIn',
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encUrl}`,
      bg: '#0A66C2',
      icon: (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286ZM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065Zm1.782 13.019H3.555V9h3.564v11.452ZM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0Z" />
        </svg>
      ),
    },
  ];

  const KEYFRAMES = `
    @keyframes gvShareFade { from { opacity: 0 } to { opacity: 1 } }
    @keyframes gvSharePop {
      0%   { opacity: 0; transform: translateY(16px) scale(0.94) }
      60%  { opacity: 1; transform: translateY(-2px) scale(1.008) }
      100% { opacity: 1; transform: translateY(0) scale(1) }
    }
    @keyframes gvSharePopOut { from { opacity: 1; transform: none } to { opacity: 0; transform: translateY(8px) scale(0.97) } }
    @keyframes gvShimmer { 0% { transform: translateX(-120%) rotate(8deg) } 100% { transform: translateX(220%) rotate(8deg) } }
    @keyframes gvGlow { 0%,100% { opacity: 0.55 } 50% { opacity: 0.95 } }
    @keyframes gvFloat { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-4px) } }
    @keyframes gvConfetti {
      0%   { opacity: 0; transform: translateY(-8px) rotate(0deg) }
      12%  { opacity: 1 }
      100% { opacity: 0; transform: translateY(230px) rotate(320deg) }
    }
    @keyframes gvRise { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }
  `;

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center px-4 py-6 overflow-y-auto"
        style={{
          backgroundColor: 'rgba(20,14,10,0.55)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          animation: closing ? 'gvShareFade 180ms ease reverse forwards' : 'gvShareFade 200ms ease',
        }}
        onClick={requestClose}
        role="dialog"
        aria-modal="true"
        aria-label="Conference added to your MUN CV"
      >
        <style>{KEYFRAMES}</style>

        <div
          className="relative w-full max-w-[420px] my-auto"
          onClick={(e) => e.stopPropagation()}
          style={{
            animation: closing
              ? 'gvSharePopOut 180ms cubic-bezier(0.4,0,1,1) forwards'
              : 'gvSharePop 460ms cubic-bezier(0.16,1,0.3,1)',
          }}
        >
          {/* ── The share card — the hero. Deep forest with gold-foil glow. ── */}
          <div
            className="relative rounded-[26px] overflow-hidden"
            style={{
              background: 'linear-gradient(158deg, #21402D 0%, #16301F 52%, #0E2417 100%)',
              border: '1px solid rgba(238,217,138,0.35)',
              boxShadow: '0 30px 80px rgba(10,20,14,0.55), inset 0 1px 0 rgba(238,217,138,0.18)',
              padding: '30px 26px 26px',
            }}
          >
            {/* Gold radial bloom behind the crest */}
            <div
              aria-hidden
              className="absolute pointer-events-none"
              style={{
                top: '-30%', left: '50%', width: '340px', height: '340px',
                transform: 'translateX(-50%)',
                background: 'radial-gradient(circle, rgba(238,217,138,0.30) 0%, rgba(238,217,138,0.10) 40%, transparent 70%)',
                animation: 'gvGlow 3.4s ease-in-out infinite',
              }}
            />
            {/* Foil hairlines */}
            <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(120% 80% at 50% -10%, rgba(238,217,138,0.10), transparent 55%)' }} />

            {/* Shimmer sweep across the card */}
            <div aria-hidden className="absolute inset-0 pointer-events-none overflow-hidden">
              <div
                style={{
                  position: 'absolute', top: 0, bottom: 0, left: 0, width: '38%',
                  background: 'linear-gradient(100deg, transparent, rgba(255,255,255,0.14), transparent)',
                  animation: 'gvShimmer 3.8s ease-in-out 0.6s infinite',
                }}
              />
            </div>

            {/* Confetti burst */}
            <div aria-hidden className="absolute inset-0 pointer-events-none overflow-hidden">
              {confetti.map((c, i) => (
                <span
                  key={i}
                  style={{
                    position: 'absolute', top: '-10px', left: c.left,
                    width: `${c.size}px`, height: `${c.round ? c.size : c.size * 0.5}px`,
                    background: c.color,
                    borderRadius: c.round ? '9999px' : '1px',
                    transform: `rotate(${c.rot}deg)`,
                    opacity: 0,
                    animation: `gvConfetti ${c.dur} ease-in ${c.delay} infinite`,
                  }}
                />
              ))}
            </div>

            {/* Branding eyebrow */}
            <div className="relative flex items-center justify-center gap-1.5 mb-6" style={{ animation: 'gvRise 500ms cubic-bezier(0.16,1,0.3,1) 120ms both' }}>
              <Sparkles size={12} strokeWidth={2.4} style={{ color: '#EED98A' }} />
              <span style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: '10px', letterSpacing: '0.22em', textTransform: 'uppercase', color: '#EED98A' }}>
                Gavelling Conferences
              </span>
            </div>

            {/* Crest — logo, optionally with an award medallion notch */}
            <div className="relative flex justify-center mb-5" style={{ animation: 'gvRise 560ms cubic-bezier(0.16,1,0.3,1) 180ms both' }}>
              <div className="relative" style={{ animation: 'gvFloat 4.2s ease-in-out infinite' }}>
                <div style={{ filter: 'drop-shadow(0 10px 26px rgba(0,0,0,0.4))' }}>
                  <LogoDisc src={entry.logo_url} size={92} fallbackText={monogramFor(entry.conference_name)} />
                </div>
                {hasAward && (
                  <div
                    className="absolute flex items-center justify-center rounded-full"
                    style={{
                      right: -6, bottom: -6, width: 38, height: 38,
                      background: 'radial-gradient(120% 120% at 30% 25%, #FAF8F3 0%, #F3E3A1 60%, #EED98A 100%)',
                      border: '2px solid #16301F',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.35)',
                    }}
                  >
                    <AwardArtwork name={award!} size={26} />
                  </div>
                )}
              </div>
            </div>

            {/* Conference name */}
            <h2
              className="relative text-center"
              style={{
                fontFamily: OUTFIT, fontWeight: 900, fontSize: '24px', lineHeight: 1.12,
                color: '#FAF8F3', letterSpacing: '-0.015em', margin: 0,
                textShadow: '0 1px 12px rgba(0,0,0,0.3)',
                animation: 'gvRise 560ms cubic-bezier(0.16,1,0.3,1) 240ms both',
              }}
            >
              {entry.conference_name}
            </h2>

            {/* Committee · allocation */}
            {metaLine && (
              <p
                className="relative text-center mt-2"
                style={{
                  fontFamily: OUTFIT, fontWeight: 600, fontSize: '13.5px',
                  color: 'rgba(238,217,138,0.92)', margin: '8px 0 0', letterSpacing: '0.01em',
                  animation: 'gvRise 560ms cubic-bezier(0.16,1,0.3,1) 300ms both',
                }}
              >
                {metaLine}
              </p>
            )}

            {/* Award chip */}
            {hasAward && (
              <div className="relative flex justify-center mt-4" style={{ animation: 'gvRise 560ms cubic-bezier(0.16,1,0.3,1) 360ms both' }}>
                <AwardChip name={award!} />
              </div>
            )}

            {/* Divider + delegate name */}
            <div
              className="relative flex items-center justify-center gap-3 mt-6 pt-5"
              style={{ borderTop: '1px solid rgba(238,217,138,0.18)', animation: 'gvRise 560ms cubic-bezier(0.16,1,0.3,1) 420ms both' }}
            >
              <span style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: '13px', color: '#FAF8F3', letterSpacing: '0.01em' }}>
                {profileName || 'Delegate'}
              </span>
              <span style={{ fontFamily: OUTFIT, fontWeight: 600, fontSize: '11px', color: 'rgba(250,248,243,0.5)' }}>
                · MUN CV
              </span>
            </div>
          </div>

          {/* ── Congratulations + share actions (ivory tray) ── */}
          <div
            className="relative rounded-[22px] mt-3 p-5"
            style={{
              backgroundColor: 'rgba(250,248,243,0.98)',
              border: '1px solid #DDD4C0',
              boxShadow: '0 18px 46px rgba(20,14,10,0.24)',
            }}
          >
            <h3 className="text-center" style={{ fontFamily: OUTFIT, fontWeight: 900, fontSize: '19px', color: '#1C1410', margin: 0, letterSpacing: '-0.01em' }}>
              {headline}
            </h3>
            <p className="text-center mt-1.5" style={{ fontFamily: OUTFIT, fontWeight: 500, fontSize: '13px', color: '#9A8A78', margin: '6px 0 0', lineHeight: 1.5 }}>
              {subline}
            </p>

            {/* Primary share */}
            <button
              type="button"
              onClick={handlePrimaryShare}
              className="w-full flex items-center justify-center gap-2 rounded-2xl mt-4 focus:outline-none"
              style={{
                height: '50px',
                background: 'linear-gradient(150deg, #2A5A3C, #1B3828)',
                color: '#EED98A',
                border: '1px solid rgba(238,217,138,0.4)',
                boxShadow: '0 8px 22px rgba(27,56,40,0.28), inset 0 1px 0 rgba(238,217,138,0.22)',
                fontFamily: OUTFIT, fontWeight: 800, fontSize: '14px', letterSpacing: '0.02em',
                cursor: 'pointer',
                transition: 'transform 160ms cubic-bezier(0.22,1,0.36,1), box-shadow 220ms cubic-bezier(0.22,1,0.36,1)',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 12px 30px rgba(27,56,40,0.34), inset 0 1px 0 rgba(238,217,138,0.28)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 22px rgba(27,56,40,0.28), inset 0 1px 0 rgba(238,217,138,0.22)'; }}
              onPointerDown={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(0.97)'; }}
              onPointerUp={(e) => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; }}
            >
              <Share2 size={17} strokeWidth={2.4} />
              Share this
            </button>

            {/* Social + copy row */}
            <div className="flex items-center justify-center gap-2.5 mt-3">
              {socials.map((s) => (
                <a
                  key={s.key}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  title={s.label}
                  className="flex items-center justify-center rounded-full focus:outline-none"
                  style={{
                    width: '46px', height: '46px',
                    backgroundColor: s.bg, color: '#FFFFFF',
                    boxShadow: '0 4px 12px rgba(20,14,10,0.18), inset 0 1px 0 rgba(255,255,255,0.12)',
                    cursor: 'pointer',
                    transition: 'transform 160ms cubic-bezier(0.22,1,0.36,1)',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px) scale(1.06)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = 'none'; }}
                  onPointerDown={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(0.94)'; }}
                >
                  {s.icon}
                </a>
              ))}

              {/* Copy link */}
              <button
                type="button"
                onClick={handleCopy}
                aria-label="Copy your CV link"
                title={copied ? 'Link copied' : 'Copy link'}
                className="flex items-center justify-center rounded-full focus:outline-none"
                style={{
                  width: '46px', height: '46px',
                  backgroundColor: copied ? '#2A5A3C' : '#F4EFE3',
                  color: copied ? '#EED98A' : '#1B3828',
                  border: '1px solid #DDD4C0',
                  boxShadow: '0 4px 12px rgba(27,56,40,0.10), inset 0 1px 0 rgba(255,255,255,0.6)',
                  cursor: 'pointer',
                  transition: 'transform 160ms cubic-bezier(0.22,1,0.36,1), background-color 200ms ease, color 200ms ease',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px) scale(1.06)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = 'none'; }}
                onPointerDown={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(0.94)'; }}
              >
                {copied ? <Check size={18} strokeWidth={2.6} /> : <Link2 size={17} strokeWidth={2.4} />}
              </button>
            </div>

            {/* Maybe later */}
            <button
              type="button"
              onClick={requestClose}
              className="w-full text-center mt-4 focus:outline-none"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: OUTFIT, fontWeight: 700, fontSize: '13px', color: '#9A8A78',
                padding: '4px 0',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#6E5F4E'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#9A8A78'; }}
            >
              Maybe later
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
