import { result, val } from '../util.js';

/**
 * ALREADY_SOLD_ELSEWHERE — another device verified this serial in another city.
 * Without both cities we cannot say "elsewhere": skipped, never pass (D29).
 */
export default function alreadySoldElsewhere(ctx) {
  const id = 'ALREADY_SOLD_ELSEWHERE';
  if (ctx.gate !== 'home') return result(id, 'hard', 'skipped', 'Only checked on a home scan.');
  if (!val(ctx, 'serial')) return result(id, 'hard', 'skipped', 'This pack has no unit serial.');
  const others = (ctx.priorVerifications ?? []).filter((v) => v.deviceId !== ctx.device?.deviceId);
  if (!others.length) return result(id, 'hard', 'pass', 'No one else has checked this serial.');
  const myCity = ctx.device?.city;
  if (!myCity) return result(id, 'hard', 'skipped', 'Location was not shared, so we cannot compare cities.');
  const far = others.find((v) => v.city && v.city.toLowerCase() !== myCity.toLowerCase());
  if (far) return result(id, 'hard', 'fail', `This serial was already checked by someone in ${far.city}. A genuine serial belongs to one pack.`);
  return result(id, 'hard', 'pass', 'No check of this serial from another city.');
}
