// Server-side queue route for participant-triggered platform emails.
// email_outbox has a single RLS policy (organizer-only writes), so a
// participant's own browser session can never insert an outbox row directly
// — queueEventEmail called from their session silently no-ops. This route
// re-authorizes the specific (event, applicationIds) pair against the
// caller's own JWT, then queues with the service role. Only the
// participant-triggered events below are reachable here; every other event
// key stays organizer-only through the manage pages calling queueEventEmail
// directly with their own authed client.

import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { queueEventEmail, type QueueEventEmailResult } from '@/lib/emailEvents';
import type { getAuthedClient } from '@/lib/supabase-auth';
import type { EmailTokenContext } from '@/lib/emailTokens';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Public values, safe to hardcode (same convention as src/lib/supabase-auth.ts
// and src/app/api/contact/route.ts) — used only as a fallback when the env
// vars documented in CLAUDE.md aren't set in this environment.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://luruhkwrgisytejswlas.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_k7NdduzaXK358z8ew18ZKA_vBSieDlV';

const ALLOWED_EVENTS = new Set(['application_received', 'delegation_swap']);
const LEADER_STATUSES = ['accepted', 'assigned', 'checked-in'];

interface QueueParticipantBody {
  conferenceId?: string;
  eventKey?: string;
  applicationIds?: string[];
  extraCtx?: EmailTokenContext;
}

async function isOrganizer(admin: SupabaseClient, callerId: string, conferenceId: string): Promise<boolean> {
  const { data: conf } = await admin.from('conferences').select('organizer_id').eq('id', conferenceId).maybeSingle();
  if ((conf as { organizer_id: string | null } | null)?.organizer_id === callerId) return true;
  const { data: orgRow } = await admin
    .from('conference_organizers')
    .select('user_id')
    .eq('user_id', callerId)
    .eq('conference_id', conferenceId)
    .maybeSingle();
  return !!orgRow;
}

async function authorizeApplicationReceived(admin: SupabaseClient, callerId: string, conferenceId: string, applicationIds: string[]): Promise<boolean> {
  const { data } = await admin.from('applications').select('id, user_id, conference_id').in('id', applicationIds);
  const rows = (data ?? []) as { id: string; user_id: string | null; conference_id: string }[];
  if (rows.length !== applicationIds.length) return false;
  return rows.every(r => r.user_id === callerId && r.conference_id === conferenceId);
}

async function authorizeDelegationSwap(admin: SupabaseClient, callerId: string, conferenceId: string, applicationIds: string[]): Promise<boolean> {
  const { data } = await admin.from('applications').select('id, society_id, conference_id').in('id', applicationIds);
  const rows = (data ?? []) as { id: string; society_id: string | null; conference_id: string }[];
  if (rows.length !== applicationIds.length) return false;
  if (!rows.every(r => r.conference_id === conferenceId)) return false;
  const societyId = rows[0]?.society_id;
  if (!societyId || !rows.every(r => r.society_id === societyId)) return false;

  if (await isOrganizer(admin, callerId, conferenceId)) return true;

  const { data: leaderRows } = await admin
    .from('applications')
    .select('id')
    .eq('user_id', callerId)
    .eq('conference_id', conferenceId)
    .eq('society_id', societyId)
    .in('role', ['faculty-advisor', 'head-delegate'])
    .in('status', LEADER_STATUSES)
    .limit(1);
  return (leaderRows?.length ?? 0) > 0;
}

export async function POST(req: NextRequest) {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not configured on the server.' }, { status: 500 });
  }

  const authHeader = req.headers.get('authorization') ?? '';
  const token = /^bearer\s+/i.test(authHeader) ? authHeader.replace(/^bearer\s+/i, '').trim() : null;
  if (!token) {
    return NextResponse.json({ error: 'Missing bearer token.' }, { status: 401 });
  }

  let body: QueueParticipantBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }
  const { conferenceId, eventKey, applicationIds, extraCtx } = body;
  if (!conferenceId || !eventKey || !Array.isArray(applicationIds) || applicationIds.length === 0) {
    return NextResponse.json({ error: 'Missing conferenceId, eventKey, or applicationIds.' }, { status: 400 });
  }
  if (!ALLOWED_EVENTS.has(eventKey)) {
    return NextResponse.json({ error: `Event "${eventKey}" cannot be queued from the participant side.` }, { status: 403 });
  }

  const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: userData, error: userError } = await anon.auth.getUser(token);
  if (userError || !userData?.user) {
    return NextResponse.json({ error: 'Could not verify caller identity.' }, { status: 401 });
  }
  const callerId = userData.user.id;

  const admin = createClient(SUPABASE_URL, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const authorized =
    eventKey === 'application_received' ? await authorizeApplicationReceived(admin, callerId, conferenceId, applicationIds) :
    eventKey === 'delegation_swap' ? await authorizeDelegationSwap(admin, callerId, conferenceId, applicationIds) :
    false;

  if (!authorized) {
    return NextResponse.json({ error: 'Not authorized to queue this event.' }, { status: 403 });
  }

  let result: QueueEventEmailResult;
  try {
    // queueEventEmail internally fires triggerEmailDelivery (functions.invoke)
    // without awaiting it — that call already swallows its own errors, but
    // wrap the whole thing here too: a Vercel function context can behave
    // oddly around a fire-and-forget fetch left running past the response,
    // and queuing the outbox row is what actually matters. A minute-cadence
    // server cron drains any pending row regardless of whether the
    // immediate delivery trigger landed.
    result = await queueEventEmail(admin as unknown as ReturnType<typeof getAuthedClient>, conferenceId, eventKey, applicationIds, extraCtx);
  } catch (err) {
    console.error('[queue-participant] queueEventEmail threw:', eventKey, err);
    return NextResponse.json({ outcome: 'unconfigured', drafted: false, queued: 0, eventKey } satisfies QueueEventEmailResult);
  }

  return NextResponse.json(result);
}
