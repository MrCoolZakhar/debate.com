'use client';
// Placeholder: replaced by the chat build. Contract: a dialog with the delegate's conversations
// with other characters. Props stay as they are; the delegate page imports this default export.
export interface CrisisChatDialogProps { open: boolean; onClose: () => void; initialCharacterId?: string | null }
export default function CrisisChatDialog({ open }: CrisisChatDialogProps) { return open ? null : null; }
