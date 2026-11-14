// Team > Team Members (owner, 14 Nov 2026) draws the Settings page's own Team
// section, the exact same code, state, writes and permission checks, without
// the Settings shell around it. TeamMembers.tsx turns this on; Settings itself
// never shows the Team section any more.

import { createContext } from 'react';

export const SettingsMembersOnlyContext = createContext(false);
