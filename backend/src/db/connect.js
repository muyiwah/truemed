import mongoose from 'mongoose';
import { config } from '../config.js';
import { log } from '../lib/log.js';

export async function connectDb() {
  mongoose.set('strictQuery', true);
  await mongoose.connect(config.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  log.info('MongoDB connected');
  await syncSessionTtl();
}

/** createIndex can't change an existing TTL, so update it in place when the retention changes. */
async function syncSessionTtl() {
  const { SESSION_TTL_SECONDS } = await import('./models/index.js');
  try {
    await mongoose.connection.db.command({ collMod: 'scansessions', index: { keyPattern: { createdAt: 1 }, expireAfterSeconds: SESSION_TTL_SECONDS } });
  } catch (err) {
    // Fresh database: no collection or index yet; Mongoose creates it with the new TTL.
    if (!/ns does not exist|index not found|NamespaceNotFound|IndexNotFound/i.test(err.message)) log.warn({ err: err.message }, 'scan session TTL update failed');
  }
}

export const dbState = () => (mongoose.connection.readyState === 1 ? 'connected' : 'disconnected');
