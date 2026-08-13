/**
 * One-time migration: fix User collection indexes to support
 * phone-OTP users who have no email (null email must be allowed
 * for multiple documents).
 *
 * Run: node server/utils/fixUserIndexes.js
 */

import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'fundu';

if (!MONGODB_URI) {
  console.error('MONGODB_URI not set in .env');
  process.exit(1);
}

const conn = await mongoose.connect(MONGODB_URI, { dbName: MONGODB_DB_NAME });
const db = conn.connection.db;
const collection = db.collection('users');

try {
  const indexes = await collection.indexes();
  console.log('Current indexes:', indexes.map((i) => `${i.name} (unique=${i.unique}, sparse=${i.sparse})`));

  // Drop the old non-sparse email unique index if it exists
  const emailIdx = indexes.find((i) => i.key?.email !== undefined && !i.sparse);
  if (emailIdx) {
    await collection.dropIndex(emailIdx.name);
    console.log(`✓ Dropped old email index: ${emailIdx.name}`);
  } else {
    console.log('✓ No problematic email index found (already migrated or never created).');
  }

  // Drop old non-sparse phone unique index if it exists
  const phoneIdx = indexes.find((i) => i.key?.phone !== undefined && !i.sparse);
  if (phoneIdx) {
    await collection.dropIndex(phoneIdx.name);
    console.log(`✓ Dropped old phone index: ${phoneIdx.name}`);
  } else {
    console.log('✓ No problematic phone index found.');
  }

  // Re-create correct sparse unique indexes
  await collection.createIndex({ email: 1 }, { unique: true, sparse: true, background: true });
  console.log('✓ Created sparse unique index on email');

  await collection.createIndex({ phone: 1 }, { unique: true, sparse: true, background: true });
  console.log('✓ Created sparse unique index on phone');

  const finalIndexes = await collection.indexes();
  console.log('\nFinal indexes:', finalIndexes.map((i) => `${i.name} (unique=${i.unique}, sparse=${i.sparse})`));

  console.log('\n✅ Migration complete. Restart the server.');
} catch (err) {
  console.error('Migration error:', err.message);
} finally {
  await mongoose.disconnect();
}
