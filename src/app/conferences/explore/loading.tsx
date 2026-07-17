// Instant route-level loading UI for the conferences explore page. Replaces the
// previously frozen prior page during navigation with an immediate ivory shell,
// matching the client's own loading background.
export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#EDE7D8' }}>
      <div
        className="w-7 h-7 rounded-full border-2 animate-spin"
        style={{ borderColor: '#1B3828', borderTopColor: 'transparent' }}
      />
    </div>
  );
}
