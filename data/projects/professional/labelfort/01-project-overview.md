# Labelfort — Project Overview

Labelfort was named **DADP** (Data Annotation & Delivery Platform) for most of its life. The code still carries the old name in places.

## 1. What it is, in one minute

Labelfort is a multi-tenant platform for producing labelled training data. An organization uploads a dataset (images, video, audio, PDF, text, CSV rows, point clouds, DICOM medical studies). Optionally, AI models pre-label it. The files are cut into batches and handed to human annotators, then to verifiers, then optionally to auditors who sample the result for quality. The finished labels are exported as review workbooks or as machine-learning formats (COCO, YOLO, KITTI, MOT).

The commercial point, in the repository's own words, is label and export quality: downstream model training depends on correct geometry, class IDs and stable JSON shapes.

It is a monorepo of five deployable services (Next.js web app, FastAPI core API, FastAPI AI microservice, FastAPI events gateway, nginx) over shared infrastructure (PostgreSQL, Redis, RabbitMQ, MinIO, OpenSearch, Orthanc). GPU model servers (SAM, tracking, YOLO, speech and language models) run on separate hosts and are called over HTTP.

## 2. Problem and purpose

| Problem                                                                        | How the system addresses it                                                                                                       |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| Labelling work is manual and slow                                              | AI pre-processing (OCR, VQA, text QA, transcription, diarization, translation, detection, tracking) and click-to-polygon with SAM |
| Several people touch the same file, and work must be distributed fairly        | A batch ledger with row-locked claims, unique indexes, two-stage completion and idempotent retries                                |
| Quality has to be measurable                                                   | Verifier stage plus a sampled auditor stage with its own status lifecycle and score                                               |
| One platform serves several customer organizations                             | Organization-scoped data, caches, buckets, feature flags and broker permissions                                                   |
| Large uploads and long jobs must not block users                               | Browser-direct presigned uploads; Celery queues; real-time progress over MQTT                                                     |
| Output has to match what model-training tools expect                           | A common export representation with one exporter class per format                                                                 |
| Domain variety (2D, 3D, video, audio, medical) without a separate app for each | A data-driven workspace with registries keyed by media kind and taxonomy path                                                     |

## 3. Features

Grouped by who uses them.

**Platform operator (`platform_admin`)**: organization CRUD and per-organization feature flags, global AI-model registry, cross-organization audit logs and support tickets, onboarding.

**Organization console (`admin`, `operations_manager`, `quality_manager`, `client`)**:

- Dashboards with analytics and PDF export (the real chart library is Recharts).
- Dataset hub: presigned upload, ZIP upload, DICOM upload to Orthanc, append to an existing dataset, associated-media mapping CSVs.
- Allocation strategies (how many annotators, verification, audit) as a node-graph editor.
- Batch allocation monitoring with live updates.
- QA setup and QA assignments (sampled audit).
- Data delivery (export) with live progress.
- AI models registry, AI pipeline builder (React Flow), pipeline templates and progress.
- Synthetic Data Designer (draft, preview, execute, records, CSV export).
- User management, organization details, support tickets, audit-log search.

**Labelling workspace (`annotator`, `verifier`, `auditor`)**:

- Eight media surfaces: image, video, audio, PDF, text, CSV row content, point cloud, DICOM.
- Seven 2D shape tools (rectangle, circle, polygon, polyline, keypoint, cuboid, brush), a 3D cuboid tool, a medical toolset, SAM click/box segmentation, and a form engine for question-based work.
- Video: frame-accurate navigation, tracks with interpolation, AI-imported tracks.
- Durable undo/redo, drafts that survive a refresh, one batch at a time per user.
- Verifier: reviews and may correct annotator geometry. Auditor: scores a sample of finished batches.

**Cross-cutting**: notification bell and toasts, role-based dashboards, support tickets with attachments, OpenSearch-backed audit log with 94 event types in 9 families, per-organization feature gating.

**Export formats**: Excel review workbook, ZIP with rendered images (label, mask or segment modes), COCO, YOLO, KITTI, MOT. A format must be permitted by the project's shape policy and by the organization's plan.

## 4. Architecture

### 4.1 Components

| Component         | Technology                                                      | Port (container) | Responsibility                                                                               |
| ----------------- | --------------------------------------------------------------- | ---------------- | -------------------------------------------------------------------------------------------- |
| Web app           | Next.js 15.5, React 18.3, TypeScript 5.9 (strict)               | 3000             | Three consoles: organization, platform, labelling workspace                                  |
| Core API          | FastAPI, Python 3.11, SQLAlchemy 2 async, Alembic               | 5000             | Auth, organizations, projects, uploads, batches, roles, media, export, analytics, audit      |
| AI microservice   | FastAPI, Celery                                                 | 5001             | Model resolution, pipeline runtime, SAM orchestration, video tracking, synthetic data        |
| Events gateway    | FastAPI, aio-pika                                               | 7859             | The only authorized publisher onto the RabbitMQ topic exchange                               |
| Reverse proxy     | nginx (alpine)                                                  | 80/443           | TLS, routing, rate limits, WebSocket proxy to Web-MQTT                                       |
| Workers           | Celery, prefork                                                 | -                | 7 backend queues and 4 AI queues, 11 worker containers                                       |
| PostgreSQL        | Native on the host in production (not containerized)            | -                | Master database, events database, one database per project                                   |
| Redis             | redis 7.2                                                       | -                | Domain caches, upload sessions, batch-state projection, rate limits, AI pipeline state       |
| RabbitMQ          | 4.2 with MQTT, Web-MQTT and OAuth2 plugins                      | -                | Celery broker (own vhosts) and the browser's real-time feed                                  |
| MinIO             | S3-compatible                                                   | -                | Datasets, exports, attachments, instructions                                                 |
| OpenSearch        | single node                                                     | -                | Audit log store                                                                              |
| Orthanc           | 25.10.3 with DICOMweb                                           | -                | Medical studies, behind an authenticated proxy                                               |
| GPU model servers | Ultralytics SAM 2.1, YOLO11x with BoT-SORT and ReID, vLLM, etc. | various          | Segmentation, tracking, detection, language models. Run on separate hosts, referenced by URL |

### 4.2 Real-time path (events → MQTT)

```
service (backend, AI worker)
  → HTTP POST /publish on the events gateway  (X-Client-Id + X-Client-Secret, per-client domain allow-list)
  → RabbitMQ topic exchange (amq.topic), one message per subscriber
      routing key: {domain}.org.{org}.{user|role}.{id}.{selectors}
  → nginx /ws → RabbitMQ Web-MQTT
  → browser (MQTT.js v5 over WebSocket), password = backend-signed RS256 JWT (30 minutes)
  → window CustomEvent named after the domain → feature hooks
```

- Five event domains: `notification`, `batch_progress`, `export_progress`, `ai_pipeline_progress`, `synthetic_data_designer_progress`.
- The backend mints each user's broker token. Its scopes come from one role-to-domain table with import-time assertions that every role and domain is covered.
- Publishing is best-effort and never raised into the business path. Messages are non-persistent, so an offline user misses them by design; the database remains the source of truth.
- Segment values containing `.`, `/`, `+` or `#` are rejected by the gateway so a caller cannot widen a wildcard.

## 5. Technology stack

| Area              | Technology                                                                                                                                                                                                 |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend language  | Python 3.11 (slim image), `uv` for dependency installation                                                                                                                                                 |
| Backend framework | FastAPI 0.116.1, Uvicorn, SQLAlchemy 2.0.42 async with asyncpg, Alembic 1.16.4, Celery 5.4+, redis-py 6.2.0, minio 7.2.16, opensearch-py, Pillow 11.3, openpyxl, pandas, numpy, pycocotools, laspy, pypcd4 |
| Auth              | JWT in HTTP-only cookies (python-jose; algorithm from the `JWT_ALGORITHM` setting, HS256), bcrypt via passlib; separate RS256 tokens for the broker                                                        |
| Frontend          | Next 15.5.12, React 18.3.1, TypeScript 5.9.3, Redux Toolkit 2.11.2, mqtt 5.15.0, Tailwind 3.4.19, Radix UI, React Flow 11, Recharts                                                                        |
| Workspace media   | HTML5 canvas for 2D, Three.js 0.182 for point clouds, Cornerstone3D 3.33.5 for DICOM, wavesurfer.js 7.12.1 for audio                                                                                       |
| Frontend tooling  | Jest 29, ESLint 9 flat config with a custom layer-law block; `@playwright/test` and an `e2e` script                                                                                                        |
| AI services       | Ultralytics (SAM 2.1 Large, YOLO11x, BoT-SORT with ReID), PyTorch 2.5.1 with CUDA 12.1, vLLM for language models, the `data-designer` library pinned at 0.5.3 for synthetic data                           |
| Messaging         | RabbitMQ 4.2 (AMQP for Celery, MQTT and Web-MQTT for browsers, OAuth2 plugin), aio-pika 9.4.1 in the gateway                                                                                               |
| Storage and data  | PostgreSQL, Redis 7.2, MinIO, OpenSearch, Orthanc                                                                                                                                                          |
| Delivery          | Docker and Docker Compose across the app, nginx and six infrastructure stacks. No Kubernetes and no CI/CD pipeline in the tracked tree                                                                     |

## 6. Key workflows in detail

**6.1 From upload to export**: upload dataset → (optional) run AI pipeline → create project and provision its database → batches created from files → annotators claim batches → annotate and submit → verifiers claim → verify and submit → (sampled) auditors score → project completes → admin exports.

**6.2 SAM click to polygon**

1. Arm the SAM tool (shortcut `m`; image projects with segmentation annotation type).
2. The user picks Click or Box mode in the toolbar. In Click mode each click adds a foreground point; in Box mode a drag adds a box (dropped if either side is under 2 px). Clicks plus boxes are capped at 100, and the AI microservice re-checks the cap. Nothing is sent until the user presses Segment. Each click is sent as its own object, so N clicks probably yield N polygons, not one refined mask.
3. Browser calls `POST /api/ai-pipeline/sam/segment`. The core API checks project access (organization-scoped) and that AI processing is enabled on the project, records an audit event, and proxies to the AI microservice with the trusted auth context.
4. The AI microservice looks up the file, reads the image from the organization's bucket, validates every prompt against the image bounds, and calls the SAM host (30 s default timeout, 300 s cap) with up to three attempts (1 s, 2 s back-off) on connection errors and timeouts only. Errors map to 502, 504, 500, 404, 400.
5. The SAM host returns per-object polygons and IoU scores. The browser keeps successes with at least three points, builds polygon annotations tagged with `sam_*` attributes, asks for a class once for the batch, and commits all of them as one undo step (at HEAD; when the tool was first committed, each shape was its own history entry).

**6.3 Video tracking**

1. At upload, the media task extracts video metadata (ffprobe) and all frames (ffmpeg, JPEG), zips them and stores `<dir>/_zip/<stem>.frames.zip`.
2. An admin builds a pipeline with a single tracking step and selects classes. Only form classes that map to COCO names are tracked; unmapped classes are skipped, and a run with none fails.
3. The AI worker downloads the ZIP (and fails fast if it is missing), computes a timeout from the frame count (120 s + frames × 0.35 s × 1.5, clamped to 180–6,600 s), and posts to the tracking host.
4. If the host is busy (429), the task retries with a 30 s base doubling each time (30, 60, 120, 240 s; capped at 300 s), at most four retries.
5. Results are regrouped into `video_track` payloads per question and class and stored with the file's preprocessing results.
6. In the workspace, "apply AI suggestion" turns each track into one tracked object with one AI-sourced rectangle per frame. It does not change the annotation mode, which comes from the project's workflow mode.

**6.4 Synthetic data run**: create (draft) → optional reference CSV (presigned upload and header validation) → queue preview (1–25 rows) → queue execute → worker generates, writes records and marks completed → progress events per organization and run → records table and CSV export.

**6.5 Notification delivery**: backend event → row in `notifications` → POST to the gateway → topic exchange → the recipient's MQTT session → toast, sound, badge → click marks it read and navigates to the role-correct path.

## 7. How to explain the system (suggested talking structure)

1. **One sentence**: a multi-tenant annotation and delivery platform with human-in-the-loop quality stages, AI pre-labelling, and ML-ready export.
2. **The shape**: Next.js app, FastAPI core API, FastAPI AI microservice, an events gateway, Celery workers, over PostgreSQL, Redis, RabbitMQ and MinIO.
3. **The three hard parts**: race-free distribution of work, real-time delivery to the right user only, and a workspace that handles eight media types from one design.
4. **A trace**: follow one file from presigned upload to batch claim, annotation, verification, completion event, notification and export.

## 8. Glossary

| Term                       | Meaning                                                                                                   |
| -------------------------- | --------------------------------------------------------------------------------------------------------- |
| DADP                       | Previous name of the platform (Data Annotation & Delivery Platform)                                       |
| Batch                      | The unit of work claimed and completed: a set of files                                                    |
| Allocation strategy        | Definition of how many annotators, whether verification and audit are required; shapes the project schema |
| Ledger                     | `prj_user_batch_assgns`: one row per user holding a batch in a role and slot                              |
| Slot                       | Annotator 1..N, verifier −1, auditor −2                                                                   |
| Work status / audit status | Two independent lifecycles of a batch                                                                     |
| `config_path`              | Four-segment project taxonomy: project type, media type, annotation type, workflow mode                   |
| Work unit                  | The thing a labeller works on in the workspace (a file, or a DICOM series)                                |
| Media surface              | A registered viewer for a media kind (image, video, audio, point cloud, DICOM, PDF, text, CSV row)        |
| Events gateway             | Service that publishes events to the topic exchange                                                       |
| Web-MQTT                   | RabbitMQ plugin that lets browsers speak MQTT over WebSocket                                              |
| Presigned URL              | A time-limited storage URL that lets the browser upload or download directly                              |
| SAM                        | Segment Anything Model, used here as SAM 2.1 Large through Ultralytics                                    |
| BoT-SORT, ReID             | Multi-object tracker and appearance re-identification model used for video tracking                       |
| Data Designer              | The `data-designer` Python library used to generate synthetic tabular and QA data                         |
| ltree path                 | Hierarchical project taxonomy path stored with each project                                               |
