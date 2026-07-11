// Triggers the deployed `send-emails` edge function, which drains
// email_outbox through Resend. Call sites fire this without awaiting it —
// queuing an outbox row (or a page mount sweep) must never be blocked or
// broken by a delivery hiccup, so every failure path here is swallowed and
// logged rather than thrown.

import type { getAuthedClient } from '@/lib/supabase-auth';

export interface EmailDeliveryResult {
  sent: number;
  failed: number;
}

export async function triggerEmailDelivery(
  supabase: ReturnType<typeof getAuthedClient>
): Promise<EmailDeliveryResult> {
  try {
    const { data, error } = await supabase.functions.invoke('send-emails');
    if (error) {
      console.error('[emailDelivery] send-emails invocation failed:', error);
      return { sent: 0, failed: 0 };
    }
    const result = data as { sent?: number; failed?: number } | null;
    return { sent: result?.sent ?? 0, failed: result?.failed ?? 0 };
  } catch (err) {
    console.error('[emailDelivery] send-emails invocation threw:', err);
    return { sent: 0, failed: 0 };
  }
}
