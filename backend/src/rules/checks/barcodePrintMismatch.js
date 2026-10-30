import { result, normBatch } from '../util.js';

/** BARCODE_PRINT_MISMATCH — what the code says differs from what is printed (relabeling). */
export default function barcodePrintMismatch(ctx) {
  const id = 'BARCODE_PRINT_MISMATCH';
  const b = ctx.barcode;
  const printed = ctx.printed ?? {};
  if (!b?.found || !b.ok) return result(id, 'hard', 'skipped', 'No readable GS1 code to compare with the print.');
  const diffs = [];
  if (b.expiry && printed.expiry && b.expiry !== printed.expiry) diffs.push({ field: 'expiry', code: b.expiry, print: printed.expiry });
  if (b.batch && printed.batch && normBatch(b.batch) !== normBatch(printed.batch)) diffs.push({ field: 'batch', code: b.batch, print: printed.batch });
  if (!diffs.length) {
    if (!printed.expiry && !printed.batch) return result(id, 'hard', 'skipped', 'The printed batch and expiry could not be read.');
    return result(id, 'hard', 'pass', 'The code and the printed text agree.');
  }
  const d = diffs[0];
  const what = d.field === 'expiry' ? 'expiry' : 'batch';
  return result(id, 'hard', 'fail', `The barcode says ${what} ${d.code}, but the box says ${d.print}.`, {
    usesReadText: !ctx.confirmed, fields: diffs.map((x) => (x.field === 'expiry' ? 'expiry' : 'batch')), evidenceRegion: 'date', detail: { diffs },
  });
}
