# Caliber — Project Overview

## 1. The project in one minute

Caliber runs a social-video business across several brands.

- **A data platform on Google Cloud.** Cloud Functions pull Instagram, TikTok and YouTube statistics, comments and transcripts into BigQuery. Terraform creates the datasets, tables, schedulers, workflows, service accounts and alerts around them.
- **A tagging system.** Every post gets editorial tags (pillar, media format, content format, journalists) from an LLM classifier, rules, and a daily human review in Google Sheets. The allowed tag values live in one BigQuery catalog.
- **Slack tools and a publishing chain.** A Reddit story finder, a data question-answering bot, and a Slack-to-video-hosting-to-RSS pipeline.
- **Wire, a newsroom web app on AWS.** Editors upload a video and classify it with the same tag catalog; the aim is a tool that watermarks, tags and later publishes videos.

## 2. The parts you did not work on (high level)

### 2.1 Social-media extraction

Three families of functions pull data on a schedule:

- **Instagram** (`instagram-extraction-insights`, `instagram-extraction-comments-replies`, `instagram-update-oauth`): Meta Graph API for TNM, Recount, Capsule and SaySo accounts. Raw JSON goes to a Cloud Storage bucket, from where BigQuery loads happen outside these repositories. A token-refresh function writes new secret versions.
- **TikTok Business** (`tiktok-business-profile`, `-video`, `-comments-replies`, `tiktok-update-oauth-business`): TikTok Business API writes directly to BigQuery per brand; older consumer-API functions were deleted in August 2025.
- **YouTube** (`youtube-extraction-stats`, `youtube-extraction-metadata-views`, `youtube-report-uploader`): Data, Analytics and Reporting APIs into BigQuery. Extraction is limited to recent videos to fit a one-hour function timeout.

The matching Terraform stacks (`instagram-analytics`, `tiktok-business-analytics`, `youtube-analytics` and others) create per-brand datasets, raw, cleaned and enriched tables, scheduled clean and enrich queries, scheduler jobs and OAuth secret shells.

### 2.2 Other function groups

| Group               | What it does                                                                                                                                                                      |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Top Story Turtle    | Slack app (three functions) that finds high-discussion Reddit stories, runs searches and has an LLM analyse comments                                                              |
| The Stats Whisperer | Slack bot with a report builder over BigQuery; open questions are forwarded to a retrieval service                                                                                |
| Publisher chain     | Slack upload bot, video transcoding hand-off to Cloudflare Stream, a webhook, and an RSS API for syndication partners; one Cloud SQL (MySQL) database shared by four functions    |
| Virality engine     | A daily batch function and a Sheet-driven realtime function that score posts with a topic-model and random-forest model; model files are fetched from Cloud Storage at build time |
| Tag catalog manager | Public HTTP function that inserts or deactivates rows in the BigQuery tag catalog from a Google Sheets editor                                                                     |

## 3. The parts you worked on, in detail

### 3.1 Automated tagging

**What tagging is.** Every Instagram, TikTok and YouTube post for TNM and Recount needs four tag types: `pillars` (editorial theme), `media_format` and `tile_count` (video, carousel, reel, number of tiles), `content_format` and `journalists`. The allowed values per brand and platform are rows in the BigQuery table `master_catalogs.tag_catalog`.

**Your pieces (`infra-functions`)**:

- **Splitting the monolith.** The original `automated-tagging-pipeline` did two independent jobs in one HTTP function. You split it into `automated-tagging-pillars` and `automated-tagging-media-format`, each with its own manifest, configuration, secret name and test suite.
- **Pillars function.** Reads rows with empty pillars and a title from the last two days, asks an LLM to classify the title, has a second model judge the result, and forces `Unclear` on disagreement. A runtime guard reads the active pillars from the catalog, intersects them with a deployed list in code, adds `Unclear`, and aborts rather than write only `Unclear`.
- **Media-format function.** No LLM: rules plus the Scrape Creators API infer `media_format` and `tile_count`, repairing inconsistent pairs (for example a carousel with one tile).
- **Safe write-back (both).** Results load into a per-run staging table, then one guarded `MERGE` updates a row only where the target value is empty (or, for the format pair, inconsistent). Human-entered values are never overwritten, and column names are checked with a regular expression before they reach SQL.
- **Runtime project fix.** The pillar catalog query had the production project hard-coded, so staging read production and failed; it now uses the `GCP_PROJECT` environment variable and fails early if it is missing.
- **Daily review sheet.** `tagging-create-file` builds a Google Sheet of untagged posts per platform and account. The "complete" test required `journalists`, which are no longer tagged, so rows reappeared every day; the SQL threshold changed from four tag types to three (YouTube: the journalists clause dropped).

### 3.2 Transcription pipeline (GetTranscribe)

A new pipeline you built across both repositories; a third-party transcription API (GetTranscribe) turns recent videos into text **[V]**.

**The function (`transcription-fetching-pipeline`)**:

- **Request**: an HTTP POST with `platform` (Instagram, TikTok or YouTube), `brand` (TNM or Recount) and optional `window_hours`, `max_rows`, `parallelism`. Six platform and brand pairs are allowlisted; request values never become SQL identifiers.
- **Folders**: it ensures a `{platform}/{brand}` folder path exists in the provider account, paging through the provider's folder list and failing on ambiguity.
- **Candidates**: one parameterised BigQuery query keeps the newest snapshot per post and assigns each row a disposition: invalid id, outside the window, already handled, over one hour long, invalid URL, or candidate. URLs are checked in code (https only, exact host allowlists, YouTube id pattern).
- **Processing**: an async worker pool under a time budget (24 minutes of dispatch, a drain period, a final-write reserve, a 30-minute hard cap). Jobs still running at the deadline are marked incomplete and not stored.
- **Provider client**: job creation is never retried, because an ambiguous acknowledgement could create a second paid job. Reads retry with full-jitter backoff and honour `Retry-After`. Results are classified as success, permanent failure (empty transcript, no audio), transient failure or incomplete.
- **Persistence**: only success and permanent failure are stored. Results load into a staging table (24-hour expiry) and a single `MERGE` inserts new rows and promotes an old failure to success, never overwriting a success. BigQuery job ids are deterministic, so a retried run reconnects to the earlier job.
- **Logging**: structured breadcrumbs share an invocation id in staging only; forbidden field names (key, URL, transcript) are dropped.

**The infrastructure (`infra-platform`)**: a `transcription-pipeline` stack with two service accounts, six hourly Cloud Scheduler jobs (TNM on the hour, Recount at :30 to avoid creating the same folder at once), a `transcriptions` table in each of six datasets, and feature flags so the permissions can be applied before the private function exists.

### 3.3 Wire: upload options, classification, tenancy and the video id

**Reading the tag catalog without a key.**

- A new route `GET /upload-options` returns, per brand and platform, the content types, media types and pillars an editor may choose.
- The Lambda authenticates to Google by Workload Identity Federation: it exchanges its own AWS role credentials for a Google token and impersonates a read-only service account. There is no key anywhere.
- It queries BigQuery over the REST `jobs.query` interface rather than the SDK, bounded to 20 seconds, with a five-minute cache per Lambda and a 15-minute stale fallback. Trouble returns 503, because list, download and upload do not depend on the catalog.
- Values are the catalog's strings verbatim, scoped per brand and platform (an Instagram pillar is never offered for YouTube). Media types are filtered in code to those Wire can process.

**Upload and classification.**

- Choosing a file immediately creates the record and starts the S3 upload; platform, content type, media type and pillars are chosen while it transfers.
- `PATCH /content/{id}/classification` validates the selection against the live catalog and stores it write-once, using a DynamoDB condition that also asserts the caller's tenant.
- `DELETE /content/{id}` discards a draft, again as one conditional write.
- Finishing always awaits the transfer first, so a classification is never filed against a record whose bytes never landed.

**Tenancy.** The Cognito pre-token Lambda stamps an `account` claim (the editor's home brand) on the tokens. The API, not the form, decides what a caller may write; a caller with no home brand can read everything and write nothing.

**Review fixes (in #6).** Renaming a record was not tenant-checked, so an editor of one brand could rename another brand's record; a failed condition returned the wrong status because the failing item came back unconverted; web sessions froze `role` and `account` at sign-in; a caller with no home brand saw an empty list; upload completion had races. Each was fixed (section 8 of the contributions document).

### 3.4 Smaller extraction-side changes

- **Instagram comments.** Retries that all timed out returned `None`, which crashed with an attribute error that was not caught; the media was dropped but the function returned 200. It now raises, uses a 10-second connect and 30-second read timeout with three attempts, and logs one summary per run whose severity reaches ERROR (the level that pages) only when at least 10% of media, or five items, were skipped. Eleven tests were added.
- **Capsule on TikTok.** The three TikTok functions mapped any non-TNM account to the Recount dataset, so Capsule would have been written there. They now map TNM, Capsule and Recount separately. The Terraform adds a `capsule` module: a dataset, 13 tables, 7 scheduled queries, 4 scheduler jobs and a secret shell

### 3.5 Top Story Turtle cache: Memcached to Cloud Storage

Replace the Reddit post cache in `top-story-turtle-search`. The function stores each subreddit's posts as one gzipped JSON object in a bucket with a two-hour freshness rule enforced in code, and 13 Jest tests replace "Testing pending". The manifest drops the Memcached secret and the VPC connector, which needed a new `--clear-vpc-connector` option in the shared deploy action. Terraform adds the bucket and removes the Memcached instance, plus a fix that keeps the `external` provider declared until applied everywhere.

## 4. Technology stack

| Area                | Technology                                                                                                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Functions           | Google Cloud Functions generation 2 (Python 3.11, 17 functions; Node.js 20, 11 functions), pipenv and pnpm, ruff, pytest, Jest, ESLint with a shared config              |
| Data                | BigQuery (per-brand datasets), Cloud Storage, Cloud SQL (MySQL) for the publisher chain, Firestore (Datastore mode) for the Slack app                                    |
| Orchestration       | Cloud Scheduler (OIDC calls), Cloud Workflows, Pub/Sub                                                                                                                   |
| Infrastructure      | Terraform with the Google provider 5.37, Cloud Storage state, GitHub Actions with keyless authentication                                                                 |
| External services   | Groq (LLM), Scrape Creators, GetTranscribe, Meta Graph API, TikTok Business API, YouTube APIs, Slack, Reddit, OpenAI, Cloudflare Stream                                  |
| Wire web            | Next.js 16, React 19, Tailwind 4, shadcn/ui, NextAuth 5, zod; Vercel                                                                                                     |
| Wire infrastructure | AWS CDK (TypeScript), Cognito, API Gateway HTTP API, Lambda (Node.js 22, one Python 3.12), DynamoDB, S3; a private shared AWS toolkit package from the same organization |

## 5. Glossary

| Term                         | Meaning                                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------------------- |
| TNM                          | The News Movement                                                                           |
| Recount, Capsule, SaySo      | Sister brands with their own accounts, datasets and schedulers                              |
| Pillar                       | An editorial theme tag, for example "Finance"; allowed values come from the tag catalog     |
| Tag catalog                  | BigQuery table of allowed tag values per account, platform and tag type                     |
| Media format                 | Video, reel, short, carousel and similar; with `tile_count` it describes the post shape     |
| GetTranscribe                | Third-party transcription API used by the transcription pipeline                            |
| Guarded `MERGE`              | A BigQuery `MERGE` whose update clause only fires where the target is empty or inconsistent |
| Workload Identity Federation | Google feature that lets an AWS role act as a Google service account without a key          |
