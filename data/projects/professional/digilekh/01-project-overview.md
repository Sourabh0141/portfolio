# Digilekh — Project Overview

## 1. What it is, in one minute

Digilekh is a self-hosted platform where an organization uploads documents (PDF, Office files, images, audio), the platform OCRs, chunks and indexes them, and users then ask natural-language questions with cited answers, extract structured fields, get automatic per-document summaries and sentiment, and run audit-style review packs (contractor-bill validation, treasury reconciliation, submission assessment). Most AI inference runs on two self-hosted GPU servers reached over HTTP, so document Q&A, OCR, embedding and reranking run on self-hosted models; audio-file transcription and web search call external services.

It runs as one shared SaaS deployment (`ORG_MODE=true`) and as dedicated single-organization installs (`ORG_MODE=false`, the "CAG" deployment) from the same codebase. Every user belongs to an organization; the token carries the organization and role; each organization has its own vector collection and feature flags.

## 2. Problem and purpose

| Problem                                                                          | How the system addresses it                                                                                                                    |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Teams hold large sets of scanned and digital documents they cannot search        | Staged ingestion (OCR, per-page chunks, hybrid dense and sparse vectors) and a per-organization index                                          |
| Answers must be grounded and scoped to the documents the user may see            | A tool-calling retrieval agent whose scope (organization, soft-delete flag, selected documents) is injected by code, not by the model          |
| Long documents cannot be summarised in one model call                            | A size gate by exact token count, then a direct or a worklist-driven agentic route to produce a summary and sentiment per document             |
| Audit and finance staff need repeatable checks on bills, treasury data and files | Validation and assessment packs: deterministic calculators plus model extraction, human review and a durable pause for approval                |
| One product must serve several customers, one of them on isolated infrastructure | Organization-scoped data, caches, collections and broker permissions; a dedicated-deployment kit                                               |
| Long jobs must not block users                                                   | Browser-direct presigned uploads, Celery workers per workload, live progress over a broker-secured WebSocket                                   |
| Hindi and English content                                                        | Devanagari-aware metadata normalisation, a Hindi-capable speech stack (Kokoro, Whisper), and a Devanagari font in the assessment scorecard PDF |

## 3. Features

Roles are five: `platform_admin`, `org_owner`, `org_admin`, `org_member`, `org_viewer`; authorization is a static role-to-permission matrix over 39 permissions.

**Knowledge base**

- Spaces arranged in a tree (Postgres `ltree`), personal or shared, with admin/member memberships. Document and audio spaces ingest; image spaces are accepted but not indexed.
- Upload: single, bulk and whole-folder (the folder structure becomes sub-spaces). The browser hashes the file, asks for presigned URLs, uploads straight to MinIO and then finalizes; duplicates are detected before any bytes move.
- Import from Google Drive, OneDrive and Dropbox through an OAuth connector framework; sync from a companion scanning app.
- Document preview (PDF, Word, Excel, image, audio, video), document details, a "Document Intelligence" view with summary, sentiment and metadata, and export of the summary to Word and sentiment to CSV.

**Expert Chat**

- Modes: document Q&A, document summary, web-search chat and plain chat. Answers are cited in prose; a live step trace shows what the agent is doing while it works; follow-up suggestions; a context-usage gauge; per-message actions (feedback, read aloud, save to notes, copy, export to PDF).
- Conversation memory: recent turns in Redis and Postgres, compaction by a background worker when the context passes 90% of the model window.
- Voice input (microphone to text) and read-aloud (text to speech).
- Notes with sharing, an organization prompt gallery, feedback, and persistent notifications (the read side is live).

**Document intelligence**

- Full OCR (streamed), key-value extraction runs with an editable field list, per-document brief (summary and sentiment) generated automatically after indexing.

**Review packs (Validation and Assessment)**

- Contractor-bill validation and work-file validation, treasury reconciliation across six banks, and criterion-level submission assessment, each with human review, versioned verdicts and (for validation) a durable pause for approval. These packs are tuned to Indian government finance and audit work.

**Administration**

- Platform and organization dashboards, user and organization management, per-organization feature flags and domain profile (`fir` or `general`), password policy and admin password reset, a welcome page with per-organization branding.

**Features that existed earlier and were removed**:

| Feature                                   | Present            | Removed                   | Replaced by                                            |
| ----------------------------------------- | ------------------ | ------------------------- | ------------------------------------------------------ |
| User-to-user live chat and group chat     | 2025-06 to 2026-04 | 2026-04-23                | Nothing; the name now only appears in a legacy UI link |
| Support tickets with attachments          | 2025-06 to 2026-04 | 2026-04-29                | Nothing                                                |
| Deep Research (web research agent)        | 2025-06 to 2026-05 | 2026-05-12/13             | Nothing                                                |
| Admin email templates and broadcast email | 2025-11 to 2026-05 | 2026-05-13                | Nothing                                                |
| MQTT broker (EMQX) real-time layer        | 2025-09 to 2026-05 | 2026-05-01 and 2026-05-11 | RabbitMQ Web-STOMP and an HTTP events gateway          |
| User presence tracking                    | 2025-08 to 2026-05 | 2026-05-22                | Nothing                                                |
| Standalone data-extraction service        | 2026-01-15         | 2026-01-15 and 2026-07    | Full OCR and key-value extraction inside the retriever |

## 4. Architecture

### 4.1 Components

| Component             | Technology                                                                                                                     | Role                                                                                                                   |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Frontend              | Next.js 16.3 (App Router, almost entirely client components), React 19, Tailwind v4                                            | The web app; talks only to the core API and to the browser WebSocket                                                   |
| Core API (`Backend/`) | FastAPI, SQLAlchemy 2 async (asyncpg), Alembic                                                                                 | Auth, tenancy, authorization, spaces, uploads, chat memory, run dispatch, event-token minting. Owns all database DDL   |
| Ingestion worker      | Celery (no HTTP port)                                                                                                          | Turns an uploaded file into OCR text, chunks and vectors; registers treasury transactions; triggers the document brief |
| Retriever service     | FastAPI plus Celery workers (same image)                                                                                       | `POST /answer` for chat; workers for key-value extraction, validation, treasury tally, document brief and assessment   |
| Events gateway        | FastAPI, aio-pika                                                                                                              | The only application component that publishes to the public exchange; services publish to it over HTTP                 |
| Speech services       | FastAPI: Faster-Whisper (STT), Kokoro (TTS), on GPU hosts                                                                      | Microphone to text and text to audio; called by the core API                                                           |
| nginx                 | nginx                                                                                                                          | TLS, rate limits on login and password change, routing, WebSocket proxy, MinIO S3 on its own TLS port                  |
| Shared infrastructure | PostgreSQL (ltree, pg_uuidv7), Qdrant (4 instances over successive cutovers), Redis 7.2, RabbitMQ 3 (Web-STOMP, OAuth2), MinIO | System of record, vectors, cache and task status, broker and real-time, objects                                        |
| GPU inference hosts   | vLLM (Gemma), Surya OCR, a custom embedding service, a reranker, Whisper, Kokoro                                               | Reached over HTTP; the app images contain no torch or CUDA                                                             |

### 4.2 Layering and request lifecycle

- Core API: router, service, repository, database. Services own the commit; repositories flush. Errors are subclasses of one `DigilekhError` mapped to one JSON envelope, though some routes still raise bare `HTTPException`.
- Middleware order (added): request ID, error handlers, CSRF check (cookie-authenticated unsafe methods need a matching Origin), CORS, auth-cookie cleanup.
- Every request re-reads the user from the database, so role changes and organization deactivation take effect immediately despite stateless JWTs.
- The core API decides who may see what, then dispatches work. The document, extraction, validation, assessment, tally and chat dispatchers are thin `send_*` functions in `dispatch/` and run after commit; cloud import and companion-app sync call `send_task` from their services.
- Settings follow one rule: pydantic-settings, every field has an exact environment alias, required fields have no code default (a missing variable stops the service at start), secrets are `SecretStr`.

### 4.3 Ingestion pipeline (what happens after an upload)

Task `ingestion.ingest_document` runs nine ordered stages:

1. **validate**: soft-delete check, size cap (100 MB), reject temp/lock files and unsupported types.
2. **extract**: reuse stored OCR pages if all are done; otherwise scanned-or-digital detection, then OCR (Surya, vLLM or Gemini adapters, page by page at 270 DPI) or PyMuPDF markdown; write per-page text to `document_ocr` in one statement.
3. **chunk**: one chunk per page by default (a recursive and an audio chunker also exist), with a heuristic that merges tables split across pages.
4. **persist**: write chunks to Postgres first, with deterministic `uuid5` ids.
5. **embed**: hybrid dense (768-dim) and sparse vectors from the embedding service, batches of 128, four in flight.
6. **vector_upsert**: one upsert into the organization's Qdrant collection (the same uuid is the point id).
7. **extract_metadata** (fail-open, only for the `fir` profile): structured case metadata with Hindi normalisation into a global `doc_metadata` collection.
8. **register_transaction** (fail-open, treasury categories only): parse treasury and bank statements into tables.
9. **finalize**: set the document indexed, queue the document brief, publish the completion event.

Design rules: Postgres is canonical and vectors are derived, so a vector failure leaves recoverable state; ids are deterministic so retries overwrite; a terminal error (bad file, unsupported type) is never retried; a transient error retries with exponential back-off (30 s for I/O errors, 60 s otherwise, 3 tries) and ends as `transient_exhausted` instead of staying stuck at `processing`. The pipeline is ports-and-adapters: a template-method base class, one module per stage, and a single module that builds adapters from environment settings.

### 4.4 Retrieval and chat

- `POST /retrieval/answer` (core API) resolves the documents the user may read (a space ACL check per document), caps the count, loads the organization's collection and the compacted conversation history, commits, then calls the retriever with a 300 s timeout. After the call it writes the turn and counters in one CTE on a fresh session.
- The retriever runs one native tool-calling ReAct loop (`AgentPipeline`) over a self-hosted Gemma model. The first iteration must call a tool; later ones may answer; at the iteration cap a final answer is forced without tools. The model cannot widen scope: the executor injects organization, soft-delete flag and selected document ids into every query.
- Tools: `search_meaning` (hybrid dense and sparse search with server-side reciprocal-rank fusion per query variant, a client-side fusion, one cross-encoder rerank), `search_exact_phrase`, `search_keywords`, `read_pages`, `get_document_outline`, `get_summaries`, and case tools for the `fir` profile (`find_cases`, `count_cases`, `group_count`, `get_case`).
- Safety layers: a regex input check before any model call and an output filter after it. In the retriever the prompt-hardening function is defined but never called; the core API's agent base does call its own hardening step.
- Citations are produced in the answer text by prompt rules; the structured `citations` field is always empty.

## 5. Technology stack

Frontend versions are from `package.json`. Backend versions are mostly unpinned in `requirements.txt` (`bcrypt==3.2.0` is pinned on purpose).

| Layer          | Technologies                                                                                                                                                                                                                                                                                                                                                     |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend       | Next.js 16.3.1, React 19.2.8, TypeScript (`strict: false`), Tailwind 4 with a two-tier token layer, `@stomp/stompjs`, react-markdown with KaTeX, jsPDF, docx, recharts, Jest 30, ESLint 9 with five custom rules                                                                                                                                                 |
| Core API       | Python 3.11, FastAPI, SQLAlchemy 2 async, asyncpg, Alembic, passlib/bcrypt, python-jose (JWT), aioboto3, httpx, Celery, LangChain 1.x, `langgraph-checkpoint-postgres`                                                                                                                                                                                           |
| Ingestion      | Python 3.13, Celery, PyMuPDF Pro (licensed) and pymupdf4llm, `ocr-detection`, langchain-text-splitters, qdrant-client, `google-genai`, OpenAI SDK against vLLM                                                                                                                                                                                                   |
| Retriever      | FastAPI, OpenAI SDK against vLLM, AsyncQdrantClient, LangGraph (validation and assessment graphs), Redis, Celery                                                                                                                                                                                                                                                 |
| Data stores    | PostgreSQL 16 (ltree, pg_uuidv7), Qdrant (dense 768-dim DOT plus sparse IDF named vectors), Redis 7.2, MinIO, RabbitMQ                                                                                                                                                                                                                                           |
| Models         | Gemma 12B served by vLLM (answers, agent loops, metadata); Surya OCR 2 over vLLM; an embedding service labelled `google/embeddinggemma-300m`; a Jina cross-encoder reranker; Faster-Whisper `medium` int8; Kokoro-82M; Sarvam batch speech-to-text for audio documents; Gemini as the default image describer in ingestion and a configurable fallback elsewhere |
| Infrastructure | Docker Compose (five compose files), nginx, Dozzle and a read-only pgweb behind basic auth, fail2ban on the host                                                                                                                                                                                                                                                 |

## 6. Key workflows in detail

### 6.1 Upload to answerable

1. The browser requests `upload-config`, hashes each file (Web Crypto) and calls `presign` for the whole batch.
2. Files already known return `was_existing` and skip the upload; new files are PUT to MinIO with progress.
3. `finalize` (or `folder-finalize` for folders) writes the registry rows, commits, then sends `ingestion.ingest_document` to the `ingestion` queue.
4. The worker runs the stages, publishing progress through the events gateway at each stage start (20, 45, 70, 90, 100%).
5. On finalize the document is marked indexed, `document_brief.generate` is queued, and the browser updates its status chip and refreshes the space.

### 6.2 Asking a question

1. The browser mints a session id, registers the session on first send, and calls `retrieval/answer` with the mode, selected spaces and documents.
2. The core API checks access, builds history, commits, and calls the retriever.
3. The retriever's agent searches and reads pages, emitting stage, reasoning and answer-delta events to the browser through the gateway while it works.
4. The HTTP response returns the answer, steps and context usage; the browser replaces the live stream with the formatted message and asks for follow-ups.
5. The core API persists the turn, mirrors it into Redis and queues compaction when the window is nearly full.

## 7. How to explain the system (suggested talking structure)

1. One sentence: a multi-tenant document-intelligence platform (upload, index, ask, extract, review) with self-hosted models.
2. The three tiers: a thin stateless app tier, a Celery fleet per workload, and remote GPU services.
3. The ingestion story: staged pipeline, Postgres canonical, deterministic ids, fail-open enrichment.
4. The retrieval story: a tool-calling agent whose scope is enforced by code; live progress over a broker-secured socket.
5. The tenancy story: organization everywhere, one codebase for shared and dedicated installs.

## 8. Glossary

| Term              | Meaning                                                                                                     |
| ----------------- | ----------------------------------------------------------------------------------------------------------- |
| Space             | A folder-like container in the knowledge base; spaces nest (ltree) and have memberships                     |
| Document registry | The Postgres table with one row per uploaded document (storage key, checksum, status, page count)           |
| Domain profile    | A per-organization setting (`fir`, `general`) that selects retriever tools, prompts and metadata extraction |
| CAG               | The dedicated single-organization deployment (and its audit programme)                                      |
| Events gateway    | The only service allowed to publish to the public exchange; services reach it over HTTP                     |
| Web-STOMP         | RabbitMQ's WebSocket protocol used by the browser for live updates                                          |
| Document brief    | The automatic summary and sentiment generated for each indexed document                                     |
| Pack              | A named set of checks (for example bill validation, treasury tally, assessment rubric)                      |
| HITL              | Human-in-the-loop: a run pauses for a person's approval and resumes                                         |
| ReAct loop        | An agent loop that alternates tool calls and reasoning until it can answer                                  |
| RRF               | Reciprocal-rank fusion, a way to merge ranked lists from several searches                                   |
| ltree             | A Postgres type for tree paths, used for the space hierarchy                                                |
| Presigned URL     | A time-limited object-storage URL that lets the browser upload or download directly                         |
