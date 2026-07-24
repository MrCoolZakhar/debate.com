'use client';

// Shared house action button for the position paper surfaces (paper detail
// page, PositionPaperCard): same lift-on-hover, scale-on-press physics as
// neu.tsx's NeuButton, but reusable as either a <button> or a download <a>,
// and supports an outline visual for secondary/danger actions like Reject
// or Cancel.

import { useState } from 'react';
import { NEU, EASE, OUTFIT } from '@/components/neu';

type ActionIcon = React.ComponentType<{ size?: number; strokeWidth?: number }>;

export function ActionButton({
  as = 'button', href, download, target, rel, onClick, disabled, icon: Icon, children,
  background, hoverBackground, color, hoverColor, border, boxShadowColor, style,
}: {
  as?: 'button' | 'a';
  href?: string;
  download?: string;
  target?: string;
  rel?: string;
  onClick?: () => void;
  disabled?: boolean;
  icon?: ActionIcon;
  children: React.ReactNode;
  background: string;
  hoverBackground?: string;
  color: string;
  hoverColor?: string;
  border?: string;
  boxShadowColor?: string;
  style?: React.CSSProperties;
}) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const shadowTint = boxShadowColor ?? 'rgba(27,56,40,0.2)';
  const sharedStyle: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    padding: '8px 16px', borderRadius: 9999,
    border: border ?? 'none',
    background: disabled ? 'rgba(27,56,40,0.12)' : (hovered && hoverBackground) ? hoverBackground : background,
    color: disabled ? NEU.muted : (hovered && hoverColor) ? hoverColor : color,
    fontFamily: OUTFIT, fontSize: 12, fontWeight: 800, letterSpacing: '0.05em',
    textDecoration: 'none',
    cursor: disabled ? 'default' : 'pointer',
    boxShadow: disabled ? 'none' : hovered ? `0 6px 14px ${shadowTint}, ${NEU.outSmHover}` : `0 3px 8px ${shadowTint}, ${NEU.outSm}`,
    transform: disabled ? 'none' : pressed ? 'scale(0.96)' : hovered ? 'translateY(-2px)' : 'translateY(0)',
    transition: `box-shadow 220ms ${EASE}, transform 140ms ${EASE}, background-color 180ms ${EASE}, color 180ms ${EASE}`,
    ...style,
  };
  const handlers = {
    onMouseEnter: () => { if (!disabled) setHovered(true); },
    onMouseLeave: () => { setHovered(false); setPressed(false); },
    onPointerDown: () => { if (!disabled) setPressed(true); },
    onPointerUp: () => setPressed(false),
  };
  if (as === 'a') {
    return (
      <a href={href} download={download} target={target} rel={rel} className="focus:outline-none" style={sharedStyle} {...handlers}>
        {Icon && <Icon size={13} strokeWidth={2.4} />}
        {children}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="focus:outline-none" style={sharedStyle} {...handlers}>
      {Icon && <Icon size={13} strokeWidth={2.4} />}
      {children}
    </button>
  );
}
