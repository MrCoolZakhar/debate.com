'use client';

// ── One invite, as a personal pop-up (prompt 77) ────────────────────────────
//
// Opened from an invite on /jobs My Applications. The conference logo hangs
// over the pop-up's top edge (the signature detail), then who invited you,
// the role, the inviter's note in a quote block, two or three lines of the
// listing (read once with the listing read) and its perks. Two buttons side by
// side: View the listing (outline) and Apply now (main), and under them, in
// the danger red, "Not interested".
//
// Opening it marks the invite opened (the parent, as the list did). Apply now
// runs the listing's own Apply: an outside listing opens its link in a new tab
// inside the click; a Gavelling listing queues the listing's Apply
// (requestJobApply) and opens the listing, which goes through sign-in first
// when signed out. Not interested answers talent_invite_respond and the parent
// removes the invite from the list. One pop-up: Escape and the scrim close it.

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import Portal from '@/components/Portal';
import { useAuth } from '@/components/AuthProvider';
import { openAuth } from '@/lib/authModal';
import { fetchJobListing, jobAppliesOutside, recordJobEvent, respondToInvite, type JobInvite, type JobListingDetail } from '@/lib/jobBoard';
import { JobLogo, OfferChips } from './JobCard';
import { Avatar, requestJobApply } from './JobListing';
import ProfileLink from '@/components/ProfileLink';

const FONT = "var(--font-brand), sans-serif";
const INK = '#1C1410';
const INK_SOFT = '#5C5140';
const FOREST = '#1B3828';
const DANGER = '#9E2A12';

function firstName(name: string | null | undefined): string | null {
  const n = (name ?? '').trim();
  return n ? n.split(/\s+/)[0] : null;
}

export default function InvitePopup({ invite, onClose, onViewListing, onDeclined }: {
  invite: JobInvite;
  onClose: () => void;
  /** Opens the listing in place (the list's own select). */
  onViewListing: (id: string) => void;
  /** Not interested landed: the parent removes the invite from the list. */
  onDeclined: (inviteId: string) => void;
}) {
  const { user } = useAuth();
  const [detail, setDetail] = useState<JobListingDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const busyRef = useRef(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  // The listing, read once, for its description and its outside link.
  useEffect(() => {
    let cancelled = false;
    void fetchJobListing(invite.id).then((r) => {
      if (!cancelled && r.ok) setDetail(r.listing);
    });
    return () => { cancelled = true; };
  }, [invite.id]);

  // Escape closes; focus moves into the pop-up once and back to where it was.
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); closeRef.current(); } };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); before?.focus?.(); };
  }, []);

  const conf = invite.conference;
  const confName = conf.name || conf.short || 'the conference';
  const by = invite.invited_by?.trim() || null;
  const note = invite.message?.trim() || '';
  const outside = jobAppliesOutside(detail ?? invite);
  const about = (detail?.description ?? '').trim();

  const viewListing = () => { onClose(); onViewListing(invite.id); };

  const applyNow = () => {
    if (outside) {
      // Inside the click, before anything else, so the browser lets the tab open.
      const url = detail?.outside_url;
      if (!url) return;
      recordJobEvent(invite.id, 'click');
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    requestJobApply(invite.id);
    onClose();
    onViewListing(invite.id);
    if (!user) openAuth({ apply: true });
  };

  const decline = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setErr('');
    try {
      const r = await respondToInvite(invite.invite_id, 'not_interested');
      if (!r.ok) { setErr(r.message); return; }
      onDeclined(invite.invite_id);
      onClose();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return (
    <Portal>
      <div className="gv-inv-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <style>{CSS}</style>
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="gv-inv-title"
          tabIndex={-1}
          className="gv-inv-panel"
          style={{ fontFamily: FONT }}
        >
          <span className="gv-inv-logo">
            <JobLogo conf={conf} size={76} standalone={invite.standalone} />
          </span>
          <button type="button" className="gv-inv-x" onClick={onClose} aria-label="Close">
            <X size={20} strokeWidth={2.2} aria-hidden />
          </button>

          <div className="gv-inv-body">
            <p className="gv-inv-conf">
              {conf.short && conf.short !== confName ? <><b>{conf.short}</b> · {confName}</> : <b>{confName}</b>}
            </p>
            <h2 id="gv-inv-title" className="gv-inv-title">{firstName(by) ?? 'A conference'} invited you to apply</h2>
            <p className="gv-inv-role">{invite.title} at {confName}</p>
            {invite.committee && <p className="gv-inv-committee">{invite.committee}</p>}

            {note && (
              <figure className="gv-inv-quote">
                <blockquote>&ldquo;{note}&rdquo;</blockquote>
                {by && (
                  <figcaption>
                    <ProfileLink userId={invite.invited_by_id ?? null} name={by} style={{ display: 'inline-flex', borderRadius: 9999 }}>
                      <Avatar name={by} src={invite.invited_by_avatar ?? null} size={30} />
                    </ProfileLink>
                    <span>{by}</span>
                  </figcaption>
                )}
              </figure>
            )}

            {about && <p className="gv-inv-about" title={about}>{about}</p>}
            <OfferChips card={invite} size="sm" />

            <div className="gv-inv-btns">
              <button type="button" className="gv-inv-second" onClick={viewListing}>View the listing</button>
              <button
                type="button"
                className="gv-inv-main"
                onClick={applyNow}
                disabled={!invite.open || (outside && !detail?.outside_url)}
              >
                Apply now
              </button>
            </div>
            <div className="gv-inv-decline">
              <button type="button" onClick={() => { void decline(); }} disabled={busy} aria-busy={busy || undefined}>
                Not interested
              </button>
            </div>
            {err && <p role="alert" className="gv-inv-err">{err}</p>}
          </div>
        </div>
      </div>
    </Portal>
  );
}

const CSS = `
.gv-inv-scrim{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;padding:56px 16px 16px;background:rgba(28,20,16,0.45);overflow-y:auto}
.gv-inv-panel{position:relative;width:100%;max-width:520px;margin:auto 0;border-radius:24px;background:#FFFFFF;box-shadow:0 30px 80px -20px rgba(0,0,0,0.45);outline:none;color:${INK}}
.gv-inv-logo{position:absolute;top:-38px;left:50%;transform:translateX(-50%);display:inline-flex;border-radius:9999px;background:#FFFFFF;padding:4px;box-shadow:0 8px 22px -8px rgba(27,56,40,0.35)}
.gv-inv-x{position:absolute;top:12px;right:12px;width:40px;height:40px;border:none;border-radius:9999px;background:transparent;color:${INK_SOFT};cursor:pointer;display:inline-flex;align-items:center;justify-content:center}
.gv-inv-x:hover{background:rgba(28,20,16,0.06);color:${INK}}
.gv-inv-body{display:flex;flex-direction:column;gap:12px;padding:54px 28px 24px;text-align:center}
.gv-inv-conf{margin:0;font-size:13.5px;color:${INK_SOFT};overflow-wrap:anywhere}
.gv-inv-conf b{color:${INK};font-weight:800}
.gv-inv-title{margin:0;font-size:clamp(21px,2.6vw,26px);font-weight:800;letter-spacing:-0.02em;line-height:1.15;color:${INK};text-wrap:balance;overflow-wrap:anywhere}
.gv-inv-role{margin:-4px 0 0;font-size:15.5px;font-weight:600;color:${INK};overflow-wrap:anywhere}
.gv-inv-committee{margin:-8px 0 0;font-size:14px;color:${FOREST};font-weight:600;overflow-wrap:anywhere}
.gv-inv-quote{margin:4px 0 0;padding:14px 16px;border-radius:16px;background:rgba(238,217,138,0.28);text-align:left}
.gv-inv-quote blockquote{margin:0;font-size:15px;font-style:italic;line-height:1.55;color:${INK};white-space:pre-line;overflow-wrap:anywhere}
.gv-inv-quote figcaption{display:flex;align-items:center;gap:8px;margin-top:10px;font-size:13.5px;font-weight:700;color:${INK};overflow-wrap:anywhere}
.gv-inv-about{margin:0;font-size:14.5px;line-height:1.55;color:#2E271F;text-align:left;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.gv-inv-body>ul.flex-wrap{justify-content:center}
.gv-inv-btns{display:flex;gap:10px;margin-top:6px}
.gv-inv-btns>button{flex:1 1 0;min-height:50px;border-radius:11px;font-family:${FONT};font-size:15.5px;font-weight:700;cursor:pointer}
.gv-inv-second{border:1.5px solid ${INK};background:#FFFFFF;color:${INK}}
.gv-inv-second:hover{background:#F7F4EE}
.gv-inv-main{border:none;color:#FFFFFF;background:linear-gradient(90deg,#1B3828 0%,#2A5A3C 55%,#1E4A31 100%);box-shadow:0 6px 16px rgba(27,56,40,0.22)}
.gv-inv-main:disabled{opacity:0.6;cursor:default}
.gv-inv-decline{display:flex;justify-content:center}
.gv-inv-decline button{min-height:40px;padding:0 8px;border:none;background:none;cursor:pointer;font-family:${FONT};font-size:14.5px;font-weight:700;color:${DANGER};text-decoration:underline;text-underline-offset:3px}
.gv-inv-decline button:disabled{opacity:0.6;cursor:default}
.gv-inv-err{margin:0;font-size:13.5px;color:${DANGER}}
.gv-inv-panel :is(button):focus{outline:none}
.gv-inv-panel :is(button):focus-visible{outline:2px solid ${FOREST};outline-offset:2px}
@media (max-width:480px){.gv-inv-body{padding:50px 20px 20px}.gv-inv-btns{flex-direction:column}}
`;
