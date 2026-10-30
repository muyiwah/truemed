# TrueMed — Decisions Log and Deliberation History

> Put this at `docs/DECISIONS.md`. It records everything the founder (me) and Claude discussed while designing TrueMed on Oct 29–30, 2026: what we chose, what we dropped, why, what we know cannot work, and what is still open. **Read it before proposing changes.** If you want to reverse a decision, name its ID (e.g. "D07"), explain what new information changes it, and ask me first. When we make a new decision, add it here.

Companion files: `CLAUDE.md` (the build guide: rules, stack, APIs, checks, plan) and `docs/BRIEF.md` (the pitch and build brief: evidence, demo script, judge Q&A).

---

## 1. Context

**The founder:** a mobile and full-stack developer in Lagos (Flutter, Node.js, Python, React), previously built an EMR, with a company that can fund social and mainstream media awareness campaigns. Working solo; can complete development in about 3 days once scope is fixed.

**The event:** Meta Global AI Developer Hackathon (Meta + Cerebral Valley), virtual, Oct 26 – Nov 4, 2026.
- Deadline: Wed Nov 4, 9 PM EST = 3 AM Thu Nov 5 Lagos. We submit Wednesday afternoon.
- Two tracks: **Indie** (individuals/students, teams up to 4; judged on creativity, technical ambition, whether it works) and **Startup**. Indie prize pool $400k: $150k, $100k, $75k, $50k, $25k; plus bonus prizes (e.g. community vote, most viral).
- Themes: "Build for Your World" or "Push the Frontier". We fit **Build for Your World**. Meta's brief asks for "a problem you know firsthand."
- **Judging weights: Impact 30%, Use of Meta AI tooling 25%, Demo (incl. video) 25%, Technical depth 20%.**
- Tools: Meta Model API (Muse Spark, Muse Image, SAM 3.1, Muse Voice Transcribe), Muse Code, Meta open-weights models. $150 API credit per participant (claimed).
- Up to 20,000 accepted builders.

---

## 2. How the idea evolved (chronological)

1. **Brainstorm (Oct 29).** Rated ~11 ideas against the rubric. Top two: an AI ad studio for small traders (best demo, most feasible) and a fake drug checker (highest impact). Others: crop disease doctor, rental inspector, car damage assessor, screenshot-to-Flutter, blind-user assistant, civic reporter, paperwork copilot, lecture/CBT companion, football analyst.
2. **Chose the fake drug checker** for its emotional, life-saving connection — the founder's call, which Claude agreed with, adding that credibility, not emotion, would decide the win.
3. **Discovered the space is not empty.** NAFDAC already runs MAS scratch codes (since 2010, five providers), the Greenbook registry, 2024 GS1 traceability regulations, and the Scan2Verify app. The founder's original concept (manufacturers register; we issue unique QR codes; buyers scan) would look unaware of the market and compete with a government mandate. **Pivot:** be the AI layer on top of existing systems, not another code system.
4. **Integrated the founder's earlier platform brief** (a separate chat on a Nigerian product-authentication platform: split serial + hidden PIN, chain of custody, graded results, WhatsApp bot, brand dashboard, rollout plan). Took: graded results ("not registered ≠ fake"), serial duplicate and location checks, chain of custody, verified-retailer idea. Deferred: physical labels, scratch PINs, manufacturer onboarding, WhatsApp, business model.
5. **Scope warning.** The plan had grown (all products, custody, two agents, WhatsApp, voice, Stock Guard). Claude warned that over-scoping was the biggest risk and locked a core with three wow moments.
6. **Founder acted as first judge; holes found and fixed:** location dependence, first-scan-wins, innocent rescans, pharmacist incentive, real products vs fictional brand, "No red flags" overpromising, AI false alarms, photocopies, rogue pharmacies. Main fix: **shop binding** — the system checks whether a pack is where it should be.
7. **Second judge pass found more:** AI misreads creating false High risk, batch-only packs, the leading question, counterfeiters probing the app. Fixes: confirm step, honest coverage, ask-first, gated evidence detail.
8. **Pharmacist interview (founder, Oct 29).** Pharmacists buy from manufacturers' authorized suppliers **and** go to the open market for products they can't get directly. Research confirmed open markets (Idumota, Onitsha Bridge Head, Aba, Kano) are major distribution hubs and a major fake source. **Refactor:** the pharmacist becomes the main user; custody starts at pharmacy receiving; every pack is tagged authorized or open market; clones are caught at receiving.
9. **Licensed chemists added** (PPMVs — licensed small sellers, often run by nurses; an estimated ~100,000 vs ~4,500 pharmacies). Street sellers are exposed through buyer answers. Anyone can scan at home regardless of source.
10. **Broadened beyond medicine in framing only.** NAFDAC says cosmetics, food and beverages are over half of seizures (fake Coca-Cola, Peak Milk, "Coglaet" toothpaste, tampered Cerelac). Decision: pitch "any NAFDAC-regulated product," demo ~80% medicine plus one consumer product.
11. **Nigeria-specific threat check:** cartels, container imports, relabeled expiry dates. Added the shelf-life plausibility check and the "serial never issued" demo; accepted honest limits.
12. **Meta AI emphasis.** Concern that custody logic is plain database work, not Meta AI. Reframed as **four Meta AI agents + one ledger**: the ledger knows where every pack should be; Meta AI checks whether it really is, from a single photo.
13. **Alternatives reconsidered** (first-aid copilot, CrackWatch building safety, maternal danger-sign companion). None clearly beat TrueMed once risk was counted. **Stayed with TrueMed.**
14. **API verification (Oct 30).** Official docs confirmed SAM 3.1 supports text prompts and video tracking; model id is `sam-3.1`. Muse Voice Transcribe does not cover Yoruba, Hausa or Pidgin. Carton video promoted into the build; voice plan adjusted.
15. **Greenbook:** no public API. Manual seeding + optional single cached lookup + a formal data request to NAFDAC.
16. **Stack fixed:** Flutter web, Node.js (JavaScript), MongoDB.
17. **Build kickoff with Claude Code (Oct 30).** Reframed as a hackathon entry built to wow judges, not a production launch. Frontend switched to React + Vite (D30), hybrid design (D31), ImageKit for media (D32), VPS + Vercel hosting (D33). Three rules tightened so AI or missing data can't produce a false High risk (D27–D29). Note: `docs/BRIEF.md` is referenced but was not in the folder.

---

## 3. Decision register

| ID | Decision | Why | Rejected alternatives |
|---|---|---|---|
| D01 | Build TrueMed (fake medicine/product safety) | Highest impact; firsthand problem; founder's motivation; fits Meta's past winner patterns (health, public impact, local language, detection) | Ad Studio (weaker impact story, crowded); first-aid copilot (AI emergency guidance risk, real-time voice difficulty); CrackWatch (structural credibility, depended on unconfirmed SAM video at the time); maternal companion (weaker Meta-tool and demo scores) |
| D02 | Indie track | Solo builder; judged on creativity, ambition, whether it works | Startup track (judged on production readiness) |
| D03 | Web app is the primary judge experience; Flutter web | Judges need one-click access; TestFlight is iOS-only and needs review; APK sideloading has friction; founder is strongest in Flutter; same code becomes mobile apps later | TestFlight/APK as primary; React (only advantage was Meta's React SAM overlay packages — unnecessary since the backend renders overlays) |
| D04 | Be the AI layer on top of NAFDAC systems, not a new code system | MAS, Greenbook, GS1 rules and Scan2Verify already exist; a new QR system competes with a government mandate and looks uninformed | Own QR codes/labels per unit (founder's original concept) |
| D05 | Four Meta AI agents + one ledger | Maximises the 25% Meta-tooling score with essential (not decorative) AI; keeps verdicts honest | AI-only verdicts; ledger-only traceability product |
| D06 | Hard facts decide High risk; AI alone reaches Caution at most | Prevents hallucinated accusations; makes verdicts defensible | AI decides verdicts |
| D07 | Confirm step before High risk on AI-read text | A misread batch/expiry would falsely accuse a genuine pack | Trusting extraction blindly |
| D08 | Shop binding with **ask-first** ("Where did you buy this?" before revealing) | Catches copied codes on the first scan without GPS; asking first prevents coached answers and protects pharmacy supply data | Location-only checks; revealing the registered shop and asking yes/no |
| D09 | Custody starts at pharmacy/chemist receiving; source tagged authorized or open market | Matches how Nigerian pharmacists actually buy (interview); works with real products from day one without manufacturers | Custody from the factory only |
| D10 | Pharmacists and licensed chemists are the primary users; buyers secondary | They buy in bulk, carry the risk, and NAFDAC's 2024 rules require electronic traceability records — a regulation-backed incentive | Consumer-first app |
| D11 | Include licensed chemists (PPMVs) as a seller type | They are where most Nigerians outside cities buy medicine | Pharmacies only |
| D12 | Street sellers are exposed, not onboarded | Unlicensed sellers can't be participants; buyer answers + hotspot data still surface them | Trying to onboard hawkers |
| D13 | Graded results with honest wording; "No record" never means fake | Protects genuine products; builds trust with judges | Binary genuine/fake |
| D14 | Gate evidence detail (full maps only for verified pharmacists) | Stops counterfeiters using the app to perfect fakes | Full transparency to everyone |
| D15 | Shelf-life plausibility as a hard check | Directly targets expiry relabeling ("revalidation"), a common Nigerian trick | Relying on AI tamper detection alone |
| D16 | DemoQuin fictional brand for the supply-chain demo, incl. "serial never issued" | Shows the full chain and the container-fake catch without touching real brands | Mocking up real brands (legal/ethical risk) |
| D17 | Fictional names for all demo shops/suppliers | Avoids implicating real businesses (an early script wrongly used a real chain's name) | Real pharmacy names |
| D18 | Frame as "any NAFDAC-regulated product"; demo ~80% medicine + one consumer product | NAFDAC data shows cosmetics/food are over half of seizures; keeps focus | Medicine only; or "checks everything" (scattered pitch) |
| D19 | Carton receiving by video is in the build (Sunday) | SAM 3.1 video tracking confirmed on the hosted API; strongest "Push the Frontier" moment | Shelf-scan video (text unreadable at shelf distance — rejected as unrealistic) |
| D20 | Voice: English + Pidgin end to end; Yoruba/Hausa as text; Yoruba/Hausa audio is a stretch | Voice Transcribe lacks Nigerian languages; Pidgin is English-based; Meta's open MMS/Omnilingual models are unverified in quality | Promising full Yoruba/Hausa voice |
| D21 | Greenbook: manual seed + optional single cached live lookup + formal NAFDAC data request | No public API; bulk scraping a government site is risky and could get us blocked during judging | Bulk scraping the hidden endpoint; third-party datasets as truth |
| D22 | Stack: Flutter web, Node.js **JavaScript (ESM)**, Express, MongoDB Atlas + Mongoose, GridFS | Founder's preference and speed | TypeScript, Fastify, Postgres/Supabase (earlier drafts) |
| D23 | Investigator agent with tools and a visible reasoning trail | Shows agentic depth; cheap to build over existing data | A single summarisation call |
| D24 | Sentinel agent ingests NAFDAC alerts with human approval | Makes alert checks live; approval prevents bad data | Hand-typed alerts only |
| D25 | Lead the demo with AI moments; ledger plays a supporting role | Keeps the 25% tooling and 25% demo scores high | Feature tour of custody logic |
| D26 | Submit Wednesday afternoon; code freeze Tuesday night; Wednesday reserved for video/submission | The video decides more than extra features | Building until the deadline |
| D27 | `REG_NOT_FOUND` is High only when the live NAFDAC lookup positively returns "not found"; otherwise skipped → **No record** (Oct 30) | Seed data covers only 20–30 products; "not in our list" would flag genuine packs and break the zero-false-High target | Treating absence from seed data as a hard fail |
| D28 | AI-matched shop answers must be confirmed by the user before `WRONG_SHOP` can be High; unconfirmed → Caution (Oct 30) | Shop matching from speech/free text is an AI judgment; D06 forbids AI alone reaching High | Trusting the Muse Spark match |
| D29 | `ALREADY_SOLD_ELSEWHERE` is `skipped` without location consent (Oct 30) | Unreadable/unavailable input is never a pass | Silently passing |
| D30 | **Supersedes D03.** Frontend is React + Vite (JS), Tailwind, Framer Motion, React Router, TanStack Query (Oct 30) | Project is a hackathon entry, not a production launch, so Flutter's mobile reuse matters less. Instant load, crisp selectable text, and a live `getUserMedia` camera viewfinder for the wow factor. Founder knows React. Next.js not needed: Express is the backend and every screen is client-side | Flutter web (heavy first load, weak web camera, canvas text); Next.js (extra concepts with no benefit here) |
| D31 | Hybrid visual design: light consumer screens, dark "analysis" mode during AI work and on evidence/case-file screens (Oct 30) | Friendly and credible for users; dramatic on video | All-light clinical; all-dark forensic |
| D32 | **Supersedes GridFS in D22.** Media stored in ImageKit; Mongo keeps file references only. Uploads hit the backend first, are analysed in memory, then pushed to ImageKit; user media private via signed URLs (Oct 30) | Founder already uses ImageKit (Lumiere); CDN delivery and transforms; keeps the DB small | GridFS; direct phone-to-ImageKit upload (backend would have to download every scan again) |
| D33 | **Supersedes Render/Railway hosting.** Backend on the founder's VPS (Node + PM2 + Nginx + HTTPS), DB on MongoDB Atlas, frontend on Vercel (Oct 30) | Always-on box the founder already runs; no cold starts | Render/Railway |

---

## 4. Dropped or deferred — and why

| Item | Status | Reason |
|---|---|---|
| WhatsApp channel | Deferred (roadmap) | Founder can't do it now; judges also can't message a test number |
| Muse Image | Dropped | No real job in this product; forced integrations hurt credibility |
| Own unit QR codes / labels | Dropped for hackathon | Competes with NAFDAC's GS1 mandate and MAS providers |
| Hidden scratch PIN labels | Roadmap | Physical labels and printers take months; answers first-scan-wins later |
| Manufacturer onboarding portal (real brands) | Roadmap | Needs brand partnerships; DemoQuin simulates it |
| Brand issued-serial lists / NAFDAC TIS integration | Roadmap (top priority) | The decisive fix for perfect copies with invented serials |
| Point-of-sale activation | Roadmap | Needs shop workflow changes |
| Tamper-evident append-only audit log, weighted reporting | Roadmap | Real security work; costs build time without earning points (scanEvents is append-only by convention for now) |
| Brand dashboard / business model | Roadmap slide | Not judged in the indie track |
| Hotspot map | Optional, last to build | Nice visual, low scoring value |
| Shelf-scan video ("film a whole shelf") | Rejected | Text on packs is unreadable at shelf distance — would fail on real use |
| Football analyst, rental inspector, etc. | Rejected ideas | Lower impact or too risky to finish solo |
| Medical diagnosis features | Rejected | Accuracy and liability; judges distrust them |
| Ad Studio | Rejected | Lower impact; crowded space |

---

## 5. Known limits — things that cannot work (and how we speak about them)

1. **Perfect copies with invented serials** pass until brands share the serials they actually issued. Say so; show the fix with DemoQuin.
2. **Batch-only packs** (no unit serial) can't get unit-level shop binding; mismatches are Caution signals only.
3. **Buyers who never scan**, especially from hawkers, aren't protected at the sale; Gate 1 protects them upstream.
4. **A verified seller cheating carefully** is caught by reconciliation over days, not instantly.
5. **Contents** (substandard drugs in genuine-looking packs) need a lab.
6. **Methanol / adulterated drinks** can't be detected from a photo (e.g. the Sept 2026 Ondo "Monkey Tail" deaths came from an unbranded local brew).
7. **Unbranded products** have no label to check.
8. **Professionally reprinted packs with no barcode** may pass the AI tamper check.
9. **Clone detection grows with adoption**; one shop alone gets checks and recall alerts, not network effects.
10. **Physical safety of whistle-blowers** is beyond an app; reports go privately to NAFDAC.
11. **Yoruba/Hausa speech quality** from Meta's open models is unverified (Meta AI quoted ~50% word error for Yoruba speech recognition — treat as unconfirmed).

---

## 6. What we brought in (final feature set)

- Inspector: quality gate, Muse Spark extraction, SAM 3.1 regions and evidence masks, GS1 decode, artwork/tamper/lookalike checks, confirm step.
- Rule engine: all hard checks incl. registry, product match, alert match, expiry, shelf-life plausibility, GS1 validity, barcode vs print, clone, wrong shop, already sold, never issued; soft checks capped at Caution.
- Ledger: shops (pharmacies, licensed chemists), packs with source tags, append-only scan events, reconciliation.
- Gate 1 receiving (single pack + carton video) and Gate 2 home scan.
- Voice agent: ask-first, spoken answers (English/Pidgin), explanations in en/pcm/yo/ha.
- Sentinel and Investigator agents.
- DemoQuin chain: issue, labels (GS1 DataMatrix), dispatch, demo scenarios.
- Eval harness with published numbers; judge sample packs; always-on deploy.

---

## 7. Wording rules (do not change without asking)

- Never "fake" without evidence. "No record" → "This does not mean it's fake."
- Best result: "No problems found in N checks." Always: "This is a screening tool, not a lab test. Confirm with a pharmacist."
- No dosing, treatment, or "safe to take" language.
- Provenance lines, e.g. "Received by Ikeja Care Pharmacy (demo) from the open market, checked on arrival."

---

## 8. Demo essentials

**One pack's story**, four AI-led moments, under 3 minutes:
1. Gate 1: SAM outlines a tampered date — "The barcode says 2025, the box says 2028."
2. The clone ("already received by a pharmacy in Kano") and the container fake ("serial never issued").
3. The kitchen-table home scan with a Pidgin answer and a spoken result.
4. The Sentinel warning shops + the Investigator's case file in seconds.

Rules: name each Meta model on screen; real pharmacy and home footage (a pharmacist has agreed to appear); show accuracy numbers; state the main limit before judges ask; open with a universal fact (WHO: about 1 in 10 medical products in low- and middle-income countries is substandard or falsified) before going local.

---

## 9. Competitive landscape and past winners

- **Existing Nigerian systems:** NAFDAC MAS (PharmaSecure, Sproxil, Savanté, UBQ-t/Kezzler, M-Pedigree), Greenbook, Scan2Verify/Traceability Information System, 2024 GS1 traceability regulations. TrueMed complements them.
- **Radease (Lagos):** won a 2025 Meta Llama Impact Grant for WhatsApp AI tools helping patent-medicine vendors access safe medicines (a B2B supply marketplace). Proves Meta cares about this space; TrueMed differs by *detecting* fakes with evidence.
- **MIT Solve entry (Nigeria):** a WhatsApp chatbot that flags unauthorized/expired/banned drugs. A plain "is it registered?" bot is not novel — our edge is reading the whole pack and binding it to a shop.
- **Past winner patterns:** Guardian (NHS triage, London 1st) — AI as a professional's second pair of eyes; CurePharma AI (India 1st) — medication info in regional languages; Dawa (NYU Abu Dhabi 1st, 2018) — supply-chain anti-counterfeit that led with the hot tech of its day; Hypercube (Mason/Amazon 1st) — connected consumers and authorities; PharmaGuard-AI (RIFT 2026 1st) — judges cited architecture, execution, deployment feasibility. No anti-counterfeit winner found at a Meta hackathon itself.

---

## 10. Verified API facts (Oct 30)

- Base URL `https://api.meta.ai/v1`, Bearer key; OpenAI SDK needs the key passed explicitly.
- Muse Spark `muse-spark-1.3`: vision, tool calling, web search, 1M context.
- SAM 3.1 `sam-3.1` via `POST /v1/responses`: noun phrase **or** box/point prompts (not both); video tracking; streaming recommended; special-token output decoded with `@meta-sam/parser`; zero matches is valid; $2.50/1k images, $0.20/1k frames, min 50 frames per video request.
- Muse Voice Transcribe `muse-voice-transcribe-1.0`: realtime WebSocket, 16/24 kHz audio, 25 validated languages incl. English, not Yoruba/Hausa/Pidgin.

---

## 11. Open questions (update as resolved)

- [ ] Does Pidgin transcribe acceptably on Voice Transcribe in English mode? (test Friday)
- [ ] Discord submission rules: public repo? video length? (check before Tuesday)
- [ ] Yoruba/Hausa audio via MMS-TTS on Modal: worth it? (decide Monday)
- [x] SAM 3.1 text prompts + video on the API — confirmed
- [x] Greenbook access — no public API; manual seed + optional single lookup + formal request
- [x] Pharmacist on camera — agreed

---

## 12. Scores and odds snapshot (Claude's estimates, not data)

- Rubric score ≈ 8.6/10 (Impact 9, Meta AI 8.5, Demo 8.5, Tech 8).
- With excellent execution: ~20–30% to reach the final shortlist; ~6–12% to win an indie cash prize; ~2–4% for first; ~10–15% for a community/viral bonus prize if the founder's audience is mobilised within the rules.
- Biggest risks: execution in 3 days, other fake-drug entries, real-pack accuracy, judges' unknown taste.

---

## 13. Key sources

- Judging and prizes: aimagazine.blog (Meta hackathon article); madrobot.blog (prize split); cerebralvalley.ai event page
- Meta docs: dev.meta.ai/docs (overview, models, sam/overview, sam/segmenting, sam/reading-segmentation, pricing-rate-limits); Pipecat Meta STT docs
- NAFDAC systems: nafdac.gov.ng (MAS; traceability); allafrica.com (Greenbook, Nov 2025); GS1 Nigeria (2024 regulations)
- Open markets: businessday.ng; guardian.ng (PCN); arise.tv; nairametrics.com
- Cases: Herceptin, chloroquine (nairametrics); Dostinex (vanguardngr); SMA Gold (allafrica); "Coglaet" (guardian.ng); Cerelac (mondaq); fake beverages in Aba (thefrontierng, guardian.ng); methanol deaths (AFP/citizen.digital)
- Scale: WHO via news-medical.net; PPMV estimate via solve.mit.edu
- Competitors/grants: iafrica.com and dealroom.co (Radease); ai.meta.com (LlamaCon and India hackathon winners); about.fb.com (London Llama Impact Hackathon)
