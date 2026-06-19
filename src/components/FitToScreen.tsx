'use client';

import { useEffect, useState, type ReactNode } from 'react';

// Vertical reference height. Everything is laid out at this height and scaled
// to fit the window's height; width fills the viewport (no side borders).
const BASE_H = 820;

export default function FitToScreen({ children }: { children: ReactNode }) {
  const [dims, setDims] = useState({ scale: 1, width: BASE_H * (16 / 9) });

  useEffect(() => {
    const compute = () => {
      const scale = window.innerHeight / BASE_H;
      setDims({ scale, width: window.innerWidth / scale });
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
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', backgroundColor: '#EDE7D8' }}>
      {/* Pin to the physical top-left so the scale() origin is always at (0,0).
          Without an explicit left:0, an RTL document right-aligns this narrower
          box and shifts all content off the right edge. */}
      <div id="fit-root" style={{ position: 'absolute', top: 0, left: 0, width: dims.width, height: BASE_H, transform: `scale(${dims.scale})`, transformOrigin: 'top left' }}>
        {children}
      </div>
    </div>
  );
}
