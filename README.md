# TrueMed

**Anti-counterfeit checks for medicine packs, at the two doors every fake has to pass: the pharmacy and the home.**
Snap a pack. Meta AI reads it, finds the evidence, checks hard facts against NAFDAC data and a shared custody ledger, and explains the result in English, Pidgin, Yoruba or Hausa.

Built for the Meta Global AI Developer Hackathon (Indie Developer track, *Build for Your World*).
Everything in this repository was built during the event (first commit Oct 30, 2026).

- **Demo video (3 min):** `TODO: add YouTube/Loom link`
- **Hosted demo (optional):** https://truemed.finessedev.space · API https://api.truemed.finessedev.space/api/health

> TrueMed is a **screening tool, not medical advice and not a lab test**. It never gives dosing or treatment advice; it checks whether the *pack* is consistent with what is registered, issued and sold. It is a **working prototype on demo data**: it is not connected to NAFDAC's database (NAFDAC has no public API). DemoQuin and all demo shops are fictional.

---

## Why

Fake and substandard medicines kill up to **500,000 people a year in sub-Saharan Africa** (UNODC, 2023). In Nigeria, poor-quality antimalarials alone are estimated to kill **12,300 young children a year** (Beargie et al., PLOS ONE, 2019). In 2026 NAFDAC has already flagged a counterfeit cancer medicine (Herceptin), counterfeit Dostinex, relabelled infant milk and a fake toothpaste brand. These reach people through shops. TrueMed puts a check at the shop's receiving door (Gate 1) and in the buyer's hand at home (Gate 2).

## Test it in 60 seconds (hosted)

1. Open https://truemed.finessedev.space, pick a language.
2. Under **No pack nearby? Try a sample**, tap **Genuine pack** → answer *Ikeja Care Pharmacy (demo)* → **Genuine: authorized chain**.
3. Tap **Relabeled expiry** → confirm the values → *At a market* → **High risk**: the 2D code says expiry 2025-05, the box says 2028-05. Switch the explanation to Naijá / Yorùbá / Hausa. Tap **Investigate** to watch the Investigator agent build a case file.
4. Pharmacy flow: on the start screen choose **Pharmacist or Chemist**, any demo shop, PIN **2468** → **Receive stock**. Print labels from **Print demo labels** to scan DemoQuin packs, including a cloned serial that is rejected at the door.

Sample packs never write to the ledger, so every judge sees the same result.

## Run it yourself

Requirements: **Node 20+**, **MongoDB** (local or Atlas), and **your own Meta Model API key** from https://dev.meta.ai. ffmpeg ships with the backend (`ffmpeg-static`).

```bash
git clone https://github.com/muyiwah/truemed.git && cd truemed

# 1. MongoDB (skip if you have one)
docker run -d --name truemed-mongo -p 27017:27017 mongo:7

# 2. Backend
cd backend
npm install
cp .env.example .env          # then edit .env:
                              #   MODEL_API_KEY=<your Meta Model API key>
                              #   MONGODB_URI=mongodb://localhost:27017/truemed
                              #   ADMIN_PIN=<anything>
npm run seed                  # demo shops, NAFDAC alerts, DemoQuin supply chain
npm run dev                   # http://localhost:4080/api/health should say "meta": "configured"

# 3. Web app (second terminal)
cd ../web
npm install
npm run dev                   # http://localhost:5173 (proxies /api to :4080)
```

**About the API key.** Only `MODEL_API_KEY` and `MONGODB_URI` are required. The key is read **only by the backend**; the browser never sees it. `backend/.env` is git-ignored; never commit it. Every Meta call has a timeout, one retry and a daily call/spend cap (`DAILY_CALL_CAP`, `DAILY_SPEND_CAP_USD`), so a test run can't run up a bill. A scan costs a few US cents at most. ImageKit keys are optional: without them scans work, photos just aren't stored.

Camera and microphone need HTTPS on phones; on a laptop `localhost` works. Tests: `cd backend && npm test` (43 tests: every rule check, GS1 parsing, scoring, the SAM parser wrapper, the registry router).

## Where Meta's models do the work

| Model | What it does in TrueMed | Where |
|---|---|---|
| **Muse Spark** `muse-spark-1.3` | Reads the pack into structured JSON (brand, NAFDAC no., batch, dates, confidence per field) and boxes the date block; examines that crop for tampering; compares artwork; spots lookalike brands; matches a spoken shop name; explains results in 4 languages using only the evidence list | `backend/src/agents/inspector`, `agents/voice` |
| **SAM 3.1** `sam-3.1` | Outlines barcode, label and seal by noun phrase, and the date block by box prompt (from Muse Spark's box); tracks every pack across a carton video | `backend/src/services/sam.js`, `services/carton.js` |
| **Muse Voice Transcribe** `muse-voice-transcribe-1.0` | “Where did you buy this?” spoken answer → text (realtime WebSocket, 24 kHz PCM) | `backend/src/services/voice.js` |
| **Muse Spark + web search** (Sentinel agent) | Turns a NAFDAC alert link or text into batch records; a human approves; every shop holding a matching batch is warned | `backend/src/agents/sentinel` |
| **Muse Spark + tool calling** (Investigator agent) | Calls read-only ledger tools step by step (pack history, shop, batch scans, alerts, reconciliation) and writes a case file with a draft NAFDAC/PCN report; every tool call is shown in the UI | `backend/src/agents/investigator` |

Verified request shapes for each API are in [docs/API_NOTES.md](docs/API_NOTES.md).

## How a verdict is decided

AI reads and finds evidence; **hard facts decide**. Full detail in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

- **High risk** only when a deterministic check fails: expired, 2D code doesn't match the print, invalid GS1 code, batch or number in an approved NAFDAC alert, implausible shelf life, serial already received by another shop (clone), serial never issued by the maker, bought from a shop that never received it.
- If a High-risk check depends on text the AI read, the user **confirms or corrects the values first**.
- **AI judgement alone (artwork, tampering, lookalike names) can only raise Caution.**
- **No record** always says *"This does not mean it's fake."* Unreadable input is *skipped*, never *passed*.
- Gate 2 asks **where you bought it before revealing** where the pack is registered, so answers can't be coached.

## Data and honesty

- **NAFDAC alerts:** real public alerts, each with its `sourceUrl` (`seed/alerts.json`).
- **Registered products:** only entries with a source link are seeded (currently DemoQuin and SMA Gold); real Greenbook entries are added by hand, never scraped. NAFDAC publishes no API, so most real packs return **No record**. [docs/NAFDAC_INTEGRATION.md](docs/NAFDAC_INTEGRATION.md) explains the research, and the **simulated NAFDAC sandbox** (DemoQuin only, clearly labelled) that shows how a real integration plugs in by configuration.
- **DemoQuin:** a fictional brand with a fictional manufacturer that shares its issued serials, so the full supply-chain checks can be demonstrated. Printed labels say *DEMO — NOT A REAL PRODUCT*.
- **Privacy:** anonymous device IDs, location only with consent, private media behind short-lived signed URLs, no personal data in logs.

## Limitations

- Not connected to NAFDAC's registry or traceability system; that is the pilot we are asking for.
- A perfect copy with an invented serial passes until brands share the serials they issued (DemoQuin shows how that works).
- Packs with only a batch number (no unit serial) can't be bound to one shop; a mismatch is Caution only.
- What is inside the pack needs a lab. TrueMed checks the pack, not the pill.
- Spoken Yoruba and Hausa aren't supported by Meta's hosted speech model yet; written explanations are.
- Carton-video receiving is built but not yet tested on real footage. The evaluation harness on real packs hasn't been run yet, so we publish no accuracy numbers.

## Repository

```
backend/   Express API (Node 20, ESM): agents, rules, ledger, Meta wrappers, NAFDAC sandbox
web/       React + Vite app (mobile-first)
seed/      shops (fictional), NAFDAC alerts (sourced), products (sourced), DemoQuin assets
docs/      ARCHITECTURE, API_NOTES, NAFDAC_INTEGRATION, DECISIONS, PROGRESS
infra/     nginx config and deploy script for the hosted demo
```

## Sources

UNODC, *Trafficking in Medical Products in the Sahel* (Feb 2023), via [UN News](https://news.un.org/en/story/2023/02/1133062) · Beargie et al., [*The economic impact of substandard and falsified antimalarial medications in Nigeria*](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6695148/), PLOS ONE (2019) · NAFDAC public alerts 2026 as listed in `seed/alerts.json`.
