// Instant route-level loading UI for the apply flow. Clicking "Apply" now paints
// this immediately instead of leaving the conference page frozen while the apply
// bundle + data load. Matches the client's own spinner-on-ivory loading state.
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
