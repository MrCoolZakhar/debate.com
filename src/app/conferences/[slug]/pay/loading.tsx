// Instant route-level loading UI for the participant payment page. Navigating to
// pay paints an immediate ivory shell + spinner instead of freezing the prior
// page while the bundle + invoice data load. Matches the app's spinner style.
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
