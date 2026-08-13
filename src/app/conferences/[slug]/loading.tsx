// Instant route-level loading UI so navigating INTO a conference page paints
// immediately instead of freezing on the previous page. Matches the loader the
// client renders while its data settles, so there is no visual jump.
import Loader from '@/components/Loader';

export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#EDE7D8' }}>
      <Loader size={72} label="Loading conference" />
    </div>
  );
}
