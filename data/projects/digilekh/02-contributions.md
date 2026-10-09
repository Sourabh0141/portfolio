# Digilekh — Contributions

## 1. Role in the project

You were one full-stack backend engineer on a growing product. You worked across the core API, the frontend, the ingestion service and two new services.

## 2. What survives and what was replaced

This table is the most important context for describing your work. The product changed direction in April to May 2026 and several features you built were deliberately removed.

| Your work                                                                        | Fate                         |
| -------------------------------------------------------------------------------- | ---------------------------- |
| Speech-to-text service (Faster-Whisper)                                          | Present and wired            |
| Text-to-speech service (Piper, then Kokoro)                                      | Present and wired            |
| Persistent notifications (table, API, toast UI) and note sharing                 | Partly live                  |
| Presigned upload, duplicate detection, folder upload                             | Concept live, code rewritten |
| Async migration (SQLAlchemy async, aioboto3, httpx)                              | Live as an approach          |
| Centralized Redis cache layer                                                    | Live, extended               |
| Single `indexed_document_chunks` table across three services                     | Live                         |
| LLM security (three layers) and IDOR fix                                         | Partly live                  |
| Admin features (registration approval, dashboard, password reset, feedback form) | Partly live                  |
| Chat context builder with progressive summarisation                              | Replaced                     |
| Image spaces and vision agent                                                    | Partly live                  |
| Prompt gallery (custom prompts)                                                  | Live, rewritten              |
| Live chat on MQTT (EMQX) with a standalone service                               | Removed                      |
| Deep Research (Celery, Redis status, MQTT push, LangGraph)                       | Removed                      |
| Ticket attachment flows and notifications                                        | Removed                      |
| Email template system and live preview                                           | Removed                      |
| User presence tracking, and its removal                                          | Removed                      |
| Data extraction feature and its removal                                          | Removed                      |

## 3. Timeline of work

| Period             | Work                                                                                                                                                                                            |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2025-07 to 2025-08 | Chat/ticket clean-up, attachment rendering, a bulk add of GPU search services, registration approval, feedback form, admin activity dashboard                                                   |
| 2025-09            | Chat moved from WebSocket to MQTT (EMQX); common spaces and cache invalidation; group chat for common spaces                                                                                    |
| 2025-10            | Live chat reliability, token-budgeted context builder, Image Spaces; async SQLAlchemy migration of all three services; aioboto3/httpx                                                           |
| 2025-11            | Deep Research on Celery then MQTT push; indexing and user notifications over MQTT; persistent notifications; note sharing; prompt gallery; password reset; email templates                      |
| 2025-12            | Voice input and Faster-Whisper; text-to-speech (Piper, then Kokoro) with caching; presigned upload flows and duplicate detection; ingestion decoupling; auth clean-up; Deep Research Gemini key |
| 2026-01            | Deep Research to LangGraph; bulk folder upload; CORS; data extraction removed; LLM security layers; IDOR fix                                                                                    |
| 2026-02 to 2026-03 | No commits                                                                                                                                                                                      |
| 2026-04            | Centralized Redis cache layer                                                                                                                                                                   |
| 2026-05            | Org-scoped ingestion and cache keys; chunk-table cut-over; presence removal; realtime indexing UX; extraction ORM and retriever typing fixes                                                    |
| 2026-06 to 2026-07 | Redis regression checklist, chat QA checklist, chat session stabilization, chat post-turn worker design, extraction batch caps                                                                  |
