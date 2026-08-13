// Instant route-level loading UI for the /account/* tabs. It renders inside the
// account layout's content column, so switching tabs paints the branded loader
// in the content area immediately instead of leaving the previous tab frozen
// while the next tab's bundle + data load. Uses the shared <Loader/> so every
// generic wait in the app shows the same green laurel cascade.
import Loader from '@/components/Loader';

export default function Loading() {
  return (
    <div className="flex items-center justify-center" style={{ minHeight: '60vh' }}>
      <Loader size={64} label="Loading your account" />
    </div>
  );
}
