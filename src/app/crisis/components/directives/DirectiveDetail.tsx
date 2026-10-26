'use client';
// Gavelling Crisis: one directive, opened. The backroom inbox and the Crisis Command page open it as
// DirectivePopup (the main pop-up with the "What happens when you send" panel docked beside it).
// This file keeps the old name and props so a caller that still says <DirectiveDetail> gets the same
// pop-up. A caller that has its own drawer or pane should render <DirectivePopup> directly instead,
// so a pop-up never opens on top of another.

import { useState } from 'react';
import DirectivePopup, { type DirectivePopupProps } from './DirectivePopup';

export interface DirectiveDetailProps extends Omit<DirectivePopupProps, 'onClose'> {
  /** Called when the pop-up is closed. Without it the pop-up just goes away. */
  onClose?: () => void;
}

export function DirectiveDetail({ onClose, ...rest }: DirectiveDetailProps) {
  const [closed, setClosed] = useState(false);
  if (closed) return null;
  return <DirectivePopup {...rest} onClose={() => { setClosed(true); onClose?.(); }} />;
}

export default DirectiveDetail;
