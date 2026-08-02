'use client';

import { useEffect, useState } from 'react';
import SessionsHeaderLogo from '@/components/SessionsHeaderLogo';

export default function MobileGate({ children }: { children: React.ReactNode }) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Use user-agent to detect actual mobile/tablet devices, not screen size.
    // This means zooming in on a desktop never triggers the gate.
    const ua = navigator.userAgent;
    const isTouchDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    setIsMobile(isTouchDevice);
  }, []);

  if (!isMobile) return <>{children}</>;

  return (
    <div
      style={{
        minHeight: '100svh',
        backgroundColor: '#EDE7D8',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 24px',
        textAlign: 'center',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      {/* Gavel icon */}
      <div style={{ marginBottom: 32 }}>
        <SessionsHeaderLogo linked={false} height={40} />
      </div>

      <p style={{ fontSize: 48, marginBottom: 16, lineHeight: 1 }}>🖥️</p>

      <h1
        style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: 28,
          fontWeight: 700,
          color: '#1C1410',
          lineHeight: 1.25,
          marginBottom: 16,
        }}
      >
        Don't you wanna try this on a computer instead?
      </h1>

      <p
        style={{
          fontSize: 15,
          color: '#9A8A78',
          lineHeight: 1.6,
          maxWidth: 300,
          marginBottom: 32,
        }}
      >
        The chair yields the floor… to a real screen. Gavelling is built for the big stage (timers, speaker queues, live voting), and all of it needs a bit more room to breathe.
      </p>

      <div
        style={{
          display: 'inline-block',
          backgroundColor: '#1B3828',
          color: '#EDE7D8',
          fontWeight: 600,
          fontSize: 13,
          letterSpacing: '0.08em',
          padding: '10px 20px',
          borderRadius: 8,
        }}
      >
        OPEN ON DESKTOP
      </div>

      <p style={{ marginTop: 16, fontSize: 12, color: '#9A8A78' }}>
        (or just rotate your phone, we're not judging)
      </p>
    </div>
  );
}
