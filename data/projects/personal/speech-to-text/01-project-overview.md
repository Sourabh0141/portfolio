# Speech-to-Text (STT) — Project Overview

## 1. What it is, in one minute

Speech-to-Text (STT) is a high-performance, containerized automated speech recognition microservice and multi-page web companion powered by **Faster-Whisper** (CTranslate2). Built with FastAPI, WebSockets, and Streamlit, the system provides both high-accuracy batch audio transcription for uploaded multimedia files and low-latency real-time live streaming transcription directly from browser microphones using an overlapping sliding-window hypothesis-merging algorithm.

Two-sentence version: "Speech-to-Text is a production-ready speech recognition microservice combining a FastAPI inference backend with a multi-page Streamlit web client powered by Faster-Whisper with 8-bit quantization. It pairs an asynchronous FFmpeg audio standardization pipeline with a full-duplex binary WebSocket streaming protocol, global asyncio inference serialization, and a browser-side Web Audio JavaScript bridge to deliver real-time and batch speech transcription with minimal compute overhead."

## 2. Problem and purpose

| Problem                                                                                                                                | How the system addresses it                                                                                                                                                                                     |
| :------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Commercial speech-to-text cloud APIs (e.g., Deepgram, OpenAI Whisper API, Google Speech) introduce recurring per-minute costs          | Provides a self-hosted, offline-capable speech recognition service using Faster-Whisper running efficiently on standard CPUs without cloud dependencies or per-minute billing                                   |
| Standard OpenAI Whisper implementations are computationally heavy and slow on consumer CPU hardware                                    | Deploys Faster-Whisper using CTranslate2 with `int8` quantization and configurable CPU thread parallelization, delivering up to 4x faster inference with a 4x reduction in RAM consumption                      |
| Real-time live transcription in browsers often flickers or produces unstable, hallucinated text as speakers pause or stutter           | Implements a 2.0-second sliding audio buffer with 1.0-second overlap and a longest suffix-prefix hypothesis-merging algorithm that clearly distinguishes stable "committed" text from live "preview" hypotheses |
| Multimedia uploads arrive in diverse, incompatible formats (MP3, MP4, M4A, FLAC, OGG) with varying sample rates and channel counts     | Executes an asynchronous non-blocking FFmpeg subprocess pipeline that transacts and standardizes all inputs into 16 kHz mono 16-bit little-endian PCM WAV before inference                                      |
| CTranslate2 instances lack thread safety when accessed concurrently without isolation, causing memory corruption or CPU thrashing      | Implements a singleton `ModelManager` with a shared `asyncio.Lock()` that serializes batch and streaming inference requests, offloading compute to worker thread executors                                      |
| Traditional Streamlit rerun cycles cause screen flickering, audio dropout, and broken WebSocket state when handling streaming mic data | Isolates the live streaming interface inside an independent `@st.fragment` hosting an embedded HTML5 Web Audio API JavaScript bridge that streams raw Int16 PCM chunks directly over WebSockets                 |
| Container restarts force repeated 250 MB–1.5 GB model checkpoint downloads from Hugging Face Hub, causing cold-start delays            | Orchestrates persistent model caching via a dedicated Docker named volume (`hf_cache`), ensuring model weights survive container rebuilds and restarts                                                          |

**Who uses it:**

| Actor                                      | What they do                                                                                                                                                    |
| :----------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Consumer Application / Microservice Client | Sends authenticated `POST /api/v1/transcribe` multipart audio uploads to retrieve full transcripts, language metadata, and timestamped segments for downstream  |
| Interactive Web User (Batch Upload)        | Drags and drops recorded interviews, lecture audio, or video files into the Streamlit UI, views segment timelines, and exports transcripts as `.txt` or `.json` |
| Live Speaker / Meeting Participant         | Grants browser microphone permissions on the Live Stream page, speaks into the mic, views color-coded live transcription, and stops streaming to finalize text  |
| System Administrator / DevOps              | Manages Docker Compose deployments, tunes model size (`base`, `small`, `medium`) and compute quantization via `.env`, and monitors `/api/v1/health` probes      |

## 3. Features

- **Faster-Whisper inference engine**: High-speed automatic speech recognition powered by CTranslate2, supporting OpenAI Whisper model architectures (`tiny`, `base`, `small`, `medium`, `large-v3`) with default `int8` CPU quantization.
- **Dual-mode transcription architecture**: Unified backend supporting both asynchronous REST multipart batch uploads and low-latency full-duplex binary WebSocket live streaming.
- **Automated audio standardization**: Asynchronous FFmpeg pipeline transcode engine (`convert_to_16k_mono_wav`) converting any media format into 16,000 Hz, mono, 16-bit PCM little-endian WAV without blocking the main event loop.
- **Sliding-window real-time streaming**: Buffered 2.0-second sliding window (`chunk_samples = 32,000`) with 1.0-second overlap (`overlap_samples = 16,000`) for continuous conversational speech processing.
- **Hypothesis-merging algorithm**: Suffix-prefix word overlap analyzer that partitions streaming transcript updates into high-confidence "committed" text, volatile "preview" hypotheses, and incremental "delta" updates.
- **Integrated Voice Activity Detection (VAD)**: Native Silero VAD filtering (`vad_filter=True`) automatically stripping silent frames and non-speech background noise prior to acoustic decoding.
- **Global inference serialization**: Thread-safe singleton `ModelManager` backed by an asynchronous mutex (`asyncio.Lock()`) and executor offloading (`loop.run_in_executor`) to prevent out-of-memory crashes on resource-constrained servers.
- **Timestamped segment extraction**: Batch responses return word-level and phrase-level timeline intervals (`start`, `end`, `text`), detected ISO language code, and language confidence probabilities.
- **Enterprise API security**: Secures REST endpoints via `X-API-Key` HTTP header validation using FastAPI dependency injection.
- **Streamlit multi-page frontend**: Modular web application featuring modern navigation (`st.navigation`, `st.Page`), custom CSS themes, batch transcription explorer, and system diagnostics telemetry.
- **Web Audio JavaScript bridge**: Low-latency browser microphone capture via Web Audio API `ScriptProcessorNode` (4096 buffer size, 16 kHz), Int16 quantization, disconnect auto-reconnect, and a 64-chunk fallback queue.
- **Isolated fragment execution**: Employs `@st.fragment` to render real-time streaming DOM updates without triggering full-page Python reruns.
- **Containerized orchestration**: Multi-stage Debian Bullseye Slim Docker build with `ffmpeg` and `libgomp1` native libraries, coordinated with Streamlit via Docker Compose and persistent Hugging Face cache volumes.

## 4. Architecture

### 4.1 Components

```text
  +-----------------------------------------------------------------------------------+
  |                                   Client Layer                                    |
  |  +-----------------------------------+     +-----------------------------------+  |
  |  |    Streamlit Frontend (:8003)     |     |     Third-Party Applications      |  |
  |  |  - Batch Upload               |     |  - Voice Assistants / Bots        |  |
  |  |  - Live Stream JS Bridge     |     |  - Podcasting & Meeting Pipelines |  |
  |  |  - System Status             |     |  - CLI & Webhook Clients          |  |
  |  +-----------------+-----------------+     +-----------------+-----------------+  |
  +--------------------|-----------------------------------------|--------------------+
                       |                                         |
                       | HTTP POST /api/v1/transcribe (API Key)  |
                       | WS /api/v1/ws/transcribe (Binary PCM)   |
                       +--------------------+--------------------+
                                            |
                                            v
  +-----------------------------------------------------------------------------------+
  |                          FastAPI Backend Service (:8002)                          |
  |                                                                                   |
  |  +--------------------+     +---------------------+     +-----------------------+ |
  |  |   API Key Auth     | --> |   HTTP Middleware   | --> |      API Router       | |
  |  |  (get_api_key)     |     |   (Exception Hndlr) |     |  (/api/v1/transcribe) | |
  |  +--------------------+     +---------------------+     +-----------+-----------+ |
  |                                                                     |             |
  |                                                                     v             |
  |  +------------------------------------+     +-----------------------------------+ |
  |  |    StreamingTranscriber (WS)       |     |   FasterWhisperService (Batch)    | |
  |  |  - Sliding Buffer (2.0s / 1.0s)    |     |  - save_upload_file (aiofiles)    | |
  |  |  - Hypothesis Overlap Merger       |     |  - FFmpeg Converter (asyncio proc)| |
  |  |  - Committed vs Preview Partitioner|     |  - Temporary File Auto-Cleanup    | |
  |  +-----------------+------------------+     +-------------------+---------------+ |
  |                    |                                            |                 |
  |                    +--------------------+-----------------------+                 |
  |                                         |                                         |
  |                                         v async with lock                         |
  |                             +-----------------------+                             |
  |                             | ModelManager (Lock)   |                             |
  |                             | - asyncio.Lock()      |                             |
  |                             | - WhisperModel (int8) |                             |
  |                             +-----------+-----------+                             |
  +-----------------------------------------|-----------------------------------------+
                                            |
                                            v Model Weights & Cache
  +-----------------------------------------------------------------------------------+
  |                          Persistent Storage & Volumes                             |
  |   Named Volume: hf_cache (/root/.cache/huggingface)    Temp: /app/uploaded_files  |
  +-----------------------------------------------------------------------------------+
```

| Component               | Technology                           | Responsibility                                                                                                                            |
| :---------------------- | :----------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------- |
| `FastAPI Application`   | FastAPI 0.110, Uvicorn 0.29          | HTTP REST routing, WebSocket protocol lifecycle, lifespan model initialization, and global error handling (`create_app`)                  |
| `Security Layer`        | FastAPI Dependencies                 | Validates incoming `X-API-Key` headers on REST endpoints against `STT_API_KEY`                                                            |
| `ModelManager`          | Faster-Whisper, asyncio              | Singleton model holder managing WhisperModel lifecycle and global `asyncio.Lock()` resource synchronization                               |
| `FasterWhisperService`  | CTranslate2, Faster-Whisper          | Orchestrates batch transcription: acquires lock, runs `model.transcribe` in executor thread, extracts segments and language probabilities |
| `StreamingTranscriber`  | NumPy, SciPy WAV, asyncio            | Manages live WebSocket sessions: buffers raw PCM chunks, runs sliding window inference, and computes suffix-prefix hypothesis overlaps    |
| `Audio Standardization` | FFmpeg, asyncio subprocess, aiofiles | Asynchronously transcodes arbitrary input files into 16 kHz mono 16-bit PCM WAV (`convert_to_16k_mono_wav`) and cleans up temporary files |
| `Streamlit Frontend`    | Streamlit 1.30, HTML/JS Bridge       | Multi-page web client providing drag-and-drop batch upload, timeline segment visualization, export tools, and real-time streaming audio   |
| `Docker Stack`          | Docker Compose, Bullseye Slim        | Coordinates container networking, worker processes, port mappings, and persistent caching via `hf_cache`                                  |

### 4.2 Batch Audio Transcription Lifecycle

```text
Client Request (POST /api/v1/transcribe with multipart/form-data & X-API-Key)
   |
   +--> 1. Security Check: get_api_key validates X-API-Key against settings.stt_api_key
   |       [Mismatch -> HTTP 401 Unauthorized]
   |
   +--> 2. Filename & Extension Validation:
   |       - validate_file_extension extracts file extension in lowercase
   |       - generate_unique_filename produces UUID-based temporary filename
   |
   +--> 3. Asynchronous Ingestion:
   |       - save_upload_file writes incoming stream to disk via aiofiles
   |         (/app/uploaded_files/original_{uuid}.ext)
   |
   +--> 4. Audio Standardization:
   |       - Spawns asynchronous FFmpeg subprocess (pcm_s16le, 16kHz, mono, no video)
   |       - Standardized file saved to /app/uploaded_files/{uuid}.wav
   |       - Immediately unlinks the original upload file
   |
   +--> 5. Mutex Acquisition:
   |       - FasterWhisperService acquires ModelManager.get_lock() (asyncio.Lock)
   |
   +--> 6. Background Executor Offloading:
   |       - loop.run_in_executor offloads blocking model.transcribe to thread pool
   |       - Beam search decoding executed with settings.stt_beam_size (default: 5)
   |       - Silero VAD filter active (vad_filter=True)
   |
   +--> 7. Segment & Metadata Extraction:
   |       - Consumes generator, accumulating full text and segment objects ({start, end, text})
   |       - Captures detected language, language confidence probability, and audio duration
   |
   +--> 8. Cleanup & Response Delivery:
   |       - cleanup_file deletes standardized temporary WAV file in finally block
   |       - Returns TranscriptionResponse schema (HTTP 200 OK)
```

### 4.3 Real-Time WebSocket Streaming Pipeline and Sliding Window

Real-time speech recognition operates over a bidirectional WebSocket connection at `/api/v1/ws/transcribe`:

1. **Connection Handshake**: The browser connects to `ws://host:port/api/v1/ws/transcribe`. The server accepts the socket and instantiates a session-scoped `StreamingTranscriber`.
2. **Binary Frame Ingestion**: The client continuously captures microphone audio at 16 kHz and transmits raw 16-bit little-endian PCM byte chunks over binary WebSocket frames.
3. **Buffer Accumulation**:
   - `StreamingTranscriber._audio_to_float_array` converts Int16 byte chunks to normalized float32 arrays ($[-1.0, 1.0]$) by dividing by $32768.0$.
   - Appends audio to an in-memory NumPy buffer.
4. **Window Threshold Check**:
   - Inference triggers only when `len(self.buffer) >= self.chunk_samples` (2.0 seconds = 32,000 samples).
5. **Serialized Background Inference**:
   - Acquires the global `asyncio.Lock()` to prevent interference with concurrent batch uploads or other streams.
   - Copies the buffer, writes it to a temporary WAV file, and runs `model.transcribe` with VAD enabled in an executor thread.
6. **Buffer Window Sliding**:
   - The buffer retains the last `overlap_samples` (1.0 second = 16,000 samples) and discards the preceding 1.0 second of audio:
     $$\text{buffer} = \text{buffer}[-\text{overlap\_samples}:]$$
   - This 1.0-second overlap provides the acoustic and linguistic context required to accurately decode words spanning across buffer boundaries.
7. **Stream Finalization**:
   - When the client sends the control message `{"event": "end_stream"}` or disconnects, `finalize()` flushes all remaining pending words as final committed text and closes the socket gracefully with code `1000`.

### 4.4 Hypothesis Merging Algorithm (Committed vs Preview Text)

Because Whisper decodes audio in windows, the words generated at the trailing end of an audio window are provisional—they can change as additional acoustic context arrives. The `StreamingTranscriber._merge_hypothesis` algorithm solves this:

```text
Previous Window: [ "The", "quick", "brown", "fox", "jumps" ]
New Window:                     [ "brown", "fox", "jumps", "over", "the", "lazy" ]
                                   \_________________/
                              Longest Overlap Match (3 words)

Committed (Permanent): [ "The", "quick" ]  (Pushed to committed_words)
Pending (Live Preview): [ "brown", "fox", "jumps", "over", "the", "lazy" ]
Delta (Newly Finalized): [ "The", "quick" ]
```

- **Overlap Matching**: `_longest_suffix_prefix_overlap` compares the end of `pending_words` with the beginning of the newly transcribed window. Words are normalized via `_normalize_word` (stripping punctuation and converting to lowercase).
- **Commit Boundary**: Words located prior to the overlapping slice have safely passed beyond the 1.0-second overlap window. They are deemed stable, added to `committed_words`, and will never change.
- **Preview Hypothesis**: Words within the current window remain provisional and are displayed as live gray text in the UI.
- **Payload Schema (`StreamingTranscriptUpdate`)**:
  - `committed_text`: High-confidence, permanently finalized text.
  - `preview_text`: Unstable live hypothesis currently being spoken.
  - `delta_text`: New words permanently committed during the active cycle.
  - `is_final`: Boolean flag indicating stream completion.

### 4.5 Model Lifecycle Management and Concurrency Serialization

- **FastAPI Lifespan Management**: `ModelManager.initialize()` loads the Faster-Whisper model during the application boot sequence. If initialization fails, the server fails fast with a clear exception before accepting traffic.
- **CTranslate2 Execution Model**: Faster-Whisper utilizes CTranslate2, a custom inference engine written in C++ that optimizes Transformer models via weights quantization, layer fusion, and kernel specialization.
- **Global Serialization Mutex**: Faster-Whisper does not safely support simultaneous overlapping inference on a single instance without excessive memory allocation. `ModelManager._lock = asyncio.Lock()` acts as a global gatekeeper:
  - Every batch request and streaming chunk must acquire `async with lock`.
  - While one chunk is being transcribed, other requests wait asynchronously on the lock without blocking the event loop.
  - Recommended deployment pins `UVICORN_WORKERS=1` per container; scaling is achieved horizontally across container replicas rather than via multi-process workers.

### 4.6 Streamlit Frontend and Web Audio JavaScript Bridge

The frontend in `frontend/` implements an interactive user interface using modern Streamlit capabilities:

- **Multi-Page Architecture**: Uses `st.navigation` and `st.Page` across 3 modular views:
  - `Batch Upload` (`views/batch.py`): Supports drag-and-drop file upload, displays audio player previews, renders a transcription progress indicator, displays timestamped segments in interactive dataframes, and provides `.txt` and `.json` download exports.
  - `Live Stream` (`views/streaming.py`): Live transcription interface powered by an isolated fragment.
  - `System Status` (`views/health.py`): Displays backend connectivity status, service version, compute device, and environment parameters.
- **Isolated Fragment Execution (`@st.fragment`)**: Live streaming UI is wrapped in `@st.fragment`. This isolates DOM re-renders inside the streaming container, preventing the entire Streamlit page from rerunning every time audio is processed.
- **JavaScript Audio Bridge (`components.html`)**:
  - Initializes `window.AudioContext({ sampleRate: 16000 })`.
  - Connects microphone media stream to a `ScriptProcessorNode(4096, 1, 1)`.
  - Converts Float32 audio samples to signed 16-bit linear PCM (`Math.max(-1, Math.min(1, inputData[i])) * 0x7fff`).
  - Implements a 64-chunk circular buffer (`pendingAudioChunks`) to prevent audio packet loss during initial WebSocket connection establishment or brief network reconnects.
  - Renders committed text in solid dark typography and live preview text in subtle gray typography (`<span class="preview-text">`).

## 5. Technology stack

| Layer                              | Technology                                                                                                                        |
| :--------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------- |
| **API Framework**                  | FastAPI (`fastapi>=0.110.0`), Uvicorn (`uvicorn>=0.29.0`), Starlette                                                              |
| **Core AI / Speech Recognition**   | Faster-Whisper (`faster-whisper>=1.0.1`, CTranslate2), OpenAI Whisper Architecture                                                |
| **Model Quantization & Precision** | CTranslate2 `int8` (CPU quantization), FP16 / BF16 (CUDA optional)                                                                |
| **Audio Processing & Conversion**  | FFmpeg, NumPy (`numpy>=1.26.4`), SciPy (`scipy>=1.12.0`)                                                                          |
| **Voice Activity Detection (VAD)** | Silero VAD (Integrated inside Faster-Whisper via `vad_filter=True`)                                                               |
| **Asynchronous I/O & Networking**  | aiofiles (`aiofiles>=25.1.0`), WebSockets (`websockets>=12.0`), asyncio                                                           |
| **Configuration & Validation**     | Pydantic (`pydantic>=2.6.4`), Pydantic Settings (`pydantic-settings>=2.2.1`), python-multipart                                    |
| **Frontend Framework**             | Streamlit (`streamlit==1.37.0`), Requests (`requests==2.31.0`), Web Audio API (`AudioContext`, `ScriptProcessorNode`), JavaScript |
| **Containerization & Runtime**     | Docker, Docker Compose, Debian 11 Bullseye Slim, Python 3.10                                                                      |
| **Native System Libraries**        | `ffmpeg`, `libgomp1` (GNU OpenMP Runtime Library)                                                                                 |

## 6. Cross-cutting subsystems

### 6.1 Configuration System (Pydantic Settings v2)

The application config is centralized in `backend/app/core/config.py` using Pydantic Settings:

```text
Settings
├── stt_api_key: str        (Security key for X-API-Key validation)
├── log_level: str          (Logging verbosity: DEBUG, INFO, WARNING, ERROR)
├── fastapi_env: str        (Runtime environment: development, production, testing)
├── stt_model_size: str     (Whisper model: tiny, base, small, medium, large-v3)
├── stt_device: str         (Inference compute device: cpu, cuda)
├── stt_compute_type: str   (CTranslate2 quantization: int8, float16)
├── stt_cpu_threads: int    (Thread parallelism for CTranslate2 engine)
├── stt_beam_size: int      (Beam search width: default 5)
├── service_name: str       (Service identifier for telemetry and health probes)
└── upload_dir: str         (Temporary storage path for audio standardization)
```

- **Environment File Integration**: Loads directly from root `.env` with case-insensitive matching and UTF-8 encoding.
- **Thread & Beam Tuning**: Controls CTranslate2 execution parameters (`stt_cpu_threads=4`, `stt_beam_size=5`) directly from container environment variables without modifying source code.

### 6.2 Security and API Key Authentication

- **Header Validation**: REST API requests are secured via the `get_api_key` dependency ([backend/app/api/deps.py](file:///d:/Projects/portfolio/tmp/speech-to-text/backend/app/api/deps.py)), inspecting the `X-API-Key` HTTP header.
- **Fail-Closed Verification**: Validated in `get_api_key`: missing API keys trigger `401 Unauthorized`, whereas invalid keys trigger `403 Forbidden`.
- **Health Exemption**: The `/api/v1/health` endpoint is unauthenticated to enable container orchestration probes, Docker healthchecks, and load balancer pinging.

### 6.3 Audio Standardization Pipeline (Asynchronous FFmpeg)

Incoming audio files vary wildly in container formats (MP4, MKV, WebM, MP3) and codecs (AAC, Opus, Vorbis). The standardization pipeline in `backend/app/services/file_storage.py` ensures deterministic model ingestion:

```bash
ffmpeg -i {input_path} -vn -acodec pcm_s16le -ar 16000 -ac 1 -y {output_path}
```

- **Non-Blocking Subprocess Execution**: Executed via `asyncio.create_subprocess_exec`, capturing `stdout` and `stderr` asynchronously. The main application thread never blocks waiting on audio transcoding.
- **Temporary File Lifecycle**: Original files (`original_{uuid}.ext`) and standardized files (`{uuid}.wav`) are stored in `UPLOAD_DIR` and guaranteed to be deleted in `finally` blocks via `cleanup_file()`, preventing disk exhaustion over long operating periods.

### 6.4 Observability and Dual-Mode Logging

- **Structured Logging (`backend/app/core/logging.py`)**: Implements a custom `JSONFormatter` that automatically outputs JSON-structured log entries (timestamp, level, module, funcName, lineNo, exception traces) when `FASTAPI_ENV=production`. In local development, it outputs human-readable console logs.
- **Health Telemetry**: Exposes `GET /api/v1/health` returning operational status and service identifier for load balancer readiness probes.

### 6.5 Containerization and Docker Orchestration

- **Two-Stage Docker Builds**: Both backend and frontend utilize two-stage Docker builds based on `python:3.10-slim-bullseye`. A `builder` stage compiles dependencies into `/usr/local/lib/python3.10/site-packages`, while a minimal runtime stage copies the artifacts.
- **OpenMP Runtime Support**: `libgomp1` is explicitly installed in the backend runtime container to provide multi-threaded OpenMP support required by CTranslate2's native C++ CPU kernels, alongside `ffmpeg` for audio conversion.
- **Docker Compose Networking**:
  - `backend`: Exposes `BACKEND_PORT=8002`, runs `uvicorn app.main:app` with single worker process (`UVICORN_WORKERS=1`), and mounts persistent named volume `hf_cache:/root/.cache/huggingface`.
  - `frontend`: Exposes `FRONTEND_PORT=8003`, connects to backend via internal service DNS (`http://backend:8002`), and depends on backend health.
  - `hf_cache`: Named Docker volume ensuring downloaded Faster-Whisper weights are preserved across container restarts.

## 7. Technical challenges and noteworthy details

1. **Streaming Audio Stability Without Full Reprocessing Lag**:
   Naive streaming either re-transcribes everything from scratch (causing quadratic latency growth) or commits every word immediately (causing severe hallucinations and transcription errors). STT balances this by pairing a 2.0-second sliding buffer with a 1.0-second overlap. The hypothesis-merging algorithm verifies consistent words across window overlaps, ensuring only verified text is committed while the remainder is updated live.
2. **Global Asyncio Locking for CTranslate2 CPU Concurrency**:
   While CTranslate2 is heavily optimized for multi-threaded inference on a single request via OpenMP (`stt_cpu_threads`), running multiple concurrent inference requests through the same model instance on CPU causes extreme thread contention, high latency spikes, and potential memory crashes. The singleton `ModelManager` introduces an asynchronous mutex (`asyncio.Lock()`) that serializes inference requests cleanly while delegating computation to worker threads via `loop.run_in_executor()`.
3. **Seamless Streamlit Real-Time Updates via Web Audio Bridge**:
   Streamlit's execution paradigm reruns Python scripts on every state change, which would cause page flickering and WebSocket resets during continuous speech. STT resolves this by creating an independent `@st.fragment` that embeds raw JavaScript. The browser Web Audio API captures microphone audio, quantizes Float32 to Int16 PCM, streams binary chunks directly over WebSockets, and mutates the DOM directly without triggering Python script reruns.
4. **Deterministic Multi-Format Audio Ingestion via Asynchronous Subprocesses**:
   Supporting universal media uploads without memory-buffering huge video files requires robust transcoding. The service offloads conversion to FFmpeg via `asyncio.create_subprocess_exec`, stripping video tracks (`-vn`) and normalizing to 16 kHz mono 16-bit PCM WAV. The temporary file management system guarantees complete cleanup even if downstream inference fails.
5. **Silero VAD Silence Stripping**:
   Background silence and non-speech noise cause Whisper models to hallucinate repetitive phrases (e.g. "Thank you for watching"). Enabling Faster-Whisper's integrated Silero VAD (`vad_filter=True`) pre-filters audio segments, discarding silent chunks before they reach the acoustic encoder.
6. **Persistent Hugging Face Model Caching**:
   Downloading Faster-Whisper models on every container deployment introduces network latency and risks Hugging Face Hub rate limits. The Docker configuration mounts a persistent volume to `/root/.cache/huggingface`, ensuring that once downloaded, the model weights remain accessible locally across container rebuilds.

## 8. How to explain the system (suggested talking structure)

1. **Purpose & Value Proposition**: A production-grade speech-to-text microservice built with Faster-Whisper and FastAPI, providing high-accuracy batch transcription and low-latency real-time microphone streaming on standard CPU hardware without recurring cloud API fees.
2. **Architecture & Request Pipelines**:
   - Batch pipeline: REST multipart upload, asynchronous FFmpeg normalization to 16 kHz mono WAV, beam search decoding, and timestamped segment extraction.
   - Real-time pipeline: Full-duplex binary WebSockets, 2.0s sliding audio buffer with 1.0s overlap, and hypothesis-merging algorithm distinguishing committed text from live preview.
3. **Core Engineering Highlights**:
   - Global `asyncio.Lock()` inference serialization ensuring stability under concurrent load.
   - Browser Web Audio API JavaScript bridge embedded in Streamlit fragments for flicker-free streaming.
   - Integrated Silero Voice Activity Detection eliminating hallucinations during silence.
4. **Operations & Economics**: Containerized with multi-stage Docker builds, `libgomp1` OpenMP runtime, persistent Hugging Face cache volumes, and configurable `int8` CPU quantization.

## 9. Glossary

| Term                               | Meaning                                                                                                                                             |
| :--------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Faster-Whisper**                 | A reimplementation of OpenAI's Whisper model using CTranslate2, delivering up to 4x faster inference with lower memory consumption.                 |
| **CTranslate2**                    | A fast inference engine for Transformer models supporting custom quantization, layer fusion, and CPU/GPU kernel acceleration.                       |
| **PCM (Pulse-Code Modulation)**    | An uncompressed digital audio encoding method representing analog signals through discrete numerical samples.                                       |
| **VAD (Voice Activity Detection)** | An algorithmic filter (Silero VAD) that distinguishes human speech from background noise and silence.                                               |
| **Sliding Window**                 | A stream processing pattern that buffers a fixed duration of recent audio (2.0s) and slides forward by a fractional step (1.0s) between inferences. |
| **Hypothesis Merging**             | The algorithmic comparison of overlapping transcription windows to separate permanent committed text from live, provisional preview text.           |
| **Beam Search**                    | A heuristic search algorithm that explores a graph by expanding the most promising nodes in a limited set (beam width = 5).                         |
| **Quantization (`int8`)**          | The technique of reducing model weight precision from 32-bit floating point to 8-bit integers, reducing memory by 4x with minimal accuracy loss.    |
| **ScriptProcessorNode**            | A Web Audio API interface that allows direct JavaScript audio processing and PCM buffer extraction from a microphone stream.                        |
| **OpenMP (`libgomp1`)**            | An open multi-processing library providing multi-threaded shared-memory parallelism for CTranslate2 CPU kernels.                                    |
