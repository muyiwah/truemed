import { result, val, isText, monthIndex } from '../util.js';

const MARGIN_MONTHS = 6;

/** SHELF_LIFE_IMPLAUSIBLE — expiry is further from manufacture than the product ever lasts (relabeling). */
export default function shelfLifeImplausible(ctx) {
  const id = 'SHELF_LIFE_IMPLAUSIBLE';
  const life = ctx.product?.normalShelfLifeMonths;
  const m = monthIndex(val(ctx, 'manufactureDate'));
  const e = monthIndex(val(ctx, 'expiry'));
  if (!life) return result(id, 'hard', 'skipped', 'We do not hold this product\'s normal shelf life.');
  if (m == null || e == null) return result(id, 'hard', 'skipped', 'Manufacture and expiry dates are both needed.');
  const span = e - m;
  const uses = isText(ctx, 'manufactureDate') || isText(ctx, 'expiry');
  if (span <= 0) {
    return result(id, 'hard', 'fail', 'The expiry date is not after the manufacture date.', { usesReadText: uses, fields: ['manufactureDate', 'expiry'], evidenceRegion: 'date' });
  }
  if (span > life + MARGIN_MONTHS) {
    return result(id, 'hard', 'fail', `The dates give a shelf life of ${span} months; this product normally lasts ${life} months. The date may have been changed.`, {
      usesReadText: uses, fields: ['manufactureDate', 'expiry'], evidenceRegion: 'date', source: ctx.product.sourceUrl,
    });
  }
  return result(id, 'hard', 'pass', `Shelf life of ${span} months is normal for this product.`);
}
