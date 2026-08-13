// Server route for the /contact form.
//
// This route ONLY saves the enquiry. The team alert to wearegavelling@gmail.com
// is sent by the database: an AFTER INSERT trigger on contact_submissions
// (notify_gavelling_on_contact_submission) calls
// queue_gavelling_enquiry_notification, which inserts an email_outbox row with
// conference_id = NULL and reply_to = the enquirer. The drain-email-outbox cron
// hands it to the send-emails Edge Function, which owns the Resend key.
//
// Do NOT add an application-side send here — that is what caused duplicate
// alerts before.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Both values are public — safe to hardcode (same as NEXT_PUBLIC_ vars in the bundle)
const supabase = createClient(
  'https://luruhkwrgisytejswlas.supabase.co',
  'sb_publishable_k7NdduzaXK358z8ew18ZKA_vBSieDlV'
);

export async function POST(req: NextRequest) {
  try {
    const { name, email, message, subject } = await req.json();
    if (!name || !email || !message) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const finalSubject = subject ?? 'General Enquiry';

    const { error } = await supabase
      .from('contact_submissions')
      .insert({ name, email, subject: finalSubject, message });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // The insert above is the whole job — the trigger queues the team alert.
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
