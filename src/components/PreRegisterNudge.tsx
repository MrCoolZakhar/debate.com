'use client';

import { useState, useEffect, useRef } from 'react';
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
  const inputRef = useRef<HTMLInputElement>(null);

  const prefersReduced = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    // Delay mount animation by one frame
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

  const cardStyle: React.CSSProperties = prefersReduced
    ? { opacity: visible ? 1 : 0 }
    : {
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(16px)',
        transition: 'opacity 200ms ease, transform 200ms ease',
      };

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label={t('prereg_nudge_heading')}
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: 60,
        width: '360px',
        maxWidth: 'calc(100vw - 24px)',
        backgroundColor: '#EDE7D8',
        border: '1px solid #C8BAA8',
        borderRadius: '16px',
        boxShadow: '0 8px 32px rgba(27,56,40,0.18)',
        padding: '20px',
        ...cardStyle,
      }}
    >
      {/* Close */}
      <button
        onClick={onClose}
        aria-label={t('prereg_nudge_close')}
        style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          border: 'none',
          backgroundColor: 'transparent',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#9A8A78',
          fontSize: '14px',
          lineHeight: 1,
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.08)'; (e.currentTarget as HTMLElement).style.color = '#1C1410'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#9A8A78'; }}
      >
        ✕
      </button>

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', paddingRight: '24px' }}>
        <img
          src="/Otter-Preregister.png"
          width={40}
          height={40}
          alt=""
          style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
        <div>
          <span style={{
            display: 'inline-block',
            fontSize: '9px',
            fontWeight: 800,
            fontFamily: "'DM Mono', monospace",
            letterSpacing: '0.08em',
            color: '#B6871F',
            backgroundColor: 'rgba(182,135,31,0.12)',
            border: '1px solid rgba(182,135,31,0.25)',
            borderRadius: '6px',
            padding: '2px 7px',
            marginBottom: '4px',
          }}>
            {t('prereg_badge')}
          </span>
          <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#1B3828', lineHeight: 1.3 }}>
            {t('prereg_nudge_heading')}
          </p>
        </div>
      </div>

      {success ? (
        <div style={{
          padding: '12px 14px',
          borderRadius: '10px',
          backgroundColor: 'rgba(27,56,40,0.08)',
          border: '1px solid rgba(27,56,40,0.18)',
          color: '#1B3828',
          fontSize: '13px',
          fontWeight: 600,
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
            ref={inputRef}
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setInvalid(false); setApiError(null); }}
            placeholder="your@email.com"
            autoComplete="email"
            style={{
              display: 'block',
              width: '100%',
              boxSizing: 'border-box',
              padding: '10px 14px',
              borderRadius: '10px',
              border: invalid ? '1.5px solid #B6871F' : '1.5px solid #C8BAA8',
              backgroundColor: '#FAF8F3',
              color: '#1C1410',
              fontSize: '13px',
              outline: 'none',
              marginBottom: '8px',
            }}
            onFocus={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#1B3828'; (e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 3px rgba(27,56,40,0.1)'; }}
            onBlur={(e) => { (e.currentTarget as HTMLElement).style.borderColor = invalid ? '#B6871F' : '#C8BAA8'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
          />
          {(invalid || apiError) && (
            <p style={{ margin: '0 0 8px', fontSize: '11px', color: '#B6871F' }}>
              {apiError ?? (invalid ? 'Please enter a valid email' : '')}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            style={{
              display: 'block',
              width: '100%',
              padding: '11px 14px',
              borderRadius: '10px',
              border: 'none',
              backgroundColor: loading ? '#9A8A78' : '#1B3828',
              color: '#EED98A',
              fontSize: '12px',
              fontWeight: 800,
              fontFamily: "'DM Mono', monospace",
              letterSpacing: '0.07em',
              cursor: loading ? 'not-allowed' : 'pointer',
              minHeight: '44px',
            }}
            onMouseEnter={(e) => { if (!loading) { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; } }}
            onMouseLeave={(e) => { if (!loading) { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; } }}
          >
            {loading ? '…' : t('prereg_btn')}
          </button>
          <p style={{ margin: '8px 0 0', fontSize: '10px', color: '#9A8A78', textAlign: 'center' }}>
            {t('prereg_no_spam')}
          </p>
        </form>
      )}
    </div>
  );
}
