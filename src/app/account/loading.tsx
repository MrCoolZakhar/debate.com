// Instant route-level loading UI for the /account/* tabs. It renders inside the
// account layout's content column, so switching tabs paints a spinner in the
// content area immediately instead of leaving the previous tab frozen while the
// next tab's bundle + data load. Matches the app's spinner-on-ivory style.
export default function Loading() {
  return (
    <div className="flex items-center justify-center" style={{ minHeight: '60vh' }}>
      <div
        className="w-7 h-7 rounded-full border-2 animate-spin"
        style={{ borderColor: '#1B3828', borderTopColor: 'transparent' }}
      />
    </div>
  );
}
