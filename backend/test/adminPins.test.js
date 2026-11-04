import { describe, it, expect, vi } from 'vitest';

vi.mock('../src/config.js', () => ({ config: { ADMIN_PIN: 'owner-pin', JUDGE_PIN: 'judge-pin' } }));
vi.mock('../src/db/models/index.js', () => ({ Device: {} }));
const { requireAdmin, requireOwner } = await import('../src/routes/middleware.js');

const run = (mw, pin) => {
  const req = { get: (h) => (h.toLowerCase() === 'x-admin-pin' ? pin : undefined) };
  let status = 200; let passed = false;
  const res = { status: (s) => { status = s; return res; }, json: () => res };
  mw(req, res, () => { passed = true; });
  return { passed, status, role: req.adminRole };
};

describe('admin PINs', () => {
  it('owner PIN opens everything', () => {
    expect(run(requireAdmin, 'owner-pin')).toMatchObject({ passed: true, role: 'owner' });
    expect(run(requireOwner, 'owner-pin').passed).toBe(true);
  });
  it('judge PIN opens demo controls but not owner-only routes', () => {
    expect(run(requireAdmin, 'judge-pin')).toMatchObject({ passed: true, role: 'judge' });
    expect(run(requireOwner, 'judge-pin')).toMatchObject({ passed: false, status: 403 });
  });
  it('wrong or missing PIN is refused', () => {
    expect(run(requireAdmin, 'guess').status).toBe(403);
    expect(run(requireAdmin, undefined).status).toBe(403);
  });
});
