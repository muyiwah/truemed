import { result, val } from '../util.js';

/** REPEAT_NEARBY — soft: someone else already checked this serial, same city or city unknown. */
export default function repeatNearby(ctx) {
  const id = 'REPEAT_NEARBY';
  if (ctx.gate !== 'home') return result(id, 'soft', 'skipped', 'Only checked on a home scan.');
  if (!val(ctx, 'serial')) return result(id, 'soft', 'skipped', 'This pack has no unit serial.');
  const myCity = ctx.device?.city?.toLowerCase();
  const others = (ctx.priorVerifications ?? []).filter((v) => v.deviceId !== ctx.device?.deviceId);
  const near = others.filter((v) => !myCity || !v.city || v.city.toLowerCase() === myCity);
  if (near.length) {
    return result(id, 'soft', 'fail', 'Another phone already checked this exact pack. If it was not someone in your household, ask the seller.');
  }
  return result(id, 'soft', 'pass', 'This is the first check of this pack.');
}
