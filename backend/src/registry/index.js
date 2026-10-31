/**
 * Registry: "is this NAFDAC number registered?", routed to whichever source
 * can answer it honestly.
 *
 *   DEMO-* numbers      → NAFDAC sandbox (simulated, DemoQuin only)
 *   matches our seed    → hand-copied Greenbook record (sourceUrl per record)
 *   anything else       → real NAFDAC API if connected (NAFDAC_API_URL),
 *                         else the single cached Greenbook lookup (rule 11)
 *
 * Demo numbers never go to a real NAFDAC source, and the sandbox never answers
 * for a real number.
 */
import { config } from '../config.js';
import { Shop } from '../db/models/index.js';
import { normRegNo } from '../rules/util.js';
import { lookupRegNo } from '../services/greenbook.js';
import { isSandboxRegNo } from '../sandbox/nafdac.js';
import { DEMO_GTIN } from '../demo/demoquin.js';
import { registryClient } from './client.js';
import { log } from '../lib/log.js';

export const SANDBOX_PATH = '/sandbox/nafdac/v1';
export const SANDBOX_LABEL = 'NAFDAC sandbox, simulated';

const sandbox = config.NAFDAC_SANDBOX === 'on'
  ? registryClient({ baseUrl: config.NAFDAC_SANDBOX_URL ?? `http://127.0.0.1:${config.PORT}${SANDBOX_PATH}` })
  : null;
const nafdacApi = config.NAFDAC_API_URL ? registryClient({ baseUrl: config.NAFDAC_API_URL, apiKey: config.NAFDAC_API_KEY, timeoutMs: 6000 }) : null;

const publicSandboxUrl = (path) => (config.PUBLIC_API_URL ? `${config.PUBLIC_API_URL.replace(/\/+$/, '')}${SANDBOX_PATH}${path}` : null);

export function registryStatus() {
  return {
    sandbox: sandbox ? 'on' : 'off',
    nafdacApi: nafdacApi ? 'connected' : 'not_connected',
    greenbookLookup: config.GREENBOOK_LOOKUP,
  };
}

/**
 * @param {{ regNo:string|null, product?:object|null }} q  product = what our seed matched (by reg no. or GTIN)
 * @returns {Promise<{ status:'found'|'not_found'|'unavailable'|'not_attempted', provider?:string, label?:string, sourceUrl?:string|null, simulated?:boolean, data?:object }>}
 */
export async function checkRegistration({ regNo, product = null }) {
  const r = normRegNo(regNo);
  if (!r) return { status: 'not_attempted' };

  if (isSandboxRegNo(r)) {
    if (sandbox) {
      const res = await sandbox.registration(r);
      if (res.status !== 'unavailable') {
        return { ...res, provider: 'sandbox', label: SANDBOX_LABEL, simulated: true, sourceUrl: publicSandboxUrl(`/registrations/${encodeURIComponent(r)}`) };
      }
    }
    if (product?.demo && normRegNo(product.nafdacRegNo) === r) return { status: 'found', provider: 'seed', label: 'TrueMed demo registry', sourceUrl: null };
    return { status: 'unavailable', provider: 'sandbox' };
  }

  if (product && normRegNo(product.nafdacRegNo) === r) {
    return { status: 'found', provider: 'seed', label: 'NAFDAC Greenbook, copied by hand', sourceUrl: product.sourceUrl };
  }

  if (nafdacApi) {
    const res = await nafdacApi.registration(r);
    if (res.status !== 'unavailable') return { ...res, provider: 'nafdac', label: 'NAFDAC registry API', sourceUrl: null };
  }

  const g = await lookupRegNo(r);
  return { ...g, provider: 'greenbook', label: 'NAFDAC Greenbook portal' };
}

/**
 * Report a Gate 1 receipt as a custody event. DemoQuin units go to the sandbox;
 * real packs go nowhere until a real NAFDAC endpoint exists. Never throws.
 */
export async function reportReceived({ gtin, serial, batch, expiry, shopId, source }) {
  if (!sandbox || gtin !== DEMO_GTIN || !serial) return;
  try {
    const shop = shopId ? await Shop.findById(shopId).select('name licenceNo city').lean() : null;
    await sandbox.recordEvent({
      eventType: 'receive', gtin, serial, batch: batch ?? null, expiry: expiry ?? null,
      actor: { name: shop?.name ?? 'Unknown shop', licenceNo: shop?.licenceNo ?? null, city: shop?.city ?? null },
      source: source?.source ?? null,
    });
  } catch (err) {
    log.warn({ err: err.message }, 'sandbox custody event failed');
  }
}
