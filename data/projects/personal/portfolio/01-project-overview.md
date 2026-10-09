# Portfolio — Project Overview

## 1. What it is, in one minute

The portfolio is a high-performance, accessible, static personal engineering site for Sourabh Sharma, showcasing background, professional experience, selected systems, technical skillsets, and contact channels. Built with Astro, TypeScript, and vanilla CSS, it renders pure HTML/CSS at build time, eliminating client-side framework runtime overhead while layering progressive enhancements for theme switching, mobile navigation, scroll-spying, and clipboard interactions.

Two-sentence version: "The portfolio is a zero-runtime static site built with Astro 7, TypeScript, and vanilla CSS that pre-renders portfolio content from strictly validated YAML collections and delivers sub-millisecond edge responses via Cloudflare Pages. It couples an enterprise-grade Content Security Policy (SHA-256 script hashing) and WCAG AAA accessibility with client-side progressive enhancement that functions completely even if JavaScript is disabled."

## 2. Problem and purpose

| Problem | How the system addresses it |
| :--- | :--- |
| Modern portfolio websites are often bloated with heavy SPA/React runtimes (>500 kB JS bundles) for essentially static content | Static Site Generation (SSG) with Astro compiles everything to static HTML/CSS; client-side JS is reduced to a single ~5 kB vanilla script for optional enhancements |
| Flash of Unstyled Theme (FOUC) when toggling or persisting dark/light modes | Synchronous inline micro-script in `<head>` resolves `localStorage` or `prefers-color-scheme` before the first paint, applying `data-theme` to `<html>` |
| Unstructured, fragile portfolio content embedded directly in presentation markup | Content-as-data architecture: YAML files in `src/content/` validated at build-time against strict Zod schemas via Astro Content Collections |
| External font dependencies (e.g. Google Fonts) create third-party network hops, privacy leaks, and Layout Shifts (CLS) | Self-hosted variable fonts (`Space Grotesk`, `Inter`, `JetBrains Mono`) served via Fontsource with critical font preloading in `<head>` |
| Inaccessible web patterns (missing landmarks, unannounced clipboard states, broken focus traps) | Strict accessibility architecture conforming to `jsx-a11y-strict`, including semantic landmarks, skip links (`#main` with `tabindex="-1"`), and ARIA live regions |
| Security vulnerabilities (XSS, clickjacking, inline code injection) on static hosts | Strict Content Security Policy (CSP) with cryptographic SHA-256 script hashing, `object-src 'none'`, and hardened Cloudflare edge headers (`DENY`, HSTS, restrictive `Permissions-Policy`) |
| Dynamic Open Graph card generation adding browser dependencies to CI builds | Offline headless Playwright script (`scripts/generate-og.mjs`) renders high-resolution OG images from HTML templates and commits them, keeping CI builds fast and browserless |

**Who uses it:**

| Actor | What they do |
| :--- | :--- |
| Public visitor / Recruiter / Hiring manager | Browses professional experience, reviews engineering case studies, copies contact info, switches themes, and downloads resume |
| Engineer / Author (Sourabh Sharma) | Updates project YAML collections, updates resume PDF, or adjusts profile configuration without touching UI component templates |
| Search engine crawlers / Social bots | Scrapes semantic HTML, follows XML sitemap index, parses Open Graph / Twitter cards, and indexes Schema.org `Person` JSON-LD |
| CI/CD Pipeline (GitHub Actions) | Verifies formatting (Prettier), lints (ESLint), validates types (`astro check`), builds static assets, and pushes production release to Cloudflare Pages |

## 3. Features

- **Responsive single-page layout**: Clean presentation dividing sections into Hero, Work, Experience, Skills, About, and Contact.
- **Dynamic content collections**: Projects and experience entries defined in YAML with schema validation (order, status, highlights, stack badges, links, date ranges).
- **Dual-mode theming**: High-contrast dark theme by default, with an automatic OS preference detector (`prefers-color-scheme`) and an interactive toggle saved to `localStorage`.
- **Anti-FOUC inline execution**: Synchronous inline theme script in `<head>` executed before first paint to prevent color flash.
- **Progressive enhancement navigation**: Mobile slide-out hamburger menu with ARIA state management (`aria-expanded`), Escape-key dismissal, click-outside dismissal, and automatic reset on viewport resizing.
- **IntersectionObserver scroll-spy**: Real-time tracking of visible sections that highlights active header links using a centered root margin (`-35% 0px -60% 0px`).
- **Accessible copy-to-clipboard**: One-click email copying using the Async Clipboard API, paired with a polite ARIA live region (`role="status"`) for screen readers.
- **Viewport scroll reveals**: Lightweight IntersectionObserver applying smooth entry transitions (`.reveal.is-visible`) with graceful immediate reveal if JavaScript is disabled.
- **Zero-runtime icon system**: Internal SVG dictionary component (`Icon.astro`) providing 12 decorative vector icons without external icon fonts or sprite requests.
- **Rich structured metadata**: Pre-configured SEO tags, canonical URL generation, Open Graph tags, Twitter summary card, and structured Schema.org `Person` JSON-LD entity graph.
- **Self-hosted variable typography**: Automated bundling of Space Grotesk, Inter, and JetBrains Mono via Fontsource, eliminating third-party font tracking and layout shifts.
- **Automated XML sitemap & robots.txt**: Build-time XML sitemap generation via `@astrojs/sitemap` and dynamic `/robots.txt` endpoint resolving host origin.
- **Offline Open Graph card generation**: Headless Playwright script snapshotting an HTML card template to generate committed high-res Open Graph and Apple touch icons.
- **Edge security headers**: Cloudflare `_headers` configuring HSTS, X-Frame-Options DENY, nosniff, referrer policies, and long-term immutable asset caching.
- **Custom 404 handler**: Styled, accessible 404 error page with `noindex` SEO directives.

## 4. Architecture

### 4.1 Components

```text
 Content Sources                       Astro Build Engine                       Edge Output
+--------------------------+         +-------------------------------+       +-------------------------+
| src/content/projects/    |         | Content Collections API       |       | Cloudflare Pages        |
|  - *.yaml                |-------->| (Zod schema validation)       |       |  - index.html           |
+--------------------------+         +---------------+---------------+       |  - 404.html             |
                                                     |                       |  - robots.txt           |
+--------------------------+                         v                       |  - sitemap-index.xml    |
| src/content/experience/  |         +-------------------------------+       |  - _headers             |
|  - *.yaml                |-------->| Components & Layouts          |------>|  - assets/ (_astro/*)   |
+--------------------------+         |  - BaseLayout.astro           |       |                         |
                                     |  - SeoHead.astro              |       +-------------------------+
+--------------------------+         |  - SiteHeader / SiteFooter    |                    ^
| src/data/site.ts         |-------->|  - Section Components         |                    |
|  - Profile & Skills      |         +---------------+---------------+                    |
+--------------------------+                         |                       +------------+------------+
                                                     v                       | Client Script (main.ts) |
+--------------------------+         +-------------------------------+       | - Theme toggle & sync   |
| src/styles/global.css    |-------->| CSS Design System             |       | - Mobile drawer & trap  |
|  - Tokens & Reset        |         | (Custom Properties, Fluid UI) |       | - Intersection scrollspy|
+--------------------------+         +-------------------------------+       | - Accessible copy/live  |
                                                                             +-------------------------+
```

| Component | Responsibility |
| :--- | :--- |
| `BaseLayout.astro` | Root HTML shell, meta headers, inline anti-FOUC theme script, font preloading (display and body preloaded; mono deferred), skip link, header, main landmark, footer, and script injection |
| `SeoHead.astro` | Resolves canonical links, title/description fallbacks, Open Graph tags, Twitter card tags, and Schema.org `Person` JSON-LD |
| `SiteHeader.astro` | Sticky header bar, initials monogram, primary navigation links with scroll-spy markers, theme toggle, resume CTA, and mobile hamburger button |
| `SiteFooter.astro` | Bottom navigation, dynamic copyright year evaluation at build time, social links, back-to-top anchor, and hosting credits |
| `SectionHeading.astro` | Standardized indexed section headers (e.g. `01 / Selected work`) with accessibility IDs |
| `ProjectCard.astro` | Full-width or grid card rendering project kind, title, status indicator dot, summary, bullet highlights, stack badges, and outbound links |
| `ThemeToggle.astro` | Dual sun/moon SVG icon button styled with CSS transitions; hidden when JavaScript is disabled |
| `Icon.astro` | Vector icon dictionary rendering accessible, stroked SVG shapes (GitHub, LinkedIn, Mail, Phone, Sun, Moon, Copy, Check, Menu, Close, etc.) |
| `Hero.astro` | Opening viewport banner: status pill, display headline, career lead, action buttons (Contact CTA, Resume download), and metadata list |
| `Work.astro` | Queries `projects` collection, partitions items into featured (full-width) vs non-featured (two-column grid), and maps to `ProjectCard` |
| `Experience.astro` | Queries `experience` collection, sorts chronologically descending, formats dates via `formatRange`, and displays grouped achievements |
| `Skills.astro` | Renders skill groups (Languages, AI/ML, Backend, Messaging, Data, Frontend, DevOps) from `site.ts` in a responsive 3-column badge grid |
| `About.astro` | Multi-paragraph engineering philosophy, numbered focus areas, and formal educational background credentials |
| `Contact.astro` | Direct contact channels (Email, Phone, LinkedIn, GitHub, Resume), asynchronous copy action, and hidden ARIA live status region |
| `404.astro` | Error 404 page providing graceful recovery link back to the homepage; configured with `noindex, follow` |
| `robots.txt.ts` | Dynamic endpoint serving valid plain-text crawler instructions with absolute sitemap URL derived from `site.config.ts` |

### 4.2 Content Pipeline and Schema Contracts

Astro's content loader validates every YAML file at build and development time against Zod schemas in `src/content.config.ts`:
- **`projects`**: Validates project entries. Enforces required strings (`title`, `kind`, `status`, `summary`), integer display order (`order`), non-empty string arrays (`highlights`, `stack`), optional boolean flag (`featured`, defaulting to `false`), and structured link objects (`label`, `url` requiring absolute HTTP/HTTPS format).
- **`experience`**: Validates career milestones. Enforces `role`, `company`, `location`, strict ISO date strings (`start` matching `/^\d{4}-\d{2}$/`, optional `end` matching `/^\d{4}-\d{2}$/`), a role overview `summary`, and a non-empty array of structured `groups` (`heading`, array of `points`).
- **`site.ts`**: Centralized typed configuration object (`as const`) storing singleton profile data (`name`, `role`, `headline`, `lead`, `email`, `phone`, `employer`, `resume`), navigation entries, SEO defaults, focus areas, categorized skills, and education details.

### 4.3 Styling and Design System

- **CSS Custom Properties**: Defined in `src/styles/global.css`. Employs warm, low-contrast dark palette (`--bg: #0c0c0c`, `--bg-raised: #141414`, `--accent: #f59e0b`) as the baseline, with a daylight theme (`--bg: #faf7f2`, `--bg-raised: #ffffff`) activated by `:root[data-theme='light']` or `@media (prefers-color-scheme: light)`.
- **Zero Framework Footprint**: Free of external utility frameworks (Tailwind, Bootstrap), avoiding build-step CSS bloat and dependency locks.
- **Fluid Layout & Typography**: Utilizes CSS `clamp()` for fluid font sizing (`clamp(3.25rem, 13.5vw, 7.25rem)` on titles), responsive container padding, and dynamic section gutters.
- **Motion & Reduced Motion**: Implements `@media (prefers-reduced-motion: no-preference)` to conditionally activate `scroll-behavior: smooth`, respecting user system accessibility preferences.

### 4.4 Progressive Enhancement and Client Runtime

The client-side bundle in `src/scripts/main.ts` is strictly additive. If the user disables JavaScript or the script fails to load, all content remains visible, links work via native browser anchor scrolling, and the resume is downloadable.
1. **`initTheme`**: Handles theme toggle clicks, toggling `data-theme` between `light` and `dark`, updating `localStorage`, and synchronizing `aria-label` for screen reader users.
2. **`initNav`**: Toggles mobile navigation open/closed state via `data-open` and `aria-expanded`. Listens for navigation link clicks, `Escape` keypress, outside clicks, and media query breakpoint changes (`min-width: 56rem`) to automatically collapse the mobile drawer.
3. **`initScrollSpy`**: Leverages `IntersectionObserver` with an offset viewport window (`rootMargin: '-35% 0px -60% 0px'`). Dynamically updates `aria-current="true"` on the matching header link as the user scrolls through page sections.
4. **`initCopy`**: Intercepts email copy clicks, invokes `navigator.clipboard.writeText`, updates button visual state (`data-copy-idle` vs `data-copy-done`) for 2 seconds, and publishes accessible feedback to the `[data-copy-status]` polite live region.
5. **`initReveal`**: Observes elements with the `.reveal` class. Uses a threshold of 0.05 to attach `.is-visible` for scroll-triggered entrance transitions; falls back to immediate visibility if `IntersectionObserver` is absent.

## 5. Technology stack

| Layer | Technology |
| :--- | :--- |
| **Framework & Engine** | Astro 7.3.5 (Static Site Generator, Content Collections, `@astrojs/sitemap`) |
| **Language & Typing** | TypeScript 6.0 (`astro/tsconfigs/strictest`, `@astrojs/check`) |
| **Styling & Design Tokens** | Vanilla CSS (CSS Custom Properties, Fluid `clamp()`, Dual Color Scheme) |
| **Typography** | Fontsource variable fonts (`Space Grotesk`, `Inter`, `JetBrains Mono`) via `fontProviders.fontsource()` |
| **Validation & Schema** | Zod (via `astro/zod` in `src/content.config.ts`) |
| **Code Quality & Linting** | ESLint 9 (`typescript-eslint`, `eslint-plugin-astro`, `eslint-plugin-jsx-a11y`), Prettier (`prettier-plugin-astro`) |
| **Automation & Tooling** | Playwright (headless browser for automated OG image snapshotting) |
| **Hosting & Edge Delivery** | Cloudflare Pages (Global Anycast CDN, Custom Edge Headers) |
| **CI/CD** | GitHub Actions (`actions/checkout`, `actions/setup-node`, `cloudflare/wrangler-action`) |

## 6. Cross-cutting subsystems

### 6.1 Security Architecture

- **Content Security Policy (CSP)**: Declared in `astro.config.ts`. Enforces `default-src 'self'`, `img-src 'self' data:`, `font-src 'self'`, `connect-src 'self'`, `object-src 'none'`, `base-uri 'self'`, and `form-action 'none'`. Astro automatically calculates SHA-256 cryptographic hashes for the inline anti-FOUC theme script, permitting execution without insecure `unsafe-inline` wildcards. Markdown syntax highlighting is disabled (`markdown: { syntaxHighlight: false }`) because Shiki inline styles conflict with strict CSP directives.
- **Edge Security Headers**: Declared in `public/_headers` for Cloudflare Pages:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY` (anti-clickjacking)
  - `Content-Security-Policy: frame-ancestors 'none'`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy`: Restricts camera, microphone, geolocation, payment, USB, and interest-cohort APIs (`camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()`).
  - `Strict-Transport-Security: max-age=31536000` (HSTS enforcement)
  - `Cross-Origin-Opener-Policy: same-origin`

### 6.2 Caching and Asset Delivery

- **Immutable Fingerprints**: All assets generated by Astro in `/_astro/*` carry unique content hashes. Cloudflare Pages caches these with `Cache-Control: public, max-age=31536000, immutable`.
- **Immediate Revalidation**: Mutable assets like `/resume/*` are configured with `Cache-Control: public, max-age=0, must-revalidate`, guaranteeing visitors immediately receive updated resume PDFs upon deployment.

### 6.3 Automated Open Graph Generation

- **Playwright Headless Renderer**: `scripts/generate-og.mjs` executes a local Playwright Chromium instance against `scripts/og-template.html`.
- **Font-Ready Synchronization**: Awaits `document.fonts.ready` before capturing a 1200x630 viewport screenshot to prevent fallback font rendering.
- **Icon Rendering**: Renders a standalone 180x180 HTML snippet containing a styled bordered monogram div (`SS`) on dark background to produce `public/apple-touch-icon.png`.
- **Committed Artifacts**: The generated PNGs are committed directly into `public/`, eliminating the need to install headless browser binaries within the CI build environment.

### 6.4 Continuous Integration and Deployment (CI/CD)

The `.github/workflows/ci-cd.yml` workflow enforces a strict release pipeline:
1. **Concurrency Controls**: Uses `concurrency` groups keyed by workflow and branch. PR builds cancel outmoded runs, while `main` deploys finish sequentially.
2. **Build Job**: Executes on `ubuntu-latest`. Enforces Node.js version matching `.nvmrc`, runs clean `npm ci`, checks formatting (`prettier --check`), lints code (`eslint .`), runs type verification (`astro check`), and builds production output (`astro build`).
3. **Artifact Transfer**: On successful compilation of the `main` branch, the `dist` directory is uploaded as a pipeline artifact.
4. **Deploy Job**: Runs only for `main` pushes in a dedicated `production` environment. Downloads the `dist` artifact and deploys directly to Cloudflare Pages using `cloudflare/wrangler-action@v4` and repository secrets (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`).

## 7. Technical challenges and noteworthy details

1. **Zero-FOUC Theme Resolution Without Flash or Hydration Lag**:
   Loading theme preferences in bundled scripts causes visible layout flashing. The system injects a tiny, synchronous inline `<script>` in `<head>` that parses `localStorage` or evaluates `@media (prefers-color-scheme: light)` and sets `data-theme` on the root `<html>` element before any DOM nodes are painted.
2. **Strict Content Security Policy Compliance for Inline Scripts**:
   Because the anti-FOUC script must run inline in `<head>`, standard CSP rules would fail without `unsafe-inline`. Astro is configured with `security.csp.algorithm: 'SHA-256'`, computing exact cryptographic hashes for inline snippets at build time, achieving tight XSS immunity.
3. **Graceful Degradation Under Zero-JS Execution**:
   Unlike client-rendered React or Next.js sites where disabling JavaScript leaves an empty root div, this site remains 100% functional without JavaScript. All sections render semantic HTML, links jump directly via CSS anchor scrolling (`scroll-padding-top`), theme falls back to system media queries, and the theme toggle button automatically hides itself via `:global(html:not(.js)) .theme-toggle`.
4. **Accessible Screen Reader State Announcement for Clipboard Actions**:
   Standard clipboard buttons change icon or label text, which screen readers often fail to announce. The contact interface incorporates an offscreen `aria-live="polite"` status region (`[data-copy-status]`) that explicitly announces "Copied the email address" or error notifications to assistive technologies.
5. **Calibrated Scroll-Spy Intersection Margins**:
   Standard element intersection triggers prematurely when tall section containers touch the edge of the viewport. The scroll-spy observer uses asymmetric negative margins (`rootMargin: '-35% 0px -60% 0px'`), confining the detection window to the focal center of the screen so navigation items highlight accurately.
6. **Decoupled Open Graph Rendering**:
   Dynamic server-side OG image generation requires Node canvas or browser runtimes on the edge. By utilizing a dedicated Playwright script offline, pixel-perfect Open Graph cards are rendered with exact brand fonts and committed to static storage, keeping production builds and CI execution lean.
7. **Elimination of Shiki Syntax Highlighting for Strict CSP Compliance**:
   Standard Astro Markdown processing embeds Shiki syntax highlighter spans with inline CSS styles, which violates strict CSP rules prohibiting unsafe inline styles. Because portfolio content is structured cleanly in YAML rather than rendered from markdown prose, syntax highlighting was disabled entirely (`markdown: { syntaxHighlight: false }`), preserving 100% CSP directive integrity.

## 8. How to explain the system (suggested talking structure)

1. **Purpose**: A high-performance, strictly accessible developer portfolio built to showcase backend systems, real-time architectures, and applied AI work.
2. **Architectural Philosophy**: Static Site Generation (SSG) with Astro 7, delivering pure semantic HTML and vanilla CSS with progressive enhancement rather than heavy client-side JavaScript.
3. **Key Engineering Decisions**:
   - Schema-validated content collections (Zod + YAML) separating data from UI layout.
   - Synchronous anti-FOUC inline theme resolution with SHA-256 CSP authorization.
   - Self-hosted variable typography via Fontsource eliminating external network calls.
   - Hardened Cloudflare edge caching, HSTS, and frame protection.
   - Offline headless Playwright pipeline for social card generation.
4. **Operations & Pipeline**: Fully automated GitHub Actions CI/CD pipeline enforcing linting, formatting, strict type checking, and atomic deployments to Cloudflare Pages.

## 9. Glossary

| Term | Meaning |
| :--- | :--- |
| **SSG (Static Site Generation)** | Pre-compiling web pages into static HTML, CSS, and JS files during the build step rather than on per-request server invocation. |
| **FOUC (Flash of Unstyled Content / Theme)** | An undesirable glitch where a page renders with default styling or colors for a split-second before the user's preferred theme stylesheet or script loads. |
| **Astro Content Collections** | Astro's typed content system that organizes file-based content (YAML/Markdown) and validates frontmatter against strict Zod schemas. |
| **CSP (Content Security Policy)** | An HTTP header and browser security mechanism that restricts the resources (scripts, images, stylesheets) the browser is allowed to load for a given page. |
| **Progressive Enhancement** | A web design strategy that provides essential content and functionality to all web browsers first, while layering richer features (scripts, animations) for browsers that support them. |
| **Scroll-Spy** | A navigation pattern where the active link updates automatically based on the user's scroll position in the viewport. |
| **Live Region (`aria-live`)** | A DOM element that announces dynamic text updates to screen readers without requiring the user to navigate to that element. |
| **HSTS (HTTP Strict Transport Security)** | A security header informing browsers that the domain should only ever be accessed using HTTPS. |
| **Fontsource** | An open-source collection of self-hosted npm packages for open-source fonts, eliminating dependencies on Google Fonts CDNs. |
