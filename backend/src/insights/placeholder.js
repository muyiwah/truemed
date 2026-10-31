/**
 * SAMPLE DATA for the Insights page, used only until real numbers exist.
 * Every section built from this is sent with `source: 'sample'` and the page
 * labels it "Sample data". Replace by running `npm run eval` (accuracy) and by
 * real scans (network). Never present these figures as results.
 */
export const SAMPLE_EVAL = {
  ranAt: null,
  cases: 28,
  genuineCases: 16,
  verdictAccuracy: 0.93,
  falseHighOnGenuine: 0,
  hardCheckPrecision: 1,
  hardCheckRecall: 0.92,
  fieldAccuracy: { brandName: 0.97, regNo: 0.89, batch: 0.93, expiry: 0.96, manufactureDate: 0.91 },
  medianLatencyMs: 9800,
  costPerScanUsd: 0.021,
};

export const SAMPLE_NETWORK = {
  scans: { total: 214, home: 151, receiving: 58, carton: 5 },
  verdicts: { genuine_authorized: 61, checked_open_market: 19, no_red_flags: 48, no_record: 42, caution: 21, high_risk: 14, cant_verify: 9 },
  caught: { SERIAL_CLONE: 4, WRONG_SHOP: 3, EXPIRED: 5, ALERT_MATCH: 2, SERIAL_NEVER_ISSUED: 3, TAMPER_SIGNS: 6 },
  cities: [{ city: 'Lagos', scans: 162, flagged: 24 }, { city: 'Ibadan', scans: 31, flagged: 6 }, { city: 'Kano', scans: 21, flagged: 5 }],
  shopsWarned: 4,
  caseFiles: 7,
  packsInLedger: 120,
  alertsApproved: 5,
};

export const SAMPLE_TIMINGS = { quality: 200, samBarcode0: 2300, extraction: 5000, tamper: 8200, total: 8200 };
