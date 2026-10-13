// "A new chat closes after one letter" (prompt 116, 12 Oct 2026). A delegate opens Chat,
// searches a delegation nobody has messaged, opens it and types a whole sentence one key at a
// time while another delegation keeps posting into Everyone (a busy room), then sends it.
// After EVERY key the same conversation must still be open with the text in the box, and the
// message must reach the database addressed to that delegation. Run at the phone, tablet and
// laptop sizes (playwright.config.ts), in a plain room and in a room where a chair has the
// same name as a seat (the RAAGKK setup).

import fs from 'node:fs';
import path from 'node:path';
import { test, expect, type Browser, type Page } from '@playwright/test';

function env(): { url: string; key: string } {
  const file = path.join(process.cwd(), '.env.local');
  const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  const get = (k: string) => process.env[k] || text.split('\n').find((l) => l.startsWith(`${k}=`))?.slice(k.length + 1).trim() || '';
  return { url: get('NEXT_PUBLIC_SUPABASE_URL'), key: get('NEXT_PUBLIC_SUPABASE_ANON_KEY') };
}

const { url: SUPABASE_URL, key: ANON } = env();
const headers = (code: string) => ({ apikey: ANON, Authorization: `Bearer ${ANON}`, 'x-session-code': code, 'Content-Type': 'application/json' });

/** A standalone room with the G20 seats, made through /create/sessions. Returns the code. */
async function createRoom(browser: Browser, chairName: string): Promise<string> {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const p = await ctx.newPage();
  await p.goto('/create/sessions', { waitUntil: 'networkidle' });
  await p.getByPlaceholder('e.g. Human Rights Council or HRC').fill('E2E Chat Room');
  await p.getByPlaceholder('e.g. The right to education').fill('A new conversation stays open');
  await p.getByPlaceholder('Your name').fill(chairName);
  await p.getByRole('button', { name: /^\+?\s*Add$/ }).first().click();
  await p.getByText('G20', { exact: true }).click();
  await p.getByRole('button', { name: /Start session/ }).click();
  await p.waitForURL(/\/chair\/[A-Z0-9]+/, { timeout: 60_000 });
  const code = new URL(p.url()).pathname.split('/').pop()!;
  await ctx.close();
  return code;
}

async function committeeId(code: string): Promise<string> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/committees?code=eq.${code}&select=id`, { headers: headers(code) });
  const rows = (await r.json()) as { id: string }[];
  return rows[0].id;
}

/** Another delegation posting into Everyone every `everyMs` until stopped: realtime events while typing. */
function startTraffic(code: string, id: string, sender: string, everyMs: number): () => void {
  let on = true;
  let i = 0;
  void (async () => {
    while (on) {
      await fetch(`${SUPABASE_URL}/rest/v1/messages`, {
        method: 'POST', headers: headers(code),
        body: JSON.stringify({ committee_id: id, sender, content: `Room traffic ${i++}`, is_private: false }),
      }).catch(() => {});
      await new Promise((r) => setTimeout(r, everyMs));
    }
  })();
  return () => { on = false; };
}

async function openChat(page: Page, code: string, me: string) {
  await page.goto(`/delegate/${code}?country=${encodeURIComponent(me)}`, { waitUntil: 'networkidle' });
  const chat = page.getByText('Chat', { exact: true }).last();
  await expect(chat).toBeVisible({ timeout: 60_000 });
  // The Chat key sits in the delegate board; a DOM click reaches it whatever lies over it.
  await chat.evaluate((el) => ((el.closest('button') ?? el) as HTMLElement).click());
  await expect(page.getByRole('dialog')).toBeVisible();
}

for (const setup of [
  { name: 'plain room', chair: 'Alice', me: 'France', target: 'China' },
  { name: 'chair named like a seat', chair: 'Brazil', me: 'India', target: 'Brazil' },
]) {
  test(`a brand-new conversation stays open while typing (${setup.name})`, async ({ browser, page }) => {
    test.setTimeout(600_000);
    const t0 = Date.now();
    const mark = (what: string) => console.log(`[${setup.name}] ${what} at ${Math.round((Date.now() - t0) / 1000)} s`);
    const code = await createRoom(browser, setup.chair);
    const id = await committeeId(code);
    mark(`room ${code} made`);
    await openChat(page, code, setup.me);
    mark('chat open');

    const dialog = page.getByRole('dialog');
    await dialog.getByLabel(/search/i).first().fill(setup.target);
    await dialog.getByRole('button', { name: new RegExp(setup.target) }).first().click();
    const title = dialog.locator('h3', { hasText: setup.target });
    await expect(title).toBeVisible();
    const box = dialog.locator('textarea').first();
    await box.click();

    mark('conversation open');
    const stop = startTraffic(code, id, 'Germany', 600);
    const sentence = `Hello ${setup.target}, shall we co-sponsor a working paper on this topic?`;
    try {
      let typed = '';
      for (const ch of sentence) {
        await page.keyboard.type(ch);
        typed += ch;
        await page.waitForTimeout(60);
        // After every key: still this conversation, the text all there, the box still focused.
        await expect(title).toBeVisible({ timeout: 10_000 });
        await expect(box).toHaveValue(typed, { timeout: 10_000 });
        await expect(box).toBeFocused({ timeout: 10_000 });
      }
      mark('sentence typed');
      await page.waitForTimeout(1_500);
      await expect(title).toBeVisible();
      await expect(box).toHaveValue(sentence);
      await page.keyboard.press('Enter');
      await expect(box).toHaveValue('');
      await expect(dialog.getByText(sentence)).toBeVisible();
    } finally {
      stop();
    }

    // It reached the database, from this delegation, privately to the target.
    await expect.poll(async () => {
      const q = `${SUPABASE_URL}/rest/v1/messages?committee_id=eq.${id}&sender=eq.${encodeURIComponent(setup.me)}&select=content,recipient,is_private`;
      const rows = (await (await fetch(q, { headers: headers(code) })).json()) as { content: string; recipient: string; is_private: boolean }[];
      return rows.some((r) => r.content === sentence && r.recipient === setup.target && r.is_private);
    }, { timeout: 20_000 }).toBe(true);
  });
}
