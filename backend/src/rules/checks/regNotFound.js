import { result, val, isText } from '../util.js';

/**
 * REG_NOT_FOUND — hard, but only on a positive answer from NAFDAC (D27).
 * Our seed covers a few dozen products; "not in our list" is not evidence.
 */
export default function regNotFound(ctx) {
  const id = 'REG_NOT_FOUND';
  const regNo = val(ctx, 'regNo');
  if (!regNo) return result(id, 'hard', 'skipped', 'No NAFDAC number could be read from the pack.');
  if (ctx.product) return result(id, 'hard', 'pass', `NAFDAC number ${regNo} is in the registry.`, { source: ctx.product.sourceUrl });
  const status = ctx.regLookup?.status ?? 'not_attempted';
  if (status === 'found') return result(id, 'hard', 'pass', `NAFDAC number ${regNo} was found on the NAFDAC portal.`, { source: ctx.regLookup.sourceUrl });
  if (status === 'not_found') {
    return result(id, 'hard', 'fail', `NAFDAC number ${regNo} does not exist in NAFDAC's registry.`, {
      usesReadText: isText(ctx, 'regNo'), fields: ['regNo'], evidenceRegion: 'label', source: ctx.regLookup.sourceUrl,
    });
  }
  return result(id, 'hard', 'skipped', `We could not confirm NAFDAC number ${regNo} right now.`);
}
