/**
 * NAFDAC Greenbook — single lookup, cached 24 h (rule 11).
 *
 * NAFDAC publishes no API. We may look up ONE unknown registration number at
 * human volume, never in bulk. The portal's request shape has not been
 * verified yet, so the live lookup stays off (`GREENBOOK_LOOKUP=off`) and every
 * unknown number returns `not_attempted` → the verdict is "No record", which
 * never accuses a pack (D27). TODO(data): confirm the portal's search request
 * by hand, then implement `liveLookup` with a 6 s timeout.
 */
import { RegLookup } from '../db/models/index.js';
import { config } from '../config.js';
import { normRegNo } from '../rules/util.js';

export async function lookupRegNo(regNo) {
  const r = normRegNo(regNo);
  if (!r) return { status: 'not_attempted' };
  const cached = await RegLookup.findOne({ regNo: r }).lean();
  if (cached) return { status: cached.status, sourceUrl: cached.sourceUrl, data: cached.data };
  if (config.GREENBOOK_LOOKUP !== 'on') return { status: 'not_attempted' };
  try {
    const res = await liveLookup(r);
    if (res.status === 'found' || res.status === 'not_found') await RegLookup.create({ regNo: r, ...res });
    return res;
  } catch {
    return { status: 'unavailable' };
  }
}

// eslint-disable-next-line no-unused-vars
async function liveLookup(regNo) {
  return { status: 'unavailable' };
}
