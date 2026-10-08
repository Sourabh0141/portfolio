# OceanMind — Project Overview

## 1. What it is, in one minute

OceanMind is a web platform that lets travel-agency staff paste a free-text cruise quote and get back, automatically, the **priced result** from the cruise lines' travel-agent portals, including the agency's commission and the onboard credit (OBC) the agency can offer the customer. Instead of a person logging in to each portal, searching the sailing, choosing a cabin category, and copying prices, the backend drives real Chromium browsers (Playwright) through the portal for each cabin in parallel, captures screenshots and optional video as evidence, stores everything in PostgreSQL and MinIO, and streams live progress to the user's browser. A human then reviews the result against the evidence and records a validation verdict, which turns every run into a quality-assurance data point.

**None of the five provider modules completes a purchase.** Each one drives the portal up to the pricing page (or the price-quote modal), scrapes the price and commission, and stops.

Two-sentence version: "OceanMind automates cruise price quoting across five travel-agent portals. A FastAPI backend runs one isolated Playwright browser context per cabin, in parallel, on shared browsers, streams progress live to a Next.js dashboard, and keeps screenshots, video and results for human validation."

## 2. Problem and purpose

**Problem.** Agencies quote cruises across several suppliers. Each supplier has its own login-protected portal with its own search flow, rate codes, promotions and commission rules. Producing a quote for a group with several cabins means repeating a long, error-prone click path per cabin and then doing arithmetic on commission to decide the onboard credit to offer. The work is repetitive, slow and hard to audit.

**What the system replaces.** The manual portal workflow, plus the manual commission/OBC calculation.

**Design goals.**

- Parallelism across cabins so a four-cabin quote does not take four times as long.
- Evidence for every run (screenshots at each step, optional video, the original quote text, a snapshot of the configuration used) so a human can check the automation.
- Human-in-the-loop: extraction results can be reviewed and edited before a run, and a forced validation step records whether the run was right and, if not, which issue category applied.
- Multi-tenancy: the same provider can be used by several agencies, each with its own credentials and business rules (for example a different OBC rounding rule).
- Live feedback: users see per-cabin log windows while a run is in progress.

## 3. Features (user-facing)

1. **Sign-in and roles.** Self-registration creates a `pending` account; an admin or sub-admin approves it and assigns provider/agency access. Roles are `admin`, `sub_admin` and `user`.
2. **Agency and provider selection.** A user sees only the agencies and providers assigned to them.
3. **Quote entry.** The user pastes the quote text (and, for some portals, a booking URL), supplies a request ID, and can load an example or the previously stored input for that request ID.
4. **Extraction.** The backend parses the text into structured details (ship, sailing date, nights, passengers, cabins and categories, airport or residency). The UI checks the required fields for the provider and shows a "missing information" modal with a sample of the expected format if something is absent.
5. **Review and edit.** The user can edit passengers per cabin, categories and dates before starting. Edited passenger distributions override the automatic split.
6. **Per-provider configuration.** Options exposed in the UI include onboard-credit percentages, rate-code toggles, perk and refundable-price flags, an accessible-stateroom filter, a rate-selection strategy, and video auditing (admin only).
7. **Run and watch.** Starting a run returns immediately with a `session_id`. Progress appears in per-cabin live log windows and a progress bar. A "Reset" button cancels the run and cleans up.
8. **Results.** A metrics view per provider (totals, per-cabin prices, commission, OBC, execution time), screenshot gallery with zoom, video playback, the original quote text and promotion/discount text.
9. **Human validation.** A modal that cannot be dismissed casually asks the user to mark the run correct or incorrect, pick issue categories from a fixed catalogue (cabin category, price, passenger handling, rate code, screenshot, OBC calculation and so on), and optionally comment. A "Reprocess" action cancels and reruns.
10. **Admin dashboards.** Analytics charts (volume, processing time, accuracy by agency and provider), user management (approve, suspend, assign access), agency/provider/mapping management with credential references, promotion-template management (CSV upload), per-session configuration viewer, and processed-request tables with filtering and CSV export.

## 4. Architecture

### 4.1 Component view

```
Browser (Next.js 14 app, Tailwind, Chart.js)
   |  REST (JWT bearer)             ^ Server-Sent Events (live logs)
   v                                |
FastAPI application (api.py, single async event loop, uvicorn)
   |-- Routes/            HTTP endpoints (auth, users, agencies, booking, results, media, logs)
   |-- services/          BookingService, ExtractionService, task registry, cancellation,
   |                      UI logger (SSE fan-out), media (MinIO), Redis, provider context
   |-- Core/              browser manager + Playwright setup, UI logger, DB facade
   |-- Provider modules   portals and providers
   |-- db/                asyncpg data-access modules, schema, seeds, migrations
   |
   +--> 5 shared Chromium browsers (one per provider), one BrowserContext per unique cabin
   +--> PostgreSQL (asyncpg pool)       users, mappings, results, tracking, media metadata
   +--> MinIO (aioboto3 client pool)    screenshots, videos (+ BLOB fallback in PostgreSQL)
   +--> Redis (redis.asyncio)           pub/sub for log fan-out and cross-worker cancel
   +--> Google Gemini (gemini-2.0-flash) passenger split and category matching
```

### 4.2 Process model

- One Python process runs FastAPI under uvicorn. Almost everything is `async` (handlers, asyncpg, aioboto3, redis.asyncio and Playwright's async API); the extraction path, including the Gemini call, is synchronous and blocks the event loop while it runs.
- There is no Celery, thread pool or external job queue. A booking is a detached `asyncio.create_task` on the server's event loop, registered in a task registry so it can be cancelled.
- At startup the lifespan hook opens the database pool, Redis (non-fatal if it fails), the MinIO client pool and buckets. The SSE logger service, and launches **five long-lived Chromium browsers**, one per provider module. All browsers are launched headless.

### 4.3 End-to-end request lifecycle

1. The user logs in (`POST /token`) and the UI fetches accessible agencies and providers.
2. `POST /extraction` stores the raw quote text and dispatches to a provider-specific extractor.
3. The UI validates required fields, lets the user edit, then calls `POST /{provider}-booking` with the details and configuration.
4. The route creates a booking session (`session_id = {request_id}_{timestamp}`, stored in `session_tracking`), creates the background task, registers it, records the run in `user_booking_tracking`, and returns the `session_id`.
5. The UI attaches the session to its SSE stream (`POST /api/ui-logs/attach-session`).
6. `BookingService` merges agency configuration with the user's configuration (user values win), resolves login credentials by reference, saves a configuration snapshot, and calls the provider module.
7. The provider module groups identical cabins, runs one coroutine per unique cabin with `asyncio.gather`, each in its own browser context (own login), then copies results to the identical cabins.
8. Screenshots go to MinIO with metadata in PostgreSQL; optional video is recorded, compressed with ffmpeg and uploaded. Results are written to the provider's tables. The session status moves to `completed`, `error` or `cancelled`.
9. The UI recognizes completion from the live log text, opens the validation modal, and fetches results from `GET /{provider}-results/{request_id}`, which answers `processing` until the session leaves that state.
10. The user submits validation (`PUT /api/user-tracking/validate`) with a verdict and issue codes.

## 5. Technology stack

| Layer               | Technology                                                                                           |
| ------------------- | ---------------------------------------------------------------------------------------------------- |
| Language            | Python 3.9+ (backend), TypeScript 5 (frontend)                                                       |
| API                 | FastAPI, uvicorn, Pydantic, `sse-starlette`                                                          |
| Browser automation  | Playwright (async API), Chromium                                                                     |
| Database            | PostgreSQL via asyncpg (raw SQL, no ORM, no Alembic)                                                 |
| Object storage      | MinIO (S3 API) via aioboto3                                                                          |
| Cache and messaging | Redis (`redis.asyncio`)                                                                              |
| LLM                 | Google `gemini-2.0-flash` through `google.generativeai`                                              |
| Auth                | PyJWT (HS256, 60 min), PBKDF2-SHA256 password hashing                                                |
| Media               | ffmpeg (VP9 WebM, about 10 MB target), Pillow                                                        |
| Data tooling        | pandas, openpyxl                                                                                     |
| Frontend            | Next.js 14.0.4 (App Router), React 18.3, Tailwind 3.4, MUI 7 (admin config screens only), Chart.js 4 |
| Logging             | loguru (with a custom `UI` level) plus stdlib logging                                                |

## 6. Cross-cutting subsystems

### 6.1 Shared provider pattern

1. Extract and normalize the quote.
2. Compute a passenger distribution across cabins (even split with the remainder going to the first cabins; "OR" cases give every option all passengers; the UI can supply an edited distribution).
3. Group identical cabins by signature (category and passenger split, or passenger count and category).
4. One coroutine per unique cabin or group, started with `asyncio.gather`. There is no semaphore, so concurrency is bounded only by the cabin count of a request.
5. Each coroutine gets its own browser context from the provider's shared browser, logs in separately, and records screenshots and optional video.
6. Replicate each result to the cabins in its group.
7. Save results and update the session status.

### 6.2 Browser manager

- `BrowserManager` keeps one shared Chromium per provider module, keyed by module and event loop, marked as a "root" browser. Contexts are the unit of isolation and concurrency: one per cabin, with a fresh state (`storage_state=None`), a 1920x1080 viewport, service workers blocked, and optional video recording.
- Context creation is serialized per browser with an `asyncio.Lock` stored on the browser object, to avoid potential deadlocks under concurrent creation.
- Contexts are registered per `session_id`, so `close_session_contexts` can tear down exactly one booking on cancel.
- `close_current_loop_browsers` closes only non-root browsers on the current loop, so the shared browsers survive between bookings and close only at shutdown.
- Resource blocking (images, fonts and media requests; the tracker-domain list only applies to other resource types) is enabled.
- Anti-detection measures include an automation-flag override, a fixed user agent, non-headless mode and human-like typing.

### 6.3 Concurrency, cancellation and sessions

- `BookingTaskRegistry` maps `session_id` to the running task. `CancellationService.cancel_booking` cancels the task (5 s timeout), closes the session's browser contexts, marks the session `cancelled` and emits a UI log (module `System`, which the current frontend filters out, so users never see it). If no local task exists, it publishes on the Redis channel `booking_cancel` so the worker that owns the task can cancel it.
- Three kinds of "session" exist: the stateless JWT login, the booking session (`session_tracking`, the correlation key for screenshots, videos, results, logs and cancellation), and the SSE client session attached through `attach-session`.

### 6.4 Real-time progress (SSE)

- Providers call `ui_log(message, session_id, cabin_id, step, module)`. It writes through a custom loguru level `UI` and, if a service is registered, schedules a broadcast on the service's loop. The user ID is attached automatically from a `contextvars` variable set by the auth dependency; context variables propagate into tasks created after the dependency runs.
- `UILoggerService` publishes each log on the Redis channel `ui_logs` (so every worker sees it), falls back to a local queue when Redis fails, and fans out to per-connection bounded queues (500 messages, dropping the oldest when full). Delivery rules: logs without a session go to everyone; logs with a session go to the client attached to that session, or to a client with no session yet whose user ID matches.
- The stream endpoint is `GET /ui-logs/stream?token=<jwt>`; the token is in the query string because `EventSource` cannot set headers. A ping is sent every 10 seconds, and a stream opened without a valid token is accepted as an anonymous client that still receives session-less logs. Session attachment is propagated across workers on a third Redis channel, `ui_attach`.
- The frontend keeps one persistent stream and attaches a session to it after a run starts. `LogContext` accepts only five module names, caps logs at 1,000 and de-duplicates by message and step. `StatusContainer` computes the progress percentage by matching log text against per-provider milestone tables. `BookingProcess` detects completion from the same text. Backend log wording is therefore an implicit contract with the frontend.

### 6.5 Media pipeline

- Screenshots: provider code captures PNG bytes and calls `save_screenshot_to_db`, which uploads to MinIO with a structured key (`provider/session/type/cabin_N/...`) and stores metadata (bucket, key, size) in `centralized_screenshots`. If the upload fails, the bytes are stored in a legacy BLOB column instead.
- Video: Playwright records per context into `video/cabin_<id>/`; `stop_video_recording` closes the page, picks the newest `.webm`, compresses it with ffmpeg (VP9 with Opus; skipped if already small or ffmpeg is missing). The bitrate is meant to aim at about 10 MB from the clip duration, but the ffprobe duration lookup always fails (`text=True` is passed to `asyncio.create_subprocess_exec`), so a 60 second fallback applies and the bitrate is a constant of roughly 1,365 kbps and the stored duration is always 0, uploads it, and deletes the source through a retrying cleanup queue (Windows file locks).
- Delivery: images are returned in full unless a Range header is sent (the image endpoint also honours Range); videos stream in 64 KB chunks with HTTP Range support so seeking works. The media API reads only from MinIO, so a row that fell back to a BLOB cannot be served.
- The `MinIOClientPool` holds long-lived aioboto3 clients behind an `asyncio.Semaphore`; it is the only semaphore in the repository.

### 6.6 Authentication, roles and multi-tenancy

- JWT bearer tokens (HS256, 60 minutes, no refresh or revocation). Passwords use PBKDF2-HMAC-SHA256, 100,000 iterations, a random salt, stored as `salt:hash`. The user is reloaded from the database on every request, so suspension and role changes apply immediately. Only `approved` users can log in.
- Roles: `admin` (global), `sub_admin` (scoped to the agency derived from their mappings), `user` (operator).
- **Mappings** (`provider_agency_mappings`) are the tenant table: one row per (provider, agency) with a status, a JSONB list of credential references (`credential_names`), and a JSONB `additional_data` for business-rule variants. A user's access is the list of mapping IDs in `users.mapping_ids`. New mappings are appended automatically to every admin's list.
- Agency deletion nulls the agency in tracking tables to preserve history, strips mapping IDs from users, and deletes the agency; mapping deletion is soft (`status='inactive'`).

### 6.7 Credentials by reference

- By convention the database holds **environment-variable names** (a two-item list: username variable, password variable); nothing in the API enforces this. At run time both `ProviderContext` and `BookingService` look the names up with `os.getenv` and inject `login_credentials` into the configuration. The naming convention in the environment file is per agency.
- Mapping configuration may use keys ending in `_env_var`; `ProviderContext` resolves them to sibling keys at runtime and never writes secrets back. The update endpoint rejects configurations containing raw secret-like keys.

### 6.8 Frontend

- Next.js 14.0.4 App Router, React 18, TypeScript strict, Tailwind. Routes: `/` (booking workspace with Home, Guide, Features and Booking tabs held in state), `/admin`, `/subadmin`, `/user`. All role guards are client-side redirects; real authorization depends on the backend.
- The token and user JSON are stored in `localStorage`; the token also appears in URLs for the log stream and video playback.
- The API client wraps `fetch` with a bearer header, an 8 second timeout (15 seconds for agency administration), and up to three attempts with exponential backoff, including for POSTs.
- Booking UI components: `ProviderSelector`, `QuoteInput` with `ExampleData`, `CruiseDetails` with per-provider edit forms, `Config` (per-provider options), `BookingProcess`, `MultiCabinLogViewer`, `ValidationModal`, `BookingMetrics`, `ScreenshotDisplay`, `VideosTab`, `ResultsViewModal`.
- Required-field rules per provider live in `utils/bookingValidation.ts`; the validation issue catalogue is static data in `data/validationCategories.ts`.

## 7. Technical challenges and noteworthy details

1. **Many concurrent browser sessions in one process.** Shared per-provider browsers with one isolated context per cabin, serialized context creation, session-scoped context registry for targeted teardown, and a distinction between root and per-loop browsers.
2. **Cancelling long browser jobs from a web request.** Task registry, cancellation service, context closing, and Redis pub/sub so another worker can cancel.
3. **Privacy-scoped real-time logs across workers.** Custom log level, context variable for the user, Redis fan-out, bounded per-client queues with drop-oldest back-pressure, and a session-attach step.
4. **Avoiding duplicate work.** Identical cabins are detected and driven once; results are replicated.
5. **LLM where rules are weak, with validation.** Gemini output is accepted only if it passes exact-count/sum or whitelist checks; otherwise a deterministic fallback is used.
6. **Money rules as data.** Agency variants stored in JSONB, with explicit rounding rules and migrations.
7. **Audit trail.** Screenshots at each step (including synthetic images that show hidden rows), optional video, the original quote, a sanitized configuration snapshot, and the human verdict.

## 8. How to explain the system (suggested talking structure)

1. **Problem:** agents repeat long portal workflows per cabin and do commission maths by hand.
2. **Approach:** drive the portals with Playwright, one isolated context per cabin, run in parallel on shared browsers.
3. **Trust:** every step leaves evidence; humans validate; verdicts feed analytics.
4. **Scale and safety:** async everywhere, cancellation that actually cleans up, per-user live logs across workers.
5. **Business flexibility:** per-agency credentials and pricing variants stored as data.
6. **Honest limits:** none of it completes a purchase.

## 9. Glossary

| Term            | Meaning                                                                                                                      |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| OBC             | Onboard credit offered to the customer, derived from agency commission                                                       |
| Quote           | The free-text cruise request pasted by the agent                                                                             |
| Mapping         | A (provider, agency) row carrying credentials references, configuration and variants; users are granted access by mapping ID |
| SSE             | Server-Sent Events, the one-way stream used for live logs                                                                    |
| Browser context | A Playwright isolated browser profile inside a shared Chromium process                                                       |

## 10. Questions about the project

1. **Why browser automation and not APIs?** The portals are agent-only web applications without a public pricing API; the automation reproduces what an agent does.
2. **Why one context per cabin on shared browsers?** Contexts isolate cookies and sessions at a fraction of the memory of a full browser per request; shared browsers avoid the launch cost per request.
3. **What happens when a user presses Reset?** The registered task is cancelled, that session's contexts are closed, the session is marked `cancelled`, the UI is told, and with Redis another worker can perform the cancel.
4. **How are live logs kept private?** User ID in a context variable, session attachment, per-client queues, and delivery rules by session and user.
5. **How do you trust an LLM in the pipeline?** It is used only where rules are weak, at temperature 0, with exact-count or whitelist validation and a deterministic fallback.
6. **How do agencies differ?** Credentials by reference and rule variants stored per mapping; code branches only on the variant name.
7. **Does it complete a booking?** No. It reaches the price and commission and stops.
8. **How is correctness measured?** Human validation with issue codes feeds the analytics, which report accuracy by agency and provider.
9. **What is the hardest part of this codebase?** Resilient interaction with inconsistent third-party portals: virtualized grids, framesets, multi-column rate tables and passenger limits.
