'use client';
// Gavelling Crisis: "Pick the exact spot" for a character. A small MapLibre map built from the war map's
// own offline pieces (the same world file, the same blank style: no tiles, no third party), read only.
// One click drops a red pin, the pin can be dragged to adjust, and Save hands the longitude, the latitude
// and the country under the pin back to the character pop-up. Nothing here writes to the crisis.

import 'maplibre-gl/dist/maplibre-gl.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Map as MLMap, MapMouseEvent, Marker as MLMarker } from 'maplibre-gl';
import { MapPin, Minus, Plus } from 'lucide-react';
import { Btn, CK, Skeleton } from '../../crisisKit';
import { clampLat, clampLng, loadWorldData } from '../map/mapData';
import { BLANK_STYLE, L_LAND, SRC_COUNTRIES, mapLayers } from '../map/mapStyle';
import { MAP_CSS, makeCountryLabel, paintCharacter, safeColor } from '../map/tokens';

export interface PickedSpot { lng: number; lat: number; country: string | null }

const round5 = (n: number) => Math.round(n * 1e5) / 1e5;
const SVG = 'http://www.w3.org/2000/svg';

/** The red pin, drawn with DOM calls (its tip is the spot). */
function makePin(): HTMLElement {
  const el = document.createElement('div');
  el.style.cssText = 'width:30px;height:38px;cursor:grab;filter:drop-shadow(0 3px 4px rgba(58,14,15,0.35))';
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 30 38');
  svg.setAttribute('width', '30');
  svg.setAttribute('height', '38');
  const body = document.createElementNS(SVG, 'path');
  body.setAttribute('d', 'M15 37C15 37 2 23.5 2 14.5a13 13 0 0 1 26 0C28 23.5 15 37 15 37Z');
  body.setAttribute('fill', '#8E2424');
  body.setAttribute('stroke', '#FFFFFF');
  body.setAttribute('stroke-width', '2');
  const dot = document.createElementNS(SVG, 'circle');
  dot.setAttribute('cx', '15');
  dot.setAttribute('cy', '14.5');
  dot.setAttribute('r', '5');
  dot.setAttribute('fill', '#FFF4E6');
  svg.appendChild(body);
  svg.appendChild(dot);
  el.appendChild(svg);
  return el;
}

/** The character's round portrait with their cabinet ring (the same as on the war map); its centre is the spot. */
function makeAvatar(who: Who): HTMLElement {
  const el = document.createElement('div');
  paintCharacter(el, { name: who.name, title: null, picture: who.picture ?? null, color: safeColor(who.color), selected: true, size: 46, showLabel: false });
  el.removeAttribute('role');
  el.tabIndex = -1;
  el.title = `${who.name}. Drag to move.`;
  el.style.cursor = 'grab';
  return el;
}

interface Who { name: string; picture?: string | null; color?: string | null }

export default function CharacterMapPicker({ lng, lat, label, onSave, onClear, busy, name, picture, color }: {
  lng: number | null | undefined;
  lat: number | null | undefined;
  /** Who is being placed: their portrait becomes the marker (a red pin when no name is given). */
  name?: string;
  picture?: string | null;
  color?: string | null;
  /** The place label saved with the character, shown while no new pin is dropped. */
  label: string;
  onSave: (spot: PickedSpot) => void;
  onClear: () => void;
  busy?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const mlRef = useRef<typeof import('maplibre-gl') | null>(null);
  const pinRef = useRef<MLMarker | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const hasSaved = typeof lng === 'number' && typeof lat === 'number';
  const [spot, setSpot] = useState<PickedSpot | null>(hasSaved ? { lng: lng as number, lat: lat as number, country: null } : null);
  const [moved, setMoved] = useState(false);
  const start = useRef({ lng: lng as number | null | undefined, lat: lat as number | null | undefined });
  const whoRef = useRef<Who | null>(name ? { name, picture, color } : null);
  useEffect(() => { whoRef.current = name ? { name, picture, color } : null; }, [name, picture, color]);

  const countryAt = useCallback((m: MLMap, at: { lng: number; lat: number }): string | null => {
    const f = m.queryRenderedFeatures(m.project([at.lng, at.lat]), { layers: [L_LAND] })[0];
    return (f?.properties?.name as string | undefined) ?? null;
  }, []);

  const place = useCallback((m: MLMap, at: { lng: number; lat: number }) => {
    const ml = mlRef.current;
    if (!ml) return;
    const p = { lng: round5(clampLng(at.lng)), lat: round5(clampLat(at.lat)) };
    if (!pinRef.current) {
      const who = whoRef.current;
      const marker = new ml.Marker({ element: who ? makeAvatar(who) : makePin(), anchor: who ? 'center' : 'bottom', draggable: true }).setLngLat([p.lng, p.lat]).addTo(m);
      marker.on('dragend', () => {
        const ll = marker.getLngLat();
        const q = { lng: round5(clampLng(ll.lng)), lat: round5(clampLat(ll.lat)) };
        setSpot({ ...q, country: countryAt(m, q) });
        setMoved(true);
      });
      pinRef.current = marker;
    } else {
      pinRef.current.setLngLat([p.lng, p.lat]);
    }
    setSpot({ ...p, country: countryAt(m, p) });
    setMoved(true);
  }, [countryAt]);

  useEffect(() => {
    let cancelled = false;
    let map: MLMap | null = null;
    let ro: ResizeObserver | null = null;
    const labelMarkers = new Map<string, MLMarker>();
    (async () => {
      try {
        const [ml, w] = await Promise.all([import('maplibre-gl'), loadWorldData()]);
        if (cancelled || !host.current) return;
        ml.setWorkerUrl(`${window.location.origin}/maplibre/maplibre-gl-worker.mjs`);
        mlRef.current = ml;
        const s = start.current;
        const has = typeof s.lng === 'number' && typeof s.lat === 'number';
        map = new ml.Map({
          container: host.current, style: BLANK_STYLE,
          center: has ? [s.lng as number, s.lat as number] : [-30, 28], zoom: has ? 4 : 1, minZoom: 0.6, maxZoom: 9,
          renderWorldCopies: false, attributionControl: false, dragRotate: false, pitchWithRotate: false, maxPitch: 0,
          cooperativeGestures: true,
        });
        map.touchZoomRotate.disableRotation();
        map.touchPitch.disable();
        ro = new ResizeObserver(() => { map?.resize(); });
        ro.observe(host.current);
        const m = map;
        mapRef.current = m;

        const syncLabels = () => {
          const z = m.getZoom() + 0.6;
          for (const l of w.labels) {
            const show = z >= l.minZoom;
            const had = labelMarkers.get(l.key);
            if (show && !had) labelMarkers.set(l.key, new ml.Marker({ element: makeCountryLabel(l.name, l.area), anchor: 'center' }).setLngLat(l.center).addTo(m));
            else if (!show && had) { had.remove(); labelMarkers.delete(l.key); }
          }
        };

        m.on('load', () => {
          if (cancelled) return;
          m.addSource(SRC_COUNTRIES, { type: 'geojson', data: w.collection, promoteId: 'key' });
          for (const layer of mapLayers().filter((x) => 'source' in x && x.source === SRC_COUNTRIES)) m.addLayer(layer);
          m.on('click', (e: MapMouseEvent) => {
            const target = e.originalEvent.target as HTMLElement | null;
            if (target?.closest('.maplibregl-marker')) return;
            place(m, e.lngLat);
          });
          m.on('zoom', syncLabels);
          syncLabels();
          if (has) {
            const ll = { lng: s.lng as number, lat: s.lat as number };
            place(m, ll);
            setMoved(false);
          }
          setReady(true);
          m.resize();
          window.requestAnimationFrame(() => { if (!cancelled) m.resize(); });
        });
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      ro?.disconnect();
      for (const mk of labelMarkers.values()) mk.remove();
      pinRef.current?.remove();
      pinRef.current = null;
      map?.remove();
      mapRef.current = null;
    };
  }, [place]);

  const zoom = (by: number) => { const m = mapRef.current; if (m) m.easeTo({ zoom: Math.max(0.6, Math.min(9, m.getZoom() + by)), duration: 180 }); };

  if (failed) return <p style={{ margin: 0, fontSize: 14, color: CK.danger }}>The map did not load. Type the place instead.</p>;

  const zoomBtn = {
    border: 0, background: CK.card, borderRadius: 10, width: 34, height: 34, cursor: 'pointer', color: CK.forest, boxShadow: CK.shadowSm,
    display: 'grid', placeItems: 'center',
  } as const;

  return (
    <div className="flex flex-col" style={{ gap: 12 }}>
      <style>{MAP_CSS}</style>
      <p className="flex items-center gap-2" style={{ margin: 0, fontSize: 13.5, color: CK.inkSoft }}>
        <MapPin size={16} strokeWidth={1.5} aria-hidden style={{ color: CK.red, flex: 'none' }} />
        <span>Click where they are. Drag {name ? 'their picture' : 'the pin'} to adjust.</span>
      </p>
      <div style={{ position: 'relative', borderRadius: 18, overflow: 'hidden', boxShadow: `inset 0 0 0 1px ${CK.hair}`, height: 380, background: '#DCE4DA' }}>
        <div ref={host} aria-label="Map: click to drop a pin" style={{ position: 'absolute', inset: 0 }} />
        {!ready && <div style={{ position: 'absolute', inset: 0 }}><Skeleton h={380} r={0} /></div>}
        {ready && (
          <div className="flex flex-col" style={{ position: 'absolute', top: 10, right: 10, gap: 6 }}>
            <button type="button" onClick={() => zoom(1)} aria-label="Zoom in" className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]" style={zoomBtn}><Plus size={17} strokeWidth={1.6} /></button>
            <button type="button" onClick={() => zoom(-1)} aria-label="Zoom out" className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]" style={zoomBtn}><Minus size={17} strokeWidth={1.6} /></button>
          </div>
        )}
      </div>
      <p aria-live="polite" style={{ margin: 0, minHeight: 20, fontSize: 14, fontWeight: 700, color: CK.ink, overflowWrap: 'anywhere' }}>
        {spot ? (spot.country ? `At this spot: ${spot.country}` : moved ? 'At this spot: open sea or no country' : label ? `Now: ${label}` : '') : 'No spot set yet.'}
      </p>
      <div className="flex flex-wrap" style={{ gap: 8 }}>
        <Btn tone="green" icon={<MapPin size={15} strokeWidth={1.5} />} disabled={!spot || !moved || busy} onClick={() => spot && onSave(spot)}>
          {busy ? 'Saving' : 'Save this spot'}
        </Btn>
        {hasSaved && <Btn tone="danger" disabled={busy} onClick={onClear}>Remove the spot</Btn>}
      </div>
    </div>
  );
}
