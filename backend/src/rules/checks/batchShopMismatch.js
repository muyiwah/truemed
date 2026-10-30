import { result, val } from '../util.js';

/** BATCH_SHOP_MISMATCH — soft: a batch-only pack whose batch the named shop never received. */
export default function batchShopMismatch(ctx) {
  const id = 'BATCH_SHOP_MISMATCH';
  if (ctx.gate !== 'home') return result(id, 'soft', 'skipped', 'Only checked on a home scan.');
  if (val(ctx, 'serial')) return result(id, 'soft', 'skipped', 'This pack has a unit serial.');
  const batch = val(ctx, 'batch');
  const a = ctx.answer;
  if (!batch || !a?.shopId || a.sourceType !== 'shop') return result(id, 'soft', 'skipped', 'Needs a batch number and a shop in our network.');
  const s = ctx.batchAtShop;
  if (!s?.shopInNetwork) return result(id, 'soft', 'skipped', 'That shop does not log its stock with TrueMed yet.');
  if (!s.received) return result(id, 'soft', 'fail', `The shop you named has no record of receiving batch ${batch}.`);
  return result(id, 'soft', 'pass', `The shop you named received batch ${batch}.`);
}
