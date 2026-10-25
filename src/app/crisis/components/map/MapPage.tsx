'use client';
// Gavelling Crisis: the War Map page. The map fills the window under the top bar; on a phone it
// takes a tall block and the page scrolls to the legend and the panels underneath.
import WarMap from './WarMap';

export default function MapPage() {
  return (
    <div className="crisis-map-page" style={{ marginTop: 4 }}>
      <style>{'@media (min-width: 768px) { .crisis-map-page { height: calc(100dvh - 82px); min-height: 520px; } }'}</style>
      <WarMap />
    </div>
  );
}
