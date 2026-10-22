# Software Engineer Self-Appraisal Form

**Review period:** 01 Oct 2025 to 30 Sept 2026 · **Name:** Sourabh Sharma ·

---

## 1. Key accomplishments

This year I worked across Digilekh, LabelFort, ArchiveLens and our client engagement with The News Movement (TNM).

**1. Self-hosted voice features for Digilekh: speech-to-text and text-to-speech**
- **What I did:** Built two new GPU microservices and integrated them end to end in chat:
  - **Voice input (speech-to-text).** I moved it from OpenAI Whisper to Faster-Whisper INT8.
  - **Read-aloud answers (text-to-speech).** When a licence concern came up with Piper, I re-platformed TTS onto Kokoro-82M (Apache 2.0) two weeks after launch. I also added MinIO caching so repeated answers are not re-synthesised.
  - I wrote the technical documentation for both services.
- **Why it mattered:** Voice data stays on our own GPUs with no third-party API, in line with Digilekh's self-hosted design. The TTS stack is now licence-clean for commercial use.
- **Outcome:** Both features are live in production. In the benchmark recorded with the speech-to-text change:
  - transcribing 10 minutes of audio went from **77 s to 42 s (1.83× faster)**;
  - GPU memory dropped from **5–6 GB to about 1.25 GB**;
  - the PyTorch and FFmpeg dependencies were removed.

**2. Digilekh platform: file pipeline, multi-tenancy and security**
- **Direct-to-storage uploads.** Moved knowledge-base, chat, ticket and audio file transfers from server-proxied uploads to signed, scoped MinIO URLs with a finalize step and two layers of duplicate detection. Files no longer pass through, or sit in, the backend's memory. The presign → upload → finalize flow is still the platform's upload design.
- **Bulk folder upload.** Users can upload whole folders, and the folder structure is recreated as sub-spaces. URLs are generated in one batch request instead of one per file, and the uploads run in parallel (adaptive by file size).
- **Ingestion decoupled from the backend.** The ingestion service now updates status and cache and pushes real-time events itself, which removed fragile HTTP callbacks.
- **Security fixes.**
  - Added a three-layer defence against prompt injection and system-prompt leakage in the retriever.
  - Fixed an IDOR vulnerability in space membership.
  - Added environment-specific CORS.
  - Wrote the verification report for the security team's 12-issue audit (the remediation itself was led by Kanwar Sir).
- **Multi-tenancy.**
  - Built a centralised Redis cache layer (75 files), which replaced a 1,100+ line monolithic cache service.
  - Made cache keys and invalidation, including login rate limiting, organisation-scoped.
  - Implemented the Phase-5 cutover to the org-aware document index, following the lead's design.
  - This work supports Digilekh's move to a single multi-organisation SaaS.
- **Chat quality.** Ran the chat-subsystem QA checklist, logged 4 defects, and fixed all of them the next day. I also wrote the low-level design for the chat post-turn background worker, which was then implemented.

**3. AI-assisted annotation in LabelFort: SAM 2.1 and video object tracking**
- **SAM 2.1 polygon segmentation.** I integrated SAM 2.1 for polygon segmentation:
  - an orchestration service and API;
  - an annotator tool (click and bounding-box prompts that produce polygons);
  - verifier support.
- **Video tracking.** I added the video tracking service (YOLO11x detection with BoT-SORT/ReID tracking) and the full preprocessing pipeline around it:
  - a dedicated worker queue;
  - frames extracted once and reused;
  - timeouts sized to the video's length, and retry when the GPU is busy;
  - results imported directly into the annotator's track mode.
- **Why it mattered:** Annotators get AI-suggested polygons and object tracks instead of drawing every object frame by frame. This is core to LabelFort's value.
- **Outcome:** Both features shipped and remain in the main codebase. The current LabelFort docs for both still cite my architecture documents, and I wrote the testing checklists (289 items for SAM, 151 for video tracking).

**4. LabelFort platform: real-time messaging and the Synthetic Data Designer**
- **Messaging.** Moved background workers from Redis to a RabbitMQ broker:
  - added dead-letter queues on all 10 task queues, plus heartbeats and publisher confirms;
  - built real-time notifications and progress over MQTT for exports, AI pipelines, dataset uploads and batches, replacing SSE and Redis pub/sub;
  - made upload finalization secure and retry-safe;
  - added organisation-scoped AI model management with tenant isolation.
- **Synthetic Data Designer.** Built the backend and AI service and connected the UI to live APIs:
  - four generation journeys (prompt-only or reference-based, tabular or Q&A);
  - idempotent job dispatch;
  - live progress updates.
- **Outcome:** Fewer lost or duplicated background jobs and a consistent real-time update model across the product. The Synthetic Data Designer gives LabelFort a new data-generation capability.

**5. Client delivery for TNM: data pipelines on Google Cloud**
- **Transcription pipeline.** Built a new transcription-ingestion pipeline (Cloud Function plus Terraform infrastructure) that collects transcripts for Instagram, TikTok and YouTube content across two brands. It shipped with 102 test functions; 156 tests pass.
- **Automated tagging.** Split the automated-tagging monolith into two independently deployable functions with 107 unit tests, together with a teammate. I also fixed two production issues: staging was reading the production tag catalogue, and tagged rows were never leaving the daily sheet.
- **Instagram comment extraction.** Root-caused why comments were silently dropped: they were the source of all 8 ERROR logs in the affected window. After the fix, the worst-case wait for an unreachable post is **93 s instead of 165 s**, and 13 of 15 retried items succeed on the second attempt.
- **Capsule TikTok onboarding.** Added the Capsule TikTok account to extraction and analytics, and caught a latent bug that would have written its data into the wrong brand's dataset. It is now enabled in production.
- **YouTube engagedViews.** The YouTube engagedViews metric is now stored and exposed.
- **Code-complete, with testing and deployment pending:**
  - replacing Memcached with a Cloud Storage cache, which removes two managed Memcached instances and a VPC connector;
  - retry-safety and alerting for the tagging workflow;
  - turning on the production transcription schedulers;
  - keyless AWS→GCP access for Wire.

**Other contributions**
- **ArchiveLens:** I took over the existing project and refactored it, fixed issues, and added hybrid search over newspaper articles. The search combines keyword, full-text and vector retrieval inside PostgreSQL (using extensions) and merges their scores into one ranked result. An intern, Nimit, worked under me on ArchiveLens; I assigned tasks, explained the codebase and guided the work. ArchiveLens has since been merged into Digilekh by the team.
- **Sankirtan:** Built the async FastAPI backend: authentication, moderation workflow, image storage, migrations and a 62-test integration suite.
- **Wire (TNM), from 30 Sept:** Built the API that reads the tag catalogue from BigQuery and saves video classifications.

---

## 2. Self-rating by competency

| Competency | Rating | Example |
|---|:---:|---|
| **Technical execution:** code quality, design, testing, reliability | **4** | The TNM transcription pipeline shipped with 102 test functions using mocked external services, so it can be tested without live cloud credentials. My SAM and tracking integrations are documented to a level the team still uses. |
| **Problem solving:** debugging, handling ambiguity, root-cause thinking | **4** | The Instagram extraction was "succeeding" while silently dropping posts. I traced it to a retry helper returning nothing after exhausting retries. I then fixed the timeout and retry strategy and the alerting rather than just catching the error. |
| **Delivery & ownership:** estimates, hitting commitments, seeing work through to prod | **3** | I owned speech-to-text and text-to-speech end to end (service, API, UI and docs), and re-platformed TTS quickly when the licence issue surfaced. A few TNM changes are still awaiting testing and deployment, and my turnaround can be faster (see Section 4). |
| **Collaboration:** code reviews, working with product/design/QA, async communication | **3** | I worked in a PR-based process with TNM's engineering team and acted on review feedback. I also ran the lead's QA checklist on chat and turned its findings into fixes the next day. I want to communicate my reasoning more clearly (Section 4). |
| **Learning & growth:** new skills, tech picked up, feedback acted on | **4** | Picked up several stacks this year and delivered with each: GCP (Cloud Functions, Workflows, BigQuery, Terraform), AWS CDK and Lambda, RabbitMQ, LangGraph, self-hosted speech models, SAM 2.1 and YOLO-based tracking. |
| **Mentorship & influence (mid/senior+):** helping others, docs, raising team standards | **4** | I guided interns this year. Nimit worked under me on ArchiveLens, and I also mentored Saksham by explaining tasks, codebases and technical approaches. I wrote the primary technical docs for my features (speech-to-text, TTS, presigned uploads, folder upload, SAM, tracking, Synthetic Data Designer) and testing checklists (289, 151 and 352 items) that QA and teammates use. |

---

## 3. Challenges

**Challenge: frequent project switching across very different stacks.** This year I moved through Digilekh, then LabelFort, back to Digilekh, then ArchiveLens, TNM, and most recently Wire. Each had a different stack: from FastAPI and Next.js, to RabbitMQ and GPU model services, to GCP with Terraform and BigQuery, to AWS CDK and video processing. The hardest part was not any single technical problem. It was rebuilding context quickly each time while staying productive, and making sure nothing was left half-finished when priorities moved. Today I also work on two projects in parallel each day: about 5 hours on the Wire client project and about 3 hours on LabelFort. That makes context management a daily discipline rather than an occasional one.

**How I handled it:**
- I start each new codebase by reading its documentation and git history before changing anything.
- I write documentation as I go, so the next person (often future me) can ramp up faster.
- In unfamiliar code, especially the client's, I rely on tests: I write tests around a change before trusting it.

**What I would do differently:**
- Ask for a short handover session at each switch.
- Time-box my ramp-up.
- With two parallel projects, block fixed time for each and agree priorities with my leads upfront, so neither project's commitments slip.
- Keep an explicit close-out list before moving on. Some TNM work is code-complete but still awaiting testing and deployment because I moved to Wire. I want to close such loops before switching next time.

---

## 4. Areas for improvement

1. **Execution speed without losing quality.** I sometimes re-review work more times than it needs, which slows delivery.
   - **What I'm doing:** I am moving to a fixed self-review checklist with a time-box, then relying on tests and code review instead of repeated re-checking.
   - **Measure of success:** I will track estimated against actual time on my tasks, so I can see the gap shrink.
2. **Core programming fundamentals** (data structures, algorithms, and how the languages I use work under the hood). I can deliver complex features, but I want stronger fundamentals so that my design decisions come from first principles rather than pattern-matching.
   - **What I'm doing:** I already study for about 2–3 hours most nights and will keep that routine.
   - **Measure of success:** applying what I learn directly in code reviews and design choices at work.
3. **Explaining technical ideas clearly.** I sometimes understand a solution well but struggle to explain it concisely in discussions. My written documentation is strong, and I want my verbal explanations to match it.
   - **What I'm doing:** I will write a short summary of the problem, my approach and the trade-offs before each technical discussion, and I will volunteer to walk the team through features I build.

---

## 5. Feedback for your Tech Lead & team

**Keep doing:**
- Kanwar Sir's hands-on technical leadership has helped me throughout the year. His clear low-level designs and task briefs, his QA checklists, and his willingness to trust me with new areas like speech, segmentation, tracking and client work have all made a real difference.
- The PR-based workflow and the documentation culture in the team are working well, and I would like them to continue.

**Start (one constructive suggestion):**
- Kanwar Sir is clearly carrying many roles at once; judging by the commit history alone, he has found a way to add extra hours to the day.
- If possible, I would request that **Anil Sir** help take some of that load off his plate. Kanwar Sir would then have a little more time to sit with team members individually: to walk through new tasks, discuss technical approaches before we start, and give guidance along the way.
- I believe even a short regular slot of this kind would improve task clarity and help the whole team learn faster and deliver with fewer iterations.

**Stop:** Nothing significant.

---

## 7. Goals for next period

1. **Close out pending TNM work** *(Delivery)*: Complete testing and deployment of the code-complete items, coordinating with the client team, by **31 Dec 2026**, subject to client priorities and alongside my current Wire and LabelFort work. These are the Cloud Storage cache migration, tagging retry-safety and alerting, the production transcription schedulers, and Wire's keyless AWS→GCP access.
2. **Take Wire's video watermarking to production** *(Delivery)*: Integrate the watermark engine into Wire's processing pipeline and add an automated test suite for the ID codec and the embedding and verification path, by **20 Nov 2026**.
3. **Deliver faster with the same quality** *(Delivery)*: Track estimated against actual time on all my tasks from **Nov 2026**, and by **Mar 2027** deliver most tasks within their estimate, using a time-boxed self-review checklist.
4. **Strengthen fundamentals and start the MCA (AI/ML)** *(Technical growth)*: Continue my nightly study routine. Enrol in the online MCA (AI & ML specialisation) in **Nov 2026** and complete the first semester successfully while keeping my work commitments.

---

## 8. Career aspirations

In 12 to 24 months I want to be working as an **AI Engineer**: designing, integrating and evaluating AI models and agentic systems in production, not only building the services around them.

This year has already moved me in that direction:
- self-hosted speech models;
- SAM 2.1 segmentation and YOLO-based tracking;
- LLM security hardening;
- a LangGraph-based research workflow;
- synthetic data generation;
- video watermarking.

To build a stronger foundation, I am starting an **online MCA with a specialisation in AI and Machine Learning in November 2026**. The programme is fully online with no campus attendance, so I will continue working full-time; my studies will fit around work in the evenings and on weekends. I see the degree as an investment that will make me more useful to the company, not a step away from it.

**Support that would help me most:**
- **Projects:** more assignments with a meaningful AI component, such as model integration and evaluation, retrieval and agents, or computer vision, where I can apply what I am learning.
- **Exposure:** being involved in technical design discussions for AI features, even as an observer at first.

---

## 9. Anything else

- **Current work (Oct 2026).** I currently split my day between the Wire client project (about 5 hours) and LabelFort (about 3 hours). On Wire I have since built the core of the video-ID watermarking system:
  - a payload codec with error correction, so the ID is recovered even if 8 of 32 bytes are damaged by re-encoding;
  - random 64-bit content IDs;
  - an invisible-watermark embedding engine based on PixelSeal.

  This sits outside the review period but shows where my work is heading.
- **Learning outside work.** I regularly build personal projects at home to learn new technology. Examples: a voice-based AI companion app (streaming speech-to-text → LLM → text-to-speech with a lip-synced 3D avatar, on Cloudflare with Terraform). These are personal experiments, done in my own time, and they feed directly into the skills I bring to work.
- Thank you to Anil Sir, Kanwar Sir, and the team for the opportunities and trust this year. I am committed to continuing to grow here, as an engineer now and as an AI Engineer in the future.
