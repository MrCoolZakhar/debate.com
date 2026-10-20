// A leader reads one member's details and application answers for the member
// pop-up (owner, 20 Oct 2026). Read through the NEW rpc
// `delegation_member_details(p_application uuid) returns jsonb`
//   { ok?, code?, name, email, role, status, nationality, society,
//     answers: [{ question, answer }] }
// which does not exist yet (20 Oct 2026). It is called ONLY while
// DELEGATIONS_V2_DB is on; while it is false the hook returns null without
// touching the database and the pop-up shows what the table already knows.

import { useEffect, useState } from 'react';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { DELEGATIONS_V2_DB } from '../v2';

export interface MemberAnswer {
  question: string;
  /** Null when they left it empty: shown as "No answer". */
  answer: string | null;
}

export interface MemberDetails {
  name: string | null;
  email: string | null;
  role: string | null;
  status: string | null;
  nationality: string | null;
  society: string | null;
  answers: MemberAnswer[];
}

export type MemberDetailsState = { kind: 'ok'; details: MemberDetails } | { kind: 'error' };

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

/** An answer in words, whatever shape the form stored it in. */
function answerText(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === 'string') return v.trim() ? v : null;
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (Array.isArray(v)) {
    const parts = v.map(answerText).filter((x): x is string => !!x);
    return parts.length > 0 ? parts.join(', ') : null;
  }
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    const inner = o.label ?? o.value ?? o.name ?? o.text;
    if (inner !== undefined) return answerText(inner);
    try { return JSON.stringify(v); } catch { return null; }
  }
  return null;
}

function parse(data: unknown): MemberDetails | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const r = data as Record<string, unknown>;
  if (r.ok === false) return null;
  const answers = Array.isArray(r.answers)
    ? (r.answers as unknown[]).flatMap(a => {
        if (!a || typeof a !== 'object') return [];
        const o = a as Record<string, unknown>;
        const question = str(o.question) ?? str(o.label);
        return question ? [{ question, answer: answerText(o.answer) }] : [];
      })
    : [];
  return {
    name: str(r.name),
    email: str(r.email),
    role: str(r.role),
    status: str(r.status),
    nationality: str(r.nationality),
    society: str(r.society),
    answers,
  };
}

export function useMemberDetails(applicationId: string | null): MemberDetailsState | null {
  const key = DELEGATIONS_V2_DB ? applicationId : null;
  const [loaded, setLoaded] = useState<{ key: string; state: MemberDetailsState } | null>(null);

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    (async () => {
      const client = await getFreshAuthedClient();
      if (!client || cancelled) return;
      const { data, error } = await client.rpc('delegation_member_details', { p_application: key });
      if (cancelled) return;
      const details = error ? null : parse(data);
      setLoaded({ key, state: details ? { kind: 'ok', details } : { kind: 'error' } });
    })().catch(() => { if (!cancelled) setLoaded({ key, state: { kind: 'error' } }); });
    return () => { cancelled = true; };
  }, [key]);

  return key && loaded?.key === key ? loaded.state : null;
}
