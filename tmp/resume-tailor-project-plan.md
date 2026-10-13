# Resume Tailor: Project Plan

A local Python application that takes a job description, picks the best-matching LaTeX resume, tailors its content from verified facts, and saves a compiled, one-page result with a full record of what changed.

Status: implementation-ready plan. Research and version checks were done on 13 October 2026.

## Contents

1. [Goals and non-goals](#1-goals-and-non-goals)
2. [Confirmed requirements and assumptions](#2-confirmed-requirements-and-assumptions)
3. [Research findings](#3-research-findings)
4. [Architecture](#4-architecture)
5. [Key decisions and rationale](#5-key-decisions-and-rationale)
6. [End-to-end workflow](#6-end-to-end-workflow)
7. [Technology and dependencies](#7-technology-and-dependencies)
8. [AI model and embedding strategy](#8-ai-model-and-embedding-strategy)
9. [Indexing and retrieval](#9-indexing-and-retrieval)
10. [Resume selection](#10-resume-selection)
11. [Prompting and structured output](#11-prompting-and-structured-output)
12. [Data models and storage](#12-data-models-and-storage)
13. [Directory structure](#13-directory-structure)
14. [Configuration and secrets](#14-configuration-and-secrets)
15. [LaTeX handling, validation and compilation](#15-latex-handling-validation-and-compilation)
16. [Factual grounding safeguards](#16-factual-grounding-safeguards)
17. [Privacy and security](#17-privacy-and-security)
18. [Git, GitHub and .gitignore](#18-git-github-and-gitignore)
19. [Local storage versus Cloudflare object storage](#19-local-storage-versus-cloudflare-object-storage)
20. [CLI and UI](#20-cli-and-ui)
21. [Errors, retries, logging and observability](#21-errors-retries-logging-and-observability)
22. [Testing strategy](#22-testing-strategy)
23. [Evaluation criteria](#23-evaluation-criteria)
24. [Phased implementation plan](#24-phased-implementation-plan)
25. [Risks, trade-offs and mitigations](#25-risks-trade-offs-and-mitigations)
26. [Future enhancements](#26-future-enhancements)
27. [Example commands](#27-example-commands)
28. [Sources](#28-sources)

---

## 1. Goals and non-goals

### Goals

- Paste or pass a job description and receive a tailored `.tex` resume and its PDF in an output folder.
- Analyse the job description: role, domain, seniority, required and preferred skills, responsibilities, keywords.
- Select the best base resume from the existing LaTeX files, with an explanation of the choice.
- Use facts from the project dossiers in `data/` to decide what to emphasise and how to phrase it.
- Never invent a skill, technology, number, title, date or achievement.
- Never change the LaTeX format: the preamble, macros, section order, spacing and layout stay byte-for-byte as written.
- Guarantee the result compiles and fits one page.
- Record every change with its evidence so each tailored resume can be reviewed in under two minutes.

### Non-goals

- No web hosting, accounts, multi-user support or cloud storage.
- No user interface in the first release.
- No cover letters, no job scraping, no automatic applications.
- No writing of bullets about work that no existing resume describes (excluded by decision; see section 2).
- No changes to the LaTeX template or visual design by the tool.

---

## 2. Confirmed requirements and assumptions

### Confirmed with you

| Topic           | Decision                                                                                                                             |
| :-------------- | :----------------------------------------------------------------------------------------------------------------------------------- |
| Language        | Python                                                                                                                               |
| Inference       | DeepInfra, using the Flare model (Llama 3.1 8B Instruct) for every AI step                                                           |
| Embeddings      | Local model on CPU                                                                                                                   |
| Storage         | Local, file-based                                                                                                                    |
| Edit scope      | Select, reorder and rephrase existing content. Every claim must trace to the data folder or a base resume. No newly drafted bullets. |
| LaTeX           | The model must not change the format. It never writes LaTeX.                                                                         |
| Validation      | Compile every result with Tectonic and enforce one page                                                                              |
| Repository      | A new private repository, separate from the portfolio                                                                                |
| Where it runs   | Your laptop only (Windows 11)                                                                                                        |
| Client material | Caliber may be named but its work must not be described                                                                              |

### Assumptions (change in config if wrong)

- The five resumes and `resume-preamble.tex` created earlier are the base set. They use a small, regular macro vocabulary (`\resumeheader`, `\section`, `\org`, `\role`, `\proj`, `\item`, `\skill`), which the tool depends on.
- The dossiers stay in the portfolio repository at `data/projects`; the tool reads them by path and does not copy them.
- Job descriptions are in English.
- One run handles one job description. Typical use is a few runs per day at most.

### One finding that changes a requirement

DeepInfra deprecated `meta-llama/Meta-Llama-3.1-8B-Instruct` on 16 July 2026 and names `meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo` as its replacement. The plan therefore uses the Turbo variant: it is the same Llama 3.1 8B Instruct model, served quantised (fp8), at about $0.02 per million input tokens and $0.04 per million output tokens. Flare should be checked for the same change.

---

## 3. Research findings

| Question                   | Finding                                                                                                                                                                                                                                                         | Consequence for the design                                                                                                  |
| :------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------- |
| Model availability         | The original Llama 3.1 8B Instruct endpoint is deprecated; the Turbo variant replaces it. Context window is 131,072 tokens.                                                                                                                                     | Use the Turbo model ID, held in config so it can change without code edits.                                                 |
| Structured output          | DeepInfra's OpenAI-compatible API supports `response_format` of `json_object` and `json_schema` (with `strict`). The Turbo model is tagged for JSON and tools but not for strict structured output. DeepInfra warns JSON mode can make models fabricate values. | Use `json_object`, validate with Pydantic, retry on failure. Probe `json_schema` support in Phase 0 and enable if it works. |
| Hallucination in rewriting | A July 2026 preprint on grounded resume rewriting found 2.5 to 5.4 hallucinations per resume without defences. Prompt grounding alone was enough only with a capable model at low temperature; weaker models needed deterministic checks.                       | With an 8B model, deterministic validators are authoritative. The model proposes; code decides.                             |
| Structured pipelines       | ResumeFlow processes resume sections separately as JSON and renders afterwards.                                                                                                                                                                                 | Same pattern: small per-item tasks, JSON in and out, rendering done by code.                                                |
| Retrieval grounding        | A study found retrieval-grounded tailoring preserved source content better than an LLM alone.                                                                                                                                                                   | Retrieve dossier evidence for every rewrite.                                                                                |
| Embedding model            | FastEmbed runs ONNX models on CPU without PyTorch. Its default, `BAAI/bge-small-en-v1.5`, is 384-dimensional and about 67 MB. Guides rate `all-MiniLM-L6-v2` as fast but not competitive for retrieval quality.                                                 | Default to `bge-small-en-v1.5`; keep the model configurable and compare against `bge-base-en-v1.5` on a small test set.     |
| Vector store               | ChromaDB's embedded mode keeps its index in memory and there are reports of index corruption after abrupt exits. `sqlite-vec` is still pre-1.0 (0.1.9). The corpus here is a few hundred chunks.                                                                | Use plain SQLite with FTS5 and exact cosine search in NumPy. No vector database is needed at this size.                     |
| Provider privacy           | DeepInfra states inputs are held in memory only during inference, not logged, and not used for training, with a zero-retention commitment in its terms.                                                                                                         | Acceptable for job descriptions and resume text. Contact details and client-restricted material are still never sent.       |
| Compilation                | Tectonic is a single self-contained binary (latest 0.17.0, July 2026) that fetches packages on demand. The existing preamble already compiles under it.                                                                                                         | Use Tectonic for compile checks and page counting.                                                                          |
| Resume practice            | University career centres recommend one page at this experience level, a single column and standard headings for parser compatibility.                                                                                                                          | One page is a hard constraint, enforced by compiling.                                                                       |

Links are in [section 28](#28-sources).

---

## 4. Architecture

### 4.1 Principle

The model never touches LaTeX. Each resume is parsed into a typed content tree whose leaves are **slots** (a bullet's text, a skill list, the summary). The model reads and proposes plain text for slots. Deterministic code validates each proposal against the facts, escapes it, and writes it back into the original file at the slot's exact position. Everything outside the slots is copied unchanged.

### 4.2 Components

```text
                 +-------------------+
 job description |  CLI (Typer)      |  tailor run / index / analyze / select / doctor
 --------------> +---------+---------+
                           |
                 +---------v---------+        +------------------------+
                 |  Pipeline         |<------>|  LLM client            |
                 |  (orchestrator)   |        |  DeepInfra, JSON mode  |
                 +--+----+----+---+--+        |  cache, retries        |
                    |    |    |   |           +------------------------+
        +-----------+    |    |   +-------------+
        |                |    |                 |
+-------v------+ +-------v--+ +v-------------+ +v----------------+
| JD analyser  | | Selector | | Tailor       | | LaTeX engine    |
| LLM + rules  | | scoring  | | plan, rewrite| | parse, render,  |
+--------------+ +----------+ | validate     | | compile, fit    |
                              +------+-------+ +--------+--------+
                                     |                  |
                              +------v-------+   +------v------+
                              | Knowledge    |   | Tectonic    |
                              | store        |   | (binary)    |
                              | SQLite+FTS5  |   +-------------+
                              | + embeddings |
                              +------+-------+
                                     |
                       +-------------+--------------+
                       |                            |
               data/projects/*.md           resumes/*.tex
               (dossiers, read-only)        (base set, read-only)
```

| Component       | Responsibility                                                                            | Uses the LLM        |
| :-------------- | :---------------------------------------------------------------------------------------- | :------------------ |
| CLI             | Input handling, commands, exit codes, console output                                      | No                  |
| Pipeline        | Runs the stages in order, owns the run folder and manifest                                | No                  |
| JD analyser     | Extracts structured requirements from the job description                                 | Yes                 |
| Knowledge store | Indexes dossiers and the bullet bank; hybrid search                                       | No                  |
| Selector        | Scores each base resume against the job description                                       | No                  |
| Tailor          | Chooses and orders content, requests rewrites, validates them                             | Yes (rewrites only) |
| LaTeX engine    | Parses resumes into slots, renders edits, checks the skeleton, compiles, fits to one page | No                  |
| LLM client      | One place for DeepInfra calls: JSON mode, schema validation, retries, caching, redaction  | n/a                 |
| Reporter        | Writes the change report, diff, and manifest                                              | No                  |

---

## 5. Key decisions and rationale

| #   | Decision                                                                     | Rationale                                                                                                                                                               | Rejected alternative                                                                              |
| :-- | :--------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------ |
| D1  | Slot-based editing of the original `.tex`; the model outputs plain text only | The only way to guarantee the format never changes. An 8B model asked to emit LaTeX will break syntax and layout.                                                       | Letting the model rewrite the file; converting resumes to a template engine and regenerating them |
| D2  | `.tex` files stay the source of truth                                        | You maintain resumes in LaTeX and want the tool to inspect those files. A parser plus a round-trip test keeps them authoritative.                                       | Moving content into YAML and generating LaTeX                                                     |
| D3  | A **bullet bank** built from all base resumes                                | The five resumes already hold several human-written bullets per project. Swapping in a better-matching approved bullet gives real tailoring with zero fabrication risk. | Rewriting as the only tailoring mechanism                                                         |
| D4  | Content selection and ordering are deterministic                             | Scoring and a line budget are explainable, testable and repeatable. They do not need a language model.                                                                  | Asking the model to plan the resume                                                               |
| D5  | Rewrites are per bullet, optional, and fall back to the original             | Small tasks suit a small model. A failed or rejected rewrite costs nothing because the approved bullet is used instead.                                                 | One large "rewrite the resume" call                                                               |
| D6  | Deterministic validators outrank the model                                   | Research shows weaker models need them. A second LLM check is advisory only.                                                                                            | Trusting prompt instructions or an LLM judge alone                                                |
| D7  | SQLite with FTS5 and NumPy cosine search                                     | A few hundred chunks. One file, exact search, transactions, keyword and vector search together, no extra service or native extension.                                   | ChromaDB, LanceDB, `sqlite-vec` (see section 12.3)                                                |
| D8  | FastEmbed with `bge-small-en-v1.5`                                           | CPU-only, no PyTorch, small download, strong retrieval for its size.                                                                                                    | sentence-transformers (pulls PyTorch); hosted embeddings                                          |
| D9  | Hybrid retrieval with reciprocal rank fusion                                 | Job descriptions are keyword-heavy (exact tool names); dossiers are prose. Keyword and semantic search cover each other's misses.                                       | Vector-only search                                                                                |
| D10 | Tectonic for compilation                                                     | One binary, no TeX distribution to manage, already proven on these files.                                                                                               | MiKTeX or TeX Live (large installs)                                                               |
| D11 | CLI first, no UI                                                             | The pipeline must be correct before it is convenient. A CLI is also what tests and any later UI call.                                                                   | Building a web UI now                                                                             |
| D12 | Ownership and confidentiality tags on every fact                             | The dossiers describe whole systems, including parts you did not build and client details. Tags stop both from reaching a resume.                                       | Treating all dossier text as usable                                                               |
| D13 | Every LLM response cached by content hash                                    | Re-runs are free, results are reproducible, and tests can replay real responses offline.                                                                                | Calling the API every time                                                                        |
| D14 | Local output only, excluded from git                                         | Outputs name employers you applied to and contain personal data. See sections 18 and 19.                                                                                | Committing outputs or storing them in object storage                                              |

---

## 6. End-to-end workflow

```text
 1 Ingest      read JD (file, clipboard or stdin) -> normalise -> hash -> create run folder
 2 Analyse     LLM extracts requirements as JSON; every item must quote a span of the JD
               rules add skills found by the alias table; result saved as analysis.json
 3 Select      score each base resume; choose one; save the scores and reasons
 4 Retrieve    for each requirement, hybrid search over dossier chunks and the bullet bank
 5 Plan        deterministic: order projects, pick bullets within the line budget, order skills
 6 Rewrite     LLM rephrases chosen bullets and the summary, one at a time, with evidence
 7 Validate    grounding checks on each rewrite; reject -> retry once -> fall back to original
 8 Render      write slot text back into the original .tex; verify the skeleton is unchanged
 9 Compile     Tectonic builds the PDF; count pages
10 Fit         more than one page -> drop the lowest-scoring bullet and recompile (bounded loop)
11 Verify      final checks: forbidden terms, PDF text extraction, keyword coverage
12 Report      save resume.tex, resume.pdf, changes.md, diff.patch, run.json; print summary
```

Stages 3, 4, 5, 8, 9, 10, 11 and 12 use no language model. If DeepInfra is unreachable, the tool can still produce a selected, reordered, compiled resume with `--no-rewrite`.

---

## 7. Technology and dependencies

Versions are the latest stable releases on PyPI or GitHub on 13 October 2026. Pin them in `uv.lock`.

### Runtime

| Purpose              | Choice                       | Version | Notes                                                                                              |
| :------------------- | :--------------------------- | :------ | :------------------------------------------------------------------------------------------------- |
| Language             | Python                       | 3.14.8  | 3.15.0 was released four days before this plan; adopt it after dependencies publish wheels for it. |
| Project and env tool | uv                           | 0.13.0  | Manages Python, the virtual environment and the lockfile.                                          |
| LLM SDK              | `openai`                     | 3.29.0  | Pointed at DeepInfra's OpenAI-compatible base URL.                                                 |
| Data models          | `pydantic`                   | 2.14.1  | Schemas for every model input and output.                                                          |
| Settings             | `pydantic-settings`          | 2.15.0  | Typed config from TOML and environment.                                                            |
| CLI                  | `typer`                      | 0.27.3  |                                                                                                    |
| Console output       | `rich`                       | 15.0.0  | Tables, diffs, progress.                                                                           |
| Embeddings           | `fastembed`                  | 0.9.0   | ONNX Runtime on CPU.                                                                               |
| Numerics             | `numpy`                      | 2.5.4   | Cosine similarity.                                                                                 |
| Retries              | `tenacity`                   | 9.2.1   |                                                                                                    |
| Logging              | `structlog`                  | 26.1.0  | JSON logs with redaction.                                                                          |
| PDF checks           | `pypdf`                      | 6.20.1  | Page count and text extraction.                                                                    |
| Clipboard            | `pyperclip`                  | 1.11.0  | Optional input source.                                                                             |
| Storage              | `sqlite3` (standard library) | n/a     | FTS5 is available in the Python build on this laptop (SQLite 3.45).                                |
| Diff                 | `difflib` (standard library) | n/a     |                                                                                                    |
| LaTeX compiler       | Tectonic                     | 0.17.0  | External binary, installed once, path in config.                                                   |

### Development

| Purpose         | Choice       | Version |
| :-------------- | :----------- | :------ |
| Tests           | `pytest`     | 9.1.1   |
| Coverage        | `pytest-cov` | 7.1.0   |
| Property tests  | `hypothesis` | 6.169.0 |
| HTTP mocking    | `respx`      | 0.23.1  |
| Lint and format | `ruff`       | 0.17.0  |
| Type checking   | `mypy`       | 2.4.0   |
| Git hooks       | `pre-commit` | 4.7.0   |
| Secret scanning | gitleaks     | latest  |

Deliberately not used: LangChain or similar frameworks (the pipeline is a dozen plain function calls), ChromaDB, PyTorch, a TeX distribution, a template engine.

---

## 8. AI model and embedding strategy

### 8.1 Language model

| Setting      | Value                                                            |
| :----------- | :--------------------------------------------------------------- |
| Provider     | DeepInfra, `https://api.deepinfra.com/v1/openai`                 |
| Model        | `meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo`                    |
| Output mode  | `response_format={"type": "json_object"}`, validated by Pydantic |
| Temperature  | 0.0 for analysis, 0.2 for rewrites                               |
| `max_tokens` | 800 for analysis, 200 per rewrite                                |
| Seed         | Fixed in config, where the API honours it                        |

Designing for a small model:

- **One job per call.** Analyse the job description in one call. Rewrite one bullet per call. Never ask for a whole resume.
- **Short inputs.** A rewrite call contains the original bullet, up to three evidence chunks and up to five target terms: under 1,000 tokens.
- **Closed choices.** Where a decision is needed, the model picks from an enumerated list supplied in the prompt.
- **Nothing depends on the model succeeding.** Every model step has a deterministic fallback.

Cost: a run makes roughly 15 to 30 calls and uses under 40,000 tokens, which is well under one US cent.

### 8.2 Embedding model

- Default: `BAAI/bge-small-en-v1.5` through FastEmbed (384 dimensions, about 67 MB, downloaded once to a local cache).
- Embed dossier chunks and bank bullets at index time; embed job-description requirements at run time. Use the model's query and passage modes as FastEmbed exposes them.
- The model name and dimension are stored with every vector. Changing the model in config marks the index stale and `tailor index` rebuilds it.
- Phase 2 includes a comparison against `BAAI/bge-base-en-v1.5` on a labelled test set; switch only if recall improves.

---

## 9. Indexing and retrieval

### 9.1 What is indexed

| Source                                    | Unit                                   | Tags                                                    |
| :---------------------------------------- | :------------------------------------- | :------------------------------------------------------ |
| `data/projects/**/01-project-overview.md` | Heading-aware chunks                   | `project`, `ownership`, `confidentiality`, heading path |
| `data/projects/**/02-contributions.md`    | Heading-aware chunks, table rows       | Same, with `ownership = mine`                           |
| Base resumes                              | One entry per bullet (the bullet bank) | `project`, `role`, source file, `approved = true`       |
| Base resumes                              | Skills inventory                       | Skill name, group, source files                         |

### 9.2 Chunking

- Split Markdown on headings; keep the heading path (`Labelfort > 4.2 Real-time path`) as a prefix so each chunk stands alone.
- Target 120 to 250 tokens per chunk; split long sections on paragraph or list boundaries; keep each table row with its header.
- Store the SHA-256 of each source file. Re-indexing skips unchanged files.

### 9.3 Ownership and confidentiality tags

Defined in `config/projects.toml`, one block per project:

```toml
[projects.labelfort]
ownership_default = "context"          # overview text describes the whole product
mine_sections = ["02-contributions.md"]  # these describe your work
confidentiality = "normal"

[projects.caliber]
ownership_default = "context"
mine_sections = ["02-contributions.md", "01-project-overview.md#3"]
confidentiality = "restricted"         # never sent to the model, never rephrased
locked_bullets = true
```

- `mine` chunks may support a claim. `context` chunks may help the model understand terms but can never be the sole evidence for a rewrite. Sections titled as work you did not do (for example Caliber's "The parts you did not work on") are tagged `not_mine` and excluded from retrieval entirely.
- `restricted` projects are indexed for scoring only. Their text is never included in a prompt, and their bullets can be selected, reordered or dropped but never rephrased.

### 9.4 Retrieval

For each requirement extracted from the job description:

1. Keyword search with FTS5 (BM25) over chunk text.
2. Vector search: cosine similarity against all embeddings (exact, in NumPy).
3. Combine the two ranked lists with reciprocal rank fusion (`k = 60`), keep the top 8.
4. Apply tag filters: drop `not_mine`; drop `restricted` when the result is headed for a prompt.

Outputs: a relevance score per bank bullet and per project (the maximum and the mean of their top matches), and the evidence chunks attached to each bullet for the rewrite stage.

---

## 10. Resume selection

### 10.1 Profiles

Each base resume gets a small profile in `config/resumes.toml`, seeded from its filename and header comment:

```toml
[resumes."resume-backend-engineer"]
role_family = "backend"
titles = ["Backend Engineer", "Software Development Engineer", "Backend Developer", "Python Developer"]
general = false

[resumes."resume-general"]
role_family = "general"
general = true
```

Role families: `ai`, `backend`, `ai_product`, `forward_deployed`, `general`. New `.tex` files dropped into `resumes/` are discovered automatically; a file without a profile is scored on content only and a warning asks you to add one.

### 10.2 Scoring

| Signal              | How it is computed                                                                                  | Weight |
| :------------------ | :-------------------------------------------------------------------------------------------------- | :----- |
| Role-family match   | The analyser classifies the job into one family; 1.0 for an exact match, 0.5 for the general resume | 0.40   |
| Semantic similarity | Cosine similarity between the job's requirements text and the resume's full text                    | 0.30   |
| Keyword coverage    | Share of the job's must-have skills already present in the resume                                   | 0.30   |

- The highest total wins. If the top two are within 0.05, the more specific resume wins when its role family matches, otherwise the general resume.
- `--resume NAME` overrides the choice. The scores and reasons are always written to the report.
- Selection is tested against a labelled set of job descriptions (section 23).

---

## 11. Prompting and structured output

### 11.1 Rules for every prompt

- A system message states the task, the output schema, and the rule that only supplied material may be used.
- The job description and dossier text are wrapped in clearly labelled delimiters and described as data. Instructions found inside them are ignored. This matters because a job description is untrusted text.
- The model is told to return JSON only. The response is parsed into a Pydantic model; a parse or validation failure triggers one retry that includes the error message, then the fallback.
- Prompts live in `prompts/` as versioned text files. The prompt version and hash are recorded in each run manifest.

### 11.2 Job-description analysis

Output schema (abridged):

```json
{
  "title": "Backend Engineer",
  "role_family": "backend",
  "seniority": "mid",
  "domain": "fintech",
  "must_have": [{ "skill": "PostgreSQL", "quote": "strong experience with PostgreSQL" }],
  "nice_to_have": [{ "skill": "Kafka", "quote": "exposure to Kafka is a plus" }],
  "responsibilities": [
    { "text": "Design and operate async APIs", "quote": "design, build and operate..." }
  ],
  "keywords": ["microservices", "event-driven"]
}
```

Checks applied by code:

- Every `quote` must appear in the job description (after whitespace normalisation). Items whose quote is not found are discarded. This stops the model inventing requirements.
- `role_family` and `seniority` must be values from fixed lists.
- A rules pass scans the job description for every skill and alias in the skills inventory and adds any the model missed.

### 11.3 Bullet rewrite

Input: the approved bullet, its evidence chunks, and a short list of **allowed target terms**. A target term is a job-description keyword that code has already confirmed is supported by this bullet's evidence. The model is never shown unsupported keywords.

Output schema:

```json
{
  "text": "Replaced polling and SSE with an event-driven RabbitMQ topic exchange ...",
  "changed": true,
  "terms_used": ["event-driven"],
  "evidence_ids": ["labelfort-0042"]
}
```

The model may also return `"changed": false`, which is the right answer when the bullet already fits.

### 11.4 Summary rewrite

Same pattern, with the base resume's summary as the original and the selected bullets as the only evidence. The summary is the highest-risk slot, so it has the strictest validators and a tight length limit.

### 11.5 What the model is never asked to do

Choose which projects appear, decide ordering, write LaTeX, add skills, change titles, dates, employers, education or contact details, or write about a restricted project.

---

## 12. Data models and storage

### 12.1 Core types (Pydantic)

| Type              | Key fields                                                                                               |
| :---------------- | :------------------------------------------------------------------------------------------------------- |
| `JobDescription`  | `raw_text`, `sha256`, `source`, `company`, `title_hint`                                                  |
| `JDAnalysis`      | As in section 11.2                                                                                       |
| `ResumeDoc`       | `path`, `sha256`, `header`, `sections[]`, `raw_lines[]`                                                  |
| `Slot`            | `id`, `kind` (`summary`, `bullet`, `skill_items`, `tagline`), `line_start`, `line_end`, `text`, `locked` |
| `ProjectBlock`    | `name`, `descriptor`, `role_id`, `bullets[]`, `confidentiality`                                          |
| `BankBullet`      | `id`, `project`, `role`, `text`, `source_files[]`, `terms[]`, `numbers[]`                                |
| `EvidenceChunk`   | `id`, `project`, `heading_path`, `text`, `ownership`, `confidentiality`                                  |
| `SelectionResult` | `chosen`, `scores[]`, `reasons[]`                                                                        |
| `TailorPlan`      | Ordered projects, chosen bullet IDs per project, skill order, estimated lines                            |
| `BulletEdit`      | `slot_id`, `before`, `after`, `terms_used[]`, `evidence_ids[]`, `validation`, `status`                   |
| `RunManifest`     | Run ID, timestamps, model IDs, prompt hashes, input hashes, config snapshot, token usage, outcome        |

### 12.2 SQLite schema (`var/tailor.db`)

| Table        | Purpose                                                                                  |
| :----------- | :--------------------------------------------------------------------------------------- |
| `sources`    | Indexed files with path, SHA-256 and indexed-at time                                     |
| `chunks`     | Dossier chunks with tags                                                                 |
| `chunks_fts` | FTS5 index over chunk text                                                               |
| `embeddings` | `item_id`, `item_kind`, `model`, `dim`, vector stored as a float32 BLOB                  |
| `bullets`    | The bullet bank                                                                          |
| `skills`     | Skills inventory and alias table                                                         |
| `llm_cache`  | Key = hash of model, prompt version, messages and parameters; value = response and usage |
| `runs`       | One row per run with status and output path                                              |
| `meta`       | Schema version, embedding model in use                                                   |

Schema changes use numbered migration scripts applied at start-up. The database is disposable: `tailor index --rebuild` recreates everything except the cache from the source files.

### 12.3 Why SQLite and not a vector database

| Option                    | Fit    | Reason                                                                                                                                             |
| :------------------------ | :----- | :------------------------------------------------------------------------------------------------------------------------------------------------- |
| SQLite + FTS5 + NumPy     | Chosen | One file, standard library, exact search, keyword and vector search together, also holds the cache and run history. Trivially fast at this size.   |
| ChromaDB                  | No     | A second store beside SQLite, heavier dependencies, approximate search that is unnecessary here, and reports of index corruption after hard exits. |
| LanceDB                   | No     | Built for datasets larger than memory; this one is a few hundred rows.                                                                             |
| `sqlite-vec`              | Later  | Good fit in principle but still pre-1.0 and needs a native extension. Worth adopting only if the corpus grows past tens of thousands of chunks.    |
| JSON or other NoSQL files | No     | No full-text search, no transactions, harder to query.                                                                                             |

---

## 13. Directory structure

```text
resume-tailor/                      # new private repository
├── pyproject.toml                  # project metadata, dependencies, tool config
├── uv.lock
├── README.md
├── .env.example                    # DEEPINFRA_API_KEY=
├── .gitignore
├── .pre-commit-config.yaml
├── config/
│   ├── settings.toml               # paths, model IDs, thresholds, weights
│   ├── projects.toml               # ownership and confidentiality per project
│   ├── resumes.toml                # resume profiles
│   ├── skills.toml                 # alias table (Postgres -> PostgreSQL, k8s -> Kubernetes)
│   └── forbidden.toml              # terms that must never appear in output
├── prompts/
│   ├── analyze_jd.v1.md
│   ├── rewrite_bullet.v1.md
│   └── rewrite_summary.v1.md
├── resumes/                        # base LaTeX set (read-only to the tool)
│   ├── resume-preamble.tex
│   ├── resume-contact.tex          # your contact macros; gitignored
│   ├── resume-contact.example.tex
│   ├── resume-general.tex
│   └── resume-*.tex
├── src/resume_tailor/
│   ├── __init__.py
│   ├── cli.py                      # Typer commands
│   ├── config.py                   # pydantic-settings models
│   ├── pipeline.py                 # stage orchestration
│   ├── models.py                   # Pydantic types
│   ├── jd/
│   │   ├── ingest.py               # read, normalise, hash
│   │   └── analyze.py              # LLM extraction and rule checks
│   ├── knowledge/
│   │   ├── store.py                # SQLite access and migrations
│   │   ├── chunker.py              # Markdown chunking and tagging
│   │   ├── embedder.py             # FastEmbed wrapper
│   │   ├── indexer.py              # build and refresh the index
│   │   └── search.py               # hybrid retrieval and fusion
│   ├── latex/
│   │   ├── parser.py               # .tex -> ResumeDoc with slots
│   │   ├── renderer.py             # apply edits, escape text
│   │   ├── skeleton.py             # format-invariance check
│   │   ├── compiler.py             # Tectonic wrapper
│   │   └── fitter.py               # one-page loop
│   ├── tailor/
│   │   ├── selector.py             # resume scoring
│   │   ├── planner.py              # deterministic content plan
│   │   ├── rewriter.py             # per-slot LLM rewrites
│   │   └── validators.py           # grounding checks
│   ├── llm/
│   │   ├── client.py               # DeepInfra calls, JSON mode, retries
│   │   └── cache.py                # response cache
│   ├── report.py                   # changes.md, diff.patch, run.json
│   └── logging.py                  # structlog setup and redaction
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── e2e/
│   ├── fixtures/
│   │   ├── jds/                    # synthetic job descriptions, labelled
│   │   └── llm/                    # recorded model responses
│   └── golden/                     # expected outputs for regression tests
├── inbox/                          # drop job descriptions here; gitignored
├── output/                         # tailored resumes; gitignored
└── var/                            # database, logs, model cache; gitignored
```

One change to the existing files: move the contact macros out of `resume-preamble.tex` into `resume-contact.tex`, loaded with `\input`. The preamble can then be committed without your phone number, and the tool never needs to read contact details.

---

## 14. Configuration and secrets

- **Settings** come from `config/settings.toml`, overridden by environment variables prefixed `TAILOR_`, loaded into a typed `pydantic-settings` model. Invalid or missing settings stop the program at start-up with a clear message.
- **The API key** is read from the `DEEPINFRA_API_KEY` environment variable, or from a `.env` file that is gitignored. It is held as a `SecretStr`, never logged, never written to a manifest, and never passed on a command line.
- **Tunable values** (weights, thresholds, line budget, retry counts, model IDs, paths to `data/` and Tectonic) are all in `settings.toml`, none in code.
- `tailor doctor` verifies the configuration: key present, DeepInfra reachable, model available, Tectonic found, data path exists, index fresh, base resumes parse and compile.

Example `config/settings.toml`:

```toml
[paths]
data_dir    = "C:/personal/tnm/data/projects"
resumes_dir = "resumes"
output_dir  = "output"
tectonic    = "C:/tools/tectonic/tectonic.exe"

[llm]
base_url = "https://api.deepinfra.com/v1/openai"
model    = "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo"
timeout_seconds = 60
max_retries = 3

[embedding]
model = "BAAI/bge-small-en-v1.5"

[tailor]
max_pages = 1
spare_lines_min = 1
rewrite_similarity_min = 0.80
bullet_max_chars = 230
```

---

## 15. LaTeX handling, validation and compilation

### 15.1 Parsing

The parser is deliberately strict and specific to the house style. It reads the file line by line and recognises only:

| Construct                           | Becomes                                   |
| :---------------------------------- | :---------------------------------------- |
| `\resumeheader{...}`                | Tagline slot (locked by default)          |
| `\section{...}`                     | Section boundary                          |
| Paragraph under `\section{Summary}` | Summary slot                              |
| `\org{..}{..}`, `\role{..}{..}`     | Locked structure                          |
| `\proj{..}{..}`                     | Project block header (locked text)        |
| `\item ...` (one per line)          | Bullet slot                               |
| `\skill{Group}{items}`              | Skill slot (items editable, group locked) |
| Everything else                     | Opaque lines, copied verbatim             |

If a file contains anything the parser cannot place (for example a multi-line `\item`), parsing fails with the line number. It never guesses. A **round-trip test** asserts that parsing a file and rendering it with no edits reproduces it byte for byte; this runs for every base resume in CI and at the start of every run.

### 15.2 Rendering

- Edits replace only the text inside a slot. Blocks (a project with its bullets, a bullet, a skill line) can be reordered or removed as whole units.
- Model text is plain text. Before insertion the renderer escapes LaTeX special characters (`\ & % $ # _ { } ~ ^`), converts straight quotes and dashes to the forms used in the file, and rejects any proposal containing a backslash or brace.
- Constructs already present in approved bullets (such as `\textbar{}` or `\href`) are preserved because approved text is copied, not re-escaped.

### 15.3 Format invariance check

After rendering, the tool computes a **skeleton** of both the original and the output: the file with every slot's text replaced by a placeholder and removed blocks accounted for. The two skeletons must match exactly apart from permitted block moves and removals. Any other difference aborts the run. This is the enforcement of "the model must not change the format".

### 15.4 Compilation and fitting

1. Copy the output `.tex` and the preamble files to a temporary build folder.
2. Run Tectonic with a timeout. Shell escape is not enabled.
3. On failure: capture the log, report the first error with its line, and fall back to the next-safest output (rewrites reverted). A base resume that itself fails to compile is reported by `tailor doctor`, not discovered mid-run.
4. Count pages with `pypdf`.
5. **Fit loop**, bounded to 8 iterations:
   - More than one page: remove the lowest-scoring removable bullet (never the last bullet of a required project, never a locked item), recompile.
   - One page with more than a configured number of spare lines and unused relevant bank bullets remain: add the next-best bullet, recompile, and keep it only if the result is still one page.
6. Extract the PDF text and confirm it contains your name, each section heading, and no forbidden terms.

Spare room is measured by compiling a probe copy with filler lines, the same method used when the base resumes were built.

---

## 16. Factual grounding safeguards

These apply in order. A rewrite must pass all deterministic checks to be used.

| Layer | Safeguard                   | Type          | What it prevents                                                                                                                                       |
| :---- | :-------------------------- | :------------ | :----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Closed content pool         | Structural    | Only approved bank bullets can appear. There is no path for a brand-new bullet.                                                                        |
| 2     | Locked fields               | Structural    | Names, titles, employers, dates, education, contact details and project headers are never editable slots.                                              |
| 3     | Ownership tags              | Retrieval     | Text about work you did not do cannot be used as evidence.                                                                                             |
| 4     | Supported target terms only | Prompt input  | The model is shown a job keyword only when code has found it in that bullet's own evidence.                                                            |
| 5     | Number guard                | Deterministic | Every digit sequence in a rewrite must appear in the original bullet. No new numbers, ever.                                                            |
| 6     | Term guard                  | Deterministic | Every technology or skill term in a rewrite must appear in the original bullet or its cited `mine` evidence.                                           |
| 7     | Skills allowlist            | Deterministic | The skills section can only reorder or drop items from the inventory built from your base resumes.                                                     |
| 8     | Semantic drift limit        | Deterministic | Embedding similarity between original and rewrite must exceed a threshold, and length must stay within bounds.                                         |
| 9     | Claim-strength guard        | Deterministic | A list of escalating verbs and qualifiers ("led", "architected", "expert", "extensive") cannot be introduced.                                          |
| 10    | Forbidden-term list         | Deterministic | Client brand names and other configured terms abort the run if they appear anywhere in the output.                                                     |
| 11    | Restricted-project lock     | Structural    | Caliber's bullets are never rephrased and its dossier text never enters a prompt.                                                                      |
| 12    | Entailment check            | Advisory, LLM | A second call asks whether the rewrite is fully supported by the original and evidence. A "no" forces the fallback; a "yes" proves nothing on its own. |
| 13    | Gap report                  | Reporting     | Job requirements with no supporting evidence are listed for you as gaps, never papered over.                                                           |
| 14    | Human review                | Process       | Every change is shown before and after with its evidence. Nothing is sent to an employer by the tool.                                                  |

The term guard needs a reliable way to spot technology terms. It uses the skills inventory, the alias table, and a pattern for capitalised or mixed-case tokens and version strings; any such token not found in the allowed set fails the check.

---

## 17. Privacy and security

| Concern                        | Measure                                                                                                                                                                                     |
| :----------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Contact details                | Kept in `resume-contact.tex`, which the tool never parses, never sends to the model, and which is gitignored.                                                                               |
| What is sent to DeepInfra      | The job description, individual bullets, and non-restricted dossier chunks. Nothing else. A redaction pass removes email addresses and phone numbers from all outgoing text.                |
| Client confidentiality         | Restricted projects never enter a prompt (section 9.3). The forbidden-term list is checked on every output.                                                                                 |
| Provider retention             | DeepInfra documents in-memory processing, no content logging and no training on inputs. Prompt caching features are left off.                                                               |
| API key                        | Environment variable or gitignored `.env`; `SecretStr` in memory; never logged. Use a DeepInfra key scoped to this project with a spend limit.                                              |
| Untrusted job-description text | Treated as data in prompts, cannot inject LaTeX (escaped), cannot add content (closed pool), cannot run commands (no shell escape, arguments passed as lists, never via a shell).           |
| Logs                           | Structured logs record hashes, IDs, timings and token counts by default, not prompt or response bodies. A `--debug-bodies` flag enables bodies for one run, into the gitignored run folder. |
| Local files                    | `output/`, `inbox/` and `var/` hold personal and job-specific data. They stay on the laptop's encrypted disk (confirm BitLocker is on) and out of git.                                      |
| Dependencies                   | Locked with hashes in `uv.lock`; `uv` audit and Dependabot on the private repository.                                                                                                       |
| Secrets in commits             | gitleaks runs as a pre-commit hook and in CI.                                                                                                                                               |

---

## 18. Git, GitHub and .gitignore

### Recommendations

| Item                                | Commit? | Reason                                                                                                                                                                |
| :---------------------------------- | :------ | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source code, tests, prompts, config | Yes     | This is the project.                                                                                                                                                  |
| Base resumes and preamble           | Yes     | They are the tool's input and benefit from history. The repository is private and contact details are split out.                                                      |
| `resume-contact.tex`                | No      | Phone number and email.                                                                                                                                               |
| Generated resumes, PDFs and reports | No      | They name the employers you applied to and when. A leak or an accidental change of repository visibility would expose your job search. Git history is also permanent. |
| Job descriptions                    | No      | Third-party text and a record of your applications.                                                                                                                   |
| Database, logs, model cache         | No      | Derived, large, or personal.                                                                                                                                          |
| Test fixtures                       | Yes     | Use synthetic job descriptions written for testing, not real postings you applied to.                                                                                 |
| `.env`                              | No      | Secrets.                                                                                                                                                              |

Versioning of generated resumes is handled by the run folders themselves (timestamped, immutable, each with a manifest), so git adds nothing for them.

### `.gitignore`

```gitignore
# Secrets
.env
.env.*
!.env.example

# Personal data and generated material
resumes/resume-contact.tex
inbox/
output/
var/

# Build artefacts
*.pdf
*.aux
*.log
*.out
*.synctex.gz

# Python
.venv/
__pycache__/
.pytest_cache/
.mypy_cache/
.ruff_cache/
.coverage
htmlcov/
```

Also: keep the GitHub repository private, enable secret scanning and push protection, and protect `main` so CI must pass.

---

## 19. Local storage versus Cloudflare object storage

**Recommendation: keep everything local. Do not use R2.**

| Possible benefit of R2    | Assessment for this project                                                                                              |
| :------------------------ | :----------------------------------------------------------------------------------------------------------------------- |
| Access from other devices | Not needed; the tool runs on one laptop and you upload PDFs to job sites from it.                                        |
| Durability and backup     | The outputs can be regenerated from the job description and the cache. A normal laptop backup already covers the folder. |
| Sharing a resume by link  | A public link to a resume exposes personal data and is harder to revoke than an email attachment.                        |
| Scale                     | A tailored resume is about 30 KB. A thousand runs is 30 MB.                                                              |
| Cost                      | Negligible either way, so not a deciding factor.                                                                         |

Costs of adding it: another credential to protect, another place personal data lives, network dependence for a local tool, and code to write and test. None of that is repaid.

If backup becomes a concern, the right step is to include `output/` in an existing encrypted backup. If multi-device access becomes a real need, a private R2 bucket with client-side encryption is listed under future enhancements.

---

## 20. CLI and UI

### 20.1 Does this need a UI?

Not now. A command-line tool is the right first interface because:

- the pipeline's correctness is the hard part, and a CLI keeps every stage testable;
- input is one block of text and output is files;
- a UI can be added later as a thin layer over the same functions without redesign.

The one task a UI would do better is reviewing changes side by side. The first release covers that with a readable `changes.md` and a coloured console diff. Add a small local web UI in a later phase if review in the terminal proves slow (section 26).

### 20.2 How job descriptions are provided

| Method            | Command                                  | When to use                                                 |
| :---------------- | :--------------------------------------- | :---------------------------------------------------------- |
| File (primary)    | `tailor run --jd inbox/acme-backend.txt` | Default. Leaves a record, easy to re-run, works in scripts. |
| Clipboard         | `tailor run --clipboard`                 | Fastest for copy and paste from a browser.                  |
| Standard input    | `Get-Clipboard \| tailor run --jd -`     | Piping.                                                     |
| Interactive paste | Not provided                             | Multi-line paste in a Windows terminal is error-prone.      |

In every case the text is saved to the run folder as `jd.txt`, so a run is reproducible from its own folder.

### 20.3 Commands

| Command                 | Purpose                                                                                                     |
| :---------------------- | :---------------------------------------------------------------------------------------------------------- |
| `tailor run`            | Full pipeline. Flags: `--jd`, `--clipboard`, `--company`, `--resume`, `--no-rewrite`, `--dry-run`, `--open` |
| `tailor analyze`        | Stages 1 and 2 only; prints the analysis                                                                    |
| `tailor select`         | Through stage 3; prints the score table                                                                     |
| `tailor index`          | Build or refresh the knowledge index; `--rebuild` to start clean                                            |
| `tailor search "query"` | Run a retrieval query and show ranked chunks; for debugging                                                 |
| `tailor check-resumes`  | Parse, round-trip and compile every base resume                                                             |
| `tailor doctor`         | Environment and configuration checks                                                                        |
| `tailor runs`           | List past runs; `tailor runs show ID` reprints a report                                                     |
| `tailor eval`           | Run the evaluation suite (section 23)                                                                       |

Exit codes: `0` success, `1` completed with warnings (for example rewrites rejected), `2` invalid input or configuration, `3` external failure (API, compiler), `4` safety abort (forbidden term, skeleton mismatch).

---

## 21. Errors, retries, logging and observability

### 21.1 Error handling

| Failure                                     | Behaviour                                                                                          |
| :------------------------------------------ | :------------------------------------------------------------------------------------------------- |
| Missing key, bad config, no index           | Stop before any work with a message naming the fix. Exit 2.                                        |
| DeepInfra timeout, 429, 5xx                 | Retry with exponential backoff and jitter, up to 3 attempts, honouring `Retry-After`.              |
| DeepInfra 4xx (other)                       | No retry. Report the status and stop. Exit 3.                                                      |
| Invalid JSON or schema mismatch             | One retry with the validation error appended, then the deterministic fallback for that step.       |
| Truncated output (`finish_reason = length`) | Treated as invalid.                                                                                |
| Rewrite fails validation                    | One retry with the specific reason, then keep the original bullet.                                 |
| Analysis fails twice                        | Fall back to rules-only analysis (alias-table keywords, embedding-based role family) and warn.     |
| Compile error                               | Revert rewrites and compile the plan with original text. If that fails, stop with the log. Exit 3. |
| Cannot fit one page in 8 iterations         | Save the best attempt marked `NOT_ONE_PAGE` in its filename and report. Exit 1.                    |
| Skeleton mismatch or forbidden term         | Abort, write nothing to `output/` except the report. Exit 4.                                       |

The pipeline never leaves a half-written result: outputs are written to a temporary folder and moved into place once the run finishes.

### 21.2 Logging and observability

- `structlog` JSON lines to `var/logs/tailor.log` with rotation, and a concise human-readable console view.
- Each run has an ID carried on every log line.
- `run.json` is the audit record: inputs and their hashes, chosen resume and scores, model and prompt versions, every LLM call's token usage and latency, cache hits, validator outcomes, fit-loop iterations, final metrics, and tool versions.
- `tailor runs` gives a history view from the `runs` table. No external monitoring service is needed for a local tool.

### 21.3 Run folder

```text
output/2026-10-13_acme_backend-engineer_3f9a2c/
├── resume.tex            # tailored source
├── resume.pdf            # compiled, one page
├── jd.txt                # the job description as provided
├── analysis.json         # extracted requirements
├── selection.json        # resume scores and reasons
├── changes.md            # per-slot before, after, evidence, validator results; gap list
├── diff.patch            # unified diff against the base resume
└── run.json              # manifest
```

---

## 22. Testing strategy

| Level       | Scope                             | Examples                                                                                                                                                                                                        | Uses network                            |
| :---------- | :-------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------- |
| Unit        | Pure functions                    | Parser on each construct; byte-exact round trip for every base resume; escaping (with Hypothesis-generated text); skeleton comparison; number, term and strength guards; rank fusion; scoring; chunker          | No                                      |
| Integration | Components together, model faked  | Indexing a fixture dossier into a temporary database; hybrid search returns expected chunks; the LLM client's retry, JSON repair and cache behaviour against `respx`; the full pipeline with recorded responses | No                                      |
| Adversarial | Safety                            | A fake model that adds a skill, a number, a stronger verb, LaTeX commands, or a client brand name: each must be rejected. A job description containing injected instructions must not change behaviour.         | No                                      |
| Regression  | Stable outputs                    | For each fixture job description with cached responses, the plan, selection and final `.tex` match golden files; intentional changes update them through a reviewed command                                     | No                                      |
| End to end  | Real compile                      | Run the pipeline with cached responses and Tectonic; assert one page, PDF text contains expected headings, skeleton unchanged                                                                                   | No (after first Tectonic package fetch) |
| Live smoke  | Real API, run manually or nightly | One job description through the real model; assert schema validity and all validators pass                                                                                                                      | Yes                                     |

Practices:

- Recorded model responses live in `tests/fixtures/llm/` and are produced by the cache, so tests are deterministic and free.
- CI on GitHub Actions runs lint, type checks, and all tests except the live smoke test. Tectonic is installed in the workflow for the end-to-end job.
- Coverage target: 90% for `latex/` and `tailor/validators.py`, which carry the guarantees; 80% overall.
- Fixtures are synthetic. No real job description or contact detail is committed.

---

## 23. Evaluation criteria

`tailor eval` runs a labelled set of about 20 synthetic job descriptions (four per role family, plus edge cases) and reports:

### Hard gates (must be 100%)

| Criterion               | Measure                                                            |
| :---------------------- | :----------------------------------------------------------------- |
| Compiles                | Every output builds without errors                                 |
| One page                | Every output is exactly one page                                   |
| Format preserved        | Skeleton check passes for every output                             |
| No fabrication          | Zero terms or numbers outside the allowed sets, across all outputs |
| No forbidden terms      | Zero matches                                                       |
| Locked fields unchanged | Titles, dates, employers, education identical to the base          |

### Quality metrics (tracked, with targets)

| Criterion                | Measure                                                                          | Target                                      |
| :----------------------- | :------------------------------------------------------------------------------- | :------------------------------------------ |
| Selection accuracy       | Chosen resume equals the labelled best resume                                    | At least 90%                                |
| Keyword coverage gain    | Share of supported must-have skills present, tailored versus base                | Positive on at least 80% of jobs            |
| Supported-keyword recall | Of job keywords that your evidence supports, the share that appear in the output | At least 85%                                |
| Retrieval recall at 8    | Labelled relevant chunks found in the top 8                                      | At least 90%                                |
| Rewrite acceptance rate  | Rewrites passing validation                                                      | Tracked; a low rate signals prompt problems |
| Analysis accuracy        | Extracted must-have skills against labels (precision and recall)                 | At least 85% each                           |
| Stability                | Same input and cache produce identical output                                    | 100%                                        |

### Human review rubric (five runs per release)

Each tailored resume is scored 1 to 5 on: reads naturally; emphasis matches the job; nothing overstated; nothing important dropped; would send as is.

---

## 24. Phased implementation plan

Each phase ends with working, tested software. Do not start a phase until the previous one meets its acceptance criteria.

### Phase 0: Foundation

1. Create the private repository; initialise with `uv init`; pin Python 3.14.
2. Add dependencies, `ruff`, `mypy`, `pytest`, pre-commit with gitleaks, and a GitHub Actions workflow.
3. Implement `config.py`, `logging.py`, the Typer skeleton, and `tailor doctor`.
4. Copy the base resumes in; split contact macros into `resume-contact.tex`; add the `.gitignore`.
5. Install Tectonic 0.17.0 and record its path.
6. Create a DeepInfra API key for this project with a spend limit. Write a probe script that calls the Turbo model with `json_object`, then with `json_schema` and `strict`, and record which works.

**Acceptance:** `tailor doctor` passes every check; CI is green; the five base resumes compile with Tectonic from the new repository; the probe result is recorded in the README.

### Phase 1: LaTeX engine

1. Implement `parser.py` and the `ResumeDoc` and `Slot` models.
2. Implement `renderer.py` with escaping, block reordering and removal.
3. Implement `skeleton.py`.
4. Implement `compiler.py` and page counting; then `fitter.py` with the probe-based spare-line measure.
5. Implement `tailor check-resumes`.

**Acceptance:** byte-exact round trip for all five resumes; unit tests cover every construct; a hand-written edit set (reorder two projects, drop a bullet, replace a bullet's text) renders, passes the skeleton check and compiles to one page; unsupported LaTeX fails with a line number; coverage of `latex/` is at least 90%.

### Phase 2: Knowledge store and retrieval

1. Implement the SQLite store with migrations.
2. Implement the chunker with heading paths and write `config/projects.toml` tags for all eleven dossiers.
3. Implement the FastEmbed wrapper and the indexer with change detection.
4. Build the bullet bank and skills inventory from the base resumes; write `config/skills.toml` aliases.
5. Implement hybrid search with rank fusion and tag filters; add `tailor index` and `tailor search`.
6. Label a small retrieval test set and compare `bge-small-en-v1.5` with `bge-base-en-v1.5`.

**Acceptance:** `tailor index` completes in under a minute on CPU and re-runs skip unchanged files; no `not_mine` chunk is ever returned; no `restricted` chunk is returned when the prompt filter is on; retrieval recall at 8 is at least 90% on the test set; the embedding choice is recorded with its numbers.

### Phase 3: Job-description analysis and resume selection

1. Implement ingestion from file, clipboard and standard input, with normalisation and hashing.
2. Implement the LLM client: JSON mode, Pydantic validation, retries, cache, redaction.
3. Write `analyze_jd.v1.md`; implement quote verification and the rules pass.
4. Write `config/resumes.toml`; implement the selector and its report.
5. Add `tailor analyze` and `tailor select`.
6. Write the 20 labelled synthetic job descriptions.

**Acceptance:** analysis precision and recall are each at least 85% on the labelled set; no extracted item lacks a verified quote; selection accuracy is at least 90%; a second run of the same job description makes zero API calls; an injected instruction inside a job description does not alter the output.

### Phase 4: Planning and deterministic tailoring

1. Implement the planner: project ordering, bullet selection from the bank under a line budget, skill ordering, respecting locks and minimums.
2. Wire stages 1 to 5 and 8 to 12 into `pipeline.py` with `--no-rewrite`.
3. Implement the reporter: `changes.md`, `diff.patch`, `run.json`, console summary.
4. Implement atomic output and the run folder layout.

**Acceptance:** `tailor run --no-rewrite` produces a compiled, one-page, skeleton-valid resume for all 20 test jobs; every output differs from its base only by approved bullets, ordering and removals; keyword coverage does not decrease on any test job; the report explains every change.

### Phase 5: Grounded rewriting

1. Implement supported-term detection (which job keywords each bullet's evidence supports).
2. Write `rewrite_bullet.v1.md` and `rewrite_summary.v1.md`.
3. Implement every validator in section 16 and the retry-then-fallback flow.
4. Implement the advisory entailment check.
5. Add the adversarial test suite.
6. Tune thresholds on the test jobs; record the chosen values.

**Acceptance:** all hard gates in section 23 hold at 100% across the evaluation set; every adversarial test is rejected; restricted-project bullets are byte-identical to their originals in every output; supported-keyword recall is at least 85%; a human review of five outputs finds no overstated or unsupported claim.

### Phase 6: Hardening and release

1. Complete error handling and exit codes; test each failure path.
2. Implement `tailor eval` and `tailor runs`.
3. Write the README: setup, daily use, how to add a resume, how to add a dossier, how to tune.
4. Add the live smoke test and a nightly workflow that runs it.
5. Tag version 1.0.0.

**Acceptance:** every row of the error table in section 21 has a passing test; `tailor eval` meets every target; a fresh clone on the laptop goes from `uv sync` to a tailored PDF by following the README alone; two weeks of real use with every output reviewed and no factual error found.

---

## 25. Risks, trade-offs and mitigations

| Risk or trade-off                                             | Impact                                                           | Mitigation                                                                                                                                                    |
| :------------------------------------------------------------ | :--------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| An 8B model writes weak or invalid rewrites                   | Fewer accepted rewrites; less tailored wording                   | Selection and ordering do most of the tailoring without the model; rewrites are optional. The model ID is one config line if you later choose a stronger one. |
| The model fabricates despite instructions                     | A false claim on a resume                                        | Fourteen layers in section 16; deterministic guards are authoritative; mandatory human review.                                                                |
| The model endpoint is deprecated again                        | Runs fail                                                        | `tailor doctor` checks model availability; the ID is in config; the cache keeps past runs reproducible.                                                       |
| The strict parser rejects a hand-edited resume                | The tool refuses to run on that file                             | Clear line-numbered error; `tailor check-resumes` in pre-commit; a short style note in the README listing the supported macros.                               |
| The term guard rejects legitimate rewrites                    | Rewrites fall back to originals more often                       | Tune with the alias table; track the acceptance rate; a false rejection is safe, a false acceptance is not.                                                   |
| Keyword matching misses synonyms                              | A supported skill is reported as a gap                           | Alias table plus embedding match; the gap list is shown so you can add an alias.                                                                              |
| The fit loop removes a bullet you wanted                      | A relevant point is dropped for space                            | Removal follows relevance scores; required projects and minimum bullets are configurable; the report lists what was removed and why.                          |
| Font or engine differences change page fit on another machine | A PDF built elsewhere runs to two pages                          | The tool's own Tectonic build is the reference PDF; at least one spare line is kept.                                                                          |
| Dossiers drift from reality                                   | Grounding in stale facts                                         | Dossiers are read from the portfolio repository, so updates there are picked up on the next index.                                                            |
| Sending job descriptions and bullets to a third party         | Exposure of your job search                                      | Provider's zero-retention terms; redaction of contact details; restricted material never sent; `--no-rewrite` mode for sensitive applications.                |
| Over-tailoring                                                | Resumes drift apart and you cannot recall which version was sent | Every run folder is immutable and named by date, company and role.                                                                                            |
| Scope growth                                                  | A simple local tool becomes a platform                           | The non-goals in section 1; phases with acceptance gates; no framework dependencies.                                                                          |

### Known limitations

- English job descriptions only.
- The tool cannot add experience you have not already written a bullet for. That is by design; add the bullet to a base resume and it joins the bank.
- Tailoring quality is bounded by the breadth of the bullet bank and the quality of a small model.
- It optimises for keyword and evidence alignment, not for a specific company's applicant tracking system.

---

## 26. Future enhancements

In rough priority order, each independent of the others:

1. **Local review UI.** A small web page served on `localhost` showing before and after for each slot with accept and reject buttons, calling the same pipeline functions.
2. **Reviewed bullet drafting.** A separate `tailor draft` command that proposes new bullets from `mine` dossier evidence for you to edit and add to a base resume by hand. This keeps the main pipeline closed while growing the bank.
3. **Stronger model for rewrites.** A one-line config change; re-run `tailor eval` to compare.
4. **Cover-letter drafts** grounded in the same evidence and validators.
5. **Application tracker.** Record company, role, date and status per run in the existing database.
6. **Job-description fetch by URL**, with the page text saved to the run folder.
7. **Local model option** through Ollama for fully offline runs.
8. **Encrypted backup** of `output/`, or a private R2 bucket with client-side encryption if access from a second device becomes necessary.
9. **`sqlite-vec`** once it reaches a stable release, if the corpus grows.

---

## 27. Example commands

### First-time setup

```powershell
git clone git@github.com:Sourabh0141/resume-tailor.git
cd resume-tailor
uv sync
Copy-Item .env.example .env          # then add DEEPINFRA_API_KEY
Copy-Item resumes\resume-contact.example.tex resumes\resume-contact.tex
uv run tailor doctor
uv run tailor index
uv run tailor check-resumes
```

### Daily use

```powershell
# From a saved file
uv run tailor run --jd inbox\acme-backend.txt --company "Acme"

# Straight from the clipboard, then open the PDF
uv run tailor run --clipboard --company "Acme" --open

# Preview the analysis and the resume choice without tailoring
uv run tailor select --jd inbox\acme-backend.txt

# Force a base resume, and skip model rewrites
uv run tailor run --jd inbox\acme-backend.txt --resume resume-backend-engineer --no-rewrite
```

### Example console summary

```text
Run 2026-10-13_acme_backend-engineer_3f9a2c

Job         Backend Engineer (mid) | fintech
Selected    resume-backend-engineer   score 0.84   (next: resume-general 0.61)
Must-have   9 skills: 7 supported, 2 gaps (Kafka, Kubernetes)

Changes     projects reordered: 2    bullets swapped: 3    bullets removed: 1
            rewrites accepted: 4     rewrites rejected: 1 (term guard)
            skills reordered: 3 groups
Checks      format preserved: yes    compiled: yes    pages: 1    forbidden terms: 0
Coverage    supported must-haves present: 5/7 -> 7/7

Output      output\2026-10-13_acme_backend-engineer_3f9a2c\resume.pdf
Review      output\2026-10-13_acme_backend-engineer_3f9a2c\changes.md
```

### Maintenance

```powershell
uv run tailor index --rebuild        # after changing the embedding model or tags
uv run tailor search "idempotent retries BigQuery"
uv run tailor eval                   # before changing prompts, thresholds or the model
uv run tailor runs                   # history
uv run pytest                        # all offline tests
```

---

## 28. Sources

### Model and provider

- [DeepInfra: Structured Outputs](https://docs.deepinfra.com/chat/structured-outputs)
- [DeepInfra: Reliable JSON-Only Responses](https://deepinfra.com/blog/deepinfra-json-only-responses)
- [DeepInfra: Data Privacy](https://deepinfra.com/docs/data)
- [DeepInfra: Privacy Policy](https://deepinfra.com/privacy)
- [DeepInfra: Terms of Service](https://deepinfra.com/terms)
- DeepInfra model metadata for `meta-llama/Meta-Llama-3.1-8B-Instruct` and its `-Turbo` variant, read from `https://api.deepinfra.com/models/<model-id>` on 13 October 2026 (deprecation date, replacement, pricing, context length, feature tags)

### Grounding and hallucination

- [Grounded Optimization: A Layered Engineering Framework for Reducing LLM Hallucination in Automated Personal Document Rewriting (arXiv 2607.01457)](https://arxiv.org/abs/2607.01457)
- [ResumeFlow: An LLM-facilitated Pipeline for Personalized Resume Generation and Refinement (review)](https://themoonlight.io/de/review/resumeflow-an-llm-facilitated-pipeline-for-personalized-resume-generation-and-refinement)
- [RAG-based resume tailoring study (National College of Ireland)](https://norma.ncirl.ie/8610/1/komalprakashchandrapatra.pdf)

### Embeddings and retrieval

- [FastEmbed (Qdrant)](https://qdrant.tech/articles/fastembed/)
- [FastEmbed on PyPI](https://pypi.org/project/fastembed)
- FastEmbed supported-model definitions (`fastembed/text/onnx_embedding.py` in the `qdrant/fastembed` repository), read on 13 October 2026
- [Best Embedding Models for RAG 2026 (PremAI)](https://www.premai.io/blog/best-embedding-models-for-rag-2026-ranked-by-mteb-score-cost-and-self-hosting/)
- [Rethinking Hybrid Retrieval: When Small Embeddings and LLM Re-ranking Beat Bigger Models (arXiv 2506.00049)](https://arxiv.org/pdf/2506.00049)
- [Granite Embedding R2 Models (arXiv 2508.21085)](https://arxiv.org/pdf/2508.21085)

### Storage

- [Comparing embedded vector databases (Actian)](https://www.actian.com/blog/developer/comparing-embedded-vector-databases/)
- [ADR: LanceDB over ChromaDB for vector storage](https://glama.ai/mcp/servers/@camilojourney/codesight/blob/7a2e5e7f7ebc6c10653253bd035e9e16e4de11c4/docs/decisions/0001-lancedb-over-chromadb.md)
- [LanceDB versus Chroma (LanceDB)](https://lancedb.com/lp/vs-chroma)
- [sqlite-vec issue on Windows extension loading](https://github.com/asg017/sqlite-vec/issues/45)

### Resume practice

- [Step-by-Step Resume Guide (Carnegie Mellon SCS)](https://www.cmu.edu/career/documents/resources-by-college/scs-resume-guide-2020.pdf)
- [Resumes (Berkeley Career Engagement)](https://career.berkeley.edu/prepare-for-success/resumes/)
- [Is a LaTeX resume ATS-friendly? (JobShinobi)](https://jobshinobi.com/blog/is-a-latex-resume-ats-friendly-2026)

### Versions

- Package versions from the PyPI JSON API, Tectonic from its GitHub releases, and Python release data from endoflife.date, all read on 13 October 2026.
