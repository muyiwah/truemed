# TrueMed — Complete Build Guide for the Coding Agent

> Save this file as `CLAUDE.md` at the repo root. It is written to you, the coding agent. Read it fully before writing any code. Where this guide and your own assumptions disagree, this guide wins. Where this guide and the official Meta docs disagree, the docs win — record the difference in `docs/API_NOTES.md` and tell me.

---

## 0. Mission, deadline, and how we are judged

You are the lead engineer building **TrueMed**, an entry in the **Meta Global AI Developer Hackathon** (indie track). I am the developer working with you (Flutter, Node.js, React).

**What TrueMed is:** an AI medicine-safety network for Nigeria. Meta AI checks medicine packs at two gates:

- **Gate 1 — receiving:** a pharmacist or licensed chemist checks every pack before it reaches the shelf, whether it came from an authorized supplier or the open market.
- **Gate 2 — home:** anyone scans a pack before taking it, wherever it was bought.

Four Meta AI agents (Inspector, Voice, Sentinel, Investigator) do the visible work. One ledger is the memory. A rule engine decides verdicts from hard facts.

**Pitch line:** "Snap any medicine and Meta AI tells you, in your own language, whether the pack is lying and where it really came from. The same AI guards every pharmacy's door."

**Deadline:** Wednesday Nov 4, 2026, 9 PM EST = 3 AM Thursday Nov 5 Lagos (UTC+1). We submit **Wednesday afternoon Lagos time**. Code freeze is **Tuesday night**.

**Judging (build every decision around this):**

| Criterion | Weight | What it means for the build |
|---|---|---|
| Impact | 30% | It must work on real packs and real NAFDAC cases |
| Use of Meta AI tooling | 25% | Muse Spark, SAM 3.1 and Muse Voice Transcribe each do essential, visible work |
| Demo (incl. video) | 25% | Fast, reliable, polished flows that film well on a phone |
| Technical depth | 20% | Real pipeline: agents with tools, hard-fact rules, ledger, eval numbers |

**Priority order when time runs short:** Inspector + rules + confirm step → ledger + clone demo → Gate 1 and Gate 2 screens → Voice (English/Pidgin) → Sentinel → Investigator → carton video → Yoruba/Hausa audio → hotspot map.

---

## 1. Non-negotiable rules

Break none of these. If a rule blocks you, stop and ask me.

### Honesty and safety
1. **AI never issues High risk alone.** Only deterministic hard checks produce High risk. AI-judged findings produce Caution at most.
2. **Confirm before accusing.** Before any High-risk verdict that depends on text the AI read from the pack (batch, expiry, registration number), show the user what was read and ask them to confirm or correct it. Low-confidence reads can only produce Caution.
3. **Never call something fake without evidence.** "No record" must always say: "This does not mean it's fake."
4. **No medical advice.** Never give dosing, treatment, or "safe to take" statements. Best possible wording: "No problems found in N checks." Always add: "This is a screening tool, not a lab test. Confirm with a pharmacist."
5. **Ask first, reveal after.** At Gate 2, ask "Where did you buy this?" **before** revealing which shop the pack is registered to. Never show a pack's registered shop to an anonymous user before they answer.
6. **Gate evidence detail.** Anonymous users get a clear verdict and plain-language reasons. Precise evidence maps (exact artwork differences) are shown only to verified pharmacist/chemist accounts, so counterfeiters can't use the app to perfect fakes. Flag repeated near-identical failing scans from one device.
7. **Users send reports themselves.** TrueMed drafts NAFDAC reports and case files. It never sends email or submits forms on its own.

### Data
8. **Never invent data.** Never fabricate NAFDAC registration numbers, batch numbers, alerts, or reference products. Every seed record has a `sourceUrl`. If data is missing, write `TODO(data)` and tell me.
9. **No real businesses in demo data.** All demo shops, suppliers and manufacturers use clearly fictional names (e.g. "Ikeja Care Pharmacy (demo)", "Ojo Licensed Chemist (demo)"). Never use real pharmacy chains or real brand names for demo shops.
10. **No realistic counterfeits of real brands.** Tamper and clone demos use the fictional brand **DemoQuin** only, with packaging marked "DEMO — NOT A REAL PRODUCT". Real-brand cases appear only as NAFDAC's published alert data.
11. **Greenbook rules.** NAFDAC has no public API. Seed products by **manual lookup** on the official portal, saving each record's URL as `sourceUrl`. Optionally, one live lookup per unknown registration number at human volume, cached for 24 hours, with a timeout and a graceful "couldn't reach NAFDAC right now" fallback. **Never bulk-scrape** the portal or its hidden endpoints. Never treat third-party datasets (e.g. Apify) as a source of truth.

### Engineering
12. **API keys stay on the backend.** The web app never sees any Meta key or the ImageKit private key.
13. **Never guess an API shape.** Read the official docs (section 3) before writing integration code. Record what you confirmed in `docs/API_NOTES.md`. If something isn't documented, say so and propose a fallback — never silently work around it.
14. **Privacy.** Anonymous device IDs only; location only with explicit consent; store the minimum; no personal data in logs. Follow Nigeria's Data Protection Act principles.
15. **Every Meta call** has a timeout, one retry, and a friendly error state. The UI never shows a blank screen.

---

## 2. Tech stack (decided — don't change without asking)

### Frontend: React + Vite (web, mobile-first responsive) — see D30
- React 18, Vite, **JavaScript** (JSX). Routing: React Router. Server state: TanStack Query. HTTP: `fetch` wrapper.
- Styling: Tailwind CSS with design tokens. Motion: Framer Motion. Icons: lucide-react.
- Camera: browser `getUserMedia` for a **live viewfinder** with a framing guide and scan animation; file upload fallback (`<input type="file" accept="image/*" capture="environment">`).
- Video (carton): `MediaRecorder` from the live camera, or file upload.
- Audio record: `MediaRecorder` (webm/opus — the backend converts it). Playback: `<audio>`.
- Text-to-speech for English/Pidgin: browser `speechSynthesis`.
- Evidence overlays: SVG over the image (SAM boxes/masks animate in), plus server-rendered PNGs for sharing.
- Optional map: `react-leaflet`.
- **Design direction (D31): hybrid.** Light, friendly consumer screens (off-white, deep green accent); a dark "analysis" mode while AI works and on evidence / case-file screens. Every Meta model named on screen as it works.
- **Performance:** route-level code splitting; small assets; Open Graph tags in `index.html` for share previews.

### Backend: Node.js 20, **JavaScript (ESM)**, not TypeScript
- Framework: **Express**. Validation: **zod** (validate every request body and every AI output). Use JSDoc comments for types.
- Database: **MongoDB Atlas** with **Mongoose**. Media storage: **ImageKit** (D32) — pack photos, crops, rendered overlays, carton videos, voice clips. Mongo stores only `{ fileId, filePath, url }`. Uploads come to the backend first (it must read the bytes immediately for zxing/sharp/Meta), are analysed in memory, and are pushed to ImageKit in parallel. User-uploaded media is **private** and served through short-lived signed URLs; DemoQuin labels and sample packs can be public. Signing helper modelled on `lumiere/server/src/lib/imagekit.js`.
- Meta APIs: the `openai` npm SDK pointed at Meta's base URL (pass `apiKey` explicitly — the SDK does **not** read Meta's key variable automatically).
- SAM output: `@meta-sam/parser` (official, zero dependencies; usable from JavaScript).
- Images: `sharp` (crops, overlays, highlight rendering).
- Barcodes: `zxing-wasm` to decode GS1 DataMatrix/linear codes; `bwip-js` to **generate** GS1 DataMatrix labels for DemoQuin.
- Audio/video: `fluent-ffmpeg` + `ffmpeg-static` (convert browser audio to 16 kHz PCM; extract video frames; render annotated keyframes).
- Realtime speech: `ws` (WebSocket client for Muse Voice Transcribe).
- Uploads: `multer` (memory storage, size limits). Security: `helmet`, `cors`, `express-rate-limit`. Logging: `pino`.
- Tests: `vitest`.

### Hosting (D33)
- Backend: the founder's **VPS** — Node 20 under **PM2** behind **Nginx**, HTTPS, always on. Proposed host `api.truemed.finessedev.space` (confirm). Pick a free local port (confirm on the box). Nginx `client_max_body_size` must allow 30 MB video uploads; `proxy_read_timeout` ≥ 120s for carton video and the Investigator.
- Deploy: `git pull && npm install --omit=dev && pm2 restart truemed-api` (never drop the `npm install`). `ffmpeg-static` ships its own binary.
- Database: MongoDB Atlas; allowlist the VPS IP.
- Frontend: **Vercel**, proposed `truemed.finessedev.space`, HTTPS (camera and microphone require it). SPA rewrite to `index.html`.

---

## 3. Verified Meta API facts (confirmed in official docs on Oct 30, 2026)

**Read these pages before coding and confirm request shapes:**
- Overview: https://dev.meta.ai/docs/overview
- Models: https://dev.meta.ai/docs/models
- SAM overview: https://dev.meta.ai/docs/sam/overview
- SAM prompts: https://dev.meta.ai/docs/sam/segmenting
- SAM output: https://dev.meta.ai/docs/sam/reading-segmentation
- SAM client libraries: https://dev.meta.ai/docs/sam/client-libraries
- Pricing and limits: https://dev.meta.ai/docs/pricing-rate-limits
- Voice realtime: https://dev.meta.ai/docs/api-reference/voice/realtime

**Common:** base URL `https://api.meta.ai/v1`, `Authorization: Bearer <MODEL_API_KEY>`, OpenAI-compatible.

**Muse Spark** — model `muse-spark-1.3`
- Chat completions (OpenAI format). Supports vision (images), function/tool calling, web search, 1M-token context, up to ~131k output tokens.
- Use for: label extraction (structured JSON), artwork and tamper analysis, shop-answer matching, explanations in English/Pidgin/Yoruba/Hausa, Sentinel and Investigator agents.
- Confirm in docs: how images are passed, how structured output / JSON schema is requested, how web search is enabled.

**SAM 3.1** — model id **`sam-3.1`** (the pricing page shows `sam-3-1`; the API uses `sam-3.1`)
- `POST /v1/responses` (Responses API). Video clips used more than once can be uploaded via `POST /v1/files`.
- Prompt types: **a short noun phrase** ("barcode", "label", "seal", "box") **or** box/point prompts. **You cannot combine a phrase with box/point prompts in one request.** Box/point prompts can name up to 16 objects.
- Video: tracks objects across frames with identity preserved. **Streaming is recommended** for video.
- Output: special-token text in one `output_text` lane, one line per frame: `<Nf>id<|box;x1=..;y1=..;x2=..;y2=..;w=..;h=..|><|mask;...|>`. Decode with `@meta-sam/parser`.
- **Zero matches is valid**: empty output, no error. Handle it explicitly.
- Pricing: $2.50 per 1,000 images; $0.20 per 1,000 video frames; **each video request is billed at least 50 frames**. Limit: 3,000 requests/minute.
- Keep prompts to simple nouns. For the expiry date region: ask Muse Spark for a bounding box, then send that box to SAM as a box prompt (separate request).

**Muse Voice Transcribe** — model `muse-voice-transcribe-1.0`
- Realtime WebSocket: `wss://api.meta.ai/v1/asr/realtime`. Audio must be **16 kHz or 24 kHz** PCM. Price: $0.18 per hour.
- 25 validated languages, **including English; not Yoruba, Hausa or Pidgin.**
- Plan: run it in English mode; test whether Nigerian Pidgin transcribes acceptably; let Muse Spark interpret the rough transcript.
- Browser audio arrives as webm/opus → convert to 16 kHz mono PCM with ffmpeg on the backend → stream to the WebSocket.

**Not hosted on the API (stretch only):** Meta's open-weights speech models (MMS-TTS for Yoruba/Hausa voices; Omnilingual ASR). Only attempt on Monday if the core is done, hosted on Modal. Their quality is unverified — test before showing.

**Budget:** $150 credit. Set a spend limit on the billing page and an app-level daily cap.

---

## 4. Repo structure

```
truemed/
  CLAUDE.md                     # this guide
  docs/
    API_NOTES.md                # what you verified about each Meta API
    PROGRESS.md                 # done / next / blockers, updated each milestone
    ARCHITECTURE.md             # diagram + pipeline, for judges
  backend/
    package.json                # "type": "module"
    src/
      server.js
      config.js                 # env vars, validated with zod
      db/
        connect.js
        models/                 # Mongoose schemas (section 5)
        seed/                   # seed scripts + JSON
      services/
        meta.js                 # one wrapper for all Meta calls (timeouts, retry, cost log)
        sam.js                  # SAM requests + @meta-sam/parser decoding
        voice.js                # Voice Transcribe WebSocket client
        greenbook.js            # cached single lookup (optional)
        storage.js              # ImageKit upload + signed URLs
        media.js                # sharp + ffmpeg helpers
      agents/
        inspector/              # quality gate, extraction, regions, visual checks
        voice/                  # ask-where, interpret, explain
        sentinel/               # alert ingest
        investigator/           # tool-calling case builder
      rules/
        checks/                 # one file per check (section 7)
        score.js
      routes/                   # REST endpoints (section 10)
      demo/
        demoquin.js             # serial issuing, dispatch, label generation
    eval/
      cases/<case-id>/          # images + expected.json
      runEval.js
    test/                       # vitest unit tests
  web/                          # React + Vite app (deployed to Vercel)
  seed/
    products.json               # real, manually sourced
    alerts.json                 # real NAFDAC alerts, sourced
    shops.json                  # fictional demo shops
    demo/                       # DemoQuin packaging, labels, sample videos
```

---

## 5. Data model (MongoDB / Mongoose)

- **products** — reference registry entries: `brandName, genericName, strength, dosageForm, manufacturer, nafdacRegNo (indexed), category (medicine|food|cosmetic), normalShelfLifeMonths, referenceImages[], sourceUrl, verifiedAt`.
- **alerts** — NAFDAC alerts: `alertNo, title, productName, issuedAt, type (falsified|recall|unregistered|revalidated), regNoOnFake, genuineRegNo, batches[{batchNo, expiry}], telltaleSigns[], sourceUrl, rawText, status (pending|approved)`.
- **shops** — `name, type (pharmacy|licensed_chemist), licenceNo, verified, area, city, approxLocation, demo: true`.
- **issuedSerials** — DemoQuin only: `gtin, serial, batch, expiry, issuedAt, dispatchedAt (null until dispatch)`.
- **packs** — one per unit serial seen: `serial (unique index), gtin, batch, expiry, regNo, productId, status (active|in_stock|sold), shopId, source (authorized|open_market), supplierName, marketStall, receivedAt, soldAt, firstVerifierDeviceId`.
- **scanEvents** — **append-only**, never updated or deleted: `type (receiving|home|carton), deviceId, shopId, serial, batch, extracted, barcode, checks[], verdict, answerShop, approxLocation, createdAt`.
- **caseFiles** — `trigger, serials[], shops[], alerts[], steps[] (agent tool calls), summary, draftReport, createdAt`.
- **notifications** — `shopId, type (recall|clone), message, refs, readAt`.
- **devices** — anonymous: `deviceId, role (public|pharmacist|chemist), shopId?, language, createdAt`.

**Indexes:** `packs.serial` unique; `scanEvents` by `serial`, `shopId`, `createdAt`; `products.nafdacRegNo`; `alerts.batches.batchNo`.

---

## 6. The four agents

### 6.1 Inspector (Muse Spark + SAM 3.1)
Pipeline for one pack photo (front, and back if given). Run independent steps in parallel.

1. **Quality gate:** reject blur/glare/too-dark/too-small with a friendly retake message (a quick sharp-based check plus Muse Spark's own read-confidence).
2. **Extraction (Muse Spark):** return JSON matching this schema (validate with zod; one retry on invalid output):

```json
{
  "brandName": "string|null",
  "genericName": "string|null",
  "strength": "string|null",
  "dosageForm": "string|null",
  "manufacturer": "string|null",
  "nafdacRegNo": "string|null",
  "batchNo": "string|null",
  "manufactureDate": "YYYY-MM|null",
  "expiryDate": "YYYY-MM|null",
  "category": "medicine|food|cosmetic|unknown",
  "fieldConfidence": { "<field>": 0.0 },
  "dateRegionBox": { "x1": 0, "y1": 0, "x2": 0, "y2": 0 },
  "unreadableFields": ["string"]
}
```

3. **Regions (SAM 3.1):** noun-phrase requests for `barcode`, `label`, `seal` (one phrase per request, or as the docs allow). Then a **box-prompt** request using `dateRegionBox` to outline the date area. Save crops.
4. **Barcode:** decode with zxing-wasm on the full image and the barcode crop. Parse GS1 Application Identifiers: `(01)` GTIN, `(10)` batch, `(17)` expiry YYMMDD, `(21)` serial. Validate structure and GTIN check digit.
5. **Visual checks (Muse Spark):**
   - Artwork vs reference images (only if a reference exists): specific differences with boxes and confidence.
   - Tamper analysis of the date/batch crop: overprinting, stickers, mismatched fonts, scratches.
   - Lookalike brand name vs known products (e.g. "Coglaet" vs "Colgate").
6. **Confirm step:** if any hard check would fail on AI-read text, return `needsConfirmation` with the read values; the user confirms or corrects, then checks re-run.
7. Hand everything to the rule engine (section 7).

### 6.2 Voice (Muse Voice Transcribe + Muse Spark + TTS)
- Gate 2 asks "Where did you buy this?" **before** revealing anything. The user picks from nearby verified shops, says "a market", "a street seller", or speaks freely.
- Spoken answer: record in the browser → backend converts to 16 kHz PCM → Voice Transcribe (English mode) → Muse Spark interprets the transcript and matches it to a shop (fuzzy name + area), returning `{ shopId|null, sourceType: shop|market|street|unknown, confidence }`.
- Explanations: Muse Spark writes the result in the user's chosen language (en, pcm, yo, ha) **using only the evidence list** — no new claims. Max ~60 words + the standard disclaimer.
- **Shop confirmation (D28):** when Muse Spark matches a spoken or free-text answer to a shop, show the matched shop and ask the user to confirm it. Only a confirmed (or tapped-from-list) shop can drive `WRONG_SHOP` to High; unconfirmed matches cap at Caution.
- Audio: browser `speechSynthesis` reads English and Pidgin text. Yoruba/Hausa audio is a stretch (section 3).

### 6.3 Sentinel (Muse Spark with web search)
- `POST /api/alerts/ingest` takes a NAFDAC alert URL or pasted text. Muse Spark extracts the alert record (zod-validated; keep `rawText`, `sourceUrl`).
- An admin screen shows the parsed result; **I approve before it's saved**.
- On approval: find `packs` matching the batch/reg number → create `notifications` for those shops.

### 6.4 Investigator (Muse Spark, long context, tool calling)
- Triggered by any High-risk verdict or a manual "Investigate" button.
- Tools (functions you implement, read-only): `getPackHistory(serial)`, `getShop(shopId)`, `getShopReconciliation(shopId)`, `findAlerts({batch, regNo})`, `getScansForBatch(batch)`, `getProduct(regNo)`.
- Loop: Muse Spark calls tools step by step (cap ~8 steps), then writes a case file: what happened, evidence list, timeline, shops involved, matching alerts, recommended next step, and a **draft report** for NAFDAC/PCN.
- Store every tool call in `caseFiles.steps` and **show the reasoning trail in the UI** (this is a demo moment).

---

## 7. The ledger and the rule engine

### Checks (one file each in `rules/checks/`)

| Check id | Type | Logic | Fails as |
|---|---|---|---|
| `REG_NOT_FOUND` | hard | Reg no. not in products **and** the live NAFDAC lookup positively returns "not found" (D27). If the lookup is unavailable/fails, the check is `skipped` and the verdict falls to **No record** | High |
| `REG_PRODUCT_MISMATCH` | hard | Reg no. belongs to a different product/strength | High |
| `ALERT_MATCH` | hard | Batch or reg no. matches an approved alert | High |
| `EXPIRED` | hard | Expiry before today | High ("Expired") |
| `SHELF_LIFE_IMPLAUSIBLE` | hard | Expiry − manufacture date > product's normal shelf life + margin | High |
| `GS1_INVALID` | hard | Barcode present but malformed or bad check digit | High |
| `BARCODE_PRINT_MISMATCH` | hard | GS1 batch/expiry differs from printed text (after confirmation) | High |
| `SERIAL_CLONE` | hard | Serial already received by a different shop | High |
| `WRONG_SHOP` | hard | Buyer's **confirmed** shop ≠ pack's registered shop (unit serial only). AI-matched but unconfirmed → Caution (D28) | High |
| `ALREADY_SOLD_ELSEWHERE` | hard | Serial already verified by another device in another city. No location consent → `skipped`, never `pass` (D29) | High |
| `SERIAL_NEVER_ISSUED` | hard | DemoQuin serial not in issuedSerials, or never dispatched | High |
| `ARTWORK_DIFFERENCE` | soft | Visual differences vs reference, confidence ≥ 0.7 | Caution |
| `TAMPER_SIGNS` | soft | Date/batch tampering, confidence ≥ 0.7 | Caution |
| `LOOKALIKE_NAME` | soft* | Near-match to a known brand (*becomes hard only together with REG_NOT_FOUND) | Caution |
| `BATCH_SHOP_MISMATCH` | soft | Batch-only pack: batch never received by the answered shop | Caution |
| `REPEAT_NEARBY` | soft | Same serial verified before by another device in the same city | Caution |
| `EXPIRING_SOON` | info | Expires within 90 days | Note |

Each check returns `{ id, status: pass|fail|skipped, type, reason, evidenceRegion?, source? }`. **Unreadable input = `skipped`, never `pass`.**

### Scoring
- Any hard `fail` → **High risk**.
- Else any soft `fail` → **Caution**.
- Else if key checks were skipped (no reg no. and no batch readable) → **Can't verify** (ask for a clearer photo of the back).
- Else, with pack custody data + shop confirmed:
  - source authorized → **Genuine: authorized chain**
  - source open market → **Checked: open-market source**
- Else → **No red flags** (shop not in network).
- Product not in data at all → **No record** — "This does not mean it's fake."

### Ledger events
- **Receiving (Gate 1):** each accepted pack → upsert `packs` (status `in_stock`, shopId, source, supplierName/marketStall) + append `scanEvents`. If the serial already belongs to another shop → `SERIAL_CLONE`, reject, notify.
- **Home (Gate 2):** append `scanEvents`; first verifier claims the pack (`firstVerifierDeviceId`, status `sold`).
- **Reconciliation:** per shop, serials verified more than once or more units verified than received → flag for the Investigator.

---

## 8. DemoQuin: the fictional supply chain

- A tiny "manufacturer" screen issues N DemoQuin serials (fake GTIN clearly prefixed for demo), stored in `issuedSerials`.
- Generate printable labels as GS1 DataMatrix PNG/PDF with `bwip-js` (`gs1datamatrix`), each marked "DEMO — NOT A REAL PRODUCT".
- **Dispatch** activates serials (sets `dispatchedAt`); undispatched serials fail `SERIAL_NEVER_ISSUED`.
- Demo scripts (seed + buttons) for: genuine authorized chain, open-market pack checked on receipt, clone caught at receiving, invented serial ("never issued"), wrong shop at Gate 2, tampered date (printed mock pack).

---

## 9. Seed data

- **products.json:** 20–30 common medicines (antimalarials, antibiotics, analgesics), plus 1–2 baby food and toothpaste entries. Values hand-copied from the official Greenbook portal; `sourceUrl` on every record. I help collect these and the genuine pack photos.
- **alerts.json:** start from these 2026 NAFDAC cases. **Verify every field against its source; leave unknown fields null.**
  - Counterfeit **Herceptin 600mg** — wrong artwork, wrong expiry, invalid 2D code; previously reported counterfeit batch `C3809C51`. Source: nairametrics.com/2026/03/26/nafdac-alerts-nigerians-over-counterfeit-stomach-cancer-drug-herceptin-in-circulation/
  - Falsified **Chloroquine Phosphate** — carried reg no. `04-8769`, not in NAFDAC's database. Source: nairametrics.com/?p=479031
  - Counterfeit **Dostinex 0.5mg** — batches `GG3470`, `LG8659`, `GG2440` (expiry Jun 2027, Jan 2026, Apr 2026); Public Alert No. 07/2026. Source: vanguardngr.com/?p=2829195
  - Revalidated **SMA Gold** infant formula — altered date markings; reg no. `B1-2783`; batch `22939510A1206`; Public Alert No. 06/2026. Source: allafrica.com/stories/202602230576.html
  - Counterfeit **"Coglaet" toothpaste** (mimicking Colgate) — no valid NAFDAC number or batch markings; Public Alert No. 022/2026. Source: guardian.ng/features/health/nafdac-raises-alarm-over-suspected-counterfeit-toothpaste-in-kaduna/
- **shops.json:** 3 fictional pharmacies + 2 fictional licensed chemists across Lagos areas, plus one in Kano and one in Ibadan for clone/location demos.

---

## 10. API endpoints (backend)

| Method + path | Purpose |
|---|---|
| `POST /api/scan/home` | Gate 2 photo scan → Inspector → `needsConfirmation` or result stub awaiting shop answer |
| `POST /api/scan/home/:id/confirm` | User confirms/corrects read values |
| `POST /api/scan/home/:id/answer` | Shop answer (text or `audioId`) → Voice → final verdict |
| `POST /api/scan/receiving` | Gate 1 single-pack check + source info → accept/reject + ledger |
| `POST /api/scan/carton` | Gate 1 carton video → SAM tracking → per-pack checks → annotated keyframes |
| `POST /api/voice/transcribe` | Audio upload → 16 kHz PCM → Voice Transcribe → transcript |
| `POST /api/explain` | Evidence → explanation in a chosen language |
| `POST /api/alerts/ingest` · `POST /api/alerts/:id/approve` | Sentinel |
| `POST /api/investigate` · `GET /api/cases/:id` | Investigator |
| `GET /api/notifications` | Shop notifications |
| `POST /api/demo/issue` · `POST /api/demo/dispatch` · `GET /api/demo/labels` | DemoQuin |
| `GET /api/samples` · `POST /api/samples/:id/run` | Judge sample packs (cached results) |
| `GET /api/health` | Status of DB and each Meta dependency |

---

## 11. Screens and UX rules

1. **Welcome:** language picker (English, Pidgin, Yoruba, Hausa), role (Buyer / Pharmacist or Chemist — demo PIN for verified roles).
2. **Home:** two big actions — "Check a medicine" and "Receive stock" (verified roles). "Try a sample pack" chips for judges.
3. **Capture:** guided front/back framing, plus upload.
4. **Analysing:** step progress with model captions ("Muse Spark is reading the label…", "SAM 3.1 is finding the barcode…").
5. **Confirm reading:** shows read values in large text; confirm or edit.
6. **Where did you buy it?:** nearby shops list, "market", "street seller", or hold-to-talk.
7. **Result:** big verdict card (colour + icon + one line), provenance line, highlighted image, **evidence trail panel** (each check: pass/fail/skipped + source), play audio, "Report to NAFDAC", disclaimer.
8. **Receive stock:** source picker (authorized supplier name / open market + optional stall), single-pack scan or carton video, accept/reject list.
9. **Notifications:** recalls and clone warnings for the shop.
10. **Case file:** Investigator summary, reasoning trail (tool calls), draft report (copy / open email app).
11. **Admin (hidden route):** Sentinel ingest + approve; DemoQuin issue/dispatch/labels.
12. **How it works:** checks explained, data sources, limitations, accuracy numbers.

**Rules:** guest mode, no account needed for buyers; works at 360px wide and on laptops; high contrast; large touch targets; every network call shows progress and a friendly error; a toggle to show/hide model captions (on for the demo video).

---

## 12. Evaluation harness

- `eval/cases/<id>/` holds images (+ optional answer) and `expected.json` (expected verdict + failing check ids).
- `npm run eval` runs the full pipeline and writes `eval/results.json` + a summary: verdict accuracy, hard-check precision/recall, **false High-risk rate on genuine packs**, extraction field accuracy, median latency, cost per scan.
- **Targets:** 25+ cases; **zero** High-risk verdicts on genuine packs; median Gate 2 scan under 12 seconds.
- Show the numbers on the How-it-works screen and in the README.

---

## 13. Security, reliability, cost

- Rate limit per device and per IP; global daily cap on Meta calls; log estimated cost per request; stop gracefully at the cap.
- Upload limits: images ≤ 8 MB, video ≤ 20 s / 30 MB, audio ≤ 30 s.
- Cache sample-pack results so judges always get instant, correct runs.
- Offline: Gate 1 receiving scans queue locally and sync later (simple queue is enough).
- `/api/health` checked before recording the demo.
- Secrets only in environment variables: `MODEL_API_KEY`, `MONGODB_URI`, `IMAGEKIT_PRIVATE_KEY`, `IMAGEKIT_PUBLIC_KEY`, `IMAGEKIT_URL_ENDPOINT`, `DAILY_CALL_CAP`, `ADMIN_PIN`, `PHARMACIST_DEMO_PIN`, `ALLOWED_ORIGINS`.

---

## 14. Milestones (Lagos time) and acceptance criteria

| Day | Milestone | Done when |
|---|---|---|
| **Fri Oct 30** | Phase 0 + Inspector + rules | `API_NOTES.md` written; Muse Spark extraction, SAM "barcode" segmentation (decoded with the parser) and a Pidgin Voice Transcribe test all work; photo → fields → confirm → hard checks → verdict on 5 real photos; seed data loading |
| **Sat Oct 31** | Ledger, gates, voice, highlights | Ledger events + clone/wrong shop/never issued working; Gate 1 and Gate 2 screens end to end; ask-first voice flow in English/Pidgin; SAM highlights on results; preview deploy live |
| **Sun Nov 1** | Agents, carton video, deploy | Sentinel ingest + approve + notifications; Investigator with visible reasoning trail; carton video → tracked packs → annotated keyframes; production deploy with sample packs |
| **Mon Nov 2** | Test and film | Eval ≥ 25 cases, zero false High risk on genuine packs; bugs fixed; pharmacy + home footage recorded; Yoruba/Hausa audio only if everything else is done |
| **Tue Nov 3** | Freeze | README, ARCHITECTURE.md, video edit support; **code freeze Tuesday night** |
| **Wed Nov 4** | Submit | Final health check; submit by afternoon |

**Cut order if behind:** hotspot map → Yoruba/Hausa audio → carton video → Investigator polish. **Never cut** the Inspector, the confirm step, the clone demo, or Gate 2.

---

## 15. How to work with me

1. **Start with Phase 0** (section 14, Friday): verify every API call in small scripts under `backend/spikes/`, write `docs/API_NOTES.md`, and **report to me before building features**.
2. Update `docs/PROGRESS.md` after each milestone: done, next, blockers.
3. Commit small and often with clear messages.
4. Unit-test every check in `rules/checks/`, GS1 parsing, scoring, and the SAM parser wrapper.
5. **Ask me before:** adding a paid service, changing the stack, or anything involving real people's data.
6. When an API doesn't behave as documented: one paragraph explaining it + a proposed fallback. No silent workarounds.
7. Prefer reliable, demo-ready features over breadth. A feature that isn't reliable doesn't ship.

---

## 16. README requirements (for judges)

- What TrueMed is (2 lines) and the live link.
- **Test it in 60 seconds:** tap a sample pack; try the clone demo; try a home scan.
- Which Meta model does what (table), and the architecture diagram.
- Eval results (accuracy, false-alarm rate, latency, cost per scan).
- Data sources and honest limitations (perfect copies before brand serial data, batch-only packs, contents need a lab, Yoruba/Hausa voice status).
- Disclaimer: screening tool, not medical advice.
- Credit Muse Code if it was used.

---

## 17. Master checklist

**Phase 0 (Friday morning)**
- [ ] `MODEL_API_KEY` set; spend limit set on the billing page
- [ ] Muse Spark: image in → structured JSON out (schema validated)
- [ ] SAM 3.1 (`sam-3.1`): phrase "barcode" on a pack photo → parsed boxes/masks
- [ ] SAM 3.1: box prompt on the date region → mask
- [ ] SAM 3.1: short video with phrase "box" → tracked objects (streaming)
- [ ] Voice Transcribe: English + one Pidgin sentence → transcripts recorded in `API_NOTES.md`
- [ ] zxing-wasm decodes a real GS1 DataMatrix; bwip-js generates a DemoQuin label that decodes back
- [ ] MongoDB Atlas connected; seed scripts run

**Core**
- [ ] Quality gate + retake flow
- [ ] Extraction + confirm step
- [ ] All hard checks with unit tests
- [ ] Soft checks (artwork, tamper, lookalike) capped at Caution
- [ ] Scoring + verdict tiers + exact wording (including "No record" disclaimer)
- [ ] Evidence highlights rendered (sharp) and shown

**Ledger and demo chain**
- [ ] Receiving logs packs with source; clone detection at receiving
- [ ] Home scan claims pack; wrong shop; already sold; repeat nearby
- [ ] DemoQuin issue → labels → dispatch → never-issued check
- [ ] Reconciliation flag

**Agents**
- [ ] Voice: ask-first, spoken answer, shop matching, explanations in 4 languages, English/Pidgin audio
- [ ] Sentinel: ingest, approve, notify
- [ ] Investigator: tools, step cap, case file, visible reasoning trail
- [ ] Carton video: tracking, per-pack checks, annotated keyframes

**Quality and delivery**
- [ ] Eval ≥ 25 cases; zero false High risk on genuine packs; numbers in README
- [ ] Sample packs cached and instant
- [ ] Rate limits, daily cap, timeouts, retries, friendly errors
- [ ] Always-on deploy; HTTPS; `/api/health` green
- [ ] README and ARCHITECTURE.md complete
- [ ] Code freeze Tuesday night

**Definition of done:** a judge opens the live link on a laptop, taps a sample pack, and within 12 seconds sees a correct verdict with highlighted evidence, the evidence trail and a spoken explanation; then runs the clone demo and opens a case file — all without creating an account.
