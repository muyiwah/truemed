import { result, val } from '../util.js';

/** SERIAL_NEVER_ISSUED — the manufacturer shares its serial list and this one isn't on it (or wasn't dispatched). */
export default function serialNeverIssued(ctx) {
  const id = 'SERIAL_NEVER_ISSUED';
  if (!ctx.issuer?.participates) return result(id, 'hard', 'skipped', 'This manufacturer does not share its serial list yet.');
  const serial = val(ctx, 'serial');
  if (!serial) return result(id, 'hard', 'skipped', 'This pack has no unit serial.');
  const rec = ctx.issuer.record;
  if (!rec) return result(id, 'hard', 'fail', 'This serial was never issued by the manufacturer.', { source: 'Manufacturer serial list' });
  if (!rec.dispatchedAt) return result(id, 'hard', 'fail', 'This serial exists but was never dispatched from the factory.', { source: 'Manufacturer serial list' });
  return result(id, 'hard', 'pass', 'The manufacturer issued and dispatched this serial.', { source: 'Manufacturer serial list' });
}
