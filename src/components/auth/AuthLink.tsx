'use client';

import type { AnchorHTMLAttributes, MouseEvent } from 'react';
import { authUrl, openAuth } from '@/lib/authModal';

/**
 * A "Log in" / "Sign up" link that opens the auth pop-up in place.
 *
 * It stays a real <a href> (the /?auth= door) so a middle-click, a new tab or
 * a page with no JS still reaches the modal; a plain click opens it here and
 * the visitor never leaves the page. Without `next` they stay on this page
 * after signing in.
 */
export default function AuthLink({
  next,
  mode = 'signin',
  email,
  apply,
  onClick,
  children,
  ...rest
}: {
  next?: string;
  mode?: 'signin' | 'signup';
  email?: string;
  apply?: boolean;
} & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a
      {...rest}
      href={authUrl({ next, step: mode, email, apply })}
      onClick={(e: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(e);
        if (e.defaultPrevented) return;
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        openAuth({ next, step: mode, email, apply });
      }}
    >
      {children}
    </a>
  );
}
