# Meta API notes

What the official docs at dev.meta.ai say, read on **Oct 30, 2026**, plus what live spikes confirmed. "Docs" = read from the page; "Spike" = observed with a real key (pending until `MODEL_API_KEY` is set).

## Common
- Base URL `https://api.meta.ai/v1`, `Authorization: Bearer $MODEL_API_KEY`. OpenAI-SDK compatible; pass `apiKey` + `baseURL` explicitly. (Docs: overview)
- We use the **Responses API** (`client.responses.create`) for every Muse Spark call: it is the only surface that supports images, structured output, tools **and** web search together.

## Muse Spark `muse-spark-1.3`
- **Images** (Docs: image-understanding): in a `user` message, `{ "type": "input_image", "image_url": "<https URL or data:image/jpeg;base64,...>" }`. JPEG/PNG/GIF/WEBP. ≤ 50 MB inline, ≤ 50 images per request. No `detail` param. Undecodable image → 400.
- **Bounding boxes** (Docs): prompt-driven "perception grounding"; coordinates on a **normalized 0–1000 grid**, origin top-left, relative to the image as sent. Pixel = n × dim / 1000; clamp (values can be 1001). → `dateRegionBox` is requested in 0–1000 and converted before SAM.
- **Structured output** (Docs: structured-output): Responses API uses `text: { format: { type: "json_schema", name, schema, strict } }` (not `response_format`). Output is always constrained to the schema. With `strict: true`: root plain object, every object `additionalProperties: false`, `required` lists all props, no `allOf`/`oneOf` (`anyOf` OK below root). Nullable = `type: ["string","null"]`. No recursive schemas.
- **Tools** (Docs: tool-calling): Responses tools are flat `{ type: "function", name, description, parameters }`. `tool_choice` only `"auto"`. Calls arrive as `function_call` items in `output` (`name`, `arguments`, `call_id`). Return results as `{ type: "function_call_output", call_id, output }` with `previous_response_id`. Parallel calls on by default.
- **Web search** (Docs: search-grounding): Responses API only, `tools: [{ type: "web_search" }]`; optional `search_context_size`, `user_location`; citations as `url_citation` annotations. $2.50 / 1k queries.
- **Price** (Docs): input $1.25 / 1M, cached $0.15 / 1M, output $4.25 / 1M. 3,000 RPM, 4M TPM.

## SAM 3.1 `sam-3.1`
- `POST /v1/responses`, one user message: `input_text` (noun phrase **or** box/point tokens, never both) + `input_image { image_url }` or `input_video { video_url | file_id }`. Base64 data URLs work for both. (Docs: sam/segmenting)
- `stream: true` recommended; parse with `@meta-sam/parser` (`parseImageStream` / `parseVideoStream`) fed straight from the OpenAI SDK stream. The live API finalises the text lane with `response.content_part.done` (parser handles it).
- `metadata` (string values): `include_confidence: "true"`, `mask_encoding: "lossless"|"one_bit"`, `propagation_direction: "both"|"forward"|"backward"`.
- Box prompt tokens: `<0f>1<|box;x1=..;y1=..;x2=..;y2=..;w=W;h=H|>` — build with `buildObjectPrompt`. `w`/`h` **must equal the media's pixel size** or 400.
- Video: **MP4/MOV with H.264/H.265/MPEG-4 only — WebM/VP9 rejected.** Browser recordings (webm) must be transcoded with ffmpeg to H.264 MP4 + `-movflags +faststart`. ≤ 15,000 frames. Tracks ≤ 16 objects/frame. Reusable clips: `POST /v1/files` with `purpose: user_data` → `file_id`.
- Zero matches = empty completed response, not an error.
- Price: $2.50 / 1k images; $0.20 / 1k video frames, min 50 frames per request. 3,000 RPM.

## Muse Voice Transcribe `muse-voice-transcribe-1.0`
- `wss://api.meta.ai/v1/asr/realtime`. **Does not read the Authorization header** — first text frame (within 10 s) is the handshake:
  `{ "authorization": { "accessToken": "Bearer <key>" }, "audioEncoding": "PCM_24KHZ", "model": "muse-voice-transcribe-1.0", "mode": "PUSH_TO_TALK" }`
- Ack has no `type`, includes `sessionId`. Then send binary frames of 16-bit LE mono PCM, ~80 ms each (3,840 bytes at 24 kHz), paced ~real time. End with `{ "type": "endStream" }` and read until close code 1000.
- Events: `{ type: "transcript", transcript, final }`, `{ type: "error", message }`.
- No language parameter documented. 25 validated languages incl. English; not Yoruba/Hausa/Pidgin. $0.18/hour. 256 concurrent streams.
- We convert browser webm/opus → 24 kHz mono s16le with ffmpeg.

## Spike results (live, Oct 30 — `backend/spikes/phase0.js`, `effort.js`, `samPhrases.js`, `agentsLive.js`)
| Test | Result |
|---|---|
| Muse Spark image → schema JSON | ✔ All fields correct on the tampered DemoQuin sample (incl. sticker dates), confidences 0.95–0.99, `dateRegionBox` accurate. **12.4 s with default reasoning → 4–5 s with `reasoning: { effort: 'low' | 'minimal' }`**, same fields, half the cost (~$0.006). |
| `reasoning.effort` | Responses API: `reasoning: { effort }`; values `minimal`…`max`; `none` → 400 on Muse Spark (docs: /docs/reasoning). We use `low` for reading/tamper/artwork/agents, `minimal` for explanations and shop matching. |
| SAM phrase "barcode" on a DataMatrix | ✘ 0 matches. **"qr code" finds it (c=0.91).** "barcode" kept for linear EAN codes. Also 0 for "box", "package", "carton", "medicine box", "2d code" on the flat mock; **"card" finds the pack (0.89), "label" (0.62).** |
| SAM box record shape | **Box records carry `left/top/right/bottom` directly; only mask records have `bounds`.** Mask rasters can be smaller than their box (1024×660 for a 1139×734 box) → scale the SVG path to the bounds. |
| SAM box prompt on date region | ✔ 1 object + mask, 1.3–3.6 s. |
| SAM video (H.264 MP4 data URL, 60 frames) | ✔ phrase "card": 3 objects tracked through 145 records, $0.012. Carton flow tries "box" → "card" → "package". |
| Voice: English (macOS TTS) | ✔ "I boarded from Ikeja Care Pharmacy, near the roundabout.." (~5 s at 2× pacing). |
| Voice: Pidgin (macOS TTS) | ~ "I buy them for the chemist way day Ojo Junction, Namama busy day" — rough as expected; Muse Spark matching handles it. Retest with a real Nigerian voice. |
| Stored responses (`previous_response_id`) | ✘ Intermittent 400 "referenced response not found or expired". **Investigator resends the full history each turn instead.** |
| Sentinel parse (pasted Dostinex text) | ✔ alert 07/2026, 3 batches, expiries null (not stated), 5 s. |
| Investigator end to end | ✔ 6 tool calls, case file + draft report, ~22 s, streamed live. |
| Carton end to end | ✔ 3 packs: clone rejected, never-issued rejected, expired (barcode) rejected, ~18 s. |
| Full home scan, live | ✔ ~12 s photo → result incl. shop answer; explanation streams in ~2 s later. |
| zxing decodes bwip-js GS1 DataMatrix | ✔ backend tests |
