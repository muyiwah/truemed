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
