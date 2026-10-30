/**
 * API client. Every request carries the anonymous device id. Long operations
 * (scans, carton video, the Investigator) stream progress as server-sent events
 * over a POST, read here with fetch + a stream reader.
 */
const BASE = import.meta.env.VITE_API_URL || '/api';

const safeGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const safeSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } };

let memoryId = null;
export function deviceId() {
  let id = safeGet('tm.device') || memoryId;
  if (!id) {
    id = (crypto.randomUUID?.() ?? `d-${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/[^a-zA-Z0-9-]/g, '');
    safeSet('tm.device', id);
    memoryId = id;
  }
  return id;
}

export class ApiError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

const headers = (extra = {}) => {
  const h = { 'X-Device-Id': deviceId(), ...extra };
  const admin = safeGet('tm.adminPin');
  if (admin) h['X-Admin-Pin'] = admin;
  return h;
};

async function parse(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || 'Something went wrong. Please try again.', res.status);
  return data;
}

export const get = (path) => fetch(BASE + path, { headers: headers() }).then(parse);
export const post = (path, json) => fetch(BASE + path, { method: 'POST', headers: headers({ 'Content-Type': 'application/json' }), body: JSON.stringify(json ?? {}) }).then(parse);
export const postForm = (path, form) => fetch(BASE + path, { method: 'POST', headers: headers(), body: form }).then(parse);

/**
 * POST with live progress. `onStep` receives each step event; resolves with the final payload.
 * @param {string} path
 * @param {FormData|object} body
 * @param {(step: object) => void} onStep
 */
export async function stream(path, body, onStep) {
  const isForm = body instanceof FormData;
  const res = await fetch(`${BASE}${path}${path.includes('?') ? '&' : '?'}stream=1`, {
    method: 'POST',
    headers: headers(isForm ? {} : { 'Content-Type': 'application/json' }),
    body: isForm ? body : JSON.stringify(body ?? {}),
  });
  if (!res.ok || !res.body) return parse(res);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let final = null;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const chunk = buf.slice(0, i);
      buf = buf.slice(i + 2);
      const event = /^event: (.*)$/m.exec(chunk)?.[1];
      const data = /^data: (.*)$/m.exec(chunk)?.[1];
      if (!data) continue;
      const payload = JSON.parse(data);
      if (event === 'step') onStep?.(payload);
      else if (event === 'done') final = payload;
      else if (event === 'error') throw new ApiError(payload.error, 500);
    }
  }
  if (!final) throw new ApiError('The connection dropped. Please try again.', 0);
  return final;
}

export { safeGet, safeSet };
