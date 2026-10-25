# Gavelling Crisis

A crisis committee tool built on Gavelling's live rooms: a Crisis Director dashboard (Crisis Command), a backroom queue, the existing chair console as the front room, a crisis tab on the delegate phone, and a war map with fog of war. Started 25 Oct 2026 on the `crisis` branch.

Status: phase 1 build. Owner decisions are in `decisions.md`. Database parts 1 to 4 are applied (`sql/`). Code: `src/lib/crisis/` (types, client, api, live) and `src/app/crisis/` (entry, shell, pages).

## What is here

| Path | What it is |
|---|---|
| `design/crisis-plan.html` | The plan report (published: https://claude.ai/artifact/SStfCoZQ3hHpnZ8mAYw3Qb). How crisis works, the competitors, pages by role, directive model, map, settings, testing, build order, 42 questions. |
| `design/crisis-dashboard.src.html` | Source of the first Crisis Command design (published: https://claude.ai/artifact/5mAWUeBBtEHRcACyVguWVr). Cuban Missile Crisis sample, red theme with green accents. |
| `design/caribbean.json` | Map shapes for the sample, projected from world-atlas 2.0.2 (Natural Earth 50m). |
| `design/tools/render.mjs` | Projects world-atlas TopoJSON into SVG paths (needs `d3-geo` and `topojson-client`). |
| `design/tools/build.mjs` | Inlines the map, the logo and the crisis emblem into the design source. |
| `decisions.md` | Peter's answers to the plan questions. The rules for this feature. |
| `sql/` | Every applied database change, in order. |
| `research/` | Raw research notes: crisis procedure (six RoP documents and guides), competitor websites, Maximun hands-on, Master of Disaster demo. |

Rebuild the design page (from the repo root):

```bash
node docs/crisis/design/tools/build.mjs docs/crisis/design/crisis-dashboard.src.html docs/crisis/design/caribbean.json public/gavelling-lockup.webp public/committee-emblems/crisis.svg /tmp/crisis-dashboard.html
```

## Rules that apply before building

- A crisis committee stays one conference committee with one live room, minted only by `start_my_chair_session`. The crisis layer never writes the room's settings blob, phase or clocks (AGENTS.md).
- SQL is applied from the crisis chat (Peter, 25 Oct 2026) and recorded in `sql/`. Anything touching money still goes to Christian's chat.
- Organisers are never charged (CLAUDE.md); crisis pricing is open (plan question 35).
- Crisis work is tested in a real room on Gavelling Test MUN 2027 (Peter approved, 25 Oct 2026).
