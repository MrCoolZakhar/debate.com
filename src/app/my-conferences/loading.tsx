// Instant route-level loading UI for /my-conferences. Paints an immediate ivory
// shell + spinner on navigation instead of freezing the previous page while the
// bundle and auth/data settle. Matches the client's own spinner.
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
