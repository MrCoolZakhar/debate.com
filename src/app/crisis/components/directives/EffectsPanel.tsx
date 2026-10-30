'use client';
// Gavelling Crisis: the side panel of a directive, "What happens when you send". It starts EMPTY:
// "Nothing changes yet" and a plus. The plus opens a small menu right inside the panel (Resources,
// Move a unit, Change a border, A character, Newsflash); each choice adds a CARD that holds that one
// action's controls and has its own remove X. The plus stays at the bottom, so several characters, unit
// moves or borders can be added. Every change is STAGED in the reply's draft; the small recap of them sits
// at the bottom of the panel (EffectsRecap); nothing is written until Send reply, which applies them all in
// one call (answerDirective). Adding a unit move or a border opens the map full size at once (and the card's button reopens it) in place of the whole
// directive (MapFullView), never a pop-up on top of this one.

import { useEffect, useRef, useState } from 'react';
import { Plus, Zap, type LucideIcon } from 'lucide-react';
import { CK } from '../../crisisKit';
import { BorderCard, CARD_META, CharacterCard, NewsCard, ResourcesCard, UnitCard, clearCard, type CardEnv } from './effectCards';
import { newCardId, type EffectCard, type EffectCardKind } from './replyDraft';

interface MenuItem { kind: EffectCardKind; label: string; Icon: LucideIcon; blocked: string | null }

export default function EffectsPanel({ env }: { env: CardEnv }) {
  const { effects, setEffects, powers, authorCharacterId } = env;
  const [menuOpen, setMenuOpen] = useState(false);
  const justAdded = useRef<string | null>(null);
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
    { kind: 'character', label: 'A character', Icon: CARD_META.character.Icon, blocked: null },
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

      {effects.cards.map((card) => {
        const common = { card, env, onTarget: (t: string) => env.retarget(card, t), onRemove: () => removeCard(card) };
        return (
          <div key={card.id} data-card={card.id}>
            {card.kind === 'resources' && <ResourcesCard {...common} />}
            {card.kind === 'unit' && <UnitCard {...common} />}
            {card.kind === 'border' && <BorderCard {...common} />}
            {card.kind === 'character' && <CharacterCard {...common} />}
            {card.kind === 'news' && <NewsCard env={env} onRemove={common.onRemove} />}
          </div>
        );
      })}

      {!empty && addMenu}
    </div>
  );
}
