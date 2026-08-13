// Server route for the ambassador form on /about.
//
// The insert used to happen client-side from AboutClient.tsx with the anon
// key; moving it server-side keeps the trimming and validation in one place.
// Mirrors src/app/api/contact/route.ts in shape.
//
// This route ONLY saves the application. The team alert to
// wearegavelling@gmail.com is sent by the database: an AFTER INSERT trigger on
// ambassador_applications (notify_gavelling_on_ambassador_application) calls
// queue_gavelling_enquiry_notification, which inserts an email_outbox row with
// conference_id = NULL and reply_to = the applicant. The drain-email-outbox
// cron hands it to the send-emails Edge Function, which owns the Resend key.
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
    const { name, email, country, experience } = await req.json();
    if (!name || !email || !country) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    // Same trimming the client used to do before inserting directly.
    const cleanName = String(name).trim();
    const cleanEmail = String(email).trim();
    const cleanCountry = String(country).trim();
    const cleanExperience = experience ? String(experience).trim() : '';

    const { error } = await supabase
      .from('ambassador_applications')
      .insert({
        name: cleanName,
        email: cleanEmail,
        country: cleanCountry,
        experience: cleanExperience || null,
      });

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
