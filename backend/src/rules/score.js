/**
 * Turns check results into a verdict. Pure: no I/O.
 *
 * Order matters and follows CLAUDE.md §7:
 *   0. a hard fail resting on unconfirmed AI-read text → ask the user first
 *   1. any hard fail → High risk
 *   2. any soft fail → Caution
 *   3. nothing identifying could be read → Can't verify
 *   4. product unknown to us and to NAFDAC lookup → No record
 *   5. custody known and shop confirmed → Genuine: authorized chain / Checked: open-market source
 *   6. otherwise → No red flags
 */

const HEADLINE_ORDER = ['SERIAL_CLONE', 'SERIAL_NEVER_ISSUED', 'ALERT_MATCH', 'BARCODE_PRINT_MISMATCH', 'REG_NOT_FOUND', 'REG_PRODUCT_MISMATCH', 'GS1_INVALID', 'WRONG_SHOP', 'ALREADY_SOLD_ELSEWHERE', 'SHELF_LIFE_IMPLAUSIBLE', 'EXPIRED'];
const rank = (id) => { const i = HEADLINE_ORDER.indexOf(id); return i === -1 ? HEADLINE_ORDER.length : i; };

export const DISCLAIMER = 'This is a screening tool, not a lab test. Confirm with a pharmacist.';
export const NO_RECORD_NOTE = "This does not mean it's fake.";

/** @typedef {'needs_confirmation'|'high_risk'|'caution'|'cant_verify'|'no_record'|'genuine_authorized'|'checked_open_market'|'no_red_flags'} VerdictCode */

const pluralChecks = (n) => `${n} check${n === 1 ? '' : 's'}`;

/**
 * @param {import('./util.js').CheckResult[]} checks
 * @param {Object} ctx
 * @returns {{ code: VerdictCode, title: string, line: string, tone: 'red'|'amber'|'green'|'grey'|'blue', confirmFields?: string[], passed: number, failed: string[], disclaimer: string, provenance?: string|null }}
 */
export function score(checks, ctx) {
  const passed = checks.filter((c) => c.status === 'pass').length;
  // Lead with the most telling failure (the headline the buyer reads first).
  const hard = checks.filter((c) => c.status === 'fail' && c.type === 'hard').sort((a, b) => rank(a.id) - rank(b.id));
  const soft = checks.filter((c) => c.status === 'fail' && c.type === 'soft');
  const failed = [...hard, ...soft].map((c) => c.id);
  const base = { passed, failed, disclaimer: DISCLAIMER, provenance: provenanceLine(ctx) };

  const needsConfirm = hard.filter((c) => c.usesReadText && !ctx.confirmed);
  if (needsConfirm.length) {
    const fields = [...new Set(needsConfirm.flatMap((c) => c.fields ?? []))];
    return { ...base, code: 'needs_confirmation', tone: 'blue', title: 'Please check what we read', line: 'Before we warn you about this pack, confirm the details we read from it.', confirmFields: fields };
  }

  if (hard.length) {
    const onlyExpired = hard.every((c) => c.id === 'EXPIRED');
    return {
      ...base,
      code: 'high_risk',
      tone: 'red',
      title: onlyExpired ? 'Expired' : 'High risk',
      line: onlyExpired ? `${hard[0].reason} Don't use it; show it to a pharmacist.` : `${hard[0].reason} Don't use it until a pharmacist has checked it.`,
    };
  }

  if (soft.length) {
    return { ...base, code: 'caution', tone: 'amber', title: 'Caution', line: `${soft[0].reason} Ask a pharmacist to look at this pack.` };
  }

  const f = ctx.fields ?? {};
  if (!f.regNo?.value && !f.batch?.value && !f.serial?.value) {
    return { ...base, code: 'cant_verify', tone: 'grey', title: "Can't verify", line: 'We could not read the NAFDAC number or batch. Take a clearer photo of the back of the pack.' };
  }

  const known = Boolean(ctx.product) || ctx.regLookup?.status === 'found';
  if (!known) {
    return { ...base, code: 'no_record', tone: 'grey', title: 'No record', line: `We don't have this product in our data. ${NO_RECORD_NOTE}` };
  }

  const custody = custodyConfirmed(ctx);
  if (custody === 'authorized') {
    return { ...base, code: 'genuine_authorized', tone: 'green', title: 'Genuine: authorized chain', line: `No problems found in ${pluralChecks(passed)}.` };
  }
  if (custody === 'open_market') {
    return { ...base, code: 'checked_open_market', tone: 'green', title: 'Checked: open-market source', line: `No problems found in ${pluralChecks(passed)}.` };
  }

  return { ...base, code: 'no_red_flags', tone: 'green', title: 'No red flags', line: `No problems found in ${pluralChecks(passed)}.` };
}

/** Custody counts only when the shop that logged the pack is the shop the buyer confirmed. */
function custodyConfirmed(ctx) {
  const p = ctx.pack;
  if (!p?.shopId || !p.source) return null;
  if (ctx.gate === 'receiving' || ctx.gate === 'carton') return null;
  const a = ctx.answer;
  if (!a || a.sourceType !== 'shop' || !a.confirmed || String(a.shopId) !== String(p.shopId)) return null;
  return p.source;
}

/** "Received by Ikeja Care Pharmacy (demo) from the open market, checked on arrival." */
export function provenanceLine(ctx) {
  const p = ctx.pack;
  const shop = ctx.packShop;
  if (!p?.shopId || !shop) return null;
  if (ctx.gate !== 'home') return null; // at receiving, another shop's custody is evidence, not provenance
  if (!custodyConfirmed(ctx)) return null; // ask first, reveal after (rule 5)
  const from = p.source === 'open_market' ? 'from the open market' : `from ${p.supplierName || 'an authorized supplier'}`;
  return `Received by ${shop.name} ${from}, checked on arrival.`;
}
