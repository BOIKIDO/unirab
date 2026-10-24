# AI Visibility Grader — System Documentation

How the product actually works: every route, every background process, every table, every external service.

This document reflects the code as of the current working tree, not the older notes in `docs/`.

---

## 1. What the system does

A contractor enters their business name. The app:

1. Finds the business in Google Places and scrapes its site/reviews to infer the services it sells.
2. Runs `2 × keywords + 2` prompts against **ChatGPT (gpt-4o-search-preview)** and the same against **Gemini 2.5 Flash with Google Search grounding**, at both city and state level.
3. Parses every AI response with **DeepSeek** to extract (a) whether the target business was named, (b) its rank, and (c) every competitor named, in order.
4. Scores visibility 0–100, aggregates the top 10 competitors, verifies them against Google Places, and pre-generates a narrative + recommendations.
5. Puts an email capture in front of the report (the progress page will not navigate forward without it), emails the report, and enrolls the lead in a 5-day sequence.
6. Deletes data on a two-tier retention schedule.

That is the whole business model: the scan is the lead magnet, the report is the pitch, the sequence is the nurture, the Calendly link is the close.

---

## 2. Stack and external services

| Layer | Technology | Used for |
|---|---|---|
| Framework | Next.js 16.2.6 (App Router), React 19.2.4, TypeScript | UI + API routes |
| Styling | Tailwind CSS v4, shadcn/Radix, Phosphor icons | Landing, progress, report |
| Database | Supabase Postgres (`@supabase/supabase-js`) | Jobs, results, competitors, leads |
| Background dispatch | Upstash QStash | Prod-only trigger for the scan worker |
| Rate limiting | Upstash Redis (`Redis.fromEnv()`) | `/api/lookup` only |
| Email | Resend | Report email + 5-day sequence |
| ChatGPT lane | OpenAI `gpt-4o-search-preview` | Web-grounded AI answers |
| Gemini lane | `gemini-2.5-flash` + Google Search grounding | Web-grounded AI answers |
| Analysis lane | DeepSeek `deepseek-v4-pro` (JSON mode) | Mention/competitor extraction, insights, description |
| Business data | Google Places API (Autocomplete, Details, Text Search) | Lookup, city/state, competitor verification |
| CRM | GoHighLevel webhook (`GHL_WEBHOOK_URL`) | Lead sync |
| Scheduling | Vercel Cron (`vercel.json`) | Cleanup + sequence ticking |
| Booking | Calendly (`NEXT_PUBLIC_CALENDLY_URL`) | Every CTA |

No auth system, no user accounts, no queue table. Job IDs are the only identifiers.

---

## 3. Runtime topology

```
Browser
  │
  ├── /                         landing (client components)
  ├── /research/{id}/progress   client page, polls status
  └── /research/{id}            server-rendered report
        │
        ▼
Next.js API routes ──────────────► Supabase Postgres
  │        │                          research_jobs
  │        │                          query_results
  │        │                          competitors
  │        │                          leads
  │        │
  │        ├── OpenAI / Gemini (scan queries)
  │        ├── DeepSeek (parse + copy)
  │        ├── Google Places (lookup + verification)
  │        ├── Resend (email)
  │        └── GHL webhook (CRM)
  │
  └── QStash (prod only) ──► POST /api/worker/research
Vercel Cron ──► /api/cron/cleanup, /api/cron/sequence
```

**Local vs production dispatch** is decided by one function in `app/api/research/start/route.ts`:

```ts
function isLocalDev() {
  const url = process.env.NEXT_PUBLIC_SITE_URL ?? ''
  return url.includes('localhost') || url.includes('127.0.0.1') || url === ''
}
```

- **Local / empty URL:** `runResearch(jobId)` runs in-process, fire-and-forget.
- **Anything else:** QStash publishes `{ jobId }` to `${NEXT_PUBLIC_SITE_URL}/api/worker/research` with `retries: 2`, and that route verifies the Upstash signature before running the same `runResearch`.

---

## 4. End-to-end flow

```
1. LANDING
   user types → GET /api/lookup?q=           (Places autocomplete, 300 ms debounce)
   picks a result → GET /api/lookup/details  (Places details + scrape + Gemini keywords)
   toggles keywords → POST /api/research/start
        → research_jobs row (status=pending)
        → worker dispatched
        → redirect /research/{id}/progress

2. PROGRESS
   poll GET /api/research/{id}/status every 3 s
   submit POST /api/research/{id}/lead  (report email + GHL webhook)

3. WORKER (background)
   pending → running → [queries → parse → score → competitors → narrative] → complete
                                                   └── background Places verification

4. REPORT
   GET /research/{id}  → server component → fetchReportData()
   client fetches /api/research/{id}/insights only if not pre-rendered
   optional POST /api/research/{id}/enroll → 5-day sequence

5. LIFECYCLE
   /api/cron/sequence every 30 min → send due emails
   /api/cron/cleanup  every 30 min → fail stuck jobs, purge expired
```

A report is only viewable after a lead exists? **No.** `fetchReportData` returns the report as soon as `status = 'complete'`. The lead gate is UX (the progress page only navigates forward after the form is submitted), not authorization. Anyone with the job UUID can read the report. The UUID is the access token.

---

## 5. API reference

All routes are `dynamic = 'force-dynamic'`. Response envelopes are inconsistent by design (see §5.5).

### 5.1 Lookup

#### `GET /api/lookup`

Places autocomplete for the hero search box.

| | |
|---|---|
| Query params | `q` (min 2 chars) |
| Rate limit | 30 requests / 60 s per IP, key `lookup:${ip}` |
| Auth | none |
| Success | `{ success: true, data: PlacePrediction[] }` |
| Failure | `429` rate limited, `500` search failed |
| Empty query | `{ success: true, data: [] }` |

`PlacePrediction` = `{ place_id, description, structured_formatting: { main_text, secondary_text } }`.

#### `GET /api/lookup/details`

Resolves a Places `place_id` into a business card with inferred keywords. This is the most expensive route in the app.

| | |
|---|---|
| Query params | `place_id` (required) |
| Rate limit | **none** |
| Auth | none |
| Success | `{ success: true, data: BusinessCard }` |
| Errors | `400` missing place_id, `404` place not found, `500` failure |

Internal process (see §6.1):

1. `getPlaceDetails` — name, address, website, phone, rating, review count, types, address components, editorial summary, reviews.
2. `extractCityState` — `locality` first, then `postal_town → sublocality_level_1 → sublocality → admin_area_2 → admin_area_3`; state = `administrative_area_level_1.short_name`.
3. `getKeywordsForTypes` — static category fallback by Places type or business name.
4. `scrapeWebsite` — SSRF-guarded, up to 6 URLs, 6 s each, HTML stripped to 8 KB of text.
5. Review mining — sentences containing trade verbs (`install|replace|repair|fix|build|remodel|…`), capped at 2 KB.
6. Gemini JSON keyword extraction, **12 s hard timeout** → static fallback list.

Response shape:

```json
{
  "success": true,
  "data": {
    "name": "...", "address": "...", "website": "...", "phone": "...",
    "city": "...", "state": "...",
    "keywords": ["...", "..."],
    "primary_service": "...",
    "has_website": true,
    "place_id": "...",
    "google_rating": 4.8,
    "google_review_count": 127
  }
}
```

### 5.2 Research lifecycle

#### `POST /api/research/start`

Creates the job and dispatches the worker.

Request body:

```json
{
  "business_name": "string (required, ≤200)",
  "website_url": "string|null",
  "primary_service": "string|null",
  "location_city": "string (required, ≤100)",
  "location_state": "string (required, ≤10)",
  "keywords": ["string"]  // required array, ≤10 entries
}
```

| | |
|---|---|
| Rate limit | **disabled** — one-per-10-minutes code is commented out (`TODO: RE-ENABLE`) |
| Side effects | inserts `research_jobs` (`status='pending'`), fires cleanup purge, dispatches worker |
| Success | `{ success: true, data: { jobId } }` |
| Errors | `400` validation, `500` DB or internal |

Validation is shallow: presence of name/city/state, string types, length caps, keywords array + count. No semantic checks, no email, no bot check.

#### `POST /api/worker/research`

QStash-only trigger. Not called by the browser.

| | |
|---|---|
| Auth | Upstash `Receiver.verify({ signature, body })` using current + next signing keys |
| Body | `{ "jobId": "uuid" }` |
| Behavior | verifies signature, parses body, calls `runResearch(jobId)` **without awaiting**, returns `{ success: true }` immediately |
| Errors | `401` invalid signature, `400` missing jobId |

Responding before the work finishes is deliberate (QStash retries on non-2xx). It is also the biggest production risk — see §10.

#### `GET /api/research/[id]/status`

Powers the progress bar.

| | |
|---|---|
| Success | `{ success: true, data: { status, progress } }` |
| Not found | `404` |

`progress` is cosmetic, derived from elapsed time, not real work:

```ts
progress = complete ? 100 : failed ? 0
         : min(95, round(elapsedMs / 75_000 * 100))
```

#### `GET /api/research/[id]/report`

Report JSON.

| | |
|---|---|
| Success | `{ success: true, data: ReportData }` |
| Not found | `404 { success:false, error:'Report not found' }` |
| Not ready | `202 { success:false, error:'Report not ready', data:{ status } }` |
| Other | `500` |

`ReportData` = `{ job, competitors[10], queryResults[], lead }`. The `lead` field is the **most recent** lead for the job (`email`, `sequence_enrolled`) so the in-report course CTA can work without putting the email in the URL. The page itself is a server component and calls `fetchReportData` directly; this route exists for API consumers.

#### `GET /api/research/[id]/description`

DeepSeek-generated 2–3 sentence score description.

- `404` job missing, `202` score not ready.
- Falls back to static tier copy on any model error.
- **Currently unused by the UI** — the report consumes the pre-rendered `description_text` from the worker. This route is a fallback/utility.

#### `GET /api/research/[id]/insights`

Recomputes summary + 3 insights + 3 recommendations live from stored rows.

- `404` job missing, `202` score not ready.
- Called by `Recommendations` only when the job has no pre-rendered `insights_data`.
- Same data contract as the worker's pre-render.

### 5.3 Lead and sequence

#### `POST /api/research/[id]/lead`

| | |
|---|---|
| Body | `{ first_name?, last_name?, email (required), phone?, role?, challenge? }` |
| Validation | email presence only |
| Side effects | dedupe check on `(job_id,email)`, insert `leads`, send Resend report email, POST GHL webhook |
| Success | `{ success: true }` |
| Errors | `400` no email, `404` no job, `500` insert failure |

Duplicate handling is belt-and-braces: a `SELECT` first, then insert; a `23505` unique-violation (migration 005) is swallowed as success. Email and webhook failures are logged, never surfaced.

#### `POST /api/research/[id]/enroll`

| | |
|---|---|
| Body | `{ email }` |
| Preconditions | lead row must exist for this job + email |
| Behavior | if already `sequence_enrolled`, returns `already_enrolled`; else marks stage 1 and sends Day 1 immediately |
| Success | `{ success: true, data: { enrolled: true } }` or `{ already_enrolled: true }` |
| Errors | `400` no email, `404` lead not found, `500` enroll failed |

Enrollment is idempotent at the route level. It is **not** authenticated: knowing `jobId + email` is enough to enroll (and therefore email) that address.

### 5.4 Ops / cron

Both cron routes check `Authorization: Bearer ${CRON_SECRET}` **only when `NODE_ENV === 'production'`**. Locally they are open.

#### `GET /api/cron/cleanup`

Scheduled `*/30 * * * *` in `vercel.json`.

1. Mark `running` jobs older than 10 minutes as `failed`.
2. `purgeExpiredResearchJobs()` — delete jobs older than 30 days, then delete jobs older than 3 hours that have no lead.

Returns `{ success, deletedUnconverted, deletedConverted, stuckFixed }`.

#### `GET /api/cron/sequence`

Scheduled `*/30 * * * *`.

Calls `processSequenceQueue()` — advances every enrolled lead whose stage is due (see §6.9). Returns `{ success: true }` or `500`.

### 5.5 Conventions, such as they are

- Most routes: `{ success: boolean, data?: T, error?: string }`.
- Worker and cron routes: bare `{ success: true }` / `{ error }`.
- No shared error middleware, no Zod validation despite `zod` being installed.
- IP comes from `x-forwarded-for` only; no fallback to `req.ip`.
- HTTP caching is disabled on every route.

Status codes:

| Code | Meaning in this app |
|---|---|
| 200 | success |
| 202 | job exists, not complete yet |
| 400 | missing/invalid input |
| 401 | bad QStash signature or cron secret |
| 404 | job / lead / place not found |
| 429 | lookup rate limit |
| 500 | DB, provider, or unhandled failure |

---

## 6. Processes

### 6.1 Business lookup (the pre-scan)

`GET /api/lookup/details` → `lib/places.ts`, `lib/keywords.ts`, `lib/gemini.ts`.

1. **Places Details** returns up to 5 reviews, types, address components, website.
2. **City/state extraction** uses the first matching address component; if state resolves longer than 3 chars it re-reads `administrative_area_level_1.short_name`.
3. **Static keywords** come from `CATEGORY_KEYWORDS` — 10 curated phrases for roofing, HVAC, plumbing, electrical, painting, remodeling, landscaping, general contracting. `PLACES_TYPE_MAP` maps Google types to a category; name matching is the fallback; `general_contractor` is the default.
4. **Website scrape** is SSRF-guarded (`isValidPublicUrl`): blocks non-HTTP(S), localhost, `10/8`, `172.16/12`, `192.168/16`, `169.254/16`, `fc00::/7`, `fe80::/10`, and `169.254.169.254`. It tries the URL, its http/https twin, and `/services`, `/about`, `/our-work`, `/residential`, `/commercial` — max 6 attempts, 6 s each, first page yielding >300 chars wins. Falls back to Google cache. Anything still empty is tolerated.
5. **Review mining** splits review text into sentences, prefers sentences with action verbs, joins up to 2 KB.
6. **Gemini extraction** gets website text, Google description, review sentences, and category tags, and must return 10–12 specific service phrases + a primary service. `responseMimeType: application/json`, 15 s provider timeout, 12 s race in the route. Failure → static keywords.
7. User can toggle off any keyword and add up to 3 custom ones in the hero UI.

### 6.2 The scan worker (`workers/research.ts`)

`runResearch(jobId)` wraps `runResearchInner` and marks the job `failed` on any thrown error.

**Guards**

- Job missing → log and return.
- `status === 'complete'` → skip (idempotency).
- `status === 'running'` and `Date.now() - created_at < 10 min` → skip (duplicate trigger).
- `status === 'running'` and older than 10 min → restart (treated as stuck).

Note the guard measures from `created_at`, not from when the job started running.

**Query plan**

For every keyword, per platform:

| Location type | Prompt |
|---|---|
| city | `best {keyword} in {City, ST}` |
| state | `best {keyword} in {ST}` |

Plus two name queries per platform:

| Location type | Prompt |
|---|---|
| city | `{Business Name}` |
| state | `{Business Name} {ST}` |

Total per platform = `2 × keywords + 2`. With 10 keywords: 22 queries per platform, **44 total**. The report and insights use the same formula.

**Execution**

- Both platforms run in parallel.
- Within a platform, batches of **5** (`batchMap` + `Promise.allSettled`).
- Each query has an **18 s** hard timeout (`Promise.race`). There is no `AbortController`; the losing promise keeps running.
- A failed/timed-out query does **not** abort the scan: it is recorded as an empty response with `mentioned: false` and zero competitors, then inserted like any other row. Provider outages therefore look like invisibility, not errors.
- Every result is written to `query_results` (platform, keyword, location_type, query_text, response_text, mentioned, mention_count).

**Per-platform aggregation**

`mentioned` = any query mentioned; `mentionCount` = sum of per-response counts; `isFirstMention` = any query ranked the business first.

**Then, in order**

1. `calculateScores` (see §6.4).
2. `aggregateCompetitors` over all responses → top 10 → `competitors` rows.
3. Pre-render description + insights under a 20 s deadline.
4. Update `research_jobs`: `status='complete'`, 3 scores, and any narrative fields that were produced.
5. Fire-and-forget Places verification.

Nothing retries a partial scan. If 12 of 44 queries fail, the score is still `complete`.

### 6.3 Response analysis (`lib/parser.ts`)

One DeepSeek JSON call per AI response. Input is the first 7,000 characters of the response.

The prompt asks for **every** business in order of appearance and the target's rank, with rules for suffix swaps, reorderings, abbreviations, ampersands, and exclusions (national chains, marketplaces, cities, generic categories). Output:

```json
{ "target_rank": 3, "competitors": [{ "name": "...", "rank": 1 }] }
```

Derivation:

- `mentioned = target_rank > 0`
- `mentionCount = mentioned ? 1 : 0` — one per response, not occurrences
- `isFirstMention = target_rank === 1`
- each competitor gets `above = mentioned && competitor.rank < targetRank`

So "above" means *beat the client in a response where the client appeared*. Competitors in responses where the client is absent are counted but not marked as beating them.

**Fallback** (model error / invalid JSON): normalized string match, then Fuse.js fuzzy match (threshold 0.3) over sentences; competitor names are pulled by a list-item regex and all marked `above: true`.

**Aggregation** (`aggregateCompetitors`):

- Normalize: lowercase, strip punctuation/`&`, collapse `and`, drop `llc|inc|corp|corporation|company|co|ltd|limited`, keep alphanumerics.
- Dedupe within each response, then across responses.
- `count` = number of responses naming it; `aboveCount` / `belowCount` split by the `above` flag.
- Display name = longest variant seen.
- Sort by `aboveCount` desc (the report later re-sorts by `mention_count` in SQL).
- Top 10 are persisted.

### 6.4 Scoring (`lib/scoring.ts`)

```ts
platformScore = min(100, round( (mentionCount / (totalKeywords * 2)) * 80 + bonus ))
bonus = isFirstMention ? 10 : mentionCount > 0 ? 5 : 0
overall = round(chatgpt * 0.6 + gemini * 0.4)
```

- Denominator is `keywords × 2` (city + state for keywords only).
- Numerator includes mentions from the two business-name queries, so a business that is named in its own name queries can exceed the denominator and saturate at 100.
- A single mention with no first place is worth `80 / (2k) + 5`; with 10 keywords that is 9.
- Tiers: `0–20 Dead in the Water`, `21–40 Bleeding Out`, `41–60 Treading Water`, `61–75 In the Game`, `76–90 Market Contender`, `91–100 Category King`. Colors: red, red, orange, amber, green, green.

### 6.5 Competitor verification (`lib/verifier.ts`)

Runs after the job is already `complete`, so the report never waits for it.

For each competitor with `verified IS NULL`:

1. Places **Text Search** `${name} ${city}, ${state}`, top 3 results.
2. Reject candidates whose formatted address does not contain the state.
3. `tokenSimilarity` = shared brand-distinctive tokens / max token count. Trade words (`plumbing`, `roofing`, `hvac`, `contractor`, `services`, `home`, `pro`, …) are stripped before comparing, so `ABC Plumbing ≠ XYZ Plumbing`.
4. `verified = bestScore >= 0.6`; store `verified`, `verified_place_id`, `verified_at`.

Concurrency 3, 300 ms between batches. A name with no brand-distinctive token scores 0 and is marked unverified.

The report hides rows with `verified === false` entirely and shows `verified === null` as still-checking. That is the anti-hallucination mechanism: AI-invented companies never appear as competitors.

### 6.6 Pre-rendered narrative

Two DeepSeek calls run in parallel under a **20 s** deadline (`Promise.race` + `Promise.allSettled`). Missing results are simply omitted; the job still completes.

**Description** (`generateDescription` → `description_text`, `description_category`)

- 2–3 sentences, tier-specific tone, addressed to the owner.
- Must wrap `City, ST` in `<hl>` and the category phrase in `<cat>`; tags are stripped before storage.
- Category is read from `<cat>` first, then matched against a known phrase list.
- Fallback: one static sentence per tier, using `contracting business` as the category.
- No em dashes anywhere (enforced in the prompt, scrubbed at render by `stripEmDashes`).

**Insights** (`generateInsights` → `insights_summary`, `insights_data`)

- Input: business, location, primary service, three scores, mention counts, total queries per platform, keywords, top 5 competitors.
- Output: `{ summary, insights: [3], recommendations: [{icon, text} ×3] }`.
- Prompt constraints: every number traceable to the data; mention targets capped at the real query count (`cappedTarget`); mechanisms deliberately vague (no "reviews", "GBP", "schema", "landing pages") so the report diagnoses but does not hand over the playbook; no em/en dashes.
- Fallback: `staticFallback` with the same structure and real numbers.
- `insights_data` is stored as JSONB and read directly by the report page; the live route recomputes only when pre-render failed.

### 6.7 Report render

`app/research/[id]/page.tsx` (server component):

1. `fetchReportData(id)`.
2. If not found → "Report not found." If `pending`/`running` → `redirect('/research/{id}/progress')`.
3. Renders:
   - **ScoreGauge** — animated SVG ring plus ChatGPT/Gemini meters (60/40 weights labelled), description with highlighted city/category.
   - **CompetitorList** — target row merged into ranked competitor rows, unverified-hidden, top 10 plus the target, mention bars.
   - **Recommendations** — pre-rendered if present, otherwise fetch `/insights`, otherwise static fallback computed from the data (never a skeleton).
   - **KeywordMatrix** — one cell per real query (keyword × platform × city/state); a check appears only if that exact query mentioned the business.
   - **SequenceCta** — only if the job has a lead; enrolls the email in the 5-day course.
   - **ReportCta**, share links (LinkedIn/mailto), footer.
4. `shareUrl` falls back to `http://localhost:3003` when `NEXT_PUBLIC_SITE_URL` is unset — a stale default.

### 6.8 Lead capture and report email

`POST /lead`:

1. Verify the job exists (`id, business_name, score_overall`).
2. Look up `(job_id, email)`. If absent, insert `leads`.
3. Send Resend email: subject `Your {business} AI Visibility Report — Score: {n}/100`, score block with tier color and urgency line, report link, "next 3 days" teaser, Calendly CTA.
4. POST the GHL webhook with contact fields, business name, score, report URL.
5. Return success immediately; email and CRM are fire-and-forget.

The score label passed to the email comes from `scoreGrade` (6 tiers), but the email's color logic only checks `Good`/`Needs Work`, so every tier renders red. Cosmetic bug.

### 6.9 The 5-day sequence (`lib/sequence.ts`)

Enrollment sets `sequence_enrolled=true`, `sequence_stage=1`, `sequence_enrolled_at=now`, and sends **Day 1 immediately**.

Stage progression (cron every 30 min):

| Stage found | Hours after enrollment required | Sends | New stage |
|---|---|---|---|
| 1 | 24 | Day 2 | 2 |
| 2 | 48 | Day 3 | 3 |
| 3 | 72 | Day 4 | 4 |
| 4 | 96 | Day 5 | 5 |
| 5 | — | nothing | — |

`processSequenceQueue` loops stages 1–4, selects enrolled leads whose `sequence_enrolled_at` is older than the stage threshold, loads each job, sends that stage's email, and advances the stage. One email per lead per tick; a lead that misses ticks catches up one stage at a time.

Email content (`SEQUENCE_EMAILS[1..5]`): score economics → the 3 signals AI reads → competitor teardown → 90-day framework + Calendly. All inline HTML, no unsubscribe link, no per-lead tracking. Sending is via Resend with `RESEND_FROM_EMAIL` (default `reports@faaxa.com`).

### 6.10 Retention and cleanup (`lib/cleanup.ts`)

Two tiers, because the 5-day sequence needs the report alive:

| Data | Retention | Why |
|---|---|---|
| Job **with** a lead | 30 days | report links in Day 5 emails, follow-up calls |
| Job **without** a lead | 3 hours | anonymous abandoned scans |
| Job stuck in `running` | marked `failed` after 10 min | frozen/failed worker |

Deletion cascades to `query_results`, `competitors`, `leads`.

`purgeExpiredResearchJobs` has no `NOT IN (subquery)` in PostgREST, so it selects up to 1,000 jobs with `leads(id)` embedded, filters lead-less ones in JS, then deletes in chunks of 100 (URL length limit). Anything beyond 1,000 waits for the next tick.

Supabase also has an optional `pg_cron` equivalent (migration 003) that deletes everything older than 3 hours — **do not enable it alongside the 30-day tier**, it would delete converted jobs mid-sequence. The app-level cron is the source of truth.

Cleanup runs from:
- `/api/cron/cleanup` every 30 min in production.
- `/api/research/start` on every new scan (the only cleanup path in local dev, where Vercel Cron does not exist).

### 6.11 Rate limiting (`lib/ratelimit.ts`)

Redis `INCR` + `EXPIRE` on first hit. Used **only** by `/api/lookup` (30/min/IP). The research-start limiter (1 per 10 min/IP) is commented out, and `/lookup/details` (the expensive one: Places + scrape + Gemini) is unlimited. Both are exploitable cost vectors.

### 6.12 Local development

- `NEXT_PUBLIC_SITE_URL` containing `localhost`/`127.0.0.1` (or empty) → worker runs inline in the Next server process, no QStash.
- QStash cannot reach localhost, hence the branch.
- Crons do not run locally; cleanup piggybacks on `/api/research/start`.
- The worker needs outbound network access to OpenAI, Gemini, DeepSeek, Places, Supabase, Resend.
- Dev command: `npm run dev` (Next 16 + Turbopack). `next.config.ts` pins `turbopack.root` to the project directory because automatic workspace-root inference hangs startup in 16.2.x.

---

## 7. Data model

Migrations live in `supabase/migrations/001…008`.

### `research_jobs`

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | `gen_random_uuid()` |
| business_name | text | not null |
| website_url | text | nullable |
| primary_service | text | nullable |
| location_city | text | nullable in DB, required by API |
| location_state | text | nullable in DB, required by API |
| keywords | text[] | queried keywords |
| status | text | `pending \| running \| complete \| failed` |
| score_overall | int | null until complete |
| score_chatgpt | int | |
| score_gemini | int | |
| description_text | text | migration 008, pre-rendered |
| description_category | text | migration 008 |
| insights_summary | text | migration 008 |
| insights_data | jsonb | migration 008, `{summary, insights[], recommendations[]}` |
| created_at | timestamptz | default now() |

`score_perplexity` was created in 001 and dropped in 006.

Indexes: `status`, `created_at desc`.

### `query_results`

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| job_id | uuid FK | `ON DELETE CASCADE` |
| platform | text | check allows `chatgpt \| perplexity \| gemini`; only chatgpt/gemini written |
| keyword | text | `business_name` for name queries |
| location_type | text | `city \| state` |
| query_text | text | exact prompt sent |
| response_text | text | full AI answer (empty on failure) |
| mentioned | bool | |
| mention_count | int | 0/1 per response in practice |
| created_at | timestamptz | |

Index: `job_id`.

### `competitors`

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| job_id | uuid FK | CASCADE |
| competitor_name | text | longest variant |
| mention_count | int | responses naming it |
| above_count | int | migration 002 |
| below_count | int | migration 002 |
| verified | boolean | migration 004; null = not checked |
| verified_place_id | text | |
| verified_at | timestamptz | |
| chatgpt_score / perplexity_score / gemini_score | int | legacy, unused |

Indexes: `job_id`, partial on `verified`.

### `leads`

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| job_id | uuid FK | CASCADE |
| first_name / last_name | text | |
| email | text | not null |
| phone / role | text | |
| created_at | timestamptz | |
| sequence_enrolled | boolean | migration 007 |
| sequence_stage | int | 1–5 |
| sequence_enrolled_at | timestamptz | |

Unique index `(job_id, email)` from migration 005; index on `job_id`, `email`, and a partial index on `sequence_stage WHERE sequence_enrolled`.

### RLS

All four tables have RLS enabled. But the policies are written as:

```sql
create policy "service_role_all_jobs" on research_jobs for all using (true) with check (true);
```

There is no `TO service_role` clause, so these are permissive policies for **every role**, including `anon`. The public anon key is shipped to the browser (`NEXT_PUBLIC_SUPABASE_ANON_KEY`). Anyone who reads it can read, insert, update, and delete all rows through PostgREST. The server never uses the anon client, so the key does not need to be public at all. This is the single most serious issue in the codebase.

---

## 8. Configuration

From `.env.local` / `.env.local.example`:

| Variable | Consumer | Purpose |
|---|---|---|
| `NEXT_PUBLIC_GOOGLE_PLACES_API_KEY` | places, verifier | Autocomplete, details, text search |
| `OPENAI_API_KEY` | openai | ChatGPT lane |
| `GEMINI_API_KEY` | gemini | Gemini lane + keyword extraction |
| `DEEPSEEK_API_KEY` | deepseek | Parsing, insights, descriptions |
| `TAVILY_API_KEY` | tavily (unused) | Dead code |
| `NEXT_PUBLIC_SUPABASE_URL` | supabase | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | supabase | Unused at runtime; still public |
| `SUPABASE_SERVICE_ROLE_KEY` | supabase admin | All DB access |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | ratelimit (`Redis.fromEnv`) | Lookup rate limit |
| `QSTASH_TOKEN` | start route | Publish worker jobs |
| `QSTASH_URL` | — | Declared, unused |
| `QSTASH_CURRENT_SIGNING_KEY` / `_NEXT_SIGNING_KEY` | worker route | Verify QStash |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | email, sequence | Sending |
| `GHL_WEBHOOK_URL` | lead route | CRM sync |
| `NEXT_PUBLIC_CALENDLY_URL` | UI, emails | Booking CTA |
| `NEXT_PUBLIC_SITE_URL` | start, lead, report | Base URL + local/prod dispatch switch |
| `CRON_SECRET` | cron routes | Bearer auth in production |

---

## 9. Failure and edge-case behavior

| Condition | What happens |
|---|---|
| One AI query times out (18 s) | Recorded as not-mentioned empty row; score diluted; scan continues |
| Provider key missing/invalid | Same as timeout for every query; job completes with score 0 |
| DeepSeek parse fails | Heuristic string/fuzzy match + regex competitors, all marked above |
| DeepSeek insights fail | Static insights stored |
| Description fails | Static tier copy stored |
| Narrative exceeds 20 s | Fields omitted; report falls back to `/insights` or client-side static copy |
| No competitors found | `competitors` insert skipped; report shows empty state |
| Places verification fails | `verified` stays null; competitors remain visible |
| Duplicate QStash delivery | Skipped if `status='running'` and job age < 10 min; restarted if older |
| Worker crash | Fatal handler sets `failed`; cron also fails jobs stuck > 10 min |
| Duplicate lead submission | `(job_id,email)` check + unique index; second is a no-op |
| Duplicate enrollment | Returns `already_enrolled` |
| Job deleted before report | Report page shows "Report not found." |
| Report opened before complete | Redirect to progress page |
| Website unreachable | Keyword extraction falls back to static category list |
| Review text absent | Gemini works from name + types only |
| Malformed JSON body | Unhandled → 500 (no try/catch around `req.json()` in start/lead/enroll) |

---

## 10. Known gaps and risks

Ordered by blast radius.

1. **RLS is effectively off.** `using (true)` policies apply to `anon`. Rotate/stop shipping the anon key, or add `TO service_role` to the policies. Until then the database is public.
2. **The worker is fire-and-forget inside a serverless request.** In production the QStash route returns 200 before `runResearch` finishes. Vercel can freeze the function after the response, leaving the job `running` forever. `after()`/`waitUntil` or a real queue consumer is required.
3. **The score is not a measurement, it is one sample per prompt.** AI answers vary by user, location, and time. One run per prompt, no repetition, no confidence interval. The code never claims otherwise, the UI effectively does.
4. **Failed queries are silent.** A total provider outage produces `complete`, score 0, and a confident report. There is no error-rate threshold or retry.
5. **`/api/lookup/details` is unauthenticated and unlimited.** It fans out to Places, up to 6 scrapes, and Gemini. Trivial to burn money.
6. **`/api/research/start` rate limiting is disabled** and marked TODO. One attacker can create unlimited jobs and 44 provider calls each.
7. **DeepSeek retries with a 180 s timeout, 3 attempts.** `analyzeResponse` has no deadline inside the worker. A slow model can hold a job for many minutes (bounded only by the 10-minute stuck rule on the *next* trigger, not the current run).
8. **The 18 s query timeout does not abort the request.** Losing promises keep consuming tokens and connections.
9. **Mention count is 0/1 per response**, despite the parser prompt's richer contract. Scoring treats each response as a binary hit; the unit is "responses that named you", which is fine, but the naming (`mention_count`) implies frequency.
10. **Name queries inflate the score**, because the denominator excludes them but the numerator includes them.
11. **No unsubscribe link, no suppression list, no email verification.** Enroll-then-email is possible with any address someone knows was submitted.
12. **Dead code:** `lib/tavily.ts`, `queryOpenAI`, `queryGemini`, `queryGeminiFlash`, `detectMentionGPT`, `emailDay2/3/4Data`, `getSupabase` (anon), `QSTASH_URL`, `competitors.chatgpt_score/perplexity_score/gemini_score`. Delete or wire up.
13. **`?email=` is pushed by the progress page and ignored by the report page.** Harmless, misleading.
14. **Email tier color only handles `Good`/`Needs Work`**, so all six tiers render red.
15. **`shareUrl` fallback is port 3003**, a port this app does not use.

---

## 11. File map

```
app/
  page.tsx                         landing composition
  layout.tsx                       fonts, metadata, HubSpot script
  research/[id]/page.tsx           server-rendered report
  research/[id]/progress/page.tsx  progress + lead capture
  api/
    lookup/route.ts                Places autocomplete (rate limited)
    lookup/details/route.ts        Places details + scrape + Gemini keywords
    research/start/route.ts        create job + dispatch
    research/[id]/status|report|description|insights|lead|enroll/route.ts
    worker/research/route.ts       QStash-signed worker trigger
    cron/cleanup/route.ts          stuck jobs + retention
    cron/sequence/route.ts         5-day sequence tick
components/
  landing/                         Hero (search + keywords), sections, FAQ, CTAs
  progress/                        ProgressTracker (3 s poll), LeadForm
  report/                          ScoreGauge, CompetitorList, KeywordMatrix,
                                   Recommendations, SequenceCta, ReportCta
lib/
  supabase.ts                      admin + anon clients
  places.ts                        autocomplete, details, city/state
  keywords.ts                      static category keyword lists
  parser.ts                        DeepSeek extraction, normalization, aggregation
  scoring.ts                       score + tiers
  verifier.ts                      Places verification
  insights.ts                      LLM insights + static fallback
  deepseek.ts / openai.ts / gemini.ts   provider clients
  report.ts                        report data assembly
  email.ts / sequence.ts           Resend emails + sequence state machine
  cleanup.ts                       retention policy
  ratelimit.ts                     Redis counter
  text.ts                          em-dash scrubber
workers/research.ts                the scan pipeline
supabase/migrations/               001–008 schema evolution
vercel.json                        two 30-minute crons
scripts/                           manual provider/pipeline test scripts (dev only)
```
