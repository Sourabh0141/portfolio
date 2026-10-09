# ArchiveLens — Contributions

## 1. Role in the project

You built ArchiveLens as a separate application end to end, with FastAPI, Next.js and PostgreSQL, added OpenSearch later, and used Gemini, Mistral, Gemma and similar models. It was later merged into the Digilekh repository by someone else, who tuned and restructured it to fit the Digilekh code base.

## 2. Timeline of work

| Date                | Event                                                                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-07 to 09-08 | First integration: the `archivelens` package, tables, upload-time edition selection, a newspaper playground; Gemma and layout configuration |
| 2026-09-22          | Design study (prototype) and design rules; OpenSearch cluster; model probe suite; schema documents                                          |
| 2026-09-23          | Edition and upload model, ports, segment, OCR, group, categorise, index, finalize stages                                                    |
| 2026-09-24          | Loop-defence for OCR; the first package retired; first end-to-end measurement noted in the docs                                             |
| 2026-09-25 to 09-28 | Read path and search API; search, article and edition screens                                                                               |
| 2026-09-30          | Second version of services and frontend (edition pages, vocabularies, counts, every-word search)                                            |
| 2026-10-03 to 10-06 | Open items closed; ingestion fixes (OCR statuses, per-article categorise, bulk index); per-stage tests; dedicated queue                     |
