// Instant route-level loading UI for the conferences explore page: the brand
// ivory ground the page itself draws, so navigation never flashes another colour.
import Loader from '@/components/Loader';

export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#EDE7D8' }}>
      <Loader size={72} label="Loading conferences" />
    </div>
  );
}
