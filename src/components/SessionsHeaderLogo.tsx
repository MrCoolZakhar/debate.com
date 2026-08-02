import Image from 'next/image';
import Link from 'next/link';

// Source file is 800x200 (4:1). Every consumer derives its width from this
// ratio and a target height, so the mark never looks squished or oversized
// relative to its neighbours across chair/delegate/voting.
const NATURAL_WIDTH = 800;
const NATURAL_HEIGHT = 200;

export default function SessionsHeaderLogo({
  height = 32,
  linked = true,
  className,
}: {
  /** Rendered height in px. Defaults to 32, which sits comfortably inside
   *  the 44px chair toolbar, the shortest of the three session headers. */
  height?: number;
  /** Every in-toolbar use links back to /sessions. MobileGate's full-screen
   *  splash renders the mark bare, there's nowhere useful to send it. */
  linked?: boolean;
  className?: string;
}) {
  const width = Math.round((NATURAL_WIDTH / NATURAL_HEIGHT) * height);

  const img = (
    <Image
      src="/GavellingLogo.png"
      alt="Gavelling"
      width={width}
      height={height}
      style={{ height, width: 'auto' }}
      className={className}
      priority
      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
    />
  );

  if (!linked) return img;

  return (
    <Link href="/sessions" aria-label="Back to Sessions" className="shrink-0 inline-flex items-center">
      {img}
    </Link>
  );
}
