# ArchiveLens — Project Overview

ArchiveLens turns a scanned **Hindi newspaper edition** (one PDF) into searchable, readable articles that are shown where they were printed. You built it as a separate application, end to end, with FastAPI, Next.js and PostgreSQL, added OpenSearch later, and used Gemini, Mistral, Gemma and similar models. It was later merged into the Digilekh repository by someone else, who tuned it and restructured it to fit the Digilekh code base.

## 1. What it is, in one minute

A person uploads one PDF per edition and says which publication, city, date and **layout** it has. A pipeline cuts every page into regions with a segmentation model, reads the regions with OCR, groups them into articles, classifies each article (news, advertisement, masthead or other) and extracts metadata, then indexes the news articles into OpenSearch. Users then search by words or exact phrase with filters (date, topic, language, publication, city, people, places, organizations), open an article with clippings of the original print, or browse an edition page by page with each article outlined on the scan.

Two layouts are declared by the uploader and handled differently:

- `modular_layout` (post-1990s papers, one story per block): one article per region, no grouping model.
- `l_shaped_layout` (older papers, a story spans non-touching blocks): a language model groups the blocks of a page into articles.

## 2. Problem and purpose

| Problem                                                                   | How the system addresses it                                                                                              |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Old Hindi newspapers exist only as page scans, so nothing can be searched | Layout segmentation, OCR and per-article text, then a Hindi-aware search index                                           |
| A page mixes stories, photographs and advertisements                      | Polygon regions per block, per-article classification, and six advertisement signals that force the advertisement type   |
| Stories in old typesetting are L-shaped and cross several blocks          | Polygon rings instead of rectangles, white masking outside the ring before OCR, and a grouping step for the older layout |
| Language models repeat themselves on dense Devanagari print               | Layered loop detection, temperature escalation on retries and strict output limits                                       |
| Readers need to trust a result                                            | Every article opens with clippings of the original print and links to the source PDF                                     |
| A bulk archive load must not delay ordinary document uploads              | A dedicated queue and worker                                                                                             |

## 3. Features

**Upload**: the upload form takes one PDF at a time (the finalize API itself also accepts per-file edition data in bulk) with edition fields (publication, city, date from 1900-01-01 to today, layout) sent with the finalize call.

**Search page**: all-words or exact-phrase search, sort by relevance, newest or oldest, filter chips, a date filter with decade bars, topic (17 IPTC categories) and language filters, people/place/organization filters added by clicking tags, page size 20, 50 or 100, results up to a 10,000 window, and a "find an edition" picker (year, month, day).

**Article page**: headline, facts line, dateline, text, summary, tags, clippings of the original print (polygon-clipped, with a viewer), and the source PDF in the shared preview panel.

**Edition view**: the scan with one outline per block, tabs for News, Advertisements and Other, next and previous article stepping across pages with the keyboard, an "as printed" column, and prefetching of the next page.

**Operations**: a CLI to rebuild an organization's search index with an atomic alias swap, a per-edition failure record, and run timestamps.

## 4. Architecture

### 4.1 Components

| Component          | Technology                                                                                                                       | Role                                                                                                                              |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Core API (FastAPI) | Alembic, SQLAlchemy                                                                                                              | Owns the three tables; writes the edition row inside the upload transaction; serves the read API; proxies search to the retriever |
| Ingestion worker   | Celery on a dedicated queue, `ingestion_newspaper`                                                                               | Runs the eight-stage pipeline and writes crops, articles and the search index                                                     |
| Retriever service  | FastAPI                                                                                                                          | `POST /news-archives/search`: builds the OpenSearch query                                                                         |
| OpenSearch         | 3.8.0 with the ICU analysis plugin, single node, own host                                                                        | One index per organization behind an alias; derived from Postgres, rebuilt rather than recovered                                  |
| Models             | Roboflow inference server (instance segmentation, served from a configured server URL); Surya OCR on vLLM; Gemini; Gemma on vLLM | Layout, modular-layout OCR, L-shaped OCR and grouping, categorisation                                                             |
| Storage            | PostgreSQL (`pg_uuidv7`), MinIO                                                                                                  | System of record; page images and the source PDF                                                                                  |
| Frontend           | Next.js 16, React 19, Tailwind 4                                                                                                 | Three read screens plus the upload fields                                                                                         |

### 4.2 The pipeline (eight stages)

The Celery task `ingestion.ingest_document` runs `NewsArchivesPipeline` when the space type is `newspaper`. Stage order: validate, segment, crop, ocr, group, categorise, index, finalize. The class extends the platform's ingestion pipeline (ports and adapters, a template-method base class, one module per stage, an adapter registry built once per worker process).

No stage keeps a checkpoint table. **The query that finds work is the gate**: each stage selects what is still missing (pages with no crops, crops with no OCR text, articles with no type), so re-dispatching resumes at the first unfinished unit and does not repeat calls whose results were already stored (a crash in the middle of a page repeats that page's calls).

1. **validate**: the shared checks (size, junk filenames, support) plus a newspaper branch that stamps `processing_started_at` and loads the edition row; a missing edition row is a terminal error (`missing_edition`).
2. **segment**: render each page without crops at 300 DPI; save a lossless PNG for models and a JPEG (quality 95) page image to MinIO for readers; call the layout model; refine the detections; then write all crops, parent links and page sizes in one transaction.
3. **crop**: for every crop that still lacks text and is not a picture, cut the polygon's bounding rectangle from the page image and paint everything outside the polygon white, so an L-shaped story does not carry its neighbour's text into OCR.
4. **ocr**: pages are processed in turn, four crops at a time, with one UPDATE per page. The model depends on the edition layout (below).
5. **group**: for modular editions each readable crop becomes one article (headline from the first heading line); for L-shaped editions Gemini groups the blocks of each page into articles. A child crop (a photo) takes its parent's article id so it is shown with its story.
6. **categorise**: one call per article to a self-hosted Gemma model with a strict JSON schema; the reply gives the article type, a checked headline and, for news, summary, language, up to three IPTC categories, topics, events, keywords, people, places, organizations, dateline, byline, agency, mentioned dates and a "continues on" note.
7. **index**: bulk-write the edition's news articles to OpenSearch, one bulk call, with every item inspected for failure.
8. **finalize**: record counts of problems (failed pages, pages without articles, untyped articles, news without metadata) in the edition's `processing_status`, mark the document indexed even if some counts are non-zero (the code comment: "they are how an incomplete one is found") and publish the completion event.

### 4.3 Layout detection and refinement

The Roboflow instance-segmentation model (model id `newspaper-layout-segmentation-cnuod/1`, version 1, served from a configured inference-server URL) returns polygons with classes `news`, `text box`, `image`, `paragraph` and `table`. A twelve-pass refinement then cleans the detections: drop small images, remove contained text boxes and nested paragraphs, non-maximum suppression, vertical grouping of headline and body, horizontal merging of adjacent text boxes, dropping bad text boxes, subtracting a nested story from its parent polygon with Shapely, and tagging pictures with their story. The adapter then assigns reading order by column overlap. All thresholds are fractions of page height and area against a 827 by 1034 reference page, so a change of DPI does not change what survives. Stored coordinates are raw pixels of the 300 DPI render, which is why the DPI is a code constant and not a setting. The geometry code was moved from the earlier module "unchanged", according to its docstrings.

### 4.4 OCR and loop defence

- **Modular editions**: Surya OCR 2 served by vLLM through the OpenAI SDK. The prompt asks for HTML with block labels and boxes; the HTML is converted to markdown. Each crop gets up to four calls with rising temperature (0, 0.2, 0.4, 0.6) when the reply is an error, a loop or blank; a cut-off reply is kept. Server-side repetition detection is enabled on the request.
- **L-shaped editions**: Gemini reads each crop (up to two attempts); a persistently failing call raises and retries the whole task, unlike Surya where errors are stored and the crop is re-read in a later run.
- **Loop detection** (pure standard library): a zlib compression ratio under 0.06 on texts of 1,000 characters or more (prose is near 0.36, a loop near 0.009), Surya's own repeated-token check, and two trimming algorithms that keep one copy of a repeated tail. The OCR status of each crop is stored: `ok`, `looping`, `cut_at_limit`, `blank` or `error`.
- Only an `error` stores NULL text (so it is read again); a `blank` stores an empty string (so it is not).

### 4.5 Categorisation

One call per article replaced an earlier call per page, because page-level calls ran away (10 of 12 page calls versus 1 of 214 single-article calls). The reply schema is flat and capped, and property order is chosen so that six true/false advertisement signals (business contact, show timings, public-notice reference, vacancy call, prize results, offer for sale) are produced before the type; any true signal makes the article an advertisement regardless of the model's type. Articles are sent wrapped in an `<articles>` element and described as data, never instructions. A model headline replaces the group's headline only if it appears in the article text (whitespace and markdown marks ignored) or is null, which clears it. Entities are returned as "printed | English" pairs and split into two parallel lists.

### 4.6 Search

- **Index**: per organization, an alias `articles_<collection>` over a versioned index, 1 shard, strict mapping. Four analyzers: exact, normalised Hindi, stemmed Hindi and an ICU transliteration chain (so "jaipur" matches जयपुर). Headline and body each have exact, normalised and Latin sub-fields; people, places and organizations are keywords with text, exact and Latin sub-fields.
- **Query** (`build_search_body`, a pure function): in all-words mode each word must match one of four field families (stemmed exact; normalised Hindi with fuzziness `AUTO:5,8` and a locked first letter, so जयपुर and रायपुर stay apart; Latin with fuzziness; English entity names exact). Exact-phrase mode uses phrase matches without fuzziness. Counted filters sit in `post_filter` and each facet aggregation applies every counted filter except its own, so choosing a value does not zero its siblings. Totals are exact. Highlights use `<mark>` and one 200-character fragment.
- **Landing page** (no text, no filter) is served from Postgres only; any text or filter goes through the retriever to OpenSearch. Both paths return the same shape.
- **Rebuild**: `scripts/rebuild_search_index.py` writes a new versioned index, swaps the alias atomically and deletes the old one; it must run with ingestion stopped.

## 5. Technology stack

| Layer               | Technologies                                                                                                                            |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Pipeline            | Python, Celery, PyMuPDF, Pillow, NumPy, Shapely, `markdownify`, `google-genai`, the OpenAI SDK against vLLM, `opensearch-py`, `httpx`   |
| Models and services | Roboflow instance segmentation (hosted), Surya OCR 2 (vLLM), Gemini (L-shaped OCR and grouping), a quantised Gemma on vLLM (categorise) |
| Core API            | FastAPI, SQLAlchemy 2 async, Alembic, PostgreSQL with `pg_uuidv7`                                                                       |
| Search              | OpenSearch 3.8.0, `analysis-icu`, custom Hindi analyzers                                                                                |
| Frontend            | Next.js 16, React 19, TypeScript, Tailwind 4, Jest 30                                                                                   |
| Storage and queue   | MinIO, RabbitMQ with a dedicated queue                                                                                                  |

## 6. How to explain the system (suggested talking structure)

1. One sentence: Hindi newspaper PDF in, searchable articles with clippings out.
2. The pipeline in eight stages and why each stage is a query-gated step.
3. The three hard problems: irregular layout geometry, LLM repetition loops, and Hindi search.
4. The read side: a Postgres landing page, OpenSearch for text, polygon clippings in the browser.

## 7. Glossary

| Term            | Meaning                                                                                  |
| --------------- | ---------------------------------------------------------------------------------------- |
| Edition         | One issue of a newspaper (publication, city, date), stored as one PDF                    |
| Crop            | A region on a page detected by the layout model, with a polygon outline                  |
| Modular layout  | Newspaper typesetting where each story sits in one block                                 |
| L-shaped layout | Older typesetting where a story wraps around other blocks and spans several regions      |
| Loop (OCR)      | A model reply that repeats the same text until it hits the length limit                  |
| IPTC            | The news-industry topic taxonomy; 17 top-level categories are used                       |
| Clipping        | The part of a page image inside an article's polygon                                     |
| Alias           | An OpenSearch name that points at a versioned index; switching it makes a rebuild atomic |
| Reuse gate      | The query a stage runs to find only the work that is still missing                       |
