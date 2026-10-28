'use client';

// The chair's "Start your committee room" press, shared by the Overview's
// Your Committee card and the Session section's card (one instance per
// committee block, so both buttons share ONE in-flight guard).
//
// The dais asks for its own room (owner, 7 Oct 2026: "committees should only
// be started when chairs want it to"). A live room is only ever created by a
// press (CLAUDE.md §1): this is one of the three callers, and it never runs
// from an effect or a page load.
//
// ── IT GOES THROUGH AN RPC, NOT FOUR CLIENT WRITES ───────────────────────────
//
// The last write of a mint is
// `update conference_committees set session_id, session_code`, and
// `conference_committees` has exactly ONE non-SELECT policy:
// `Organizers manage committees USING is_conference_organizer(conference_id)`.
// A chair sits in `chair_user_ids`, which grants SELECT only, so from the
// browser that UPDATE matches zero rows for any chair who is not also an
// organiser, and PostgREST reports a zero-row UPDATE as success, never as an
// error. The room would be created and seated, the chair handed a working
// code, and nothing on the conference side would point at it: the live wall,
// the cross-committee scoreboard and awards all join through
// `conference_committees.session_id`. An orphan from birth.
//
// So the mint happens in ONE transaction server-side:
// `start_my_chair_session(p_committee)` (SECURITY DEFINER, authenticated
// only, applied 7 Oct 2026) checks `auth.uid() = any(chair_user_ids)` or the
// organising team, takes the committee's own advisory lock, and writes the
// room, its current_speaker row, the seats and the link back, so a room can
// never exist unlinked and two chairs pressing at the same instant get ONE
// room. It is idempotent: a second press returns the code that already exists.
// It is also how a RETIRED room (ended, past its reopen window) is replaced:
// with section C1 of scratch-conference-rooms.sql applied it mints a fresh
// room and relinks; before that it hands the ended room back (`created:
// false`), and this hook says so instead of pretending.
//
// Every chair of the committee can press it; there is no organiser gate any
// more. The server decides, and `message` is written for the chair to read.

import { useRef, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { friendlyError } from '@/lib/friendlyError';

export interface ChairRoomStart {
  creating: boolean;
  error: string;
  start: () => void;
}

export function useStartChairRoom(committeeId: string, hasCode: boolean, onCreated: () => void, retired = false): ChairRoomStart {
  const { session } = useAuth();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  // ONE PRESS, ONE ROOM. The RPC's lock handles two concurrent mints of the
  // SAME committee; this ref stops one device sending two. A ref, not the
  // `creating` state, because state is a render behind a fast double-click.
  const mintingRef = useRef(false);

  function start() {
    if (!session || mintingRef.current || hasCode) return;
    mintingRef.current = true;
    setCreating(true);
    setError('');
    (async () => {
      try {
        const { data, error: rpcError } = await getAuthedClient(session.access_token)
          .rpc('start_my_chair_session', { p_committee: committeeId });
        const answer = (data ?? null) as { ok?: boolean; code?: string; message?: string; created?: boolean } | null;
        if (rpcError || !answer?.ok || !answer.code) {
          // The RPC writes a plain sentence for every refusal it knows about;
          // anything else goes through friendlyError (never a raw error).
          setError(
            answer?.message
            ?? (rpcError
              ? `Your session couldn't be started: ${friendlyError(rpcError, 'the request was rejected')}`
              : "Your session couldn't be started. Please try again, or ask the organizing team."),
          );
          return;
        }
        if (retired && answer.created === false) {
          setError('Your last room has ended and cannot be restarted. Ask the organizing team for a new room.');
          return;
        }
        onCreated();
      } catch (e) {
        setError(`Your session couldn't be started: ${friendlyError(e, 'the request was rejected')}`);
      }
    })().finally(() => { mintingRef.current = false; setCreating(false); });
  }

  return { creating, error, start };
}
