'use client';
// Gavelling Crisis: the bold, game-style banner at the top of the big prompts ("New Cabinet Directive!", "Meeting Request!").
// Chunky display font in gold on the crisis red, a short scale-in with a little bounce and one shine sweep. With reduced motion
// it just appears. The ONLY place the display font is used.

import type { ReactNode } from 'react';
import { crisisDisplay } from '../../displayFont';

const CSS = `
.pb-banner { position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center; gap: 12px; padding: 14px 20px 13px; border-radius: 18px; text-align: center;
  background: linear-gradient(135deg, #4A0F10 0%, #8E2424 55%, #B83A32 100%); color: #FFD966;
  box-shadow: 0 8px 22px rgba(58,14,15,0.42), inset 0 0 0 2px rgba(255,217,102,0.55), inset 0 -4px 0 rgba(58,14,15,0.28);
  animation: pb-pop 560ms cubic-bezier(0.34,1.56,0.64,1) both; }
.pb-banner::after { content: ''; position: absolute; top: -10%; bottom: -10%; width: 34%; left: -50%; transform: skewX(-18deg); pointer-events: none;
  background: linear-gradient(100deg, transparent, rgba(255,255,255,0.5), transparent); animation: pb-shine 900ms 480ms ease-out 1 both; }
.pb-title { margin: 0; font-size: clamp(22px, 4.6vw, 32px); line-height: 1.1; letter-spacing: 0.02em; text-shadow: 0 2px 0 rgba(58,14,15,0.6), 0 0 18px rgba(255,217,102,0.28); overflow-wrap: anywhere; }
.pb-icon { display: inline-grid; place-items: center; flex: none; animation: pb-wiggle 900ms 520ms ease-in-out 1 both; }
@keyframes pb-pop { 0% { opacity: 0; transform: scale(0.55) rotate(-3deg); } 62% { opacity: 1; transform: scale(1.07) rotate(1deg); } 100% { opacity: 1; transform: none; } }
@keyframes pb-shine { from { left: -50%; } to { left: 130%; } }
@keyframes pb-wiggle { 0%, 100% { transform: rotate(0); } 25% { transform: rotate(-14deg) scale(1.12); } 55% { transform: rotate(10deg) scale(1.08); } 80% { transform: rotate(-4deg); } }
@media (prefers-reduced-motion: reduce) { .pb-banner, .pb-icon { animation: none; } .pb-banner::after { display: none; } }
`;

export default function PopBanner({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  return (
    <div className="pb-banner">
      <style>{CSS}</style>
      {icon && <span className="pb-icon" aria-hidden>{icon}</span>}
      <h2 className={`pb-title ${crisisDisplay.className}`}>{children}</h2>
      {icon && <span className="pb-icon" aria-hidden>{icon}</span>}
    </div>
  );
}
