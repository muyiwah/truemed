import { result } from '../util.js';

/** ARTWORK_DIFFERENCE — soft: Muse Spark sees differences from the genuine reference. */
export default function artworkDifference(ctx) {
  const id = 'ARTWORK_DIFFERENCE';
  const a = ctx.visual?.artwork;
  if (!a) return result(id, 'soft', 'skipped', 'No genuine reference image to compare with.');
  const strong = (a.differences ?? []).filter((d) => (d.confidence ?? 0) >= 0.7);
  if (strong.length) {
    return result(id, 'soft', 'fail', `The packaging differs from the genuine pack in ${strong.length} place${strong.length > 1 ? 's' : ''}.`, {
      evidenceRegion: 'label', detail: { differences: strong },
    });
  }
  return result(id, 'soft', 'pass', 'The packaging matches the genuine reference.');
}
