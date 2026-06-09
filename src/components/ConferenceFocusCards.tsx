'use client';

import { useState } from 'react';
import Link from 'next/link';

export interface FocusCard {
  id: string;
  slug: string;
  full_name: string;
  acronym: string;
  city: string;
  country: string;
  start_date: string;
  end_date: string;
  banner_url: string | null;
}

function formatDate(d: string): string {
  const date = new Date(d + 'T00:00:00');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return months[date.getMonth()] + ' ' + date.getDate() + ', ' + date.getFullYear();
}

const FALLBACK_COLORS = [
  'linear-gradient(135deg, #1B3828 0%, #2A5A3C 100%)',
  'linear-gradient(135deg, #1B3828 0%, #3D7A52 100%)',
  'linear-gradient(135deg, #2A5A3C 0%, #1B3828 100%)',
  'linear-gradient(135deg, #1C1410 0%, #1B3828 100%)',
  'linear-gradient(135deg, #3D7A52 0%, #1C1410 100%)',
  'linear-gradient(135deg, #1B3828 0%, #1C1410 100%)',
];

export default function ConferenceFocusCards({ cards }: { cards: FocusCard[] }) {
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'row', gap: '8px' }}>
      {cards.map((card, index) => (
        <Link
          key={card.id}
          href={`/conferences/${card.slug}`}
          style={{
            position: 'relative',
            flex: hovered === card.id ? '2.2' : hovered !== null ? '0.7' : '1',
            transition: 'flex 0.4s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            height: '100%',
            borderRadius: '16px',
            overflow: 'hidden',
            cursor: 'pointer',
            border: hovered === card.id ? '2px solid #3D7A52' : '2px solid transparent',
            textDecoration: 'none',
            display: 'block',
          }}
          onMouseEnter={() => setHovered(card.id)}
          onMouseLeave={() => setHovered(null)}
        >
          {/* Background layer */}
          <div style={{ position: 'absolute', inset: 0 }}>
            {card.banner_url ? (
              <img
                src={card.banner_url}
                alt={card.full_name}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            ) : (
              <div style={{ background: FALLBACK_COLORS[index % 6], width: '100%', height: '100%' }} />
            )}
          </div>

          {/* Blur + darken overlay for non-hovered cards */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              opacity: hovered !== null && hovered !== card.id ? 1 : 0,
              transition: 'opacity 0.3s ease',
              backgroundColor: 'rgba(0,0,0,0.55)',
              backdropFilter: 'blur(3px)',
              WebkitBackdropFilter: 'blur(3px)',
            }}
          />

          {/* Info overlay — shown only on hover */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              ...(index < 3
                ? {
                    bottom: 0,
                    background: 'linear-gradient(to top, rgba(27,56,40,0.95) 0%, rgba(27,56,40,0.7) 60%, transparent 100%)',
                    padding: '24px 16px 16px',
                  }
                : {
                    top: 0,
                    background: 'linear-gradient(to bottom, rgba(27,56,40,0.95) 0%, rgba(27,56,40,0.7) 60%, transparent 100%)',
                    padding: '16px 16px 24px',
                  }),
              opacity: hovered === card.id ? 1 : 0,
              transition: 'opacity 0.25s ease',
              pointerEvents: 'none',
            }}
          >
            <p style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: '13px', color: '#EDE7D8', marginBottom: '4px', lineHeight: 1.3 }}>
              {card.full_name}
            </p>
            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: 'rgba(237,231,216,0.7)', letterSpacing: '0.08em' }}>
              {formatDate(card.start_date)} · {card.city}, {card.country}
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}
