'use client';

// "Add a room": a 6-character session code, then "Which delegations are yours?" with an
// optional first name for each. Also edits a room already on the board, and removes it.
// Names stay on this device (store.ts). Nothing here writes to the server.

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Check, Loader2, Megaphone, Search, Trash2 } from 'lucide-react';
import { CircleFlag } from '@/components/CircleFlag';
import { useLanguage, useT } from '@/contexts/LanguageContext';
import { getCountryDisplayName, compareCountryNames } from '@/lib/countries';
import { getCommitteeDisplayName } from '@/lib/presetNames';
import { friendlyError } from '@/lib/friendlyError';
import { lookupRoom, type RoomPreview } from '@/lib/advisorBoard/data';
import { normaliseCode, removeRoom, saveRoom, type BoardFollow, type BoardRoom } from '@/lib/advisorBoard/store';
import BottomSheet from './BottomSheet';
import { C, FONT } from './tokens';

type Lookup =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'not_found' }
  | { status: 'error'; message: string }
  | { status: 'ok'; room: RoomPreview };

const lc = (s: string) => s.trim().toLowerCase();

export default function AddRoomSheet({
  onClose,
  initialCode,
  editing,
  onSaved,
}: {
  onClose: () => void;
  initialCode?: string | null;
  editing?: BoardRoom | null;
  onSaved: (code: string) => void;
}) {
  const t = useT();
  const { language } = useLanguage();
  const [code, setCode] = useState(() => normaliseCode(editing?.code ?? initialCode ?? ''));
  const [lookup, setLookup] = useState<Lookup>({ status: 'idle' });
  const [picks, setPicks] = useState<Map<string, BoardFollow>>(
    () => new Map((editing?.follows ?? []).map((f) => [lc(f.country), { ...f }])),
  );
  const [query, setQuery] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(false);
  const seq = useRef(0);

  const runLookup = async (raw: string) => {
    const c = normaliseCode(raw);
    if (c.length !== 6) return;
    const my = ++seq.current;
    setLookup({ status: 'loading' });
    const res = await lookupRoom(c);
    if (my !== seq.current) return;
    if (res.status === 'ok') setLookup({ status: 'ok', room: res.room });
    else if (res.status === 'not_found') setLookup({ status: 'not_found' });
    else setLookup({ status: 'error', message: friendlyError(res.error, t('adv_add_error')) });
  };

  // A prefilled code (?add=CODE, or editing a room) looks the room up straight away.
  const initialRef = useRef(code);
  useEffect(() => {
    const c = initialRef.current;
    if (c.length !== 6) return;
    const tm = window.setTimeout(() => { void runLookup(c); }, 0);
    return () => window.clearTimeout(tm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const room = lookup.status === 'ok' ? lookup.room : null;
  const delegates = useMemo(() => {
    if (!room) return [];
    return [...room.delegates].sort((a, b) => (a.isObserver === b.isObserver ? compareCountryNames(a.country, b.country, language) : a.isObserver ? 1 : -1));
  }, [room, language]);
  const q = lc(query);
  const shown = q
    ? delegates.filter((d) => lc(d.country).includes(q) || lc(getCountryDisplayName(d.country, language)).includes(q))
    : delegates;
  // A delegation followed before but no longer on the roster stays listed, so it can be dropped.
  const orphans = [...picks.values()].filter((p) => room && !room.delegates.some((d) => lc(d.country) === lc(p.country)));

  const toggle = (country: string) => {
    setPicks((prev) => {
      const next = new Map(prev);
      const k = lc(country);
      if (next.has(k)) next.delete(k); else next.set(k, { country });
      return next;
    });
  };
  const setName = (country: string, name: string) => {
    setPicks((prev) => {
      const next = new Map(prev);
      const k = lc(country);
      const cur = next.get(k);
      if (cur) next.set(k, { country: cur.country, ...(name ? { name } : {}) });
      return next;
    });
  };

  const save = () => {
    if (!room) return;
    const follows = [...picks.values()].map((f) => ({ country: f.country, ...(f.name?.trim() ? { name: f.name.trim().slice(0, 40) } : {}) }));
    saveRoom(room.code, follows);
    onSaved(room.code);
  };

  const title = editing ? t('adv_edit_title') : room ? t('adv_pick_title') : t('adv_add_title');
  const pickedCount = picks.size;

  const footer = room ? (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={save}
        className="adv-focus flex h-12 w-full items-center justify-center gap-2 rounded-2xl transition-transform active:scale-[0.98]"
        style={{ backgroundColor: C.forest, color: C.gold, fontSize: 16, fontWeight: 800 }}
      >
        <Check size={18} strokeWidth={2.6} aria-hidden />
        {pickedCount === 0 ? t('adv_save_room_only') : t('adv_save_follow', { n: pickedCount })}
      </button>
      {editing && (confirmRemove ? (
        <div className="flex items-center gap-2 rounded-2xl px-3 py-2" style={{ backgroundColor: C.dangerTint }} role="group" aria-label={t('adv_remove_confirm')}>
          <span className="min-w-0 flex-1" style={{ fontSize: 14, fontWeight: 600, color: C.danger }}>{t('adv_remove_confirm')}</span>
          <button type="button" onClick={() => setConfirmRemove(false)} className="adv-focus h-10 rounded-xl px-3" style={{ fontSize: 14, fontWeight: 700, color: C.inkSoft }}>{t('adv_keep')}</button>
          <button type="button" onClick={() => { removeRoom(editing.code); onSaved(''); }} className="adv-focus h-10 rounded-xl px-3" style={{ fontSize: 14, fontWeight: 800, color: '#fff', backgroundColor: C.danger }}>{t('adv_remove')}</button>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirmRemove(true)} className="adv-focus flex h-11 items-center justify-center gap-2 rounded-2xl" style={{ fontSize: 14, fontWeight: 700, color: C.danger }}>
          <Trash2 size={16} aria-hidden /> {t('adv_remove_room')}
        </button>
      ))}
    </div>
  ) : null;

  return (
    <BottomSheet open onClose={onClose} title={title} closeLabel={t('adv_close')} footer={footer} initialFocus={room ? undefined : '#adv-code'}>
      <div style={{ fontFamily: FONT }}>
        {!editing && (
          <form
            onSubmit={(e) => { e.preventDefault(); void runLookup(code); }}
            className="mb-4"
          >
            <label htmlFor="adv-code" className="mb-1.5 block" style={{ fontSize: 14, fontWeight: 600, color: C.inkSoft }}>
              {t('adv_code_label')}
            </label>
            <div className="flex gap-2">
              <input
                id="adv-code"
                value={code}
                onChange={(e) => {
                  const v = normaliseCode(e.target.value);
                  setCode(v);
                  if (v.length === 6) void runLookup(v);
                  else { seq.current++; setLookup({ status: 'idle' }); }
                }}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                inputMode="text"
                maxLength={8}
                placeholder="ABC123"
                className="adv-input h-14 min-w-0 flex-1 rounded-2xl px-4"
                style={{ fontSize: 24, fontWeight: 800, letterSpacing: '0.18em', color: C.forest, backgroundColor: '#fff', fontFamily: FONT }}
              />
              <button
                type="submit"
                disabled={code.length !== 6 || lookup.status === 'loading'}
                aria-label={t('adv_find_room')}
                title={t('adv_find_room')}
                className="adv-focus flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl disabled:opacity-40"
                style={{ backgroundColor: C.forest, color: C.gold }}
              >
                {lookup.status === 'loading' ? <Loader2 size={20} className="animate-spin" aria-hidden /> : <ArrowRight size={20} className="rtl:rotate-180" aria-hidden />}
              </button>
            </div>
            <p aria-live="polite" className="mt-2 min-h-[20px]" style={{ fontSize: 13.5, fontWeight: 600, color: lookup.status === 'not_found' || lookup.status === 'error' ? C.danger : C.inkSoft }}>
              {lookup.status === 'not_found' ? t('adv_code_not_found')
                : lookup.status === 'error' ? lookup.message
                : lookup.status === 'idle' ? t('adv_code_hint') : ''}
            </p>
          </form>
        )}

        {editing && lookup.status !== 'ok' && (
          <p aria-live="polite" className="mb-3" style={{ fontSize: 14, fontWeight: 600, color: lookup.status === 'error' || lookup.status === 'not_found' ? C.danger : C.inkSoft }}>
            {lookup.status === 'not_found' ? t('adv_room_gone') : lookup.status === 'error' ? lookup.message : t('adv_loading')}
          </p>
        )}
        {editing && lookup.status === 'not_found' && (
          <button type="button" onClick={() => { removeRoom(editing.code); onSaved(''); }} className="adv-focus flex h-11 items-center gap-2 rounded-2xl px-4" style={{ fontSize: 14, fontWeight: 800, color: '#fff', backgroundColor: C.danger }}>
            <Trash2 size={16} aria-hidden /> {t('adv_remove_room')}
          </button>
        )}

        {room && (
          <>
            <div className="mb-3 rounded-2xl px-4 py-3" style={{ backgroundColor: C.surface }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: C.ink }}>{getCommitteeDisplayName(room.name, language) || room.code}</div>
              {room.topic && room.topic !== 'TBD' && <div className="mt-0.5" style={{ fontSize: 13.5, fontWeight: 500, color: C.inkSoft }}>{room.topic}</div>}
              <div className="mt-1" style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', color: C.forestSoft }}>{room.code}</div>
            </div>
            <p className="mb-2" style={{ fontSize: 14, fontWeight: 600, color: C.inkSoft }}>{t('adv_pick_hint')}</p>
            {delegates.length > 10 && (
              <div className="relative mb-2">
                <Search size={16} aria-hidden className="pointer-events-none absolute top-1/2 -translate-y-1/2" style={{ insetInlineStart: 14, color: C.inkSoft }} />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('adv_search_delegations')}
                  aria-label={t('adv_search_delegations')}
                  className="adv-input h-12 w-full rounded-2xl pe-3"
                  style={{ fontSize: 16, paddingInlineStart: 40, backgroundColor: '#fff', color: C.ink, fontFamily: FONT }}
                />
              </div>
            )}
            {delegates.length === 0 && (
              <p style={{ fontSize: 14, color: C.inkSoft }}>{t('adv_no_delegations')}</p>
            )}
            <ul className="flex flex-col gap-1.5">
              {orphans.map((p) => (
                <PickRow key={`o-${p.country}`} country={p.country} logoUrl={null} observer={false} picked name={p.name ?? ''}
                  note={t('adv_state_not_on_roster')} onToggle={() => toggle(p.country)} onName={(v) => setName(p.country, v)} />
              ))}
              {shown.map((d) => {
                const pick = picks.get(lc(d.country));
                return (
                  <PickRow key={d.id} country={d.country} logoUrl={d.logoUrl} observer={d.isObserver} picked={!!pick} name={pick?.name ?? ''}
                    note={null} onToggle={() => toggle(d.country)} onName={(v) => setName(d.country, v)} />
                );
              })}
            </ul>
            <p className="mt-3" style={{ fontSize: 12.5, fontWeight: 500, color: C.inkSoft }}>{t('adv_names_private')}</p>
          </>
        )}
      </div>
    </BottomSheet>
  );
}

function PickRow({
  country, logoUrl, observer, picked, name, note, onToggle, onName,
}: {
  country: string; logoUrl: string | null; observer: boolean; picked: boolean; name: string; note: string | null;
  onToggle: () => void; onName: (v: string) => void;
}) {
  const t = useT();
  const { language } = useLanguage();
  const display = getCountryDisplayName(country, language);
  return (
    <li className="rounded-2xl" style={{ backgroundColor: picked ? '#fff' : 'transparent', boxShadow: picked ? `inset 0 0 0 1.5px ${C.forest}` : `inset 0 0 0 1px ${C.hairline}` }}>
      <button
        type="button"
        role="checkbox"
        aria-checked={picked}
        onClick={onToggle}
        className="adv-focus flex min-h-[56px] w-full items-center gap-3 rounded-2xl px-3 text-start"
      >
        <CircleFlag country={country} logoUrl={logoUrl} size={36} decorative />
        <span className="min-w-0 flex-1">
          <span className="block truncate" style={{ fontSize: 15.5, fontWeight: 700, color: C.ink }}>{display}</span>
          {(observer || note) && (
            <span className="flex items-center gap-1" style={{ fontSize: 12.5, fontWeight: 600, color: C.inkSoft }}>
              {observer && <><Megaphone size={12} aria-hidden /> {t('adv_observer')}</>}
              {note}
            </span>
          )}
        </span>
        <span aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: picked ? C.forest : 'transparent', boxShadow: picked ? 'none' : 'inset 0 0 0 2px rgba(27,56,40,0.28)', color: C.gold }}>
          {picked && <Check size={16} strokeWidth={3} />}
        </span>
      </button>
      {picked && (
        <div className="px-3 pb-3">
          <input
            value={name}
            onChange={(e) => onName(e.target.value.slice(0, 40))}
            placeholder={t('adv_first_name_placeholder')}
            aria-label={t('adv_first_name_for', { country: display })}
            autoComplete="off"
            className="adv-input h-11 w-full rounded-xl px-3"
            style={{ fontSize: 16, backgroundColor: C.cream, color: C.ink, fontFamily: FONT }}
          />
        </div>
      )}
    </li>
  );
}
