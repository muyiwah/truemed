import { z } from 'zod';

/**
 * JSON Schemas (strict subset: every property required, additionalProperties
 * false, nullable as type unions) and the matching zod validators.
 */
const nStr = { type: ['string', 'null'] };
const conf = { type: 'number' };
const box = {
  type: ['object', 'null'],
  additionalProperties: false,
  required: ['image', 'x1', 'y1', 'x2', 'y2'],
  properties: { image: { type: 'integer' }, x1: { type: 'number' }, y1: { type: 'number' }, x2: { type: 'number' }, y2: { type: 'number' } },
};
const FIELDS = ['brandName', 'genericName', 'strength', 'dosageForm', 'manufacturer', 'nafdacRegNo', 'batchNo', 'manufactureDate', 'expiryDate', 'serial'];

export const extractionSchema = {
  type: 'object',
  additionalProperties: false,
  required: [...FIELDS, 'category', 'fieldConfidence', 'dateRegionBox', 'labelBox', 'unreadableFields', 'lookalike', 'imageQuality'],
  properties: {
    ...Object.fromEntries(FIELDS.map((f) => [f, nStr])),
    category: { type: 'string', enum: ['medicine', 'food', 'cosmetic', 'unknown'] },
    fieldConfidence: {
      type: 'object', additionalProperties: false, required: FIELDS,
      properties: Object.fromEntries(FIELDS.map((f) => [f, conf])),
    },
    dateRegionBox: box,
    labelBox: box,
    unreadableFields: { type: 'array', items: { type: 'string' } },
    lookalike: {
      type: 'object', additionalProperties: false, required: ['isLookalike', 'resembles', 'confidence', 'why'],
      properties: { isLookalike: { type: 'boolean' }, resembles: nStr, confidence: conf, why: nStr },
    },
    imageQuality: {
      type: 'object', additionalProperties: false, required: ['readable', 'problem'],
      properties: { readable: { type: 'boolean' }, problem: { type: ['string', 'null'], enum: ['blurry', 'glare', 'too_dark', 'too_far', 'cut_off', 'not_a_product', null] } },
    },
  },
};

const zBox = z.object({ image: z.number().int(), x1: z.number(), y1: z.number(), x2: z.number(), y2: z.number() }).nullable();
const ym = z.string().regex(/^\d{4}-\d{2}$/).nullable().catch(null);
export const extractionZod = z.object({
  brandName: z.string().nullable(),
  genericName: z.string().nullable(),
  strength: z.string().nullable(),
  dosageForm: z.string().nullable(),
  manufacturer: z.string().nullable(),
  nafdacRegNo: z.string().nullable(),
  batchNo: z.string().nullable(),
  manufactureDate: ym,
  expiryDate: ym,
  serial: z.string().nullable(),
  category: z.enum(['medicine', 'food', 'cosmetic', 'unknown']),
  fieldConfidence: z.record(z.string(), z.number()),
  dateRegionBox: zBox,
  labelBox: zBox,
  unreadableFields: z.array(z.string()),
  lookalike: z.object({ isLookalike: z.boolean(), resembles: z.string().nullable(), confidence: z.number(), why: z.string().nullable() }),
  imageQuality: z.object({ readable: z.boolean(), problem: z.string().nullable() }),
});

export const tamperSchema = {
  type: 'object', additionalProperties: false, required: ['signs', 'summary'],
  properties: {
    signs: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['kind', 'description', 'confidence', 'box'],
        properties: {
          kind: { type: 'string', enum: ['overprinted_text', 'sticker_over_print', 'mismatched_font', 'scratched_or_erased', 'misaligned_reprint', 'other'] },
          description: { type: 'string' },
          confidence: conf,
          box: { type: ['object', 'null'], additionalProperties: false, required: ['x1', 'y1', 'x2', 'y2'], properties: { x1: conf, y1: conf, x2: conf, y2: conf } },
        },
      },
    },
    summary: { type: 'string' },
  },
};
export const tamperZod = z.object({
  signs: z.array(z.object({ kind: z.string(), description: z.string(), confidence: z.number(), box: z.object({ x1: z.number(), y1: z.number(), x2: z.number(), y2: z.number() }).nullable() })),
  summary: z.string(),
});

export const artworkSchema = {
  type: 'object', additionalProperties: false, required: ['samePackDesign', 'differences', 'summary'],
  properties: {
    samePackDesign: { type: 'boolean' },
    differences: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['what', 'confidence', 'box'],
        properties: {
          what: { type: 'string' },
          confidence: conf,
          box: { type: ['object', 'null'], additionalProperties: false, required: ['x1', 'y1', 'x2', 'y2'], properties: { x1: conf, y1: conf, x2: conf, y2: conf } },
        },
      },
    },
    summary: { type: 'string' },
  },
};
export const artworkZod = z.object({
  samePackDesign: z.boolean(),
  differences: z.array(z.object({ what: z.string(), confidence: z.number(), box: z.object({ x1: z.number(), y1: z.number(), x2: z.number(), y2: z.number() }).nullable() })),
  summary: z.string(),
});
