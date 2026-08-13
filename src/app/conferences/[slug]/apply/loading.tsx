// Instant route-level loading UI for the apply flow. Clicking "Apply" paints
// this immediately instead of leaving the conference page frozen while the apply
// bundle + data load. Matches the client's own loading state, so no visual jump.
import Loader from '@/components/Loader';

export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#EDE7D8' }}>
      <Loader size={72} label="Loading application" />
    </div>
  );
}
