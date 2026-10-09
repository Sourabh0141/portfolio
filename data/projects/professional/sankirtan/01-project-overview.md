# Sankirtan — Project Overview

## 1. What it is, in one minute

Sankirtan is a community platform for devotional gatherings (kirtan, satsang, meditation and similar events) in India. The public can browse upcoming gatherings and submit their own event, with a poster image, for review. A single administrator reviews each submission and approves, rejects, edits, unpublishes or republishes it. Only approved events are visible to the public.

Two-sentence version: "Sankirtan lets the public submit devotional events with a poster image and lets one admin moderate them before they appear publicly. The backend is an async FastAPI service with PostgreSQL, MinIO, JWT-cookie admin auth, rate limiting and a compare-and-swap moderation workflow; the Next.js front end is a UI prototype built against that contract."

## 2. Problem and purpose

**Problem.** Devotional events (sankirtans, satsangs, retreats) are scattered across communities and traditions (_sampradaya_). A public listing needs a way for organisers to submit events without an account, and a way to keep out spam and unsuitable content before publication.

**What the system provides.** A moderated pipeline: anonymous submission, then review, then public listing. The abuse controls (per-IP and per-email submission limits, login limits, image verification) and the explicit state machine exist because the submission endpoint is public and unauthenticated.

**Who uses it.**

| Actor                       | What they do                                                                                          |
| --------------------------- | ----------------------------------------------------------------------------------------------------- |
| Public visitor              | Browses approved events; submits an event with consent and one image                                  |
| Administrator (exactly one) | Logs in, lists submissions by status, edits details, approves, rejects, unpublishes and republishes   |
| Operator                    | Runs migrations, bootstraps the admin account, configures environment variables, monitors health URLs |

## 3. Features

- Public event submission as `multipart/form-data` with 8 required fields and 8 optional fields, one required image (JPEG, PNG or WebP, at most 5 MiB with the committed configuration), and a required `consent=true`.
- Public listing of approved events only, with pagination (default 12, maximum 100), filters (state, district, city, sampradaya, date range) and a free-text search `q` across seven columns.
- Short-lived signed image URLs generated on every read (900 seconds with the committed configuration). Image URLs are never stored.
- Admin login with a cookie-carried JWT, plus logout.
- Admin listing by status (`pending`, `approved`, `rejected`, `unpublished`, `all`; default `pending`), with date filters, search and pagination (default 20, maximum 100).
- Admin field-level edit (`PATCH`) for events in PENDING, APPROVED or UNPUBLISHED status. REJECTED events are not editable.
- Moderation state machine: approve, reject (reason required), unpublish (reason required), republish.
- Rate limits: submissions per IP and per email; failed logins per IP and per username.
- Liveness and readiness probes (readiness checks both the database and the storage bucket).
- Structured JSON logging, a request id on requests and responses, and baseline security headers (except that the 500 response for an unhandled exception is built outside those middlewares, so it carries the id only in its body; library behavior, not run).

## 4. Architecture

### 4.1 Components

```text
 Browser (Next.js app: sacred-space)
||
||
        v
 FastAPI app (Backend/app)
   Middleware: SecurityHeaders -> RequestId -> CORS
   Routers (/v1): public/events, admin/auth, admin/events, health
   Services: submission, moderation, auth, event query
   Repositories (SQLAlchemy async) ---> PostgreSQL (asyncpg)
   Storage client (aioboto3)        ---> MinIO / S3-compatible bucket
```

| Component               | Responsibility                                                                                                                                                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| App bootstrap           | Builds the FastAPI app, registers middleware, error handlers and routes, storage startup                                                                                                                                             |
| Entrypoint              | Starts Uvicorn with host and port from validated settings                                                                                                                                                                            |
| Configuration           | Typed, validated environment settings with cross-field checks                                                                                                                                                                        |
| Security helpers        | Argon2 hashing, JWT creation and verification, cookie attributes; CPU work off the loop                                                                                                                                              |
| Error contract          | One `AppError` type and four handlers producing a single JSON error shape for application, validation and unhandled errors (framework routing 404 and 405 responses probably keep FastAPI's default `{"detail": ...}` body; not run) |
| Sanitization            | Unicode NFKC normalization and removal of every Unicode "C"-category character (control and format, including zero-width joiners) from text input                                                                                    |
| Logging                 | JSON formatter; the handler sets no stream, so output goes to stderr (Python's default)                                                                                                                                              |
| Middleware              | Request id and latency logging; defensive response headers                                                                                                                                                                           |
| Routers                 | HTTP surface, form and query parsing, dependency wiring                                                                                                                                                                              |
| Schemas                 | Pydantic request and response contracts with business-rule validators                                                                                                                                                                |
| Services                | Workflows: submission, moderation, login, listing                                                                                                                                                                                    |
| Repositories and models | SQLAlchemy models and all SQL access                                                                                                                                                                                                 |
| Storage                 | MinIO client wrapper and object-key and TTL helpers                                                                                                                                                                                  |
| Migrations and scripts  | Hand-written SQL migrations, a runner with an advisory lock, admin bootstrap                                                                                                                                                         |
| Tests                   | HTTP-level integration tests run against a live server                                                                                                                                                                               |

### 4.2 Layering

The backend uses a conventional four-layer split. Routers parse input and call a service. Services contain workflow rules and own transaction boundaries (`async with session.begin()`). Repositories contain SQL only. Models and schemas are separate (ORM models in `app/db/models`, Pydantic models in `app/schemas`). Dependencies are constructed per request: services are created inside the route function and a new `MinioClient` is created for each request.

### 4.3 Request lifecycle

1. The request passes through the middleware stack, outermost first: `SecurityHeadersMiddleware` (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, set only if not already present), then `RequestIdMiddleware` (accepts a client `X-Request-ID` or generates a UUID, times the request, logs `http_request` with method, path, status and latency, and adds `X-Request-ID` and `X-Response-Time-Ms` to the response), then CORS, then the routes.
2. The router validates path, query and form parameters with FastAPI, then builds a Pydantic model manually inside a `try` block and converts a `ValidationError` into FastAPI's `RequestValidationError`.
3. The service runs the workflow inside explicit transactions.
4. Errors are raised as `AppError` and rendered by the central handler as `{"error": {"code", "message", "request_id"}}`. Validation errors return 422 with code `VALIDATION_ERROR` and a fixed message. Unhandled exceptions return 500 with a fixed message and are logged with the stack trace.

The middleware order is worth stating exactly. `main.py` adds CORS first, then `RequestId`, then `SecurityHeaders`, and Starlette makes the last-added middleware the outermost, so the order is `SecurityHeaders`, `RequestId`, CORS, then the app. This was derived from the `add_middleware` call order and Starlette's documented behavior, not from running it.

## 5. Technology stack

| Layer              | Technology                                                      |
| ------------------ | --------------------------------------------------------------- |
| Language           | Python (modern typing, `match/case`, `datetime.UTC`)            |
| Web framework      | FastAPI 0.115+ on Starlette, Uvicorn                            |
| Validation         | Pydantic v2, pydantic-settings, email-validator                 |
| Database           | PostgreSQL via SQLAlchemy 2 async and asyncpg                   |
| Object storage     | MinIO or any S3-compatible service via aioboto3 and botocore    |
| Authentication     | JWT (python-jose, HS256 default) in an HttpOnly cookie; Argon2  |
| Image verification | Pillow                                                          |
| Concurrency        | anyio `CapacityLimiter` plus `to_thread`                        |
| Tests              | `unittest` with `urllib`; Pillow to generate images             |
| Front end          | Next.js 16.1.6 (App Router), React 19.2.3, Tailwind CSS 4, TS 5 |

## 6. Cross-cutting subsystems

### 6.1 Configuration

All settings come from `Backend/.env` (path resolved relative to the file, so the working directory does not matter) or the process environment, with `case_sensitive=False` and `extra="ignore"`. There are 34 settings fields; only `JWT_ALGORITHM` has a default (`HS256`), so 33 variables are required (`COOKIE_DOMAIN` must be present but may be empty). Validators enforce: asyncpg URL prefix; non-empty explicit CORS origins with `*` rejected; non-empty MIME list; admin bootstrap username at least 3 characters and password 12 to 256 characters; fifteen numeric controls greater than zero; and a model-level check that `MINIO_ENDPOINT` has no path, query or fragment and that its scheme agrees with `MINIO_USE_SSL`. The secret key, JWT key, IP-hash key and admin password are `SecretStr`; the MinIO access key is a plain string. The result is cached with `lru_cache`. A missing or invalid variable stops the process at import time.

### 6.2 Data model

Three tables, created by hand-written SQL in `0001_initial_schema.py`.

| Table                 | Notes                                                                                                                                                                                                                                                                                                 |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `users`               | Single-admin design: `id SMALLINT PRIMARY KEY CHECK (id = 1)`; `username CITEXT UNIQUE`; `password_hash`; `is_active`; `last_login_at`; timestamps                                                                                                                                                    |
| `events`              | UUID key; submitter fields; location and timing; `timezone` default `Asia/Kolkata`; `status` as a native PostgreSQL enum (`PENDING`, `APPROVED`, `REJECTED`, `UNPUBLISHED`); image bucket, key, content type and size; `submitted_ip_hash CHAR(64)`; moderation metadata with foreign keys to `users` |
| `auth_login_attempts` | `BIGSERIAL` key; `username_attempted CITEXT`; `ip_hash`; `success`; `attempted_at`                                                                                                                                                                                                                    |

Three `CHECK` constraints keep moderation columns consistent with status: rejected fields are set only when `REJECTED`; unpublished fields (time, admin, reason) are set only when `UNPUBLISHED`; `approved_at` is set exactly when status is `APPROVED` or `UNPUBLISHED`. Migration 0002 adds eight indexes for the public listing sort and filters, the admin recency sort, and the four rate-limit queries.

The ORM models declare `submitter_email` as a plain string while the table uses `CITEXT`; case-insensitive comparison therefore happens in PostgreSQL, and the application also lowercases emails.

### 6.3 Submission pipeline

1. Sanitize and lowercase the email; compute `HMAC-SHA256(ip, IP_HASH_SECRET)` so raw addresses are never stored.
2. In a short transaction, count recent submissions by IP hash (15 minutes) and by email (24 hours) from the `events` table and reject with 429 over the limit (committed configuration: 3 per IP per 15 minutes, 10 per email per 24 hours).
3. Validate the image: must be present; declared MIME type must be in the allow-list; read fully into memory; reject empty and oversize; then, on a worker thread (limiter of 8), open with Pillow, check that the detected format maps to the declared MIME type, run `verify()`, reopen and `load()` to force a full decode.
4. Upload to `events/{event_uuid}/{random_hex}.{ext}`. Any exception becomes 503 `STORAGE_UNAVAILABLE`.
5. In a second transaction, insert the event as `PENDING` with the text fields sanitized (`map_url` is validated as a URL rather than sanitized).
6. Return `201` with the id, status and `submitted_at`.

### 6.4 Moderation workflow

```text
PENDING --approve--> APPROVED --unpublish(reason)--> UNPUBLISHED
PENDING --reject(reason)--> REJECTED (terminal, not editable)
UNPUBLISHED --republish--> APPROVED
```

Transitions are executed as a single `UPDATE ... WHERE id = :id AND status = :expected ... RETURNING` statement (a compare-and-swap). If no row is returned, the service checks whether the event exists and answers 404 or 409. This makes duplicate or racing requests safe without explicit row locks. Detail edits take a row lock (`SELECT ... FOR UPDATE`) and re-validate the time range against stored values. Approve clears the rejection and unpublish columns, and republish clears the unpublish columns, so the database `CHECK` constraints hold.

### 6.5 Authentication and session handling

- **Login.** Inside one transaction: check the failed-attempt counters (5 per IP per 15 minutes and 10 per username per hour with the committed configuration), look up the user, verify the Argon2 hash on a worker thread, record the attempt (success or failure), update `last_login_at` on success. Failure returns 401 with the same message for unknown user, inactive user or wrong password. Success issues a JWT with `sub`, `iat`, `exp` (30 minutes in the committed configuration), `role=admin` and a random `jti`.
- **Cookie.** `admin_access`, `HttpOnly`, **always `Secure`**, `SameSite` from configuration, `Path=/v1/admin`, optional `Domain`.
- **Authorization.** `get_current_admin_user_dep` reads the cookie, decodes the JWT, requires `role == "admin"` and a numeric `sub`, and loads the active user in a **separate short-lived database session** so that the auth lookup does not start a transaction inside the request session.
- **Logout.** Deletes the cookie. There is no per-token revocation: the `jti` claim is generated but never read. Deactivating the admin row (checked on every request) or rotating the signing key would cut off all outstanding tokens; otherwise a copied token stays valid until it expires.

### 6.6 Object storage

`MinioClient` wraps aioboto3 with configurable connect and read timeouts and total attempts (3 s, 10 s and 2 in the committed configuration), a hard-coded standard retry mode, and checksum behavior set to `when_required`. A fresh S3 client is opened per operation. `ensure_bucket_exists` runs at application startup: it calls `head_bucket`, creates the bucket on 404 (adding a `LocationConstraint` unless the region is `us-east-1`), and tolerates "already exists" races. Because the startup hook does not catch errors, **an unreachable storage service stops the application from starting.**

### 6.7 Concurrency and performance design

CPU-bound work is moved off the event loop with `anyio.to_thread` and bounded `CapacityLimiter`s (password hashing 4, JWT 32, image validation 8). The database engine uses a pool of 10 with 20 overflow, a 30-second pool timeout, `pool_pre_ping` and a PostgreSQL `statement_timeout` of 15 seconds. Pool size, overflow, pool timeout and statement timeout are configurable; `pool_pre_ping` is fixed on. Indexes in migration 0002 match the query shapes. Listing runs one page query and one count query.

### 6.8 Migrations and operations scripts

Migrations are plain Python files with `async def apply(conn)`. The runner (`apply_migrations.py`) lists files matching `^\d+_.*\.py$`, sorts by numeric prefix, takes a PostgreSQL advisory lock (`pg_try_advisory_lock`), runs each migration in its own transaction with `SET LOCAL lock_timeout = '5s'`, then unlocks. **There is no table recording which migrations have run**; every invocation re-applies every file. Safety relies on every statement being idempotent (`IF NOT EXISTS`, a guarded `DO` block for the enum). `setup_admin_user.py` upserts the single admin row from environment values and reactivates it.

### 6.9 Observability

Logs are one JSON object per line on stderr (the handler sets no stream, so the Python default applies) (timestamp, level, logger, message and every `extra` field). `captureWarnings` routes Python warnings into logging. Every request logs `request_id`, method, path, status and latency; clients receive `X-Request-ID` and `X-Response-Time-Ms`. There are no metrics, tracing or error-reporting integrations.

## 7. Technical challenges and noteworthy details

1. **Abuse-resistant public upload.** The image is checked three ways (declared type against allow-list, detected format against declared type, full decode) before it reaches storage, and CPU work is isolated from the event loop.
2. **Privacy-preserving rate limiting.** IPs are keyed-hashed (HMAC-SHA256) before storage and counted from existing tables, so no separate counter store is needed.
3. **Race-safe moderation.** Compare-and-swap `UPDATE ... RETURNING` plus database `CHECK` constraints means the rejected, unpublished and approved-timestamp columns stay consistent with the status even if application code is wrong (`reviewed_at` and `reviewed_by` are not constrained).
4. **Transaction scoping with async SQLAlchemy.** Moved admin authentication to its own session because the shared request session would otherwise begin a transaction during dependency resolution, colliding with the service's explicit `session.begin()`. (The commit message states the motive; the mechanism is the usual SQLAlchemy "transaction already begun" behavior.)
5. **S3-compatible gateways.** A code comment says some S3-compatible gateways or proxies cannot validate optional checksum modes on `PUT`, so the client pins `when_required` for both directions (the reason is inferred from that comment; the setting likely needs botocore 1.36 or newer while `requirements.txt` allows 1.34, which was not tested).
6. **Migrations without Alembic.** A small runner with an advisory lock, per-migration transactions and a lock timeout, plus an explicit commit before and after the lock queries to avoid implicit-transaction conflicts.
7. **Single-admin model.** Enforced in the schema (`id = 1`), which removes roles and user management and also removes any way to add a second admin without a schema change.

## 8. How to explain the system (suggested talking structure)

1. **Purpose**: moderated, anonymous event submission with a public listing.
2. **Shape**: FastAPI service (routers, services, repositories) on PostgreSQL and MinIO, plus a Next.js UI.
3. **Design choices worth naming**: strict input validation and sanitization, three-way image verification, keyed-hash rate limiting, a compare-and-swap moderation state machine backed by `CHECK` constraints, a validated settings object, a uniform error contract (for application, validation and unhandled errors) with request ids.
4. **How it is operated**: migrations through a locking runner, one-command admin bootstrap, liveness and readiness probes, JSON logs.

## 9. Glossary

| Term                    | Meaning                                                                                                                                                   |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sankirtan / kirtan      | Congregational devotional singing and chanting; used here for the community gatherings the platform lists                                                 |
| Satsang                 | A gathering for spiritual discussion or devotional practice                                                                                               |
| Sampradaya              | A devotional tradition or lineage; a required, free-text field on every event and a public filter                                                         |
| Moderation              | Admin review that decides whether an event becomes visible                                                                                                |
| Compare-and-swap        | An update that succeeds only if the row is still in the expected state                                                                                    |
| CITEXT                  | PostgreSQL case-insensitive text type used for email and username columns                                                                                 |
| Signed (pre-signed) URL | A time-limited link that lets a client download one object without storage credentials                                                                    |
| HMAC                    | Keyed hash; used so IP addresses are stored only as keyed digests (non-reversible in practice only while the key stays secret; here the key is committed) |
| Advisory lock           | A PostgreSQL application-level lock used to stop two migration runners from overlapping                                                                   |
| Capacity limiter        | An anyio construct that caps how many blocking jobs run at once                                                                                           |
| Request id              | A correlation id carried in `X-Request-ID`, logged and echoed in error bodies                                                                             |
