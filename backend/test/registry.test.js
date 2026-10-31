import { describe, it, expect } from 'vitest';
import { registryClient } from '../src/registry/client.js';
import regNotFound from '../src/rules/checks/regNotFound.js';
import regProductMismatch from '../src/rules/checks/regProductMismatch.js';

const reply = (code, body) => async () => ({ status: code, json: async () => body });
const client = (fetchImpl) => registryClient({ baseUrl: 'http://registry.test/v1/', fetchImpl });

describe('registry client', () => {
  it('found only on an explicit "registered" answer', async () => {
    const r = await client(reply(200, { status: 'registered', product: { brandName: 'DemoQuin' } })).registration('DEMO-0001');
    expect(r).toEqual({ status: 'found', data: { brandName: 'DemoQuin' } });
  });

  it('not_found only on an explicit "not_registered" 404', async () => {
    expect((await client(reply(404, { status: 'not_registered' })).registration('DEMO-0099')).status).toBe('not_found');
    // A bare 404 (wrong route, proxy page) is not evidence.
    expect((await client(reply(404, null)).registration('DEMO-0099')).status).toBe('unavailable');
  });

  it('outside_sandbox and errors are unavailable, never not_found', async () => {
    expect((await client(reply(422, { status: 'outside_sandbox' })).registration('A4-1234')).status).toBe('unavailable');
    const boom = async () => { throw new Error('ECONNREFUSED'); };
    expect((await client(boom).registration('DEMO-0001')).status).toBe('unavailable');
  });

  it('retries once on a network error or 503', async () => {
    let n = 0;
    const flaky = async () => (++n === 1 ? { status: 503, json: async () => null } : { status: 200, json: async () => ({ status: 'registered', product: {} }) });
    expect((await client(flaky).registration('DEMO-0001')).status).toBe('found');
    expect(n).toBe(2);
  });

  it('builds the path from the base URL and encodes the number', async () => {
    let url;
    await client(async (u) => { url = u; return { status: 404, json: async () => ({ status: 'not_registered' }) }; }).registration('DEMO 1/2');
    expect(url).toBe('http://registry.test/v1/registrations/DEMO%201%2F2');
  });
});

const fields = (regNo, brandName = 'DemoQuin') => ({
  regNo: { value: regNo, source: 'text' }, brandName: { value: brandName, source: 'text' }, genericName: { value: null }, strength: { value: null },
});
const demoProduct = { brandName: 'DemoQuin', genericName: 'Artemether Lumefantrine', strength: '20/120mg', nafdacRegNo: 'DEMO-0001', demo: true };

describe('registration checks with a registry source', () => {
  it('sandbox "not registered" fails REG_NOT_FOUND and names the simulated source', () => {
    const c = regNotFound({ fields: fields('DEMO-0099'), product: demoProduct, regLookup: { status: 'not_found', label: 'NAFDAC sandbox, simulated', sourceUrl: 'https://api.example/sandbox/nafdac/v1/registrations/DEMO-0099' } });
    expect(c.status).toBe('fail');
    expect(c.reason).toMatch(/simulated/);
    expect(c.usesReadText).toBe(true);
    expect(c.source).toMatch(/^https:/);
  });

  it('unavailable registry never fails, even with a product matched by barcode', () => {
    const c = regNotFound({ fields: fields('DEMO-0099'), product: demoProduct, regLookup: { status: 'unavailable' } });
    expect(c.status).toBe('skipped');
  });

  it('seed product with the same number still passes without a lookup', () => {
    expect(regNotFound({ fields: fields('demo-0001'), product: demoProduct }).status).toBe('pass');
  });

  it('REG_PRODUCT_MISMATCH defers when the printed number differs from the barcode-matched product', () => {
    const c = regProductMismatch({ fields: fields('DEMO-0099'), product: demoProduct });
    expect(c.status).toBe('skipped');
  });
});
