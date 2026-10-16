'use client';

/**
 * Things to Do (prompt 130, 16 Oct 2026): the top of the Documents page's
 * right column. Everything waiting for an organizer's decision, oldest first,
 * from documents_todo(p_conference_id):
 *   - position papers 'submitted' that no organizer has cleared yet;
 *   - copies sent back for an extra document (only while docs_extra is on).
 *
 * A row opens the review pop-up, laid out like the payment proof review: the
 * details and the actions on the LEFT, the file on the RIGHT. A position paper
 * is accepted, rejected (an optional note, saved as chair_feedback and sent to
 * the delegate as a reviewer message, exactly as a chair's feedback is) or
 * left to the chairs (organizer_review_position_paper 'chair'); a returned
 * copy is accepted or rejected (review_document_return, the note optional).
 * Every decision is a verified write; after one the pop-up moves on to the
 * next item waiting, or closes with "All caught up".
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bell, CheckCircle2 } from 'lucide-react';
import { Emoji3D } from '@/components/neu';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { friendlyError, plainOrFallback } from '@/lib/friendlyError';
import { notifyOk } from '@/lib/appNotify';
import { reviewDocumentReturn } from '@/lib/conferenceDocuments';
import { signedPositionPaperUrl } from '@/lib/positionPapers';
import { PurchaseShell, PURCHASE_CSS } from '@/components/purchase/purchaseKit';
import PdfViewer, { type PdfZoom } from '@/components/documents/PdfViewer';
import { InfoHint } from '../settings/applicationsUi';
import { STORE_CSS } from '../store/storeKit';
import { DASH_CSS, DashCard, TINT_GOLD, INK, INK_SOFT, FOREST, DANGER } from '../financials/dashboardKit';
import { CD_CSS, EXTRA_CSS } from './docsTabKit';
import ReturnFileViewer from './ReturnFileViewer';

const FONT = "var(--font-brand), sans-serif";
const NOTE_MAX = 2000;

export interface TodoPaper {
  kind: 'position_paper';
  id: string; submitted_at: string | null; file_url: string | null; file_name: string | null;
  committee_id: string; committee: string | null; committee_name: string | null;
  country_code: string | null; allocation: string | null; delegate_name: string | null;
  application_id: string | null; delegation: string | null; deadline: string | null;
}
export interface TodoReturn {
  kind: 'document_return';
  id: string; submitted_at: string | null; document_id: string; document: string | null;
  file_path: string | null; file_name: string | null; mime_type: string | null;
  delegate_name: string | null; role: string | null; application_id: string | null; delegation: string | null;
}
export type TodoItem = TodoPaper | TodoReturn;

/** documents_todo, oldest first; returns left out unless docs_extra is on. null on a failed read. */
export async function readDocumentsTodo(conferenceId: string, withReturns: boolean): Promise<TodoItem[] | null> {
  try {
    const c = await getFreshAuthedClient();
    if (!c) return null;
    const { data, error } = await c.rpc('documents_todo', { p_conference_id: conferenceId });
    if (error || !data) return null;
    const d = data as { ok?: boolean; papers?: TodoPaper[]; returns?: TodoReturn[] };
    if (!d.ok) return null;
    const papers = (d.papers ?? []).map(p => ({ ...p, kind: 'position_paper' as const }));
    const returns = withReturns ? (d.returns ?? []).map(r => ({ ...r, kind: 'document_return' as const })) : [];
    return [...papers, ...returns].sort((a, b) => (a.submitted_at ?? '').localeCompare(b.submitted_at ?? ''));
  } catch {
    return null;
  }
}

function itemLabel(t: TodoItem): string {
  const who = t.delegate_name || 'Someone';
  return t.kind === 'position_paper' ? `${who}, ${t.committee ?? 'committee'} position paper` : `${who}, ${t.document ?? 'document'}`;
}

function ago(iso: string | null, now: number): string {
  if (!iso) return '';
  const mins = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h} ${h === 1 ? 'hour' : 'hours'} ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d} ${d === 1 ? 'day' : 'days'} ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/** The card: a title with the count and the rows, scrolling inside itself. */
export default function DocumentsTodo({ conferenceId, extraOn, version, onReviewed }: {
  conferenceId: string;
  /** docs_extra on for the conference: returned copies are listed too. */
  extraOn: boolean;
  /** Bumped by the page after anything that may change the list. */
  version: number;
  /** A decision landed (the page refreshes what depends on it). */
  onReviewed?: () => void;
}) {
  const [items, setItems] = useState<TodoItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [eventTick, setEventTick] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  const reload = useCallback(async () => {
    const res = await readDocumentsTodo(conferenceId, extraOn);
    if (res === null) { setFailed(true); return null; }
    setFailed(false);
    setItems(res);
    setNow(Date.now());
    return res;
  }, [conferenceId, extraOn]);

  useEffect(() => { void Promise.resolve().then(() => reload()); }, [reload, version, eventTick]);

  // A copy reviewed anywhere else on the page (the returns pop-up) refreshes the list.
  useEffect(() => {
    const on = () => setEventTick(t => t + 1);
    window.addEventListener('gv-documents-returns-changed', on);
    return () => window.removeEventListener('gv-documents-returns-changed', on);
  }, []);

  const count = items?.length ?? 0;

  return (
    <>
      <style>{TODO_CSS}</style>
      <DashCard
        title="Things to Do"
        hint="Position papers and returned documents waiting for your decision. They leave this list once you accept, reject or pass them to the chairs"
        icon={{ emoji: 'Bell', lucide: Bell, tint: TINT_GOLD }}
        hang="start"
        className={`gv-docs-dash gv-todo-card${count > 0 ? ' gv-fd-todo' : ''}`}
      >
        {items === null && !failed && <div className="gv-fd-ph" style={{ height: 64, marginTop: 8 }} aria-hidden />}
        {items === null && failed && <p className="gv-todo-empty">Things to do could not be read. They will show when the page reloads.</p>}
        {items && items.length === 0 && (
          <div className="gv-fd-clear">
            <span className="gv-fd-clear-disc" aria-hidden>
              <Emoji3D name="Check mark button" size={30} fallback={CheckCircle2} fallbackColor="#1B3828" />
            </span>
            <span className="gv-fd-clear-text">You&apos;re all caught up</span>
          </div>
        )}
        {items && items.length > 0 && (
          <>
            <div>
              <span className="gv-fd-todo-num">{count}</span>
              <span className="gv-fd-todo-word">{count === 1 ? 'thing to do' : 'things to do'}</span>
            </div>
            <ul className="gv-todo-list">
              {items.map(t => (
                <li key={`${t.kind}:${t.id}`}>
                  <button type="button" className="gv-todo-row" onClick={() => setOpenId(`${t.kind}:${t.id}`)}>
                    <span className="gv-todo-dot" data-kind={t.kind} aria-hidden />
                    <span className="gv-todo-label">{itemLabel(t)}</span>
                    <span className="gv-todo-when">{ago(t.submitted_at, now)}</span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="gv-fd-foot">
              <button type="button" className="gv-st-btn gv-st-forest" onClick={() => setOpenId(keyOf(items[0]))}>Review now</button>
            </div>
          </>
        )}
      </DashCard>

      {openId && items && (
        <ReviewPopup
          items={items}
          startKey={openId}
          reload={reload}
          onReviewed={onReviewed}
          onClose={() => { setOpenId(null); void reload(); }}
        />
      )}
    </>
  );
}

const keyOf = (t: TodoItem) => `${t.kind}:${t.id}`;

// ── The review pop-up ───────────────────────────────────────────────────────

function ReviewPopup({ items: initialItems, startKey, reload, onReviewed, onClose }: {
  items: TodoItem[];
  startKey: string;
  reload: () => Promise<TodoItem[] | null>;
  onReviewed?: () => void;
  onClose: () => void;
}) {
  const [items, setItems] = useState(initialItems);
  const [currentKey, setCurrentKey] = useState(startKey);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const busyRef = useRef(false);

  const current = items.find(t => keyOf(t) === currentKey) ?? null;

  async function decide(action: 'accept' | 'reject' | 'chair') {
    if (!current || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setErr('');
    const cleanNote = note.trim();
    let error: string | null = null;
    try {
      if (current.kind === 'position_paper') {
        const c = await getFreshAuthedClient();
        if (!c) throw new Error('signed out');
        const { data, error: rpcErr } = await c.rpc('organizer_review_position_paper', {
          p_paper_id: current.id, p_action: action, p_note: action === 'reject' && cleanNote ? cleanNote : null,
        });
        const d = data as { ok?: boolean; error?: string } | null;
        if (rpcErr) error = friendlyError(rpcErr, 'Your decision could not be saved. Try again in a moment.');
        else if (!d?.ok) error = plainOrFallback(d?.error ?? '', 'Your decision could not be saved. Try again in a moment.');
        else if (action === 'reject' && cleanNote) {
          // The same notification a chair's feedback sends: a reviewer message
          // in the paper's thread, which the delegate sees on their paper.
          const { data: auth } = await c.auth.getUser();
          if (auth.user) {
            await c.from('position_paper_messages').insert({
              paper_id: current.id, sender_user_id: auth.user.id, is_reviewer: true, is_system: false, body: cleanNote,
            });
          }
        }
      } else {
        const res = await reviewDocumentReturn(current.id, action === 'accept', action === 'reject' && cleanNote ? cleanNote : null);
        if (!res.ok) error = res.error;
        else window.dispatchEvent(new Event('gv-documents-returns-changed'));
      }
    } catch (e) {
      error = friendlyError(e, 'Your decision could not be saved. Try again in a moment.');
    }
    busyRef.current = false;
    setBusy(false);
    if (error) { setErr(error); return; }

    notifyOk(action === 'accept' ? 'Accepted' : action === 'reject' ? 'Rejected' : 'Left for the chairs', 'documents-todo');
    onReviewed?.();
    setRejecting(false);
    setNote('');
    // On to the next item waiting, in list order after this one.
    const order = items.map(keyOf);
    const doneIx = order.indexOf(currentKey);
    const fresh = await reload();
    const left = (fresh ?? items.filter(t => keyOf(t) !== currentKey));
    if (left.length === 0) {
      notifyOk('All caught up', 'documents-todo');
      onClose();
      return;
    }
    setItems(left);
    const next = left.find(t => order.indexOf(keyOf(t)) > doneIx) ?? left[0];
    setCurrentKey(keyOf(next));
  }

  if (!current) return null;

  const isPaper = current.kind === 'position_paper';
  const independent = 'Independent Delegate';
  const facts: [string, string][] = isPaper
    ? [
        ['Delegate Name', current.delegate_name ?? 'Someone'],
        ['Delegation', current.delegation ?? independent],
        ['Committee', [current.committee, current.committee_name && current.committee_name !== current.committee ? current.committee_name : null].filter(Boolean).join(', ') || 'Committee'],
        ['Allocation', current.allocation ?? current.country_code ?? 'Not set'],
      ]
    : [
        ['Name', current.delegate_name ?? 'Someone'],
        ['Delegation', current.delegation ?? independent],
        ['Document', current.document ?? 'Document'],
      ];
  const position = items.findIndex(t => keyOf(t) === currentKey) + 1;

  return (
    <>
      <style>{PURCHASE_CSS}</style>
      <style>{STORE_CSS}</style>
      <style>{DASH_CSS}</style>
      <style>{CD_CSS}</style>
      <style>{EXTRA_CSS}</style>
      <style>{TODO_CSS}</style>
      <PurchaseShell tone="light" label={itemLabel(current)} onClose={() => { if (!busyRef.current) onClose(); }} panelClass="gv-cd-rev" testId="documents-todo-review">
        <div className="gv-st gv-todo-rev">
          <div className="gv-todo-rev-left">
            <p className="gv-todo-pos">{position} of {items.length} waiting</p>
            <h2 className="gv-fd-pop-title" style={{ marginTop: 4 }}>{isPaper ? 'Position Paper' : 'Returned Copy'}</h2>
            <dl className="gv-todo-facts">
              {facts.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>

            {rejecting ? (
              <div className="gv-cd-field" style={{ marginTop: 6 }}>
                <label className="gv-fd-label" htmlFor="gv-todo-note">Note for the delegate (optional)</label>
                <textarea id="gv-todo-note" className="gv-cd-area" style={{ minHeight: 90 }} value={note} maxLength={NOTE_MAX} disabled={busy} onChange={e => { setNote(e.target.value); setErr(''); }} autoFocus />
                <div className="gv-cd-count-line"><span /><span>{note.length} / {NOTE_MAX}</span></div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" className="gv-st-btn gv-todo-danger" disabled={busy} onClick={() => { void decide('reject'); }}>{busy ? 'Saving' : 'Reject'}</button>
                  <button type="button" className="gv-st-btn gv-st-outline" disabled={busy} onClick={() => { setRejecting(false); setNote(''); setErr(''); }}>Cancel</button>
                </div>
              </div>
            ) : (
              <div className="gv-todo-actions">
                <span className="gv-todo-act">
                  <button type="button" className="gv-st-btn gv-st-forest" disabled={busy} onClick={() => { void decide('accept'); }}>{busy ? 'Saving' : 'Accept'}</button>
                  <InfoHint label="What Accept does" text={isPaper ? 'Marks it as approved. The delegate sees it approved and it leaves your list' : 'Marks their copy as accepted'} />
                </span>
                <span className="gv-todo-act">
                  <button type="button" className="gv-st-btn gv-st-outline" disabled={busy} onClick={() => { setRejecting(true); setErr(''); }}>Reject</button>
                  <InfoHint label="What Reject does" text="Sends it back to the delegate, with your note if you add one. They can upload a new version, which comes back here" />
                </span>
                {isPaper && (
                  <span className="gv-todo-act">
                    <button type="button" className="gv-st-btn gv-st-outline" disabled={busy} onClick={() => { void decide('chair'); }}>Let Chair Review</button>
                    <InfoHint label="What Let Chair Review does" text="Leaves the decision to the committee's chairs. It stays in their review list and leaves yours" />
                  </span>
                )}
              </div>
            )}
            {err && <p className="gv-st-err" role="alert" style={{ margin: '10px 0 0' }}>{err}</p>}
          </div>

          <div className="gv-todo-rev-file">
            {isPaper
              ? <PaperFile key={current.id} url={current.file_url} name={current.file_name} />
              : current.file_path
                ? <ReturnFileViewer key={current.file_path} path={current.file_path} fileName={current.file_name} mime={current.mime_type} size={null} />
                : <NoFile />}
          </div>
        </div>
      </PurchaseShell>
    </>
  );
}

function NoFile() {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 28, color: INK_SOFT, fontFamily: FONT }}>
      There is no file to show.
    </div>
  );
}

/** The paper itself, through a short signed URL (the bucket is private). */
function PaperFile({ url, name }: { url: string | null; name: string | null }) {
  const [signed, setSigned] = useState<string | null>(null);
  const [zoom, setZoom] = useState<PdfZoom>('fit');
  useEffect(() => {
    if (!url) return;
    let alive = true;
    void (async () => {
      const c = await getFreshAuthedClient();
      const s = c ? await signedPositionPaperUrl(c, url, 600) : url;
      if (alive) setSigned(s);
    })();
    return () => { alive = false; };
  }, [url]);
  const isImage = useMemo(() => /\.(jpe?g|png)$/i.test(name ?? url ?? ''), [name, url]);
  if (!url) return <NoFile />;
  if (!signed) return <div className="gv-fd-ph" style={{ flex: 1, margin: 16, minHeight: 240 }} aria-busy="true" />;
  if (isImage) {
    return (
      <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: '#F6F3EC' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={signed} alt={name ?? 'Position paper'} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
      </div>
    );
  }
  return <PdfViewer url={signed} title={name ?? 'Position paper'} fileName={name ?? undefined} zoom={zoom} onZoomChange={setZoom} compact className="relative flex-1 min-h-0" />;
}

const TODO_CSS = `
.gv-todo-list{list-style:none;flex:1 1 auto;min-height:0;overflow-y:auto;margin:12px -6px 0;padding:0 6px;display:flex;flex-direction:column;gap:6px}
.gv-todo-row{width:100%;display:flex;align-items:center;gap:10px;padding:11px 12px;border:none;border-radius:12px;background:#FAF8F3;box-shadow:inset 0 0 0 1px rgba(27,56,40,0.07);cursor:pointer;text-align:left;font-family:${FONT}}
.gv-todo-row:hover{background:#F3EEE2}
.gv-todo-row:focus{outline:none}
.gv-todo-row:focus-visible{outline:2px solid ${FOREST};outline-offset:2px}
.gv-todo-dot{width:9px;height:9px;border-radius:999px;flex-shrink:0;background:#C9A23A}
.gv-todo-dot[data-kind="document_return"]{background:#3D7A52}
.gv-todo-label{flex:1;min-width:0;font-size:14.5px;font-weight:700;color:${INK};overflow-wrap:anywhere}
.gv-todo-when{flex-shrink:0;font-size:12.5px;color:${INK_SOFT};font-variant-numeric:tabular-nums}
.gv-todo-empty{margin:4px 0;font-family:${FONT};font-size:14.5px;color:${INK_SOFT}}
.gv-todo-ph{height:44px;border-radius:12px;background:#F0EBDD;margin-bottom:6px}
.gv-todo-rev{display:grid;grid-template-columns:minmax(260px,340px) minmax(0,1fr);width:100%;height:100%;min-height:0}
.gv-todo-rev-left{padding:26px 24px;overflow-y:auto;border-right:1px solid rgba(27,56,40,0.10);display:flex;flex-direction:column;gap:10px}
.gv-todo-rev-file{min-height:0;display:flex;flex-direction:column;background:#FFFFFF}
.gv-todo-pos{margin:0;font-family:${FONT};font-size:13px;font-weight:700;color:${INK_SOFT};font-variant-numeric:tabular-nums}
.gv-todo-facts{margin:6px 0 4px;display:flex;flex-direction:column;gap:10px}
.gv-todo-facts dt{font-family:${FONT};font-size:12.5px;font-weight:700;color:${INK_SOFT}}
.gv-todo-facts dd{margin:2px 0 0;font-family:${FONT};font-size:15.5px;font-weight:700;color:${INK};overflow-wrap:anywhere}
.gv-todo-actions{display:flex;flex-direction:column;gap:8px;margin-top:8px}
.gv-todo-act{display:flex;align-items:center;gap:8px}
.gv-todo-act .gv-st-btn{flex:1}
.gv-todo-danger{background:${DANGER}!important;color:#FFFFFF!important;border:none}
@media (max-width:760px){
  .gv-todo-rev{grid-template-columns:1fr;grid-template-rows:auto minmax(320px,1fr);overflow-y:auto}
  .gv-todo-rev-left{border-right:none;border-bottom:1px solid rgba(27,56,40,0.10)}
}
`;

