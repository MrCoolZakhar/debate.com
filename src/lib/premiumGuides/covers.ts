// Cover photos for the premium guides (owner, 25 Sep 2026: "use pictures as a
// cover behind the frosted glass"). Client-safe on purpose (no 'server-only'):
// the homepage, /blog, /guides and the guide pages all draw them. Every file is
// already in public/ and used elsewhere on the site.

const COVERS: Record<string, string> = {
  'best-delegate-playbook': '/roles/delegate.jpg',
  'chairing-playbook': '/roles/chair.webp',
  'sponsorship-playbook': '/landing/organiser-desk.jpg',
  'regional-growth-playbook': '/landing/podium-speaker.jpg',
  'clause-bank': '/roles/secretariat.jpg',
  'committee-design': '/roles/chair-card.webp',
  'specialised-committees': '/roles/secretariat.webp',
};

export function guideCover(slug: string): string {
  return COVERS[slug] ?? '/landing/organiser-desk.jpg';
}
