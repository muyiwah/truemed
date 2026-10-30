/**
 * Load seed/*.json into Mongo (upsert by natural key) and reset the DemoQuin world.
 *   npm run seed
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import mongoose from 'mongoose';
import { connectDb } from '../connect.js';
import { Product, Alert, Shop } from '../models/index.js';
import { DEMO_GTIN, resetDemo } from '../../demo/demoquin.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../../../seed');
const load = async (f) => JSON.parse(await readFile(join(root, f), 'utf8'));

await connectDb();

const { shops } = await load('shops.json');
for (const { key, ...s } of shops) await Shop.updateOne({ name: s.name }, { $set: { ...s, demo: true, verified: true } }, { upsert: true });

const { products } = await load('products.json');
for (const { key, ...p } of products) {
  p.gtins = (p.gtins ?? []).map((g) => (g === '__DEMO_GTIN__' ? DEMO_GTIN : g));
  if (!p.sourceUrl) throw new Error(`Product ${key} has no sourceUrl (rule 8)`);
  await Product.updateOne({ brandName: p.brandName, nafdacRegNo: p.nafdacRegNo }, { $set: { ...p, verifiedAt: new Date() } }, { upsert: true });
}

const { alerts } = await load('alerts.json');
for (const { key, ...a } of alerts) {
  if (!a.sourceUrl) throw new Error(`Alert ${key} has no sourceUrl (rule 8)`);
  await Alert.updateOne({ title: a.title }, { $set: { ...a, issuedAt: a.issuedAt ? new Date(a.issuedAt) : null, approvedAt: new Date() } }, { upsert: true });
}

const demo = await resetDemo();
console.log(`Seeded ${shops.length} shops, ${products.length} products, ${alerts.length} alerts. DemoQuin GTIN ${demo.gtin}.`);
await mongoose.disconnect();
