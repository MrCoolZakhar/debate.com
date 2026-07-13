'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Carousel, Aceternity-style center-focus carousel, reskinned for Gavelling.
//
// Large center slide, dimmed/scaled side-peek neighbors, circular prev/next
// arrows below, keyboard + touch/drag support, loops in both directions.
// Fully prop-driven, no hardcoded slide content.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { motion, type PanInfo } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const SANS = "'Outfit', sans-serif";
const CREAM = '#FAF8F3';
const FOREST = '#1B3828';
const GOLD = '#EED98A';

export interface CarouselButton {
  label: string;
  href: string;
}

export interface CarouselSlide {
  title: string;
  kicker: string;
  description: string;
  image: string;
  imageAlt?: string;
  primaryButton: CarouselButton;
  secondaryButton: CarouselButton;
}

export interface CarouselProps {
  slides: CarouselSlide[];
  className?: string;
}

const DRAG_THRESHOLD = 60;
const VELOCITY_THRESHOLD = 400;

export function Carousel({ slides, className }: CarouselProps) {
  const [active, setActive] = useState(0);
  const total = slides.length;

  const goTo = useCallback((i: number) => setActive(((i % total) + total) % total), [total]);
  const next = useCallback(() => goTo(active + 1), [active, goTo]);
  const prev = useCallback(() => goTo(active - 1), [active, goTo]);

  // Signed distance from the active slide, wrapped to the shortest direction.
  const getOffset = (i: number) => {
    let diff = i - active;
    if (diff > total / 2) diff -= total;
    else if (diff < -total / 2) diff += total;
    return diff;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
    if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
  };

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -DRAG_THRESHOLD || info.velocity.x < -VELOCITY_THRESHOLD) next();
    else if (info.offset.x > DRAG_THRESHOLD || info.velocity.x > VELOCITY_THRESHOLD) prev();
  };

  if (total === 0) return null;

  return (
    <div className={className}>
      <div
        role="region"
        aria-roledescription="carousel"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className="relative w-full outline-none"
        style={{ height: 'clamp(440px, 50vw, 560px)' }}
      >
        {slides.map((slide, i) => {
          const offset = getOffset(i);
          if (Math.abs(offset) > 2) return null;
          const isActive = offset === 0;

          return (
            <motion.div
              key={i}
              className="absolute inset-y-0 left-1/2 rounded-[30px] overflow-hidden select-none"
              style={{
                width: 'min(640px, 82vw)',
                marginLeft: 'calc(min(640px, 82vw) / -2)',
                boxShadow: isActive
                  ? '0 32px 70px rgba(15,26,19,0.38), 0 0 0 1px rgba(250,248,243,0.14)'
                  : '0 18px 40px rgba(15,26,19,0.22), 0 0 0 1px rgba(250,248,243,0.10)',
                cursor: isActive ? 'grab' : 'pointer',
              }}
              animate={{
                x: `${offset * 78}%`,
                scale: isActive ? 1 : 0.82,
                opacity: Math.abs(offset) > 1 ? 0 : isActive ? 1 : 0.5,
                zIndex: 10 - Math.abs(offset),
              }}
              transition={{ type: 'spring', stiffness: 300, damping: 32 }}
              drag={isActive ? 'x' : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.15}
              onDragEnd={isActive ? handleDragEnd : undefined}
              onClick={() => { if (!isActive) goTo(i); }}
              aria-hidden={!isActive}
            >
              <img
                src={slide.image}
                alt={slide.imageAlt ?? slide.title}
                className="absolute inset-0 w-full h-full object-cover"
                draggable={false}
              />
              <div
                aria-hidden="true"
                className="absolute inset-0"
                style={{
                  background:
                    'linear-gradient(to bottom, rgba(11,20,15,0.10) 0%, rgba(11,20,15,0.18) 34%, rgba(9,17,13,0.74) 70%, rgba(8,15,11,0.94) 100%)',
                }}
              />

              <div className="relative z-10 flex flex-col justify-end h-full p-7 sm:p-9">
                <p
                  style={{
                    fontFamily: SANS, fontWeight: 700, fontSize: '12px',
                    letterSpacing: '0.16em', textTransform: 'uppercase', color: GOLD, margin: 0,
                  }}
                >
                  {slide.kicker}
                </p>
                <h3
                  style={{
                    fontFamily: SANS, fontWeight: 900, fontSize: 'clamp(24px, 3vw, 34px)',
                    letterSpacing: '-0.01em', color: CREAM, margin: '10px 0 0 0',
                  }}
                >
                  {slide.title}
                </h3>
                <p
                  style={{
                    fontFamily: SANS, fontSize: '14.5px', lineHeight: 1.6,
                    color: 'rgba(250,248,243,0.86)', margin: '12px 0 0 0', maxWidth: '480px',
                  }}
                >
                  {slide.description}
                </p>

                <div className="flex flex-wrap items-center gap-3" style={{ marginTop: '22px' }}>
                  <Link
                    href={slide.primaryButton.href}
                    onClick={(e) => e.stopPropagation()}
                    tabIndex={isActive ? 0 : -1}
                    style={{
                      fontFamily: SANS, fontWeight: 800, fontSize: '13px', letterSpacing: '0.04em',
                      color: '#14100B', backgroundColor: GOLD, padding: '13px 22px', borderRadius: '9999px',
                      textDecoration: 'none', boxShadow: '0 10px 26px rgba(0,0,0,0.3)',
                      transition: 'transform 160ms ease, background-color 160ms ease',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.backgroundColor = '#F3E3A1'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.backgroundColor = GOLD; }}
                  >
                    {slide.primaryButton.label}
                  </Link>
                  <Link
                    href={slide.secondaryButton.href}
                    onClick={(e) => e.stopPropagation()}
                    tabIndex={isActive ? 0 : -1}
                    style={{
                      fontFamily: SANS, fontWeight: 700, fontSize: '13px', letterSpacing: '0.04em',
                      color: CREAM, backgroundColor: 'transparent', padding: '12px 21px', borderRadius: '9999px',
                      textDecoration: 'none', border: '1.5px solid rgba(250,248,243,0.55)',
                      transition: 'background-color 160ms ease, border-color 160ms ease',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(250,248,243,0.12)'; e.currentTarget.style.borderColor = 'rgba(250,248,243,0.85)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = 'rgba(250,248,243,0.55)'; }}
                  >
                    {slide.secondaryButton.label}
                  </Link>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="flex items-center justify-center gap-4 mt-8">
        <CarouselArrow direction="left" onClick={prev} label="Previous slide" />
        <CarouselArrow direction="right" onClick={next} label="Next slide" />
      </div>
    </div>
  );
}

function CarouselArrow({
  direction, onClick, label,
}: {
  direction: 'left' | 'right';
  onClick: () => void;
  label: string;
}) {
  const Icon = direction === 'left' ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="inline-flex items-center justify-center rounded-full"
      style={{
        width: '48px', height: '48px', backgroundColor: CREAM,
        border: `1.5px solid rgba(27,56,40,0.18)`, color: FOREST,
        boxShadow: '0 8px 22px rgba(27,56,40,0.14)',
        transition: 'background-color 160ms ease, transform 160ms ease',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = FOREST; e.currentTarget.style.color = GOLD; e.currentTarget.style.transform = 'translateY(-2px)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = CREAM; e.currentTarget.style.color = FOREST; e.currentTarget.style.transform = 'translateY(0)'; }}
    >
      <Icon size={20} strokeWidth={2.25} />
    </button>
  );
}
