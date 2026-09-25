import { redirect } from 'next/navigation';

// Gavelling Points was retired (prompt 48). This old address now forwards to
// Credits and usage under Manage account, where the balance and history live.
export default function PointsPage() {
  redirect('/account/manage/credits');
}
