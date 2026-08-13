// Instant route-level loading UI for /my-conferences. Paints an immediate ivory
// shell + branded loader on navigation instead of freezing the previous page
// while the bundle and auth/data settle.
import Loader from '@/components/Loader';

export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#EDE7D8' }}>
      <Loader size={72} label="Loading your conferences" />
    </div>
  );
}
