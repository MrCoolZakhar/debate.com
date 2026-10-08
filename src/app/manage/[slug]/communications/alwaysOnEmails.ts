// alwaysOnEmails.ts — the emails Gavelling itself sends on money events and
// that cannot be turned off (prompt 97). DISPLAY ROWS ONLY: they are not
// template events, nothing on the client queues them, and the server writes
// them so the numbers in them are always right. Communications lists them at
// the top of Automatic emails, under "Always On".

export interface AlwaysOnEmail { key: string; label: string; description: string }

export const ALWAYS_ON_LINE = 'Always sends. Gavelling writes this one so the numbers are always right';

export const ALWAYS_ON_EMAILS: AlwaysOnEmail[] = [
  { key: 'payment_receipt', label: 'Payment receipt', description: 'Sent for every payment, by card, approved proof or marked paid. Lists each item and the total.' },
  { key: 'refund_confirmation', label: 'Refund confirmation', description: 'Sent when you refund an item, by card or by hand.' },
  { key: 'proof_not_accepted', label: 'Proof not accepted', description: 'Sent when you deny a payment proof, with the reason you gave.' },
  { key: 'spot_covered', label: 'Your spot is covered', description: "Sent when one of a delegation's paid tickets covers a delegate." },
];
