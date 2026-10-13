# Developer Portfolio

A production-grade, statically generated developer portfolio engineered with Astro, TypeScript, and Vanilla CSS. Built for Sourabh Sharma (Software Engineer specializing in Backend Systems, Applied AI, and Cloud Architecture), this project demonstrates an uncompromising focus on zero-overhead performance, enterprise Content Security Policy (CSP) enforcement, strict WCAG accessibility standards, and automated edge deployment to Cloudflare Pages.

---

## Table of Contents

- [Overview](#overview)
- [Key Architectural Highlights](#key-architectural-highlights)
- [Architecture and Data Flow](#architecture-and-data-flow)
- [Technology Stack](#technology-stack)
- [Repository Layout](#repository-layout)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [NPM Scripts Reference](#npm-scripts-reference)
- [Content Authoring and Data Management](#content-authoring-and-data-management)
  - [Personal Profile and Site Metadata](#personal-profile-and-site-metadata)
  - [Projects Collection](#projects-collection)
  - [Experience Collection](#experience-collection)
  - [Resume Management](#resume-management)
- [Munshi: the Chat Assistant](#munshi-the-chat-assistant)
  - [How a Question Is Answered](#how-a-question-is-answered)
  - [What Munshi Knows](#what-munshi-knows)
  - [Abuse and Cost Controls](#abuse-and-cost-controls)
  - [Running Munshi Locally](#running-munshi-locally)
  - [Choosing the Model](#choosing-the-model)
  - [Operating Munshi](#operating-munshi)
- [Security and HTTP Response Headers](#security-and-http-response-headers)
- [Automated Open Graph and Asset Generation](#automated-open-graph-and-asset-generation)
- [Continuous Integration and Deployment](#continuous-integration-and-deployment)
- [Quality Assurance and Accessibility Standards](#quality-assurance-and-accessibility-standards)
- [License and Contact](#license-and-contact)

---

## Overview

This repository houses the complete source code, configuration, and content for a modern portfolio web application. It eliminates heavy client-side JavaScript runtimes in favor of Astro static site generation (SSG), delivering fully pre-rendered HTML and CSS to the edge with progressive enhancement for interactive elements.

### Core Metrics and Properties

| Property                       | Value                                                    |
| :----------------------------- | :------------------------------------------------------- |
| Framework                      | Astro 7.3 (Static Output Mode)                           |
| Language                       | TypeScript 6.0 (Strict Preset)                           |
| Runtime Target                 | Node.js >= 22.12.0                                       |
| Hosting Environment            | Cloudflare Pages CDN                                     |
| Client-Side Framework Overhead | 0 KB (No React, Vue, or Svelte runtime)                  |
| Typography                     | Self-hosted via Fontsource (Zero external network calls) |
| Security Rating                | Strict CSP with SHA-256 Script Hashing                   |

---

## Key Architectural Highlights

- **Static Site Generation (SSG)**: Output mode is strictly `static`. Pages are pre-compiled into immutable HTML, CSS, and hashed JavaScript assets during build time, removing server compute dependencies and minimizing TTFB (Time to First Byte).
- **Type-Safe Content Collections**: Work projects and career history are authored in clean YAML files and validated against strict Zod schemas defined in `src/content.config.ts`. Schema errors fail the build immediately.
- **Zero-FOUC Theme Management**: Theme resolution (dark and light mode) executes before first layout paint via an inline script in `src/layouts/BaseLayout.astro`. It reconciles local storage overrides with OS preferences (`prefers-color-scheme`) without visual flash.
- **Progressive Enhancement**: All page content, links, and layout elements function identically with JavaScript disabled. Client-side TypeScript (`src/scripts/main.ts`) layers on non-essential capabilities: theme switching, mobile drawer navigation, intersection-observer scroll spying, and clipboard copying.
- **Enterprise Security Posture**: Enforces an automated SHA-256 script-hashing Content Security Policy (CSP) alongside strict Cloudflare HTTP response headers (HSTS, COOP, Permissions-Policy, frame denial).
- **Self-Hosted Typography**: Uses Fontsource variable font packages (`Space Grotesk`, `JetBrains Mono`, `Inter`) integrated through Astro font providers, completely bypassing third-party font CDNs to prevent layout shifts and eliminate tracking vectors.
- **Strict Web Accessibility (WCAG 2.1 AA)**: Linted against `jsx-a11y-strict`. Features include visible focus styling (`:focus-visible`), skip-to-content bypass landmarks, semantic headings, accessible ARIA live regions for clipboard feedback, and balanced text wrapping.

---

## Architecture and Data Flow

```
+-------------------------------------------------------------------------+
|                           CONTENT & METADATA LAYER                      |
|                                                                         |
|  YAML Collections (src/content/)      Site Data (src/data/site.ts)      |
|  - projects/*.yaml                    - Profile, Socials, Bio           |
|  - experience/*.yaml                  - Skills Matrix, Education        |
+------------------------------------+------------------------------------+
                                     |
                                     | Validated by Zod & TypeScript
                                     v
+-------------------------------------------------------------------------+
|                        ASTRO STATIC BUILD ENGINE                        |
|                                                                         |
|  Pages & Layouts                      Design System (global.css)        |
|  - src/pages/index.astro              - CSS Variables / Custom Tokens   |
|  - src/layouts/BaseLayout.astro       - Fluid clamp() Typography        |
|  - src/components/sections/*.astro    - Self-Hosted Fontsource Assets    |
|                                                                         |
|  Build-Time Integrations                                                |
|  - @astrojs/sitemap                   - Inline Script SHA-256 Hashes    |
+------------------------------------+------------------------------------+
                                     |
                                     | astro build (Emits static bundle)
                                     v
+-------------------------------------------------------------------------+
|                       PRODUCTION OUTPUT (dist/)                         |
|                                                                         |
|  - Pre-rendered HTML (index.html, 404.html)                             |
|  - Optimized & Hashed CSS/JS (_astro/*)                                 |
|  - Static Assets & Documents (resume/*, og.png, sitemap-index.xml)      |
+------------------------------------+------------------------------------+
                                     |
                                     | GitHub Actions (wrangler pages deploy)
                                     v
+-------------------------------------------------------------------------+
|                    CLOUDFLARE PAGES EDGE NETWORK                        |
|                                                                         |
|  Edge Routing & Security Rules (public/_headers)                        |
|  - Strict-Transport-Security: max-age=31536000                          |
|  - Content-Security-Policy & Cross-Origin-Opener-Policy                 |
|  - Immutable Caching for fingerprinted /_astro/* assets                 |
+-------------------------------------------------------------------------+
```

---

## Technology Stack

| Layer                 | Tool / Dependency        | Version    | Purpose                                                         |
| :-------------------- | :----------------------- | :--------- | :-------------------------------------------------------------- |
| **Framework**         | `astro`                  | `^7.3.5`   | Core static site generation framework and component compiler    |
| **Sitemap**           | `@astrojs/sitemap`       | `^3.7.4`   | Automated XML sitemap generation during build                   |
| **Type Checking**     | `typescript`             | `~6.0.3`   | Static type analysis with Astro strictest preset                |
| **Astro Diagnostics** | `@astrojs/check`         | `^0.9.10`  | Static verification of `.astro` templates and content schemas   |
| **Code Quality**      | `eslint`                 | `^9.39.5`  | Flat configuration linting engine                               |
| **Astro Linting**     | `eslint-plugin-astro`    | `^1.7.0`   | Template linting and accessibility rules                        |
| **Accessibility**     | `eslint-plugin-jsx-a11y` | `^6.10.2`  | WCAG rule validation for JSX/Astro ASTs                         |
| **Code Formatting**   | `prettier`               | `^3.9.9`   | Automated code style enforcement                                |
| **Formatting Plugin** | `prettier-plugin-astro`  | `^1.1.0`   | Prettier integration for `.astro` markup                        |
| **Typography**        | `@fontsource-variable/*` | `^5.3.0`   | Self-hosted variable fonts (`Space Grotesk`, `JetBrains Mono`)  |
| **Automation**        | `playwright`             | `^1.63.0`  | Headless browser for deterministic Open Graph image creation    |
| **Unit Tests**        | `vitest`                 | `^5.0.4`   | Tests for the page scripts and the Munshi Worker                |
| **Chat API**          | Cloudflare Workers       | --         | Munshi Worker: validates, rate limits and proxies chat requests |
| **Worker Tooling**    | `wrangler`               | `^4.149.0` | Builds, runs locally and deploys the Worker                     |
| **Language Model**    | DeepInfra                | --         | Hosts the open-weights model that writes Munshi's answers       |
| **Bot Protection**    | Cloudflare Turnstile     | --         | One check per visitor before the first chat message             |
| **Infrastructure**    | Terraform                | `>= 1.11`  | Provisions the Worker and the Turnstile widget                  |
| **CI/CD Platform**    | GitHub Actions           | --         | Validation pipeline and automated deployments                   |
| **Hosting Platform**  | Cloudflare Pages         | --         | Global distributed static edge hosting                          |

---

## Repository Layout

```
portfolio/
├── .github/
│   └── workflows/
│       ├── ci-cd.yml           # CI validation, then Terraform, Worker and Pages deployment
│       ├── munshi-eval.yml     # Manual: compare candidate models on the evaluation set
│       └── munshi-rollback.yml # Manual: restore an earlier Worker version
├── .editorconfig               # Universal editor formatting consistency rules
├── .env.example                # Public build settings for the chat (no secrets)
├── .nvmrc                      # Node.js active runtime version declaration (22)
├── .prettierignore             # Paths excluded from Prettier format enforcement
├── .prettierrc.json5           # Prettier configuration file
├── astro.config.ts             # Astro core config: static output, CSP, font loaders
├── data/
│   └── projects/               # Detailed project dossiers and architectural notes
│       ├── personal/           # Personal engineering project briefs
│       └── professional/       # Client and professional system architectures
├── eslint.config.mjs           # ESLint flat config: TypeScript, Astro, strict a11y
├── package.json                # Project dependencies, scripts, and engine constraints
├── public/                     # Static assets served at domain root
│   ├── _headers                # Cloudflare Pages edge headers (CSP, HSTS, cache rules)
│   ├── apple-touch-icon.png    # Pre-rendered Apple mobile touch icon
│   ├── favicon.svg             # SVG favicon mark
│   ├── og.png                  # Pre-rendered 1200x630 Open Graph preview card
│   └── resume/                 # Downloadable PDF curriculum vitae
├── shared/
│   └── munshi.ts               # API contract shared by the page and the Worker
├── scripts/
│   ├── generate-og.mjs         # Playwright script rendering OG and touch icons
│   └── og-template.html        # HTML/CSS layout template used for screenshotting
├── src/
│   ├── components/             # Reusable Astro presentation components
│   │   ├── chat/
│   │   │   └── Munshi.astro    # Chat launcher and panel markup and styles
│   │   ├── sections/           # Modular landing page sections
│   │   │   ├── About.astro     # Bio narrative, focus areas, and formal education
│   │   │   ├── Contact.astro   # Email, phone, copy actions, and contact links
│   │   │   ├── Experience.astro# Chronological work history and engineering points
│   │   │   ├── Hero.astro      # Primary headline, roles, intro, and call-to-actions
│   │   │   ├── Skills.astro    # Categorized skill matrices
│   │   │   └── Work.astro      # Featured and secondary project card grids
│   │   ├── Icon.astro          # Optimized inline SVG sprite renderer
│   │   ├── ProjectCard.astro   # Individual project card with highlights and tags
│   │   ├── SectionHeading.astro# Numbered section header component
│   │   ├── SeoHead.astro       # Canonical tags, social meta, and JSON-LD Person schema
│   │   ├── SiteFooter.astro    # Site footer with dynamic build year and links
│   │   ├── SiteHeader.astro    # Sticky navigation, logo mark, and mobile menu toggle
│   │   └── ThemeToggle.astro   # Accessible button triggering client theme toggle
│   ├── content/                # Schema-validated YAML content collections
│   │   ├── experience/         # Chronological employment and role records
│   │   └── projects/           # Showcase projects with tags, metrics, and URLs
│   ├── content.config.ts       # Astro Content Collections schemas (Zod)
│   ├── data/
│   │   └── site.ts             # Profile constants, navigation list, SEO defaults, skills
│   ├── layouts/
│   │   └── BaseLayout.astro    # Top-level HTML shell, anti-FOUC script, font preloads
│   ├── lib/
│   │   └── format.ts           # Date and month-range formatting utilities
│   ├── pages/
│   │   ├── 404.astro           # Custom 404 Not Found error page
│   │   ├── index.astro         # Single-page portfolio root entry point
│   │   └── robots.txt.ts       # Endpoint dynamically generating compliant robots.txt
│   ├── scripts/
│   │   ├── main.ts             # Bundled progressive client behavior
│   │   └── munshi/             # Chat behavior, loaded on first use (stream parser, store, UI)
│   ├── site.config.ts          # Base URL and deployment environment constants
│   └── styles/
│       └── global.css          # Design system, CSS variables, tokens, and utilities
├── terraform/                  # Cloudflare Worker and Turnstile widget; state in R2
├── tsconfig.json               # TypeScript compiler options extending astro/tsconfigs/strictest
├── vitest.config.ts            # Unit test configuration for the page scripts
└── worker/                     # Munshi Worker (npm workspace)
    ├── eval/                   # Model evaluation cases, scorer and runner
    ├── knowledge/facts.md      # Hand-written facts added to the knowledge base
    ├── scripts/                # Knowledge builder, local stub upstream, runtime and smoke checks
    ├── src/                    # Worker source
    ├── test/                   # Worker unit tests
    └── wrangler.jsonc          # Worker configuration, bindings and non-secret variables
```

---

## Prerequisites

Before setting up the repository locally, ensure the following software is installed on your workstation:

- **Node.js**: Version `22.12.0` or higher (verified in `.nvmrc`).
- **NPM**: Version `10.0.0` or higher (bundled with Node.js 22).
- **Git**: For source version control.
- **Chromium / Playwright Dependencies** _(optional)_: Only required if generating Open Graph card images via `npm run og`.

---

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/Sourabh0141/portfolio.git
cd portfolio
```

### 2. Verify Node.js Version

If using Node Version Manager (`nvm`):

```bash
nvm use
```

Verify your active version:

```bash
node -v
```

### 3. Install Dependencies

Install dependencies strictly as specified in `package-lock.json`:

```bash
npm ci
```

### 4. Run the Development Server

Start the Astro local development server:

```bash
npm run dev
```

The application will be accessible at:

```
http://localhost:4321
```

### 5. Validate the Build Locally

Execute the comprehensive validation pipeline to confirm that formatting, linting, types, and build outputs are error-free:

```bash
npm run validate
```

---

## NPM Scripts Reference

The `package.json` file contains scripts for the development and release lifecycle:

| Command                    | Action                                                                                    |
| :------------------------- | :---------------------------------------------------------------------------------------- |
| `npm run dev`              | Boots local Astro development server at `http://localhost:4321`                           |
| `npm run build`            | Compiles static production build into `dist/`                                             |
| `npm run preview`          | Runs local HTTP server to preview static build in `dist/`                                 |
| `npm run check`            | Executes `@astrojs/check` across `.astro` templates and content collections               |
| `npm run lint`             | Runs ESLint 9 across all codebase files                                                   |
| `npm run format`           | Auto-formats all supported files using Prettier                                           |
| `npm run format:check`     | Verifies code conforms to Prettier rules without making edits                             |
| `npm run og`               | Executes Playwright script to re-render `public/og.png` and `public/apple-touch-icon.png` |
| `npm test`                 | Runs the unit tests for the page scripts and the Munshi Worker                            |
| `npm run typecheck:worker` | Builds the knowledge base, generates runtime types and typechecks the Worker              |
| `npm run validate`         | Runs formatting check, linting, both typechecks, unit tests, and the production build     |

Worker scripts are run through the workspace, for example `npm run dev -w worker`:

| Command        | Action                                                                                  |
| :------------- | :-------------------------------------------------------------------------------------- |
| `dev`          | Runs the Worker locally on `http://localhost:8787` against the stub upstream            |
| `dev:upstream` | Starts the local stand-in for DeepInfra and Turnstile verification                      |
| `knowledge`    | Compiles the knowledge base from the portfolio content                                  |
| `test`         | Runs the Worker unit tests                                                              |
| `test:runtime` | Runs the Worker in the real Workers runtime locally and checks it end to end            |
| `eval`         | Compares models on the evaluation set. Calls DeepInfra; run it from the GitHub workflow |

---

## Content Authoring and Data Management

The application is structured to decouple content from markup. Content edits can be made without altering presentation logic.

### Personal Profile and Site Metadata

Global settings, profile data, social profiles, skills, and SEO descriptions are located in `src/data/site.ts`:

- `profile`: Full name, role title, specialization, location, email, and phone number.
- `socials`: Array of outbound profile links (GitHub, LinkedIn).
- `seo`: Default meta title, description, and social preview assets.
- `nav`: Primary anchor navigation items (`#work`, `#experience`, etc.).
- `skills`: Categorized skill matrices (Languages, AI & ML, Backend & APIs, Messaging, Data & Storage, Cloud, Automation).
- `education`: Degree, institution, location, and dates.

Deployment URL constants are declared in `src/site.config.ts`:

```typescript
export const SITE_URL = 'https://sourabh.pages.dev';
```

### Projects Collection

Project items are stored in `src/content/projects/*.yaml`. Each project file is validated by Zod against the following contract:

```yaml
title: Project Name
order: 1 # Integer determining display sort order
kind: Architecture / Domain Category
status: Production · Status Label
featured: true # Set true for full-width card; false for 2-column grid
summary: >-
  Concise summary explaining what the system solves and its scale.
highlights:
  - Technical engineering accomplishment with architectural detail.
  - Performance optimization or distributed messaging impact.
stack:
  - Python
  - FastAPI
  - RabbitMQ
links:
  - label: Live Platform # Optional link list
    url: https://example.com
```

### Experience Collection

Work history is stored in `src/content/experience/*.yaml`. Entries are sorted in descending order by `start` date:

```yaml
role: Associate Software Developer
company: Predusk Technology Pvt Ltd
location: Jaipur, India
start: '2025-11' # Format: YYYY-MM
end: ~ # Omit or set to null for current role
summary: >-
  High-level overview of core engineering responsibilities and scope.
groups:
  - heading: Project or Domain Group
    points:
      - Key technical contribution or metric-driven achievement.
      - Infrastructure, pipeline, or microservice architecture highlight.
```

### Resume Management

The resume is served as a static PDF file located at:

```
public/resume/Sourabh-Sharma-Resume.pdf
```

To update the resume, replace the file at this path while preserving the filename, or adjust `profile.resume.href` in `src/data/site.ts`.

---

## Munshi: the Chat Assistant

Munshi is the assistant that visitors open from the button at the bottom-right of the page or from the hero. It answers questions about Sourabh's work from a fixed record compiled from this repository. A munshi is a trusted record keeper.

### How a Question Is Answered

```
Browser                          Munshi Worker (workers.dev)                DeepInfra
   |  1. Turnstile token  ------>  POST /v1/session                            |
   |  <------ signed session token (30 minutes)                                |
   |  2. token + history  ------>  POST /v1/chat                               |
   |                               origin, rate limits, token, validation      |
   |                               system prompt + knowledge + history ------> |
   |  <----------- answer streamed straight through, untouched  <------------- |
```

- **The key stays on the server.** The DeepInfra API key exists only as a GitHub secret and a Worker secret. The page never sees it.
- **The Worker does not read the stream.** It hands the model's response body to the browser as it is, and the browser parses the server-sent events. This keeps each request far inside the free plan's 10 ms of CPU time.
- **The Worker is stateless.** The conversation is kept in the browser's `sessionStorage` and sent back, trimmed, with each question. Nothing is stored on the server.
- **The chat loads on demand.** Its script is fetched on the first click and Turnstile on the first message, so a page view that never uses Munshi contacts no third party.

### What Munshi Knows

Munshi does not use retrieval. Everything it knows fits in one prompt, so `worker/scripts/build-knowledge.ts` compiles a single text record on every build from:

- `src/data/site.ts` (profile, links, about, skills, education)
- `src/content/projects/*.yaml` and `src/content/experience/*.yaml`
- `worker/knowledge/facts.md` (hand-written facts, and the topics Munshi must refer to email)

Editing the portfolio content therefore updates Munshi on the next deploy. The build fails if the record exceeds 28,000 characters, contains an unfinished note, or contains the phone number, which Munshi does not give out.

To teach Munshi something new, add it to `worker/knowledge/facts.md`. Only write what is true and what you are content to have repeated to any visitor.

### Abuse and Cost Controls

| Control           | Where                   | Effect                                                                                           |
| :---------------- | :---------------------- | :----------------------------------------------------------------------------------------------- |
| Origin allowlist  | Worker                  | Requests from any site other than the portfolio are refused before any work is done              |
| Turnstile session | Worker and page         | One bot check buys a signed token valid for 30 minutes                                           |
| Rate limits       | `worker/wrangler.jsonc` | 5 sessions and 8 messages a minute per IP, 40 messages a minute overall, per Cloudflare location |
| Input limits      | `shared/munshi.ts`      | 600 characters a message, 12 messages a request, 16 KB a body                                    |
| Output limit      | Worker                  | 350 tokens an answer                                                                             |
| Spending limit    | DeepInfra account       | The hard ceiling on cost. Set it in the DeepInfra dashboard                                      |
| Kill switch       | `MUNSHI_ENABLED`        | Set to `"false"` in `worker/wrangler.jsonc` and deploy to switch the chat off                    |

Each request writes one log line to Workers Logs (kept for 3 days on the free plan) with its outcome, timings and the visitor's question. Email addresses and long numbers are removed from the question first. IP addresses and answers are not logged.

### Running Munshi Locally

No secret is needed on a development machine. A local stand-in replaces DeepInfra and Turnstile verification:

```bash
cp .env.example .env              # public build settings for the page
npm run dev:upstream -w worker    # terminal 1: stub for DeepInfra and Turnstile
npm run dev -w worker             # terminal 2: the Worker, http://localhost:8787
npm run dev                       # terminal 3: the site, http://localhost:4321
```

The stub returns a canned answer, so this exercises the whole path except the real model. `npm run test:runtime -w worker` runs the Worker half of that setup as an automated check.

### Choosing the Model

The model is the `DEEPINFRA_MODEL` variable in `worker/wrangler.jsonc`. Before changing it, or after changing the prompt or `facts.md`, run the **Munshi evaluation** workflow from the Actions tab. It asks each candidate the questions in `worker/eval/cases.json` and scores the answers without a judge model: required facts, banned content and length.

A model passes when it answers at least 90% of the factual questions correctly and passes every case in the other four groups: questions it must decline, prompt injection, off-topic requests and confidentiality. Use the cheapest model that passes.

### Operating Munshi

**One-time setup**

1. Create an R2 bucket for Terraform state and an R2 API token limited to that bucket.
2. Give the Cloudflare API token used by CI these permissions: Workers Scripts (edit), Turnstile (edit), Cloudflare Pages (edit).
3. Create a DeepInfra API key for Munshi and set an account spending limit.
4. Add the repository secrets and variable listed under [Continuous Integration and Deployment](#continuous-integration-and-deployment).
5. Run the **Munshi evaluation** workflow and set `DEEPINFRA_MODEL` to the model it recommends.

**Rolling back**

| Problem                | Action                                                                                             |
| :--------------------- | :------------------------------------------------------------------------------------------------- |
| A bad Worker version   | Run the **Munshi rollback** workflow, then revert the commit so the next push does not redeploy it |
| Wrong answers or abuse | Set `MUNSHI_ENABLED` to `"false"` and deploy, or lower the DeepInfra spending limit                |
| A bad site change      | Revert the commit, or roll back the deployment in the Cloudflare Pages dashboard                   |
| A leaked key           | Rotate it at the provider, update the GitHub secret and rerun the workflow                         |

Terraform creates the Worker and its settings; Wrangler uploads the code, bindings and secrets. The observability and workers.dev settings appear in both `terraform/main.tf` and `worker/wrangler.jsonc` and must be kept equal.

---

## Security and HTTP Response Headers

This application implements a defense-in-depth security model configured across build and edge layers.

### 1. Content Security Policy (CSP)

Astro computes cryptographic SHA-256 hashes for all authorized inline scripts (such as the early anti-FOUC theme script). The base policy, configured in `astro.config.ts`:

```typescript
security: {
  csp: {
    algorithm: 'SHA-256',
    directives: [
      "default-src 'self'",
      "img-src 'self' data:",
      "font-src 'self'",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'none'",
    ],
  },
}
```

When the build has the chat settings, exactly three sources are added and nothing else is loosened:

- `connect-src` gains the Munshi Worker's origin.
- `script-src` and `frame-src` gain `https://challenges.cloudflare.com` for Turnstile.

Without the settings the page is built with no chat and the base policy unchanged. Answers from the model are inserted as text, never as HTML, and an address in an answer becomes a link only if it is one of the portfolio's own.

### 2. Edge Response Headers

Cloudflare Pages applies security and caching headers via `public/_headers`:

```http
/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()
  Cross-Origin-Opener-Policy: same-origin
  Strict-Transport-Security: max-age=31536000
  Content-Security-Policy: frame-ancestors 'none'

# Fingerprinted build assets are cached immutably for 1 year
/_astro/*
  Cache-Control: public, max-age=31536000, immutable

# Dynamic content files revalidate immediately
/resume/*
  Cache-Control: public, max-age=0, must-revalidate
```

---

## Automated Open Graph and Asset Generation

To eliminate runtime Open Graph rendering dependencies while maintaining visual fidelity, social preview cards and touch icons are generated using Playwright:

1. **Template**: `scripts/og-template.html` defines the layout, typography, and styling of the 1200x630 card.
2. **Generator**: `scripts/generate-og.mjs` launches a headless Chromium instance, waits for document fonts to load via `document.fonts.ready`, and captures screenshots directly into:
   - `public/og.png` (1200 x 630 preview card)
   - `public/apple-touch-icon.png` (180 x 180 mobile icon)

To update social image assets:

```bash
npm run og
```

The resulting PNG files are committed to version control, ensuring CI does not require browser dependencies.

---

## Continuous Integration and Deployment

The deployment pipeline is orchestrated using GitHub Actions in `.github/workflows/ci-cd.yml`.

### Workflow Architecture

| Job               | Runs on                  | What it does                                                                                                              |
| :---------------- | :----------------------- | :------------------------------------------------------------------------------------------------------------------------ |
| **Verify**        | Pull requests and `main` | Formatting, lint, both typechecks, unit tests, the Worker runtime check, a site build, and `terraform fmt` and `validate` |
| **Deploy Munshi** | `main` only              | `terraform plan` and `apply`, then `wrangler deploy` with the secrets, then a smoke test of the live Worker               |
| **Deploy site**   | `main` only              | Builds the site with the Worker URL and Turnstile site key from Terraform, then deploys `dist/` to Cloudflare Pages       |

- The Worker is deployed and smoke-tested before the site is built, so the page never points at a Worker that is down.
- A new commit on a pull request cancels the older check. A deploy in progress on `main` is left to finish.
- Verify needs no secret, so it runs in full on pull requests.

Two manual workflows sit beside it: **Munshi evaluation** and **Munshi rollback**.

### Required Repository Secrets and Variables

All of these are set in the GitHub repository settings. None is stored in the repository, on a developer machine, or entered by hand in the Cloudflare dashboard.

| Name                    | Kind     | Purpose                                                               |
| :---------------------- | :------- | :-------------------------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`  | Secret   | Cloudflare API token for Terraform, Wrangler and the Pages deploy     |
| `CLOUDFLARE_ACCOUNT_ID` | Secret   | Target Cloudflare account identifier                                  |
| `R2_ACCESS_KEY_ID`      | Secret   | R2 token for the Terraform state bucket                               |
| `R2_SECRET_ACCESS_KEY`  | Secret   | R2 token secret for the Terraform state bucket                        |
| `DEEPINFRA_API_KEY`     | Secret   | Key the Worker uses to call the model                                 |
| `MUNSHI_SESSION_KEY`    | Secret   | Random string of 32 or more characters that signs chat session tokens |
| `TF_STATE_BUCKET`       | Variable | Name of the R2 bucket that holds Terraform state                      |

CI uploads the DeepInfra key and the session key to the Worker together with its code, so they never enter Terraform state. The Turnstile secret is generated by Cloudflare when Terraform creates the widget; CI reads it from Terraform and passes it to the Worker, so it is recorded in the state file in the private R2 bucket and nowhere else.

---

## Quality Assurance and Accessibility Standards

The codebase adheres to the following quality enforcement gates:

1. **Accessibility Compliance**:
   - `eslint-plugin-jsx-a11y` rules enforced at `strict` level.
   - Interactive elements provide valid labels and `aria-*` state attributes.
   - Focus rings use high-contrast outlines via `:focus-visible`.
   - Skip links allow keyboard users to jump directly to primary content.
   - Reduced-motion queries (`prefers-reduced-motion`) disable non-essential animations.
2. **Type Soundness**:
   - Extends `astro/tsconfigs/strictest`.
   - Explicit type imports enforced by `@typescript-eslint/consistent-type-imports`.
   - Zero tolerance for `any` types or implicit coercion.
3. **Automated Verification**:
   - Merges to `main` must pass every stage of `npm run validate`.
   - Unit tests cover the Worker's validation, session tokens, CORS, logging and failure paths, and the page's stream parser, history store and link handling.
   - `npm run test:runtime -w worker` runs the Worker in the real Workers runtime against a local stand-in, with no account or network.

---

## License and Contact

### Author

**Sourabh Sharma**  
Software Engineer — Backend Systems, Applied AI & Cloud Architecture  
Location: Jaipur, India  
Email: [sourabh.sharma0141@gmail.com](mailto:sourabh.sharma0141@gmail.com)  
LinkedIn: [linkedin.com/in/sourabh-sharma-3221932b5](https://www.linkedin.com/in/sourabh-sharma-3221932b5/)  
GitHub: [github.com/Sourabh0141](https://github.com/Sourabh0141)

### License

This project is private and proprietary. All rights reserved. Source code is made available for portfolio evaluation and architectural review.
