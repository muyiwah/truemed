import { result, val, isText, monthIndex, todayMonthIndex } from '../util.js';

/** EXPIRED — expiry month is before this month (a pack is good through its expiry month). */
export default function expired(ctx) {
  const id = 'EXPIRED';
  const exp = val(ctx, 'expiry');
  const e = monthIndex(exp);
  if (e == null) return result(id, 'hard', 'skipped', 'The expiry date could not be read.');
  if (e < todayMonthIndex(ctx.today)) {
    return result(id, 'hard', 'fail', `This pack expired in ${exp}.`, { usesReadText: isText(ctx, 'expiry'), fields: ['expiry'], evidenceRegion: 'date' });
  }
  return result(id, 'hard', 'pass', `Expiry ${exp} is in the future.`);
}
