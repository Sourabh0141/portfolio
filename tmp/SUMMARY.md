# Flare — Comprehensive Technical Architecture & Application Summary

**Flare** is a production-grade, voice-first AI companion web application featuring a stylized full-body 3D animated character with real-time ARKit lip-syncing driven by Web Audio FFT spectral analysis, sub-second latency edge AI processing, and invite-only authentication.

---

## 1. System Overview & Key Capabilities

- **Voice-First Experience**: Bidirectional audio streaming interface. Users speak to Flare via Push-To-Talk (mouse/touch/keyboard) and receive natural speech responses accompanied by 3D facial animation.
- **Edge AI Pipeline**: Orchestrated by a Cloudflare Worker running Hono, integrating DeepInfra for Whisper Large v3 Turbo (Speech-to-Text), Llama 3.1 8B Instruct (LLM reasoning), and Kokoro-82M (Text-to-Speech).
- **Client-Side Lip-Sync (`useVisage`)**: Pure browser-side Web Audio API frequency analysis converting audio playback in real time into 67 ARKit facial blend shapes without requiring heavy server-side phoneme aligners.
- **Relational Persistence**: Cloudflare D1 (SQLite) stores user profiles, conversation threads, and message history with cascading deletes and atomic transactions.
- **Rolling Context Summarization**: An automated background compression pipeline that triggers when non-summary messages exceed 20 turns, summarizing the oldest 10 messages via LLM and replacing them with a synthetic summary row.
- **Zero-Latency Response Streaming**: The API Worker streams binary audio (`audio/mpeg`) immediately upon synthesis, transmitting conversation metadata (`X-Conversation-Id`, `X-User-Transcript`, `X-Assistant-Response`) in HTTP response headers.

---

## 2. Architecture & Data Flow

```mermaid
flowchart TD
    subgraph Client["Next.js 15 SPA (@flare/web)"]
        UI["MainCanvas & PushToTalkButton"]
        AudioCtx["Web Audio API (FFT AnalyserNode)"]
        Avatar3D["Three.js / React Three Fiber (Avatar & Shaders)"]
        ConvCtx["ConversationContext & useConversation"]
    end

    subgraph Edge["Cloudflare Edge API (@flare/api)"]
        HonoApp["Hono HTTP Router"]
        ClerkAuth["Clerk JWT Authentication Guard"]
        ChatRoute["Chat Turn Pipeline (/api/chat)"]
        SummaryEngine["Asynchronous Summarization (c.executionCtx)"]
    end

    subgraph AI["DeepInfra AI Services"]
        ASR["Whisper Large v3 Turbo (STT)"]
        LLM["Llama 3.1 8B Instruct (LLM)"]
        TTS["Kokoro-82M (TTS)"]
    end

    subgraph Storage["Cloudflare Cloud Infrastructure"]
        D1[("Cloudflare D1 (flare-db)")]
        R2[("Cloudflare R2 (flare-assets)")]
        Pages[("Cloudflare Pages (flare-web)")]
    end

    UI -->|Record Voice| ConvCtx
    ConvCtx -->|POST /api/chat (WAV/WebM)| HonoApp
    HonoApp --> ClerkAuth
    ClerkAuth --> ChatRoute
    ChatRoute -->|Transcribe Audio| ASR
    ASR -->|User Transcript| ChatRoute
    ChatRoute -->|Insert User Turn| D1
    ChatRoute -->|Query Context & Summary| D1
    ChatRoute -->|Prompt + Context| LLM
    LLM -->|Assistant Response| ChatRoute
    ChatRoute -->|Insert Assistant Turn| D1
    ChatRoute -->|Synthesize Speech| TTS
    TTS -->|MP3 Audio Buffer| ChatRoute
    ChatRoute -.->|Async waitUntil Trigger| SummaryEngine
    SummaryEngine -->|Compress Oldest Turns| LLM
    SummaryEngine -->|Batch Delete & Insert Summary| D1
    ChatRoute -->|Binary MP3 Stream + HTTP Headers| ConvCtx
    ConvCtx -->|Play Audio Element| AudioCtx
    AudioCtx -->|ARKit Blendshape Weights| Avatar3D
```

---

## 3. Monorepo Structure

The repository is organized into three workspaces plus infrastructure definitions:

```
flare/
├── package.json                 # Monorepo root configuration & scripts
├── .github/
│   └── workflows/
│       └── deploy.yml           # Complete automated CI/CD pipeline
├── terraform/                   # Infrastructure as Code (D1, R2, Pages)
│   ├── providers.tf
│   ├── variables.tf
│   ├── main.tf
│   ├── outputs.tf
│   └── cors.json
├── packages/
│   └── db/                      # Shared Database Access Layer & Schema
│       ├── package.json
│       ├── wrangler.jsonc
│       ├── schema.sql
│       ├── migrations/
│       │   └── 0001_initial_schema.sql
│       └── src/
│           ├── types.ts
│           └── index.ts
└── apps/
    ├── api/                     # Cloudflare Worker Backend Service
    │   ├── package.json
    │   ├── wrangler.jsonc
    │   ├── src/
    │   │   ├── types.ts
    │   │   ├── auth.ts
    │   │   ├── deepinfra.ts
    │   │   ├── summarize.ts
    │   │   ├── index.ts
    │   │   └── routes/
    │   │       ├── health.ts
    │   │       ├── settings.ts
    │   │       ├── conversations.ts
    │   │       └── chat.ts
    │   └── test/
    │       ├── api.test.ts
    │       ├── chat.test.ts
    │       └── summarize.test.ts
    └── web/                     # Next.js 15 Frontend Web Application
        ├── package.json
        ├── next.config.ts
        ├── tailwind.config.ts
        ├── public/
        │   ├── audio/fallback-error.wav
        │   └── models/
        │       ├── avatar.glb
        │       └── animations.glb
        └── src/
            ├── app/
            │   ├── layout.tsx
            │   ├── page.tsx
            │   ├── not-found.tsx
            │   └── globals.css
            ├── components/
            │   ├── Providers.tsx
            │   ├── LandingHero.tsx
            │   ├── MainCanvas.tsx
            │   ├── AvatarCanvas.tsx
            │   ├── Avatar.tsx
            │   ├── PushToTalkButton.tsx
            │   ├── Sidebar.tsx
            │   ├── SettingsModal.tsx
            │   └── ConfirmModal.tsx
            ├── context/
            │   └── ConversationContext.tsx
            ├── hooks/
            │   ├── useConversation.ts
            │   └── useVisage.ts
            └── lib/
                ├── api.ts
                └── utils.ts
```

---

## 4. Database Layer (`@flare/db`)

Location: [`packages/db`](file:///D:/Projects/flare/packages/db/package.json)

### Relational Schema ([`schema.sql`](file:///D:/Projects/flare/packages/db/schema.sql))
1. **`users`**:
   - `id TEXT PRIMARY KEY`: Clerk User Subject ID.
   - `display_name TEXT NOT NULL`: Name used by the AI companion when addressing the user.
   - `created_at INTEGER NOT NULL`, `updated_at INTEGER NOT NULL`: UNIX epoch seconds.
2. **`conversations`**:
   - `id TEXT PRIMARY KEY`: Unique conversation UUID.
   - `user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE`.
   - `title TEXT NOT NULL DEFAULT 'New conversation'`.
   - `created_at INTEGER NOT NULL`, `updated_at INTEGER NOT NULL`.
   - Index: `idx_conversations_user_updated` on `(user_id, updated_at DESC)`.
3. **`messages`**:
   - `id TEXT PRIMARY KEY`: Message UUID.
   - `conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE`.
   - `role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'summary'))`.
   - `content TEXT NOT NULL`: Raw text content or synthetic summary.
   - `created_at INTEGER NOT NULL`.
   - Indices: `idx_messages_conversation_created` on `(conversation_id, created_at ASC)`, `idx_messages_conversation_role` on `(conversation_id, role)`.

### Core Data Access Operations ([`packages/db/src/index.ts`](file:///D:/Projects/flare/packages/db/src/index.ts))
- [`getOrCreateUser`](file:///D:/Projects/flare/packages/db/src/index.ts#L24-L52): Upsert logic ensuring user records exist upon authentication.
- [`createConversation`](file:///D:/Projects/flare/packages/db/src/index.ts#L94-L119), [`listConversations`](file:///D:/Projects/flare/packages/db/src/index.ts#L149-L162), [`getConversation`](file:///D:/Projects/flare/packages/db/src/index.ts#L124-L144), [`updateConversationTitle`](file:///D:/Projects/flare/packages/db/src/index.ts#L167-L182), [`deleteConversation`](file:///D:/Projects/flare/packages/db/src/index.ts#L203-L215): CRUD functions for conversation threads.
- [`isConversationInactive`](file:///D:/Projects/flare/packages/db/src/index.ts#L219-L236): Calculates time delta since last update. If `> 30` minutes, signals the API to create a new session thread.
- [`insertMessage`](file:///D:/Projects/flare/packages/db/src/index.ts#L245-L272): Atomically saves messages and updates parent conversation timestamp in a single `db.batch()` transaction.
- [`getConversationContext`](file:///D:/Projects/flare/packages/db/src/index.ts#L295-L320): Constructs prompt context window by selecting the latest synthetic summary message plus the subsequent non-summary messages.
- [`applyConversationSummary`](file:///D:/Projects/flare/packages/db/src/index.ts#L362-L404): Atomically inserts a new summary record and executes batch deletions for summarized message IDs.

---

## 5. Backend Edge API Worker (`@flare/api`)

Location: [`apps/api`](file:///D:/Projects/flare/apps/api/package.json)

### Router & Middleware Structure ([`apps/api/src/index.ts`](file:///D:/Projects/flare/apps/api/src/index.ts))
- **Hono Edge Framework**: Running under Cloudflare Worker environment with `nodejs_compat`.
- **CORS Middleware**: Explicitly configured for `Content-Type`, `Authorization`, and exposes custom metadata headers (`X-Conversation-Id`, `X-User-Transcript`, `X-Assistant-Response`).
- **Clerk Auth Middleware** ([`apps/api/src/auth.ts`](file:///D:/Projects/flare/apps/api/src/auth.ts)): Parses `Authorization: Bearer <token>`, validates via `@clerk/backend` [`verifyToken`](file:///D:/Projects/flare/apps/api/src/auth.ts#L52-L55), and injects `userId` into the Hono context.

### Route Specifications
| Method | Endpoint | Access | Handler / Description |
|---|---|---|---|
| `GET` | `/` & `/api/health` | Public | [`healthRoutes`](file:///D:/Projects/flare/apps/api/src/routes/health.ts): Returns `{ status: "ok", service: "flare-api" }` |
| `GET` | `/api/settings` | Protected | [`settingsRoutes`](file:///D:/Projects/flare/apps/api/src/routes/settings.ts): Returns authenticated user profile |
| `PATCH` | `/api/settings` | Protected | [`settingsRoutes`](file:///D:/Projects/flare/apps/api/src/routes/settings.ts): Updates user `displayName` (1–50 chars) |
| `GET` | `/api/conversations` | Protected | [`conversationsRoutes`](file:///D:/Projects/flare/apps/api/src/routes/conversations.ts): Lists recent threads ordered by `updated_at DESC` |
| `GET` | `/api/conversations/:id` | Protected | [`conversationsRoutes`](file:///D:/Projects/flare/apps/api/src/routes/conversations.ts): Retrieves thread details and message turns |
| `PATCH` | `/api/conversations/:id` | Protected | [`conversationsRoutes`](file:///D:/Projects/flare/apps/api/src/routes/conversations.ts): Renames conversation title |
| `DELETE` | `/api/conversations/:id` | Protected | [`conversationsRoutes`](file:///D:/Projects/flare/apps/api/src/routes/conversations.ts): Deletes thread and cascading messages |
| `POST` | `/api/chat` | Protected | [`chatRoutes`](file:///D:/Projects/flare/apps/api/src/routes/chat.ts): End-to-end voice turn processing (ASR $\rightarrow$ LLM $\rightarrow$ TTS) |

### Voice Turn Pipeline Execution ([`apps/api/src/routes/chat.ts`](file:///D:/Projects/flare/apps/api/src/routes/chat.ts))
1. **Request Ingestion**: Extracts `audio` file (`Blob`) and optional `conversationId` from `multipart/form-data`.
2. **Session Thread Resolution**: Checks if conversation exists and is active within 30 minutes; creates a new conversation if inactive or absent.
3. **Speech-to-Text (ASR)**: Sends audio to DeepInfra Whisper Large v3 Turbo via [`transcribeAudio`](file:///D:/Projects/flare/apps/api/src/deepinfra.ts#L48-L79).
4. **Context Construction & LLM Reasoning**: Retrieves context from D1, appends system prompt (instructing Flare to answer concisely in 1–3 conversational sentences without markdown/lists/emojis), and calls DeepInfra Llama 3.1 8B Instruct via [`generateChatCompletion`](file:///D:/Projects/flare/apps/api/src/deepinfra.ts#L84-L122).
5. **Dynamic Title Generation**: If the thread is new, generates a 3–5 word title via [`generateConversationTitle`](file:///D:/Projects/flare/apps/api/src/deepinfra.ts#L127-L175) and updates D1.
6. **Speech Synthesis (TTS)**: Synthesizes assistant response into MP3 audio via DeepInfra Kokoro-82M (`af_heart` voice) via [`synthesizeSpeech`](file:///D:/Projects/flare/apps/api/src/deepinfra.ts#L180-L216).
7. **Background Summarization**: Enqueues [`maybeTriggerSummarization`](file:///D:/Projects/flare/apps/api/src/summarize.ts#L35-L113) into `c.executionCtx.waitUntil(...)`.
8. **Response Return**: Returns binary MP3 payload directly with custom headers.

---

## 6. Frontend Client Application (`@flare/web`)

Location: [`apps/web`](file:///D:/Projects/flare/apps/web/package.json)

### Core Components & Hierarchy
- **[`Providers`](file:///D:/Projects/flare/apps/web/src/components/Providers.tsx)**: Wraps app in `<ClerkProvider>` and [`<ConversationProvider>`](file:///D:/Projects/flare/apps/web/src/context/ConversationContext.tsx).
- **[`HomePage`](file:///D:/Projects/flare/apps/web/src/app/page.tsx)**: Renders [`LandingHero`](file:///D:/Projects/flare/apps/web/src/components/LandingHero.tsx) when logged out, and [`MainCanvas`](file:///D:/Projects/flare/apps/web/src/components/MainCanvas.tsx) + [`Sidebar`](file:///D:/Projects/flare/apps/web/src/components/Sidebar.tsx) when logged in.
- **[`MainCanvas`](file:///D:/Projects/flare/apps/web/src/components/MainCanvas.tsx)**: Hosts 3D scene stage, status pill (`Ready`, `Listening...`, `Thinking...`, `Speaking`), hidden `<audio>` element, and [`PushToTalkButton`](file:///D:/Projects/flare/apps/web/src/components/PushToTalkButton.tsx).
- **[`Sidebar`](file:///D:/Projects/flare/apps/web/src/components/Sidebar.tsx)**: Displays conversation list with relative time formatting (`formatRelativeTime`), new chat creation, inline rename, delete confirmation ([`ConfirmModal`](file:///D:/Projects/flare/apps/web/src/components/ConfirmModal.tsx)), and settings modal ([`SettingsModal`](file:///D:/Projects/flare/apps/web/src/components/SettingsModal.tsx)).

### 3D Avatar Rendering & Procedural Animation ([`apps/web/src/components/Avatar.tsx`](file:///D:/Projects/flare/apps/web/src/components/Avatar.tsx))
- **WebGL Engine**: React Three Fiber (`@react-three/fiber`) & Drei (`@react-three/drei`).
- **Asset Loading**: Uses `useGLTF` to load `/models/avatar.glb` and `/models/animations.glb`.
- **Procedural Blinking**: Frame-loop timer triggers random natural eye blinks (every 2.5–5.5 seconds) smoothly modulating `eyeBlinkLeft` and `eyeBlinkRight` morph targets.
- **Micro-Movements & State Postures**:
  - `idle`: Subtle sinusoidal breathing oscillation on Y axis and organic sway.
  - `listening`: Slight forward tilt ($X$-axis rotation) and attentive orientation.
  - `processing`: Reflective head tilt ($Z$-axis and $X$-axis rotation).
  - `speaking`: Dynamically switches between talking body animation clips (`Talking_0`, `Talking_1`, `Talking_2`).

### Real-Time ARKit Lip-Sync (`useVisage`) ([`apps/web/src/hooks/useVisage.ts`](file:///D:/Projects/flare/apps/web/src/hooks/useVisage.ts))
The `useVisage` hook taps the audio output via Web Audio API `createMediaElementSource` and an `AnalyserNode` ($FFT = 512$). It analyzes frequency bins across 4 formant bands and computes ARKit blend shape weights in real time:
- **Low Frequencies (100–500 Hz)**: Jaw opening and vowel resonance $\rightarrow$ `jawOpen`, `viseme_aa`, `viseme_O`.
- **Mid-Low Frequencies (500–1200 Hz)**: Open vowel formants $\rightarrow$ `viseme_aa`, `viseme_E`.
- **Mid-High Frequencies (1200–2800 Hz)**: Closed vowel & dental formants $\rightarrow$ `viseme_I`, `viseme_U`, `viseme_TH`.
- **High Frequencies (2800–6000 Hz)**: Sibilance & fricatives $\rightarrow$ `viseme_SS`, `viseme_FF`, `viseme_CH`.

Interpolation is computed per-frame at 60fps using `THREE.MathUtils.lerp(current, target, delta * 25)`.

### Push-to-Talk State Machine (`useConversation`) ([`apps/web/src/hooks/useConversation.ts`](file:///D:/Projects/flare/apps/web/src/hooks/useConversation.ts))
- **States**: `idle` $\rightarrow$ `listening` $\rightarrow$ `processing` $\rightarrow$ `speaking`.
- **Microphone Capture**: Captures audio stream using `MediaRecorder` with WebM/Opus encoding. Filters out micro-taps ($<250$ms).
- **Keyboard Shortcuts**: Hold `Space` to speak; tap `Space` or `Esc` while speaking to interrupt.
- **Instant Interruption**: Aborts inflight requests via `AbortController`, pauses audio playback, resets `MediaRecorder`, and returns avatar to `idle`.
- **Fallback Recovery**: Plays `/audio/fallback-error.wav` if an error occurs during audio transmission or synthesis.

---

## 7. Infrastructure as Code & CI/CD Pipeline

### Terraform Resource Declarations ([`terraform/main.tf`](file:///D:/Projects/flare/terraform/main.tf))
- **`cloudflare_r2_bucket.app_assets`**: Stores GLB 3D models and audio fallback assets.
- **`cloudflare_d1_database.flare_db`**: Provisions the D1 relational database.
- **`cloudflare_pages_project.frontend`**: Configures Cloudflare Pages project for static Next.js export (`out/`).
- **Remote Backend**: S3-compatible state backend storing state in R2 (`flare-tf-state`).

### CI/CD Deployment Workflow ([`.github/workflows/deploy.yml`](file:///D:/Projects/flare/.github/workflows/deploy.yml))
Runs on every push to `main`:
1. **Terraform Apply**: Runs `terraform apply -auto-approve` to ensure all cloud resources are provisioned.
2. **D1 Migrations**: Applies SQL schema migrations via `wrangler d1 migrations apply flare-db --remote`.
3. **Worker Secrets & Deployment**: Deploys `@flare/api` Worker and sets `CLERK_SECRET_KEY` and `DEEPINFRA_API_KEY`.
4. **Next.js Static Build**: Compiles `@flare/web` into static export (`out/`).
5. **Cloudflare Pages Deployment**: Deploys `out/` directory to Cloudflare Pages.

---

## 8. Test Suites & Quality Assurance

The codebase contains an automated test suite located in [`apps/api/test`](file:///D:/Projects/flare/apps/api/test/api.test.ts) powered by Vitest:

- **[`api.test.ts`](file:///D:/Projects/flare/apps/api/test/api.test.ts)**:
  - Validates public routes (`/` and `/api/health`).
  - Verifies CORS preflight `OPTIONS` handling.
  - Tests Clerk JWT authentication enforcement (rejecting missing, malformed, and invalid tokens with 401).
  - Tests profile settings retrieval and updates (`GET /api/settings`, `PATCH /api/settings`).
  - Tests conversation lifecycle (list, fetch, rename, cascade delete).
- **[`chat.test.ts`](file:///D:/Projects/flare/apps/api/test/chat.test.ts)**:
  - Tests end-to-end voice turn pipeline (Whisper $\rightarrow$ Llama $\rightarrow$ Kokoro).
  - Validates conversation title auto-generation.
  - Tests 30-minute inactivity session branching.
  - Tests error handling (503 Service Unavailable when AI provider fails).
- **[`summarize.test.ts`](file:///D:/Projects/flare/apps/api/test/summarize.test.ts)**:
  - Verifies threshold check ($\le 20$ messages does not trigger; $\ge 21$ triggers summarization).
  - Tests batch deletion of oldest 10 messages and creation of synthetic summary row.
  - Verifies LLM prompt context construction with summary prepending.
  - Tests rolling summary merges over multiple iterations.

All **21 automated unit and integration tests** pass, and full TypeScript type checking across all workspaces succeeds with zero errors.
