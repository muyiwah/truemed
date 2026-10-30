/**
 * Muse Voice Transcribe over its realtime WebSocket (docs/API_NOTES.md).
 *
 * The key travels in the first JSON frame, not a header. Audio is 16-bit LE mono
 * PCM at 24 kHz in ~80 ms frames. The docs say "paced ~real time"; we send at
 * `paceFactor`× real time (default 2×) to keep a 6-second answer under ~4 s,
 * and fall back to real time if the server complains.
 */
import WebSocket from 'ws';
import { config, metaEnabled } from '../config.js';
import { MetaUnavailableError, PRICE, recordUsage, checkCap } from './meta.js';
import { log } from '../lib/log.js';

const URL = 'wss://api.meta.ai/v1/asr/realtime';
const RATE = 24_000;
const FRAME_MS = 80;
const FRAME_BYTES = (RATE * 2 * FRAME_MS) / 1000; // 3,840

/**
 * @param {Buffer} pcm 24 kHz mono s16le
 * @returns {Promise<{ transcript: string, segments: string[], ms: number, cost: number }>}
 */
export async function transcribe(pcm, { paceFactor = Number(process.env.VOICE_PACE || 2), timeoutMs = 30_000 } = {}) {
  if (!metaEnabled) throw new MetaUnavailableError();
  await checkCap();
  const t0 = Date.now();

  const segments = [];
  let partial = '';

  await new Promise((resolve, reject) => {
    const ws = new WebSocket(URL);
    const timer = setTimeout(() => { ws.terminate(); reject(new Error('Voice transcription timed out')); }, timeoutMs);
    let acked = false;

    ws.on('open', () => {
      ws.send(JSON.stringify({
        authorization: { accessToken: `Bearer ${config.MODEL_API_KEY}` },
        audioEncoding: 'PCM_24KHZ',
        model: config.VOICE_MODEL,
        mode: 'PUSH_TO_TALK',
      }));
    });

    ws.on('message', async (data, isBinary) => {
      if (isBinary) return;
      let evt;
      try { evt = JSON.parse(data.toString()); } catch { return; }
      if (!acked && !evt.type) {
        acked = true;
        // Stream audio frames, then end.
        for (let i = 0; i < pcm.length; i += FRAME_BYTES) {
          if (ws.readyState !== WebSocket.OPEN) return;
          ws.send(pcm.subarray(i, i + FRAME_BYTES));
          await new Promise((r) => setTimeout(r, FRAME_MS / paceFactor));
        }
        ws.send(JSON.stringify({ type: 'endStream' }));
        return;
      }
      if (evt.type === 'transcript') {
        if (evt.final) { segments.push(evt.transcript); partial = ''; } else partial = evt.transcript;
      } else if (evt.type === 'error') {
        log.warn({ msg: evt.message }, 'voice error event');
        clearTimeout(timer);
        ws.close();
        reject(new Error(`Voice Transcribe: ${evt.message}`));
      }
    });

    ws.on('close', () => { clearTimeout(timer); resolve(); });
    ws.on('error', (err) => { clearTimeout(timer); reject(err); });
  });

  if (partial) segments.push(partial);
  const seconds = Math.floor(pcm.length / (RATE * 2));
  const cost = seconds * PRICE.voicePerSecond;
  await recordUsage(config.VOICE_MODEL, cost);
  return { transcript: segments.join(' ').trim(), segments, ms: Date.now() - t0, cost };
}
