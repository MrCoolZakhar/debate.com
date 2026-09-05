# GAVELLING CONFERENCES — PRODUCT REQUIREMENTS DOCUMENT
**Version 1.2 — May 2026**
**Owner: Christian | Co-developer: Peter**
**Target Launch: As soon as possible. Full throttle.**

---

## OVERVIEW

Gavelling Conferences is the second major product layer of Gavelling.com. Sessions (free, anonymous committee management) remains unchanged. Conferences adds accounts, a public conference directory, organizer management tools, delegate registration, payments, and deep integration between the directory and live session management.

The core strategic position: **mymun is a directory with a registration bolt-on. Gavelling is a professional conference management platform with a discovery layer.** We win on automation, modern UX, document management, a job board for chairs and staff, and a fee model that is transparently better for organizers.

---

## TECH STACK ADDITIONS

| Addition | Choice | Reason |
|----------|--------|--------|
| Auth | Supabase Auth | Already in stack. Supports Google OAuth, email/password natively. |
| Payments | Stripe | Best global coverage, excellent Next.js integration, handles fee-on-top model cleanly. Stripe Connect for organizer payouts. |
| Email | Resend or SendGrid | Transactional email. Pairs with Supabase Auth triggers. |

---

## PART 1 — ACCOUNTS & AUTH

### 1.1 Account System

- **Supabase Auth** handles all authentication
- Sign in options: **Google OAuth** (primary), email/password (fallback)
- Single account type — role is determined by context (organizer of X, delegate at Y)
- User profile stores: display name, email, nationality, MUN experience level, Gavelling Unlimited subscription status, Gavelling Points balance, conference calendar, MUN CV entries

### 1.2 Sessions vs. Conferences — Account Requirements

| Feature | Account Required? |
|---------|------------------|
| Create a free anonymous session | No — stays fully anonymous |
| Join a free anonymous session | No — current flow unchanged |
| Create a conference | Yes |
| Join a conference-linked session | Yes — prompted to sign in if not authenticated |
| View conference listings | No |
| Apply to a conference | Yes |

**Key rule:** Anonymous sessions stay exactly as they are. Accounts are only required when a session is linked to a conference. If someone enters a conference-session code without being signed in, they are prompted to sign in before proceeding.

### 1.3 Legacy Sessions

Existing anonymous committees are not affected. They expire per existing deletion rules (36h suspended, 24h inactive). No migration or claiming mechanism needed.

### 1.4 Gavelling Unlimited

Subscription product managed via Stripe Subscriptions, status synced to user profile in Supabase.

| Plan | Displayed Price | Actual Charge | Marketing Note |
|------|----------------|--------------|----------------|
| Monthly | £5/month | £5/month | — |
| Annual | ~~£60/year~~ **£45/year** | £45/year | Show as 25% off — saving £15 vs monthly. MUN season is Oct–May so annual feels like full season coverage. |

**Benefits (exactly these, no others):**
- Conference registration Gavelling surcharge waived (Stripe fee still applies)
- Session Archive — save and revisit past sessions
- Downloadable MUN CV / awards PDF export
- Full conference history stats dashboard
- Early access to new Gavelling features

---

## PART 2 — SITE LAYOUT FOR CONFERENCES

### 2.1 Landing Page (`/`)

The conferences section of the landing page replaces the current "coming soon" placeholder (where Gavin the otter currently lives). It contains four parts:

1. **Highlighted/Featured Conferences** — curated spotlight cards for notable upcoming conferences
2. **MUN Across the World** — interactive globe showing where conferences are happening geographically
3. **Find a Role** — entry point for the Chair & Staff Job Board (see Part 14). For people looking to chair, join secretariat, or volunteer at conferences.
4. **Organise a Conference** — CTA section for organizers to create their conference fee-free on Gavelling

The "Explore Conferences" button (or equivalent CTA) takes users to `/conferences`.

### 2.2 Conferences Discovery Page (`/conferences`)

Full conference directory. Accessed from the landing page CTA.

**Layout:**
- **Top bar:** Filters sit at the TOP — NOT a left sidebar. Toggleable (collapsed by default, expand on click). Clean and modern.
- **Main area:** Conference cards grid below the filter bar

**Filters (top bar, toggleable):**
- Free text search
- Type: In-Person / Online / Hybrid
- Continent: Europe, North America, South America, Asia, Africa, Oceania, Online
- Month (multi-select)
- Level: School / University / Both
- Fee range slider
- Toggles: Applications Open, Chair Applications Open

**Conference card shows:**
- Conference logo
- Full name + acronym
- Location (city, country + rectangular flag per design system)
- Date range
- Expected delegate count
- Fee with currency
- "Applications Open" / "Closed" status pill
- Verified badge (future feature)

**Not on cards:** No ratings. No award badges. No "Best Academics" or similar. These features are not approved.

### 2.3 Private vs. Public Conferences

Conferences have a **Public / Private** toggle in their settings.

- **Public:** Listed on `/conferences`, discoverable by anyone
- **Private:** NOT listed on `/conferences`. Accessible only via direct link (`/conferences/[slug]`)

**How private conferences are accessed:**
Organizer shares the direct URL manually (email, WhatsApp, etc.). The conference detail page is accessible to anyone with the link even if not publicly listed. Supports organizers setting up before go-live AND private/internal sims.

**Viewing your own conferences:**
Signed-in organizers on `/conferences` have a **"Your Conferences"** toggle showing all their own conferences (including private ones) separately from the public directory.

---

## PART 3 — CONFERENCE CREATION

### 3.1 Two-Step Creation Flow

Conference created as **Private** by default. Organizer manually publishes when ready.

**Step 1 — The Basics (all required):**
- Full conference name
- Short name / acronym
  - Minimum 4 characters
  - **Must include "MUN"** — if not, inline error: *"Your conference acronym must include 'MUN' (e.g. TEIMUN, LIMUN, SMUNC)."*
- Organizer contact email (can differ from account email)
- Student level: School / University / Both
- Start date / End date
- Country + City
- Format: In-Person / Online / Hybrid
- Expected delegate count
- Conference fee (with currency selector — can be £0 for free conferences)

**Step 2 — Optional (editable later):**
- Conference logo upload (images compressed to WebP server-side, max 400px)
- Hero banner image (compressed to WebP, max 1200px)
- Conference description (rich text editor)
- Social media links (Instagram, Facebook, TikTok, WhatsApp, Website)
- Terms & Conditions upload (PDF, 5MB max)

On submit → conference created as Private → organizer taken to their dashboard.

---

## PART 4 — ORGANIZER DASHBOARD

### 4.1 Dashboard Home (`/manage/[conferenceSlug]`)

**Shows:**
- Setup progress checklist: Add Committees → Configure Applications → Setup Payments → Publish Conference
- Key stats: total applications, accepted, assigned, paid — per role
- Income: last week, total
- Applications over time (line chart: submitted / accepted / assigned / paid)
- Geographic map of delegate origins (filterable by status)
- Recent activity feed

### 4.2 Navigation Structure

```
Conference Menu
├── Dashboard
├── Page (edit public listing)
├── Committees
├── Applications
│   ├── To Do (action queue)
│   ├── Participants (full list)
│   ├── Assignment (smart assignment UI)
│   └── Invitations
├── Documents
│   ├── Study Guides
│   └── Position Papers
├── Communications
│   ├── Email Builder
│   └── Sent History
├── Financials
│   ├── Transactions
│   └── Settings
├── Settings
│   ├── Conference Details
│   ├── Application Windows & Roles
│   ├── Organizers (team management)
│   └── Privacy & Publishing
├── Chair & Staff Board
└── Post Conference
    └── Awards
```

### 4.3 Committee Management

**Per committee:**
- Name, abbreviation
- Topic(s) — up to 3, minimum 1
- Difficulty: Beginner / Intermediate / Advanced / Expert
- Committee type: General Assembly / Security Council / Specialised / Crisis / etc.
- Total delegate spots
- Chair assignment — link Gavelling accounts (chairs invited by email)
- Country/portfolio allocation — full UN member list with rectangular flags via `getFlagUrl()` / `countries.ts`
- Delegation size per country (1 or 2-person)

**Session code generation:** Each committee generates a unique session code. Delegates use this to join that committee's live session. The code is account-locked — delegates can only join as their allocated country.

### 4.4 Application Windows & Role Configuration

Per role (Delegates, Chairs, Head Delegates, Faculty Advisors, Observers):
- **Enable / disable the role** — conferences choose which roles they accept
- Open date / Close date for applications
- Max applications to accept
- **Fee for this role** — different roles can have different fees (e.g. Chairs free, Delegates £100, Observers £50)
- Auto-accept toggle (automatic vs. manual approval)
- **Pay at application** toggle — if on, delegate pays during application. If off, organizer can set "must pay before allocation" rule
- Custom questions per role

### 4.5 Smart Delegate Assignment UI

Key differentiator over the industry standard's manual country matrix.

**Flow:**
1. Organizer opens Assignment view for a committee
2. Left panel: unassigned applicants with preferences, experience level, and fit score per available slot
3. Right panel: committee country slots (filled / unfilled)
4. Actions: drag applicant onto slot, or "Auto-suggest" to pre-fill based on preferences + experience + capacity
5. Bulk: auto-assign all, clear all, export

**Fit score logic:**
- First preference match → high score
- Second/third preference match → medium score
- Experience level matches committee difficulty → bonus
- Committee nearing capacity → urgency indicator

**Sending allocations:**
- Assignment does NOT auto-send email
- Organizer controls when emails go out
- Per-delegate: **"Send Allocation"** button
- Per-committee: **"Send All Allocations"** button
- Allocation email contains: country assignment, committee session code, conference details

---

## PART 5 — DELEGATE REGISTRATION

### 5.1 Application Flow

**Step 1 — Role selection:**
Dropdown: *"What role are you applying as?"*
Only enabled roles appear. Each role shows its fee if applicable.

**Step 2 — Society or Independent:**
- Toggle: **Society / Independent**
- If Society: type society/school name — autocomplete from existing entries (case-insensitive deduplication). First to type a new name creates it; subsequent delegates from the same society get auto-suggested.
- If Independent: no society field. Independent delegates cannot apply as Head Delegate.

**Head Delegate rules:**
- Available only to Society applicants
- Checkbox: *"I am applying as Head Delegate for my society"*
- Head Delegate slots per society are capped (conference-configurable)
- Once cap is filled, no more head delegate applications from that society accepted
- Head Delegate uses the same delegate flow — same preferences, same fee

**Step 3 — Committee & Country Preferences:**
- Minimum N preferences required (N set by organizer, default 3)
- Per preference: choose committee (difficulty, topics, spots remaining) → choose country (filtered to that committee, shown with flags)
- Can add preferences beyond minimum
- Draft saved automatically

**Step 4 — Experience & Questions:**
- MUN experience level (auto-populated from account history if available)
- Custom questions set by organizer for this role

**Step 5 — Review & Submit**

**Application states:** Submitted → Accepted → Assigned → Checked In

### 5.2 Auto-Accept Conferences

If organizer enables auto-accept for a role, applications move directly Submitted → Accepted. Manual-review conferences require organizer action in the To Do queue.

### 5.3 Payment Timing

Configured per conference:
- **Pay at application** — delegate pays during application flow
- **Pay after acceptance** — delegate receives acceptance then pays
- **Must pay before allocation** — organizer blocks country assignment for unpaid delegates

---

## PART 6 — SESSION–CONFERENCE INTEGRATION

### 6.1 Conference-Linked Sessions

Each conference committee has a generated session code.

**Joining flow:**
1. Delegate enters code at `/join`
2. If not signed in → prompted to sign in
3. System checks: is this account assigned to this committee?
4. If yes → joins as their allocated country automatically
5. If no → access denied with message: *"It appears your account is not linked to an assigned member of this committee. Please check your allocation or contact your conference organizers."*

**Security unlocked:**
- No impersonation — delegates cannot join as a country they're not assigned
- Chat messages tied to real accounts
- Post-session data saved to delegate profile

### 6.2 Organizer Session Overview

Organizers see live status of all committee sessions: active/inactive, delegates joined, current phase. Read-only.

### 6.3 Supabase Capacity Note

Pre-creating conference committee sessions is not a concern. A committee row is ~1–2KB. Even 10,000 pre-created committees is ~20MB — negligible. Inactive deletion rules clean up unused ones.

---

## PART 7 — AWARDS

### 7.1 Scope

Awards only apply to **conference-linked sessions**. No award UI in anonymous sessions.

### 7.2 Chair Award Assignment

**Built (September 2026).** Chairs decide, the secretariat ratifies, the conference publishes.

- The organiser configures the categories in Settings → Awards: Best Delegate, Outstanding Delegate, Honourable Mention, Best Position Paper on by default; Verbal Commendation, Best Delegation and Best Small Delegation off by default; custom awards per conference. Each category has a per-committee quota and a points value. The organiser also sets the chair deadline (default: conference end date) and whether the secretariat must approve each slate.
- After their last session, chairs nominate from their own conference page (the Awards card), with the committee's session scoreboard beside the slots as evidence, and submit the slate. A "Suggest from the record" action pre-fills empty slots from the blended score; the chair always edits.
- The secretariat reviews every committee at Manage → Awards: approve, return with a note, edit, and assign delegation awards from the tallied standings. Publishing is the ceremony.
- On publish, each award becomes a verified entry (`source = 'gavelling_verified'`) on the recipient's MUN CV, the delegate is emailed, and the public honour roll at `/conferences/[slug]/awards` goes live. Nominations are never visible to delegates before publication.
- "Best Speaker" from the original list was not built as a default; organisers can add it as a custom award.

### 7.3 Gavelling Points for Awards

Delegates receiving awards in paid conference sessions automatically receive Gavelling Points (see Part 15). Implemented in `publish_conference_awards()`: points per category come from the awards config, and mint only when any delegate role at the conference carries a fee.

---

## PART 8 — DOCUMENTS

### 8.1 Study Guides

- Organizers upload per committee (PDF only)
- **5MB max file size** — enforced at the browser before upload, clear error shown if exceeded
- Visibility: Private (draft) or Published
- On publish: email sent to assigned delegates — *"[Conference] [Committee] Study Guide is now available."* Links to Gavelling, not an attachment
- Delegates download from their conference dashboard

### 8.2 Position Papers

**Submission (delegate):**
- Deadline set by organizer per committee (countdown shown)
- Upload PDF only
- **5MB max file size** — enforced at the browser before upload
- On submission: prompt asks *"Would you like to receive an email confirmation and notifications when your position paper receives feedback?"* — opt-in only
- Status: Not Submitted / Submitted / Reviewed / Approved / Rejected

**Review (chair):**
- Chairs see all position papers for their committee
- Mark Reviewed / Approved / Rejected
- Type written feedback directly in Gavelling
- Chairs configure which email receives new submission notifications (defaults to account email, easily changed — supports a dedicated committee email)
- On feedback submitted: delegate receives **in-app notification**. Email notification only if delegate opted in.

---

## PART 9 — COMMUNICATIONS

### 9.1 Email Builder

Organizers compose and send emails to any participant subset.

**Audience segmentation:** All participants, by role, by committee, by status (submitted / accepted / assigned / paid / unpaid)

**Composer:** Subject line, rich text body, preview, send test email, scheduled send

Emails go to participants' Gavelling account email addresses.

### 9.2 Automated Email Triggers

| Trigger | Recipient | Notes |
|---------|-----------|-------|
| Application submitted | Delegate | Only if opted in |
| Application accepted | Delegate | |
| Application rejected | Delegate | Organizer can add note |
| Allocation sent by organizer | Delegate | Triggered manually — per delegate or Send All per committee |
| Position paper submitted | Chair (at configured email) | |
| Position paper feedback given | Delegate | Only if opted in |
| Study guide published | Assigned delegates in committee | |
| Payment confirmed | Delegate | Receipt |
| Conference in 7 days | All assigned delegates | Reminder + session code |

Position paper status change does NOT trigger automated email. In-app notification only, email only if opted in.

### 9.3 Email & Notification Privacy

- Users can opt out of newsletter / marketing emails in account settings
- Users can opt out of notification emails in account settings
- When opted out, contextual prompts appear at key moments: *"Would you like to be notified via email when [X happens]?"* — opt-in per event type
- Opting out of email notifications does not affect in-app notifications

---

## PART 10 — PAYMENTS

### 10.1 Fee Model

**Organizers pay nothing.** Gavelling is completely free for organizers.

**Delegates pay:**
- Conference fee (set by organizer — goes to organizer in full)
- **Stripe processing fee** — passed to delegate (standard Stripe rate ~1.4–2.9% by card/region)
- **Gavelling 5% surcharge** — for delegates without Gavelling Unlimited only

**Example (no Unlimited):**
Conference fee £100 → delegate pays ~£106.54 (£5 Gavelling surcharge + ~£1.54 Stripe fee)
Organizer receives: £100

**Example (with Unlimited):**
Conference fee £100 → delegate pays ~£101.54 (Stripe fee only, no Gavelling surcharge)
Organizer receives: £100

Unlimited subscribers always pay the Stripe processing fee. Only Gavelling's 5% is waived.

### 10.2 Stripe Integration

- **Stripe Connect** — organizers onboard their own Stripe account. Payouts go direct to organizer. Gavelling takes 5% via application fees.
- **Stripe Subscriptions** — for Gavelling Unlimited billing
- Payment methods: card, Apple Pay, Google Pay (Stripe handles regionally)
- Refunds: organizer initiates from Gavelling financial dashboard, processed via Stripe

### 10.3 Financial Dashboard (Organizer)

- Total income collected, income this week
- Per-delegate payment status (paid / unpaid / refunded)
- Export transactions CSV
- Refund initiation per delegate

---

## PART 11 — PRICING SUMMARY

| Who | What | Cost |
|-----|------|------|
| Organizer | List conference | Free |
| Organizer | All management features | Free |
| Organizer | Stripe processing | Standard Stripe rate |
| Delegate (no Unlimited) | Registration | Conference fee + 5% Gavelling surcharge + Stripe fee |
| Delegate (Unlimited) | Registration | Conference fee + Stripe fee only |
| Delegate | Gavelling Unlimited Monthly | £5/month |
| Delegate | Gavelling Unlimited Annual | Marketed as ~~£60/year~~ → **£45/year (25% off)** |

---

## PART 12 — MUN CV & DELEGATE PROFILE

### 12.1 MUN CV

Every Gavelling account has a MUN CV. Entries added two ways:

**Automatic (conference-linked sessions):**
Committee, country, conference name, and awards automatically added when participating in a verified conference session.

**Manual entry:**
Delegates add past conferences with these fields (all required):
- Conference name
- Committee
- Country / Portfolio / Allocation
- Expertise / difficulty level
- Award received — required field, with **"None"** as a selectable option

Manual entries are labeled as self-reported (not verified by Gavelling).

### 12.2 MUN CV Export

Unlimited feature. Full MUN CV exported as formatted PDF.

---

## PART 13 — CONFERENCE CALENDAR

Under user profile: calendar showing all conferences the delegate is registered for (accepted or assigned). Shows conference name, dates, and committee per block.

**Overlap warning:** If a delegate applies to a conference whose dates overlap with one they're already assigned to, the system warns: *"You appear to already be attending [Conference] during these dates. Are you sure you want to apply?"* — warning only, not a hard block.

---

## PART 14 — CHAIR & STAFF JOB BOARD

A section where individuals find chair, secretariat, or volunteer opportunities — and where conferences post that they are looking for staff.

### 14.1 For Individuals

- Browse open positions across conferences
- Filter by: role type, conference level, location, date
- Apply through Gavelling (application linked to their Gavelling profile / MUN CV)
- Organizer receives application in their dashboard

### 14.2 For Conferences

- Organizers post open positions from their conference dashboard
- Per posting: role type (from categories below), committee (if applicable), requirements, deadline, compensation (paid/unpaid/travel covered)
- Manage applications alongside delegate applications

### 14.3 Role Categories

Role types are divided into three editable categories. Conferences can customise which roles they post within each category.

**Chairs:**
Chair, Co-Chair, Director, Assistant Director, Rapporteur

**Secretariat:**
Secretary-General, Deputy Secretary-General, Under-Secretary-General, Chief of Staff, Spokesperson

**Staff:**
Page, Logistics Volunteer, IT / Technical Volunteer, Press Corps, Social Media, Registration Staff

All role names within each category are editable by the organizer when creating a posting.

---

## PART 15 — GAVELLING POINTS

### 15.1 Overview

Gavelling Points is a single unified currency. Points are earned through participation and can also be purchased directly. There is no separate "Credits" system — buying points is simply another way to acquire the same Points.

### 15.2 Earning Points

| Action | Notes |
|--------|-------|
| Participating in a paid conference session (assigned + attended) | Small amount — exact values TBD |
| Receiving an award at a paid conference | Small bonus — exact values TBD |

Points awarded automatically when: conference is paid (fee > 0), session was conference-linked and account-verified, award assigned by chair.

Points NOT awarded for: free conferences, anonymous sessions, self-reported MUN CV entries.

### 15.3 Buying Points

Points can be purchased directly in packages (e.g. £10 = 100 Points). Exact package pricing TBD.

### 15.4 Spending Points

- Gavelling merchandise (future Gavelling Shop)
- Conference fee discounts or waivers
- Gavelling Courses (future product)

---

## PART 16 — COMPETITIVE POSITIONING

| Feature | Industry Standard | Gavelling |
|---------|------------------|-----------|
| Conference listing | Free | Free |
| Organizer management tools | Free | Free |
| Platform fee | 5–7% from organizer | 0% from organizer |
| Delegate surcharge | Baked in (opaque) | Transparent: 5% (or £0 with Unlimited) + Stripe fee |
| Session management | Separate paid product | Native, included, best-in-class |
| Document portal | None on main platform | Native — study guides + position papers with workflow |
| Automated emails | Basic | Full builder + smart triggers |
| Delegate assignment | Manual country matrix | Smart assignment with fit scores + auto-suggest |
| Position paper workflow | Handled via email / Google Drive | Fully in-platform with feedback and notifications |
| Awards & MUN CV | Yes | Yes (conference-linked, account-verified) |
| Chair & staff job board | Reportedly broken / invisible | First-class feature |
| Conference calendar | No | Yes, with overlap warnings |
| Gavelling Points / rewards | No | Yes |
| Account-verified session security | No | Yes — delegates locked to allocated country |
| Society/delegation management | Fragmented | Standardized with deduplication and head delegate logic |
| Mobile UI | Desktop-first | Mobile-first throughout |

---

## DEVELOPMENT RULES

1. **Sessions remain free and anonymous.** No account requirements added to existing sessions flow.
2. **Conference-session security is account-enforced.** Never allow a delegate to join a conference-linked session without being authenticated and verified against their assignment.
3. **5% Gavelling surcharge is charged to delegate, never organizer.**
4. **Stripe fee is always passed to delegate** — even for Unlimited subscribers. Only the Gavelling 5% is waived for Unlimited.
5. **Unlimited status is server-enforced.** Always verify against Supabase before waiving surcharge.
6. **Private conferences never appear in `/conferences` listing.**
7. **Allocation emails are never automatic.** Always triggered manually by organizer.
8. **Awards only on conference-linked sessions.** Hard-gate — no award UI in anonymous sessions.
9. **Society name deduplication is case-insensitive.**
10. **Acronym must include "MUN".** Inline error, not a hard block.
11. **Conference ratings and award badges are not in scope.** Do not build or reference these.
12. **Gavelling Points and purchased Points are the same currency.** There is no separate Credits system.
13. **All design follows Gavelling design system** — Outfit font, #EDE7D8 ivory, #1B3828 forest, #EED98A gold, DM Mono for codes/stats. No Bootstrap. No emoji icons. Rectangular flags only.
14. **PDFs are stored as-is.** PDFs are already internally compressed — recompressing saves nothing and adds latency. Enforce a strict 5MB limit at the browser. Reject at upload, never after.
15. **Images (logos, banners, avatars) are compressed to WebP on the server before storage.** Conference logos → max 400px, ~80KB target. Banners → max 1200px, ~200KB target. Avatars → max 200px, ~30KB target. Browsers serve WebP natively — no decompression needed. This converts typical 2–5MB PNG uploads into under 200KB automatically.
16. **File size limits are enforced client-side first, server-side second.** Never trust the client alone. Supabase storage policies must also enforce limits as a hard backstop.
