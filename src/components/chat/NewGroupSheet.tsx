'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronLeft, Search } from 'lucide-react';
import { NEU, OUTFIT } from '@/components/neu';
import { GROUP_NAME_MAX } from '@/lib/chatConversations';
import { ChatAvatar } from './ChatAvatar';
import { CHAT, type TFn } from './chatTokens';

export interface GroupCandidate {
  /** The participant's identity: a country name or a chair name. */
  key: string;
  label: string;
  /** Conference sessions, chair devices only: who is in the seat. */
  sublabel?: string;
  isChair: boolean;
}

/**
 * "New group": a name and a member picker, drawn as a layer over the chat itself (it fills
 * the panel, so no ancestor can clip it). Candidates follow the DM rules: a chair can add
 * delegations and the other chairs, a delegation can add other delegations.
 *
 * `mode="edit"` is the same sheet for an existing group: the name comes prefilled, the
 * candidates are the caller's minus the current members, and Save is on as soon as the name
 * changed or someone is picked. Members can only be added.
 */
export default function NewGroupSheet({
  candidates,
  onCancel,
  onCreate,
  busy,
  error,
  mode = 'create',
  initialName = '',
  currentName,
  initialPicked = [],
  t,
}: {
  candidates: GroupCandidate[];
  onCancel: () => void;
  onCreate: (name: string, members: string[]) => void;
  busy: boolean;
  error: boolean;
  mode?: 'create' | 'edit';
  /** Edit: the group's current name. */
  initialName?: string;
  /** Edit: the name stored now, when the field starts from something else (a refused rename). */
  currentName?: string;
  /** Edit: a failed save's picks, so nothing chosen is lost. */
  initialPicked?: string[];
  t: TFn;
}) {
  const editing = mode === 'edit';
  const [name, setName] = useState(initialName);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<string[]>(() => initialPicked.filter((k) => candidates.some((c) => c.key === k)));
  const nameRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => { nameRef.current?.focus({ preventScroll: true }); }, []);

  // Escape backs out of the sheet only (the dialog underneath stays open).
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      onCancel();
    };
    el.addEventListener('keydown', onKey);
    return () => el.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const q = query.trim().toLowerCase();
  const visible = useMemo(
    () => (q ? candidates.filter((c) => c.label.toLowerCase().includes(q) || c.key.toLowerCase().includes(q) || (c.sublabel ?? '').toLowerCase().includes(q)) : candidates),
    [candidates, q],
  );
  const toggle = (key: string) => setPicked((p) => (p.includes(key) ? p.filter((k) => k !== key) : [...p, key]));
  const nameChanged = name.trim().slice(0, GROUP_NAME_MAX) !== (currentName ?? initialName).trim();
  const canCreate = name.trim().length > 0 && !busy && (editing ? (nameChanged || picked.length > 0) : picked.length > 0);
  const submit = () => { if (canCreate) onCreate(name.trim().slice(0, GROUP_NAME_MAX), picked); };

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label={t(editing ? 'chat_group_edit' : 'chat_new_group')}
      className="chat-sheet-in absolute inset-0 z-30 flex flex-col"
      style={{ backgroundColor: 'var(--gv-surface, #FAF8F3)' }}
    >
      <style>{'@keyframes chatSheetIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}.chat-sheet-in{animation:chatSheetIn 200ms cubic-bezier(0.2,0,0,1)}@media (prefers-reduced-motion: reduce){.chat-sheet-in{animation:none}}'}</style>
      <div className="shrink-0 flex items-center gap-2 px-3" style={{ height: 60, background: CHAT.bar, boxShadow: CHAT.barShadow }}>
        <button
          type="button"
          onClick={onCancel}
          aria-label={t('chat_group_cancel')}
          className="shrink-0 inline-flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] hover:bg-[rgba(27,56,40,0.07)] active:scale-[0.96]"
          style={{ width: 40, height: 40, borderRadius: 999, border: 'none', background: 'transparent', color: NEU.forest, cursor: 'pointer' }}
        >
          <ChevronLeft size={26} strokeWidth={2.4} aria-hidden className="rtl:-scale-x-100" />
        </button>
        <h3 className="flex-1 min-w-0 truncate" style={{ fontFamily: OUTFIT, fontSize: 17, fontWeight: 750, color: NEU.ink }}>{t(editing ? 'chat_group_edit' : 'chat_new_group')}</h3>
        <button
          type="button"
          onClick={submit}
          disabled={!canCreate}
          className="shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] enabled:active:scale-[0.96]"
          style={{
            height: 38, padding: '0 16px', borderRadius: 999, border: 'none',
            background: canCreate ? `linear-gradient(135deg, ${NEU.forest}, ${NEU.green})` : 'rgba(28,20,16,0.08)',
            color: canCreate ? NEU.gold : 'rgba(28,20,16,0.4)',
            fontFamily: OUTFIT, fontSize: 14, fontWeight: 700, cursor: canCreate ? 'pointer' : 'default',
            transitionProperty: 'background-color, color, transform', transitionDuration: '150ms',
          }}
        >
          {t(editing ? 'chat_group_save' : 'chat_group_create')}
        </button>
      </div>

      <div className="shrink-0 px-4 pt-3 pb-2 w-full max-w-[640px] mx-auto">
        <label className="block">
          <span style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 700, color: NEU.inkSoft }}>{t('chat_group_name')}</span>
          <input
            ref={nameRef}
            value={name}
            maxLength={GROUP_NAME_MAX}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
            placeholder={t('chat_group_name_placeholder')}
            className="mt-1 w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F]"
            style={{
              height: 46, padding: '0 14px', borderRadius: 14, border: 'none',
              backgroundColor: '#FFFDF8', boxShadow: 'inset 0 0 0 1px rgba(28,20,16,0.10)',
              fontFamily: OUTFIT, fontSize: 16, color: NEU.ink,
            }}
          />
        </label>
        <div className="mt-3 flex items-center justify-between gap-2">
          <span style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 700, color: NEU.inkSoft }}>{t('chat_group_members')}</span>
          <span style={{ fontFamily: OUTFIT, fontSize: 12.5, color: NEU.inkSoft, fontVariantNumeric: 'tabular-nums' }}>
            {picked.length > 0 ? t('chat_group_selected', { n: picked.length }) : t(editing ? 'chat_group_edit_hint' : 'chat_group_hint')}
          </span>
        </div>
        <label className="mt-1.5 flex items-center gap-2 px-3" style={{ height: 38, borderRadius: 12, backgroundColor: 'rgba(28,20,16,0.06)' }}>
          <Search size={16} strokeWidth={2.2} aria-hidden style={{ color: NEU.inkSoft, flexShrink: 0 }} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('chat_search')}
            aria-label={t('chat_search')}
            className="flex-1 min-w-0 bg-transparent focus:outline-none"
            style={{ fontFamily: OUTFIT, fontSize: 16, color: NEU.ink, border: 'none' }}
          />
        </label>
        {error && (
          <p role="alert" className="mt-2" style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 600, color: CHAT.danger }}>{t(editing ? 'chat_group_edit_failed' : 'chat_group_failed')}</p>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-3" style={{ overscrollBehavior: 'contain' }}>
        <div className="w-full max-w-[640px] mx-auto">
        {visible.length === 0 && (
          <p className="px-3 py-6 text-center" style={{ fontFamily: OUTFIT, fontSize: 14, color: NEU.inkSoft }}>{t(editing && candidates.length === 0 ? 'chat_group_all_in' : 'chat_no_results')}</p>
        )}
        {visible.map((c) => {
          const on = picked.includes(c.key);
          return (
            <button
              key={c.key}
              type="button"
              role="checkbox"
              aria-checked={on}
              onClick={() => toggle(c.key)}
              className="w-full flex items-center gap-3 text-start focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#B6871F] hover:bg-[rgba(27,56,40,0.05)]"
              style={{ padding: '7px 10px', borderRadius: 14, border: 'none', background: on ? CHAT.rowActive : 'transparent', cursor: 'pointer', transitionProperty: 'background-color', transitionDuration: '120ms' }}
            >
              <ChatAvatar kind={c.isChair ? 'chair' : 'delegate'} name={c.key} size={40} />
              <span className="flex-1 min-w-0">
                <span className="block truncate" style={{ fontFamily: OUTFIT, fontSize: 15.5, fontWeight: 600, color: NEU.ink }}>
                  {c.label}{c.isChair ? ` ${t('chat_chair_badge')}` : ''}
                </span>
                {c.sublabel && (
                  <span className="block truncate" style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 500, color: NEU.inkSoft }}>
                    {c.sublabel}
                  </span>
                )}
              </span>
              <span
                aria-hidden
                className="shrink-0 inline-flex items-center justify-center"
                style={{
                  width: 24, height: 24, borderRadius: 999,
                  background: on ? `linear-gradient(135deg, ${NEU.forest}, ${NEU.green})` : 'transparent',
                  boxShadow: on ? 'none' : 'inset 0 0 0 1.5px rgba(28,20,16,0.25)',
                  color: NEU.gold,
                  transitionProperty: 'background-color, box-shadow', transitionDuration: '120ms',
                }}
              >
                {on && <Check size={15} strokeWidth={3} />}
              </span>
            </button>
          );
        })}
        </div>
      </div>
    </div>
  );
}
