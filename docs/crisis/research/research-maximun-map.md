# Maximun map editor, hands-on (25 Oct 2026)

Tested as Crisis Director of the test committee. Map page, Real-world crisis, defaults, "Open map editor". Added and then removed one marker, one route, one area. Nothing published.

## Setup page (before the editor)
- 2-step wizard: "Build your crisis situation map". Crisis category: Real-world crisis (available) or Fictional crisis (greyed "Coming later": custom world and territories not built yet).
- Fields: map title, scenario date (date picker), starting location (Whole world, Middle East, Europe, Asia, Custom region). One summary card, "pan, zoom, add layers, markers, routes and operational areas".
- Closing the editor returns to this setup page. The test items were not kept (nothing was published; drafts do not appear to persist outside the editor).

## Editor layout
- Full-bleed map under the normal app chrome (left nav and top status bar remain). Floating glass top bar: "REAL-WORLD CRISIS . UPDATE #0", map title, scenario and date, then Undo, Redo, Map settings, Delegate preview, Publish update, Close.
- Bottom-left floating pill: Layers (count badge 5) and a tool group: Explore, + Marker, Route, Area. Bottom-right attribution: "Natural Earth public-domain reference . Current reference boundaries . Drag to move . Scroll to zoom".
- Top-right: zoom +, zoom minus, reset-view (home).
- Side panels float over the map and replace each other (layers panel left, feature inspector right, map settings left). Tools show a dark toast hint ("Click anywhere to place a marker", "Press, draw the complete route, then release", "Press, draw around the area, then release"). The tool reverts to Explore after each placement.

## Base map
- Not tiles. A vector world drawn from Natural Earth (the 110m or 50m scale: coarse, straight-edged borders, blobby small countries, Sinai/Israel/Lebanon crude). Real country borders, ocean, ivory land. Antarctica shown cream.
- No country names, no city names, no labels at any zoom. I zoomed about 10 wheel ticks (roughly Mediterranean scale): still no names, no cities, no roads, no rivers. Only the five P5 markers are labelled ("United States (P5)" etc.). A delegate cannot orient from labels. It reads as a clean "board" map, not a real political atlas.
- Base style select: Political, Terrain, Maritime, Minimal. They are only colour tints of the same vector: Terrain makes land greenish, Maritime a bluer sea and grey land, Minimal white land. No actual relief or bathymetry.
- Starting view select: Whole world, Middle East, Europe, Asia, Custom region.
- Scenario date: a plain field. I saw no time slider and no per-date map states. "Update #N" numbering is a published-version counter.

## Layers (the main organising idea)
- 9 preset layers, each with checkbox, icon, description and Edit: Political Boundaries, Control Areas ("occupied, contested or restricted"), Oil & Energy, Maritime Routes, Air Routes, Infrastructure, Military, Humanitarian, Incidents. Air Routes and Infrastructure start unchecked.
- Edit layer: rename, pick an icon from a fixed 18-icon set (General, Military, Air force aircraft, Air force base, Armoured unit, Army base, Naval base, Cargo aircraft, Oil field, Oil export, Cargo ship, Port, Airport, Hospital, Humanitarian aid, Energy, Incident, Factory, Political boundary, Control area) or paste any custom emoji, and one colour swatch. Icons are emoji or glyphs, not NATO symbology. No way I saw to add a new layer.
- Layer is the only style system: a feature takes its layer's icon and colour. I found no per-feature colour.

## Features and inspector
- Marker: click the map, it is created as "New map marker" on the Incidents layer (orange "!" disc plus bold label, always visible, labels collide, e.g. UK and France overlap). Draggable. Click selects and opens the inspector.
- Route: freehand press-drag-release. It is simplified to a few vertex handles (I got 3 to 4 from a straight drag), drawn dashed, in the Maritime layer colour; handles are draggable. It auto-assigns to Maritime Routes. There is no click-to-add-vertex or snap-to-sea, no arrowhead or direction shown.
- Area: freehand lasso, simplified to vertex handles. It auto-assigns to Control Areas (brown). My straight drag produced a degenerate two-line polygon, so the lasso needs a real loop. No fill preview seen.
- Inspector fields (same for point, route and area): Name, Description, Layer (move between 9 layers), Status (Operational, Restricted, Disrupted, Destroyed), Visibility (only Everyone or Crisis Team only), Remove from map. That is it. No unit strength, owner or faction, date, attachment, link to a delegate or directive, or tags.
- Country borders are themselves editable "Area" features on the Political Boundaries layer. Clicking a country selects "Turkey . 2026 boundary", described as a "Committee-defined historical boundary", with the same inspector, including Remove from map. So borders can in principle be edited and dropped (I did not touch it). Pre-existing: the five P5 markers.
- Delegate preview: a button swaps the toolbar for "Return to editor". Same map, tools hidden, the inspector becomes a read-only card (title, status chip, description, layer, visibility). It is one generic delegate view; no preview-as-character or per-delegate or per-team view. My "Crisis Team only" test could not be applied (a stale ref), so I did not see hiding in preview.

## Save and broadcast
- Edits are private drafts: "These changes stay private until the Crisis Director publishes the update". Undo and Redo give a step history, and even base-style changes count as steps. "Publish update" (not pressed) pushes a numbered update. No visible auto-save, diff, change log, scheduled publish or per-update notification seen. Closing the editor dropped my draft without a warning prompt.

## Performance and feel
- Fast: pan, wheel-zoom and drags were instant, with no tile loading or flicker, because it is vector. Page has a splash on load of about 3 s.
- Glass floating panels look polished. Minor: each tool is one-shot and reverts to Explore. Label collisions. The panel positions are fixed so the inspector can cover the map's east side.

## Clever
- Layer system with an icon and colour per layer; custom emoji. Status states (Destroyed, Disrupted) on any feature. Crisis Team only visibility. Draft/publish split with Undo/Redo and numbered updates. Delegate preview in one click. Freehand draw that auto-simplifies and picks the sensible layer. Borders are editable features (historical or fictional boundary changes).

## Clunky or missing
- No labels or cities: unusable for real geography. No tile or satellite option. No unit tokens, no NATO symbols, no strength, no movement orders or route-from-A-to-B linking, no territory-control colouring by country or faction (control is hand-drawn polygons), no fog of war per delegate, no per-delegate or per-team visibility (only a 2-way flag), no time slider, no history of published states visible to delegates, no import of images or maps, no measurement, no attachments, no linking to news, directives or characters. Fictional map is "coming later". Seven-plus layer toggle list is long and ungrouped. No marker clustering.

## Not seen
- What delegates actually see on their Map page (live view and whether there is a changelog), what Publish does and how it notifies, Crisis Team only hiding in preview, the Custom region framing, whether country borders can be redrawn by vertex, Air Routes and Infrastructure styles, how many markers it can hold, mobile layout, Fictional crisis.
