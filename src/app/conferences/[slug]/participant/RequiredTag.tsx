import type { CSSProperties } from 'react';

/**
 * The "Required" tag: a conference document the organisers want back
 * (prompt 143) and a position paper under Mandatory Submission (prompt 19).
 * One style for both.
 */
export const REQUIRED_TAG_STYLE: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', padding: '2px 9px', borderRadius: 999,
  background: 'rgba(139,32,32,0.1)', color: '#8B2020', fontSize: 12, fontWeight: 800, lineHeight: 1.5,
};

export default function RequiredTag() {
  return <span style={REQUIRED_TAG_STYLE}>Required</span>;
}
