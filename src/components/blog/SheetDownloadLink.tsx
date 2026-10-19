'use client';

/**
 * "Download the sheet" under a MUN reference sheet. A press also adds one to
 * the anonymous site counter (/api/site-view, page `sheet/<style>/<sheet>`,
 * source `download`), so the style test can compare downloads per style
 * (owner, 19 Oct 2026). No cookie, no id, nothing personal; the download never
 * waits for the count.
 */

export default function SheetDownloadLink({ href, style, sheet }: { href: string; style: string; sheet: string }) {
  return (
    <a
      href={href}
      download
      className="font-bold underline underline-offset-2"
      style={{ color: '#1B3828' }}
      onClick={() => {
        try {
          void fetch('/api/site-view', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ page: `sheet/${style}/${sheet}`, source: 'download' }),
            keepalive: true,
          });
        } catch { /* counting never blocks the download */ }
      }}
    >
      Download the sheet
    </a>
  );
}
