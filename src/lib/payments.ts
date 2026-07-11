// Payment initiation. Card payments aren't wired to a provider yet, so this
// is a stub: every call resolves with a message telling the participant so,
// instead of hitting a real payment API. PaymentPanel is otherwise final —
// this function's body is the ONLY thing the finance build needs to replace
// (e.g. swap the stub result for a Stripe Checkout redirect).

export interface InitiatePaymentArgs {
  applicationId: string;
  amountCents: number;
}

export interface InitiatePaymentResult {
  status: 'stub';
  message: string;
}

export async function initiatePayment(_args: InitiatePaymentArgs): Promise<InitiatePaymentResult> {
  return {
    status: 'stub',
    message: 'Secure card payment is being connected — the organizing team can confirm payments manually in the meantime.',
  };
}
