import { result, val, isText, nameSimilarity, normStrength, normRegNo } from '../util.js';

/** REG_PRODUCT_MISMATCH — the reg no. belongs to a different product or strength. */
export default function regProductMismatch(ctx) {
  const id = 'REG_PRODUCT_MISMATCH';
  const p = ctx.product;
  if (!p) return result(id, 'hard', 'skipped', 'No registry record to compare against.');
  const brand = val(ctx, 'brandName');
  const generic = val(ctx, 'genericName');
  const strength = val(ctx, 'strength');
  if (!brand && !generic) return result(id, 'hard', 'skipped', 'The product name could not be read.');
  // Found by barcode, but the pack prints another number: REG_NOT_FOUND judges that number.
  const regNo = val(ctx, 'regNo');
  if (regNo && normRegNo(regNo) !== normRegNo(p.nafdacRegNo)) {
    return result(id, 'hard', 'skipped', `The pack's NAFDAC number ${regNo} is not the one on file for ${p.brandName}; it is checked against the registry instead.`);
  }

  const nameScore = Math.max(
    brand ? nameSimilarity(brand, p.brandName) : 0,
    generic ? nameSimilarity(generic, p.genericName) : 0,
    brand ? nameSimilarity(brand, p.genericName) : 0,
  );
  const strengthMismatch = strength && p.strength && normStrength(strength) !== normStrength(p.strength);
  const uses = isText(ctx, 'brandName') || isText(ctx, 'genericName') || isText(ctx, 'strength') || isText(ctx, 'regNo');

  if (nameScore < 0.5) {
    return result(id, 'hard', 'fail', `NAFDAC number ${p.nafdacRegNo} is registered to ${p.brandName} (${p.genericName}), not to the product on this pack.`, {
      usesReadText: uses, fields: ['regNo', 'brandName'], evidenceRegion: 'label', source: p.sourceUrl,
    });
  }
  if (strengthMismatch) {
    return result(id, 'hard', 'fail', `NAFDAC number ${p.nafdacRegNo} is registered for ${p.strength}, but the pack says ${strength}.`, {
      usesReadText: uses, fields: ['regNo', 'strength'], evidenceRegion: 'label', source: p.sourceUrl,
    });
  }
  return result(id, 'hard', 'pass', `The NAFDAC number matches ${p.brandName}${p.strength ? ` ${p.strength}` : ''}.`, { source: p.sourceUrl });
}
