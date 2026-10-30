import { result, val } from '../util.js';

/** SERIAL_CLONE — at receiving, this serial is already logged by a different shop. */
export default function serialClone(ctx) {
  const id = 'SERIAL_CLONE';
  if (ctx.gate !== 'receiving' && ctx.gate !== 'carton') return result(id, 'hard', 'skipped', 'Only checked when a shop receives stock.');
  const serial = val(ctx, 'serial');
  if (!serial) return result(id, 'hard', 'skipped', 'This pack has no unit serial.');
  const p = ctx.pack;
  if (p && p.shopId && String(p.shopId) !== String(ctx.receivingShopId)) {
    const where = ctx.packShop ? `${ctx.packShop.name}${ctx.packShop.city ? ` in ${ctx.packShop.city}` : ''}` : 'another shop';
    return result(id, 'hard', 'fail', `This serial was already received by ${where}. One of these packs is a copy.`, {
      detail: { otherShopId: String(p.shopId), receivedAt: p.receivedAt },
    });
  }
  return result(id, 'hard', 'pass', 'This serial has not been received by any other shop.');
}
