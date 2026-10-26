'use client';
// Placeholder: replaced by the Characters build. CONTRACT (used by the backroom, Command and the
// Characters page): a large centred, scrollable pop-up about one character with tabs
// Profile (edit when allowed), Directives (all their directives, newest first) and Performance
// (points from src/lib/crisis/points.ts). Keep the props.
export interface CharacterModalProps { characterId: string; onClose: () => void; initialTab?: 'profile' | 'directives' | 'performance' }
export default function CharacterModal(_props: CharacterModalProps) { void _props; return null; }
