'use client';

// Applications: delegates, head delegates, faculty advisors and observers. The page body is
// ApplicationsView.tsx, shared with Team > Team Applications (scope 'team', owner 23 Nov 2026).

import ApplicationsView from './ApplicationsView';

export default function ApplicationsPage() {
  return <ApplicationsView scope="participants" />;
}
