/**
 * HTTP client for a NAFDAC-style registry API (the contract in
 * docs/NAFDAC_INTEGRATION.md). The sandbox and a future real NAFDAC endpoint
 * use the same client with a different base URL.
 *
 * Only a positive answer counts: `not_found` needs an explicit
 * `not_registered` reply. Timeouts, network errors, unexpected status codes
 * and `outside_sandbox` all return `unavailable`, which never accuses (D27).
 */
const RETRY_ON = new Set([502, 503, 504]);

export function registryClient({ baseUrl, apiKey, timeoutMs = 4000, fetchImpl = (...a) => globalThis.fetch(...a) }) {
  const base = baseUrl.replace(/\/+$/, '');

  async function call(path, init = {}) {
    const headers = { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) };
    for (let attempt = 0; ; attempt++) {
      try {
        const res = await fetchImpl(base + path, { ...init, headers, signal: AbortSignal.timeout(timeoutMs) });
        if (RETRY_ON.has(res.status) && attempt === 0) continue;
        return { code: res.status, body: await res.json().catch(() => null) };
      } catch (err) {
        if (attempt === 0) continue;
        throw err;
      }
    }
  }

  return {
    /** @returns {Promise<{status:'found'|'not_found'|'unavailable', data?:object}>} */
    async registration(regNo) {
      try {
        const { code, body } = await call(`/registrations/${encodeURIComponent(regNo)}`);
        if (code === 200 && body?.status === 'registered') return { status: 'found', data: body.product };
        if (code === 404 && body?.status === 'not_registered') return { status: 'not_found' };
        return { status: 'unavailable' };
      } catch {
        return { status: 'unavailable' };
      }
    },

    async recordEvent(event) {
      const { code } = await call('/events', { method: 'POST', body: JSON.stringify(event) });
      if (code !== 201) throw new Error(`registry event rejected (${code})`);
    },
  };
}
