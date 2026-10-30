/**
 * GS1 element strings: the data inside a pharma DataMatrix.
 *
 * A scanner gives us either a raw string with FNC1 separators (ASCII 29, "GS")
 * between variable-length fields, or a human-readable form like
 * "(01)06151234567890(17)280531(10)AB123(21)XYZ". Both are parsed here.
 *
 * Only the Application Identifiers TrueMed uses are understood:
 *   01 GTIN (14 digits, fixed)    17 expiry YYMMDD (fixed)
 *   11 production date (fixed)    10 batch/lot (variable, ≤20)
 *   21 serial (variable, ≤20)
 * Anything else is kept in `other` so a valid code is never called malformed
 * just because it carries an AI we don't use.
 */

const GS = String.fromCharCode(29);

// Fixed lengths for AIs we may meet; variable ones are absent from this map.
const FIXED = { '00': 18, '01': 14, '02': 14, '11': 6, '12': 6, '13': 6, '15': 6, '16': 6, '17': 6, '20': 2 };
const VARIABLE_MAX = { '10': 20, '21': 20, '22': 20, '240': 30, '241': 30, '710': 20, '711': 20, '712': 20, '713': 20, '714': 20 };

/** Mod-10 GS1 check digit over all digits but the last. */
export function gtinCheckDigitValid(gtin) {
  if (!/^\d{8}$|^\d{12,14}$/.test(gtin)) return false;
  const digits = gtin.split('').map(Number);
  const check = digits.pop();
  let sum = 0;
  digits.reverse().forEach((d, i) => { sum += d * (i % 2 === 0 ? 3 : 1); });
  return (10 - (sum % 10)) % 10 === check;
}

/** Compute the check digit for a 13-digit body (used to mint DemoQuin GTINs). */
export function withCheckDigit(body13) {
  const digits = body13.split('').map(Number).reverse();
  let sum = 0;
  digits.forEach((d, i) => { sum += d * (i % 2 === 0 ? 3 : 1); });
  return body13 + ((10 - (sum % 10)) % 10);
}

/** YYMMDD → "YYYY-MM" (DD 00 means end of month, per GS1). Null if impossible. */
export function gs1DateToMonth(yymmdd) {
  if (!/^\d{6}$/.test(yymmdd)) return null;
  const yy = Number(yymmdd.slice(0, 2));
  const mm = Number(yymmdd.slice(2, 4));
  const dd = Number(yymmdd.slice(4, 6));
  if (mm < 1 || mm > 12 || dd > 31) return null;
  // GS1 century rule simplified: pharma expiries are 2000–2049.
  const year = yy >= 50 ? 1900 + yy : 2000 + yy;
  return `${year}-${String(mm).padStart(2, '0')}`;
}

function aiAt(s, i) {
  for (const len of [2, 3, 4]) {
    const ai = s.slice(i, i + len);
    if (FIXED[ai] !== undefined || VARIABLE_MAX[ai] !== undefined) return ai;
  }
  return null;
}

/**
 * Parse a GS1 element string.
 * @returns {{ ok: boolean, errors: string[], gtin?: string, batch?: string, expiry?: string, expiryRaw?: string, productionDate?: string, serial?: string, other: Record<string,string> }}
 */
export function parseGs1(raw) {
  const result = { ok: false, errors: [], other: {} };
  if (!raw || typeof raw !== 'string') {
    result.errors.push('empty');
    return result;
  }

  let s = raw.trim().replace(/^\]d2|^\]C1|^\]Q3/, ''); // symbology identifiers
  const fields = {};

  if (s.includes('(')) {
    const re = /\((\d{2,4})\)([^(]*)/g;
    let m;
    while ((m = re.exec(s))) fields[m[1]] = m[2].replace(new RegExp(GS, 'g'), '').trim();
    if (Object.keys(fields).length === 0) result.errors.push('no_application_identifiers');
  } else {
    s = s.replace(/^è|^\u001d/, ''); // leading FNC1 forms
    let i = 0;
    while (i < s.length) {
      if (s[i] === GS) { i++; continue; }
      const ai = aiAt(s, i);
      if (!ai) { result.errors.push(`unknown_ai_at_${i}`); break; }
      i += ai.length;
      if (FIXED[ai] !== undefined) {
        fields[ai] = s.slice(i, i + FIXED[ai]);
        i += FIXED[ai];
      } else {
        const end = s.indexOf(GS, i);
        const stop = end === -1 ? s.length : end;
        fields[ai] = s.slice(i, stop);
        i = stop;
      }
    }
  }

  for (const [ai, value] of Object.entries(fields)) {
    if (FIXED[ai] !== undefined && value.length !== FIXED[ai]) result.errors.push(`bad_length_${ai}`);
    if (VARIABLE_MAX[ai] !== undefined && (value.length === 0 || value.length > VARIABLE_MAX[ai])) result.errors.push(`bad_length_${ai}`);
    switch (ai) {
      case '01': result.gtin = value; break;
      case '10': result.batch = value; break;
      case '21': result.serial = value; break;
      case '17': result.expiryRaw = value; result.expiry = gs1DateToMonth(value); if (!result.expiry) result.errors.push('bad_date_17'); break;
      case '11': result.productionDate = gs1DateToMonth(value); if (!result.productionDate) result.errors.push('bad_date_11'); break;
      default: result.other[ai] = value;
    }
  }

  if (result.gtin !== undefined && !gtinCheckDigitValid(result.gtin)) result.errors.push('bad_gtin_check_digit');
  if (result.gtin === undefined && result.errors.length === 0) result.errors.push('missing_gtin');

  result.ok = result.errors.length === 0;
  return result;
}

/** Build a raw GS1 string (FNC1-separated) — used for DemoQuin labels. */
export function buildGs1({ gtin, expiryYYMMDD, batch, serial }) {
  return `(01)${gtin}(17)${expiryYYMMDD}(10)${batch}(21)${serial}`;
}
