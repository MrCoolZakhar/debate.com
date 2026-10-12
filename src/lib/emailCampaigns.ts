// Email campaigns (newsletters): the shapes the /r click route and the admin
// card share. The database side is scratch-email-campaigns.sql (email_campaigns,
// email_campaign_recipients, email_campaign_clicks, record_campaign_click,
// admin_email_campaigns, admin_email_campaign_report). CLAUDE.md §6.

/** A recipient's click token: 128 random bits as 32 hex characters (the
 *  database accepts 16 to 64 of [A-Za-z0-9_-], so this stays in step). */
export const CLICK_TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;

/** A link key from the edition's `links` map. */
export const LINK_KEY_RE = /^[a-z0-9-]{1,40}$/;

/** User agents that are not a person. The same list /api/conference-view uses;
 *  a link scanner or preview fetcher is redirected but never counted. */
export const BOT_UA = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|quora link|whatsapp|telegrambot|discordbot|headless|lighthouse|pingdom|monitor|curl|wget|python-requests|httpclient|axios|node-fetch|go-http/i;

export const SITE = 'https://gavelling.com';

/** Only ever redirect to our own site: an https://gavelling.com URL or a path
 *  on it. Anything else (another host, javascript:, //evil) goes home. */
export function safeCampaignDestination(raw: unknown): string {
  if (typeof raw !== 'string' || !raw) return SITE;
  if (raw.startsWith('/') && !raw.startsWith('//') && !raw.startsWith('/\\')) return SITE + raw;
  try {
    const u = new URL(raw);
    if (u.protocol === 'https:' && u.hostname === 'gavelling.com' && !u.username && !u.password) return u.toString();
  } catch { /* fall through */ }
  return SITE;
}

export interface CampaignListItem {
  slug: string;
  subject: string;
  created_at: string;
  started_at: string | null;
  paused_at: string | null;
  finished_at: string | null;
  queued: number;
}

export interface CampaignReport {
  found: boolean;
  campaign: {
    slug: string; subject: string; per_run: number; created_at: string;
    started_at: string | null; paused_at: string | null; finished_at: string | null;
  };
  queued: number;
  delivery: { sent: number; failed: number; suppressed: number; in_flight: number; other: number };
  clicks: {
    unique_clickers: number;
    total: number;
    by_link: { key: string; url: string; clicks: number; clickers: number }[];
  };
  conversions: {
    window_days: number;
    baseline_days: number;
    reached: number;
    window_open: number;
    clickers: { n: number; converted: number };
    non_clickers: { n: number; converted: number };
    by_action: { action: string; label: string; clickers: number; non_clickers: number }[] | null;
    signed_in_since: { clickers: number; non_clickers: number };
  };
}
