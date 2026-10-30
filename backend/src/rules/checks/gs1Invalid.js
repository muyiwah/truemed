import { result } from '../util.js';

/** GS1_INVALID — a 2D/linear code is present but malformed or fails its check digit. */
export default function gs1Invalid(ctx) {
  const id = 'GS1_INVALID';
  const b = ctx.barcode;
  if (!b?.found) return result(id, 'hard', 'skipped', 'No barcode was found on the photo.');
  if (!b.isGs1) return result(id, 'hard', 'skipped', 'The barcode is not a GS1 medicine code.');
  if (!b.ok) {
    return result(id, 'hard', 'fail', 'The pack\'s 2D code is not a valid GS1 code.', { evidenceRegion: 'barcode', detail: { errors: b.errors } });
  }
  return result(id, 'hard', 'pass', 'The 2D code is a valid GS1 code.');
}
