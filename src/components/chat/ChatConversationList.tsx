'use client';

import { memo, useMemo, useState } from 'react';
import { Plus, Search, X } from 'lucide-react';
import { NEU, OUTFIT } from '@/components/neu';
import type { ChatConvKey, ChatEntryKind } from '@/lib/chatConversations';
import type { ChatMessage } from '@/lib/types';
import { ChatAvatar } from './ChatAvatar';
import { CHAT, previewContent, formatListTime, type TFn } from './chatTokens';

export interface ConvRow {
  key: ChatConvKey;
  kind: ChatEntryKind;
  label: string;
  /** Lower-case text the search matches against (label plus the raw key). */
  search: string;
  last: ChatMessage | null;
  /** Display name of the last message's sender, when it is not the reader. */
  lastSenderLabel: string;
  lastAt: number | null;
  unread: number;
  /** Second line for a conversation with no messages (a group's size, the dais). */
  idleLine: string;
}

const iconBtn: React.CSSProperties = {
  width: 40, height: 40, borderRadius: 999, border: 'none', cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  transitionProperty: 'background-color, transform', transitionDuration: '150ms',
};

/**
 * The left pane: every conversation the reader can have. Everyone is pinned; threads with
 * activity follow, newest first; silent ones sit under "Start a conversation". There is no
 * "new message" step: tapping any row opens its thread. `+` starts a group.
 */
function ChatConversationList({
  rows,
  activeKey,
  onSelect,
  onNewGroup,
  onClose,
  canCreateGroup,
  showTitle = true,
  t,
  locale,
}: {
  rows: ConvRow[];
  /** '' when no row should read as selected (a phone showing the list). */
  activeKey: ChatConvKey;
  onSelect: (key: ChatConvKey) => void;
  onNewGroup: () => void;
  onClose?: () => void;
  canCreateGroup: boolean;
  showTitle?: boolean;
  t: TFn;
  locale: string;
}) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const visible = useMemo(() => (q ? rows.filter((r) => r.search.includes(q)) : rows), [rows, q]);
  const firstSilent = q ? -1 : visible.findIndex((r) => r.lastAt == null && r.kind !== 'everyone');

  return (
    <div className="flex flex-col h-full min-h-0 w-full">
      {/* Header */}
      <div className="shrink-0 px-4 pt-3.5 pb-2.5" style={{ background: CHAT.bar, boxShadow: CHAT.barShadow }}>
        <div className="flex items-center gap-1" style={{ minHeight: 40 }}>
          <h2 className={`flex-1 min-w-0 truncate ${showTitle ? '' : 'sr-only'}`} style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 22, color: NEU.ink, letterSpacing: '-0.01em' }}>
            {t('tab_chat')}
          </h2>
          {!showTitle && <span className="flex-1" />}
          {canCreateGroup && (
            <button
              type="button"
              onClick={onNewGroup}
              aria-label={t('chat_new_group')}
              title={t('chat_new_group')}
              className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] active:scale-[0.96]"
              style={{ ...iconBtn, background: `linear-gradient(135deg, ${NEU.forest}, ${NEU.green})`, color: NEU.gold, width: 36, height: 36, margin: 2 }}
            >
              <Plus size={20} strokeWidth={2.6} aria-hidden />
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label={t('chat_close')}
              title={t('chat_close')}
              className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] hover:bg-[rgba(27,56,40,0.07)] active:scale-[0.96]"
              style={{ ...iconBtn, background: 'transparent', color: NEU.inkSoft }}
            >
              <X size={20} strokeWidth={2.2} aria-hidden />
            </button>
          )}
        </div>
        <label className="mt-2 flex items-center gap-2 px-3" style={{ height: 38, borderRadius: 12, backgroundColor: 'rgba(28,20,16,0.06)' }}>
          <Search size={16} strokeWidth={2.2} aria-hidden style={{ color: NEU.inkSoft, flexShrink: 0 }} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('chat_search')}
            aria-label={t('chat_search_label')}
            className="flex-1 min-w-0 bg-transparent focus:outline-none"
            style={{ fontFamily: OUTFIT, fontSize: 16, color: NEU.ink, border: 'none' }}
          />
        </label>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto min-h-0 px-2 py-1.5" style={{ overscrollBehavior: 'contain' }}>
        {visible.length === 0 && (
          <p className="px-3 py-8 text-center" style={{ fontFamily: OUTFIT, fontSize: 14, color: NEU.inkSoft }}>{t('chat_no_results')}</p>
        )}
        {visible.map((row, i) => (
          <div key={row.key}>
            {i === firstSilent && (
              <p className="px-3 pt-3 pb-1" style={{ fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: NEU.inkSoft }}>
                {t('chat_section_start')}
              </p>
            )}
            <Row row={row} active={row.key === activeKey} onSelect={onSelect} t={t} locale={locale} />
          </div>
        ))}
      </div>
    </div>
  );
}

const Row = memo(function Row({ row, active, onSelect, t, locale }: {
  row: ConvRow; active: boolean; onSelect: (key: ChatConvKey) => void; t: TFn; locale: string;
}) {
  const { last, unread } = row;
  const preview = last
    ? `${row.lastSenderLabel ? `${row.lastSenderLabel}: ` : ''}${previewContent(last.content, t)}`
    : row.idleLine;
  const showBadge = unread > 0 && !active;
  return (
    <button
      type="button"
      onClick={() => onSelect(row.key)}
      aria-current={active ? 'true' : undefined}
      className={`w-full text-start focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#B6871F] flex items-center gap-3 ${active ? '' : 'hover:bg-[var(--chat-row-hover)]'}`}
      style={{
        ['--chat-row-hover' as string]: CHAT.rowHover,
        padding: '8px 10px',
        borderRadius: 14,
        backgroundColor: active ? CHAT.rowActive : 'transparent',
        border: 'none',
        cursor: 'pointer',
        transitionProperty: 'background-color',
        transitionDuration: '120ms',
      } as React.CSSProperties}
    >
      <ChatAvatar kind={row.kind} name={String(row.key)} size={46} />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate" style={{ fontFamily: OUTFIT, fontSize: 15.5, fontWeight: showBadge ? 800 : 650, color: NEU.ink }}>
            {row.label}
          </span>
          {row.lastAt != null && (
            <span className="shrink-0" style={{
              fontFamily: OUTFIT, fontSize: 12, fontWeight: showBadge ? 700 : 500, fontVariantNumeric: 'tabular-nums',
              color: showBadge ? 'color-mix(in srgb, var(--gv-accent, #B6871F) 70%, var(--gv-on-surface, #1C1410))' : NEU.inkSoft,
            }}>
              {formatListTime(row.lastAt, t, locale)}
            </span>
          )}
        </span>
        <span className="flex items-center justify-between gap-2" style={{ marginTop: 2 }}>
          <span className="truncate" style={{ fontFamily: OUTFIT, fontSize: 13.5, color: showBadge ? NEU.ink : NEU.inkSoft, fontWeight: showBadge ? 600 : 400 }}>
            {preview}
          </span>
          {showBadge && (
            <span
              className="shrink-0 inline-flex items-center justify-center"
              aria-label={`${unread}`}
              style={{
                minWidth: 22, height: 22, padding: '0 7px', borderRadius: 999,
                background: `linear-gradient(135deg, ${NEU.gold}, ${NEU.deepGold})`,
                color: NEU.forest, fontFamily: OUTFIT, fontWeight: 800, fontSize: 12,
                lineHeight: 1, fontVariantNumeric: 'tabular-nums',
              }}
            >
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </span>
      </span>
    </button>
  );
});

export default memo(ChatConversationList);
