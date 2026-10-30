import mongoose from 'mongoose';
import { config } from '../config.js';
import { log } from '../lib/log.js';

export async function connectDb() {
  mongoose.set('strictQuery', true);
  await mongoose.connect(config.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  log.info('MongoDB connected');
}

export const dbState = () => (mongoose.connection.readyState === 1 ? 'connected' : 'disconnected');
