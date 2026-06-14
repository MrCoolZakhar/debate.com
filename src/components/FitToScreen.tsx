'use client';

import { useEffect, useState, type ReactNode } from 'react';

// Reference design size. Tune these two numbers to taste — they define the
// aspect ratio everything is locked to. 1440x820 ≈ a typical laptop content area.
const BASE_W = 1440;
const BASE_H = 820;

export default function FitToScreen({ children }: { children: ReactNode }) {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const compute = () => {
      setScale(Math.min(window.innerWidth / BASE_W, window.innerHeight / BASE_H));
    };
    compute();
    window.addEventListener('resize', compute);
    window.visualViewport?.addEventListener('resize', compute);
    return () => {
      window.removeEventListener('resize', compute);
      window.visualViewport?.removeEventListener('resize', compute);
    };
  }, []);

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', backgroundColor: '#EDE7D8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: BASE_W, height: BASE_H, flexShrink: 0, transform: `scale(${scale})`, transformOrigin: 'center center' }}>
        {children}
      </div>
    </div>
  );
}
