import { result } from '../util.js';

/** TAMPER_SIGNS — soft: overprinting, stickers, mismatched fonts on the date/batch area. */
export default function tamperSigns(ctx) {
  const id = 'TAMPER_SIGNS';
  const t = ctx.visual?.tamper;
  if (!t) return result(id, 'soft', 'skipped', 'The date area could not be examined.');
  const strong = (t.signs ?? []).filter((s) => (s.confidence ?? 0) >= 0.7);
  if (strong.length) {
    return result(id, 'soft', 'fail', `The date area shows signs of being changed (${strong.map((s) => s.kind).join(', ')}).`, {
      evidenceRegion: 'date', detail: { signs: strong },
    });
  }
  return result(id, 'soft', 'pass', 'No signs of tampering on the date area.');
}
