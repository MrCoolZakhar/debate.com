// Instant route-level loading UI for the participant payment page. Navigating to
// pay paints an immediate ivory shell + branded loader instead of freezing the
// prior page while the bundle + invoice data load.
import Loader from '@/components/Loader';

export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#EDE7D8' }}>
      <Loader size={72} label="Loading payment details" />
    </div>
  );
}
