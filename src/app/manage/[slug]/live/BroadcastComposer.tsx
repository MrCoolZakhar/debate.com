'use client';

// ORGANISER-SIDE BROADCAST COMPOSER
//
// Writes rows into `public.session_broadcasts`. This file is the sending half
// ONLY — nothing here suspends or ends a committee. It records the organiser's
// intent against every targeted session; the chair console is what acts on it.
//
// WHAT THE TABLE ENFORCES (checked against the live schema, do not fight it):
//   • kind ∈ {informational, actionable}
//   • action ∈ {pause, end}, and `session_broadcasts_action_matches_kind`
//     requires action IS NOT NULL for 'actionable' and NULL for
//     'informational'. buildBroadcastRows() is the single place that shape is
//     assembled, so an impossible row can never be attempted.
//   • btrim(message) <> '' — blank messages are rejected by the DB.
//   • INSERT and DELETE both require is_conference_organizer(conference_id),
//     so conference_id is mandatory and the client MUST be authenticated
//     (getFreshAuthedClient, never the anon client).
//
// FAN-OUT: one row per committee. Broadcasting to N committees is N rows in a
// single insert, which share one transaction timestamp — that shared
// created_at is what groupBroadcasts() folds them back together on.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Megaphone, Info, Zap, PauseCircle, Flag, ImagePlus, X, Trash2,
  Check, Clock, AlertTriangle, Loader2, Radio,
} from 'lucide-react';
import Portal from '@/components/Portal';
import { LogoDisc } from '@/components/LogoDisc';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import {
  NeuInset, NeuIconDisc, NEU, NEU_GRADIENTS, type NeuGradient, OUTFIT, EASE,
} from '@/components/neu';
import { type LiveCommittee, type CardStatus, cardStatus } from './LiveModals';

// ── Types ───────────────────────────────────────────────────────────────────

export type BroadcastKind = 'informational' | 'actionable';
export type BroadcastAction = 'pause' | 'end';

/** A committee that can actually receive a broadcast: a conference_committees
 *  row WITH a linked session, i.e. a real `committees.id` to key the row on. */
export interface BroadcastTarget {
  confCommitteeId: string;
  /** committees.id — the value written to session_broadcasts.committee_id. */
  sessionId: string;
  label: string;
  fullName: string | null;
  sessionCode: string;
  status: CardStatus;
  logoUrl: string | null;
}

export interface BroadcastRow {
  id: string;
  committeeId: string;
  kind: BroadcastKind;
  message: string;
  imageUrl: string | null;
  action: BroadcastAction | null;
  actionAt: string | null;
  createdAt: string;
  expiresAt: string | null;
}

/** One send, folded back from its per-committee rows. */
export interface BroadcastGroup {
  key: string;
  ids: string[];
  count: number;
  kind: BroadcastKind;
  message: string;
  imageUrl: string | null;
  action: BroadcastAction | null;
  actionAt: string | null;
  createdAt: string;
  expiresAt: string | null;
}

export const BROADCAST_COLUMNS =
  'id, committee_id, kind, message, image_url, action, action_at, created_at, expires_at';

/**
 * TTL — why one hour.
 *
 * A broadcast is a live-floor instruction, not a noticeboard: an hour after it
 * was issued (or after the instant it was scheduled for) it is stale and must
 * stop nagging a dais that has moved on. One hour is also exactly the window
 * AGENTS.md pins to END DEBATE — `endDebateInDB` sets expires_at = now + 1h and
 * the hourly pg_cron job then deletes the committee — so an 'end' broadcast can
 * never outlive the committee it ends, and every other kind is bounded by the
 * same clock the rest of the session model already uses.
 */
export const BROADCAST_TTL_MS = 60 * 60 * 1000;

/** Scheduling presets, in minutes. 0 = the moment Send is pressed. */
export const DELAY_PRESETS = [0, 5, 10, 15, 30] as const;

export const MESSAGE_MAX = 500;

/** Exactly the bucket's `allowed_mime_types` on `conference-assets`. Anything
 *  else (HEIC off an iPhone, an SVG) is rejected by storage itself, so it is
 *  refused in the picker instead of failing after the upload round-trip. */
export const BROADCAST_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

// ── Pure helpers (exported so the page can derive without duplicating rules) ─

/** Committees that can be broadcast to.
 *
 *  Two exclusions, both load-bearing:
 *   - no `session` → the conference_committees row was never linked to a
 *     session (session_id null), so there is no committees.id to write; the
 *     FK would reject the row.
 *   - `endedAt` set → the committee is adjourned for good and, per
 *     FEATURE: END DEBATE, roughly an hour from being deleted outright. */
export function broadcastTargets(rows: LiveCommittee[]): BroadcastTarget[] {
  const out: BroadcastTarget[] = [];
  for (const r of rows) {
    const s = r.session;
    if (!s) continue;
    if (s.endedAt) continue;
    const acr = r.conf.abbreviation?.trim() || null;
    out.push({
      confCommitteeId: r.conf.id,
      sessionId: s.id,
      label: acr ?? r.conf.name,
      fullName: acr && acr !== r.conf.name ? r.conf.name : null,
      sessionCode: s.code,
      status: cardStatus(r),
      logoUrl: r.conf.logoUrl,
    });
  }
  return out;
}

export function mapBroadcastRow(r: Record<string, unknown>): BroadcastRow {
  return {
    id: r.id as string,
    committeeId: r.committee_id as string,
    kind: (r.kind as BroadcastKind) ?? 'informational',
    message: (r.message as string) ?? '',
    imageUrl: (r.image_url as string | null) ?? null,
    action: (r.action as BroadcastAction | null) ?? null,
    actionAt: (r.action_at as string | null) ?? null,
    createdAt: (r.created_at as string) ?? '',
    expiresAt: (r.expires_at as string | null) ?? null,
  };
}

/** Fold the per-committee fan-out back into one entry per send. */
export function groupBroadcasts(rows: BroadcastRow[]): BroadcastGroup[] {
  const byKey = new Map<string, BroadcastGroup>();
  for (const r of rows) {
    const key = [r.createdAt, r.kind, r.action ?? '-', r.actionAt ?? '-', r.message].join('|');
    const existing = byKey.get(key);
    if (existing) {
      existing.ids.push(r.id);
      existing.count += 1;
      continue;
    }
    byKey.set(key, {
      key,
      ids: [r.id],
      count: 1,
      kind: r.kind,
      message: r.message,
      imageUrl: r.imageUrl,
      action: r.action,
      actionAt: r.actionAt,
      createdAt: r.createdAt,
      expiresAt: r.expiresAt,
    });
  }
  return Array.from(byKey.values()).sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  );
}

/** Can this send still be pulled back?
 *
 *  An actionable broadcast is retractable only while its scheduled instant is
 *  still in the future — once the chair console has been told to pause or end,
 *  deleting the row does not un-ring that bell. An informational one is
 *  retractable until it expires, because until then it is still on screen. */
export function canWithdraw(g: BroadcastGroup, now: number): boolean {
  if (g.kind === 'actionable') return g.actionAt ? Date.parse(g.actionAt) > now : false;
  return g.expiresAt ? Date.parse(g.expiresAt) > now : true;
}

/** Rows for one send. The ONLY place the kind/action pairing is assembled. */
export function buildBroadcastRows(input: {
  targets: BroadcastTarget[];
  conferenceId: string;
  createdBy: string | null;
  kind: BroadcastKind;
  message: string;
  imageUrl: string | null;
  action: BroadcastAction | null;
  /** Minutes from now the action should take effect. Ignored when informational. */
  delayMinutes: number;
  now?: number;
}): Record<string, unknown>[] {
  const now = input.now ?? Date.now();
  const actionable = input.kind === 'actionable';
  const actionAtMs = now + Math.max(0, Math.round(input.delayMinutes)) * 60_000;
  const message = input.message.trim();
  return input.targets.map((t) => ({
    committee_id: t.sessionId,
    conference_id: input.conferenceId,
    kind: input.kind,
    message,
    image_url: actionable ? null : input.imageUrl || null,
    action: actionable ? input.action : null,
    action_at: actionable ? new Date(actionAtMs).toISOString() : null,
    created_by: input.createdBy,
    expires_at: new Date((actionable ? actionAtMs : now) + BROADCAST_TTL_MS).toISOString(),
  }));
}

const EXPIRED_SESSION = 'Your session has expired — refresh the page and sign in again.';

/** Insert the fan-out. Returns an error string, or null on success. */
export async function sendBroadcast(
  rows: Record<string, unknown>[],
): Promise<string | null> {
  if (rows.length === 0) return 'Pick at least one committee.';
  const supabase = await getFreshAuthedClient();
  if (!supabase) return EXPIRED_SESSION;
  const { error } = await supabase.from('session_broadcasts').insert(rows);
  return error ? error.message : null;
}

/** Delete every row of one send. Returns an error string, or null on success. */
export async function deleteBroadcastGroup(ids: string[]): Promise<string | null> {
  if (ids.length === 0) return null;
  const supabase = await getFreshAuthedClient();
  if (!supabase) return EXPIRED_SESSION;
  const { error } = await supabase.from('session_broadcasts').delete().in('id', ids);
  return error ? error.message : null;
}

/** Upload a broadcast image to the public `conference-assets` bucket.
 *
 *  Copied from manage/[slug]/settings (handleBannerUpload) — same bucket, same
 *  `contentType: file.type`, same authenticated client. The one deliberate
 *  difference is `upsert: false`: the path already carries Date.now() so it is
 *  unique by construction, and upsert would make the write depend on UPDATE on
 *  storage.objects rather than INSERT alone. That is exactly the trap the
 *  session-document uploads fell into. `conference-assets` does grant
 *  authenticated UPDATE (verified against storage's policies), so upsert would
 *  in fact work here — but nothing about this path needs it, so it does not
 *  ask for it. */
export async function uploadBroadcastImage(
  conferenceId: string,
  file: File,
): Promise<{ url?: string; error?: string }> {
  if (!BROADCAST_IMAGE_TYPES.includes(file.type)) {
    return { error: 'Attach a JPEG, PNG, WebP or GIF.' };
  }
  // Mirrors the bucket's own 5MB file_size_limit, so an oversized file is
  // refused here with a readable message instead of a storage 413.
  if (file.size > 5 * 1024 * 1024) return { error: 'Image must be under 5MB.' };
  const supabase = await getFreshAuthedClient();
  if (!supabase) return { error: EXPIRED_SESSION };
  const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
  const path = `broadcasts/${conferenceId}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from('conference-assets')
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) return { error: "Couldn't upload the image: " + error.message };
  const { data } = supabase.storage.from('conference-assets').getPublicUrl(path);
  return { url: data.publicUrl };
}

// ── Small shared bits ───────────────────────────────────────────────────────

function Eyebrow({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <p
      className="text-[11px] font-bold uppercase"
      style={{ color: NEU.muted, fontFamily: OUTFIT, letterSpacing: '0.08em', ...style }}
    >
      {children}
    </p>
  );
}

function relTime(iso: string, now: number): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return '';
  const mins = Math.round((now - ms) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function inTime(iso: string, now: number): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return '';
  const secs = Math.round((ms - now) / 1000);
  if (secs <= 0) return 'now';
  if (secs < 60) return `in ${secs}s`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `in ${mins}m`;
  return `in ${Math.round(mins / 60)}h`;
}

/** Wall clock for the relative labels — one interval for the whole list. */
function useNow(active: boolean, intervalMs = 15_000): number {
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    if (!active) return;
    // No synchronous setNow here — the useState initialiser already seeded the
    // clock, and firing one on mount would be a cascading render for nothing.
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [active, intervalMs]);
  return now;
}

const STATUS_TEXT: Record<CardStatus, string> = {
  'no-session': 'No session',
  'not-started': 'Roll call',
  live: 'In session',
  suspended: 'Suspended',
  ended: 'Adjourned',
};

function statusColor(s: CardStatus): string {
  if (s === 'live') return NEU.green;
  if (s === 'suspended') return NEU.amber;
  return NEU.muted;
}

/** Segmented choice, one row of pressed/extruded tiles. */
function Segment<T extends string>({
  options, value, onChange, disabled = false,
}: {
  options: { value: T; label: string; sub?: string; icon: React.ComponentType<{ size?: number; strokeWidth?: number; style?: React.CSSProperties }>; gradient: NeuGradient }[];
  value: T;
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-2.5" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className="flex items-center gap-3 focus:outline-none"
            style={{
              padding: '11px 13px',
              borderRadius: 16,
              border: 'none',
              textAlign: 'start',
              backgroundColor: active ? NEU.base : NEU.surface,
              boxShadow: active ? `inset 0 0 0 1.5px ${o.gradient[0]}66, ${NEU.inSm}` : NEU.outSm,
              cursor: disabled ? 'default' : 'pointer',
              opacity: disabled ? 0.55 : 1,
              transition: `box-shadow 220ms ${EASE}`,
            }}
          >
            <NeuIconDisc gradient={o.gradient} icon={o.icon} size={32} />
            <span className="min-w-0">
              <span
                className="block text-sm font-extrabold truncate"
                style={{ color: active ? NEU.ink : NEU.forest, fontFamily: OUTFIT }}
              >
                {o.label}
              </span>
              {o.sub && (
                <span className="block text-[11px] truncate" style={{ color: NEU.muted, fontFamily: OUTFIT }}>
                  {o.sub}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ── Composer modal ──────────────────────────────────────────────────────────

export function BroadcastComposer({
  conferenceId,
  conferenceLabel,
  createdBy,
  targets,
  onClose,
  onSent,
}: {
  conferenceId: string;
  conferenceLabel: string;
  createdBy: string | null;
  targets: BroadcastTarget[];
  onClose: () => void;
  onSent: () => void;
}) {
  const [kind, setKind] = useState<BroadcastKind>('informational');
  const [action, setAction] = useState<BroadcastAction>('pause');
  const [message, setMessage] = useState('');
  const [delay, setDelay] = useState<number>(0);
  const [customDelay, setCustomDelay] = useState('');
  const [selected, setSelected] = useState<Set<string>>(() => new Set(targets.map((t) => t.sessionId)));
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [ack, setAck] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Committees that appear mid-composition (a chair opening a session while the
  // modal is up) join the default-all selection rather than being silently
  // dropped; deselecting one still sticks, because only NEW ids are added.
  const knownRef = useRef<Set<string>>(new Set(targets.map((t) => t.sessionId)));
  useEffect(() => {
    const fresh = targets.filter((t) => !knownRef.current.has(t.sessionId)).map((t) => t.sessionId);
    const gone = new Set(targets.map((t) => t.sessionId));
    knownRef.current = gone;
    if (fresh.length === 0) return;
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of fresh) next.add(id);
      return next;
    });
  }, [targets]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const selectedTargets = useMemo(
    () => targets.filter((t) => selected.has(t.sessionId)),
    [targets, selected],
  );
  const count = selectedTargets.length;
  const trimmed = message.trim();
  const ending = kind === 'actionable' && action === 'end';
  const canSend = count > 0 && trimmed.length > 0 && !sending && !uploading;

  // Any edit invalidates a confirmation the organiser already gave.
  const resetConfirm = useCallback(() => { setConfirmEnd(false); setAck(false); }, []);

  function toggle(id: string) {
    resetConfirm();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError('');
    setUploading(true);
    const res = await uploadBroadcastImage(conferenceId, file);
    setUploading(false);
    if (res.error) { setError(res.error); return; }
    setImageUrl(res.url ?? null);
    setImageName(file.name);
  }

  async function doSend() {
    if (!canSend) return;
    setSending(true);
    setError('');
    const rows = buildBroadcastRows({
      targets: selectedTargets,
      conferenceId,
      createdBy,
      kind,
      message: trimmed,
      imageUrl,
      action: kind === 'actionable' ? action : null,
      delayMinutes: delay,
    });
    const err = await sendBroadcast(rows);
    setSending(false);
    if (err) { setError(err); return; }
    onSent();
    onClose();
  }

  function handlePrimary() {
    if (!canSend) return;
    // Ending debate is irreversible (ended_at is permanent and the committee is
    // deleted an hour later) — it never fires on the first click.
    if (ending && !confirmEnd) { setConfirmEnd(true); return; }
    if (ending && !ack) return;
    void doSend();
  }

  const delayLabel = delay === 0
    ? 'immediately'
    : `in ${delay} minute${delay === 1 ? '' : 's'}`;

  return (
    <Portal>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8"
        style={{ backgroundColor: 'rgba(27,20,16,0.42)' }}
        onClick={onClose}
      >
        <div
          className="w-full rounded-[22px] relative flex flex-col"
          style={{
            maxWidth: 720,
            backgroundColor: NEU.surface,
            boxShadow: NEU.out,
            maxHeight: 'calc(100vh - 64px)',
            fontFamily: OUTFIT,
          }}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label="Compose a broadcast"
        >
          {/* Header */}
          <div className="flex items-center gap-3.5" style={{ padding: '26px 30px 16px' }}>
            <NeuIconDisc gradient={NEU_GRADIENTS.forest} emoji="Loudspeaker" icon={Megaphone} size={46} />
            <div className="min-w-0 flex-1">
              <Eyebrow>Broadcast · {conferenceLabel}</Eyebrow>
              <h2 className="font-black" style={{ color: NEU.ink, fontFamily: OUTFIT, fontSize: 23, lineHeight: 1.1, marginTop: 2 }}>
                Message the floor
              </h2>
            </div>
            <button
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-full focus:outline-none flex-shrink-0"
              style={{ width: 32, height: 32, border: 'none', color: NEU.muted, backgroundColor: NEU.surface, boxShadow: NEU.outSm, cursor: 'pointer', transition: `box-shadow 200ms ${EASE}` }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = NEU.outSmHover; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = NEU.outSm; }}
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>

          {/* Body */}
          <div className="overflow-y-auto" style={{ padding: '0 30px 4px' }}>
            {targets.length === 0 ? (
              <NeuInset className="text-center" style={{ padding: '34px 20px', borderRadius: 18, marginBottom: 18 }}>
                <p className="text-sm font-bold" style={{ color: NEU.ink, fontFamily: OUTFIT }}>
                  No committee can receive a broadcast yet
                </p>
                <p className="text-xs mt-1.5" style={{ color: NEU.muted, fontFamily: OUTFIT }}>
                  A committee needs a linked session before it has anywhere to deliver to. Generate session
                  codes in Committees, or wait for the chairs to open theirs.
                </p>
              </NeuInset>
            ) : (
              <>
                {/* Mode */}
                <Eyebrow style={{ marginBottom: 8 }}>Type</Eyebrow>
                <Segment
                  value={kind}
                  onChange={(v) => { setKind(v); resetConfirm(); setError(''); }}
                  disabled={sending}
                  options={[
                    { value: 'informational', label: 'Informational', sub: 'A notice on the dais', icon: Info, gradient: NEU_GRADIENTS.sage },
                    { value: 'actionable', label: 'Actionable', sub: 'Pause or end debate', icon: Zap, gradient: NEU_GRADIENTS.gold },
                  ]}
                />

                {/* Message */}
                <div className="mt-5">
                  <div className="flex items-baseline justify-between gap-3">
                    <Eyebrow>Message</Eyebrow>
                    <span
                      className="text-[10px] font-bold"
                      style={{ color: trimmed.length > MESSAGE_MAX - 40 ? NEU.amber : NEU.muted, fontFamily: OUTFIT, fontVariantNumeric: 'tabular-nums' }}
                    >
                      {trimmed.length}/{MESSAGE_MAX}
                    </span>
                  </div>
                  <textarea
                    value={message}
                    maxLength={MESSAGE_MAX}
                    onChange={(e) => { setMessage(e.target.value); resetConfirm(); }}
                    disabled={sending}
                    rows={3}
                    placeholder={kind === 'actionable'
                      ? 'Tell the dais why — e.g. "Lunch break, please suspend and return at 14:00."'
                      : 'e.g. "Photos in the main hall at 15:30 — delegates in formal dress."'}
                    className="w-full mt-2 focus:outline-none"
                    style={{
                      padding: '12px 14px',
                      borderRadius: 16,
                      border: 'none',
                      resize: 'vertical',
                      backgroundColor: NEU.base,
                      boxShadow: NEU.inSm,
                      color: NEU.ink,
                      fontFamily: OUTFIT,
                      fontSize: 14,
                      lineHeight: 1.45,
                      textAlign: 'start',
                    }}
                  />
                </div>

                {/* Informational: optional image */}
                {kind === 'informational' && (
                  <div className="mt-4">
                    <Eyebrow style={{ marginBottom: 8 }}>Image (optional)</Eyebrow>
                    <input
                      ref={fileRef}
                      type="file"
                      accept={BROADCAST_IMAGE_TYPES.join(',')}
                      className="hidden"
                      onChange={(e) => { void handleFile(e.target.files?.[0]); e.target.value = ''; }}
                    />
                    {imageUrl ? (
                      <NeuInset className="flex items-center gap-3" style={{ padding: 10, borderRadius: 16 }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={imageUrl}
                          alt=""
                          style={{ width: 56, height: 56, borderRadius: 12, objectFit: 'cover', display: 'block', boxShadow: NEU.outSm, flexShrink: 0 }}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-xs font-bold truncate" style={{ color: NEU.ink, fontFamily: OUTFIT }}>
                            {imageName || 'Attached image'}
                          </span>
                          <span className="block text-[11px]" style={{ color: NEU.green, fontFamily: OUTFIT }}>
                            Uploaded — delegates and chairs will see it with the message
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => { setImageUrl(null); setImageName(''); }}
                          className="inline-flex items-center gap-1.5 rounded-full focus:outline-none flex-shrink-0"
                          style={{ padding: '6px 12px', border: 'none', backgroundColor: NEU.surface, boxShadow: NEU.outSm, color: NEU.muted, fontFamily: OUTFIT, fontSize: 11, fontWeight: 800, cursor: 'pointer' }}
                        >
                          <X size={12} /> Remove
                        </button>
                      </NeuInset>
                    ) : (
                      <button
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        disabled={uploading}
                        className="inline-flex items-center gap-2 rounded-full focus:outline-none"
                        style={{
                          padding: '10px 16px', border: 'none', backgroundColor: NEU.surface,
                          boxShadow: NEU.outSm, color: NEU.forest, fontFamily: OUTFIT,
                          fontSize: 12, fontWeight: 800, letterSpacing: '0.04em',
                          cursor: uploading ? 'default' : 'pointer', opacity: uploading ? 0.6 : 1,
                          transition: `box-shadow 200ms ${EASE}`,
                        }}
                      >
                        {uploading ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
                        {uploading ? 'Uploading…' : 'Attach an image'}
                      </button>
                    )}
                    {!imageUrl && (
                      <p className="text-[11px] mt-1.5" style={{ color: NEU.muted, fontFamily: OUTFIT }}>
                        JPEG, PNG, WebP or GIF · up to 5MB
                      </p>
                    )}
                  </div>
                )}

                {/* Actionable: which action + when */}
                {kind === 'actionable' && (
                  <div className="mt-5">
                    <Eyebrow style={{ marginBottom: 8 }}>Action</Eyebrow>
                    <Segment
                      value={action}
                      onChange={(v) => { setAction(v); resetConfirm(); }}
                      disabled={sending}
                      options={[
                        { value: 'pause', label: 'Pause', sub: 'Suspend the session', icon: PauseCircle, gradient: NEU_GRADIENTS.amber },
                        { value: 'end', label: 'End', sub: 'Adjourn for good', icon: Flag, gradient: ['#9A3030', '#7A1F1F'] as NeuGradient },
                      ]}
                    />

                    <div className="mt-4">
                      <Eyebrow style={{ marginBottom: 8 }}>When</Eyebrow>
                      <div className="flex items-center gap-2 flex-wrap">
                        {DELAY_PRESETS.map((m) => {
                          const active = delay === m && customDelay === '';
                          return (
                            <button
                              key={m}
                              type="button"
                              onClick={() => { setDelay(m); setCustomDelay(''); resetConfirm(); }}
                              className="inline-flex items-center gap-1.5 rounded-full focus:outline-none"
                              style={{
                                padding: '7px 14px', border: 'none',
                                background: active ? `linear-gradient(135deg, ${NEU_GRADIENTS.forest[0]}, ${NEU_GRADIENTS.forest[1]})` : NEU.surface,
                                color: active ? NEU.gold : NEU.ink,
                                boxShadow: active ? `0 3px 8px ${NEU_GRADIENTS.forest[0]}55, ${NEU.outSm}` : NEU.outSm,
                                fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 800,
                                fontVariantNumeric: 'tabular-nums', cursor: 'pointer',
                                transition: `box-shadow 200ms ${EASE}`,
                              }}
                            >
                              {m === 0 ? <><Zap size={12} /> Now</> : <><Clock size={12} /> {m} min</>}
                            </button>
                          );
                        })}
                        <span className="inline-flex items-center gap-2" style={{ marginInlineStart: 4 }}>
                          <input
                            type="number"
                            min={1}
                            max={480}
                            value={customDelay}
                            onChange={(e) => {
                              const raw = e.target.value;
                              setCustomDelay(raw);
                              const n = Number(raw);
                              if (raw !== '' && Number.isFinite(n) && n >= 1) setDelay(Math.min(480, Math.round(n)));
                              resetConfirm();
                            }}
                            placeholder="Custom"
                            className="focus:outline-none"
                            style={{
                              inlineSize: 92, padding: '7px 12px', borderRadius: 999, border: 'none',
                              backgroundColor: NEU.base, boxShadow: NEU.inSm, color: NEU.ink,
                              fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 700,
                              fontVariantNumeric: 'tabular-nums', textAlign: 'start',
                            }}
                          />
                          <span className="text-[11px]" style={{ color: NEU.muted, fontFamily: OUTFIT }}>min</span>
                        </span>
                      </div>
                      <p className="text-[11px] mt-2" style={{ color: NEU.muted, fontFamily: OUTFIT }}>
                        {action === 'pause'
                          ? `Chairs will be asked to suspend ${delayLabel}.`
                          : `Debate will be ended ${delayLabel}.`}
                      </p>
                    </div>
                  </div>
                )}

                {/* Targets */}
                <div className="mt-5">
                  <div className="flex items-baseline justify-between gap-3 flex-wrap">
                    <Eyebrow>Committees</Eyebrow>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => { resetConfirm(); setSelected(new Set(targets.map((t) => t.sessionId))); }}
                        className="text-[11px] font-bold focus:outline-none"
                        style={{ color: NEU.forest, fontFamily: OUTFIT, background: 'none', border: 'none', cursor: 'pointer' }}
                      >
                        Select all
                      </button>
                      <span style={{ color: NEU.muted }}>·</span>
                      <button
                        type="button"
                        onClick={() => { resetConfirm(); setSelected(new Set()); }}
                        className="text-[11px] font-bold focus:outline-none"
                        style={{ color: NEU.muted, fontFamily: OUTFIT, background: 'none', border: 'none', cursor: 'pointer' }}
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <div
                    className="mt-2 overflow-y-auto flex flex-col gap-1.5"
                    style={{ maxHeight: 210, paddingInlineEnd: 4 }}
                  >
                    {targets.map((t) => {
                      const on = selected.has(t.sessionId);
                      return (
                        <button
                          key={t.sessionId}
                          type="button"
                          onClick={() => toggle(t.sessionId)}
                          className="flex items-center gap-3 focus:outline-none"
                          style={{
                            padding: '9px 12px', borderRadius: 14, border: 'none',
                            textAlign: 'start',
                            backgroundColor: on ? NEU.base : NEU.surface,
                            boxShadow: on ? NEU.inSm : NEU.outSm,
                            cursor: 'pointer', transition: `box-shadow 200ms ${EASE}`,
                          }}
                          aria-pressed={on}
                        >
                          <span
                            className="inline-flex items-center justify-center rounded-lg flex-shrink-0"
                            style={{
                              width: 20, height: 20,
                              background: on ? `linear-gradient(135deg, ${NEU_GRADIENTS.forest[0]}, ${NEU_GRADIENTS.forest[1]})` : NEU.surface,
                              boxShadow: on ? `0 2px 6px ${NEU_GRADIENTS.forest[0]}55` : NEU.inSm,
                              color: NEU.gold,
                            }}
                          >
                            {on && <Check size={13} strokeWidth={3} />}
                          </span>
                          <LogoDisc src={t.logoUrl} size={28} fallbackText={t.label.slice(0, 3)} alt={t.label} />
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-bold truncate" style={{ color: NEU.ink, fontFamily: OUTFIT }}>
                              {t.label}
                            </span>
                            {t.fullName && (
                              <span className="block text-[11px] truncate" style={{ color: NEU.muted, fontFamily: OUTFIT }}>
                                {t.fullName}
                              </span>
                            )}
                          </span>
                          <span className="inline-flex items-center gap-1.5 flex-shrink-0">
                            <span className="rounded-full" style={{ width: 7, height: 7, backgroundColor: statusColor(t.status) }} />
                            <span className="text-[10px] font-bold uppercase" style={{ color: NEU.muted, fontFamily: OUTFIT, letterSpacing: '0.06em' }}>
                              {STATUS_TEXT[t.status]}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* End confirmation */}
                {ending && confirmEnd && (
                  <NeuInset
                    className="mt-5"
                    style={{ padding: '14px 16px', borderRadius: 18, boxShadow: `inset 0 0 0 1.5px rgba(154,48,48,0.4), ${NEU.inSm}` }}
                  >
                    <div className="flex items-start gap-3">
                      <AlertTriangle size={18} style={{ color: '#9A3030', flexShrink: 0, marginBlockStart: 2 }} />
                      <div className="min-w-0">
                        <p className="text-sm font-extrabold" style={{ color: '#7A1F1F', fontFamily: OUTFIT }}>
                          This ends {count} committee{count === 1 ? '' : 's'} permanently
                        </p>
                        <p className="text-xs mt-1.5" style={{ color: NEU.ink, fontFamily: OUTFIT, lineHeight: 1.5 }}>
                          {selectedTargets.map((t) => t.label).join(', ')} will be adjourned {delayLabel}. An ended
                          committee cannot be resumed, and its session is deleted about an hour later — speakers
                          lists, documents, chat and feedback go with it.
                        </p>
                        <label
                          className="flex items-center gap-2.5 mt-3"
                          style={{ cursor: 'pointer' }}
                        >
                          <input
                            type="checkbox"
                            checked={ack}
                            onChange={(e) => setAck(e.target.checked)}
                            style={{ inlineSize: 16, blockSize: 16, accentColor: '#9A3030', cursor: 'pointer' }}
                          />
                          <span className="text-xs font-bold" style={{ color: NEU.ink, fontFamily: OUTFIT }}>
                            I understand this cannot be undone
                          </span>
                        </label>
                      </div>
                    </div>
                  </NeuInset>
                )}

                {error && (
                  <p className="text-xs font-bold mt-4" style={{ color: '#9A3030', fontFamily: OUTFIT }}>
                    {error}
                  </p>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div
            className="flex items-center justify-between gap-4 flex-wrap"
            style={{ padding: '16px 30px 24px', borderBlockStart: '1px solid rgba(27,56,40,0.1)', marginBlockStart: 14 }}
          >
            <p className="text-xs" style={{ color: count === 0 ? NEU.amber : NEU.muted, fontFamily: OUTFIT, fontVariantNumeric: 'tabular-nums' }}>
              {count === 0
                ? 'No committees selected — nothing to send'
                : `Reaches ${count} of ${targets.length} committee${targets.length === 1 ? '' : 's'}`}
            </p>
            <div className="flex items-center gap-2.5">
              {ending && confirmEnd && (
                <button
                  type="button"
                  onClick={resetConfirm}
                  className="inline-flex items-center rounded-full focus:outline-none"
                  style={{ padding: '10px 18px', border: 'none', backgroundColor: NEU.surface, boxShadow: NEU.outSm, color: NEU.ink, fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 800, cursor: 'pointer' }}
                >
                  Go back
                </button>
              )}
              <button
                type="button"
                onClick={handlePrimary}
                disabled={!canSend || (ending && confirmEnd && !ack)}
                className="inline-flex items-center gap-2 rounded-full focus:outline-none"
                style={{
                  padding: '11px 22px', border: 'none',
                  background: !canSend || (ending && confirmEnd && !ack)
                    ? 'rgba(27,56,40,0.14)'
                    : ending
                      ? 'linear-gradient(135deg, #9A3030, #7A1F1F)'
                      : `linear-gradient(135deg, ${NEU_GRADIENTS.forest[0]}, ${NEU_GRADIENTS.forest[1]})`,
                  color: !canSend || (ending && confirmEnd && !ack) ? NEU.muted : ending ? '#FFFFFF' : NEU.gold,
                  fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 800, letterSpacing: '0.05em',
                  cursor: !canSend || (ending && confirmEnd && !ack) ? 'default' : 'pointer',
                  boxShadow: !canSend ? 'none' : NEU.outSm,
                  transition: `box-shadow 220ms ${EASE}`,
                }}
              >
                {sending
                  ? <><Loader2 size={14} className="animate-spin" /> Sending…</>
                  : ending
                    ? <><Flag size={14} /> {confirmEnd ? `End ${count} committee${count === 1 ? '' : 's'}` : 'End debate…'}</>
                    : <><Megaphone size={14} /> Send to {count}</>}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
}

// ── Recent broadcasts ───────────────────────────────────────────────────────

function kindVisual(g: BroadcastGroup): { gradient: NeuGradient; icon: React.ComponentType<{ size?: number; strokeWidth?: number; style?: React.CSSProperties }>; label: string } {
  if (g.kind === 'informational') return { gradient: NEU_GRADIENTS.sage, icon: Info, label: 'Notice' };
  if (g.action === 'end') return { gradient: ['#9A3030', '#7A1F1F'], icon: Flag, label: 'End debate' };
  return { gradient: NEU_GRADIENTS.amber, icon: PauseCircle, label: 'Pause' };
}

/** Compact log of what this conference has already broadcast. */
export function RecentBroadcasts({
  groups,
  onDelete,
  busyKey,
  error,
}: {
  groups: BroadcastGroup[];
  onDelete: (g: BroadcastGroup) => void;
  busyKey: string | null;
  error: string;
}) {
  const now = useNow(groups.length > 0);
  const [confirmKey, setConfirmKey] = useState<string | null>(null);

  if (groups.length === 0) return null;

  return (
    <div className="mb-7">
      <div className="flex items-center gap-2 mb-2.5">
        <Radio size={13} style={{ color: NEU.muted }} />
        <p className="text-[11px] font-bold uppercase" style={{ color: NEU.muted, fontFamily: OUTFIT, letterSpacing: '0.08em' }}>
          Recent broadcasts
        </p>
      </div>
      <div className="flex flex-col gap-2">
        {groups.map((g) => {
          const v = kindVisual(g);
          const pending = !!g.actionAt && Date.parse(g.actionAt) > now;
          const withdrawable = canWithdraw(g, now);
          const busy = busyKey === g.key;
          const confirming = confirmKey === g.key;
          return (
            <div
              key={g.key}
              className="flex items-center gap-3"
              style={{ padding: '11px 14px', borderRadius: 16, backgroundColor: NEU.surface, boxShadow: NEU.outSm }}
            >
              <NeuIconDisc gradient={v.gradient} icon={v.icon} size={34} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-extrabold uppercase" style={{ color: NEU.forest, fontFamily: OUTFIT, letterSpacing: '0.07em' }}>
                    {v.label}
                  </span>
                  <span className="text-[11px]" style={{ color: NEU.muted, fontFamily: OUTFIT, fontVariantNumeric: 'tabular-nums' }}>
                    {g.count} committee{g.count === 1 ? '' : 's'} · {relTime(g.createdAt, now)}
                    {g.imageUrl && <> · with image</>}
                  </span>
                  {pending && g.actionAt && (
                    <span
                      className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full"
                      style={{ color: NEU.deepGold, backgroundColor: NEU.base, boxShadow: NEU.inSm, fontFamily: OUTFIT, letterSpacing: '0.06em' }}
                    >
                      <Clock size={10} /> {inTime(g.actionAt, now)}
                    </span>
                  )}
                </div>
                <p className="text-sm truncate" style={{ color: NEU.ink, fontFamily: OUTFIT, marginBlockStart: 2 }} title={g.message}>
                  {g.message}
                </p>
              </div>
              {withdrawable ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (confirming) { setConfirmKey(null); onDelete(g); return; }
                    setConfirmKey(g.key);
                    setTimeout(() => setConfirmKey((k) => (k === g.key ? null : k)), 4000);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full focus:outline-none flex-shrink-0"
                  style={{
                    padding: '6px 13px', border: 'none',
                    backgroundColor: confirming ? 'rgba(154,48,48,0.12)' : NEU.surface,
                    boxShadow: NEU.outSm,
                    color: confirming ? '#9A3030' : NEU.muted,
                    fontFamily: OUTFIT, fontSize: 11, fontWeight: 800,
                    cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1,
                    transition: `box-shadow 200ms ${EASE}, color 200ms ${EASE}`,
                  }}
                  title={g.kind === 'actionable' ? 'Cancel before it takes effect' : 'Withdraw from the dais'}
                >
                  {busy ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                  {confirming ? 'Confirm' : g.kind === 'actionable' ? 'Cancel' : 'Withdraw'}
                </button>
              ) : (
                <span
                  className="text-[10px] font-bold uppercase flex-shrink-0"
                  style={{ color: NEU.muted, fontFamily: OUTFIT, letterSpacing: '0.06em' }}
                  title={g.kind === 'actionable' ? 'Already delivered to the dais — deleting the row would not undo it' : 'Expired'}
                >
                  {g.kind === 'actionable' ? 'Delivered' : 'Expired'}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {error && (
        <p className="text-xs font-bold mt-2" style={{ color: '#9A3030', fontFamily: OUTFIT }}>{error}</p>
      )}
    </div>
  );
}
