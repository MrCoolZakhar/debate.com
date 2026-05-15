import SiteNav from '@/components/SiteNav';

const AMBASSADORS = [
  { name: 'andrew', src: '/andrew_ambassador.png' },
  { name: 'anna', src: '/anna_ambassador.png' },
  { name: 'armande', src: '/armande_ambassador.png' },
  { name: 'celine', src: '/celine_ambassador.png' },
  { name: 'farah', src: '/farah_ambassador.png' },
  { name: 'kyle', src: '/kyle_ambassador.png' },
  { name: 'manuela', src: '/manuela_ambassador.png' },
  { name: 'noelia', src: '/noelia_ambassador.png' },
  { name: 'paolo', src: '/paolo_ambassador.png' },
  { name: 'valentina', src: '/valentina_ambassador.png' },
];

export default function AmbassadorsPage() {
  return (
    <div style={{ minHeight: '100svh', backgroundColor: '#EDE7D8', fontFamily: 'system-ui, sans-serif' }}>
      <SiteNav />

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '64px 24px' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.15em', color: '#B6871F', marginBottom: 12 }}>
            COMMUNITY
          </p>
          <h1
            style={{
              fontFamily: "'Playfair Display', serif",
              fontStyle: 'italic',
              fontSize: 'clamp(36px, 6vw, 64px)',
              fontWeight: 400,
              color: '#1C1410',
              lineHeight: 1.15,
              marginBottom: 16,
            }}
          >
            Our Ambassadors
          </h1>
          <p style={{ fontSize: 15, color: '#9A8A78', maxWidth: 480, margin: '0 auto', lineHeight: 1.7 }}>
            Chairs and delegates who bring Gavelling to their conferences — and help us make it better.
          </p>
        </div>

        {/* Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 32,
          }}
        >
          {AMBASSADORS.map(({ name, src }) => (
            <div key={name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
              <div
                style={{
                  width: 160,
                  height: 160,
                  borderRadius: '50%',
                  overflow: 'hidden',
                  border: '3px solid rgba(27,56,40,0.12)',
                  backgroundColor: 'rgba(27,56,40,0.05)',
                  flexShrink: 0,
                }}
              >
                <img
                  src={src}
                  alt={name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }}
                />
              </div>
              <p
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: '#1C1410',
                  letterSpacing: '0.02em',
                  textAlign: 'center',
                }}
              >
                {name}
              </p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
