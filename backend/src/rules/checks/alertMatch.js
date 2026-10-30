import { result, val, isText, normBatch, normRegNo, nameSimilarity } from '../util.js';

/**
 * ALERT_MATCH — batch (or a fake-only reg no.) appears in an approved NAFDAC alert.
 *
 * A reg number on its own is only evidence when the alert says that number is
 * itself fake. Many alerts describe genuine numbers copied onto fakes (e.g. SMA
 * Gold); matching on those would flag every genuine pack of that product.
 */
export default function alertMatch(ctx) {
  const id = 'ALERT_MATCH';
  const batch = normBatch(val(ctx, 'batch'));
  const regNo = normRegNo(val(ctx, 'regNo'));
  if (!batch && !regNo) return result(id, 'hard', 'skipped', 'No batch or NAFDAC number could be read.');
  const name = val(ctx, 'brandName') || val(ctx, 'genericName');

  for (const a of ctx.alerts ?? []) {
    if (a.status !== 'approved') continue;
    const batchHit = batch && (a.batches ?? []).some((b) => normBatch(b.batchNo) === batch);
    // A batch number alone could collide across products; require the name to fit when we have one.
    const nameFits = !name || !a.productName || nameSimilarity(name, a.productName) >= 0.5;
    const fakeReg = normRegNo(a.regNoOnFake);
    const regIsFakeOnly = fakeReg && fakeReg !== normRegNo(a.genuineRegNo) && !ctx.product;
    const regHit = regNo && regIsFakeOnly && fakeReg === regNo;

    if ((batchHit && nameFits) || regHit) {
      const what = batchHit ? `Batch ${batch}` : `NAFDAC number ${regNo}`;
      return result(id, 'hard', 'fail', `${what} matches NAFDAC ${a.alertNo ? `Public Alert ${a.alertNo}` : 'alert'}: ${a.title}.`, {
        usesReadText: batchHit ? isText(ctx, 'batch') : isText(ctx, 'regNo'),
        fields: [batchHit ? 'batch' : 'regNo'],
        evidenceRegion: 'date',
        source: a.sourceUrl,
        detail: { alertId: String(a._id ?? ''), alertNo: a.alertNo },
      });
    }
  }
  return result(id, 'hard', 'pass', 'Not in any NAFDAC alert we hold.');
}
