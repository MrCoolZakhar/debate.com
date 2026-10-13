'use client';

// DocumentReturnsPopup.tsx — "Returned copies" of one document (prompt 111).
// Reads document_returns_overview, lists the people the document is for with
// where their copy stands, shows the chosen copy (ReturnFileViewer), and lets
// the organiser Accept it or Send it back with a note, then moves on to the
// next copy waiting. Every review fires 'gv-documents-returns-changed'.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Circle, Clock, CornerUpLeft, PartyPopper } from 'lucide-react';
import { PurchaseShell, PURCHASE_CSS } from '@/components/purchase/purchaseKit';
import { notifyOk } from '@/lib/appNotify';
import {
  fetchDocumentReturns, reviewDocumentReturn, type DocumentReturns, type ReturnPerson, type ReturnState,
} from '@/lib/conferenceDocuments';
import { STORE_CSS } from '../store/storeKit';
import { DASH_CSS, IconDisc, TINT_GREEN, INK, INK_SOFT, FOREST, DANGER } from '../financials/dashboardKit';
import { CD_CSS, EXTRA_CSS, RETURN_STATE_WORDS, ROLE_CHOICES } from './docsTabKit';
import ReturnFileViewer from './ReturnFileViewer';

const NOTE_MAX = 500;
type Filter = 'all' | 'submitted' | 'accepted' | 'sent_back' | 'not_yet';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'submitted', label: 'Waiting for review' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'sent_back', label: 'Sent back' },
  { key: 'not_yet', label: 'Not yet' },
];

const STATE_LOOK: Record<ReturnState, { color: string; Icon: typeof Circle }> = {
  submitted: { color: '#8A6410', Icon: Clock },
  accepted: { color: FOREST, Icon: CheckCircle2 },
  sent_back: { color: DANGER, Icon: CornerUpLeft },
  not_yet: { color: INK_SOFT, Icon: Circle },
};

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return ''; }
}
function roleWord(p: ReturnPerson): string {
  if (p.is_head_delegate && p.role === 'delegate') return 'Head delegate';
  const r = ROLE_CHOICES.find(x => x.key === p.role)?.label ?? p.role;
  return r.endsWith('s') ? r.slice(0, -1) : r;
}
function personKey(p: ReturnPerson) { return p.application_id; }

type Load = { kind: 'loading' } | { kind: 'error'; error: string } | { kind: 'ok'; data: DocumentReturns };

export default function DocumentReturnsPopup({ documentId, title, onClose }: {
  documentId: string; title: string; onClose: () => void;
}) {
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [filter, setFilter] = useState<Filter | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [sendBack, setSendBack] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const busyRef = useRef(false);

  const reload = useCallback(async () => {
    const res = await fetchDocumentReturns(documentId);
    if (!res.ok) { setLoad(prev => prev.kind === 'ok' ? prev : { kind: 'error', error: res.error }); return null; }
    setLoad({ kind: 'ok', data: res });
    return res;
  }, [documentId]);

  useEffect(() => { void Promise.resolve().then(() => reload()); }, [reload]);

  const data = load.kind === 'ok' ? load.data : null;
  const people = useMemo(() => data?.people ?? [], [data]);
  // Waiting for review is the default view whenever someone is waiting.
  const activeFilter: Filter = filter ?? ((data?.counts.to_review ?? 0) > 0 ? 'submitted' : 'all');
  const shown = useMemo(() => people.filter(p => activeFilter === 'all' || p.state === activeFilter), [people, activeFilter]);
  const counts = data?.counts;
  const countFor = (f: Filter) => !counts ? 0 : f === 'all' ? people.length : f === 'submitted' ? counts.to_review : f === 'accepted' ? counts.accepted : f === 'sent_back' ? counts.sent_back : counts.not_yet;

  const current = (selected && people.find(p => personKey(p) === selected)) || shown[0] || null;
  const allReviewed = !!data && data.counts.to_review === 0 && activeFilter === 'submitted';

  function choose(id: string) { setSelected(id); setSendBack(false); setNote(''); setErr(''); }

  async function review(accept: boolean) {
    if (!current?.return_id || busyRef.current) return;
    if (!accept && !note.trim()) { setErr('Write what they should fix.'); return; }
    busyRef.current = true; setBusy(true); setErr('');
    const doneId = personKey(current);
    const res = await reviewDocumentReturn(current.return_id, accept, accept ? null : note.trim());
    busyRef.current = false; setBusy(false);
    if (!res.ok) { setErr(res.error); return; }
    window.dispatchEvent(new Event('gv-documents-returns-changed'));
    notifyOk(accept ? 'Copy accepted' : 'Sent back with your note', 'conference-docs');
    setSendBack(false); setNote('');
    const fresh = await reload();
    // On to the next person waiting, in list order after this one.
    const waiting = (fresh?.people ?? []).filter(p => p.state === 'submitted');
    const order = (fresh?.people ?? []).map(personKey);
    const after = waiting.find(p => order.indexOf(personKey(p)) > order.indexOf(doneId)) ?? waiting[0] ?? null;
    setSelected(after ? personKey(after) : doneId);
  }

  return (
    <>
      <style>{PURCHASE_CSS}</style>
      <style>{STORE_CSS}</style>
      <style>{DASH_CSS}</style>
      <style>{CD_CSS}</style>
      <style>{EXTRA_CSS}</style>
      <PurchaseShell tone="light" label={`Returned copies of ${title}`} onClose={() => { if (!busyRef.current) onClose(); }} panelClass="gv-cd-rev" testId="document-returns-popup">
        <div className="gv-st" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%', width: '100%' }}>
          <div style={{ padding: '26px 28px 12px' }}>
            <h2 className="gv-fd-pop-title">Returned Copies</h2>
            <p style={{ margin: '6px 0 0', fontSize: 15, fontWeight: 700, color: INK, overflowWrap: 'anywhere' }}>{title}</p>
            {counts && (
              <p style={{ margin: '8px 0 0', fontSize: 14, color: INK_SOFT, fontVariantNumeric: 'tabular-nums' }}>
                <b style={{ color: INK }}>{counts.returned}</b> of {counts.audience} returned · <b style={{ color: '#8A6410' }}>{counts.to_review}</b> to review · {counts.sent_back} sent back · {counts.not_yet} not yet
              </p>
            )}
            {data && (
              <div className="gv-cd-tabs" role="tablist" aria-label="Show" style={{ marginTop: 12 }}>
                {FILTERS.map(f => (
                  <button key={f.key} type="button" role="tab" aria-selected={activeFilter === f.key} className="gv-cd-tab" onClick={() => { setFilter(f.key); setSelected(null); setSendBack(false); setErr(''); }}>
                    {f.label} <b>{countFor(f.key)}</b>
                  </button>
                ))}
              </div>
            )}
          </div>

          {load.kind === 'loading' && <div className="gv-fd-ph" style={{ margin: '0 28px 28px', flex: 1 }} aria-busy="true" />}
          {load.kind === 'error' && (
            <div style={{ padding: '0 28px 28px' }}>
              <p className="gv-st-err" role="alert">{load.error}</p>
              <button type="button" className="gv-st-btn gv-st-outline" onClick={() => { setLoad({ kind: 'loading' }); void reload(); }}>Try again</button>
            </div>
          )}

          {data && (
            <div className="gv-cd-rev-grid">
              <div className="gv-cd-rev-list">
                {shown.length === 0 && (
                  allReviewed ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '28px 10px', textAlign: 'center' }}>
                      <IconDisc icon={{ emoji: 'Party popper', lucide: PartyPopper, tint: TINT_GREEN }} size={60} />
                      <p style={{ margin: 0, fontSize: 17, fontWeight: 800, color: INK }}>All copies reviewed</p>
                    </div>
                  ) : <p style={{ padding: '20px 10px', fontSize: 14.5, color: INK_SOFT }}>Nobody here.</p>
                )}
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {shown.map(p => {
                    const look = STATE_LOOK[p.state];
                    return (
                      <li key={personKey(p)}>
                        <button type="button" className="gv-cd-person" aria-current={current && personKey(current) === personKey(p)} onClick={() => choose(personKey(p))}>
                          <span className="gv-cd-person-name">{p.name ?? p.email ?? 'Someone'}</span>
                          <span className="gv-cd-person-sub">{[roleWord(p), p.delegation].filter(Boolean).join(' · ')}</span>
                          <span className="gv-cd-state" style={{ color: look.color }}>
                            <look.Icon size={15} strokeWidth={2.4} aria-hidden />{RETURN_STATE_WORDS[p.state]}
                          </span>
                          {!p.joined && <span className="gv-cd-person-sub">Not joined Gavelling yet</span>}
                          {!p.in_audience && <span className="gv-cd-person-sub">No longer in this audience</span>}
                          {p.replaced_count > 0 && <span className="gv-cd-person-sub">Replaced {p.replaced_count} {p.replaced_count === 1 ? 'time' : 'times'}</span>}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="gv-cd-rev-side">
                {!current ? null : !current.file_path ? (
                  <div style={{ padding: 28 }}>
                    <p style={{ margin: 0, fontSize: 17, fontWeight: 800, color: INK, overflowWrap: 'anywhere' }}>{current.name ?? current.email ?? 'Someone'}</p>
                    <p style={{ margin: '6px 0 0', fontSize: 14.5, color: INK_SOFT }}>{current.joined ? 'Has not sent a copy yet.' : 'Not joined Gavelling yet, so they have not seen it.'}</p>
                  </div>
                ) : (
                  <>
                    <ReturnFileViewer key={current.file_path} path={current.file_path} fileName={current.file_name} mime={current.mime_type} size={current.file_size_bytes} />
                    <div style={{ borderTop: '1px solid rgba(27,56,40,0.12)', padding: '14px 20px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <p style={{ margin: 0, fontSize: 15.5, fontWeight: 800, color: INK, overflowWrap: 'anywhere' }}>
                        {current.name ?? current.email ?? 'Someone'}
                        {current.submitted_at && <span style={{ fontWeight: 500, color: INK_SOFT, fontSize: 13.5 }}> · sent {fmtDate(current.submitted_at)}</span>}
                      </p>
                      {current.state === 'accepted' && <p style={{ margin: 0, fontSize: 14, color: FOREST, fontWeight: 700 }}>Accepted on {fmtDate(current.reviewed_at)}</p>}
                      {current.state === 'sent_back' && (
                        <div style={{ fontSize: 14, color: INK }}>
                          <p style={{ margin: 0, color: DANGER, fontWeight: 700 }}>Sent back on {fmtDate(current.reviewed_at)}</p>
                          {current.review_note && <p style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{current.review_note}</p>}
                        </div>
                      )}
                      {current.state === 'submitted' && (sendBack ? (
                        <div className="gv-cd-field">
                          <label className="gv-fd-label" htmlFor="gv-cdx-note">What should they fix? They read this</label>
                          <textarea id="gv-cdx-note" className="gv-cd-area" style={{ minHeight: 70 }} value={note} maxLength={NOTE_MAX} disabled={busy} onChange={e => { setNote(e.target.value); setErr(''); }} autoFocus />
                          <div className="gv-cd-count-line"><span /><span>{note.length} / {NOTE_MAX}</span></div>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button type="button" className="gv-st-btn gv-st-forest" disabled={busy || !note.trim()} onClick={() => review(false)}>{busy ? 'Sending' : 'Send back'}</button>
                            <button type="button" className="gv-st-btn gv-st-outline" disabled={busy} onClick={() => { setSendBack(false); setNote(''); setErr(''); }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button type="button" className="gv-st-btn gv-st-forest" disabled={busy} onClick={() => review(true)}>{busy ? 'Saving' : 'Accept'}</button>
                          <button type="button" className="gv-st-btn gv-st-outline" disabled={busy} onClick={() => { setSendBack(true); setErr(''); }}>Send back</button>
                        </div>
                      ))}
                      {err && <p className="gv-st-err" role="alert" style={{ margin: 0 }}>{err}</p>}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </PurchaseShell>
    </>
  );
}
