# Kokoro TTS — Project Overview

## 1. What it is, in one minute

Kokoro TTS is a high-performance, containerized Text-to-Speech microservice and companion web application powered by the 82-million parameter Kokoro neural TTS model (`hexgrad/Kokoro-82M`). Built with FastAPI, PyTorch, and Streamlit, the system exposes an authenticated HTTP REST API capable of synthesizing natural speech in multiple languages with customizable voices and playback speeds, returning industry-standard 24 kHz 16-bit PCM WAV audio.

Two-sentence version: "Kokoro TTS is a production-ready, containerized speech synthesis microservice combining a FastAPI inference backend with a modular Streamlit testing interface powered by the Kokoro-82M model. It pairs dynamic filesystem-based voice discovery with hierarchical double-checked locking, lazy language pipeline initialization, and automatic TTL memory cleanup to deliver low-latency audio generation with bounded server RAM usage."

## 2. Problem and purpose

| Problem                                                                                                                                | How the system addresses it                                                                                                                                                                             |
| :------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Cloud-hosted commercial TTS APIs (e.g., ElevenLabs, OpenAI) impose recurring token costs, rate limits, and network latency             | Provides a self-hosted, offline-capable neural TTS microservice running on consumer CPU or GPU hardware with zero recurring per-character pricing                                                       |
| Loading dozens of multi-megabyte voice embeddings into RAM at boot time creates huge memory overhead on resource-constrained servers   | Implements an on-demand Voice Manager with lazy loading and configurable Time-To-Live (TTL) cache eviction (default 10 min), keeping only active voices in memory                                       |
| Synchronous PyTorch tensor generation blocks FastAPI's asynchronous event loop, starving health checks and concurrent API requests     | Offloads audio synthesis execution to worker threads via `asyncio.to_thread`, keeping the event loop responsive to incoming HTTP requests, health probes, and metrics queries                           |
| Heavy ML checkpoints with inconsistent formats (e.g., PyTorch Lightning wrappers, DataParallel prefixes) fail to load in standard code | Preprocesses state dictionaries at boot time, unwrapping nested Lightning wrappers and stripping `module.` keys before injecting clean weights into Kokoro model instances                              |
| Upstream model libraries attempt Hugging Face Hub internet downloads even when weights are already pre-downloaded locally              | Monkey-patches Hugging Face Hub download methods and intercepts `torch.load` calls to prioritize local disk checkpoints, enabling fully air-gapped container execution                                  |
| Adding or updating voice profiles typically requires modifying database schemas or hardcoded configuration maps                        | Dynamically inspects the voices directory at boot time, parsing language and gender metadata from filenames (`{lang}{gender}_{name}.pt`) into an organized catalog without code or schema modifications |
| Japanese speech synthesis fails without specialized morphological dictionaries                                                         | Integrates MeCab and UniDic into the Debian container environment, configuring `MECABRC` and auto-downloading dictionaries during Docker image build                                                    |

**Who uses it:**

| Actor                                      | What they do                                                                                                                                                       |
| :----------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Consumer Application / Microservice Client | Dispatches authenticated `POST /v1/audio` synthesis requests to generate raw WAV speech for voice assistants, screen readers, automated narrators, or game engines |
| Interactive Web User (Streamlit)           | Explores available voices, tests sample texts, adjusts playback speed, visualizes generation latency, and monitors server health via the companion UI              |
| System Administrator / Operator            | Deploys the service via Docker Compose, configures concurrency and memory policies via `.env`, and monitors memory usage via `/v1/health` and `/v1/status`         |
| Offline Batch Worker / Audio Pipeline      | Generates bulk audiobook chapters or pre-rendered dialog assets locally without internet dependencies or cloud billing                                             |

## 3. Features

- **Neural speech synthesis**: High-fidelity audio generation driven by the 82M-parameter Kokoro neural architecture (`hexgrad/Kokoro-82M`) executing on CPU, CUDA, or Apple Silicon MPS.
- **Dynamic filesystem voice discovery**: Scans voice `.pt` files on startup, automatically parsing language codes, gender indicators, and display names without static configuration lists.
- **Multi-language support**: Out-of-the-box phonemization and synthesis across 9 language conventions: American English (`a`), British English (`b`), Spanish (`e`), French (`f`), Hindi (`h`), Italian (`i`), Japanese (`j`), Portuguese (`p`), and Chinese (`z`).
- **Granular hierarchical thread locking**: Concurrency model pairing a master re-entrant lock (`threading.RLock`) with per-voice locks (`threading.Lock`) using double-checked locking, allowing distinct voices to load in parallel without duplicate disk I/O.
- **TTL memory management**: Background daemon thread periodically purges expired voice tensors (default 600s TTL, 5s check interval) using precise tensor byte accounting (`tensor.numel() * element_size()`) to prevent long-term memory bloat.
- **Lazy language pipeline caching**: Instantiates heavy `KPipeline` instances only when a language is first requested, reusing the shared underlying neural model across pipelines.
- **Non-blocking asynchronous execution**: FastAPI route handlers offload synchronous model inference to thread pools via `asyncio.to_thread`, ensuring server concurrency and responsive health probes.
- **Studio-grade audio output**: Encodes synthesized audio to standard 24,000 Hz, 16-bit PCM WAV using `soundfile`, delivering raw binary audio streams with custom download headers.
- **API key authentication**: Secures speech generation endpoints via `X-API-Key` HTTP header inspection backed by FastAPI dependency injection.
- **Comprehensive health & memory observability**: Exposes detailed diagnostics via `GET /v1/health` (readiness, device, loaded voice count, process RSS memory) and `GET /v1/status` (per-voice memory breakdown, age, and remaining TTL).
- **Streamlit companion frontend**: Modular web interface featuring custom CSS styling, dynamic language and voice selectors, speed controls (0.5x–2.0x), native audio playback with expandable synthesized text inspection, one-click WAV download, and real-time backend telemetry.
- **Production containerization**: Debian Bookworm Slim backend Docker image optimized with `uv` package installer, `espeak-ng`, CPU-optimized PyTorch wheels, MeCab morphological analyzer, and UniDic dictionaries, paired with a multi-stage frontend container.
- **Self-contained asset downloader**: Dedicated script (`download_models.py`) automating Hugging Face Hub downloads for base models (`kokoro-v1_0.pth` / `kokoro-v0_19.pth`), configuration, and all voice embeddings.

## 4. Architecture

### 4.1 Components

```text
  +-----------------------------------------------------------------------------------+
  |                                   Client Layer                                    |
  |  +-----------------------------------+     +-----------------------------------+  |
  |  |   Streamlit Frontend (:8005)      |     |     Third-Party Applications      |  |
  |  |  (Voice UI, Form, AudioPlayer)   |     |  (Voice Assistants, Games, Bots)  |  |
  |  +-----------------+-----------------+     +-----------------+-----------------+  |
  +--------------------|-----------------------------------------|--------------------+
                       | HTTP POST /v1/audio (X-API-Key)         |
                       +--------------------+--------------------+
                                            |
                                            v
  +-----------------------------------------------------------------------------------+
  |                          FastAPI Backend Service (:8004 / :8880)                  |
  |                                                                                   |
  |  +--------------------+     +---------------------+     +-----------------------+ |
  |  |   API Key Auth     | --> |   HTTP Middleware   | --> |      API Router       | |
  |  |  (api_key_auth)    |     |   (Request Timing)  |     |   (/v1/audio, etc.)   | |
  |  +--------------------+     +---------------------+     +-----------+-----------+ |
  |                                                                     |             |
  |                                  asyncio.to_thread(service.generate)|             |
  |                                                                     v             |
  |                             +---------------------------------------------------+ |
  |                             |               TTSEngine (Singleton)               | |
  |                             |  - Language Code Map    - Pipelines Cache         | |
  |                             |  - Validation Logic     - WAV Audio Serializer    | |
  |                             +-----------------+-------------------+-------------+ |
  |                                               |                   |               |
  |                   _ensure_voice_loaded()      |                   | pipeline(...) |
  |                                               v                   v               |
  |  +----------------------------------------------+     +-------------------------+ |
  |  |            VoiceManager (Cache & TTL)        |     |      Kokoro Model       | |
  |  |  - main_lock (RLock) & key_locks (Lock)      |     |  - KModel (eval, fp32)  | |
  |  |  - loaded_voices: Dict[(lang, voice), Info]  |     |  - KPipeline (by lang)  | |
  |  |  - Daemon Cleanup Thread (evicts > 600s)     |     |  - Local weights patched| |
  |  +----------------------+-----------------------+     +------------+------------+ |
  +-------------------------|------------------------------------------|--------------+
                            | torch.load()                             | disk read
                            v                                          v
  +-----------------------------------------------------------------------------------+
  |                           Local Storage / Mounted Volumes                         |
  |   ./backend/models/voices/*.pt               ./backend/models/model/kokoro-v*.pth |
  +-----------------------------------------------------------------------------------+
```

| Component             | Technology                           | Responsibility                                                                                                                          |
| :-------------------- | :----------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------- |
| `FastAPI Application` | FastAPI 0.115, Uvicorn               | HTTP routing, request timing middleware, CORS, OpenAPI schema generation, global exception handling, and application lifespan lifecycle |
| `API Router`          | FastAPI APIRouter                    | Implements `/v1/audio`, `/v1/health`, `/v1/status`, `/v1/voices`, and root info endpoints                                               |
| `Security Layer`      | FastAPI Dependencies                 | Validates incoming `X-API-Key` headers against configured environment secrets                                                           |
| `TTSEngine`           | PyTorch, Kokoro, SoundFile           | Coordinates input validation, language pipeline caching, voice tensor retrieval, neural synthesis, and WAV encoding                     |
| `VoiceManager`        | Python Threading, PyTorch            | Thread-safe lazy loading of `.pt` voice embeddings, hierarchical locking, tensor memory measurement, and TTL background eviction        |
| `Kokoro KModel`       | PyTorch, Transformers                | Core neural acoustic model loaded with normalized state dict weights (82M parameters)                                                   |
| `Language Pipelines`  | `KPipeline` (Kokoro)                 | Language-specific text tokenization, phonemization (via `espeak-ng` or MeCab), and acoustic frame prediction                            |
| `Streamlit Frontend`  | Streamlit 1.41, Requests             | Companion web client providing interactive voice generation, speed configuration, audio playback, and backend diagnostics telemetry     |
| `Docker Stack`        | Docker Compose, Debian Bookworm Slim | Multi-stage container orchestration with isolated bridge networking and read-only model volume mounts                                   |

### 4.2 Audio Synthesis Lifecycle and Request Pipeline

```text
Client Request (POST /v1/audio with JSON body & X-API-Key)
   |
   +--> 1. Request Logging Middleware records start timestamp
   |
   +--> 2. Security Validation: api_key_auth checks X-API-Key against SERVICE__API_KEY
   |       [Mismatch -> HTTP 401 Unauthorized]
   |
   +--> 3. Pydantic Request Parsing: TTSRequest validates text length (1-5000 chars) & speed (0.5-2.0)
   |       [Malformed -> HTTP 422 Unprocessable Entity]
   |
   +--> 4. Async Delegation: asyncio.to_thread transfers execution to background thread pool
   |
   +--> 5. Parameter Validation: TTSEngine.validate_request checks:
   |       - Language exists in discovered catalog (LanguageNotSupportedError -> 400)
   |       - Text is non-empty and within character limits (ValueError -> 400)
   |       - Voice exists for selected language (VoiceNotFoundError -> 400)
   |
   +--> 6. Language Pipeline Resolution: TTSEngine._get_or_create_pipeline:
   |       - Checks pipelines_cache for existing KPipeline
   |       - Miss: Instantiates new KPipeline(lang_code, model, device), caches in dictionary
   |
   +--> 7. Voice Embedding Retrieval: TTSEngine._ensure_voice_loaded:
   |       - Fast Path: VoiceManager checks cache under main_lock; updates last_access_time
   |       - Slow Path: Acquires per-voice lock; reads .pt tensor from disk via torch.load;
   |         calculates size_mb; registers in cache under main_lock
   |
   +--> 8. Neural Inference:
   |       - Assigns voice tensor into pipeline.voices[voice_id]
   |       - Calls pipeline(text, voice=voice_id, speed=speed) generator
   |       - Iterates generator, yielding acoustic segments into an audio buffer list
   |
   +--> 9. Audio Assembly & Encoding:
   |       - torch.cat concatenates all segment tensors along dimension 0
   |       - Converts tensor to NumPy array (cpu().numpy())
   |       - soundfile.write encodes array to in-memory BytesIO buffer as 24kHz 16-bit PCM WAV
   |
   +--> 10. HTTP Response Delivery:
   |        - Returns binary audio/wav stream with Content-Disposition header
   |        - Middleware logs request method, path, HTTP status, and total latency in ms
```

### 4.3 Dynamic Voice Discovery and Naming Convention

Rather than relying on static configuration maps or database entries, the service scans the local voices directory at boot time via a Pydantic `model_validator` in `backend/app/core/config.py`.

Voice files adhere to the strict Kokoro naming convention:

```text
{lang_code}{gender_code}_{voice_name}.pt
```

- **Language Code** (1 character):
  - `a`: American English
  - `b`: British English
  - `e`: Spanish (_Español_)
  - `f`: French
  - `h`: Hindi
  - `i`: Italian
  - `j`: Japanese
  - `p`: Portuguese
  - `z`: Chinese
- **Gender Code** (1 character):
  - `f`: Female
  - `m`: Male
- **Voice Name** (alphanumeric string): The speaker name (e.g., `bella`, `adam`, `sarah`, `nicole`, `sky`, `george`, `sakura`).

**Discovery Workflow:**

1. Scans `models/voices/*.pt` using `glob.glob`.
2. Splits filenames by underscore (`_`) into prefix and name parts.
3. Maps prefix character `[0]` to the full language name (e.g., `'a'` -> `'American English'`).
4. Maps prefix character `[1]` to gender (e.g., `'f'` -> `'Female'`).
5. Formats display names as `{TitleCasedName} ({Gender})` (e.g., `af_bella.pt` becomes `"Bella (Female)"`).
6. Assembles an alphabetized dictionary: `Dict[Language, Dict[DisplayName, VoiceId]]`.
7. Populates `settings.all_voices`, which is exposed via `GET /v1/voices` and used for input validation.

### 4.4 Voice Manager and Hierarchical Memory Management

```text
              VoiceManager.load_voice(language, voice_name, voice_id)
                                         |
                                         v
                     +---------------------------------------+
                     | Acquire main_lock (threading.RLock)   |
                     | Check: Is key in loaded_voices?       |
                     +-------------------+-------------------+
                                         |
                         +---------------+---------------+
                         |                               |
                     [Yes: Hit]                      [No: Miss]
                         |                               |
                         v                               v
             Update last_access_time          Release main_lock
             Return cached tensor                        |
                                                         v
                                        +---------------------------------+
                                        | Acquire voice_lock              |
                                        | (threading.Lock for this voice) |
                                        +----------------+----------------+
                                                         |
                                                         v
                                        +---------------------------------+
                                        | Re-acquire main_lock            |
                                        | Double-check loaded_voices      |
                                        +----------------+----------------+
                                                         |
                                     +-------------------+-------------------+
                                     |                                       |
                                 [Yes: Hit]                              [No: Miss]
                                     |                                       |
                                     v                                       v
                         Update last_access_time                 Release main_lock
                         Release voice_lock                      Load .pt tensor from disk
                         Return cached tensor                    Calculate tensor size_mb
                                                                             |
                                                                             v
                                                                 +-----------------------+
                                                                 | Re-acquire main_lock  |
                                                                 | Store in cache dict   |
                                                                 +-----------+-----------+
                                                                             |
                                                                             v
                                                                     Release voice_lock
                                                                     Return loaded tensor
```

- **Hierarchical Locking**: The master lock (`main_lock`) synchronizes dictionary reads and mutations. Each voice key maintains an independent `threading.Lock` within `key_locks`. This allows thread A to load `af_bella` from disk while thread B simultaneously loads `bm_george` from disk without contention.
- **Double-Checked Locking**: Thread B verifies the cache after acquiring its voice lock, preventing duplicate disk reads if thread A had just finished loading the same voice.
- **Memory Footprint Tracking**: Every loaded voice records its tensor memory via:
  $$\text{size\_mb} = \frac{\text{tensor.numel}() \times \text{tensor.element\_size}()}{1024 \times 1024}$$
- **TTL Eviction Loop**: A background daemon thread wakes every `CACHE__CLEANUP_INTERVAL_SECONDS` (default 5s). It identifies voices where $\text{now} - \text{last\_access\_time} > \text{ttl\_seconds}$ (default 600s), removes them from the dictionary under `main_lock`, and explicitly deletes the tensor (`del info.voice_tensor`) to trigger PyTorch and Python garbage collection.
- **Graceful Shutdown**: On service termination, `stop_cleanup_loop()` signals the daemon thread, joins within `CACHE__SHUTDOWN_TIMEOUT_SECONDS` (default 5s), and forcibly purges all loaded voice tensors.

### 4.5 Model Initialization and Runtime Patching

The Kokoro model requires specialized handling during startup to ensure compatibility across model versions and offline container execution:

1. **Version Fallback**: Resolves `models/model/kokoro-v1_0.pth` first; if absent, falls back to `models/model/kokoro-v0_19.pth`.
2. **State Dict Unwrapping**: Checks if the loaded checkpoint contains a top-level `"state_dict"` key (standard in PyTorch Lightning checkpoints). If present, it unwraps the inner dictionary.
3. **Key Normalization**: Removes `module.` prefixes from state dict keys resulting from multi-GPU `DistributedDataParallel` training runs, preventing key mismatch errors during weight loading.
4. **Hugging Face Hub Monkey-Patching**: In offline container environments, Kokoro's internal initialization attempts to invoke `hf_hub_download`. The engine patches `kokoro.model.hf_hub_download` with a custom function that checks the local `models/model/` directory first before falling back to network requests.
5. **Torch.load Interception**: Uses `unittest.mock.patch` around `torch.load` during `KModel` instantiation to directly inject the preprocessed, cleaned in-memory state dict rather than reloading it from disk.
6. **Device & Precision Selection**: Detects CUDA and MPS availability with CPU fallback, and sets `disable_complex=(dtype != "fp32")` to support FP16 and BF16 execution on supported accelerators.

### 4.6 Streamlit Frontend Architecture

The companion web application in `frontend/` provides an interface for manual testing and voice evaluation:

- **Modular Codebase**:
  - `app.py`: Main application script orchestrating page configuration, session state, and component rendering.
  - `src/core/config.py`: Pydantic settings loading API URLs, keys, slider constraints, and CSS paths.
  - `src/services/api_client.py`: HTTP client (`TTSClient`) wrapping `requests` with header-based API key authentication, timeouts, and error parsing.
  - `src/components/`: Reusable UI modules (`sidebar.py`, `tts_form.py`, `audio_player.py`).
  - `src/utils/ui_helpers.py`: Cached API fetchers (`@st.cache_data` with configurable TTLs) for voice catalogs and backend health status.
  - `src/styles/`: Custom CSS theme injecting modern typography, badges, and card styling.
- **Interactive Controls**:
  - Language selection dropdown dynamically populated from backend catalog.
  - Voice selection dropdown updated in response to language selection.
  - Text area supporting up to 5,000 characters.
  - Speed multiplier slider from 0.5x to 2.0x in 0.1x increments.
- **Audio Playback**: Plays generated WAV audio directly in the browser, displays elapsed synthesis time, and provides one-click file download.
- **System Telemetry Sidebar**: Queries `GET /v1/health` to display live server status, compute device (`cpu`/`cuda`/`mps`), active language pipelines, loaded voices, and memory consumption.

## 5. Technology stack

| Layer                               | Technology                                                                                                  |
| :---------------------------------- | :---------------------------------------------------------------------------------------------------------- |
| **API Framework**                   | FastAPI (`fastapi>=0.110.0`), Uvicorn (`uvicorn[standard]>=0.29.0`), Starlette                              |
| **Deep Learning & Inference**       | PyTorch (`torch`, `torchvision`, `torchaudio`), Kokoro (`kokoro>=0.3.4`), Hugging Face Hub (`>=0.22.0`)     |
| **Model Architecture**              | Kokoro-82M (`hexgrad/Kokoro-82M`, 82M parameters, v1.0 / v0.19 checkpoints)                                 |
| **Audio Processing & Encoding**     | SoundFile (`soundfile>=0.12.1`), NumPy (`numpy>=1.26.0`)                                                    |
| **Text Processing & Phonemization** | Espeak-ng, MeCab (`unidic-mecab`), Misaki (`misaki[en]>=0.9.4`, `misaki[ja]`), PyOpenJTalk, Pypinyin, Jieba |
| **Memory & Concurrency**            | Python `threading` (`RLock`, `Lock`), `asyncio`, Psutil (`psutil>=5.9.0`)                                   |
| **Configuration & Validation**      | Pydantic (`pydantic>=2.7.0`), Pydantic Settings (`pydantic-settings>=2.2.0`)                                |
| **Frontend Framework**              | Streamlit (`streamlit>=1.30.0`), Requests (`requests>=2.31.0`)                                              |
| **Containerization & Runtime**      | Docker, Docker Compose, Debian 12 Bookworm Slim, Python 3.11                                                |
| **Package Management**              | uv (Astral), pip                                                                                            |

## 6. Cross-cutting subsystems

### 6.1 Configuration System (Pydantic Settings v2)

Configuration is managed via strongly-typed nested Pydantic models in `backend/app/core/config.py`:

```text
Settings
├── service: ServiceSettings   (host, port, name, version, api_key, reload, docs_url, prefix)
├── model: ModelSettings       (repo_id, device, dtype, local_model_dir, local_voices_dir, file_v1, file_v0_19)
├── audio: AudioSettings       (sample_rate, format, subtype, default_filename, media_type)
├── limits: LimitSettings      (max_text_length, min_text_length, min_speed, max_speed, default_speed)
├── cache: CacheSettings       (ttl_seconds, cleanup_interval_seconds, shutdown_timeout_seconds)
├── logging: LoggingSettings   (date_format, uvicorn_level, transformers_level, torch_level)
└── all_voices: Dict[str, Dict[str, str]] (Dynamically discovered from filesystem)
```

- **Nested Environment Variables**: Supports double-underscore delimiter syntax (`env_nested_delimiter="__"`), allowing variables like `SERVICE__PORT=8004` or `CACHE__TTL_SECONDS=600` in `.env` files.
- **LRU Singleton**: The `get_settings()` helper is decorated with `@lru_cache`, ensuring configuration parsing and directory scanning execute exactly once per application lifecycle.

### 6.2 Security and API Authentication

- **API Key Verification**: The `api_key_auth` dependency extracts the `X-API-Key` HTTP header on protected routes (`/v1/audio`). If the header is missing or does not match `settings.service.api_key`, a `401 Unauthorized` exception is raised immediately.
- **Exempt Endpoints**: Health probes (`/v1/health`), status queries (`/v1/status`), voice catalogs (`/v1/voices`), and documentation endpoints (`/docs`, `/`) are unauthenticated to allow load balancer health checks and UI introspection.

### 6.3 Observability and Memory Monitoring

The service provides dual-tier diagnostic endpoints:

1. **`GET /v1/health` (Readiness & Summary)**:
   - Evaluates `service.is_ready` (returns `503 Service Unavailable` during boot).
   - Reports compute device (`cpu`, `cuda`, `mps`).
   - Counts active language pipelines and in-memory voices.
   - Measures total memory via `psutil.Process().memory_info().rss` and estimates model overhead by subtracting voice tensor memory from total RSS.
2. **`GET /v1/status` (Deep Memory Diagnostics)**:
   - Returns a per-voice breakdown: language, voice name, voice ID, tensor size in MB, age in seconds since last access, and remaining seconds until TTL expiration.
   - Summarizes aggregate metrics: `total_memory_mb`, `cleanup_checks_performed`, and `voices_unloaded_total`.

### 6.4 Containerization and Docker Orchestration

- **Base Image & Dependency Optimization**: Backend container built on `python:3.11-slim-bookworm` with package cache cleanup (`rm -rf /var/lib/apt/lists/*`) to keep image sizes minimal, paired with a two-stage builder for the Streamlit frontend container (`python:3.11-slim`).
- **Native Dependency Provisioning**: Installs `espeak-ng` for multi-lingual phonemization, `build-essential` and `cmake` for C++ extensions, and `mecab` with `unidic-mecab` for Japanese text processing.
- **CPU Wheel Optimization**: Installs PyTorch directly from `https://download.pytorch.org/whl/cpu` to avoid multi-gigabyte CUDA binary bloat in standard CPU deployments.
- **Fast Package Installation**: Utilizes `uv` for sub-minute Python dependency resolution.
- **Docker Compose Networking**:
  - `tts-service`: Backend container exposing port `${SERVICE__PORT}` (mapped to 8880 on host), mounting `./backend/models` as read-only (`:ro`), and configuring automatic container restarts.
  - `streamlit-frontend`: Frontend container on port `${FRONTEND_PORT}` (default 8005 in `.env.example`) connected via internal bridge network `kokoro-network`, referencing the backend via service DNS `http://tts-service:${SERVICE__PORT}`.
  - Health check probe configured using `curl -f http://localhost:${SERVICE__PORT}/v1/health` with 30s interval, 10s timeout, and 3 retries.

## 7. Technical challenges and noteworthy details

1. **Granular Hierarchical Locking for Concurrent Voice Loading**:
   Naive global locking serializes disk I/O, causing requests for distinct voices to queue behind one another. Conversely, omitting locks risks loading identical 15–30 MB voice tensors multiple times concurrently. Kokoro TTS resolves this by pairing a master `RLock` for cache dictionary access with lazily-created per-voice `Lock` instances. This achieves thread safety via double-checked locking while allowing simultaneous disk reads across different voices.
2. **In-Memory Checkpoint Normalization and Hugging Face Interception**:
   PyTorch Lightning checkpoints wrap weights inside a `"state_dict"` key, and multi-GPU training prefixes tensor keys with `module.`. Furthermore, Kokoro's library attempts to call Hugging Face Hub APIs even if weights exist on disk. The service resolves this at startup by unwrapping and cleaning keys in memory, monkey-patching `kokoro.model.hf_hub_download` to redirect to local disk paths, and mocking `torch.load` during model construction to inject the pre-cleaned weights without redundant disk roundtrips.
3. **Non-Blocking Execution for Heavy PyTorch Inference**:
   FastAPI operates on an asynchronous `asyncio` event loop. Running compute-intensive PyTorch neural inference directly inside an `async def` handler halts the event loop, causing concurrent HTTP requests, health checks, and Docker probes to time out. Wrapping `service.generate` inside `asyncio.to_thread` delegates the CPU/GPU workload to Python's background worker thread pool, maintaining instantaneous responsiveness across all endpoints.
4. **TTL-Based Voice Tensor Eviction with Explicit Deletion**:
   In long-running production services, loading every requested voice without eviction eventually leads to out-of-memory crashes. The Voice Manager tracks exact tensor sizes in megabytes and records access timestamps on every cache hit. A background daemon thread purges voices inactive for longer than `CACHE__TTL_SECONDS` (default 10 min) and explicitly executes `del info.voice_tensor` to guarantee immediate memory reclamation.
5. **Dynamic Voice Discovery Without Static Code Maintenance**:
   Adding new speaker profiles to ML services often requires updating configuration files, enum types, or database tables. By parsing file naming semantics (`{lang}{gender}_{name}.pt`) via filesystem globbing at boot time, new voices downloaded from Hugging Face are automatically cataloged, grouped by language, and exposed to client applications without modifying a single line of application code.
6. **Japanese Morphological Analysis Pipeline Integration**:
   Japanese text synthesis cannot rely on space-delimited phonemization. It requires morphological tokenization using MeCab and the UniDic dictionary. The Docker build provisions system packages (`mecab`, `libmecab-dev`, `unidic-mecab`), executes `python -m unidic download`, and sets `MECABRC=/usr/local/lib/python3.11/site-packages/unidic/dicdir/mecabrc` in container environment variables to guarantee accurate pronunciation.

## 8. How to explain the system (suggested talking structure)

1. **Purpose & Value Proposition**: A self-hosted, production-ready Text-to-Speech microservice powered by the 82M-parameter Kokoro neural model, delivering studio-grade 24 kHz audio across 9 languages without cloud API recurring costs.
2. **Architecture & Request Lifecycle**: A FastAPI backend running on Uvicorn, wrapping PyTorch neural inference inside `asyncio.to_thread`, paired with a modular Streamlit testing UI and orchestrated via Docker Compose.
3. **Key Engineering Innovations**:
   - Dynamic voice discovery parsing filesystem filenames into language catalogs on startup.
   - Hierarchical double-checked locking enabling concurrent disk loads of distinct voices without race conditions.
   - TTL-based background memory management automatically reclaiming tensor RAM.
   - Runtime checkpoint preprocessing and Hugging Face Hub monkey-patching for fully offline deployment.
4. **Operations & Observability**: Comprehensive diagnostics via `/v1/health` and `/v1/status` tracking per-voice memory consumption, process RSS, and cache age, containerized with Debian Bookworm Slim and CPU-optimized PyTorch.

## 9. Glossary

| Term                        | Meaning                                                                                                                                          |
| :-------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Kokoro-82M**              | An efficient 82-million parameter neural text-to-speech model capable of fast, natural speech synthesis across multiple languages.               |
| **KModel**                  | The core PyTorch neural network module in Kokoro responsible for predicting acoustic audio representations from phoneme sequences.               |
| **KPipeline**               | The language-specific text processing pipeline in Kokoro that handles tokenization, phonemization, and orchestration with a `KModel`.            |
| **Voice Embedding (`.pt`)** | A serialized PyTorch tensor capturing specific speaker timbre, pitch, and vocal characteristics used to condition the neural synthesis model.    |
| **Double-Checked Locking**  | A software design pattern that reduces locking overhead by testing the locking criterion before and after acquiring a synchronization lock.      |
| **RLock (Re-entrant Lock)** | A synchronization primitive that can be acquired multiple times by the same thread without causing a deadlock.                                   |
| **TTL (Time-To-Live)**      | The duration of time a cached resource (such as a loaded voice tensor) remains in memory before becoming eligible for automatic eviction.        |
| **PCM_16**                  | Pulse-Code Modulation with 16-bit depth per sample, standard for uncompressed, studio-quality digital audio encoding.                            |
| **MeCab / UniDic**          | An open-source morphological analysis engine and accompanying Japanese dictionary used to segment and phonemize Japanese kanji and kana text.    |
| **Espeak-ng**               | A compact open-source software speech synthesizer used as a backend phonemizer to translate raw text into International Phonetic Alphabet (IPA). |
| **uv**                      | An extremely fast Python package and environment manager written in Rust, developed by Astral.                                                   |
