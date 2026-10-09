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

| Layer                 | Tool / Dependency        | Version   | Purpose                                                        |
| :-------------------- | :----------------------- | :-------- | :------------------------------------------------------------- |
| **Framework**         | `astro`                  | `^7.3.5`  | Core static site generation framework and component compiler   |
| **Sitemap**           | `@astrojs/sitemap`       | `^3.7.4`  | Automated XML sitemap generation during build                  |
| **Type Checking**     | `typescript`             | `~6.0.3`  | Static type analysis with Astro strictest preset               |
| **Astro Diagnostics** | `@astrojs/check`         | `^0.9.10` | Static verification of `.astro` templates and content schemas  |
| **Code Quality**      | `eslint`                 | `^9.39.5` | Flat configuration linting engine                              |
| **Astro Linting**     | `eslint-plugin-astro`    | `^1.7.0`  | Template linting and accessibility rules                       |
| **Accessibility**     | `eslint-plugin-jsx-a11y` | `^6.10.2` | WCAG rule validation for JSX/Astro ASTs                        |
| **Code Formatting**   | `prettier`               | `^3.9.9`  | Automated code style enforcement                               |
| **Formatting Plugin** | `prettier-plugin-astro`  | `^1.1.0`  | Prettier integration for `.astro` markup                       |
| **Typography**        | `@fontsource-variable/*` | `^5.3.0`  | Self-hosted variable fonts (`Space Grotesk`, `JetBrains Mono`) |
| **Automation**        | `playwright`             | `^1.63.0` | Headless browser for deterministic Open Graph image creation   |
| **CI/CD Platform**    | GitHub Actions           | --        | Validation pipeline and automated deployments                  |
| **Hosting Platform**  | Cloudflare Pages         | --        | Global distributed static edge hosting                         |

---

## Repository Layout

```
portfolio/
├── .github/
│   └── workflows/
│       └── ci-cd.yml           # Automated CI validation and Cloudflare Pages CD
├── .editorconfig               # Universal editor formatting consistency rules
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
├── scripts/
│   ├── generate-og.mjs         # Playwright script rendering OG and touch icons
│   └── og-template.html        # HTML/CSS layout template used for screenshotting
├── src/
│   ├── components/             # Reusable Astro presentation components
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
│   │   └── main.ts             # Bundled progressive client behavior
│   ├── site.config.ts          # Base URL and deployment environment constants
│   └── styles/
│       └── global.css          # Design system, CSS variables, tokens, and utilities
└── tsconfig.json               # TypeScript compiler options extending astro/tsconfigs/strictest
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

| Command                | Action                                                                                    |
| :--------------------- | :---------------------------------------------------------------------------------------- |
| `npm run dev`          | Boots local Astro development server at `http://localhost:4321`                           |
| `npm run build`        | Compiles static production build into `dist/`                                             |
| `npm run preview`      | Runs local HTTP server to preview static build in `dist/`                                 |
| `npm run check`        | Executes `@astrojs/check` across `.astro` templates and content collections               |
| `npm run lint`         | Runs ESLint 9 across all codebase files                                                   |
| `npm run format`       | Auto-formats all supported files using Prettier                                           |
| `npm run format:check` | Verifies code conforms to Prettier rules without making edits                             |
| `npm run og`           | Executes Playwright script to re-render `public/og.png` and `public/apple-touch-icon.png` |
| `npm run validate`     | Runs formatting check, linting, typecheck, and production build sequentially              |

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

## Security and HTTP Response Headers

This application implements a defense-in-depth security model configured across build and edge layers.

### 1. Content Security Policy (CSP)

Astro computes cryptographic SHA-256 hashes for all authorized inline scripts (such as the early anti-FOUC theme script). Configured in `astro.config.ts`:

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

- **Pull Requests**:
  - Checks out code with `fetch-depth: 1`.
  - Sets up Node.js from `.nvmrc` with npm caching.
  - Runs `npm ci`.
  - Executes `format:check`, `lint`, `check`, and `build`.
  - Concurrency group cancels redundant in-progress runs when new commits are pushed to the PR.
- **Pushes to `main`**:
  - Executes the identical validation test suite.
  - Uploads compiled `dist/` as an action artifact.
  - Deploys `dist/` to Cloudflare Pages using `cloudflare/wrangler-action`.
  - Deployment concurrency allows in-progress releases to finish safely while collapsing intermediate queued runs.

### Required Repository Secrets

The deploy job requires the following secrets configured in GitHub repository settings:

- `CLOUDFLARE_API_TOKEN`: Cloudflare API Token with Pages deployment permissions.
- `CLOUDFLARE_ACCOUNT_ID`: Target Cloudflare account identifier.

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
   - Merges to `main` must pass all four stages of `npm run validate`.

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
