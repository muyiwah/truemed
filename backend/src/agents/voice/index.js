/**
 * The Voice agent.
 *  - interpretAnswer: a rough English-mode transcript (often Pidgin) or typed
 *    text → which shop, or market / street seller. The match is a suggestion:
 *    the UI asks the buyer to confirm it before it can drive a High verdict (D28).
 *  - explain: the verdict in en / pcm / yo / ha, from the evidence list only.
 */
import { z } from 'zod';
import { sparkJson, sparkText, textPart } from '../../services/meta.js';

const ANSWER_INSTRUCTIONS = `A buyer in Nigeria was asked "Where did you buy this?" Their answer may be in English or Nigerian Pidgin, typed or from an imperfect speech transcript (Pidgin words may be misheard as similar English words: "for" ~ "fo", "dey" ~ "day", "wey" ~ "way", "chemist" ~ "kemist").

Classify the answer:
- shop: a pharmacy or licensed chemist. Match it to ONE shop from the list using name, nickname or area. If no listed shop fits, shopId = null.
- market: an open market (Idumota, Balogun, "for market", "market woman").
- street: a hawker, street seller, bus/danfo seller, someone walking around.
- unknown: can't tell.
confidence 0–1 for the match. heard: the answer rewritten clearly in English (one short line).`;

const answerSchema = {
  type: 'object', additionalProperties: false, required: ['sourceType', 'shopId', 'confidence', 'heard'],
  properties: {
    sourceType: { type: 'string', enum: ['shop', 'market', 'street', 'unknown'] },
    shopId: { type: ['string', 'null'] },
    confidence: { type: 'number' },
    heard: { type: 'string' },
  },
};
const answerZod = z.object({ sourceType: z.enum(['shop', 'market', 'street', 'unknown']), shopId: z.string().nullable(), confidence: z.number(), heard: z.string() });

/** @param {string} text @param {{_id:any,name:string,area?:string,city?:string,aliases?:string[]}[]} shops */
export async function interpretAnswer(text, shops) {
  const list = shops.map((s) => `- id=${s._id} | ${s.name} | ${[s.area, s.city].filter(Boolean).join(', ')}${s.aliases?.length ? ` | also called: ${s.aliases.join('; ')}` : ''}`).join('\n');
  const { data } = await sparkJson({
    label: 'shop-answer',
    instructions: ANSWER_INSTRUCTIONS,
    content: [textPart(`Shops in the network:\n${list}\n\nBuyer's answer: """${text.slice(0, 500)}"""`)],
    schema: answerSchema,
    zod: answerZod,
    timeoutMs: 20_000,
    effort: 'minimal',
  });
  // Never trust an id the model invented.
  if (data.shopId && !shops.some((s) => String(s._id) === data.shopId)) data.shopId = null;
  if (data.sourceType === 'shop' && !data.shopId) data.confidence = Math.min(data.confidence, 0.3);
  return data;
}

const LANG = {
  en: 'plain, simple English',
  pcm: 'Nigerian Pidgin English, as people speak it in Lagos (natural, not exaggerated)',
  yo: 'Yoruba with correct tone marks',
  ha: 'Hausa',
};

const DISCLAIMERS = {
  en: 'This is a screening tool, not a lab test. Confirm with a pharmacist.',
  pcm: 'Dis na screening tool, no be lab test. Confirm am with pharmacist.',
  yo: 'Ohun èlò àyẹ̀wò ni èyí, kì í ṣe àyẹ̀wò ilé-ìwádìí. Ẹ fìdí rẹ̀ múlẹ̀ lọ́dọ̀ oníṣègùn òyìnbó (pharmacist).',
  ha: 'Wannan kayan tantancewa ne, ba gwajin dakin gwaje-gwaje ba. Ku tabbatar da likitan magunguna (pharmacist).',
};

const EXPLAIN_INSTRUCTIONS = (lang) => `You explain a medicine-pack screening result to an ordinary person in ${LANG[lang]}.

Rules:
- Use ONLY the facts given. Add no new claims, numbers, causes, or guesses.
- Never give medical advice: no dosing, no treatment, never say a product is "safe to take" or "genuine for sure".
- Never call a pack "fake" unless the verdict is High risk, and even then say what failed rather than "fake".
- If the verdict is "No record", say clearly that this does not mean it is fake.
- At most 60 words. Warm, calm, direct. Say what to do next (e.g. show the pack to a pharmacist, report it).
- Do not include the disclaimer; it is added separately.`;

/**
 * @param {{ verdict: object, checks: object[], provenance?: string|null, productName?: string|null }} evidence
 * @param {'en'|'pcm'|'yo'|'ha'} lang
 */
export async function explain(evidence, lang = 'en') {
  const facts = [
    `Verdict: ${evidence.verdict.title} — ${evidence.verdict.line}`,
    evidence.productName ? `Product read from pack: ${evidence.productName}` : null,
    evidence.provenance ? `Where it came from: ${evidence.provenance}` : null,
    'Checks that failed:',
    ...evidence.checks.filter((c) => c.status === 'fail').map((c) => `- ${c.reason}`),
    `Checks passed: ${evidence.checks.filter((c) => c.status === 'pass').length}`,
  ].filter(Boolean).join('\n');
  const { text } = await sparkText({ label: `explain-${lang}`, instructions: EXPLAIN_INSTRUCTIONS(lang), content: [textPart(facts)], timeoutMs: 20_000, effort: 'minimal' });
  return { text: text.trim(), disclaimer: DISCLAIMERS[lang] ?? DISCLAIMERS.en, lang };
}

export { DISCLAIMERS };
