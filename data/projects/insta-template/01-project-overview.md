# PV InstaTemplate — Project Overview

## 1. What it is, in one minute

PV InstaTemplate is a text-snippet expander for browser work. An administrator keeps a library of named templates (canned replies, standard wording) on a small server. A browser extension, installed for each staff member, lets them type `//` in text areas and plain text inputs on pages where the extension runs (not in rich-text editors), pick a template from a pop-up list, and have the template text inserted in place of what they typed. A side panel (Ctrl+Q) lists all templates with search and copy-to-clipboard, and a dashboard page lets the single administrator create, edit and delete templates after logging in.

The staff member never logs in: **reading templates needs no authentication**. Only changing them does.

Two-sentence version: "InstaTemplate is a Manifest V3 browser extension and a small Express/SQLite service that expands `//name` into stored template text in text inputs and textareas on web pages, with a sidebar for browsing and an admin dashboard for managing the library. I built it end to end for the back-office team."

## 2. Problem and purpose

**Problem.** Back-office staff repeat the same wording many times a day in web forms, ticketing tools and webmail. Copying from documents is slow and drifts out of date. The landing page says "Save time and maintain consistency across all your communications.

**What it replaces.** Copy and paste from personal files or documents, with one shared, central library instead.

**Who uses it.**

| Actor                               | What they do                                                                                |
| ----------------------------------- | ------------------------------------------------------------------------------------------- |
| Staff member (many)                 | Installs the extension, types `//` to insert templates, browses and copies from the sidebar |
| Administrator (exactly one account) | Logs in on the extension's dashboard page and creates, edits and deletes templates          |
| Operator                            | Runs the server, sets environment variables, keeps the database file and the host healthy   |

## 3. Features

- **Inline expansion.** Typing `//` shows a suggestion box above the caret. Typing letters filters it; clicking a suggestion, or typing `//template-id` followed by a space, replaces the trigger text with the template text.
- **Sidebar on every page.** The manifest suggests Ctrl+Q (Command+Q on macOS) and the toolbar icon opens a panel with four tabs: Templates (live search, click copies the template to the clipboard and shows "Copied!"), Guide, Feedback (a link to an online form) and Dashboard (opens the login page).
- **Admin dashboard** (extension page): login, a card list with search, create, view, edit (text only; the ID cannot be changed), delete with a confirmation dialog.
- **Server API:** nine API routes plus a health check and the root page, session login, rate limiting, security headers, JSON logs, a daily maintenance task.
- **Landing page** at the server root (static HTML) describing the tool.

## 4. Architecture

### 4.1 Components

```text
 Web page (any site)                          Extension pages (auth, dashboard)
   content scripts: content.js, sidebar.js,     auth.html/js -> dashboard.html/js
   textarea-caret-position.js                   (opened in a browser tab)
        |                                              |
        |   fetch  (JSON over HTTPS, session cookie for admin calls)
        v                                              v
 Express server (server/server.js)  at https://autofill.predusk.co
   helmet, CORS, JSON parser, session (SQLite store), rate limiter, static files
   routes: /api/auth/*, /api/templates/*, /health, /
        |
        v
 SQLite files: templates.db (templates), sessions.db (login sessions)

 Background service worker (background.js): toolbar click and messages between tabs
```

| Component      | Responsibility                                                                                           |
| -------------- | -------------------------------------------------------------------------------------------------------- |
| Manifest       | Permissions, content-script injection on all URLs, Ctrl+Q command, CSP                                   |
| Content script | Loads config, fetches templates, listens to typing, shows suggestions, expands templates                 |
| Caret helper   | Computes caret pixel position inside inputs and textareas (mirror-element technique)                     |
| Sidebar        | Injects the side panel into the page, search, copy                                                       |
| Service worker | Toggle message on icon click, opens auth/dashboard tabs, re-injects scripts, broadcasts template reloads |
| Auth page      | Login form posting credentials to the server                                                             |
| Dashboard page | Template CRUD UI                                                                                         |
| Server entry   | Middleware stack, routes, database set-up, scheduler                                                     |
| Routes         | Auth and template endpoints                                                                              |
| Model          | SQL for templates                                                                                        |
| Database layer | Connection, a promise wrapper `query()`, table creation                                                  |
| Maintenance    | Session cleanup and `VACUUM`, run by a small timer-based scheduler                                       |
| Logger         | JSON log lines to the console                                                                            |

### 4.2 The expansion flow (the core feature)

1. On every page load the content script reads `config.json`, opens a port to the service worker, and fetches **all** templates from `GET /api/templates` into memory.
2. Every `input` event on the page is inspected. For `textarea` elements and `input` elements of type text, search, url, tel or email, if the text before the caret ends with `//` or matches `//[A-Za-z0-9_-]*`, a debounced (50 ms) function shows suggestions.
3. The suggestion box lists all templates when nothing follows `//`, otherwise at most five whose ID or text contains the typed word. It is positioned above the caret using the caret helper.
4. Clicking a suggestion writes `//id ` into the field and calls `expandTemplate`. Alternatively typing a space after `//id` triggers `expandTemplate` directly.
5. `expandTemplate` gets the template by ID (from an in-memory cache, else `GET /api/templates/:id`), finds the last occurrence of `//id ` and replaces it with the template text by assigning the field's `value`. The cache is cleared every 30 minutes.

### 4.3 Admin flow

Dashboard and auth pages are extension pages. Login posts the username and password to `/api/auth/login` with `credentials: 'include'`; the server compares them to two environment variables, sets `session.authenticated`, and a session cookie (24 hours) is stored by the browser. The extension also stores the returned user object in `chrome.storage.local`. Create, update and delete requests pass through the `protect` middleware that checks the session flag.

## 5. Technology stack

| Layer               | Technology                                                                                                        |
| ------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Extension platform  | Chrome extension, Manifest V3                                                                                     |
| Extension UI        | Plain JavaScript, HTML, CSS; no framework or build step                                                           |
| Caret helper        | A "textarea-caret-position" style mirror-div script                                                               |
| Server runtime      | Node.js with Express 4                                                                                            |
| Database            | SQLite through `sqlite3` 5                                                                                        |
| Sessions            | `express-session` with `connect-sqlite3` store                                                                    |
| Security middleware | `helmet`, `cors`, `express-rate-limit` (500 requests per 15 minutes per IP on `/api`)                             |
| Configuration       | `dotenv`; five variables in the local `.env`: port, database path, admin username, admin password, session secret |
| Logging             | Custom JSON logger writing to the console                                                                         |
| Tests / CI          | None                                                                                                              |

## 6. Cross-cutting subsystems

### 6.1 Configuration

Extension: `config.json` is a web-accessible resource read by `content.js`, `auth.js` and `dashboard.js`; `sidebar.js` reuses the content script's `config` object, and `background.js` has its own constants (for example 10 reconnect attempts against 5 in `config.json`). Only `content.js` hard-codes defaults for all five keys; `auth.js` and `dashboard.js` default only the API address. Server: five variables from `.env` (port, database path, admin username, admin password, session secret) plus `NODE_ENV`, which is not set in the local file. The server does not validate them; a missing database path stops start-up with an unhandled error in `db.js` (`path.dirname(undefined)`), and a missing session secret would make `express-session` fail when it is used.

### 6.2 Data model

One business table:

| Column                     | Notes                                       |
| -------------------------- | ------------------------------------------- |
| `id`                       | integer primary key, auto-increment         |
| `template_id`              | unique, not null; the name typed after `//` |
| `content`                  | not null                                    |
| `created_at`, `updated_at` | timestamps; the model writes ISO strings    |

### 6.3 Authentication

A single account whose username and password are environment variables; no user table, no hashing, no lockout other than the general rate limiter. The `protect` middleware only checks that the session says authenticated and then attaches a fixed user object (id 1).

### 6.4 Session maintenance

`scheduler.js` runs `performDatabaseMaintenance` once at start-up and then every 24 hours. It deletes sessions whose `expired` value is more than 24 hours in the past from `sessions.db` and runs `VACUUM` on both databases.

### 6.5 Extension plumbing

The content script keeps a port to the service worker with retry logic; the service worker keeps a map of ports, checks every 30 seconds (with `setInterval`) and pings ports older than 5 minutes, and can re-inject scripts if the sidebar toggle message fails. Several of these mechanisms are defensive code for the "Extension context invalidated" error that occurs after the extension is reloaded while pages are open.

### 6.6 Performance design

Suggestions are debounced (50 ms), the sidebar search is throttled (100 ms) with a cache of results by query, rendering uses a document fragment, and the template cache is cleared every 30 minutes. The whole library is downloaded on each page load.

## 7. Key workflows in detail

**Staff member, first use.** Install the extension (load unpacked or a packaged build). Open any page, click a text box, type `//`; the box lists templates. Type part of a name to filter, click one; the text is inserted.

**Administrator, creating a template.** Sidebar, Dashboard tab, login, "Create Template", enter an ID and text, save. The dashboard reloads its list. The service worker has a handler that tells all tabs to reload their lists, but nothing in the extension sends that message, so edited text reaches other tabs when a template is next expanded (after the 30-minute clear of the per-ID cache), but the `//` suggestion list in an open tab updates only on a page reload; the sidebar refreshes its own list when it is opened.

**Server start-up.** Load `.env`, build the Express app, start listening, then (asynchronously) create the database folder and table, then start the scheduler. The database folder and connection are created when the modules load (before the listener starts), but table creation happens after `listen`, so the first requests can arrive before the table exists.

## 8. Technical challenges and noteworthy details

1. **Triggering on arbitrary pages.** The tool works inside text inputs and textareas on pages it does not control (not rich-text editors). That needs a content script on all URLs, careful event handling that never throws into the page, and a way to place a pop-up at the caret inside a text area (the mirror-element helper).
2. **MV3 service-worker lifetime.** The background script keeps state in memory and uses `setInterval`; service workers can be stopped by the browser, so that state is advisory.
3. **Extension reload handling.** After a reload, old content scripts lose their connection; the code tries to detect "Extension context invalidated" (from `lastError` or a thrown error) and removes its input and click listeners; this path was not exercised.
4. **Search responsiveness.** Incremental filtering that reuses the previous result set when a query only grows, throttled input handling and fragment-based rendering.
5. **Lightweight persistence.** SQLite with an explicit connection wrapper, one table, a session store in a second file and a scheduled `VACUUM`: no external database to run.

## 9. How to explain the system (suggested talking structure)

1. **Purpose:** central library of text templates, expanded in any web text box with `//`.
2. **Shape:** an MV3 extension (content script, sidebar, service worker, two extension pages) and a small Express/SQLite API.
3. **Design choices worth naming:** no login for staff (read-only public API) and a single admin for changes; everything is plain JavaScript with no build step; incremental filtering and caching for responsiveness; a session store and database in SQLite so nothing else needs installing.

## 10. Glossary

| Term              | Meaning                                                                          |
| ----------------- | -------------------------------------------------------------------------------- |
| Template          | A named piece of text stored on the server; the name is the `template_id`        |
| Trigger / prefix  | `//`, typed before the template name                                             |
| Content script    | Extension code that runs inside web pages                                        |
| Service worker    | The extension's background script (Manifest V3)                                  |
| Manifest V3       | The current Chrome extension format with service workers and stricter policies   |
| Session cookie    | Browser cookie that identifies the logged-in administrator                       |
| CORS              | Browser rule that controls which websites may read responses from another origin |
| `VACUUM`          | SQLite command that rewrites the database file to reclaim space                  |
| Caret coordinates | The pixel position of the text cursor, used to place the suggestion box          |
