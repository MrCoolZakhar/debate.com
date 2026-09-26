'use client';

// The ACTIONS of My conferences (26 Sep 2026). When the old "Your conferences"
// page (role tabs, now in src/app/_archive/account-your-conferences/) was
// archived and the calendar became My conferences, these were the things only
// that page could do, so they were carried over here unchanged:
//
//   • pending chair invitations: accept / decline (respond_chair_invite)
//   • pending organiser-team invitations: accept / decline (respond_organizer_invite)
//   • imported-delegate invitations: open the claim (my_pending_import_invites)
//   • drafts to complete: continue or delete (application_drafts, discardApplyDraft)
//   • the "Invite accepted" notice after /invites/chair/[token] (?chairInvite=accepted)
//
// Payments due stay PaymentsDueSection (participant/PayNowCard.tsx), mounted by
// the page. Same reads, same RPCs, same refusal handling as before.

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Check, X, Mail, Trash2 } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { LogoDisc } from '@/components/LogoDisc';
import { useConfirmModal } from '@/components/ConfirmModal';
import { discardApplyDraft } from '@/lib/applyDraft';
import { notifyDraftsChanged } from '@/hooks/useDraftCount';
import { committeeDisplayName } from '@/lib/presetNames';
import { conferenceAcronymLabel } from '@/lib/conferenceLabels';
import { OUTFIT, MONO } from '@/app/account/accountUi';
import { NEU, NEU_GRADIENTS, EASE, NeuIconDisc } from '@/components/neu';

const first = <T,>(v: T | T[] | null | undefined): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null);

/** A small section heading: the title and its count as a plain number. */
function Eyebrow({ children }: { children: React.ReactNode; className?: string; color?: string }) {
  return (
    <h2 style={{ margin: 0, fontFamily: OUTFIT, fontWeight: 800, fontSize: 18, letterSpacing: '-0.01em', color: NEU.ink }}>
      {children}
    </h2>
  );
}

export interface ChairInvite {
  id: string;
  token: string;
  conferenceName: string;
  /** Already carries the edition year (`conferenceAcronymLabel`). */
  acronym: string;
  committeeName: string;
}

export interface OrganizerInvite {
  id: string;
  token: string;
  conferenceName: string;
  /** Already carries the edition year (`conferenceAcronymLabel`). */
  acronym: string;
  slug: string;
  /** The public-facing role the inviting team picked for them, chosen in the
   *  add flow. Null for invites sent before that field existed. */
  publicTitle: string | null;
}

export interface ImportInvite {
  application_id: string;
  role: string;
  invited_name: string | null;
  claim_token: string;
  conference: { slug: string; acronym: string; full_name: string; logo_url: string | null; start_date: string | null; end_date: string | null; dates_tbd: boolean; city: string; country: string };
  allocation: { committee: string; abbreviation: string | null; country_name: string; country_code: string } | null;
}

/** A half-finished application from `public.application_drafts`. */
export interface DraftRow {
  id: string;
  role: string;
  updatedAt: string;
  discardToken: string;
  conferenceId: string;
  slug: string;
  acronym: string;
  fullName: string;
  startDate: string | null;
  logoUrl: string | null;
}

/** The conference columns the invite/draft joins select, shared so the label
 *  helper always has the start date it needs for the edition year. */
type ConfNameRow = { full_name: string; acronym: string; start_date: string | null };
type DraftConfRow = ConfNameRow & { slug: string; logo_url: string | null };

const DRAFT_ROLE_LABEL: Record<string, string> = {
  'delegate': 'Delegate',
  'head-delegate': 'Head Delegate',
  'chair': 'Chair',
  'faculty-advisor': 'Faculty Advisor',
  'observer': 'Observer',
};



// ── The hook: every read and every response, as the old page had them ────────

export function useConferenceActions(onAccepted: () => void | Promise<void>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, session, profile, loading: authLoading } = useAuth();
  const [chairInvites, setChairInvites] = useState<ChairInvite[]>([]);
  const [organizerInvites, setOrganizerInvites] = useState<OrganizerInvite[]>([]);
  const [importInvites, setImportInvites] = useState<ImportInvite[]>([]);
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [acceptedToast, setAcceptedToast] = useState(false);
  const { confirm, modal: confirmModal } = useConfirmModal();

  // Success notice for a redirect from /invites/chair/[token] after accepting.
  useEffect(() => {
    if (searchParams.get('chairInvite') !== 'accepted') return;
    setAcceptedToast(true);
    const params = new URLSearchParams(searchParams.toString());
    params.delete('chairInvite');
    router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname, { scroll: false });
    const t = setTimeout(() => setAcceptedToast(false), 5000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadChairInvites = useCallback(async () => {
    if (!user || !session) return;
    const supabase = getAuthedClient(session.access_token);
    const { data: rows } = await supabase
      .from('conference_chair_invites')
      .select('id, token, conferences (full_name, acronym, start_date), conference_committees (name)')
      .eq('invited_user_id', user.id)
      .eq('status', 'pending');
    const invites = ((rows ?? []) as unknown as {
      id: string; token: string;
      conferences: ConfNameRow | ConfNameRow[] | null;
      conference_committees: { name: string } | { name: string }[] | null;
    }[]).map(r => {
      const conf = first(r.conferences);
      const committee = first(r.conference_committees);
      return {
        id: r.id, token: r.token,
        conferenceName: conf?.full_name ?? 'Unknown conference',
        acronym: conf ? conferenceAcronymLabel(conf) : '',
        committeeName: committee?.name ?? 'Unknown committee',
      };
    });
    setChairInvites(invites);
  }, [user, session]);

  // Drafts to complete: the applicant's own half-finished applications. RLS
  // ("Users manage own drafts", user_id = auth.uid()) is the real scope; the
  // explicit filter matches `loadApplyDraft` in src/lib/applyDraft.ts.
  const loadDrafts = useCallback(async () => {
    if (!user || !session) return;
    const supabase = getAuthedClient(session.access_token);
    const { data } = await supabase
      .from('application_drafts')
      .select('id, role, updated_at, discard_token, conference_id, conferences (slug, acronym, full_name, logo_url, start_date)')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });
    const rows = ((data ?? []) as unknown as {
      id: string; role: string; updated_at: string; discard_token: string; conference_id: string;
      conferences: DraftConfRow | DraftConfRow[] | null;
    }[]).flatMap((r) => {
      const conf = first(r.conferences);
      // A draft whose conference we can no longer read is not actionable.
      if (!conf) return [];
      return [{
        id: r.id,
        role: r.role,
        updatedAt: r.updated_at,
        discardToken: r.discard_token,
        conferenceId: r.conference_id,
        slug: conf.slug,
        acronym: conf.acronym,
        fullName: conf.full_name,
        startDate: conf.start_date,
        logoUrl: conf.logo_url,
      }];
    });
    setDrafts(rows);
  }, [user, session]);

  async function deleteDraft(draft: DraftRow) {
    const { confirmed } = await confirm({
      title: 'Delete this draft?',
      body: `Your saved answers for ${conferenceAcronymLabel({ acronym: draft.acronym, full_name: draft.fullName, start_date: draft.startDate }) || draft.fullName} will be permanently deleted. You can always start the application again.`,
      confirmLabel: 'Delete draft',
      danger: true,
    });
    if (!confirmed || !session) return;
    const supabase = getAuthedClient(session.access_token);
    const ok = await discardApplyDraft(supabase, {
      conferenceId: draft.conferenceId,
      userId: user!.id,
      role: draft.role,
      token: draft.discardToken,
    });
    if (!ok) return;
    setDrafts((prev) => prev.filter((d) => d.id !== draft.id));
    // Drop the profile-menu badge without a reload.
    notifyDraftsChanged();
  }

  const loadImportInvites = useCallback(async () => {
    if (!user || !session) return;
    const supabase = getAuthedClient(session.access_token);
    const { data } = await supabase.rpc('my_pending_import_invites');
    setImportInvites((data ?? []) as unknown as ImportInvite[]);
  }, [user, session]);

  async function respondChair(invite: ChairInvite, accept: boolean) {
    if (!session) return;
    const supabase = getAuthedClient(session.access_token);
    const { data } = await supabase.rpc('respond_chair_invite', { p_token: invite.token, p_accept: accept });
    const result = data as { ok: boolean } | null;
    if (!result?.ok) return;
    setChairInvites(prev => prev.filter(i => i.id !== invite.id));
    if (accept) await onAccepted();
  }

  const loadOrganizerInvites = useCallback(async () => {
    if (!user || !session) return;
    const supabase = getAuthedClient(session.access_token);
    const select = 'id, token, public_title, conferences (full_name, acronym, slug, start_date)';
    // Two queries, not one .or(): invited_user_id-keyed invites (the normal
    // case) plus email-keyed invites (invited_user_id null) for someone who
    // just created their account with the invited address, matching RLS's
    // "Invitee reads own organizer invites" policy exactly.
    const email = profile?.email ?? user.email ?? null;
    const [byUser, byEmail] = await Promise.all([
      supabase.from('conference_organizer_invites').select(select).eq('invited_user_id', user.id).eq('status', 'pending'),
      email
        ? supabase.from('conference_organizer_invites').select(select).is('invited_user_id', null).eq('email', email.toLowerCase()).eq('status', 'pending')
        : Promise.resolve({ data: [] }),
    ]);
    const rows = [...(byUser.data ?? []), ...(byEmail.data ?? [])];
    const invites = (rows as unknown as {
      id: string; token: string; public_title: string | null;
      conferences: (ConfNameRow & { slug: string }) | (ConfNameRow & { slug: string })[] | null;
    }[]).map(r => {
      const conf = first(r.conferences);
      return {
        id: r.id, token: r.token,
        publicTitle: r.public_title ?? null,
        conferenceName: conf?.full_name ?? 'Unknown conference',
        acronym: conf ? conferenceAcronymLabel(conf) : '',
        slug: conf?.slug ?? '',
      };
    });
    setOrganizerInvites(invites);
  }, [user, session, profile?.email]);

  async function respondOrganizer(invite: OrganizerInvite, accept: boolean) {
    if (!session) return;
    const supabase = getAuthedClient(session.access_token);
    const { data } = await supabase.rpc('respond_organizer_invite', { p_token: invite.token, p_accept: accept });
    const result = data as { ok: boolean } | null;
    if (!result?.ok) return;
    setOrganizerInvites(prev => prev.filter(i => i.id !== invite.id));
    if (accept) await onAccepted();
  }

  useEffect(() => {
    if (authLoading || !user) return;
    loadChairInvites();
    loadOrganizerInvites();
    loadImportInvites();
    loadDrafts();
  }, [authLoading, user, loadChairInvites, loadOrganizerInvites, loadImportInvites, loadDrafts]);

  // #drafts from the profile menu: the section only exists once the drafts
  // query has resolved, so the browser's own hash scroll has already run and
  // missed it. Scroll once, when the anchor actually exists.
  const draftsScrolled = useRef(false);
  useEffect(() => {
    if (draftsScrolled.current || drafts.length === 0) return;
    if (typeof window === 'undefined' || window.location.hash !== '#drafts') return;
    draftsScrolled.current = true;
    requestAnimationFrame(() => {
      document.getElementById('drafts')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [drafts]);

  return {
    chairInvites, organizerInvites, importInvites, drafts, acceptedToast, confirmModal,
    respondChair, respondOrganizer, deleteDraft,
  };
}

/** The "Invite accepted" line after /invites/chair/[token]. */
export function AcceptedNotice() {
  return (
    <div
      role="status"
      className="flex items-center gap-2.5 px-4 py-3 mb-5"
      style={{ borderRadius: 16, backgroundColor: '#FFFFFF', boxShadow: NEU.outSm }}
    >
      <NeuIconDisc gradient={NEU_GRADIENTS.green} icon={Check} size={30} />
      <p className="text-sm" style={{ margin: 0, color: NEU.forest, fontFamily: OUTFIT, fontWeight: 700 }}>
        Invite accepted. You&apos;re now chairing this committee.
      </p>
    </div>
  );
}

/** A section header's count: a plain number beside the label, no chip
 *  (CLAUDE.md §8, no count pills). */
function CountChip({ n, muted = false }: { n: number; muted?: boolean }) {
  return (
    <span
      style={{
        fontFamily: MONO, fontSize: 15, fontWeight: 800, lineHeight: 1,
        color: muted ? NEU.inkSoft : NEU.deepGold, fontVariantNumeric: 'tabular-nums',
      }}
    >
      {n}
    </span>
  );
}

// ── Invite card shell (shared by chair + organizer invites) ────────────────

function InviteCardShell({ title, subtitle, responding, onDecline, onAccept }: {
  title: string;
  subtitle: string;
  responding: 'accept' | 'decline' | null;
  onDecline: () => void;
  onAccept: () => void;
}) {
  const busy = responding !== null;
  return (
    <div
      /* Stacks on a phone. The 40px disc and the DECLINE + ACCEPT pair are
         both non-shrinking and take ~220px of a 328px card, so the invited
         conference's NAME — the one thing the row exists to say — truncated to
         a letter or two. From `sm` up it is the single row it was. */
      className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3.5 px-4 py-3.5"
      style={{ borderRadius: 18, backgroundColor: '#FFFFFF', boxShadow: '0 0 0 1px rgba(27,56,40,0.07), 6px 9px 20px -6px rgba(27,56,40,0.16)' }}
    >
      <div className="flex items-center gap-3.5 min-w-0 sm:flex-1">
        <NeuIconDisc gradient={NEU_GRADIENTS.gold} icon={Mail} iconColor={NEU.forest} size={40} />
        <div className="min-w-0 flex-1">
          <p className="font-bold text-sm [overflow-wrap:anywhere]" style={{ color: NEU.ink, fontFamily: OUTFIT }}>
            {title}
          </p>
          <p className="text-xs [overflow-wrap:anywhere]" style={{ color: NEU.inkSoft, fontFamily: OUTFIT }}>
            {subtitle}
          </p>
        </div>
      </div>
      <div className="flex gap-2 flex-shrink-0 justify-end sm:justify-start">
        <button
          onClick={onDecline}
          disabled={busy}
          className="focus:outline-none inline-flex items-center gap-1.5"
          style={{
            padding: '7px 13px', borderRadius: 999, border: 'none',
            backgroundColor: NEU.surface, boxShadow: busy ? NEU.inSm : NEU.outSm,
            color: busy ? NEU.muted : NEU.ink, fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 800,
            cursor: busy ? 'not-allowed' : 'pointer',
          }}
        >
          <X size={12} strokeWidth={2.6} /> {responding === 'decline' ? '...' : 'Decline'}
        </button>
        <button
          onClick={onAccept}
          disabled={busy}
          className="focus:outline-none inline-flex items-center gap-1.5"
          style={{
            padding: '7px 14px', borderRadius: 999, border: 'none',
            background: busy ? NEU.base : `linear-gradient(135deg, ${NEU_GRADIENTS.forest[0]}, ${NEU_GRADIENTS.forest[1]})`,
            boxShadow: busy ? NEU.inSm : `0 3px 8px color-mix(in srgb, ${NEU_GRADIENTS.forest[0]} 27%, transparent), ${NEU.outSm}`,
            color: busy ? NEU.muted : NEU.gold, fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 800,
            cursor: busy ? 'not-allowed' : 'pointer',
          }}
        >
          <Check size={12} strokeWidth={2.6} /> {responding === 'accept' ? '...' : 'Accept'}
        </button>
      </div>
    </div>
  );
}

// ── Chair invites (pending, awaiting the signed-in user's response) ────────

function ChairInviteCard({ invite, onRespond }: { invite: ChairInvite; onRespond: (invite: ChairInvite, accept: boolean) => void }) {
  const [responding, setResponding] = useState<'accept' | 'decline' | null>(null);

  async function handle(accept: boolean) {
    setResponding(accept ? 'accept' : 'decline');
    await onRespond(invite, accept);
    setResponding(null);
  }

  return (
    <InviteCardShell
      title={`Chair ${invite.committeeName}`}
      subtitle={`${invite.conferenceName} · ${invite.acronym}`}
      responding={responding}
      onDecline={() => handle(false)}
      onAccept={() => handle(true)}
    />
  );
}

export function ChairInvitesSection({ invites, onRespond }: { invites: ChairInvite[]; onRespond: (invite: ChairInvite, accept: boolean) => void }) {
  if (invites.length === 0) return null;
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2.5 mb-3">
        <Eyebrow>Chair invitations</Eyebrow>
        <CountChip n={invites.length} />
      </div>
      <div className="flex flex-col gap-2.5">
        {invites.map(inv => (
          <ChairInviteCard key={inv.id} invite={inv} onRespond={onRespond} />
        ))}
      </div>
    </div>
  );
}

// ── Imported delegate invitations (pending, claimable by the signed-in user) ─
// Not an accept/decline invite: it's a one-way claim, so this is a sibling of
// InviteCardShell (same visual recipe) with a single OPEN INVITATION link into
// the claim landing rather than the two-button accept/decline shell.

export function PendingImportInvitesSection({ invites }: { invites: ImportInvite[] }) {
  if (invites.length === 0) return null;
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2.5 mb-3">
        <Eyebrow>Your invitations</Eyebrow>
        <CountChip n={invites.length} />
      </div>
      <div className="flex flex-col gap-2.5">
        {invites.map(inv => {
          const subtitle = inv.allocation
            ? `${inv.allocation.country_name} in ${inv.allocation.abbreviation || inv.allocation.committee}`
            : inv.conference.full_name;
          return (
            <div
              key={inv.application_id}
              className="flex items-center gap-3.5 rounded-2xl px-4 py-3.5"
              style={{ backgroundColor: '#FFFFFF', boxShadow: '0 0 0 1px rgba(27,56,40,0.07), 6px 9px 20px -6px rgba(27,56,40,0.16)' }}
            >
              <NeuIconDisc gradient={NEU_GRADIENTS.gold} icon={Mail} size={40} />
              <div className="flex-1 min-w-0">
                <p className="font-black text-sm [overflow-wrap:anywhere]" style={{ color: NEU.ink, fontFamily: OUTFIT }}>
                  {conferenceAcronymLabel(inv.conference)} invited you as {inv.role.replace(/-/g, ' ')}
                </p>
                <p className="text-xs [overflow-wrap:anywhere] mt-0.5" style={{ color: NEU.inkSoft, fontFamily: OUTFIT }}>
                  {subtitle}
                </p>
              </div>
              <Link
                href={`/invites/import/${inv.claim_token}`}
                className="flex-shrink-0 inline-flex items-center gap-2 rounded-full py-2 px-4 font-bold text-xs focus:outline-none"
                style={{
                  background: `linear-gradient(135deg, ${NEU_GRADIENTS.forest[0]}, ${NEU_GRADIENTS.forest[1]})`,
                  color: NEU.gold, textDecoration: 'none', fontFamily: OUTFIT,
                  boxShadow: `0 4px 10px color-mix(in srgb, ${NEU_GRADIENTS.forest[0]} 30%, transparent), ${NEU.outSm}`,
                }}
              >
                Open invitation
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Organizer invites (pending, awaiting the signed-in user's response) ────

function OrganizerInviteCard({ invite, onRespond }: { invite: OrganizerInvite; onRespond: (invite: OrganizerInvite, accept: boolean) => void }) {
  const [responding, setResponding] = useState<'accept' | 'decline' | null>(null);

  async function handle(accept: boolean) {
    setResponding(accept ? 'accept' : 'decline');
    await onRespond(invite, accept);
    setResponding(null);
  }

  return (
    <InviteCardShell
      title={invite.publicTitle ? `Join as ${invite.publicTitle}` : 'Join the organizing team'}
      subtitle={`${invite.conferenceName} · ${invite.acronym}`}
      responding={responding}
      onDecline={() => handle(false)}
      onAccept={() => handle(true)}
    />
  );
}

export function OrganizerInvitesSection({ invites, onRespond }: { invites: OrganizerInvite[]; onRespond: (invite: OrganizerInvite, accept: boolean) => void }) {
  if (invites.length === 0) return null;
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2.5 mb-3">
        <Eyebrow>Team invitations</Eyebrow>
        <CountChip n={invites.length} />
      </div>
      <div className="flex flex-col gap-2.5">
        {invites.map(inv => (
          <OrganizerInviteCard key={inv.id} invite={inv} onRespond={onRespond} />
        ))}
      </div>
    </div>
  );
}

// ── Drafts to complete ───────────────────────────────────────────────────────
// The applicant-side mirror of the organiser "Drafts" section further down this
// file: same Eyebrow + muted CountChip + helper-copy anatomy, one pattern.
//
// Anchored `id="drafts"` so the profile menu's /account/conferences?tab=all#drafts
// lands here.

/** "3 minutes ago" / "2 days ago" — coarse on purpose, this is a nudge. */
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return 'recently';
  const secs = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (secs < 60) return 'just now';
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;
  const years = Math.round(months / 12);
  return `${years} year${years === 1 ? '' : 's'} ago`;
}

function DraftRowCard({ draft, onDelete }: { draft: DraftRow; onDelete: (draft: DraftRow) => void }) {
  const [busy, setBusy] = useState(false);
  // House UI rule: acronym primary, full name small beneath — and only when the
  // acronym is a real collapse of the name, never a redundant second line.
  const collapsed = committeeDisplayName(draft.fullName, draft.acronym) || draft.fullName;
  const secondary = collapsed === draft.fullName ? null : draft.fullName;
  // The acronym identifies the conference on its own here, so it carries the year.
  const primary = secondary
    ? conferenceAcronymLabel({ acronym: collapsed, full_name: draft.fullName, start_date: draft.startDate }) || collapsed
    : collapsed;
  const roleLabel = DRAFT_ROLE_LABEL[draft.role] ?? draft.role;

  return (
    <div
      className="flex items-center gap-3 px-3.5 py-3"
      style={{ borderRadius: 18, backgroundColor: '#FFFFFF', boxShadow: '0 0 0 1px rgba(27,56,40,0.07), 6px 9px 20px -6px rgba(27,56,40,0.16)' }}
    >
      <LogoDisc
        src={draft.logoUrl}
        alt={draft.acronym || draft.fullName}
        size={40}
        fallbackText={(draft.acronym || draft.fullName).slice(0, 3)}
      />
      <div className="min-w-0 flex-1">
        <p className="font-black text-sm [overflow-wrap:anywhere]" style={{ color: NEU.ink, fontFamily: OUTFIT, letterSpacing: '-0.01em' }}>
          {primary}
        </p>
        {secondary && (
          <p className="text-[11px] [overflow-wrap:anywhere]" style={{ color: NEU.inkSoft, fontFamily: OUTFIT, fontWeight: 600 }}>
            {secondary}
          </p>
        )}
        <p className="text-xs mt-0.5" style={{ color: NEU.inkSoft, fontFamily: OUTFIT }}>
          {roleLabel} · last edited {relativeTime(draft.updatedAt)}
        </p>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <Link
          href={`/conferences/${draft.slug}/apply?role=${encodeURIComponent(draft.role)}`}
          className="inline-flex items-center focus:outline-none min-h-11 sm:min-h-0"
          style={{
            padding: '8px 14px', borderRadius: 999, border: 'none',
            background: `linear-gradient(135deg, ${NEU_GRADIENTS.forest[0]}, ${NEU_GRADIENTS.forest[1]})`,
            boxShadow: `0 3px 8px color-mix(in srgb, ${NEU_GRADIENTS.forest[0]} 27%, transparent), ${NEU.outSm}`,
            color: NEU.gold, fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 800,
            textDecoration: 'none', whiteSpace: 'nowrap',
          }}
        >
          Continue
        </Link>
        <button
          onClick={async () => { setBusy(true); try { await onDelete(draft); } finally { setBusy(false); } }}
          disabled={busy}
          className="inline-flex items-center justify-center focus:outline-none"
          aria-label={`Delete ${primary} draft`}
          style={{
            width: 34, height: 34, borderRadius: 999, border: 'none',
            backgroundColor: NEU.surface, boxShadow: busy ? NEU.inSm : NEU.outSm,
            color: busy ? NEU.inkSoft : '#8B2020', cursor: busy ? 'default' : 'pointer',
            transition: `box-shadow 160ms ${EASE}`,
          }}
        >
          <Trash2 size={15} strokeWidth={2.2} />
        </button>
      </div>
    </div>
  );
}

export function DraftsToCompleteSection({ drafts, onDelete }: { drafts: DraftRow[]; onDelete: (draft: DraftRow) => void }) {
  if (drafts.length === 0) return null;
  return (
    <section id="drafts" className="mb-8" style={{ scrollMarginTop: 96 }}>
      <div className="flex items-center gap-2.5 mb-2">
        <Eyebrow>Drafts to complete</Eyebrow>
        {/* Not `muted`: the organiser Drafts list below is a de-emphasised
            archive, this one is a nudge — and NEU.muted on NEU.base is 2.7:1,
            which is decoration contrast, not readable-number contrast. */}
        <CountChip n={drafts.length} />
      </div>
      <p className="text-xs mb-4" style={{ color: NEU.inkSoft, fontFamily: OUTFIT }}>
        Applications you started but haven&apos;t submitted. Nobody sees these until you send them.
      </p>
      <div className="flex flex-col gap-2.5">
        {drafts.map((d) => (
          <DraftRowCard key={d.id} draft={d} onDelete={onDelete} />
        ))}
      </div>
    </section>
  );
}

