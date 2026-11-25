import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// send-emails v20 (25 Nov 2026, owner): PERSONAL ROWS. A row with email_outbox.personal = true (a one-to-one email
// from Peter, first the platform gifts from admin_gift_unlimited) is sent WITHOUT the List-Unsubscribe and
// List-Unsubscribe-Post headers, which make Gmail file even a plain letter under Promotions. Every other row is sent
// exactly as v19. Never set personal on a broadcast, a campaign or anything sent to many people. This file is the
// record of the deployed source (the function is deployed from the Supabase project, not from git).
//
// send-emails v19 (12 Oct 2026, Document Uploads): EMAIL ATTACHMENTS.
// email_outbox.attachments (jsonb [{bucket, path, file_name, mime_type, size}],
// checked and normalised on insert by the email_outbox_aa_attachments_t trigger:
// conference-documents bucket only, PDF/Word/JPG/PNG, 10 files and 10 MB in
// total). Resend's BATCH endpoint takes no attachments, so a claimed row WITH
// attachments is sent alone through POST /emails, spaced like the v17 single
// re-send (600 ms, Resend allows 2 req/s), inside a wall-clock budget so the next
// drain carries on. Files are read with the service role from the private bucket
// and cached per invocation (a bulk send attaches the same file to every row).
// A row WITHOUT attachments goes through exactly the v18 batch path below.
//
// send-emails v17: drains email_outbox through Resend's batch API.
// v8 added send_after (scheduled rows). v9 added List-Unsubscribe.
// v10 fixed a double-send race by CLAIMING rows atomically
// (pending -> sending) and sweeping rows stuck in 'sending' back to pending.
// v11 fixed BATCH POISONING from malformed conferences.contact_email values.
// v12 added PLATFORM-LEVEL EMAIL (nullable conference_id + per-row reply_to).
// v14 fixed the OTHER batch poisoning: one malformed `to` 422'd a whole batch.
// v15 made unsubscribe actually work (per-address token + RFC 8058 one-click).
// v16 adds an OPTIONAL PER-ROW SENDER (email_outbox.from_name / from_address,
// 18 Sep 2026, first used for the KenyaMUN apology from "Peter at Gavelling").
// Only an address on mail.gavelling.com (the domain Resend is verified for) is
// honoured; a row without an override, or with anything else, gets exactly the
// v15 From. A DB check constraint enforces the same domain on insert.
//
// v17 (24 Sep 2026): a WELL-FORMED placeholder address (someone@example.com)
// passed the v14 format gate and Resend 422'd the whole batch of 100
// pre-registrant emails on 23 Sep. Two guards now:
//   (a) reserved / placeholder domains (example.*, *.example, *.test,
//       *.invalid, *.localhost, localhost) and non-ASCII addresses fail
//       individually before batching;
//   (b) a batch Resend still answers 422 is re-sent ONE ROW AT A TIME, so an
//       address Resend refuses fails alone and every other row still goes.
// Every address-level failure's error starts with "Invalid recipient address"
// so SQL can tell it apart from batch-level collateral (outbox_error_is_address_level()).
//
// Enforcement of opt-outs is NOT in this function. The email_outbox insert
// trigger sets status='suppressed' for an opted-out address, so every sender is
// covered including the SQL-side ones, and a suppressed row is never claimed.

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_ADDRESS = "notifications@mail.gavelling.com";
const SENDER_DOMAIN = "@mail.gavelling.com";
const SITE_URL = "https://gavelling.com";
// Fallback only, for a recipient whose token could not be minted. Still better
// than nothing, and the address it would need is the one we failed to look up.
const UNSUBSCRIBE_FALLBACK = `${SITE_URL}/account/profile`;
const BATCH_SIZE = 100;
const MAX_BATCHES_PER_INVOCATION = 5;
const STUCK_SENDING_MINUTES = 10;
// v17: spacing between one-at-a-time re-sends (Resend's default limit is 2 req/s).
const SINGLE_RESEND_GAP_MS = 600;
// v17: wall-clock budget for one split pass (edge functions are killed at 150 s).
const SPLIT_BUDGET_MS = 100_000;
// v19: wall-clock budget for attachment sends across the whole invocation.
const ATTACH_BUDGET_MS = 100_000;
// v19: the trigger already caps this; a second guard here costs nothing.
const ATTACH_MAX_TOTAL_BYTES = 10 * 1024 * 1024;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Attachment {
  bucket: string;
  path: string;
  file_name: string | null;
  mime_type: string | null;
  size: number | null;
}

interface OutboxRow {
  id: string;
  conference_id: string | null;
  subject: string;
  body: string;
  body_html: string | null;
  recipient_email: string | null;
  reply_to: string | null;
  from_name: string | null;
  from_address: string | null;
  attachments: Attachment[] | null;
  // v20: a one-to-one personal email, sent without the List-Unsubscribe headers.
  personal: boolean | null;
}

// Deliberately strict and boring. Anything this rejects is a field we omit,
// never a reason to drop the email itself -- except on the `to` field, where
// Resend rejects the whole batch, so a bad address must be pulled out first.
const EMAIL_RE = /^[^@\s,;<>]+@[^@\s,;<>]+\.[A-Za-z]{2,}$/;

// Invisible formatting codepoints: soft hyphen, NBSP, zero-width space, ZWNJ,
// ZWJ, LRM/RLM, line and paragraph separators, bidi embedding and overrides,
// word joiner and the invisible math operators, and the BOM. These survive
// copy-paste from documents and chat apps, cannot be seen in an input field,
// and make an otherwise perfect address unsendable. Held as codepoints rather
// than a character class so the source stays plain ASCII.
const INVISIBLE_CODEPOINTS = new Set<number>([
  0x00ad, 0x00a0,
  0x200b, 0x200c, 0x200d, 0x200e, 0x200f,
  0x2028, 0x2029,
  0x202a, 0x202b, 0x202c, 0x202d, 0x202e,
  0x2060, 0x2061, 0x2062, 0x2063, 0x2064,
  0xfeff,
]);

function stripInvisible(raw: string): string {
  let out = "";
  for (const ch of raw) {
    const cp = ch.codePointAt(0);
    if (cp !== undefined && INVISIBLE_CODEPOINTS.has(cp)) continue;
    out += ch;
  }
  return out;
}

/** Address with invisible characters and angle brackets removed, trimmed. */
function cleanAddress(raw: string): string {
  return stripInvisible(raw).trim().replace(/^<|>$/g, "").trim();
}

/** First syntactically valid address in a free-text contact field, or null.
 *  Organizers paste things like "a@x.com | b@x.com" or "a@x.com, b@x.com". */
function firstValidEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  for (const part of stripInvisible(raw).split(/[|,;\s]+/)) {
    const candidate = cleanAddress(part);
    if (EMAIL_RE.test(candidate)) return candidate;
  }
  return null;
}

/** The recipient address, cleaned, or null when it is genuinely unsendable.
 *  A single bad `to` 422s an entire Resend batch, so this gate runs before
 *  the payload is built rather than trusting whatever is in the row. */
function sendableRecipient(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const candidate = cleanAddress(raw);
  return EMAIL_RE.test(candidate) ? candidate : null;
}

/** v17: true when the domain is reserved and can never receive mail
 *  (RFC 2606 / 6761): example.* (and subdomains of it), and the TLDs
 *  .example, .test, .invalid, .localhost, or bare localhost. */
function isPlaceholderDomain(addr: string): boolean {
  // Resend also refuses any non-ASCII character in `to` (seen 7 Sep 2026).
  if (/[^\x00-\x7f]/.test(addr)) return true;
  const domain = addr.slice(addr.lastIndexOf("@") + 1).toLowerCase().replace(/\.$/, "");
  if (domain === "localhost") return true;
  if (/(^|\.)example(\.[a-z0-9-]+)+$/.test(domain)) return true;
  return /\.(example|test|invalid|localhost)$/.test(domain);
}

/** v16: the row's own sender when it is a valid mail.gavelling.com address,
 *  otherwise exactly the v15 From. */
function senderFor(row: OutboxRow, displayName: string): string {
  const addr = row.from_address ? cleanAddress(row.from_address).toLowerCase() : "";
  if (addr && EMAIL_RE.test(addr) && addr.endsWith(SENDER_DOMAIN)) {
    const name = (row.from_name ?? "").replace(/[<>"\r\n]/g, "").trim();
    return name ? `${name} <${addr}>` : addr;
  }
  return `${displayName} <${FROM_ADDRESS}>`;
}

/** v19: true when the row carries at least one attachment. */
function hasAttachments(row: OutboxRow): boolean {
  return Array.isArray(row.attachments) && row.attachments.length > 0;
}

/** v19: base64 without a dependency, in chunks so a 10 MB file never blows the stack. */
function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/** v19: a file name safe for an email attachment. */
function attachmentName(a: Attachment): string {
  const raw = (a.file_name ?? "").trim() || a.path.slice(a.path.lastIndexOf("/") + 1) || "attachment";
  return raw.replace(/[\r\n"\\/]/g, "_").slice(0, 200);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (!RESEND_API_KEY) {
    return json({ error: "RESEND_API_KEY secret is not configured" }, 500);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const invocationStarted = Date.now();
  let totalSent = 0;
  let totalFailed = 0;
  let totalInvalid = 0;
  let totalWithAttachments = 0;
  // v19: one download per file per invocation.
  const fileCache = new Map<string, string>();

  try {
    // Sweep: rows stuck in 'sending' (a previous drain died before finishing)
    // return to pending after a grace period so they are never lost.
    await supabase
      .from("email_outbox")
      .update({ status: "pending" })
      .eq("status", "sending")
      .lt("updated_at", new Date(Date.now() - STUCK_SENDING_MINUTES * 60_000).toISOString())
      .select("id");

    for (let batch = 0; batch < MAX_BATCHES_PER_INVOCATION; batch++) {
      const { data: candidates, error: fetchErr } = await supabase
        .from("email_outbox")
        .select("id")
        .eq("status", "pending")
        .or(`send_after.is.null,send_after.lte.${new Date().toISOString()}`)
        .order("created_at", { ascending: true })
        .limit(BATCH_SIZE);

      if (fetchErr) return json({ error: fetchErr.message, sent: totalSent, failed: totalFailed }, 500);
      if (!candidates || candidates.length === 0) break;

      // Atomic claim: only rows still pending flip to 'sending' and come back.
      const { data: claimedRows, error: claimErr } = await supabase
        .from("email_outbox")
        .update({ status: "sending" })
        .in("id", candidates.map((c) => c.id))
        .eq("status", "pending")
        .select("id, conference_id, subject, body, body_html, recipient_email, reply_to, from_name, from_address, attachments, personal");

      if (claimErr) return json({ error: claimErr.message, sent: totalSent, failed: totalFailed }, 500);
      const claimed = (claimedRows ?? []) as OutboxRow[];
      if (claimed.length === 0) continue;

      // v14: quarantine unsendable addresses BEFORE the batch exists.
      // One bad `to` used to take up to 99 innocent emails down with it.
      let sendable: Array<OutboxRow & { to: string }> = [];
      for (const row of claimed) {
        if (!row.recipient_email) {
          await supabase.from("email_outbox").update({
            status: "failed",
            error: "No recipient email on outbox row",
          }).eq("id", row.id);
          totalFailed++;
          continue;
        }
        const to = sendableRecipient(row.recipient_email);
        if (!to) {
          await supabase.from("email_outbox").update({
            status: "failed",
            error: `Invalid recipient address "${row.recipient_email}". Correct it on the applicant record and resend. The rest of this batch was unaffected.`,
          }).eq("id", row.id);
          totalFailed++;
          totalInvalid++;
          continue;
        }
        // v17: well-formed but reserved (example.com and friends).
        if (isPlaceholderDomain(to)) {
          await supabase.from("email_outbox").update({
            status: "failed",
            error: `Invalid recipient address "${to}": placeholder domain or non-ASCII characters, so it can never receive email. The rest of this batch was unaffected.`,
          }).eq("id", row.id);
          totalFailed++;
          totalInvalid++;
          continue;
        }
        sendable.push({ ...row, to });
      }
      if (sendable.length === 0) continue;

      // v15: one round trip mints a per-address unsubscribe token for the whole
      // batch. A failure here must never stop the send -- an email that goes
      // out with the fallback link beats an email that does not go out -- so
      // the map simply stays empty and every row falls back.
      const unsubTokens = new Map<string, string>();
      try {
        const { data: toks } = await supabase.rpc("unsubscribe_tokens_for", {
          p_emails: [...new Set(sendable.map((r) => r.to))],
        });
        for (const t of (toks ?? []) as Array<{ email: string; token: string }>) {
          if (t?.email && t?.token) unsubTokens.set(t.email.toLowerCase(), t.token);
        }
      } catch (_e) {
        // Fallback link only for this batch.
      }

      // v12: NULL conference_id means a platform email. Filtering here is
      // load-bearing -- a NULL inside .in() would 400 the whole lookup and
      // silently de-brand every other conference's email in this batch.
      const confIds = [
        ...new Set(
          sendable
            .map((r) => r.conference_id)
            .filter((id): id is string => typeof id === "string" && id.length > 0),
        ),
      ];
      const confMap = new Map<string, { acronym: string; reply_to: string | null }>();
      if (confIds.length > 0) {
        const { data: confs } = await supabase
          .from("conferences")
          .select("id, acronym, contact_email")
          .in("id", confIds);
        for (const c of confs ?? []) {
          confMap.set(c.id, { acronym: c.acronym, reply_to: firstValidEmail(c.contact_email) });
        }
      }

      const buildItem = (row: OutboxRow & { to: string }, withReplyTo: boolean) => {
        const conf = row.conference_id ? confMap.get(row.conference_id) : undefined;
        const displayName = conf?.acronym ? `${conf.acronym} via Gavelling` : "Gavelling";
        const token = unsubTokens.get(row.to.toLowerCase());
        const unsubUrl = token ? `${SITE_URL}/unsubscribe?t=${token}` : UNSUBSCRIBE_FALLBACK;
        const headers: Record<string, string> = {};
        // v20: a personal one-to-one email carries no list headers at all.
        if (row.personal !== true) {
          headers["List-Unsubscribe"] = `<${unsubUrl}>`;
          // RFC 8058 one-click. Only advertised when the link can actually act on
          // its own -- promising one-click and then serving a login page is what
          // gets a sender marked down.
          if (token) headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
        }
        const item: Record<string, unknown> = {
          from: senderFor(row, displayName),
          to: [row.to],
          subject: row.subject,
          html: row.body_html || `<pre style=\"font-family:Georgia,serif;white-space:pre-wrap\">${escapeHtml(row.body)}</pre>`,
          text: row.body,
          headers,
        };
        // v12: an explicit per-row reply_to wins over the conference default.
        const replyTo = firstValidEmail(row.reply_to) ?? conf?.reply_to ?? null;
        if (withReplyTo && replyTo) item.reply_to = replyTo;
        return item;
      };

      // v19: rows with attachments go alone through POST /emails, BEFORE the
      // batch, so the batch path below only ever sees rows without attachments.
      const attachmentRows = sendable.filter(hasAttachments);
      if (attachmentRows.length > 0) {
        sendable = sendable.filter((r) => !hasAttachments(r));
        let stop = false;
        for (let i = 0; i < attachmentRows.length; i++) {
          const row = attachmentRows[i];
          if (stop || Date.now() - invocationStarted > ATTACH_BUDGET_MS) {
            stop = true;
            await supabase.from("email_outbox").update({ status: "pending" }).eq("id", row.id).eq("status", "sending");
            continue;
          }
          if (i > 0) await sleep(SINGLE_RESEND_GAP_MS);

          // Read every file (service role, private bucket), cached per invocation.
          const files: Array<{ filename: string; content: string }> = [];
          let readErr = "";
          let total = 0;
          for (const a of row.attachments ?? []) {
            const key = `${a.bucket}/${a.path}`;
            let content = fileCache.get(key);
            if (content === undefined) {
              const { data: blob, error: dlErr } = await supabase.storage.from(a.bucket).download(a.path);
              if (dlErr || !blob) {
                readErr = `Attachment "${attachmentName(a)}" could not be read (${dlErr?.message ?? "no file"}). Attach it again and resend.`;
                break;
              }
              const bytes = new Uint8Array(await blob.arrayBuffer());
              total += bytes.length;
              content = toBase64(bytes);
              fileCache.set(key, content);
            } else {
              total += Math.floor((content.length * 3) / 4);
            }
            files.push({ filename: attachmentName(a), content });
          }
          if (!readErr && total > ATTACH_MAX_TOTAL_BYTES) {
            readErr = "The attachments are over 10 MB in total. Send fewer or smaller files.";
          }
          if (readErr) {
            await supabase.from("email_outbox").update({ status: "failed", error: readErr }).eq("id", row.id);
            totalFailed++;
            continue;
          }

          const postOne = (withReplyTo: boolean) => fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${RESEND_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ ...buildItem(row, withReplyTo), attachments: files }),
          });

          let one = await postOne(true);
          let oneErr = "";
          if (!one.ok && one.status !== 429) {
            oneErr = await one.text();
            if (!/`to`/.test(oneErr)) {
              await sleep(SINGLE_RESEND_GAP_MS);
              one = await postOne(false);
            }
          }
          if (one.status === 429) {
            stop = true;
            await supabase.from("email_outbox").update({ status: "pending" }).eq("id", row.id).eq("status", "sending");
            continue;
          }
          if (!one.ok) {
            const txt = one.bodyUsed ? oneErr : `${oneErr} | retry without reply_to: ${await one.text()}`;
            const addressLevel = one.status === 422 && /`to`|\bto\b field|recipient|example\.com/i.test(txt);
            await supabase.from("email_outbox").update({
              status: "failed",
              error: addressLevel
                ? `Invalid recipient address "${row.to}": Resend refused it (${one.status}): ${txt.slice(0, 400)}`
                : `Resend error ${one.status} (email with attachments): ${txt.slice(0, 450)}`,
            }).eq("id", row.id);
            totalFailed++;
            if (addressLevel) totalInvalid++;
            continue;
          }
          const oneJson = await one.json();
          const resendId = oneJson?.id ?? null;
          if (resendId) {
            await supabase.from("email_outbox").update({
              status: "sent",
              sent_at: new Date().toISOString(),
              resend_id: resendId,
              error: null,
            }).eq("id", row.id);
            totalSent++;
            totalWithAttachments++;
          } else {
            await supabase.from("email_outbox").update({
              status: "failed",
              error: "No id returned by Resend for this email",
            }).eq("id", row.id);
            totalFailed++;
          }
        }
        if (stop) {
          // Out of budget or rate-limited: hand the plain rows back too; the next drain continues.
          for (const row of sendable) {
            await supabase.from("email_outbox").update({ status: "pending" }).eq("id", row.id).eq("status", "sending");
          }
          break;
        }
        if (sendable.length === 0) {
          if (candidates.length < BATCH_SIZE) break;
          continue;
        }
      }

      const buildPayload = (withReplyTo: boolean) => sendable.map((row) => buildItem(row, withReplyTo));

      const post = (body: unknown) => fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      let res = await post(buildPayload(true));
      let errText = "";

      // One optional field must never cost a whole batch of real emails.
      // Retry without reply_to before giving up on anyone.
      if (!res.ok && res.status !== 429) {
        errText = await res.text();
        res = await post(buildPayload(false));
      }

      const now = new Date().toISOString();

      // v17: a 422 that survives the reply_to retry is a validation error on
      // SOME item. Send each row alone so only the guilty row fails.
      if (!res.ok && res.status === 422) {
        const batchErr = `${errText} | retry without reply_to: ${await res.text()}`;
        let rateLimited = false;
        const splitStarted = Date.now();
        for (let i = 0; i < sendable.length; i++) {
          const row = sendable[i];
          if (rateLimited) {
            // Hand the rest back untouched; the next drain picks them up.
            await supabase.from("email_outbox").update({ status: "pending" }).eq("id", row.id).eq("status", "sending");
            continue;
          }
          if (Date.now() - splitStarted > SPLIT_BUDGET_MS) {
            // Out of wall-clock budget: hand the rest back for the next drain.
            await supabase.from("email_outbox").update({ status: "pending" }).eq("id", row.id).eq("status", "sending");
            continue;
          }
          if (i > 0) await sleep(SINGLE_RESEND_GAP_MS);
          let one = await post([buildItem(row, true)]);
          let oneErr = "";
          if (!one.ok && one.status !== 429) {
            oneErr = await one.text();
            // Only an error that is NOT about the address earns a retry without reply_to.
            if (!/`to`/.test(oneErr)) {
              await sleep(SINGLE_RESEND_GAP_MS);
              one = await post([buildItem(row, false)]);
            }
          }
          if (one.status === 429) {
            rateLimited = true;
            await supabase.from("email_outbox").update({ status: "pending" }).eq("id", row.id).eq("status", "sending");
            continue;
          }
          if (!one.ok) {
            const txt = one.bodyUsed ? oneErr : `${oneErr} | retry without reply_to: ${await one.text()}`;
            const addressLevel = one.status === 422 && /`to`|\bto\b field|recipient|example\.com/i.test(txt);
            await supabase.from("email_outbox").update({
              status: "failed",
              error: addressLevel
                ? `Invalid recipient address "${row.to}": Resend refused it when sent alone (${one.status}): ${txt.slice(0, 400)}`
                : `Resend error ${one.status} (sent alone after batch 422): ${txt.slice(0, 450)}`,
            }).eq("id", row.id);
            totalFailed++;
            if (addressLevel) totalInvalid++;
            continue;
          }
          const oneJson = await one.json();
          const resendId = oneJson?.data?.[0]?.id ?? null;
          if (resendId) {
            await supabase.from("email_outbox").update({
              status: "sent",
              sent_at: new Date().toISOString(),
              resend_id: resendId,
              error: null,
            }).eq("id", row.id);
            totalSent++;
          } else {
            await supabase.from("email_outbox").update({
              status: "failed",
              error: "No id returned by Resend for this item",
            }).eq("id", row.id);
            totalFailed++;
          }
        }
        console.warn(`send-emails: batch 422 split into single sends: ${batchErr.slice(0, 300)}`);
        // The one-at-a-time pass is slow; stop here and let the next drain continue.
        break;
      }

      if (!res.ok) {
        const finalErr = res.status === 429 ? await res.text() : `${errText} | retry without reply_to: ${await res.text()}`;
        const ids = sendable.map((r) => r.id);
        await supabase.from("email_outbox").update({
          status: "failed",
          error: `Resend batch error ${res.status}: ${finalErr.slice(0, 500)}`,
        }).in("id", ids);
        totalFailed += ids.length;
        if (res.status === 429) break;
        continue;
      }

      const result = await res.json();
      const items: Array<{ id?: string }> = result?.data ?? [];

      for (let i = 0; i < sendable.length; i++) {
        const row = sendable[i];
        const resendId = items[i]?.id ?? null;
        if (resendId) {
          await supabase.from("email_outbox").update({
            status: "sent",
            sent_at: now,
            resend_id: resendId,
            error: null,
          }).eq("id", row.id);
          totalSent++;
        } else {
          await supabase.from("email_outbox").update({
            status: "failed",
            error: "No id returned by Resend for this item",
          }).eq("id", row.id);
          totalFailed++;
        }
      }

      if (candidates.length < BATCH_SIZE) break;
    }
  } catch (e) {
    return json({ error: String(e), sent: totalSent, failed: totalFailed }, 500);
  }

  return json({ ok: true, sent: totalSent, failed: totalFailed, invalidAddresses: totalInvalid, withAttachments: totalWithAttachments });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;", ).replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
