'use client';

// Shared pieces for the Manage account pages (/account/manage/*): the page
// head, the "Need a hand?" line, and the two button skins. Everything reads
// the /account type scale from accountUi so the three pages and the rest of
// the account area move together.

import Link from 'next/link';
import { OUTFIT, T, W } from '../accountUi';

export const FOCUS = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] focus-visible:ring-offset-2';

export function PageHead({ title, lede, aside }: { title: string; lede?: string; aside?: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
      <div className="min-w-0" style={{ maxWidth: '70ch' }}>
        <h1
          style={{
            margin: 0,
            fontFamily: OUTFIT,
            fontWeight: W.title,
            fontSize: `clamp(28px, 8vw, ${T.title}px)`,
            lineHeight: 1.1,
            letterSpacing: '-0.01em',
            color: '#1C1410',
          }}
        >
          {title}
        </h1>
        {lede && (
          <p style={{ margin: '10px 0 0', fontFamily: OUTFIT, fontSize: T.body, lineHeight: 1.55, color: '#5A5046' }}>
            {lede}
          </p>
        )}
      </div>
      {aside && <div className="flex-shrink-0">{aside}</div>}
    </div>
  );
}

export function HelpLine() {
  return (
    <p style={{ margin: '40px 0 0', fontFamily: OUTFIT, fontSize: T.body, color: '#5A5046' }}>
      Need a hand?{' '}
      <Link
        href="/help"
        className={`rounded ${FOCUS}`}
        style={{ color: '#1B3828', fontWeight: W.label, textDecoration: 'underline', textUnderlineOffset: 3 }}
      >
        We are here to help
      </Link>
      .
    </p>
  );
}

type ButtonProps = {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
  style?: React.CSSProperties;
  className?: string;
};

/** Forest fill, gold text. The one primary action on a page. */
export function PrimaryButton({ children, onClick, disabled, type = 'button', style, className = '' }: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 ${FOCUS} ${className}`}
      style={{
        minHeight: 48,
        backgroundColor: disabled ? 'rgba(27,56,40,0.45)' : '#1B3828',
        color: '#EED98A',
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: OUTFIT,
        fontSize: T.body,
        fontWeight: W.section,
        letterSpacing: '0.01em',
        transition: 'background-color 150ms ease-out, transform 150ms ease-out',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

/** Outlined, for the second action beside a primary one. */
export function SecondaryButton({ children, onClick, disabled, type = 'button', style, className = '' }: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 ${FOCUS} ${className}`}
      style={{
        minHeight: 48,
        backgroundColor: '#FAF8F3',
        color: disabled ? '#9A8A78' : '#1B3828',
        border: '1px solid #DDD4C0',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: OUTFIT,
        fontSize: T.body,
        fontWeight: W.section,
        transition: 'background-color 150ms ease-out',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

/** "3 Nov 2026", en-GB day month year. */
export function formatDay(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
}
