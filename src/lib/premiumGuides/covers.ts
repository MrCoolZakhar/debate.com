// Cover photos for the premium guides (owner, 25 Sep 2026), drawn on top of
// each card like a blog post's photo (18 Oct 2026). Client-safe on purpose (no 'server-only'):
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
  'partnerships-playbook': '/onboarding/handshake-01.jpg',
  'paid-chairing-playbook': '/onboarding/lecture-01.jpg',
};

export function guideCover(slug: string): string {
  return COVERS[slug] ?? '/landing/organiser-desk.jpg';
}
