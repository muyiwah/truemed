import { result, val, monthIndex, todayMonthIndex } from '../util.js';

/** EXPIRING_SOON — info: expires within 3 months. */
export default function expiringSoon(ctx) {
  const id = 'EXPIRING_SOON';
  const e = monthIndex(val(ctx, 'expiry'));
  if (e == null) return result(id, 'info', 'skipped', 'Expiry not read.');
  const left = e - todayMonthIndex(ctx.today);
  if (left >= 0 && left < 3) return result(id, 'info', 'fail', `Expires soon (${val(ctx, 'expiry')}).`);
  return result(id, 'info', 'pass', 'Not close to expiry.');
}
