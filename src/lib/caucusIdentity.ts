/**
 * The identity of one caucus instance (23 Oct 2026): who raised it, what it is and when it
 * passed. Never its clock: extending a caucus changes `totalTime`, and keying anything on it
 * replayed the 3.5 s loading screen over a running caucus (unmounting the floor and the
 * Consultation's own timer) and could leave a stale speaker clock running. Every effect that
 * asks "is this a NEW caucus?" (the loading screen, stopping and reseating the speaker clock)
 * keys on this instead.
 *
 * `acceptedAt` is stamped by MotionsModal when the motion passes; a caucus accepted by an
 * older bundle has none and falls back to the rest (and `tourStartedAt` for a Room Order tour).
 * Pure.
 */
import type { CaucusState, SessionPhase } from './types';

export function caucusIdentityKey(phase: SessionPhase | string | null | undefined, caucus: CaucusState | null | undefined): string | null {
  if (!caucus || (phase !== 'moderated-caucus' && phase !== 'unmoderated-caucus')) return null;
  return [
    phase,
    caucus.type,
    caucus.proposedBy ?? '',
    caucus.purpose ?? '',
    caucus.motionLabel ?? '',
    caucus.isConsultation ? 'cow' : '',
    caucus.tourStartedAt ?? '',
    caucus.acceptedAt ?? '',
  ].join('|');
}
