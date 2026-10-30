import { result, val } from '../util.js';

/**
 * WRONG_SHOP — the buyer's shop differs from the shop that received this serial.
 * Hard only when the buyer confirmed the shop (tapped it, or confirmed the AI's
 * match). An AI-matched, unconfirmed shop is Caution at most (D28).
 */
export default function wrongShop(ctx) {
  const id = 'WRONG_SHOP';
  if (ctx.gate !== 'home') return result(id, 'hard', 'skipped', 'Only checked on a home scan.');
  if (!val(ctx, 'serial')) return result(id, 'hard', 'skipped', 'This pack has no unit serial.');
  const a = ctx.answer;
  const p = ctx.pack;
  if (!p?.shopId) return result(id, 'hard', 'skipped', 'No shop has logged this pack yet.');
  if (!a || a.sourceType !== 'shop' || !a.shopId) return result(id, 'hard', 'skipped', 'The pack was not bought from a shop in our network.');
  if (String(a.shopId) === String(p.shopId)) return result(id, 'hard', 'pass', 'The pack is registered to the shop you bought it from.');
  const type = a.confirmed ? 'hard' : 'soft';
  return result(id, type, 'fail', 'This pack is registered to a different shop from the one you named.', {
    detail: { registeredShopId: String(p.shopId), answeredShopId: String(a.shopId), confirmed: !!a.confirmed },
  });
}
