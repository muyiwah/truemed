# Progress

## Fri Oct 30 — done
**Backend** (`backend/`, Node 20 ESM, Express, Mongo)
- Rule engine: 17 checks (one file each) + scorer with the confirm step, ask-first provenance, gated detail, and D27–D29. 31 unit tests.
- GS1 parsing; zxing-wasm decoding; bwip-js DemoQuin labels — round trip tested, including a small label inside a larger photo.
- Agents written against the official docs (see `API_NOTES.md`): Inspector (Muse Spark extraction + SAM 3.1 barcode/label/date + tamper + artwork), Voice (shop matching, 4-language explanations, realtime transcription client), Sentinel (ingest → pending → approve → warn shops), Investigator (tool loop ≤ 8 steps, visible trail, case file + draft report).
- Ledger, scan sessions, receiving / home / carton flows, notifications, reconciliation, daily cost cap, ImageKit storage (private + signed URLs).
- Barcode-only fallback: if Meta AI is unreachable, a readable GS1 code still gets screened on hard facts.
- Judge samples: 4 rendered DemoQuin packs (genuine, relabeled expiry, container fake, diverted). AI read cached per sample; samples never write to the ledger.
- Seeds: 5 NAFDAC alerts verified against their sources (see corrections below), 7 fictional shops, DemoQuin + SMA Gold products.
- End-to-end run through the HTTP API (no AI key): genuine, open market, wrong shop, never issued, never dispatched, repeat check, clean receive, clone rejected + notification — all correct.

**Frontend** (`web/`, React + Vite + Tailwind + Framer Motion)
- Welcome (language, role, pharmacist PIN), Home, live-camera scan flow, dark analysis screen with streamed steps and model captions, confirm step, ask-first shop step (hold-to-talk, type, tap, market/street), result (verdict, SAM overlay, spoken explanation, language switch, evidence trail), Receive stock (single pack + carton video), Investigator case file with live reasoning trail, Notifications, Admin (Sentinel + health + DemoQuin), How it works, printable labels.

**Data corrections vs the original brief** (all now in `seed/alerts.json`)
- Herceptin: batch is `A8519B34` (mfg 2024-01, exp 2026-11); `C3809C51` is not in the cited article.
- Chloroquine (reg `04-8769`) alert is from Feb 2024, not 2026.
- SMA Gold: the cited article gives no alert number; batch `22939510A1206`.
- Dostinex 07/2026: the articles don't map expiry dates to batches, so expiries are left null.

## Sat Oct 31 — done
- **Network insights page** (`/insights`, public, totals only): AI accuracy from `eval/results.json`, what the network caught (live ledger), Meta calls/spend/timings per model. Each panel is labelled Live / Evaluation / Sample data; sample data (`backend/src/insights/placeholder.js`) shows until 20+ real scans and an eval run exist.
- Confirm screen now always shown for real photos (rule 2); front-photo preview bug fixed.
- Real scans saved locally to `backend/data/field/` (git-ignored) while ImageKit is unset, for the eval set.

- **Deployed (Oct 31):** API https://api.truemed.finessedev.space (VPS, PM2 `truemed-api`, port 4080, Nginx + Let's Encrypt; DB = `truemed` database/user in the VPS `mongodb` Docker container; ImageKit folder `/truemed`). Web https://truemed.finessedev.space (Vercel project `truemed`, deployed with the Vercel CLI, `VITE_API_URL` set at build). Redeploy: `infra/deploy.sh` (API), `cd web && npx vercel deploy --prod --build-env VITE_API_URL=https://api.truemed.finessedev.space/api` (web).

## Sat Oct 31 — NAFDAC registry layer
- NAFDAC has no developer API (findings + sources in `NAFDAC_INTEGRATION.md`).
- `backend/src/registry/` routes registration questions: DEMO-* → simulated NAFDAC sandbox; hand-copied Greenbook seed; real NAFDAC API when `NAFDAC_API_URL` is set; else the cached single Greenbook lookup. Only an explicit `not_registered` can fail `REG_NOT_FOUND`.
- Public sandbox at `/sandbox/nafdac/v1` (DemoQuin only, read-only from outside); Gate 1 DemoQuin receipts post custody events to it.
- New sample pack "Unregistered number" (DEMO-0099) → confirm step → High risk via the sandbox.

## Blocked on the founder
- `MODEL_API_KEY` → run Phase 0 spikes (Muse Spark, SAM image/box/video, Voice English + Pidgin).
- MongoDB Atlas URI (allowlist `75.119.132.248`).
- ImageKit keys.
- DNS at Hostinger: `A api.truemed → 75.119.132.248`; `CNAME truemed → cname.vercel-dns.com`.
- 5+ real pack photos in `seed/photos/`; Greenbook entries for 20–30 products.
- Native-speaker check of Yoruba/Hausa UI strings and disclaimers.

## Next
1. Spikes with the key; record results in `API_NOTES.md`; tune prompts on real photos.
2. Deploy: `infra/nginx-api.truemed.conf`, certbot, `infra/deploy.sh`; Vercel for `web/` with `VITE_API_URL`.
3. Eval harness (`npm run eval`) once real photos exist.

## Tue Nov 3 — Admin Videos section
- Control room (admin PIN) now has **Videos**: a demo-footage locker and saved carton scans.
- Footage uploads go browser → ImageKit directly (signed, single-use, 10 min), private, ≤ 100 MB per clip (ImageKit free plan video limit), so the VPS and its 30 MB nginx limit are never in the path. Watch, download, rename, delete.
- Carton scans now keep the H.264 copy SAM tracked, with the accept/review/reject summary and the annotated keyframe as poster. Saved in the background; never fails a scan.
