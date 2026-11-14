'use client';

// ── Team > Team Members (owner, 14 Nov 2026) ───────────────────────────────
//
// The organizing team moved out of Settings. It is the very same code Settings
// drew under its Team tab (the hierarchy, invites, permissions, titles, show on
// the public page, ordering and every write and permission check), mounted
// here without the Settings shell through SettingsMembersOnlyContext. Nothing
// is rewritten, so nothing about its behaviour can drift between the two.

import { Suspense } from 'react';
import SettingsPage from '../settings/page';
import { SettingsMembersOnlyContext } from '../settings/settingsMode';

export default function TeamMembers() {
  return (
    <SettingsMembersOnlyContext.Provider value={true}>
      <Suspense fallback={null}>
        <SettingsPage />
      </Suspense>
    </SettingsMembersOnlyContext.Provider>
  );
}
