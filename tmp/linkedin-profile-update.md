# LinkedIn Profile Update Guide

Everything needed to update the LinkedIn profile of Sourabh Sharma: the order of work, the exact text for each section, placement rules, and a final verification checklist.

Every factual claim in the copy below was checked against the portfolio (`src/content`, `src/data/site.ts`) and the project dossiers in `data/projects`. Character counts were measured against LinkedIn's field limits.

## Contents

1. [Before you start](#1-before-you-start)
2. [Confirm before publishing](#2-confirm-before-publishing)
3. [Implementation steps](#3-implementation-steps)
4. [Content: intro card](#4-content-intro-card)
5. [Content: About](#5-content-about)
6. [Content: Experience](#6-content-experience)
7. [Content: Projects](#7-content-projects)
8. [Content: Skills](#8-content-skills)
9. [Content: Featured](#9-content-featured)
10. [Content: Education](#10-content-education)
11. [Settings: Open to work](#11-settings-open-to-work)
12. [After publishing: recommendations and activity](#12-after-publishing-recommendations-and-activity)
13. [Final verification checklist](#13-final-verification-checklist)

---

## 1. Before you start

- **Turn off update broadcasts.** Go to Settings → Visibility → "Share profile updates with your network" and switch it off, so your network is not notified of each individual edit. Switch it back on when you finish if you want future changes announced.
- **Work on desktop.** Some sections (Featured, skill ordering, custom URL) are easier or only available in the desktop site.
- **Paste as plain text.** LinkedIn does not render Markdown. Copy only the text inside each grey block. The bullet characters (`•` and `▸`) and line breaks are part of the copy and will display as written.
- **Field limits used in this guide:**

  | Field                            | Limit            |
  | :------------------------------- | :--------------- |
  | Headline                         | 220 characters   |
  | About                            | 2,600 characters |
  | Experience description, per role | 2,000 characters |
  | Project description              | 2,000 characters |
  | Skills                           | 100 skills       |
  | Top skills shown under About     | 5 skills         |

---

## 2. Confirm before publishing

Four points could not be settled from the portfolio or the dossiers. Resolve each one before the related text goes live.

| #   | Item                       | What to confirm                                                                                                                                                                                                                       | If it does not hold                                                    |
| :-- | :------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :--------------------------------------------------------------------- |
| 1   | Digilekh ingestion wording | The dossier attributes ingestion decoupling, organization-scoped ingestion and the unified chunk table to you. The portfolio uses the broader "Engineered a 9-stage Celery ingestion pipeline". This guide uses the narrower wording. | If you built the pipeline as a whole, swap in the portfolio's wording. |
| 2   | Sankirtan                  | Whether it is Predusk work and whether it is deployed. The dossier confirms only that you are the sole author of the backend.                                                                                                         | Leave the Sankirtan project out until confirmed.                       |
| 3   | Project dates              | Flare and the portfolio site have no dates in the dossiers. ArchiveLens dates below come from the dossier's timeline (September to October 2026).                                                                                     | Enter the real dates.                                                  |
| 4   | Résumé                     | The Featured section links to the résumé PDF on the portfolio. Check that the PDF is current and agrees with this profile.                                                                                                            | Update the PDF first, or leave the résumé out of Featured.             |

Caliber is named with your approval. Its individual brands are not named anywhere in this guide; keep it that way unless the client agrees otherwise.

---

## 3. Implementation steps

Work through these in order. Each step points to the section holding the exact content.

| Step | Section on LinkedIn                 | Action                                                                                         | Content     |
| :--- | :---------------------------------- | :--------------------------------------------------------------------------------------------- | :---------- |
| 1    | Settings                            | Turn off profile update broadcasts.                                                            | Section 1   |
| 2    | Public profile & URL                | Set the custom profile URL.                                                                    | Section 4.1 |
| 3    | Intro card (pencil beside the name) | Replace the headline. Check location, current position and education shown on the card.        | Section 4.2 |
| 4    | Contact info                        | Add the portfolio and GitHub links.                                                            | Section 4.3 |
| 5    | Banner                              | Upload a banner whose text matches the new headline.                                           | Section 4.4 |
| 6    | About                               | Replace the full text, then choose the five top skills.                                        | Section 5   |
| 7    | Experience                          | Replace the description of all three Predusk roles. Do not create new entries.                 | Section 6   |
| 8    | Add section → Projects              | Add the projects in the order given.                                                           | Section 7   |
| 9    | Skills                              | Remove, rename, add, map to roles, then reorder.                                               | Section 8   |
| 10   | Add section → Featured              | Add the links in the order given.                                                              | Section 9   |
| 11   | Education                           | Update the degree entry.                                                                       | Section 10  |
| 12   | Open to                             | Set job preferences, visible to recruiters only.                                               | Section 11  |
| 13   | Whole profile                       | Run the final verification checklist.                                                          | Section 13  |
| 14   | Other places                        | If the URL changed in step 2, update it in `src/data/site.ts`, `README.md` and the résumé PDF. | Section 4.1 |
| 15   | Recommendations and posts           | Request recommendations and publish a first post.                                              | Section 12  |

---

## 4. Content: intro card

### 4.1 Custom URL

Where: your profile → "Public profile & URL" (top right) → "Edit your custom URL".

First choice:

```text
sourabh0141
```

This gives `linkedin.com/in/sourabh0141`, matching the GitHub handle `Sourabh0141`. If it is taken, use:

```text
sourabh-sharma-dev
```

The old URL stops being the canonical one, so update every place that links to it: `socials` in `src/data/site.ts`, the contact block in `README.md`, and the résumé PDF.

### 4.2 Headline

Where: pencil icon beside your name → Headline. Length: 182 of 220 characters.

```text
Software Engineer @ Predusk | Backend Systems & Applied AI | Python · FastAPI · PostgreSQL · RabbitMQ · MQTT | RAG, Computer Vision & Speech AI in Production | AWS · GCP · Cloudflare
```

Placement notes:

- Search results and comments show only the start of the headline, so the role and speciality come first and the tools follow.
- Leave the **current position** field as your official title, "Associate Software Developer (AI/ML)". The headline is free text; the position title should match your employment record.
- Keep location as "Jaipur, Rajasthan, India".

### 4.3 Contact info

Where: "Contact info" link on the intro card → pencil.

| Field                           | Value                            |
| :------------------------------ | :------------------------------- |
| Website (Portfolio)             | `https://sourabh.pages.dev`      |
| Website (Other, label "GitHub") | `https://github.com/Sourabh0141` |
| Email                           | `sourabh.sharma0141@gmail.com`   |

### 4.4 Banner

Recommended size: 1584 × 396 pixels. Keep the current visual style and change the text so it matches the headline:

```text
Building Backend Systems That Scale
Backend Systems & Applied AI
Python · FastAPI · RabbitMQ · AWS · GCP
```

Keep the text clear of the lower-left corner, where the profile photo overlaps the banner.

---

## 5. Content: About

Where: About section → pencil. Length: 2,219 of 2,600 characters.

Only the first few lines show before "…see more", so the opening paragraph carries the positioning on its own.

```text
I build the backend systems that production AI depends on: async Python services, event-driven messaging, and the pipelines that put vision, speech, and retrieval models in front of real users.

I'm a software engineer at Predusk Technology in Jaipur. I started in back-office operations, moved into the AI & ML engineering team, and now lead offshore backend and cloud engineering for Caliber, a social video business. Most of my work is finding the fragile part of a system and engineering it out: blocking I/O that starves the event loop, polling where a broker should push, state that leaks between tenants.

What I've shipped:

▸ Caliber (cross-cloud data platform on GCP and AWS): keyless AWS-to-GCP Workload Identity Federation so Lambda services query BigQuery without static keys, an async video transcription pipeline with idempotent BigQuery jobs, and LLM tagging split into Cloud Functions with guarded MERGE write-backs.
▸ Labelfort (AI data annotation platform): replaced polling and SSE with a RabbitMQ topic exchange and Web-MQTT gateway for real-time progress across 5 event domains, and integrated GPU services for SAM 2.1 segmentation and YOLO11x + BoT-SORT video tracking.
▸ Digilekh (document intelligence and RAG): migrated 3 services to non-blocking I/O, made the 9-stage ingestion pipeline and its caches organization-scoped, and added self-hosted Faster-Whisper and Kokoro speech services.
▸ OceanMind (travel automation): parallel Playwright execution with one isolated browser context per cabin across 5 supplier portals, with live progress over SSE and screenshot and video evidence for human review.
▸ ArchiveLens (document AI): built end to end, turning scanned Hindi newspapers into searchable articles with layout segmentation, OCR, and OpenSearch.

Outside work I built Flare, a voice-first 3D AI companion deployed on Cloudflare's serverless edge.

Toolkit: Python, TypeScript, SQL | FastAPI, SQLAlchemy (async), Celery, Pydantic | RabbitMQ, MQTT, WebSockets, SSE | PostgreSQL, Redis, BigQuery, OpenSearch, Qdrant, MinIO/S3 | AWS, Google Cloud, Cloudflare, Terraform, Docker | Playwright, Pytest, GitHub Actions

Portfolio: https://sourabh.pages.dev
Email: sourabh.sharma0141@gmail.com
```

**Top skills.** In the same edit dialog, under "Skills", select these five in this order:

1. Python
2. FastAPI
3. Back-End Web Development
4. Retrieval-Augmented Generation (RAG)
5. Amazon Web Services (AWS)

Skills 3 and 5 must be added to the profile first (section 8) before they can be selected here. Return to this step after section 8 if they are not yet available.

---

## 6. Content: Experience

Edit the three existing Predusk entries. Keep them grouped under one company so the progression stays visible. Titles and company stay as they are; replace the descriptions, and set the dates from your Predusk records.

### 6.1 Associate Software Developer (AI/ML)

| Field           | Value                                |
| :-------------- | :----------------------------------- |
| Title           | Associate Software Developer (AI/ML) |
| Employment type | Full-time                            |
| Company         | Predusk Technology Private Limited   |
| Location        | Jaipur, Rajasthan, India · On-site   |
| Dates           | Nov 2025 – Present                   |

Description. Length: 1,864 of 2,000 characters.

```text
Leading offshore backend and cloud engineering for Caliber, a social video business, while building distributed systems, real-time messaging, and production AI services across Predusk's platforms.

Caliber | Cross-cloud social video and data platform (GCP + AWS)
• Built keyless AWS-to-GCP Workload Identity Federation so AWS Lambda services query BigQuery without static service account keys.
• Split automated tagging into separate Cloud Functions with LLM classification and guarded SQL MERGE write-backs that preserve editorial input.
• Built a video transcription pipeline with a time-budgeted async worker pool, full-jitter retry backoff, and deterministic BigQuery job IDs for idempotent retries.
• Added tenant-checked, write-once content classification to the Wire newsroom app using DynamoDB conditional writes.

Labelfort | Multi-tenant AI data annotation platform (formerly DADP)
• Replaced polling and SSE with a RabbitMQ topic exchange and Web-MQTT gateway, delivering real-time progress for 5 event domains with role-based topic filtering.
• Integrated GPU services for click/box segmentation (SAM 2.1) and multi-object video tracking (YOLO11x + BoT-SORT).
• Built the Synthetic Data Designer: draft, preview, execution, records, and CSV export, with live progress.

Digilekh | Document intelligence and RAG platform
• Migrated 3 services to non-blocking I/O (SQLAlchemy 2 async, asyncpg, aioboto3, httpx).
• Decoupled and organization-scoped the 9-stage Celery ingestion pipeline (Surya OCR, page-level chunking, hybrid dense/sparse vectors in Qdrant).
• Added self-hosted speech services (Faster-Whisper, Kokoro) and a tenant-isolated Redis cache layer.

ArchiveLens | Historical newspaper AI and search
• Built end to end: layout segmentation, Surya OCR on vLLM with loop defence, and an OpenSearch index with Hindi and transliteration analyzers.
```

### 6.2 Data Analyst Trainee (AI & ML Engineering)

| Field           | Value                                           |
| :-------------- | :---------------------------------------------- |
| Title           | Data Analyst Trainee (AI & ML Engineering)      |
| Employment type | Full-time                                       |
| Company         | Predusk Technology Private Limited              |
| Location        | Jaipur, Rajasthan, India · On-site              |
| Dates           | Start date from your Predusk records – Oct 2025 |

Description. Length: 922 of 2,000 characters.

```text
Built web automation and internal tooling in the AI & ML engineering team, focused on browser automation and non-blocking data access.

OceanMind | Cruise quoting automation across 5 travel-agent portals
• Rebuilt the browser architecture on async Playwright: shared long-lived Chromium instances with one isolated context per cabin, run concurrently.
• Moved the database and object storage layers from blocking drivers to asyncpg and aioboto3 connection pools.
• Streamed live execution logs over Server-Sent Events with per-user isolation and run cancellation.
• Built fare-comparison and pricing logic across supplier portals, with screenshot and video evidence (FFmpeg, MinIO) for human validation.

PV InstaTemplate | Internal productivity tool
• Built, end to end, a Manifest V3 Chrome extension and Express/SQLite API that expands saved templates in text fields on any web page. Used by Predusk's back-office team.
```

### 6.3 Back Office Agent

| Field   | Value                              |
| :------ | :--------------------------------- |
| Title   | Back Office Agent                  |
| Company | Predusk Technology Private Limited |
| Dates   | Oct 2023 – Nov 2024                |

Description:

```text
Back-office operations role at Predusk before moving into the AI & ML engineering team.
```

Keep this entry. It shows three roles at one company and gives context to PV InstaTemplate, which was built for this team.

---

## 7. Content: Projects

Where: "Add profile section" → Recommended → "Add projects". Add them in the order below so they display in this order. Where a project belongs to a role, pick that role under "Associated with".

### 7.1 Flare

| Field           | Value                                                                           |
| :-------------- | :------------------------------------------------------------------------------ |
| Project name    | Flare: Voice-First 3D AI Companion                                              |
| Associated with | None (personal project)                                                         |
| Dates           | Enter the real dates (section 2, item 3)                                        |
| Link            | `https://flare-ai.pages.dev`                                                    |
| Skills          | TypeScript, Next.js, Cloudflare Workers, Terraform, Large Language Models (LLM) |

Description. Length: 860 of 2,000 characters.

```text
A voice-first AI companion with an expressive 3D character that listens, thinks, and speaks with synchronized lip movement. The web client and API run on Cloudflare Pages and Workers.

• Chained Whisper Large v3 Turbo, Llama 3.1 8B, and Kokoro 82M over streaming Server-Sent Events, synthesizing audio sentence by sentence so playback starts while the model is still writing.
• Built 60 FPS lip-sync in the browser: Web Audio FFT analysis blended with a text-timed viseme timeline drives the character's ARKit mouth shapes, with no server-side phoneme alignment.
• Implemented echo-guarded voice activity detection (adaptive noise-floor tracking, with optional Silero neural VAD) so users can interrupt mid-sentence.
• Structured as a monorepo: Next.js 16, Hono on Cloudflare Workers, D1, and R2, provisioned with Terraform and deployed through GitHub Actions.
```

### 7.2 ArchiveLens

| Field           | Value                                                                    |
| :-------------- | :----------------------------------------------------------------------- |
| Project name    | ArchiveLens: Historical Newspaper AI & Search                            |
| Associated with | Associate Software Developer (AI/ML), Predusk                            |
| Dates           | Sep 2026 – Oct 2026 (section 2, item 3)                                  |
| Link            | None                                                                     |
| Skills          | Python, FastAPI, Celery, OpenSearch, Optical Character Recognition (OCR) |

Description. Length: 732 of 2,000 characters.

```text
An end-to-end system that turns scanned Hindi newspaper editions into searchable articles, shown where they were printed. Built as a standalone application and later merged into the Digilekh platform.

• Combined instance segmentation with a 12-pass Shapely polygon refinement to handle modular and L-shaped print layouts.
• Built an 8-stage Celery pipeline with Surya OCR on vLLM, using compression-ratio checks and temperature escalation to stop repetitive OCR output on dense Devanagari text.
• Designed an OpenSearch index with ICU transliteration and custom Hindi analyzers, so Latin-script queries find Devanagari text.
• Delivered Next.js reading screens that show polygon-clipped print clippings beside the transcribed text.
```

### 7.3 Sankirtan (add only after confirming section 2, item 2)

| Field           | Value                                                       |
| :-------------- | :---------------------------------------------------------- |
| Project name    | Sankirtan: Moderated Community Event Platform (Backend)     |
| Associated with | Associate Software Developer (AI/ML), Predusk, if confirmed |
| Dates           | Mar 2026                                                    |
| Link            | None                                                        |
| Skills          | Python, FastAPI, PostgreSQL, SQLAlchemy, REST APIs          |

Description. Length: 713 of 2,000 characters.

```text
Backend for a community platform where the public submits devotional gatherings with a poster image and one administrator moderates them before they are listed. Sole author of the backend.

• Implemented the moderation workflow as compare-and-swap UPDATE ... RETURNING statements backed by PostgreSQL CHECK constraints, so racing requests stay safe without row locks.
• Hardened the unauthenticated upload with three-stage image verification on bounded worker threads.
• Built rate limiting on HMAC-SHA256 keyed IP hashes counted from existing tables, storing no raw addresses.
• Secured admin access with Argon2 and HttpOnly JWT cookies, with an advisory-locked migration runner and HTTP-level integration tests.
```

### 7.4 Developer Portfolio

| Field           | Value                             |
| :-------------- | :-------------------------------- |
| Project name    | Developer Portfolio               |
| Associated with | None (personal project)           |
| Dates           | Enter the real dates              |
| Link            | `https://sourabh.pages.dev`       |
| Skills          | TypeScript, GitHub Actions, CI/CD |

Description. Length: 524 of 2,000 characters.

```text
My portfolio site: a zero-framework static site built with Astro, TypeScript, and vanilla CSS, deployed to Cloudflare Pages.

• Content lives in YAML collections validated by Zod schemas, so a bad entry fails the build.
• Strict Content Security Policy with SHA-256 hashes for inline scripts, plus hardened edge headers.
• Works fully without JavaScript; the client script only adds theme switching, navigation, and copy actions.
• A GitHub Actions pipeline runs formatting, lint, type checks, and build before every deploy.
```

---

## 8. Content: Skills

Where: Skills section → pencil, or "+" to add. Do the four parts in order.

### 8.1 Remove

| Skill                    | Reason                                       |
| :----------------------- | :------------------------------------------- |
| Microsoft Excel          | Not relevant to the roles you are targeting  |
| Chatbot Development      | Covered more precisely by RAG and LLM skills |
| Prompt Engineering       | Low signal next to the engineering skills    |
| Selenium                 | Not evidenced in the portfolio or dossiers   |
| C (Programming Language) | Not used in any listed work                  |
| C++                      | Not used in any listed work                  |

### 8.2 Rename

LinkedIn skills cannot be renamed in place. Delete "Mqtt" and add "MQTT" from the suggestion list.

### 8.3 Final skill list

After the changes the profile holds 51 skills. Type each name and pick the matching LinkedIn suggestion so the skill is recognised in search; where LinkedIn offers a slightly different standard name, use LinkedIn's.

**Keep (19):** Python (Programming Language), FastAPI, PostgreSQL, RabbitMQ, MQTT, Celery, Docker, Microservices, Playwright, MinIO, Retrieval-Augmented Generation (RAG), LangGraph, Computer Vision, Web Scraping, Automation, Google Gemini API, Artificial Intelligence (AI), Machine Learning, Software Development.

**Add (32):**

| Group   | Skills                                                                                                                                                                    |
| :------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Backend | Back-End Web Development, REST APIs, SQLAlchemy, Pydantic, Asynchronous Programming, Distributed Systems, Event-Driven Architecture, WebSockets, SQL, TypeScript, Next.js |
| Data    | Redis, Google BigQuery, OpenSearch, Qdrant, Vector Databases, Amazon S3, Amazon DynamoDB                                                                                  |
| Cloud   | Amazon Web Services (AWS), AWS Lambda, Google Cloud Platform (GCP), Cloudflare Workers, Terraform, GitHub Actions, CI/CD                                                  |
| AI      | Large Language Models (LLM), Optical Character Recognition (OCR), Speech Recognition, Text-to-Speech, Image Segmentation, Object Tracking                                 |
| Testing | Pytest                                                                                                                                                                    |

### 8.4 Map skills to roles

When adding or editing a skill, tick the role where it was used.

| Role                                       | Skills to associate                                                                                                                                                                                                                                                                                                                                                                                                |
| :----------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Associate Software Developer (AI/ML)       | FastAPI, RabbitMQ, MQTT, Celery, Docker, Microservices, RAG, LangGraph, Computer Vision, Google Gemini API, SQLAlchemy, Pydantic, Distributed Systems, Event-Driven Architecture, WebSockets, Redis, Google BigQuery, OpenSearch, Qdrant, Vector Databases, Amazon S3, Amazon DynamoDB, AWS, AWS Lambda, GCP, Terraform, LLM, OCR, Speech Recognition, Text-to-Speech, Image Segmentation, Object Tracking, Pytest |
| Data Analyst Trainee (AI & ML Engineering) | Playwright, Web Scraping, Automation, MinIO                                                                                                                                                                                                                                                                                                                                                                        |
| Both roles                                 | Python, PostgreSQL, Back-End Web Development, REST APIs, Asynchronous Programming, SQL, Artificial Intelligence (AI), Machine Learning, Software Development                                                                                                                                                                                                                                                       |
| Projects only (Flare, Portfolio)           | TypeScript, Next.js, Cloudflare Workers, GitHub Actions, CI/CD                                                                                                                                                                                                                                                                                                                                                     |

### 8.5 Order

Where: Skills → "⋯" → Reorder. Only the first skills show before "Show all", so drag these to the top in this order:

1. Python (Programming Language)
2. FastAPI
3. Back-End Web Development
4. PostgreSQL
5. RabbitMQ
6. Amazon Web Services (AWS)
7. Google Cloud Platform (GCP)
8. Retrieval-Augmented Generation (RAG)
9. Distributed Systems
10. Computer Vision

The rest can stay in any order.

---

## 9. Content: Featured

Where: "Add profile section" → Recommended → "Add featured" → "+" → "Add a link". Add in this order; the first two or three are visible without scrolling.

| Order | Link                                                         | Title                                    | Description                                                                     |
| :---- | :----------------------------------------------------------- | :--------------------------------------- | :------------------------------------------------------------------------------ |
| 1     | `https://sourabh.pages.dev`                                  | Portfolio: Sourabh Sharma                | Selected backend, real-time messaging and applied AI systems, with full detail. |
| 2     | `https://sourabh.pages.dev/resume/Sourabh-Sharma-Resume.pdf` | Résumé (PDF)                             | One-page summary of experience and skills.                                      |
| 3     | `https://flare-ai.pages.dev`                                 | Flare: Voice-First 3D AI Companion       | Personal project on Cloudflare Workers and Pages. Invite-only.                  |
| 4     | `https://www.labelfort.ai`                                   | Labelfort: AI Data Annotation Platform   | Built its real-time event platform, SAM and video tracking integrations.        |
| 5     | `https://digilekh.predusk.ai`                                | Digilekh: Document Intelligence Platform | Worked on ingestion, the async backend migration and speech services.           |

Add link 2 only after section 2, item 4 is confirmed.

---

## 10. Content: Education

### 10.1 University of Rajasthan, Jaipur

| Field          | Value                                   |
| :------------- | :-------------------------------------- |
| Degree         | Bachelor of Computer Applications (BCA) |
| Field of study | Computer Science                        |
| Dates          | Jul 2022 – Jun 2025                     |

Description:

```text
SSG Pareek College, University of Rajasthan.
```

Remove the "C (Programming Language)" and "C++" skill tags from this entry; they are deleted from the profile in section 8.1.

### 10.2 Bright Future Senior Secondary School

Leave as it is. No description needed.

---

## 11. Settings: Open to work

Where: "Open to" button on the intro card → "Finding a new job".

| Field          | Value                                                              |
| :------------- | :----------------------------------------------------------------- |
| Job titles     | Backend Engineer, Software Engineer, AI Engineer, Python Developer |
| Location types | Your choice of on-site, hybrid, remote                             |
| Locations      | Your choice                                                        |
| Start date     | Your choice                                                        |
| Visibility     | **Recruiters only**                                                |

"Recruiters only" does not add the green photo frame. LinkedIn takes steps to hide this setting from recruiters at your current company but states that it cannot guarantee complete privacy. Skip this section entirely if you are not looking.

---

## 12. After publishing: recommendations and activity

### 12.1 Recommendations

Where: "Add profile section" → Additional → "Request a recommendation". Ask two or three people who have seen the work directly:

| Who                                                  | What to ask them to speak to                             |
| :--------------------------------------------------- | :------------------------------------------------------- |
| Your manager or team lead at Predusk                 | Ownership, and the move from operations into engineering |
| An engineer you worked with on Labelfort or Digilekh | Real-time messaging or the async migration               |
| A contact on the Caliber client side                 | Reliability and communication as the offshore engineer   |

Request message:

```text
Hi [Name], I'm updating my LinkedIn profile and would value a short recommendation from you, since you saw my work on [project] first-hand. Two or three sentences on [specific area] would be ideal. Happy to write one for you in return.
```

### 12.2 Posts

One short post every week or two, drawn from work already done. Do not include client data, client brand names, internal hostnames or credentials. Three topics that are already covered by the portfolio:

1. Why Labelfort moved real-time progress from SSE to a RabbitMQ topic exchange with Web-MQTT, and what role-based topic filtering solved.
2. How ArchiveLens detects an OCR model stuck in a repetition loop using a compression ratio.
3. How Workload Identity Federation removes static keys between AWS and Google Cloud.

---

## 13. Final verification checklist

Open the profile with "View as member" (intro card → "⋯" → or the public profile link in a private window) and check each item.

### Accuracy

- [ ] All four items in section 2 are resolved.
- [ ] Role titles match your Predusk records: Associate Software Developer (AI/ML), Data Analyst Trainee (AI & ML Engineering), Back Office Agent.
- [ ] Role dates match your Predusk records and agree with the portfolio and the résumé.
- [ ] No percentage or speed-up figures appear anywhere on the profile. None are supported by the portfolio or dossiers.
- [ ] The names "WorkplacesIm" and "DADP" no longer appear, except "formerly DADP" beside Labelfort.
- [ ] No text describes features that have been removed from Digilekh (MQTT live chat, Deep Research) as current.
- [ ] Caliber is the only client name on the profile; none of its brands are named.

### Consistency

- [ ] The headline, the banner text and the first line of About describe the same role and speciality.
- [ ] Counts agree everywhere they appear: 5 event domains (Labelfort), 9 stages and 3 services (Digilekh), 5 portals (OceanMind), 12 passes and 8 stages (ArchiveLens).
- [ ] Project names are spelled the same in About, Experience, Projects and Featured: Caliber, Labelfort, Digilekh, OceanMind, ArchiveLens, Flare, PV InstaTemplate, Sankirtan.
- [ ] Each technology named in About or Experience also exists in Skills.
- [ ] The five top skills under About are the five listed in section 5.
- [ ] The portfolio (`src/data/site.ts`), `README.md` and the résumé PDF show the new LinkedIn URL.

### Completeness

- [ ] Custom URL is set and opens the profile.
- [ ] Headline, About, three experience descriptions and the projects are in place.
- [ ] Skills: six removed, "MQTT" re-added, 32 added, top ten ordered, roles mapped.
- [ ] Featured shows the links in the stated order and every link opens.
- [ ] Contact info shows the portfolio, GitHub and email.
- [ ] Education description added; C and C++ tags removed.

### Presentation

- [ ] No Markdown characters (`#`, `**`, backticks) were pasted into any field.
- [ ] Bullets (`•`, `▸`) and blank lines display correctly on desktop and in the mobile app.
- [ ] No field was cut off by a character limit; the last line of each description is complete.
- [ ] The first three lines of About read as a complete statement before "…see more".
- [ ] The banner text is not hidden behind the profile photo on desktop or mobile.
- [ ] Spelling checked once more, including product and tool names.

### Wrap-up

- [ ] "Share profile updates with your network" is set the way you want it.
- [ ] Open-to-work visibility is "Recruiters only", or the feature is off.
- [ ] Recommendation requests sent.
- [ ] First post drafted.
