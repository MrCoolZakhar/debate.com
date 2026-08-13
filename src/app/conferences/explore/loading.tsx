// Instant route-level loading UI for the conferences explore page. Replaces the
// previously frozen prior page during navigation with an immediate ivory shell,
// matching the client's own loading background.
import Loader from '@/components/Loader';

export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#EDE7D8' }}>
      <Loader size={72} label="Loading conferences" />
    </div>
  );
}
