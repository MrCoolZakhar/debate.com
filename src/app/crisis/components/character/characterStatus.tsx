'use client';
// Gavelling Crisis: how a character's status is shown (word, icon, colour), shared by the Characters
// page and the character pop-up. Also the one test for who may edit characters.

import { CircleQuestionMark, Lock, Skull, UserCheck, UserRoundPlus } from 'lucide-react';
import { isDirector, type CrisisRole, type CrisisSettings, type CharacterStatus } from '@/lib/crisis/types';
import { CK } from '../../crisisKit';

export const STATUS_WORD: Record<CharacterStatus, string> = { active: 'Active', spare: 'Spare', dead: 'Dead', arrested: 'Arrested', missing: 'Missing' };
export const STATUS_ORDER: CharacterStatus[] = ['active', 'spare', 'dead', 'arrested', 'missing'];

export function StatusIcon({ status, size = 14 }: { status: CharacterStatus; size?: number }) {
  const p = { size, strokeWidth: 1.5, 'aria-hidden': true } as const;
  if (status === 'spare') return <UserRoundPlus {...p} />;
  if (status === 'dead') return <Skull {...p} />;
  if (status === 'arrested') return <Lock {...p} />;
  if (status === 'missing') return <CircleQuestionMark {...p} />;
  return <UserCheck {...p} />;
}

export const statusColor = (s: CharacterStatus) => (s === 'active' ? CK.ok : s === 'spare' ? CK.inkSoft : s === 'missing' ? CK.warn : CK.danger);

/** The Crisis Director always may; a backroomer only when the director switched "Edit characters" on. */
export function mayEditCharacters(role: CrisisRole, settings: CrisisSettings): boolean {
  if (isDirector(role)) return true;
  if (role === 'backroomer') return !!(settings.backroomPowers as unknown as Record<string, boolean>).characters;
  return false;
}
