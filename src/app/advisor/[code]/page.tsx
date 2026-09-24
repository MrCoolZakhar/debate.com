import { redirect } from 'next/navigation';

// The single-room advisor view was removed on 24 Sep 2026 (owner: "completely remove the
// room view for faculty advisors"). Old links, emails and bookmarks land on the board with
// the add flow prefilled for this code, where the room can be followed.
export default async function AdvisorRoomRedirect({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  let raw = code ?? '';
  try { raw = decodeURIComponent(raw); } catch { /* keep as given */ }
  const clean = raw.trim().toUpperCase();
  redirect(clean ? `/advisor?add=${encodeURIComponent(clean)}` : '/advisor');
}
