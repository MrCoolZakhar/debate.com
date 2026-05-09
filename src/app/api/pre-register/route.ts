import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabase = createClient(
  'https://luruhkwrgisytejswlas.supabase.co',
  'sb_publishable_k7NdduzaXK358z8ew18ZKA_vBSieDlV'
);

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Check for duplicate first
    const { data: existing } = await supabase
      .from('pre_registrations')
      .select('id')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ duplicate: true }, { status: 200 });
    }

    const { error } = await supabase
      .from('pre_registrations')
      .insert({ email: email.toLowerCase().trim() });

    if (error) {
      // Unique constraint race condition — treat as duplicate
      if (error.code === '23505') {
        return NextResponse.json({ duplicate: true }, { status: 200 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
