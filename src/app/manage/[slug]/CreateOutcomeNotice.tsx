'use client';

// Right after the creation wizard (owner, 22 Nov 2026): the wizard lands here with
// `&publish_failed=1` when the conference was created but the Publish write was refused (it stays
// a draft), and `&invites_failed=N` when some chair invites did not go out. Says so once in the
// glass pill and takes the flags off the address in place. Writes nothing.

import { useEffect } from 'react';
import { notifyErr } from '@/lib/appNotify';
import { replaceUrlInPlace } from '@/lib/replaceUrlInPlace';

export default function CreateOutcomeNotice() {
  useEffect(() => {
    const url = new URL(window.location.href);
    const publishFailed = url.searchParams.get('publish_failed') === '1';
    const invitesFailed = Number(url.searchParams.get('invites_failed') ?? 0);
    if (!publishFailed && !(invitesFailed > 0)) return;
    if (publishFailed) {
      notifyErr('Your conference was created as a draft but could not be published. Press Publish at the top to try again.', 'create-publish');
    }
    if (invitesFailed > 0) {
      notifyErr(
        invitesFailed === 1
          ? 'One chair invite did not go out. Invite them again from Committees.'
          : `${invitesFailed} chair invites did not go out. Invite them again from Committees.`,
        'create-invites',
      );
    }
    url.searchParams.delete('publish_failed');
    url.searchParams.delete('invites_failed');
    replaceUrlInPlace(url.pathname + url.search + url.hash);
  }, []);
  return null;
}
