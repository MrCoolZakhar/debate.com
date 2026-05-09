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

    const { error } = await supabase
      .from('contact_submissions')
      .insert({ name, email, subject: subject ?? 'General Enquiry', message });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
