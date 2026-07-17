// Instant route-level loading UI so navigating INTO a conference page paints
// immediately instead of freezing on the previous page. Matches the spinner the
// client renders while its data settles, so there is no visual jump.
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
