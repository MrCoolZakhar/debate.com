'use client';
// Gavelling Crisis: the Public / Private mark a delegate puts on a directive when the crisis setting
// publicPrivateDirectives is on (docs/crisis/sql/051). Public = a megaphone in forest, Private = a lock in red.
// A directive with no mark (the setting was off, or an older page sent it) shows nothing.

import { Lock, Megaphone } from 'lucide-react';
import type { Directive } from '@/lib/crisis/types';
import { CK } from '../../crisisKit';

export type DirectiveVisibility = 'public' | 'private';

export function visibilityOf(d: Pick<Directive, 'visibility'>): DirectiveVisibility | null {
  return d.visibility === 'public' || d.visibility === 'private' ? d.visibility : null;
}

/** The small mark: icon + word. `iconOnly` for tight rows (the word is then the title and the accessible name). */
export function VisibilityMark({ v, size = 'md', iconOnly = false }: { v: DirectiveVisibility | null; size?: 'sm' | 'md'; iconOnly?: boolean }) {
  if (!v) return null;
  const pub = v === 'public';
  const color = pub ? CK.forest : CK.redDeep;
  const word = pub ? 'Public' : 'Private';
  const px = size === 'sm' ? 12 : 13;
  const Icon = pub ? Megaphone : Lock;
  if (iconOnly) {
    return (
      <span role="img" aria-label={`${word} directive`} title={`${word} directive`} className="inline-flex" style={{ color, flex: 'none' }}>
        <Icon size={px + 2} strokeWidth={1.6} aria-hidden />
      </span>
    );
  }
  return (
    <span className="inline-flex items-center" title={`${word} directive`} style={{ gap: 4, fontSize: size === 'sm' ? 11.5 : 12.5, fontWeight: 800, color, flex: 'none' }}>
      <Icon size={px} strokeWidth={1.6} aria-hidden />{word}
    </span>
  );
}
