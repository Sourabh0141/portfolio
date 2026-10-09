# Flare — Project Overview

## 1. What it is, in one minute

Flare is a real-time, voice-first AI companion featuring an expressive 3D character that listens, thinks, and speaks with synchronized lip movements. Built as a monorepo deployed entirely on Cloudflare's serverless edge, Flare orchestrates low-latency voice interactions by chaining automated speech recognition (Whisper Large v3 Turbo), a language model (Llama 3.1 8B Instruct), and neural speech synthesis (Kokoro 82M), while rendering an animated character in the browser using React Three Fiber and Web Audio spectral analysis.

Two-sentence version: "Flare is an edge-native, voice-first AI companion combining a statically exported Next.js 3D web client with a Cloudflare Workers backend running Hono, D1, and R2. It achieves instant interactive dialogue through streaming Server-Sent Events, sentence-level overlapping text-to-speech synthesis, adaptive client-side voice activity detection, and browser-computed FFT lip-sync driving 67 ARKit blend shapes with zero server phoneme alignment overhead."

## 2. Problem and purpose

| Problem                                                                                                                            | How the system addresses it                                                                                                                                                                                                                                                   |
| :--------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Conversational voice AI often suffers high turn latency (3–6 seconds) when chaining STT, LLM generation, and TTS sequentially      | The backend streams text via Server-Sent Events (SSE) and synthesizes audio sentence by sentence as punctuation arrives, sending base64 audio chunks so client playback begins while the LLM is still writing subsequent sentences                                            |
| Server-side phoneme alignment or viseme extraction (e.g. forced aligners) adds substantial compute cost and network latency        | Real-time spectral lip-sync runs entirely in the browser using Web Audio API FFT analysis, mapping frequency bands directly to 16 ARKit viseme blend shapes at 60 FPS with zero server overhead                                                                               |
| 3D WebGL assets (GLTF/GLB) with full skeletal rigs and animation sets are heavy (10–15 MB), causing slow initial page loads        | Staged asset pipeline using `@gltf-transform/cli`: geometry is meshopt-compressed with WebP textures (0.6 MB), a standalone breathing `idle.glb` (90 KB) loads instantly, and the full animation pack (`animations.glb`, 0.94 MB) streams in the background                   |
| Continuous conversational voice streaming across long threads causes ballooning token costs and prompt window exhaustion           | Automatic rolling context summarization runs asynchronously via `executionCtx.waitUntil()`, condensing historical messages into concise prose (<150 words) without blocking the active response                                                                               |
| Voice activity detection in browser environments often triggers false positives from ambient room noise or speaker feedback (echo) | Dual-engine VAD architecture: an adaptive energy gate (`VadGate`) continuously tracking room noise floor with a "guarded mode" that raises thresholds during playback to enable natural user barge-in without echo self-triggering, plus optional on-device Silero neural VAD |
| Infrastructure costs for personal and prototype AI applications scale rapidly on traditional containerized cloud platforms         | Entire platform runs on Cloudflare's serverless free/edge tier (Workers, D1 SQLite, R2 object storage, Pages CDN) with Cloudflare Rate Limiting bindings and a daily turn quota (300 turns/day) protecting AI provider billing                                                |

**Who uses it:**

| Actor                             | What they do                                                                                                                                                           |
| :-------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public visitor                    | Explores marketing landing page, interacts with preview 3D avatar, listens to voice samples, and submits an invite request protected by Cloudflare Turnstile           |
| Authenticated companion user      | Speaks with Flare via push-to-talk or hands-free voice activity detection; configures voices, personas, and display preferences; reviews threaded conversation history |
| Administrator                     | Reviews and moderates pending invite requests; triggers official Clerk onboarding email invitations; oversees user activity and quotas                                 |
| Operator / CI/CD (GitHub Actions) | Deploys infrastructure via Terraform; applies D1 database migrations; provisions Worker secrets; deploys API Workers and static Pages client                           |

## 3. Features

- **Voice-first conversational loop**: Natural voice conversations initiated via hold-to-speak (push-to-talk) or continuous hands-free voice activity detection.
- **Real-time 3D expressive character**: WebGL character powered by React Three Fiber and Three.js with skeletal rigging, 67 ARKit blend shapes, and interactive pointer gaze tracking.
- **Zero-server FFT lip-sync**: 60 FPS real-time speech viseme extraction computed directly in the browser via Web Audio API `AnalyserNode` frequency spectrum analysis.
- **Procedural character behaviors**: Subtle lifelike micro-animations including autonomous eye blinking, saccadic glance shifts, breathing cycles, idle torso swaying, and weight shifts.
- **Emotional and gestural expression engine**: Model chooses from 10 distinct emotions (`happy`, `thoughtful`, `amused`, etc.) and 5 physical gestures (`nod`, `shake`, `laugh`, `dance`) with variable intensity (0.2–1.0).
- **Overlapping streaming audio pipeline**: Sentence-level text-to-speech synthesis streamed as base64 audio events over Server-Sent Events (SSE), enabling instant speech playback before the full response is generated.
- **Echo-guarded barge-in support**: Users can interrupt Flare mid-sentence; the client aborts audio playback and cancels upstream Worker execution via `AbortSignal`.
- **Dual Voice Activity Detection (VAD)**: Adaptive room-calibrated energy gate (`VadGate`) with dynamic noise floor tracking, supplemented by client-side Silero neural VAD powered by ONNX Runtime Web.
- **Multi-language support**: Whisper automatically detects spoken input language; Flare responds in that language and dynamically maps playback to native Kokoro voice models across 7 non-English languages (Spanish, French, Hindi, Italian, Japanese, Portuguese, Chinese).
- **Customizable companion personas**: 4 prompt-tuned behavioral personas (`Warm`, `Witty`, `Calm`, `Curious`) that reshape Flare's conversational style and tone.
- **Voice selection catalogue**: 8 curated Kokoro voices spanning American and British accents across feminine and masculine registers.
- **Conversation organization**: Persistent conversation threads stored in Cloudflare D1 with automatic title generation, pinning, archiving, and chronological message history.
- **Rolling context summarization**: Background summarization of past messages triggered when conversations exceed token windows, preserving long-term conversational memory cheaply.
- **Turnstile-protected invite system**: Public invite application workflow protected against spam bots using Cloudflare Turnstile verification.
- **Admin review dashboard**: Authenticated administrative dashboard to review, approve, or reject access requests and automatically dispatch Clerk user invitations.
- **Infrastructure as Code**: Complete Cloudflare edge resource definitions (D1, R2, Pages) automated via Terraform with remote R2 state storage.

## 4. Architecture

### 4.1 Components

```text
  Client (apps/web - Next.js 16 + R3F)
    - Web Audio Player (FFT Visemes) <------- [Streaming SSE Chunks] -------+
    - 3D Avatar (meshopt, ARKit shapes)                                      |
    - Voice Activity Detector (VAD)                                          |
    - Clerk React SDK (Auth tokens)                                          |
                                                                             |
                                   v (HTTPS / Audio upload)                  |
  Edge API (apps/api - Cloudflare Workers + Hono)                            |
    - Request Context & Correlation ID                                       |
    - Rate Limiters (TURN, API, PUBLIC)                                      |
    - Clerk Auth JWT Validation (Offline Verification)                       |
    - Turn Orchestrator (/api/turns/respond) --------------------------------+
        |                                     |
        v                                     v
  DeepInfra Inference Services          Cloudflare D1 Database (packages/db)
    - STT: Whisper Large v3 Turbo         - users
    - LLM: Meta Llama 3.1 8B Instruct     - conversations
    - TTS: Kokoro 82M Neural Synthesis    - messages (with emotions & gestures)
                                          - invite_requests
```

| Component            | Technology                                                                             | Responsibility                                                                                                                        |
| :------------------- | :------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/web`           | Next.js 16 (Static Export), React 19, React Three Fiber, Three.js, Tailwind 4, Zustand | WebGL canvas, 3D character rigging, audio recording, FFT lip-sync calculation, and thread management                                  |
| `apps/api`           | Hono 4, Cloudflare Workers, `@clerk/backend`, Zod                                      | HTTP routing, Clerk JWT validation, SSE streaming, turn orchestration, rate limiting, and model communication                         |
| `packages/contracts` | TypeScript, Zod                                                                        | Shared API request/response contracts, emotion/gesture enums, voice definitions, character blend shape schemas, and validation limits |
| `packages/db`        | Cloudflare D1 (SQLite), SQL Migrations                                                 | Typed data access layer, user preference persistence, message storage with cascading deletes, and invite tracking                     |
| `terraform/`         | Terraform 1.15+, Cloudflare Provider                                                   | Infrastructure as Code defining D1 databases, R2 storage buckets, and Cloudflare Pages projects                                       |

### 4.2 Voice Turn Lifecycle and Streaming Pipeline

1. **Audio Capture**: The user records voice via push-to-talk (`recorder.ts`) or hands-free voice activity detection (`vad.ts`). Audio is packaged into a raw binary blob (`audio/webm`, `audio/mp4`, etc.) capped at 4 MiB.
2. **Transcription (`POST /api/turns/transcribe`)**: The client sends raw audio bytes to the Worker. The Worker delegates to Whisper Large v3 Turbo on DeepInfra without buffering or parsing multipart form boundaries. The endpoint returns the plain transcript and detected ISO language code.
3. **Turn Request (`POST /api/turns/respond`)**: The client sends the user transcript, active `conversationId`, and detected language to the Worker.
4. **Session & Quota Verification**:
   - The Worker validates the Clerk JWT token offline using the public key (`CLERK_JWT_KEY`).
   - Rate limiters check per-user burst thresholds (`TURN_RATE_LIMITER`: 40 turns / 60 seconds).
   - The database counts user turns for the current UTC day; if turns exceed `DAILY_TURN_LIMIT` (300), the request is rejected with 429 `quota_exceeded`.
5. **Thread Management**: If `conversationId` is missing or has been idle for longer than 30 minutes (`CONVERSATION_STALE_SECONDS = 1800`), a fresh conversation thread is created.
6. **Prompt Assembly & Non-JSON Tag Generation**:
   - System prompt instructs Llama 3.1 8B to output a concise 1–3 sentence reply formatted with a single metadata tag on line 1: `[emotion|gesture|intensity|title]`.
   - The LLM stream begins.
7. **Expression Event & Sentence Synthesis**:
   - As soon as the opening tag line is received, the Worker emits an SSE `expression` event containing the emotion, gesture, and intensity. The 3D character transitions immediately.
   - The Worker streams text deltas to the client.
   - Punctuation markers (`.`, `!`, `?`, `:`) and CJK stops (`。！？`) split text into discrete sentences using `SentenceSplitter`. Latin stops require trailing whitespace so decimals (e.g. `3.50`) do not split, and fragments under 5 characters are merged into subsequent sentences for natural TTS cadence.
   - As each sentence finishes, the text is sanitized via `sanitiseSpeech` (stripping markdown syntax and backticks) and dispatched to Kokoro-82M on DeepInfra.
   - An ordered promise queue (`audioChain`) sends base64 audio chunks sequentially as `audio` SSE events.
8. **Client Playback & Hybrid Lip-Sync Animation**:
   - The client Web Audio scheduler (`player.ts`) queues each sentence buffer.
   - When sentence text is available, `buildVisemeTimeline` constructs a grapheme-to-viseme timeline distributing vowels, consonants, and digraphs across audio duration for accurate mouth shape timing.
   - Concurrently, an `AnalyserNode` captures frequency spectrum data every frame, driving jaw opening (`jawOpen`) and amplitude energy dynamics.
   - `blendVisemes()` fuses text-timed mouth shapes with acoustic spectral energy, giving frame-rate lip-sync with realistic mouth dynamics.
9. **Asynchronous Background Summarization**:
   - Once the SSE stream terminates, `executionCtx.waitUntil()` triggers `maybeSummarize()`.
   - If conversation history exceeds threshold token bounds, Llama 3.1 creates an updated rolling prose summary (<150 words) and stores it in D1 without delaying the user's turn.

### 4.3 3D Character Engine and Procedural Lip-Sync

- **Model Optimization**: Source 3D assets in `models-src/` are processed with `@gltf-transform/cli`:
  - `avatar.glb` (0.6 MB): Skinned mesh with 67 ARKit blend shapes, meshopt attribute compression, and 1024px WebP texture maps.
  - `idle.glb` (90 KB): Standalone breathing idle clip loaded synchronously for instant first visual paint.
  - `animations.glb` (0.94 MB): Remaining animation clips (9 total: `Idle`, 3 `Talking` variants, `Laughing`, `Angry`, `Crying`, `Terrified`, `Rumba`) streamed after initial interaction.
- **Lip-Sync & Expression Decoupling**:
  - Facial expression presets (`EXPRESSIONS`) only manipulate morph targets that do not conflict with mouth shapes (eyebrows, eyes, cheeks, mouth corners). This allows Flare to maintain an emotional expression (e.g. happy smile, amused eyebrow lift, or concerned frown) while the lips and jaw move freely to articulate speech.
- **Hybrid Spectral + Grapheme Viseme Extraction**:
  - Grapheme timeline maps English and foreign text to 16 ARKit visemes (`jawOpen`, `viseme_aa`, `viseme_E`, `viseme_I`, `viseme_O`, `viseme_U`, `viseme_SS`, `viseme_FF`, `viseme_TH`, `viseme_PP`, etc.).
  - Spectral FFT analysis (`visemesFromSpectrum`) extracts normalized energy across 4 key acoustic frequency bands:
    - Low (80–400 Hz): Voicing and jaw opening (`jawOpen`, `viseme_sil`).
    - Formant 1 (400–1100 Hz): Open vowel sounds (`viseme_aa`, `viseme_O`, `viseme_E`).
    - Formant 2 (1100–2600 Hz): Front vowels (`viseme_I`, `viseme_U`).
    - High (2600–6500 Hz): Fricatives and sibilants (`viseme_SS`, `viseme_FF`, `viseme_TH`, `viseme_CH`).
  - `blendVisemes()` blends both signals: text provides timing precision, while spectral audio energy controls physical amplitude and mouth opening.
- **Procedural Behavior System**:
  - `stepBlink`: Periodic eyelid closure with randomized intervals (2.5–6.0 seconds).
  - `stepGaze`: Interpolates eye and head bone rotation towards the user's cursor position.
  - `stepGlance`: Periodic natural eye darting away from and back to center.
  - `stepHeadGesture`: Smooth procedural nod (pitch) and shake (yaw) applied directly to the `Head` bone without requiring skeletal animation clips.
  - `idleSway` & `weightShift`: Subtle low-frequency sinusoidal breathing and posture adjustments preventing the avatar from appearing static.

### 4.4 Voice Activity Detection (VAD) and Barge-In

- **Adaptive Energy Gate (`VadGate`)**:
  - Operates on Web Audio RMS levels with configurable attack (90 ms), release (750 ms), and minimum speech duration (350 ms).
  - Continuously samples room background noise during idle phases to compute an adaptive threshold: `max(minThreshold, noiseFloor * gain + margin)`.
  - **Guarded Mode**: Activated while Flare is speaking. Increases detection thresholds by 2.6x and attack windows to 260 ms to prevent the microphone from picking up the device's own speaker output while still permitting deliberate user interruptions (barge-in).
- **Neural Silero VAD**: Optional on-device neural voice detector executing Silero ONNX models via `onnxruntime-web` for high-noise acoustic environments.
- **Barge-In Interruption**: When user speech is validated during playback, the client instantly pauses audio buffers and signals an HTTP abort to terminate upstream Worker processing.

### 4.5 Data Model and Migrations

Stored in SQLite on Cloudflare D1 across 4 sequential SQL migrations:

```text
       users
      +---------------------+
      | id (PK, Clerk ID)   |
      | display_name        |
      | voice               |
      | persona             |
      +----------+----------+
                 | 1
                 |
                 | N (ON DELETE CASCADE)
                 v
       conversations
      +---------------------+
      | id (PK)             |
      | user_id (FK)        |
      | title               |
      | pinned / archived   |
      +----------+----------+
                 | 1
                 |
                 | N (ON DELETE CASCADE)
                 v
       messages
      +---------------------+
      | id (PK)             |
      | conversation_id(FK) |
      | role                |  ('user', 'assistant', 'summary')
      | content             |
      | emotion / gesture   |
      | intensity / language|
      +---------------------+
```

- **`invite_requests`**: Stores public access applications with applicant name, email, justification, client IP hash, user agent, and status (`pending`, `approved`, `rejected`).
- **Indexes**: Indexed for user update recency (`idx_conversations_user_list`), chronological conversation message retrieval (`idx_messages_conversation_created`), and invite email lookups.

## 5. Technology stack

| Layer                            | Technology                                                                                 |
| :------------------------------- | :----------------------------------------------------------------------------------------- |
| **Frontend Framework**           | Next.js 16.3.6 (Statically Exported), React 19.3.0, TypeScript 5.9                         |
| **3D & Animation**               | Three.js 0.186, React Three Fiber 9.8, `@react-three/drei` 10.7, `@gltf-transform/cli` 4.5 |
| **Audio & Speech Processing**    | Web Audio API (`AudioContext`, `AnalyserNode`), `@ricky0123/vad-web`, `onnxruntime-web`    |
| **State Management & UI**        | Zustand 5.0, Tailwind CSS 4.3, Lucide React                                                |
| **Edge API Framework**           | Hono 4.13 on Cloudflare Workers (`compatibility_date: 2026-09-01`)                         |
| **Database & Storage**           | Cloudflare D1 (SQLite), Cloudflare R2 (S3-compatible bucket)                               |
| **Authentication & Bot Defense** | Clerk (`@clerk/clerk-react`, `@clerk/backend`), Cloudflare Turnstile                       |
| **AI Models (DeepInfra)**        | Whisper Large v3 Turbo (STT), Meta Llama 3.1 8B Instruct (LLM), Kokoro 82M (TTS)           |
| **Testing & Quality**            | Vitest 4.1 (`@cloudflare/vitest-plugin`), ESLint 9, Prettier                               |
| **Infrastructure & CI/CD**       | Terraform 1.15+, Cloudflare Pages, GitHub Actions                                          |

## 6. Cross-cutting subsystems

### 6.1 Authentication and Edge Verification

- **Zero-Network JWT Verification**: The Worker receives session JWTs from Clerk in `Authorization: Bearer <token>`. Using Clerk's exported public key (`CLERK_JWT_KEY`), the Worker verifies signature validity, expiry, and claims locally at the edge without issuing an outbound HTTP request to Clerk's servers.
- **Admin Authorization**: The `/api/admin/*` router inspects Clerk user metadata and role claims. Validated administrators can review pending invites; approving an invite invokes the Clerk Admin API to dispatch official email invitations.

### 6.2 Rate Limiting and Quota Enforcement

- **Edge Rate Limiting**: Enforced via Cloudflare Rate Limiting bindings:
  - `TURN_RATE_LIMITER`: 40 turns per 60 seconds per user on voice interactions.
  - `API_RATE_LIMITER`: 240 requests per 60 seconds per user across standard endpoints.
  - `PUBLIC_RATE_LIMITER`: 6 requests per 60 seconds per IP on the invite application endpoint.
- **Spending Protection**: A daily allowance (`DAILY_TURN_LIMIT = 300`) tracked in D1 prevents unexpected AI provider billing spikes.

### 6.3 Infrastructure as Code (Terraform)

- **Edge Resource Management**: Defined in `terraform/main.tf` using modular Terraform architecture:
  - `d1-database`: Provisions `flare-db`.
  - `r2-bucket`: Provisions `flare-assets` for static 3D models.
  - `pages-project`: Provisions `flare-ai` with continuous deployment triggers.
- **Remote State**: Terraform state is stored securely in an encrypted Cloudflare R2 bucket configured with S3-compatible backend credentials.

### 6.4 Continuous Integration and Deployment (CI/CD)

The `.github/workflows/deploy.yml` pipeline automates deployment to production:

1. **Verification**: Enforces Node 22, `npm ci`, and runs `typecheck`, `lint`, and unit test suites across all monorepo packages.
2. **Infrastructure Sync**: Initializes and applies Terraform changes against Cloudflare.
3. **Database Migration**: Executes `wrangler d1 migrations apply flare-db --remote` against the live D1 instance.
4. **Secret Deployment**: Injects sensitive secrets (`CLERK_SECRET_KEY`, `DEEPINFRA_API_KEY`, `TURNSTILE_SECRET_KEY`) directly into the Worker environment using `wrangler secret put`.
5. **Worker & Pages Deployment**: Deploys the API Worker via `wrangler deploy` and publishes the static web export (`apps/web/out`) to Cloudflare Pages via `wrangler pages deploy`.

## 7. Technical challenges and noteworthy details

1. **Zero-Latency Hybrid Lip-Sync Without Server Phoneme Aligners**:
   Traditional server-side speech aligners (e.g. Gentle, Montreal Forced Aligner) add 500–1200 ms of latency before playback can begin. Flare shifts alignment completely to the client using a hybrid model: sentence text constructs a grapheme-to-viseme timeline for accurate mouth shape timing, while Web Audio FFT spectral energy simultaneously modulates jaw opening and speech amplitude at 60 FPS, fusing timing precision with acoustic amplitude at zero server compute cost.
2. **Overlapping Sentence-Level Speech Synthesis**:
   Rather than waiting for the entire LLM response to complete before calling TTS, Flare uses a regex sentence boundary detector on the streaming LLM tokens. As each complete sentence finishes, it is immediately dispatched to Kokoro-82M. Base64 audio chunks arrive in an ordered promise chain (`audioChain`), enabling playback within ~600 ms of turn submission.
3. **Non-JSON LLM Header for Instant Emotion Extraction**:
   Forcing structured JSON output from an LLM requires buffering tokens or complex grammar constraints that delay audio streaming. Flare instructs Llama 3.1 to emit a plain single-line tag (`[emotion|gesture|intensity|title]`) as its first output, followed immediately by normal spoken prose. The server parses this tag in the first chunk, triggers avatar facial animations immediately, and streams the remaining sentences seamlessly.
4. **Staged GLB Loading with Meshopt and WebP**:
   Full 3D rigged characters with animation clips easily exceed 10 MB, causing noticeable delay on mobile connections. Flare breaks the model into two parts: a 90 KB `idle.glb` clip extracted at build time that lets the avatar appear and breathe instantly, while the primary 0.94 MB animation clip set loads in the background.
5. **Echo-Resistant Barge-In with Guarded VAD**:
   During active speaker playback, acoustic feedback from device speakers can trigger client microphone activity, causing the assistant to interrupt itself. Flare's VAD implements a dynamic "guarded mode" during assistant playback that raises detection thresholds by 2.6x and lengthens attack windows, ensuring only deliberate human speech triggers barge-in.
6. **Edge Execution Without Serverless Cold Starts**:
   By building the entire backend on Cloudflare Workers and D1 rather than containerized runtimes (e.g. AWS Lambda with Docker or Node.js), API execution begins within 5–15 ms globally with zero container spin-up lag.

## 8. How to explain the system (suggested talking structure)

1. **Purpose & Concept**: A voice-first AI companion featuring an expressive 3D animated character, running entirely on serverless edge infrastructure.
2. **Architecture**: Monorepo combining a Next.js 16 + React Three Fiber frontend with a Cloudflare Workers backend (Hono, D1, R2) and DeepInfra model serving (Whisper, Llama 3.1, Kokoro).
3. **Core Real-Time Innovations**:
   - Browser-side FFT spectral lip-sync driving 67 ARKit blend shapes with zero server phoneme alignment latency.
   - Punctuation-based sentence streaming overlapping neural TTS synthesis with LLM token generation.
   - Guarded voice activity detection enabling echo-resistant conversational barge-in.
4. **Operations & Economics**: Infrastructure managed with Terraform and GitHub Actions; designed to operate securely within edge free-tier allowances and strict rate-limiting cost guardrails.

## 9. Glossary

| Term                               | Meaning                                                                                                                                            |
| :--------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ARKit Blend Shapes**             | A standardized set of 52+ facial morph targets established by Apple for detailed facial animation, tracking, and expressive character deformation. |
| **Viseme**                         | The visual counterpart of a phoneme; the facial and mouth shape corresponding to a specific sound.                                                 |
| **VAD (Voice Activity Detection)** | An algorithm that detects the presence or absence of human speech in an audio stream to automate recording start and stop boundaries.              |
| **FFT (Fast Fourier Transform)**   | An algorithm that computes the discrete Fourier transform of a sequence, converting time-domain audio signals into frequency spectrum bins.        |
| **Barge-In**                       | The capability for a user to speak and interrupt an AI assistant while it is actively playing back a response.                                     |
| **SSE (Server-Sent Events)**       | A unidirectional HTTP streaming protocol allowing a server to push real-time events to a browser over a persistent connection.                     |
| **Cloudflare D1**                  | Cloudflare's serverless, globally distributed relational database built on SQLite with edge replication.                                           |
| **Cloudflare R2**                  | Cloudflare's S3-compatible, zero-egress-fee object storage service.                                                                                |
| **Kokoro-82M**                     | A lightweight, high-speed neural text-to-speech model capable of natural speech synthesis at low compute footprints.                               |
| **Meshopt**                        | A geometry compression library that optimizes GLTF mesh data for fast GPU decoding and minimal transmission size.                                  |
