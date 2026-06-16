'use client';

import { useState, useEffect } from 'react';
import { useT } from '@/contexts/LanguageContext';
import { markPreRegistered } from '@/lib/preregStatus';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function PreRegisterNudge({ onClose }: { onClose: () => void }) {
  const t = useT();
  const [email, setEmail] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  const prefersReduced = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!EMAIL_RE.test(email)) { setInvalid(true); return; }
    setInvalid(false);
    setApiError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/pre-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.duplicate || res.ok) {
        markPreRegistered();
        setSuccess(true);
        setTimeout(onClose, 2000);
        return;
      }
      setApiError(data.error ?? 'Something went wrong');
    } catch {
      setApiError('Network error — please try again');
    } finally {
      setLoading(false);
    }
  };

  const overlayStyle: React.CSSProperties = prefersReduced
    ? { opacity: visible ? 1 : 0 }
    : { opacity: visible ? 1 : 0, transition: 'opacity 200ms ease' };

  const cardStyle: React.CSSProperties = prefersReduced
    ? {}
    : {
        transform: visible ? 'translateY(0) scale(1)' : 'translateY(24px) scale(0.97)',
        transition: 'transform 220ms ease, opacity 220ms ease',
        opacity: visible ? 1 : 0,
      };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(20, 16, 10, 0.55)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        padding: '16px',
        ...overlayStyle,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('prereg_nudge_heading')}
        style={{
          width: '100%',
          maxWidth: '420px',
          backgroundColor: '#EDE7D8',
          border: '1px solid #C8BAA8',
          borderRadius: '20px',
          boxShadow: '0 24px 64px rgba(27,56,40,0.22)',
          padding: '32px 28px 24px',
          position: 'relative',
          ...cardStyle,
        }}
      >
        {/* Grain texture */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '20px',
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='1'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'repeat',
            backgroundSize: '300px 300px',
            mixBlendMode: 'multiply',
            opacity: 0.14,
            pointerEvents: 'none',
          }}
        />

        {/* Badge */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
          <span style={{
            fontSize: '10px',
            fontWeight: 800,
            fontFamily: "'DM Mono', monospace",
            letterSpacing: '0.1em',
            color: '#B6871F',
            backgroundColor: 'rgba(182,135,31,0.12)',
            border: '1px solid rgba(182,135,31,0.3)',
            borderRadius: '8px',
            padding: '4px 10px',
          }}>
            {t('prereg_badge')}
          </span>
        </div>

        {/* Otter avatar */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '14px' }}>
          <img
            src="/Otter-Preregister.png"
            width={64}
            height={64}
            alt=""
            style={{ borderRadius: '50%', objectFit: 'cover' }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
        </div>

        {/* Heading */}
        <h2 style={{
          margin: '0 0 6px',
          fontSize: '22px',
          fontWeight: 900,
          color: '#1B3828',
          textAlign: 'center',
          letterSpacing: '-0.01em',
          lineHeight: 1.2,
        }}>
          {t('prereg_nudge_heading')}
        </h2>
        <p style={{ margin: '0 0 22px', fontSize: '13px', color: '#6A5A4A', textAlign: 'center', lineHeight: 1.5 }}>
          {t('prereg_no_spam')}
        </p>

        {success ? (
          <div style={{
            padding: '16px',
            borderRadius: '12px',
            backgroundColor: 'rgba(27,56,40,0.08)',
            border: '1px solid rgba(27,56,40,0.2)',
            color: '#1B3828',
            fontSize: '14px',
            fontWeight: 700,
            textAlign: 'center',
          }}>
            {t('prereg_nudge_success')}
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <label
              htmlFor="prereg-nudge-email"
              style={{
                position: 'absolute',
                width: '1px',
                height: '1px',
                overflow: 'hidden',
                clip: 'rect(0,0,0,0)',
                whiteSpace: 'nowrap',
              }}
            >
              Email address
            </label>
            <input
              id="prereg-nudge-email"
              type="email"
              value={email}
              autoFocus
              onChange={(e) => { setEmail(e.target.value); setInvalid(false); setApiError(null); }}
              placeholder="your@email.com"
              autoComplete="email"
              style={{
                display: 'block',
                width: '100%',
                boxSizing: 'border-box',
                padding: '12px 16px',
                borderRadius: '12px',
                border: invalid ? '1.5px solid #B6871F' : '1.5px solid #C8BAA8',
                backgroundColor: '#FAF8F3',
                color: '#1C1410',
                fontSize: '14px',
                outline: 'none',
                marginBottom: '10px',
              }}
              onFocus={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#1B3828'; (e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 3px rgba(27,56,40,0.1)'; }}
              onBlur={(e) => { (e.currentTarget as HTMLElement).style.borderColor = invalid ? '#B6871F' : '#C8BAA8'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
            />
            {(invalid || apiError) && (
              <p style={{ margin: '-4px 0 10px', fontSize: '11px', color: '#B6871F' }}>
                {apiError ?? 'Please enter a valid email'}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              style={{
                display: 'block',
                width: '100%',
                padding: '13px 16px',
                borderRadius: '12px',
                border: 'none',
                backgroundColor: loading ? '#9A8A78' : '#1B3828',
                color: '#EED98A',
                fontSize: '13px',
                fontWeight: 800,
                fontFamily: "'DM Mono', monospace",
                letterSpacing: '0.07em',
                cursor: loading ? 'not-allowed' : 'pointer',
                minHeight: '48px',
              }}
              onMouseEnter={(e) => { if (!loading) (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
              onMouseLeave={(e) => { if (!loading) (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
            >
              {loading ? '…' : t('prereg_btn')}
            </button>
          </form>
        )}

        {/* Skip link */}
        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '12px',
              color: '#9A8A78',
              textDecoration: 'underline',
              textUnderlineOffset: '2px',
              padding: '4px 8px',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#1C1410'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#9A8A78'; }}
          >
            {t('prereg_nudge_close')}
          </button>
        </div>
      </div>
    </div>
  );
}
