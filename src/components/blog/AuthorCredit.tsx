/**
 * The byline under an authored article's title, and the author box at its end.
 *
 * Rendered by ArticleLayout ONLY for a post whose manifest entry names an
 * `author`. A post without one renders exactly as before.
 */

import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { AUTHORS, type BlogAuthorKey } from './authors';

const C = {
  forest: '#1B3828',
  ink: '#1C1410',
  inkSoft: '#55483C',
  surface: '#FAF8F3',
  rule: '#D8CDB6',
  amber: '#7A5812',
};

function Portrait({ author, size, eager = false }: { author: BlogAuthorKey; size: number; eager?: boolean }) {
  const a = AUTHORS[author];
  return (
    <Image
      src={a.photo}
      alt={a.name}
      width={size}
      height={size}
      sizes={`${size}px`}
      loading={eager ? 'eager' : 'lazy'}
      className="flex-none rounded-full object-cover"
      style={{ width: size, height: size, boxShadow: '0 4px 12px rgba(27,56,40,0.18)' }}
    />
  );
}

export function AuthorByline({ author }: { author: BlogAuthorKey }) {
  const a = AUTHORS[author];
  return (
    <div className="flex items-center gap-3">
      <Portrait author={author} size={44} eager />
      <div className="min-w-0 leading-tight">
        <p className="m-0 text-[14.5px] font-bold" style={{ color: C.ink }}>
          By{' '}
          <Link href={a.href} rel="author" className="no-underline hover:underline" style={{ color: C.forest }}>
            {a.name}
          </Link>
        </p>
        <p className="m-0 mt-0.5 text-[13px]" style={{ color: C.inkSoft }}>
          {a.role}
        </p>
      </div>
    </div>
  );
}

export function AuthorBox({ author }: { author: BlogAuthorKey }) {
  const a = AUTHORS[author];
  return (
    <aside
      aria-label={`About the author, ${a.name}`}
      className="mt-12 flex flex-col gap-5 rounded-2xl p-6 sm:flex-row sm:items-start sm:p-7"
      style={{ background: C.surface, border: `1.5px solid ${C.rule}` }}
    >
      <Portrait author={author} size={76} />
      <div className="min-w-0">
        <p className="m-0 text-[12.5px] font-bold" style={{ color: C.amber }}>
          About the author
        </p>
        <p className="m-0 mt-1 text-[19px] font-extrabold" style={{ color: C.forest, letterSpacing: '-0.01em' }}>
          {a.name}
        </p>
        <p className="m-0 text-[13.5px]" style={{ color: C.inkSoft }}>
          {a.role}
        </p>
        <p className="m-0 mt-3 text-[15px] leading-[1.62]" style={{ color: C.ink }}>
          {a.bio}
        </p>
        <Link
          href={a.href}
          className="mt-3 inline-flex items-center gap-1.5 text-[14px] font-bold no-underline hover:underline"
          style={{ color: C.forest }}
        >
          More about {a.name.split(' ')[0]}
          <ArrowRight size={15} strokeWidth={2.5} aria-hidden="true" />
        </Link>
      </div>
    </aside>
  );
}
