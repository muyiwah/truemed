import { result } from '../util.js';

/** LOOKALIKE_NAME — soft: the brand name imitates a known brand ("Coglaet" vs "Colgate"). */
export default function lookalikeName(ctx) {
  const id = 'LOOKALIKE_NAME';
  const l = ctx.visual?.lookalike;
  if (!l) return result(id, 'soft', 'skipped', 'Brand name not checked.');
  if (l.isLookalike && (l.confidence ?? 0) >= 0.7) {
    return result(id, 'soft', 'fail', `The name "${l.readName}" looks like an imitation of "${l.resembles}".`, { evidenceRegion: 'label' });
  }
  return result(id, 'soft', 'pass', 'The brand name is not an imitation of a known brand.');
}
