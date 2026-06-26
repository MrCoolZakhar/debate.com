'use client';

// Greyed-out placeholder shown in the chat area when chairs have disabled chat.
export default function ChatDisabledNotice({ onClose }: { onClose?: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 text-center" style={{ backgroundColor: '#EDE7D8' }}>
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#9A8A78" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="mb-3">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h9" />
        <line x1="2" y1="2" x2="22" y2="22" />
      </svg>
      <p className="text-base font-bold" style={{ color: '#6A5A4A', fontFamily: "'Poppins', sans-serif" }}>Chat is disabled</p>
      <p className="text-sm mt-1" style={{ color: '#9A8A78' }}>The chairs have turned off chat for this committee.</p>
      {onClose && (
        <button onClick={onClose} className="mt-5 px-4 py-2 rounded-xl text-xs font-bold transition-colors"
          style={{ backgroundColor: '#DDD4C0', color: '#1B3828' }}>
          Back to session
        </button>
      )}
    </div>
  );
}
