# InCite AI

A full-stack (MERN) app for chatting with your research papers. Upload PDFs,
ask questions about them, and get structured summaries and reviewer-style
quality assessments. Answers are grounded in your own papers and say which
paper and passages they used.

## What it does

### Papers
- Upload one or more PDFs (up to 10 per request). Each PDF is stored in
  MongoDB GridFS, its text is extracted with `pdf-parse`, and authors and
  keywords are extracted by Gemini (falling back to the PDF's own metadata).
- The upload reports each file honestly: `201` all stored, `207` some stored,
  `422` all unreadable, `502` a backing service failed (with a per-file list).
  A file that fails half-way is removed completely, never left half-indexed.
- View, download, search (title, author, keyword, date) and delete your own
  papers. Every route checks that the paper belongs to the logged-in user and
  answers `404` otherwise.

### Chat ("ask your papers")
- **With a paper selected**, the client sends the paper's MongoDB `_id`.
  Papers up to `CHAT_FULL_TEXT_MAX_CHARS` (default 100,000 characters) are
  given to the model in full; longer ones are searched for their most
  relevant excerpts.
- **With no paper selected**, the paper is chosen by retrieval, not by asking
  the model to guess from titles (see [How paper selection works](#how-paper-selection-works)).
  If nothing in your papers is relevant enough, the app says so instead of
  guessing.
- **With a file attached** to the message, the answer comes from that file.
- Answers stream back as text. Each answer lists its sources ("Sources:
  *title* (excerpts 12, 15)" or "(full text)").

### Summaries and quality assessments
- Both read the **whole paper**. Papers up to `SUMMARY_FULL_TEXT_MAX_CHARS`
  (default 400,000 characters, about 100k tokens) are sent in one request;
  longer documents use map-reduce: notes on at most 8 parts (3 at a time),
  then one final call.
- Gemini is asked for JSON with a **response schema**. The reply is parsed
  tolerantly (JSON wrapped in prose or code fences is recovered), **validated**
  against the same schema (required fields, allowed ratings, a 0-100 score,
  no empty sections), and retried once. If it is still unusable the API
  answers `502` with an explanation, and nothing is saved.
- Results are saved and can be fetched again later.

## How it works

```
                         ┌──────────────┐  text generation (gemini-3.6-flash)
 React client ──/api──▶  │ Express API  │ ───────────────────────────────────▶ Gemini (@google/genai)
 (Vite, port 5173)       │ (port 5000)  │
                         │              │ ── PDFs (GridFS), users, papers ───▶ MongoDB
                         │              │
                         │              │ ── chunks as text; Pinecone embeds ─▶ Pinecone index
                         └──────────────┘    them (llama-text-embed-v2, 768-d,  (one namespace per user:
                                             cosine)                             "v2-<userId>")
```

**Indexing.** A paper's text is split into chunks of whole sentences, at most
400 characters each, with one sentence of overlap between neighbouring
chunks. Chunks are sent to Pinecone as text; the index uses Pinecone's
*integrated embedding*, so Pinecone turns them into vectors (and does the same
for questions at search time). Uploads go in batches of up to 96 chunks, two at
a time, retrying rate limits and network errors.

**Isolation.** Each user's chunks live in their own Pinecone namespace,
`<PINECONE_NAMESPACE_PREFIX>-<userId>`, so a search can only ever see that
user's papers. In MongoDB, every paper route checks ownership, and each paper
records the id of its own stored PDF (filenames are not unique across users).

**Auth.** JWT in an `httpOnly` cookie (3 hours). `SameSite=None; Secure` in
production (the frontend and API are different sites), `SameSite=Lax` in
local development. The server refuses to start without `JWT_SECRET`.

### How paper selection works

When no paper is selected:

1. The question is compared with all of your chunks: one Pinecone search
   returning the 20 most similar.
2. Matches are grouped by paper. Each paper is scored by the **average of its
   3 best chunk scores** (missing chunks count as 0), which favours a paper
   with several relevant passages over one lucky match.
3. If even the best single chunk scores below `PAPER_MATCH_MIN_SCORE`
   (default **0.25**), the app replies that it couldn't find the topic in your
   papers. That value was calibrated with read-only searches on a real index:
   questions the papers answer had best scores of 0.31-0.56; off-topic
   questions 0.03-0.17.
4. Otherwise the best paper's top `RETRIEVAL_TOP_K` (default **8**) excerpts
   are given to the model. Only one paper is used per answer.

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS |
| Backend | Node.js 22+, Express 4 |
| Text generation | Google Gemini (`gemini-3.6-flash` by default) via `@google/genai` |
| Embeddings and vector search | Pinecone serverless index with integrated embedding (`llama-text-embed-v2`) |
| Storage | MongoDB (Mongoose) + GridFS for the PDFs |
| PDF parsing | `pdf-parse` |
| Uploads | `multer` 2 |
| Auth | JWT in an httpOnly cookie, bcrypt password hashes |
| Tests | Node's built-in `node:test`, `mongodb-memory-server`, in-memory fakes for Gemini and Pinecone |

## Running it locally

Requirements: Node.js 22 or newer, a MongoDB database (e.g. a free Atlas
cluster), a Gemini API key (free tier works), and a Pinecone index created
with integrated embedding (e.g. `llama-text-embed-v2`, 768 dimensions,
cosine, field map `text` -> `text`).

```bash
git clone https://github.com/AyushWani11/InCite-AI.git
cd InCite-AI

# 1. Server
cd server
npm install
cp .env.example .env        # then fill it in (see below)
npm run dev                 # http://localhost:5000

# 2. Client (second terminal)
cd client
npm install
npm run dev                 # http://localhost:5173
```

In development the client calls `/api` on its own origin and Vite forwards it
to `http://localhost:5000`, so the login cookie works over plain http. The
server reads `.env` from the folder it is started in, so start it from
`server/`.

### Configuration (`server/.env`)

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `MONGODB_URI` | yes | | MongoDB connection string, including the database name |
| `JWT_SECRET` | yes | | Long random string that signs login tokens; the server will not start without it |
| `GEMINI_API_KEY` | yes | | Google AI Studio key |
| `PINECONE_API_KEY` | yes | | Pinecone key |
| `PINECONE_INDEX_NAME` | yes | | An index with integrated embedding and field map `text` -> `text` |
| `GEMINI_MODEL` | no | `gemini-3.6-flash` | Text model; change it when Google retires a model |
| `PINECONE_NAMESPACE_PREFIX` | no | `v2` | Namespaces are `<prefix>-<userId>`; change it when re-indexing for a new embedding model |
| `RETRIEVAL_TOP_K` | no | `8` | Excerpts per answer (1-20) |
| `PAPER_MATCH_MIN_SCORE` | no | `0.25` | Minimum similarity to answer without a selected paper |
| `CHAT_FULL_TEXT_MAX_CHARS` | no | `100000` | A selected paper up to this size is sent to the model in full |
| `SUMMARY_FULL_TEXT_MAX_CHARS` | no | `400000` | Summaries/assessments use one request up to this size, map-reduce above |
| `NODE_ENV` | in production | | `production` enables the cross-site cookie and `FRONTEND_URL` CORS |
| `FRONTEND_URL` | in production | | The deployed frontend origin allowed by CORS |

The client needs no configuration locally. Optional: `API_PROXY_TARGET`
(where `npm run dev` forwards `/api`) and `VITE_API_BASE_URL` (API URL for
production builds); see `client/.env.example`.

### Scripts (in `server/`)

| Command | What it does |
| --- | --- |
| `npm run dev` / `npm start` | Start the API (with or without auto-restart) |
| `npm test` | Run the test suite (no API keys or network needed) |
| `npm run inspect-pinecone` | Read-only: print the index's dimension, metric, embedding model, field map and per-namespace record counts |
| `npm run reindex -- --dry-run` | Report what re-indexing would do, write nothing |
| `npm run reindex` | Re-embed every stored paper into its owner's namespace (needed after changing the embedding model or the chunking). Never touches other namespaces; safe to re-run |

## Tests

```bash
cd server
npm test
```

The suite starts the real Express app against a throwaway in-memory MongoDB,
with Gemini and Pinecone replaced by in-memory fakes, so it needs no keys.
It covers: login cookies and secrets never being logged; two-user ownership
checks on every paper route, download, search and chat; files with the same
name from different users; vector clean-up on delete; reliable JSON (good,
wrapped, incomplete and garbage replies); paper selection by retrieval;
whole-paper summaries and map-reduce; upload retries, clean-up and per-file
status; chunking and overlap; sources; and the re-index script. Tests were
written to fail before each fix and pass after it.

## API

All routes except register/login/logout need the login cookie.

| Method and path | Purpose |
| --- | --- |
| `POST /api/auth/register`, `POST /api/auth/login` | Create an account / log in (sets the cookie) |
| `GET /api/auth/check-login`, `POST /api/auth/logout` | Current user / log out |
| `POST /api/paper/upload` | Upload PDFs (field `files`, up to 10). `201` / `207` / `422` / `502` with a `failed` list |
| `GET /api/paper/user-papers` | Your papers |
| `GET /api/paper/search?title=&author=&keyword=&fromDate=&toDate=` | Search your papers |
| `GET /api/paper/download/:paperId` | Your paper's PDF (`404` if it is not yours) |
| `DELETE /api/paper/delete/:id`, `DELETE /api/paper/delete-all` | Delete one / all of your papers (chunks first, then file and record) |
| `POST /api/paper/summarize/:paperId`, `GET /api/paper/summary/:paperId` | Generate / fetch a structured summary (`502` if the AI reply is unusable, `422` if the PDF has no text) |
| `POST /api/paper/assess/:paperId`, `GET /api/paper/assessment/:paperId` | Generate / fetch a quality assessment |
| `POST /api/chat` | Ask a question: form fields `question`, `history` (JSON), optional `paperId` (`_id`) or `file`. Streams text; sources in the `X-Sources` header (URL-encoded JSON) |
| `GET /api/chat/history`, `GET /api/chat/history/:sessionId` | Saved chat sessions (see limitations) |

## Deployment notes

- **Server (e.g. Render):** set the required variables above plus
  `NODE_ENV=production` and `FRONTEND_URL`. `package.json` declares Node 22+.
  The port is 5000.
- **Client (e.g. Vercel):** production builds call the deployed API URL in
  `client/src/config.ts`; override it with `VITE_API_BASE_URL` at build time.
- After changing the embedding model, create a new Pinecone index with the new
  model, point `PINECONE_INDEX_NAME` at it, change `PINECONE_NAMESPACE_PREFIX`,
  and run `npm run reindex`. Vectors from different embedding models cannot be
  compared, so every paper must be embedded again; the PDFs in MongoDB make
  that possible.

## Known limitations

Being honest about what this does not do (yet):

- **Gemini free tier:** Google states that free-tier content may be used to
  improve its products, so uploaded papers are seen by Google. Free-tier rate
  limits also apply (summaries of very long documents make several requests).
- **Saving chat history does not work.** The client sends JSON, but the server
  route expects a `text/plain` body, and the message roles do not match the
  database schema. Chat history is kept in the browser only.
- **Model output is rendered as HTML without sanitising** (`marked` +
  `dangerouslySetInnerHTML`). Text in a malicious PDF could make the model
  output HTML that runs in the reader's browser. The login cookie is
  `httpOnly`, which limits the damage, but this should be sanitised.
- **No upload size limit** beyond 10 files per request; files are held in
  memory while processed.
- **Search** builds regular expressions from user input (a malformed pattern
  causes an error; a crafted one can be slow).
- **No rate limiting** on login or on the AI endpoints.
- **Paper selection** uses one paper per answer (a question spanning two
  papers gets one of them). The top-3 average favours papers with several
  matching passages, which slightly disadvantages very short papers. The 0.25
  cutoff was calibrated on a small sample and may need tuning for other
  collections.
- **Scanned PDFs** without a text layer cannot be chatted with or summarised
  (no OCR); the API says so instead of inventing content. `pdf-parse` bundles
  an old pdf.js (2017).
- **Duplicate uploads** are not detected.
- **The chat UI displays answers 20 ms per character**, so long answers take a
  while to appear even after the server has finished.
- **Embedding model is tied to the Pinecone index:** changing it means a new
  index and a re-index (see Deployment notes).
- **Dependencies:** several unused packages remain in `server/package.json`
  (e.g. `chromadb`, `openai`), and `npm audit` reports advisories, some in
  direct dependencies such as `mongoose` and `express`.
- **Legacy data:** papers indexed before the chunk-overlap change keep their old
  chunks until `npm run reindex` is run; a namespace from before the per-user
  layout may still exist in the index and can be deleted once no longer needed.

## Development notes

The changes behind this version (what was wrong, why it mattered, how it was
fixed and tested) are explained in [`docs/PREP_NOTES.md`](docs/PREP_NOTES.md).
