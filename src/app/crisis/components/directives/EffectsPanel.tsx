'use client';
// Gavelling Crisis: the side panel of a directive, "What happens when you send". It starts EMPTY:
// "Nothing changes yet" and a plus. The plus opens a small menu right inside the panel (Resources,
// Move a unit, Change a border, A character, Newsflash); each choice adds a CARD that holds that one
// action's controls and has its own remove X. The plus stays at the bottom, so several characters, unit
// moves or borders can be added. Every change is STAGED in the reply's draft; the small recap of them sits
// at the bottom of the panel (EffectsRecap); nothing is written until Send reply, which applies them all in
// one call (answerDirective). Adding a unit move or a border opens the map full size at once (and the card's button reopens it) in place of the whole
// directive (MapFullView), never a pop-up on top of this one.
// Once a card holds a change and is not the one being worked on, it shrinks to a small round disc (the picture of who or what it
// changes, a tiny mark for the kind, a small X); hovering it says the details, pressing it opens the card again (HultMUN, 23 Nov 2026).

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Map as MapIcon, Newspaper, Plus, X, Zap, type LucideIcon } from 'lucide-react';
import { HoverHint } from '@/components/HoverHint';
import { amount as fmtAmount } from '@/lib/crisis/format';
import { Avatar, CK } from '../../crisisKit';
import {
  BorderCard, CARD_META, CharMoveCard, CharacterCard, NewsCard, ResourcesCard, STATUS_META, UnitCard, clearCard, describeCharMove, describeMapEdits, describeUnitMove,
  effectiveOwner, ownerOf, round2, type CardEnv,
} from './effectCards';
import { CabinetLogo } from './directiveParts';
import { newCardId, type EffectCard, type EffectCardKind } from './replyDraft';

interface MenuItem { kind: EffectCardKind; label: string; Icon: LucideIcon; blocked: string | null }

/** What a card with a staged change looks like when it is small: its round face and the words said on hover. Null while it changes nothing. */
interface Summary { face: ReactNode; text: string }

const DISC = 46;

function summarise(card: EffectCard, env: CardEnv): Summary | null {
  const { data, effects, cabById, charById, typeById } = env;
  switch (card.kind) {
    case 'resources': {
      if (!data) return null;
      const owner = effectiveOwner(card, env);
      const rows = data.resources.filter((r) => ownerOf(r) === owner && effects.resources[r.id]);
      if (rows.length === 0) return null;
      const first = rows[0];
      const ch = first.character_id ? charById.get(first.character_id) : undefined;
      const cab = first.cabinet_id ? cabById.get(first.cabinet_id) : undefined;
      const lines = rows.map((r) => `${typeById.get(r.type_id)?.t.name ?? 'Resource'} ${fmtAmount(r.amount)} to ${fmtAmount(round2(r.amount + (effects.resources[r.id] ?? 0)))}`);
      return {
        face: ch ? <Avatar name={ch.name} src={ch.picture_url} size={DISC} color={cabById.get(ch.cabinet_id ?? '')?.color ?? CK.red} /> : <CabinetLogo cabinet={cab} size={DISC} />,
        text: `Resources, ${ch?.name ?? cab?.name ?? 'owner'}: ${lines.join(', ')}`,
      };
    }
    case 'unit': {
      const u = data?.units.find((x) => x.id === card.target);
      const st = u ? effects.units[u.id] : undefined;
      if (!u || !st) return null;
      const amount = st.strength !== undefined && st.strength !== u.strength ? `, amount ${fmtAmount(u.strength)} to ${fmtAmount(st.strength)}` : '';
      return { face: <CabinetLogo cabinet={cabById.get(u.owner_cabinet_id ?? '')} size={DISC} />, text: `${describeUnitMove(u, st)}${amount}` };
    }
    case 'border': {
      const lines = describeMapEdits(effects.map, env);
      if (lines.length === 0) return null;
      return { face: <MapIcon size={22} strokeWidth={1.5} aria-hidden style={{ color: CK.red }} />, text: `Borders: ${lines.join('. ')}` };
    }
    case 'character': {
      const ch = charById.get(card.target);
      const st = ch ? effects.characters[ch.id] : undefined;
      if (!ch || !st) return null;
      return {
        face: <Avatar name={ch.name} src={ch.picture_url} size={DISC} color={STATUS_META[st.status].color} />,
        text: `${ch.name}: ${STATUS_META[st.status].label.toLowerCase()}${st.note.trim() ? `, ${st.note.trim()}` : ''}`,
      };
    }
    case 'move': {
      const ch = charById.get(card.target);
      const to = ch ? effects.chars[ch.id] : undefined;
      if (!ch || !to) return null;
      return { face: <Avatar name={ch.name} src={ch.picture_url} size={DISC} color={cabById.get(ch.cabinet_id ?? '')?.color ?? CK.red} />, text: describeCharMove(ch, to) };
    }
    case 'news': {
      const n = effects.news;
      if (!n || !n.title.trim()) return null;
      return { face: <Newspaper size={22} strokeWidth={1.5} aria-hidden style={{ color: CK.red }} />, text: `News: ${n.title.trim()}` };
    }
  }
}

/** A card that already changes something, drawn as a small round disc. Press it to work on the card again; the small X takes the change out. */
function EffectDisc({ kind, summary, onOpen, onRemove }: { kind: EffectCardKind; summary: Summary; onOpen: () => void; onRemove: () => void }) {
  const Mark = CARD_META[kind].Icon;
  return (
    <span style={{ position: 'relative', display: 'inline-flex', flex: 'none', width: DISC + 6, height: DISC + 6, alignItems: 'center', justifyContent: 'center' }}>
      <HoverHint text={summary.text}>
        <button type="button" onClick={onOpen} aria-label={`Change this: ${summary.text}`}
          className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] active:scale-[0.95] transition-transform"
          style={{ width: DISC, height: DISC, borderRadius: '50%', border: 0, padding: 0, overflow: 'hidden', display: 'grid', placeItems: 'center', cursor: 'pointer', background: CK.card, boxShadow: `0 0 0 2px ${CK.red}, ${CK.shadowSm}` }}>
          {summary.face}
        </button>
      </HoverHint>
      <span aria-hidden style={{ position: 'absolute', right: 0, bottom: 0, width: 19, height: 19, borderRadius: '50%', display: 'grid', placeItems: 'center', background: CK.red, color: '#FFF4E6', boxShadow: '0 1px 4px rgba(58,14,15,0.4)', pointerEvents: 'none' }}>
        <Mark size={11} strokeWidth={1.8} />
      </span>
      <button type="button" onClick={onRemove} aria-label={`Remove: ${summary.text}`}
        className="grid place-items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
        style={{ position: 'absolute', right: 0, top: 0, width: 17, height: 17, borderRadius: '50%', border: 0, background: CK.card, color: CK.ink, cursor: 'pointer', boxShadow: '0 1px 4px rgba(58,14,15,0.35)' }}>
        <X size={10} strokeWidth={2} aria-hidden />
      </button>
    </span>
  );
}

export default function EffectsPanel({ env }: { env: CardEnv }) {
  const { effects, setEffects, powers, authorCharacterId } = env;
  const [menuOpen, setMenuOpen] = useState(false);
  const justAdded = useRef<string | null>(null);
  /** The card being worked on: shown in full. Every other card that already changes something is a small disc. */
  const [openId, setOpenId] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);

  // A card that was just added scrolls into view.
  const cardCount = effects.cards.length;
  useEffect(() => {
    const id = justAdded.current;
    if (!id) return;
    justAdded.current = null;
    root.current?.querySelector<HTMLElement>(`[data-card="${id}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [cardCount]);

  const addCard = (kind: EffectCardKind) => {
    const id = newCardId();
    let target = '';
    if (kind === 'character' && authorCharacterId && !effects.cards.some((c) => c.kind === 'character' && c.target === authorCharacterId)) target = authorCharacterId;
    setEffects((e) => ({ ...e, cards: [...e.cards, { id, kind, target }] }));
    setMenuOpen(false);
    setOpenId(id);
    justAdded.current = id;
    // Move a unit and Change a border go straight to the big map; Back returns to the card (owner, 30 Oct 2026).
    if (kind === 'unit') env.openMap({ kind: 'unit', cardId: id });
    else if (kind === 'border') env.openMap({ kind: 'border' });
  };
  const removeCard = (card: EffectCard) => setEffects((e) => ({ ...clearCard(e, card, env), cards: e.cards.filter((c) => c.id !== card.id) }));

  const hasNews = effects.cards.some((c) => c.kind === 'news');
  const hasBorder = effects.cards.some((c) => c.kind === 'border');
  const menu: MenuItem[] = [
    { kind: 'resources', label: 'Resources', Icon: CARD_META.resources.Icon, blocked: powers.resources ? null : 'Not allowed' },
    { kind: 'unit', label: 'Move a unit', Icon: CARD_META.unit.Icon, blocked: powers.units ? null : 'Not allowed' },
    { kind: 'border', label: 'Change a border', Icon: CARD_META.border.Icon, blocked: !powers.map ? 'Not allowed' : hasBorder ? 'One per reply' : null },
    { kind: 'move', label: 'Move a character', Icon: CARD_META.move.Icon, blocked: powers.characters ? null : 'Not allowed' },
    { kind: 'character', label: 'Character status', Icon: CARD_META.character.Icon, blocked: powers.characters ? null : 'Not allowed' },
    { kind: 'news', label: 'Newsflash', Icon: CARD_META.news.Icon, blocked: hasNews ? 'One per reply' : null },
  ];
  const empty = effects.cards.length === 0;

  const addMenu = (
    <div className="flex flex-col" style={{ gap: 8 }}>
      <button type="button" onClick={() => setMenuOpen((v) => !v)} aria-expanded={menuOpen} aria-haspopup="true"
        className="inline-flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] active:scale-[0.98] transition-transform"
        style={{ alignSelf: 'flex-start', gap: 8, border: 0, cursor: 'pointer', fontFamily: CK.font, fontSize: 13.5, fontWeight: 800, color: CK.forest, background: CK.card, borderRadius: 12, padding: '7px 14px 7px 8px', boxShadow: `inset 0 0 0 1px ${CK.hair}, ${CK.shadowSm}` }}>
        <span aria-hidden style={{ width: 26, height: 26, borderRadius: '50%', display: 'grid', placeItems: 'center', background: CK.greenBtn, color: '#fff' }}>
          <Plus size={16} strokeWidth={2} style={{ transform: menuOpen ? 'rotate(45deg)' : 'none', transition: 'transform 160ms' }} />
        </span>
        Add what happens
      </button>
      {menuOpen && (
        <div role="menu" aria-label="What should happen" style={{ display: 'grid', gap: 6, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
          {menu.map((m) => (
            <button key={m.kind} type="button" role="menuitem" disabled={!!m.blocked} onClick={() => addCard(m.kind)}
              className="flex items-center text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] active:scale-[0.98] transition-transform disabled:cursor-not-allowed"
              style={{ gap: 9, border: 0, borderRadius: 13, padding: '9px 11px', fontFamily: CK.font, cursor: 'pointer', background: CK.card, boxShadow: `inset 0 0 0 1px ${CK.hair}`, opacity: m.blocked ? 0.55 : 1 }}>
              <m.Icon size={19} strokeWidth={1.5} aria-hidden style={{ color: CK.red, flex: 'none' }} />
              <span style={{ minWidth: 0 }}>
                <b style={{ display: 'block', fontSize: 13.5, color: CK.ink, overflowWrap: 'anywhere' }}>{m.label}</b>
                {m.blocked && <span style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: CK.muted }}>{m.blocked}</span>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div ref={root} className="flex flex-col" style={{ gap: 12, fontFamily: CK.font }}>
      {empty && (
        <section className="flex flex-col" style={{ gap: 10, background: CK.card, borderRadius: 18, padding: '12px 13px', boxShadow: CK.shadowSm }}>
          <p className="flex items-center" style={{ margin: 0, gap: 8 }}>
            <Zap size={18} strokeWidth={1.5} aria-hidden style={{ color: CK.red }} />
            <b style={{ fontSize: 15, color: CK.ink }}>Nothing changes yet</b>
          </p>
          {addMenu}
        </section>
      )}

      {/* Cards that already change something are small discs side by side; the card being worked on is shown in full, on its own row. */}
      <div className="flex flex-wrap items-start" style={{ gap: 10 }}>
        {effects.cards.map((card) => {
          const common = { card, env, onTarget: (t: string) => env.retarget(card, t), onRemove: () => removeCard(card) };
          const summary = summarise(card, env);
          if (summary && card.id !== openId) {
            return (
              <div key={card.id} data-card={card.id} style={{ flex: 'none' }}>
                <EffectDisc kind={card.kind} summary={summary} onOpen={() => setOpenId(card.id)} onRemove={common.onRemove} />
              </div>
            );
          }
          return (
            <div key={card.id} data-card={card.id} style={{ flex: '1 1 100%', minWidth: 0 }}>
              {card.kind === 'resources' && <ResourcesCard {...common} />}
              {card.kind === 'unit' && <UnitCard {...common} />}
              {card.kind === 'border' && <BorderCard {...common} />}
              {card.kind === 'character' && <CharacterCard {...common} />}
              {card.kind === 'move' && <CharMoveCard {...common} />}
              {card.kind === 'news' && <NewsCard env={env} onRemove={common.onRemove} />}
              {summary && (
                <div className="flex justify-end" style={{ marginTop: 6 }}>
                  <button type="button" onClick={() => setOpenId(null)}
                    className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
                    style={{ border: 0, background: 'transparent', cursor: 'pointer', fontFamily: CK.font, fontSize: 13, fontWeight: 800, color: CK.forest, textDecoration: 'underline', padding: '2px 4px' }}>
                    Done
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!empty && addMenu}
    </div>
  );
}
