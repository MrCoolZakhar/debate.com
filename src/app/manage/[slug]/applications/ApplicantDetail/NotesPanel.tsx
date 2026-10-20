'use client';

// ── Private notes on an applicant (Job Board prompt 9) ─────────────────────
//
// Owner, 20 Oct 2026: organizers review applications together, so every
// applicant gets a thread of notes for the team. They are private to the
// conference's organizers and never shown or sent to the applicant. They are
// NOT applications.organizer_note (the "Note sent to them" on a rejection).
//
// Used by the applicant pop-up's Notes tab and by Settings > Team's review
// pop-up. RPCs: application_notes_list (oldest first), application_note_add,
// application_note_edit and application_note_remove (only the author edits or
// removes). Every change is optimistic, rolled back on a failure with the
// server's sentence under the box, and the list is read again after it.

import { useCallback, useEffect, useRef, useState } from 'react';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { friendlyError, UserFacingError } from '@/lib/friendlyError';

const FONT = "var(--font-brand), sans-serif";
const INK = '#1C1410';
const INK_SOFT = '#5E5145';
const FOREST = '#1B3828';
const DANGER = '#8B2020';
const MAX = 4000;

export interface ApplicantNote {
  id: string;
  body: string;
  created_at: string;
  updated_at: string | null;
  edited: boolean;
  author_id: string | null;
  author_name: string | null;
  author_avatar: string | null;
  mine: boolean;
}

async function client() {
  const c = await getFreshAuthedClient();
  if (!c) throw new UserFacingError('Your session has expired. Please sign in again.');
  return c;
}

async function listNotes(applicationId: string): Promise<ApplicantNote[]> {
  const c = await client();
  const { data, error } = await c.rpc('application_notes_list', { p_application: applicationId });
  if (error) throw error;
  return Array.isArray(data) ? (data as ApplicantNote[]) : [];
}

function when(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const day = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(d.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}) });
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return `${day}, ${time}`;
}

export default function NotesPanel({ applicationId, onCount }: {
  applicationId: string;
  /** The number of notes, whenever it is known (the tab count). */
  onCount?: (n: number) => void;
}) {
  const [notes, setNotes] = useState<ApplicantNote[] | null>(null);
  const [loadErr, setLoadErr] = useState('');
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [asking, setAsking] = useState<string | null>(null);
  const busyRef = useRef(false);
  const countRef = useRef(onCount);
  useEffect(() => { countRef.current = onCount; }, [onCount]);

  const show = useCallback((list: ApplicantNote[]) => {
    setNotes(list);
    countRef.current?.(list.length);
  }, []);

  const reload = useCallback(async () => {
    try {
      show(await listNotes(applicationId));
      setLoadErr('');
    } catch (e) {
      setLoadErr(friendlyError(e, 'Could not load the notes. Please try again.'));
    }
  }, [applicationId, show]);

  useEffect(() => {
    let cancelled = false;
    void listNotes(applicationId).then(
      (list) => { if (!cancelled) { show(list); setLoadErr(''); } },
      (e) => { if (!cancelled) setLoadErr(friendlyError(e, 'Could not load the notes. Please try again.')); },
    );
    return () => { cancelled = true; };
  }, [applicationId, show]);

  /** Runs one change: optimistic first, rolled back with the server's sentence on a failure, then a fresh read. */
  async function run(optimistic: (list: ApplicantNote[]) => ApplicantNote[], write: () => Promise<void>, fallback: string): Promise<boolean> {
    if (busyRef.current || !notes) return false;
    busyRef.current = true;
    setBusy(true);
    setErr('');
    const before = notes;
    show(optimistic(notes));
    try {
      await write();
      await reload();
      return true;
    } catch (e) {
      show(before);
      setErr(friendlyError(e, fallback));
      return false;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  const add = async () => {
    const body = text.trim();
    if (!body) return;
    const temp: ApplicantNote = {
      id: `temp-${Date.now()}`, body, created_at: new Date().toISOString(), updated_at: null, edited: false,
      author_id: null, author_name: 'You', author_avatar: null, mine: true,
    };
    const ok = await run((l) => [...l, temp], async () => {
      const c = await client();
      const { data, error } = await c.rpc('application_note_add', { p_application: applicationId, p_body: body });
      if (error) throw error;
      if (!data) throw new UserFacingError('Could not add the note. Please try again.');
    }, 'Could not add the note. Please try again.');
    if (ok) setText('');
  };

  const saveEdit = async () => {
    if (!editing) return;
    const body = editing.text.trim();
    if (!body) return;
    const id = editing.id;
    const ok = await run((l) => l.map((n) => (n.id === id ? { ...n, body, edited: true } : n)), async () => {
      const c = await client();
      const { data, error } = await c.rpc('application_note_edit', { p_note: id, p_body: body });
      if (error) throw error;
      if (!data) throw new UserFacingError('Could not save the note. Please try again.');
    }, 'Could not save the note. Please try again.');
    if (ok) setEditing(null);
  };

  const remove = async (id: string) => {
    const ok = await run((l) => l.filter((n) => n.id !== id), async () => {
      const c = await client();
      const { data, error } = await c.rpc('application_note_remove', { p_note: id });
      if (error) throw error;
      if (!data) throw new UserFacingError('Could not remove the note. Please try again.');
    }, 'Could not remove the note. Please try again.');
    if (ok) setAsking(null);
  };

  return (
    <div style={{ fontFamily: FONT }}>
      <style>{CSS}</style>
      {notes === null && !loadErr && (
        <div aria-hidden style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
          <span className="gv-nt-bone" style={{ height: 54 }} />
          <span className="gv-nt-bone" style={{ height: 54, width: '80%' }} />
        </div>
      )}
      {loadErr && notes === null && (
        <p role="alert" style={{ margin: '0 0 12px', fontSize: 13.5, color: DANGER }}>
          {loadErr} <button type="button" className="gv-nt-link" onClick={() => { void reload(); }}>Try again</button>
        </p>
      )}

      {notes && notes.length > 0 && (
        <ol className="gv-nt-list">
          {notes.map((n) => {
            const isEditing = editing?.id === n.id;
            return (
              <li key={n.id} className="gv-nt-item">
                <Avatar name={n.author_name ?? 'Organizer'} src={n.author_avatar} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="gv-nt-head">
                    <span className="gv-nt-author">{n.mine ? (n.author_name ?? 'You') : (n.author_name ?? 'Organizer')}</span>
                    <span className="gv-nt-when">{when(n.created_at)}{n.edited ? ' · edited' : ''}</span>
                  </p>
                  {isEditing ? (
                    <div style={{ marginTop: 6 }}>
                      <textarea
                        className="gv-nt-box"
                        value={editing.text}
                        maxLength={MAX}
                        rows={3}
                        autoFocus
                        aria-label="Edit note"
                        onChange={(e) => setEditing({ id: n.id, text: e.target.value })}
                        onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void saveEdit(); } }}
                      />
                      <div className="gv-nt-row">
                        <button type="button" className="gv-nt-btn" onClick={() => { void saveEdit(); }} disabled={busy || !editing.text.trim()}>{busy ? 'Saving' : 'Save'}</button>
                        <button type="button" className="gv-nt-quiet" onClick={() => setEditing(null)} disabled={busy}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <p className="gv-nt-body">{n.body}</p>
                  )}
                  {n.mine && !isEditing && !n.id.startsWith('temp-') && (
                    asking === n.id ? (
                      <div className="gv-nt-row" role="group" aria-label="Remove this note?">
                        <span style={{ fontSize: 13, fontWeight: 600, color: INK }}>Remove this note?</span>
                        <button type="button" className="gv-nt-danger" onClick={() => { void remove(n.id); }} disabled={busy}>{busy ? 'Removing' : 'Remove'}</button>
                        <button type="button" className="gv-nt-quiet" onClick={() => setAsking(null)} disabled={busy}>Keep</button>
                      </div>
                    ) : (
                      <div className="gv-nt-row">
                        <button type="button" className="gv-nt-link" onClick={() => { setAsking(null); setEditing({ id: n.id, text: n.body }); }} disabled={busy}>Edit</button>
                        <button type="button" className="gv-nt-link" onClick={() => { setEditing(null); setAsking(n.id); }} disabled={busy}>Remove</button>
                      </div>
                    )
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {notes && (
        <div>
          <textarea
            className="gv-nt-box"
            value={text}
            maxLength={MAX}
            rows={3}
            placeholder="Add a note for your team"
            aria-label="Add a note for your team"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void add(); } }}
          />
          {err && <p role="alert" style={{ margin: '6px 0 0', fontSize: 13.5, lineHeight: 1.45, color: DANGER }}>{err}</p>}
          <div className="gv-nt-row" style={{ justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12.5, color: INK_SOFT }}>Only your conference&apos;s organizers can see notes.</span>
            <button type="button" className="gv-nt-btn" onClick={() => { void add(); }} disabled={busy || !text.trim()} aria-busy={busy || undefined}>
              {busy && !editing && !asking ? 'Adding' : 'Add note'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Avatar({ name, src }: { name: string; src: string | null }) {
  const [broken, setBroken] = useState(false);
  const initials = name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';
  return src && !broken ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" width={34} height={34} onError={() => setBroken(true)} style={{ width: 34, height: 34, borderRadius: 9999, objectFit: 'cover', flexShrink: 0 }} />
  ) : (
    <span aria-hidden style={{ width: 34, height: 34, borderRadius: 9999, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(238,217,138,0.55)', color: '#4A3410', fontSize: 12.5, fontWeight: 800 }}>
      {initials}
    </span>
  );
}

const CSS = `
.gv-nt-list{list-style:none;margin:0 0 14px;padding:0;display:flex;flex-direction:column;gap:10px}
.gv-nt-item{display:flex;gap:10px;align-items:flex-start;padding:12px 14px;border-radius:14px;background:#FFFFFF;box-shadow:0 1px 2px rgba(27,56,40,0.05),0 4px 12px rgba(27,56,40,0.06)}
.gv-nt-head{margin:0;display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 10px}
.gv-nt-author{font-size:13.5px;font-weight:700;color:${INK};overflow-wrap:anywhere}
.gv-nt-when{font-size:12px;color:${INK_SOFT};font-variant-numeric:tabular-nums}
.gv-nt-body{margin:4px 0 0;font-size:14.5px;line-height:1.55;color:${INK};white-space:pre-line;overflow-wrap:anywhere}
.gv-nt-box{width:100%;min-height:80px;padding:10px 12px;border-radius:12px;border:1.5px solid rgba(28,20,16,0.14);background:#FFFFFF;font-family:${FONT};font-size:14.5px;line-height:1.5;color:${INK};resize:vertical}
.gv-nt-box:focus{outline:none;border-color:${FOREST};box-shadow:inset 0 0 0 1px ${FOREST}}
.gv-nt-row{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;margin-top:8px}
.gv-nt-btn{min-height:38px;padding:0 16px;border:none;border-radius:10px;cursor:pointer;font-family:${FONT};font-size:13.5px;font-weight:700;color:#FFFFFF;background:linear-gradient(90deg,#1B3828 0%,#2A5A3C 100%)}
.gv-nt-btn:disabled{opacity:0.5;cursor:default}
.gv-nt-danger{min-height:34px;padding:0 14px;border:none;border-radius:10px;cursor:pointer;font-family:${FONT};font-size:13px;font-weight:700;color:#FFFFFF;background:${DANGER}}
.gv-nt-danger:disabled{opacity:0.6;cursor:default}
.gv-nt-quiet{min-height:34px;padding:0 12px;border-radius:10px;border:1.5px solid rgba(28,20,16,0.2);background:#FFFFFF;cursor:pointer;font-family:${FONT};font-size:13px;font-weight:700;color:${INK}}
.gv-nt-link{background:none;border:none;padding:0;cursor:pointer;font-family:${FONT};font-size:12.5px;font-weight:700;color:${INK_SOFT};text-decoration:underline;text-underline-offset:3px}
.gv-nt-link:hover{color:${FOREST}}
.gv-nt-link:disabled,.gv-nt-quiet:disabled{opacity:0.5;cursor:default}
.gv-nt-btn:focus,.gv-nt-danger:focus,.gv-nt-quiet:focus,.gv-nt-link:focus{outline:none}
.gv-nt-btn:focus-visible,.gv-nt-danger:focus-visible,.gv-nt-quiet:focus-visible,.gv-nt-link:focus-visible{outline:2px solid ${FOREST};outline-offset:2px}
.gv-nt-bone{display:block;border-radius:12px;background:linear-gradient(90deg,#EFEAE0 0%,#F7F4EE 50%,#EFEAE0 100%);background-size:200% 100%;animation:gvNtBone 1.3s ease-in-out infinite}
@keyframes gvNtBone{from{background-position:100% 0}to{background-position:-100% 0}}
@media (prefers-reduced-motion:reduce){.gv-nt-bone{animation:none}}
`;
