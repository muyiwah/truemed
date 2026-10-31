import { result, val, isText, normRegNo } from '../util.js';

/**
 * REG_NOT_FOUND — hard, but only on a positive answer from a registry (D27).
 * Our seed covers a few dozen products; "not in our list" is not evidence.
 * `ctx.regLookup` comes from registry/index.js and names its source.
 */
export default function regNotFound(ctx) {
  const id = 'REG_NOT_FOUND';
  const regNo = val(ctx, 'regNo');
  if (!regNo) return result(id, 'hard', 'skipped', 'No NAFDAC number could be read from the pack.');
  const lookup = ctx.regLookup ?? { status: 'not_attempted' };
  const where = lookup.label ?? 'the NAFDAC portal';
  const source = lookup.sourceUrl ?? lookup.label;

  if (lookup.status === 'found') return result(id, 'hard', 'pass', `NAFDAC number ${regNo} is registered (${where}).`, { source });
  if (lookup.status === 'not_found') {
    return result(id, 'hard', 'fail', `NAFDAC number ${regNo} is not registered (${where}).`, {
      usesReadText: isText(ctx, 'regNo'), fields: ['regNo'], evidenceRegion: 'label', source,
    });
  }
  if (ctx.product && normRegNo(ctx.product.nafdacRegNo) === normRegNo(regNo)) {
    return result(id, 'hard', 'pass', `NAFDAC number ${regNo} is in the registry.`, { source: ctx.product.sourceUrl });
  }
  return result(id, 'hard', 'skipped', `We could not confirm NAFDAC number ${regNo} right now.`);
}
