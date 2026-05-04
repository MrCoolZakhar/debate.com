'use client';

import { useState } from 'react';
import { Dialog as RadixDialog } from 'radix-ui';
import { Dialog, DialogPortal, DialogOverlay, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Spinner } from '@/components/ui/spinner';
import { Field, FieldLabel } from '@/components/ui/field';
import { InputGroup, InputGroupInput, InputGroupAddon } from '@/components/ui/input-group';
import { cn } from '@/lib/utils';
import { CalendarIcon, GiftIcon, CircleCheckIcon } from 'lucide-react';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SPOTS_CLAIMED = 153;
const SPOTS_TOTAL = 1000;
const PROGRESS_VALUE = (SPOTS_CLAIMED / SPOTS_TOTAL) * 100;

export default function PreRegisterModal({ open = true }: { open?: boolean }) {
  const [email, setEmail]       = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [invalid, setInvalid]   = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!EMAIL_RE.test(email)) { setInvalid(true); return; }
    setInvalid(false);
    setLoading(true);
    setTimeout(() => { setLoading(false); setSubmitted(true); }, 800);
  };

  return (
    <Dialog open={open}>
      <DialogPortal>
        <DialogOverlay className="bg-black/40 backdrop-blur-sm" />
        <RadixDialog.Content
          onEscapeKeyDown={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          aria-describedby={undefined}
          className={cn(
            'fixed top-1/2 left-1/2 z-50 -translate-x-1/2 -translate-y-1/2 outline-none',
            'w-[95vw] max-w-[95vw] max-h-[90vh]',
            'rounded-2xl shadow-2xl border border-border bg-background overflow-hidden',
            'flex flex-col md:flex-row',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
            'duration-100'
          )}
        >
          <DialogTitle className="sr-only">Pre-register for Gavelling</DialogTitle>

          {/* ── Left column ── */}
          <div className="flex flex-col justify-between gap-8 px-8 py-10 md:w-[55%] overflow-y-auto">

            <div className="flex flex-col gap-6">
              {/* Badge */}
              <Badge variant="secondary" className="w-fit">
                <CalendarIcon data-icon="inline-start" />
                Coming August 2026
              </Badge>

              {/* Heading + subheading */}
              <div className="flex flex-col gap-3">
                <h2 className="text-4xl font-bold tracking-tight text-foreground leading-tight">
                  The committee room, reimagined.
                </h2>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  Gavelling brings professional MUN committee management to every conference — chair tools, delegate flows, live voting, and more.
                </p>
              </div>

              {/* Scarcity alert */}
              <Alert>
                <GiftIcon size={16} />
                <AlertTitle>First 1,000 users get 6 months free</AlertTitle>
                <AlertDescription>
                  Pre-register now to claim your spot before accounts open in August 2026.
                </AlertDescription>
              </Alert>

              {/* Progress */}
              <div className="flex flex-col gap-2">
                <Progress value={PROGRESS_VALUE} />
                <p className="text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{SPOTS_CLAIMED}</span>
                  {' '}of{' '}
                  <span className="font-semibold text-foreground">{SPOTS_TOTAL.toLocaleString()}</span>
                  {' '}spots claimed
                </p>
              </div>
            </div>

            {/* Form — pinned to bottom of left column */}
            <div className="flex flex-col gap-2">
              {submitted ? (
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <CircleCheckIcon size={18} className="text-green-600 shrink-0" />
                    You're on the list. See you in August.
                  </div>
                  <p className="text-xs text-muted-foreground pl-[26px]">{email}</p>
                </div>
              ) : (
                <>
                  <Field>
                    <FieldLabel htmlFor="preregister-email" className="sr-only">
                      Email address
                    </FieldLabel>
                    <form onSubmit={handleSubmit} className="w-full">
                      <InputGroup
                        className={cn(
                          invalid && 'border-destructive ring-3 ring-destructive/20'
                        )}
                      >
                        <InputGroupInput
                          id="preregister-email"
                          type="email"
                          placeholder="your@email.com"
                          value={email}
                          onChange={(e) => { setEmail(e.target.value); setInvalid(false); }}
                          aria-invalid={invalid || undefined}
                          autoComplete="email"
                          disabled={loading}
                        />
                        <InputGroupAddon align="inline-end">
                          <Button
                            type="submit"
                            variant="default"
                            size="xs"
                            disabled={loading}
                            aria-label={loading ? 'Submitting…' : undefined}
                          >
                            {loading ? <Spinner /> : 'Pre-register'}
                          </Button>
                        </InputGroupAddon>
                      </InputGroup>
                    </form>
                  </Field>
                  <p className="text-xs text-muted-foreground">
                    No spam. We'll only email you when accounts open.
                  </p>
                </>
              )}
            </div>
          </div>

          {/* ── Right column ── */}
          <div className="flex flex-col gap-4 bg-muted md:w-[45%] p-6">

            {/* Desktop image slot */}
            <div className={cn(
              'hidden md:flex flex-1 flex-col items-center justify-center',
              'rounded-xl border border-border bg-background/40',
              'aspect-[4/5]'
            )}>
              <p className="text-muted-foreground text-sm italic text-center px-8 leading-relaxed">
                [ Illustration: golden gavel on podium with floating flag icons, forest/ivory palette ]
              </p>
            </div>

            {/* Mobile image slot */}
            <div className={cn(
              'flex md:hidden items-center justify-center',
              'rounded-xl border border-border bg-background/40',
              'aspect-video'
            )}>
              <p className="text-muted-foreground text-sm italic text-center px-4 leading-relaxed">
                [ Illustration: golden gavel on podium with floating flag icons, forest/ivory palette ]
              </p>
            </div>

            {/* Badge — mobile only */}
            <div className="flex md:hidden">
              <Badge variant="secondary">
                <CalendarIcon data-icon="inline-start" />
                Coming August 2026
              </Badge>
            </div>
          </div>

        </RadixDialog.Content>
      </DialogPortal>
    </Dialog>
  );
}
