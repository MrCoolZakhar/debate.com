'use client';
// Gavelling Crisis: the organiser's entry point, a small button on a crisis committee's card in
// Manage > Committees. Already on: a link to the crisis. Not yet: a pop-up with the two packages
// ("Basic crisis", "Full package", no prices) and "Switch on". The second step replaces the
// pop-up's content, it never opens another pop-up. Self-contained: it brings its own styles.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, ShieldAlert, X } from 'lucide-react';
import Portal from '@/components/Portal';
import { notifyErr } from '@/lib/appNotify';
import { crisisError, crisisForCommittee, enableCrisis } from '@/lib/crisis/api';

type Pkg = 'basic' | 'full';

const PACKAGES: Array<{ id: Pkg; title: string; line: string }> = [
  { id: 'basic', title: 'Basic crisis', line: 'Directives, the backroom, news and characters.' },
  { id: 'full', title: 'Full package', line: 'Everything in Basic, plus the war map and resources.' },
];

const FOREST = '#1B3828';
const FONT = 'var(--font-brand), sans-serif';

export default function CrisisEnableButton({ conferenceSlug, conferenceCommitteeId, committeeName, layout = 'row' }: {
  conferenceSlug: string; conferenceCommitteeId: string; committeeName: string; layout?: 'row' | 'tile';
}) {
  // undefined: still looking. null: not switched on. Otherwise the crisis slug.
  const [slug, setSlug] = useState<string | null | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [pkg, setPkg] = useState<Pkg>('basic');
  const [busy, setBusy] = useState(false);
  const [made, setMade] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    crisisForCommittee(conferenceCommitteeId)
      .then((r) => { if (!cancelled) setSlug(r ? r.slug : null); })
      .catch(() => { if (!cancelled) setSlug(null); });
    return () => { cancelled = true; };
  }, [conferenceCommitteeId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, busy]);

  const buttonStyle = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: layout === 'tile' ? 40 : 32,
    padding: '0 14px', borderRadius: layout === 'tile' ? 12 : 9999, border: '1.5px solid rgba(27,56,40,0.35)',
    background: 'transparent', color: FOREST, fontFamily: FONT, fontSize: 12, fontWeight: 800, cursor: 'pointer', textDecoration: 'none',
    whiteSpace: 'nowrap' as const, width: layout === 'tile' ? '100%' : undefined,
  };
  const wrap = (node: React.ReactNode) => (layout === 'tile' ? <div className="px-3.5 pt-3">{node}</div> : node);

  if (slug === undefined) return null;

  if (slug && !open) {
    return wrap(
      <Link href={`/crisis/${conferenceSlug}/${slug}`} style={buttonStyle} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]/40">
        <ShieldAlert size={14} strokeWidth={1.5} aria-hidden />
        Open Gavelling Crisis
      </Link>,
    );
  }

  const close = () => { if (!busy) { setOpen(false); setMade(null); } };

  const switchOn = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await enableCrisis(conferenceCommitteeId, pkg);
      setSlug(r.slug);
      setMade(r.slug);
    } catch (e) {
      notifyErr(crisisError(e, 'Could not switch on Gavelling Crisis.'), 'crisis-enable');
    } finally { setBusy(false); }
  };

  return (
    <>
      {wrap(
        <button type="button" onClick={() => setOpen(true)} style={buttonStyle} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]/40">
          <ShieldAlert size={14} strokeWidth={1.5} aria-hidden />
          Gavelling Crisis
        </button>,
      )}
      {open && (
        <Portal>
          <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'grid', placeItems: 'center', padding: 16, fontFamily: FONT }}>
            <div aria-hidden onMouseDown={close} style={{ position: 'absolute', inset: 0, background: 'rgba(28,20,16,0.45)' }} />
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Gavelling Crisis"
              style={{
                position: 'relative', width: 'min(560px, 100%)', maxHeight: '100%', overflowY: 'auto', background: '#FFFFFF', borderRadius: 24, padding: 22,
                boxShadow: '0 24px 60px rgba(27,56,40,0.28), 0 0 0 1px rgba(27,56,40,0.08)',
              }}
            >
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]/40"
                style={{ position: 'absolute', top: 14, right: 14, width: 32, height: 32, borderRadius: 10, border: 0, background: 'transparent', color: FOREST, cursor: 'pointer' }}
              >
                <X size={18} strokeWidth={1.5} style={{ margin: 'auto' }} />
              </button>

              {made ? (
                <div style={{ textAlign: 'center', padding: '8px 4px 2px' }}>
                  <span style={{ display: 'inline-grid', placeItems: 'center', width: 52, height: 52, borderRadius: '50%', background: 'rgba(61,122,82,0.14)', color: '#2F6644' }}>
                    <Check size={26} strokeWidth={1.5} aria-hidden />
                  </span>
                  <h2 style={{ margin: '12px 0 4px', fontSize: 20, fontWeight: 800, color: '#1C1410' }}>Gavelling Crisis Is On</h2>
                  <p style={{ margin: '0 0 16px', fontSize: 14.5, color: '#4E463C', overflowWrap: 'anywhere' }}>
                    {committeeName} is ready. The Crisis Director sets up characters, staff and settings there.
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    <Link
                      href={`/crisis/${conferenceSlug}/${made}`}
                      style={{ ...buttonStyle, width: undefined, background: FOREST, color: '#FFFFFF', border: 0, minHeight: 44, padding: '0 20px', borderRadius: 12, fontSize: 14 }}
                    >
                      Open Gavelling Crisis
                    </Link>
                    <button type="button" onClick={close} style={{ ...buttonStyle, width: undefined, minHeight: 44, padding: '0 20px', borderRadius: 12, fontSize: 14 }}>Close</button>
                  </div>
                </div>
              ) : (
                <>
                  <h2 style={{ margin: '0 36px 4px 0', fontSize: 20, fontWeight: 800, color: '#1C1410' }}>Switch On Gavelling Crisis</h2>
                  <p style={{ margin: '0 0 16px', fontSize: 14, color: '#4E463C', overflowWrap: 'anywhere' }}>Pick what {committeeName} needs.</p>
                  <div role="radiogroup" aria-label="Package" style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                    {PACKAGES.map((p) => {
                      const on = pkg === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          onClick={() => setPkg(p.id)}
                          className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]/40"
                          style={{
                            textAlign: 'left', padding: 14, borderRadius: 18, border: 0, cursor: 'pointer', fontFamily: FONT, background: on ? 'rgba(27,56,40,0.06)' : '#FFFFFF',
                            boxShadow: on ? `inset 0 0 0 2px ${FOREST}` : 'inset 0 0 0 1.5px rgba(27,56,40,0.18)',
                          }}
                        >
                          <span className="flex items-center justify-between gap-2">
                            <b style={{ fontSize: 15.5, fontWeight: 800, color: '#1C1410' }}>{p.title}</b>
                            <span aria-hidden style={{ width: 20, height: 20, borderRadius: '50%', display: 'grid', placeItems: 'center', background: on ? FOREST : 'transparent', boxShadow: on ? 'none' : 'inset 0 0 0 1.5px rgba(27,56,40,0.3)', color: '#fff' }}>
                              {on && <Check size={13} strokeWidth={2} />}
                            </span>
                          </span>
                          <span style={{ display: 'block', marginTop: 6, fontSize: 13.5, lineHeight: 1.45, color: '#4E463C' }}>{p.line}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex flex-wrap justify-end gap-2" style={{ marginTop: 18 }}>
                    <button type="button" onClick={close} disabled={busy} style={{ ...buttonStyle, width: undefined, minHeight: 44, padding: '0 20px', borderRadius: 12, fontSize: 14 }}>Cancel</button>
                    <button
                      type="button"
                      onClick={switchOn}
                      disabled={busy}
                      style={{ ...buttonStyle, width: undefined, background: FOREST, color: '#FFFFFF', border: 0, minHeight: 44, padding: '0 22px', borderRadius: 12, fontSize: 14, opacity: busy ? 0.6 : 1 }}
                    >
                      {busy ? 'Switching on' : 'Switch on'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </Portal>
      )}
    </>
  );
}
